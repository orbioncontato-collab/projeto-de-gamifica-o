-- 0007 — funções de trigger de negócio (DATA-MODEL §6.4–6.9). Todas em private, security definer.

-- =============================================================================
-- 6.4 handle_new_user — AFTER INSERT em auth.users
-- =============================================================================
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_code text;
  v_secrets public.app_secrets;
  v_admin_exists boolean;
  v_role public.user_role;
  v_status public.profile_status;
  v_season uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bootstrap_admin'));

  v_name := left(trim(coalesce(NEW.raw_user_meta_data ->> 'full_name', split_part(coalesce(NEW.email, ''), '@', 1))), 80);
  if v_name is null or v_name = '' then v_name := left(coalesce(NEW.email, NEW.id::text), 80); end if;
  v_code := upper(trim(NEW.raw_user_meta_data ->> 'team_code'));

  select * into v_secrets from public.app_secrets where id = 1;
  if not found then
    raise exception using message = 'BOOTSTRAP_NOT_CONFIGURED', detail = 'Instalação incompleta: aplique o schema.sql por inteiro.', errcode = 'P0001';
  end if;

  v_admin_exists := exists (select 1 from public.profiles p where p.role = 'admin');

  if not v_admin_exists and not v_secrets.bootstrap_done then
    if v_secrets.bootstrap_email is not null and lower(coalesce(NEW.email, '')) is distinct from v_secrets.bootstrap_email then
      raise exception using message = 'BOOTSTRAP_EMAIL_MISMATCH', detail = 'Este e-mail não está autorizado a criar a instalação.', errcode = 'P0001';
    end if;
    if v_secrets.bootstrap_email is not null and NEW.email_confirmed_at is null then
      raise exception using message = 'BOOTSTRAP_REQUIRES_CONFIRMED_EMAIL', detail = 'O primeiro gestor precisa ser criado pelo painel do Supabase (usuário já confirmado).', errcode = 'P0001';
    end if;
    v_role := 'admin';
    update public.app_secrets set bootstrap_done = true, updated_at = pg_catalog.now() where id = 1;
  else
    if v_code is null or v_code = '' or v_code is distinct from v_secrets.team_code then
      raise exception using message = 'INVALID_TEAM_CODE', detail = 'Código da equipe inválido.', errcode = 'P0001';
    end if;
    v_role := 'collaborator';
  end if;

  v_status := case when v_role = 'admin' then 'active'::public.profile_status
                   when coalesce((select s.auto_approve_members from public.app_settings s where s.id = 1), false) then 'active'::public.profile_status
                   else 'pending'::public.profile_status end;

  insert into public.profiles (id, full_name, role, status) values (NEW.id, v_name, v_role, v_status);
  insert into public.profile_private (profile_id, email) values (NEW.id, lower(coalesce(NEW.email, NEW.id::text)));
  insert into public.profile_lifetime_stats (profile_id) values (NEW.id);

  v_season := public.active_season_id();
  if v_season is not null then
    insert into public.season_goals (season_id, profile_id, goal_amount) values (v_season, NEW.id, 0) on conflict do nothing;
  end if;

  if v_role = 'collaborator' and v_status = 'pending' then
    perform private.notify_admins('system', 'Novo membro aguardando aprovação',
      v_name || ' se cadastrou com o código da equipe e aguarda sua aprovação.',
      jsonb_build_object('profile_id', NEW.id, 'action', 'approve_member'));
  elsif v_role = 'collaborator' and v_status = 'active' then
    perform private.notify_all('system', 'Novo membro', v_name || ' entrou na equipe.', jsonb_build_object('profile_id', NEW.id), NEW.id);
  end if;

  return NEW;
end $$;

-- =============================================================================
-- 6.5 protect_profile_columns — BEFORE UPDATE em profiles
-- =============================================================================
create or replace function private.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_is_admin boolean := public.is_admin();
begin
  if not v_is_admin then
    if (NEW.role, NEW.status, NEW.job_title, NEW.team) is distinct from (OLD.role, OLD.status, OLD.job_title, OLD.team) then
      raise exception using message = 'FORBIDDEN_COLUMN', detail = 'Você só pode alterar nome, foto, cor e preferências.', errcode = '42501';
    end if;
    if NEW.avatar_path is not null and NEW.avatar_path !~ ('^' || OLD.id::text || '/') then
      raise exception using message = 'INVALID_AVATAR_PATH', detail = 'Caminho de foto inválido.', errcode = 'P0001';
    end if;
  end if;
  if (NEW.role <> 'admin' or NEW.status <> 'active') and OLD.role = 'admin' and OLD.status = 'active'
     and (select count(*) from public.profiles p where p.role = 'admin' and p.status = 'active' and p.id <> OLD.id) = 0 then
    raise exception using message = 'LAST_ADMIN', detail = 'Não é possível rebaixar ou inativar o último gestor ativo.', errcode = 'P0001';
  end if;
  return NEW;
end $$;

-- =============================================================================
-- 6.6 before_point_entry — BEFORE INSERT em point_entries (coração do ledger)
-- =============================================================================
create or replace function private.before_point_entry()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_orig public.point_entries;
  v_closed timestamptz;
  v_rule public.point_rules;
  v_event_id uuid;
  v_event_mult numeric;
  v_boost_id uuid;
  v_boost_mult numeric;
begin
  NEW.created_by := coalesce((select auth.uid()), NEW.created_by);

  if NEW.reverses_entry_id is not null then
    select * into v_orig from public.point_entries where id = NEW.reverses_entry_id;
    if not found then
      raise exception using message = 'ENTRY_NOT_FOUND', detail = 'Lançamento não encontrado.', errcode = 'P0001';
    end if;
    if v_orig.profile_id is distinct from NEW.profile_id then
      raise exception using message = 'REVERSAL_MISMATCH', detail = 'Estorno inconsistente com o lançamento original.', errcode = 'P0001';
    end if;
    NEW.occurred_at := v_orig.occurred_at;      -- estorno herda a data do fato (§1.12)
    NEW.season_id := v_orig.season_id;
    NEW.points := -v_orig.points;
    NEW.coins := -v_orig.coins;
    NEW.amount := case when v_orig.amount is null then null else -v_orig.amount end;
    NEW.metric := v_orig.metric;
    NEW.quantity := v_orig.quantity;
    NEW.base_points := -v_orig.base_points;
    NEW.multiplier := 1;
    NEW.rule_id := v_orig.rule_id;
    NEW.source := v_orig.source;                -- DECISIONS.md #1: estorno herda a source da original
    NEW.special_event_id := null;
    NEW.boost_id := null;
  else
    NEW.occurred_at := coalesce(NEW.occurred_at, pg_catalog.now());
    NEW.season_id := private.season_for(NEW.occurred_at);
    if NEW.season_id is null then
      raise exception using message = 'NO_SEASON_FOR_DATE', detail = 'Não existe temporada cobrindo esta data.', errcode = 'P0001';
    end if;
  end if;

  select s.closed_at into v_closed from public.seasons s where s.id = NEW.season_id;
  if v_closed is not null and NEW.reverses_entry_id is null and pg_catalog.current_setting('app.allow_closed', true) is distinct from 'on' then
    raise exception using message = 'SEASON_CLOSED', detail = 'Esta temporada já foi encerrada.', errcode = 'P0001';
  end if;

  if NEW.reverses_entry_id is null and NEW.source = 'rule' then
    select * into v_rule from public.point_rules r where r.id = NEW.rule_id and r.deleted_at is null;
    if not found then
      raise exception using message = 'RULE_NOT_FOUND', detail = 'Regra de pontuação não encontrada.', errcode = 'P0001';
    end if;
    if not v_rule.is_active then
      raise exception using message = 'RULE_INACTIVE', detail = 'Esta regra está inativa.', errcode = 'P0001';
    end if;
    NEW.quantity := coalesce(NEW.quantity, 1);
    NEW.metric := v_rule.metric;
    NEW.base_points := v_rule.points * NEW.quantity;
    NEW.coins := v_rule.coins * NEW.quantity;
    if v_rule.requires_amount and (NEW.amount is null or NEW.amount <= 0) then
      raise exception using message = 'AMOUNT_REQUIRED', detail = 'Informe o valor em R$ da venda.', errcode = 'P0001';
    end if;
    select e.id, e.multiplier into v_event_id, v_event_mult
      from public.special_events e
     where e.is_active and e.deleted_at is null and NEW.occurred_at >= e.starts_at and NEW.occurred_at < e.ends_at
     limit 1;
    select b.id, b.multiplier into v_boost_id, v_boost_mult
      from public.profile_boosts b
     where b.profile_id = NEW.profile_id and NEW.occurred_at >= b.starts_at and NEW.occurred_at < b.expires_at
     order by b.multiplier desc limit 1;
    NEW.multiplier := greatest(1, coalesce(v_event_mult, 1), coalesce(v_boost_mult, 1));
    NEW.special_event_id := case when v_event_id is not null and v_event_mult >= coalesce(v_boost_mult, 0) then v_event_id end;
    NEW.boost_id := case when v_boost_id is not null and coalesce(v_boost_mult, 0) > coalesce(v_event_mult, 0) then v_boost_id end;
    NEW.points := round(NEW.base_points * NEW.multiplier)::int;
  elsif NEW.reverses_entry_id is null then
    NEW.multiplier := 1;
    NEW.special_event_id := null;
    NEW.boost_id := null;
    NEW.base_points := coalesce(NEW.base_points, NEW.points, 0);
    NEW.points := NEW.base_points;
    NEW.coins := coalesce(NEW.coins, 0);
  end if;

  -- todo débito de moedas serializa no lock wallet (ordem wallet → progress, sem deadlock)
  if NEW.coins < 0 then
    perform private.lock_profile(NEW.profile_id, 'wallet');
  end if;

  return NEW;
end $$;

-- =============================================================================
-- 6.9 evaluate_goal_milestone — marco "Meta mensal" + conquista META BATIDA
-- =============================================================================
create or replace function private.evaluate_goal_milestone(p_profile_id uuid, p_season_id uuid, p_occurred_at timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_season public.seasons;
  v_goal numeric;
  v_sales numeric;
  v_rule public.point_rules;
  v_ts timestamptz;
  v_entry public.point_entries;
  v_entry_id uuid;
  v_ach public.achievements;
begin
  select * into v_season from public.seasons s where s.id = p_season_id;
  if not found then
    raise exception using message = 'SEASON_NOT_FOUND', detail = 'Temporada não encontrada.', errcode = 'P0001';
  end if;
  if v_season.closed_at is not null then return; end if;
  if pg_catalog.now() < v_season.starts_at then return; end if;

  perform private.lock_profile(p_profile_id, 'progress');

  select g.goal_amount into v_goal from public.season_goals g where g.season_id = p_season_id and g.profile_id = p_profile_id;
  select coalesce(ss.sales_amount, 0) into v_sales from public.profile_season_stats ss where ss.profile_id = p_profile_id and ss.season_id = p_season_id;
  v_sales := coalesce(v_sales, 0);
  if v_goal is null or v_goal <= 0 or v_sales < v_goal then return; end if;

  v_ts := least(coalesce(p_occurred_at, pg_catalog.now()), v_season.ends_at - interval '1 second');
  v_ts := greatest(v_ts, v_season.starts_at);

  select * into v_rule from public.point_rules r where r.trigger_kind = 'auto_goal' and r.is_active and r.deleted_at is null limit 1;
  if found and not exists (
    select 1 from public.milestone_awards m
    where m.profile_id = p_profile_id and m.season_id = p_season_id and m.metric = 'monthly_goal' and m.period_key = 'season'
  ) then
    v_entry := private.insert_entry(p_profile_id, 'system', 'monthly_goal', v_rule.points, v_rule.coins, 'Meta mensal batida', v_ts, (select auth.uid()));
    insert into public.milestone_awards (profile_id, season_id, metric, period_key, entry_id)
    values (p_profile_id, p_season_id, 'monthly_goal', 'season', v_entry.id);
    v_entry_id := v_entry.id;
    perform private.notify(p_profile_id, 'achievement', 'Meta batida!', 'Você bateu sua meta da temporada.', jsonb_build_object('season_id', p_season_id, 'entry_id', v_entry.id));
  end if;

  for v_ach in select a.* from public.achievements a where a.is_active and a.deleted_at is null and a.criteria = 'monthly_goal' loop
    perform private.grant_achievement(p_profile_id, v_ach.id, p_season_id, v_entry_id, v_ts);
  end loop;
end $$;

-- =============================================================================
-- 6.7 after_point_entry — AFTER INSERT em point_entries
-- =============================================================================
create or replace function private.after_point_entry()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_is_reversal boolean := NEW.reverses_entry_id is not null;
  v_is_fact boolean := NEW.source in ('rule', 'manual', 'system');
  v_orig public.point_entries;
  v_season public.seasons;
  v_ss public.profile_season_stats;
  v_ls public.profile_lifetime_stats;
  v_counts boolean;
  v_sign int := 0;
  v_points_after int;
  v_day date;
  v_rule public.point_rules;
  v_blocks int;
  v_k int;
  v_entry public.point_entries;
  v_m public.missions;
  v_period record;
  v_delta numeric;
  v_mp public.mission_progress;
  v_queue_id uuid;
  v_wheel_id uuid;
  v_name text;
  v_ach public.achievements;
  v_c public.challenges;
  v_before int;
  v_after int;
  v_l int;
  v_lifetime_points int;
  v_orig_counts boolean := false;
begin
  if pg_catalog.pg_trigger_depth() > 4 then
    raise exception using message = 'TRIGGER_DEPTH', detail = 'Profundidade de triggers excedida.', errcode = 'P0001';
  end if;
  perform private.lock_profile(NEW.profile_id, 'progress');

  if v_is_reversal then
    select * into v_orig from public.point_entries e where e.id = NEW.reverses_entry_id;
    v_orig_counts := (v_orig.source = 'rule' or (v_orig.source = 'manual' and v_orig.points > 0));
  end if;
  select * into v_season from public.seasons s where s.id = NEW.season_id;
  v_counts := private.counts_for_streak(NEW);
  if v_is_fact then
    v_sign := case when NEW.points > 0 then 1 when NEW.points < 0 then -1 when v_is_reversal then -1 else 1 end;
  end if;

  -- ---------------------------------------------------------------- A. stats
  insert into public.profile_season_stats (profile_id, season_id) values (NEW.profile_id, NEW.season_id) on conflict do nothing;
  update public.profile_season_stats ss set
    points = ss.points + NEW.points,
    points_updated_at = case when NEW.points > 0 and not v_is_reversal then greatest(coalesce(ss.points_updated_at, NEW.occurred_at), NEW.occurred_at) else ss.points_updated_at end,
    points_earned = ss.points_earned + case when not v_is_reversal then greatest(NEW.points, 0) else -greatest(v_orig.points, 0) end,
    coins_earned = ss.coins_earned + case when not v_is_reversal then greatest(NEW.coins, 0) else -greatest(v_orig.coins, 0) end,
    coins_spent = ss.coins_spent + case when not v_is_reversal then greatest(-NEW.coins, 0) else -greatest(-v_orig.coins, 0) end,
    sales_amount = ss.sales_amount + case when v_is_fact and NEW.metric in ('sale', 'upsell') then coalesce(NEW.amount, 0) else 0 end,
    sales_count = ss.sales_count + case when v_is_fact and NEW.metric = 'sale' then NEW.quantity * v_sign else 0 end,
    meetings_scheduled = ss.meetings_scheduled + case when v_is_fact and NEW.metric = 'meeting_scheduled' then NEW.quantity * v_sign else 0 end,
    meetings_held = ss.meetings_held + case when v_is_fact and NEW.metric = 'meeting_held' then NEW.quantity * v_sign else 0 end,
    calls = ss.calls + case when v_is_fact and NEW.metric = 'call' then NEW.quantity * v_sign else 0 end,
    crm_updates = ss.crm_updates + case when v_is_fact and NEW.metric = 'crm_update' then NEW.quantity * v_sign else 0 end,
    lead_recoveries = ss.lead_recoveries + case when v_is_fact and NEW.metric = 'lead_recovery' then NEW.quantity * v_sign else 0 end,
    upsells = ss.upsells + case when v_is_fact and NEW.metric = 'upsell' then NEW.quantity * v_sign else 0 end,
    activities_count = ss.activities_count + case when NEW.source in ('rule', 'manual')
        and (NEW.metric is null or NEW.metric not in ('amount_step', 'weekly_goal', 'monthly_goal', 'custom'))
        then NEW.quantity * v_sign else 0 end,
    last_entry_at = case when v_counts then greatest(coalesce(ss.last_entry_at, NEW.occurred_at), NEW.occurred_at) else ss.last_entry_at end,
    updated_at = pg_catalog.now()
  where ss.profile_id = NEW.profile_id and ss.season_id = NEW.season_id
  returning ss.* into v_ss;
  v_points_after := v_ss.points;

  insert into public.profile_lifetime_stats (profile_id) values (NEW.profile_id) on conflict do nothing;
  update public.profile_lifetime_stats ls set
    coins_earned = ls.coins_earned + case when not v_is_reversal then greatest(NEW.coins, 0) else -greatest(v_orig.coins, 0) end,
    coins_spent = ls.coins_spent + case when not v_is_reversal then greatest(-NEW.coins, 0) else -greatest(-v_orig.coins, 0) end,
    sales_amount = ls.sales_amount + case when v_is_fact and NEW.metric in ('sale', 'upsell') then coalesce(NEW.amount, 0) else 0 end,
    sales_count = ls.sales_count + case when v_is_fact and NEW.metric = 'sale' then NEW.quantity * v_sign else 0 end,
    first_sale_at = case when not v_is_reversal and v_is_fact and NEW.metric = 'sale' and coalesce(NEW.amount, 0) > 0
                         then coalesce(ls.first_sale_at, NEW.occurred_at) else ls.first_sale_at end,
    updated_at = pg_catalog.now()
  where ls.profile_id = NEW.profile_id
  returning ls.* into v_ls;

  -- streak (§4.9)
  if v_counts then
    v_day := public.local_day(NEW.occurred_at);
    if v_ls.streak_last_day is null or v_day > v_ls.streak_last_day + 1 then
      update public.profile_lifetime_stats set streak_days = 1, streak_last_day = v_day, best_streak_days = greatest(best_streak_days, 1), updated_at = pg_catalog.now()
      where profile_id = NEW.profile_id;
    elsif v_day = v_ls.streak_last_day + 1 then
      update public.profile_lifetime_stats set streak_days = streak_days + 1, streak_last_day = v_day, best_streak_days = greatest(best_streak_days, streak_days + 1), updated_at = pg_catalog.now()
      where profile_id = NEW.profile_id;
    elsif v_day < v_ls.streak_last_day then
      perform private.recompute_streak(NEW.profile_id);
    end if;
  elsif v_is_reversal and v_orig_counts then
    perform private.recompute_streak(NEW.profile_id);
  end if;
  select * into v_ls from public.profile_lifetime_stats ls where ls.profile_id = NEW.profile_id;

  -- ---------------------------------------------------------------- B. fatos
  if v_is_fact then
    -- B1. marcos automáticos
    if not v_is_reversal and NEW.source = 'rule' and NEW.metric in ('sale', 'upsell') and coalesce(NEW.amount, 0) > 0 then
      select * into v_rule from public.point_rules r where r.trigger_kind = 'auto_amount_step' and r.is_active and r.deleted_at is null limit 1;
      if found and v_rule.amount_step is not null and v_rule.amount_step > 0 then
        v_blocks := floor(v_ss.sales_amount / v_rule.amount_step)::int;
        for v_k in 1 .. v_blocks loop
          if not exists (select 1 from public.milestone_awards m where m.profile_id = NEW.profile_id and m.season_id = NEW.season_id and m.metric = 'amount_step' and m.period_key = 'block:' || v_k) then
            v_entry := private.insert_entry(NEW.profile_id, 'system', 'amount_step', v_rule.points, v_rule.coins,
              'Bônus: R$ ' || pg_catalog.to_char(v_rule.amount_step, 'FM999999999990') || ' vendidos (bloco ' || v_k || ')', NEW.occurred_at, NEW.created_by);
            insert into public.milestone_awards (profile_id, season_id, metric, period_key, entry_id)
            values (NEW.profile_id, NEW.season_id, 'amount_step', 'block:' || v_k, v_entry.id);
          end if;
        end loop;
      end if;
      perform private.evaluate_goal_milestone(NEW.profile_id, NEW.season_id, NEW.occurred_at);
    end if;

    -- B2. missões
    for v_m in
      select m.* from public.missions m
      where m.is_active and m.deleted_at is null and m.metric = NEW.metric and m.season_id = NEW.season_id
        and NEW.occurred_at >= m.starts_at and NEW.occurred_at < m.ends_at
        and (m.audience = 'all' or exists (select 1 from public.mission_participants mp where mp.mission_id = m.id and mp.profile_id = NEW.profile_id))
    loop
      select * into v_period from public.mission_period(v_m.kind, NEW.occurred_at, v_m.starts_at, v_m.ends_at);
      if not found then continue; end if;
      v_delta := case when v_m.target_kind = 'count' then NEW.quantity * v_sign else coalesce(NEW.amount, 0) end;
      insert into public.mission_progress (mission_id, profile_id, period_key, period_start, period_end, value)
      values (v_m.id, NEW.profile_id, v_period.period_key, v_period.period_start, v_period.period_end, v_delta)
      on conflict (mission_id, profile_id, period_key) do update
        set value = public.mission_progress.value + excluded.value, updated_at = pg_catalog.now();
      if not v_is_reversal then
        update public.mission_progress mp set completed_at = pg_catalog.now(), updated_at = pg_catalog.now()
        where mp.mission_id = v_m.id and mp.profile_id = NEW.profile_id and mp.period_key = v_period.period_key
          and mp.completed_at is null and mp.value >= v_m.target_value
        returning mp.* into v_mp;
        if found then
          if v_m.reward_points > 0 or v_m.reward_coins > 0 then
            v_entry := private.insert_entry(NEW.profile_id, 'mission', null, v_m.reward_points, v_m.reward_coins, v_m.title, NEW.occurred_at, NEW.created_by);
            update public.mission_progress set entry_id = v_entry.id
            where mission_id = v_m.id and profile_id = NEW.profile_id and period_key = v_period.period_key;
          end if;
          if v_m.reward_spin is not null then
            select w.id into v_wheel_id from public.wheels w where w.kind = v_m.reward_spin;
            select p.full_name into v_name from public.profiles p where p.id = NEW.profile_id;
            v_queue_id := null;
            insert into public.wheel_queue (profile_id, person_name, wheel_id, source, reference_kind, reference_id, created_by)
            values (NEW.profile_id, v_name, v_wheel_id, 'earned', 'mission_progress', v_m.id::text || ':' || NEW.profile_id::text || ':' || v_period.period_key, null)
            on conflict (reference_kind, reference_id) where reference_id is not null do nothing
            returning id into v_queue_id;
            if v_queue_id is not null then
              update public.mission_progress set queue_id = v_queue_id
              where mission_id = v_m.id and profile_id = NEW.profile_id and period_key = v_period.period_key;
            end if;
          end if;
          update public.profile_season_stats set missions_completed = missions_completed + 1, updated_at = pg_catalog.now()
          where profile_id = NEW.profile_id and season_id = NEW.season_id;
          update public.profile_lifetime_stats set missions_completed = missions_completed + 1, updated_at = pg_catalog.now()
          where profile_id = NEW.profile_id;
          perform private.push_feed('mission_completed', NEW.profile_id, NEW.season_id,
            jsonb_build_object('title', v_m.title, 'reward_points', v_m.reward_points, 'reward_coins', v_m.reward_coins),
            'mission:' || v_m.id::text || ':' || NEW.profile_id::text || ':' || v_period.period_key, NEW.occurred_at);
          perform private.notify(NEW.profile_id, 'mission', 'Missão concluída', v_m.title, jsonb_build_object('mission_id', v_m.id));
        end if;
      end if;
    end loop;

    -- B3. conquistas de atividade
    if not v_is_reversal then
      for v_ach in
        select a.* from public.achievements a
        where a.is_active and a.deleted_at is null and a.criteria in ('first_sale', 'streak_days', 'sales_total')
      loop
        if (v_ach.criteria = 'first_sale' and v_ls.first_sale_at is not null)
           or (v_ach.criteria = 'streak_days' and v_ls.streak_days >= v_ach.criteria_value)
           or (v_ach.criteria = 'sales_total' and (case when v_ach.scope = 'lifetime' then v_ls.sales_amount else v_ss.sales_amount end) >= v_ach.criteria_value)
        then
          perform private.grant_achievement(NEW.profile_id, v_ach.id, NEW.season_id, NEW.id, NEW.occurred_at);
        end if;
      end loop;
    end if;

    -- B4. feed de venda
    if not v_is_reversal and NEW.source = 'rule' and NEW.metric = 'sale' and coalesce(NEW.amount, 0) > 0 then
      perform private.push_feed('sale', NEW.profile_id, NEW.season_id, jsonb_build_object('amount', NEW.amount), 'sale:' || NEW.id::text, NEW.occurred_at);
    end if;
  end if;

  -- ---------------------------------------------------------------- B3'. conquistas de acúmulo (toda source exceto reward)
  if NEW.source <> 'reward' and NEW.points > 0 and not v_is_reversal then
    select * into v_ss from public.profile_season_stats ss where ss.profile_id = NEW.profile_id and ss.season_id = NEW.season_id;
    select * into v_ls from public.profile_lifetime_stats ls where ls.profile_id = NEW.profile_id;
    select coalesce(sum(ss.points), 0)::int into v_lifetime_points from public.profile_season_stats ss where ss.profile_id = NEW.profile_id;
    for v_ach in
      select a.* from public.achievements a
      where a.is_active and a.deleted_at is null and a.criteria in ('points_total', 'missions_completed')
    loop
      if (v_ach.criteria = 'points_total' and (case when v_ach.scope = 'season' then v_ss.points else v_lifetime_points end) >= v_ach.criteria_value)
         or (v_ach.criteria = 'missions_completed' and (case when v_ach.scope = 'season' then v_ss.missions_completed else v_ls.missions_completed end) >= v_ach.criteria_value)
      then
        perform private.grant_achievement(NEW.profile_id, v_ach.id, NEW.season_id, NEW.id, NEW.occurred_at);
      end if;
    end loop;
  end if;

  -- ---------------------------------------------------------------- C. desafios ativos
  if NEW.source <> 'reward' then
    for v_c in
      select c.* from public.challenges c
      join public.challenge_participants cp on cp.challenge_id = c.id and cp.profile_id = NEW.profile_id
      where c.status = 'active' and c.season_id = NEW.season_id and NEW.occurred_at >= c.starts_at and NEW.occurred_at < c.ends_at
    loop
      update public.challenge_participants cp
         set current_value = cp.current_value + private.challenge_value(v_c.metric, NEW), updated_at = pg_catalog.now()
       where cp.challenge_id = v_c.id and cp.profile_id = NEW.profile_id;
    end loop;
  end if;

  -- ---------------------------------------------------------------- D. level-up
  if NEW.points > 0 and v_season.xp_per_level > 0 then
    v_before := greatest(v_points_after - NEW.points, 0) / v_season.xp_per_level;
    v_after := greatest(v_points_after, 0) / v_season.xp_per_level;
    if v_after > v_before then
      for v_l in v_before + 1 .. v_after loop
        perform private.push_feed('level_up', NEW.profile_id, NEW.season_id,
          jsonb_build_object('from_level', v_l - 1, 'to_level', v_l),
          'level_up:' || NEW.profile_id::text || ':' || NEW.season_id::text || ':' || v_l, NEW.occurred_at);
      end loop;
      perform private.notify(NEW.profile_id, 'level', 'Você subiu de nível!', 'Nível ' || v_after, jsonb_build_object('level', v_after, 'season_id', NEW.season_id));
    end if;
  end if;

  -- ---------------------------------------------------------------- E. notificações de estorno / ajuste
  if v_is_reversal then
    perform private.notify(NEW.profile_id, 'system', 'Lançamento estornado', coalesce(NEW.reason, ''), jsonb_build_object('entry_id', NEW.id));
  elsif NEW.source = 'manual' and NEW.points < 0 then
    perform private.notify(NEW.profile_id, 'system', 'Ajuste de pontos', coalesce(NEW.reason, ''), jsonb_build_object('entry_id', NEW.id));
  end if;

  return NEW;
end $$;

-- =============================================================================
-- 6.8 outras funções de trigger
-- =============================================================================
create or replace function private.validate_mission_window()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_season public.seasons;
begin
  NEW.season_id := private.season_for(NEW.starts_at);
  if NEW.season_id is null then
    raise exception using message = 'NO_SEASON_FOR_DATE', detail = 'Não existe temporada cobrindo esta data.', errcode = 'P0001';
  end if;
  select * into v_season from public.seasons s where s.id = NEW.season_id;
  if NEW.ends_at > v_season.ends_at then
    raise exception using message = 'MISSION_WINDOW_INVALID', detail = 'A janela da missão precisa estar dentro da temporada.', errcode = 'P0001';
  end if;
  if NEW.kind = 'lightning' and NEW.ends_at - NEW.starts_at > interval '24 hours' then
    raise exception using message = 'LIGHTNING_TOO_LONG', detail = 'Missão relâmpago dura no máximo 24 horas.', errcode = 'P0001';
  end if;
  return NEW;
end $$;

create or replace function private.validate_challenge_window()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_season public.seasons;
begin
  NEW.season_id := private.season_for(NEW.starts_at);
  if NEW.season_id is null then
    raise exception using message = 'NO_SEASON_FOR_DATE', detail = 'Não existe temporada cobrindo esta data.', errcode = 'P0001';
  end if;
  select * into v_season from public.seasons s where s.id = NEW.season_id;
  if NEW.ends_at > v_season.ends_at then
    raise exception using message = 'CHALLENGE_WINDOW_INVALID', detail = 'O período do desafio precisa estar dentro da temporada e no futuro.', errcode = 'P0001';
  end if;
  return NEW;
end $$;

create or replace function private.protect_challenge_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if NEW.status <> OLD.status then
    if OLD.status in ('finished', 'cancelled') then
      raise exception using message = 'CHALLENGE_FINAL', detail = 'Desafio finalizado/cancelado não pode mudar.', errcode = 'P0001';
    end if;
    if pg_catalog.current_setting('app.rpc', true) is distinct from 'on' then
      raise exception using message = 'STATUS_VIA_RPC_ONLY', detail = 'Use as ações de ativar/finalizar/cancelar.', errcode = 'P0001';
    end if;
  end if;
  return NEW;
end $$;

create or replace function private.protect_challenge_participants()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_challenge public.challenges;
  v_count int;
begin
  select * into v_challenge from public.challenges c where c.id = coalesce(NEW.challenge_id, OLD.challenge_id);
  if v_challenge.status <> 'draft' then
    raise exception using message = 'CHALLENGE_NOT_DRAFT', detail = 'O desafio já foi ativado.', errcode = 'P0001';
  end if;
  if TG_OP = 'INSERT' and v_challenge.kind = 'duel' then
    select count(*) into v_count from public.challenge_participants cp where cp.challenge_id = NEW.challenge_id;
    if v_count >= 2 then
      raise exception using message = 'DUEL_NEEDS_TWO', detail = 'Um duelo precisa de exatamente 2 participantes.', errcode = 'P0001';
    end if;
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

create or replace function private.check_challenge_cardinality()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_cid uuid;
  v_challenge public.challenges;
  v_total int;
  v_active int;
begin
  if TG_TABLE_NAME = 'challenges' then
    v_cid := NEW.id;
  else
    v_cid := coalesce(NEW.challenge_id, OLD.challenge_id);
  end if;
  select * into v_challenge from public.challenges c where c.id = v_cid;
  if not found or v_challenge.status <> 'active' then return null; end if;
  select count(*), count(*) filter (where p.status = 'active')
    into v_total, v_active
  from public.challenge_participants cp join public.profiles p on p.id = cp.profile_id
  where cp.challenge_id = v_cid;
  if v_challenge.kind = 'duel' and (v_total <> 2 or v_active <> 2) then
    raise exception using message = 'DUEL_NEEDS_TWO', detail = 'Um duelo precisa de exatamente 2 participantes.', errcode = 'P0001';
  end if;
  if v_challenge.kind = 'team' and v_total < 2 then
    raise exception using message = 'TEAM_NEEDS_TWO', detail = 'Um desafio coletivo precisa de ao menos 2 participantes.', errcode = 'P0001';
  end if;
  return null;
end $$;

create or replace function private.check_wheel_min_prizes()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_wheel_prizes(coalesce(NEW.wheel_id, OLD.wheel_id));
  return null;
end $$;

create or replace function private.check_wheel_prizes_on_wheel()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_wheel_prizes(NEW.id);
  return null;
end $$;

create or replace function private.protect_wheel_deactivation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if OLD.is_active and not NEW.is_active then
    if exists (select 1 from public.wheel_queue q where q.wheel_id = NEW.id and q.status in ('waiting', 'active'))
       or exists (select 1 from public.missions m where m.reward_spin = NEW.kind and m.is_active and m.deleted_at is null and m.ends_at > pg_catalog.now())
       or exists (select 1 from public.challenges c where c.reward_spin = NEW.kind and c.status in ('draft', 'active'))
    then
      raise exception using message = 'WHEEL_IN_USE', detail = 'A roleta tem fila, missão ou desafio pendente; não pode ser desativada.', errcode = 'P0001';
    end if;
  end if;
  return NEW;
end $$;

create or replace function private.on_goal_amount_changed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.evaluate_goal_milestone(NEW.profile_id, NEW.season_id, pg_catalog.now());
  return null;
end $$;

create or replace function private.block_prize_change_with_pending_spin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.wheel_spins s where s.wheel_id = coalesce(NEW.wheel_id, OLD.wheel_id) and s.status = 'pending') then
    raise exception using message = 'SPIN_PENDING', detail = 'Há um prêmio aguardando aprovação.', errcode = 'P0001';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

create or replace function private.notify_special_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text := public.app_timezone();
begin
  if NEW.is_active and NEW.deleted_at is null and NEW.ends_at > pg_catalog.now()
     and (TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and not OLD.is_active)) then
    perform private.notify_all('event', left(NEW.name, 80),
      'Multiplicador x' || pg_catalog.rtrim(pg_catalog.rtrim(NEW.multiplier::text, '0'), '.') ||
      ' de ' || pg_catalog.to_char(NEW.starts_at at time zone v_tz, 'DD/MM HH24:MI') ||
      ' a ' || pg_catalog.to_char(NEW.ends_at at time zone v_tz, 'DD/MM HH24:MI'),
      jsonb_build_object('special_event_id', NEW.id));
  end if;
  return null;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema private to supabase_auth_admin;
    grant execute on function private.handle_new_user() to supabase_auth_admin;
  end if;
end $$;
