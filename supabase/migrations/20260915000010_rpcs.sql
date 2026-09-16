-- 0010 — RPCs expostas em public (DATA-MODEL §7). security definer set search_path = '' (invoker: get_bootstrap, get_dashboard).
-- Padrão: checagem de papel na 1ª linha (ou logo após carregar a linha-alvo com *_NOT_FOUND); is distinct from;
-- set_config('app.rpc','on',true) para passar pelos triggers de proteção; private.audit('rpc', ...) nas escritas relevantes.

-- helper curto para levantar erro do catálogo (§9)
create or replace function private.fail(p_code text, p_detail text, p_errcode text default 'P0001')
returns void language plpgsql security definer set search_path = ''
as $$
begin
  raise exception using message = p_code, detail = p_detail, errcode = p_errcode;
end $$;

-- DECISIONS.md: lê um valor monetário de um patch jsonb e valida a faixa de numeric(14,2) (0 .. 999.999.999.999)
-- sem deixar vazar 22P02/22003/23514 cru. Devolve null quando a chave está ausente ou é null.
create or replace function private.patch_goal(p_patch jsonb, p_key text)
returns numeric language plpgsql immutable security definer set search_path = ''
as $$
declare
  v_goal numeric;
begin
  if p_patch is null or not (p_patch ? p_key) or (p_patch ->> p_key) is null then return null; end if;
  begin
    v_goal := (p_patch ->> p_key)::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    v_goal := -1;
  end;
  if v_goal is null or v_goal < 0 or v_goal > 999999999999 then
    raise exception using message = 'GOAL_INVALID', detail = 'A meta deve ser um valor entre 0 e 999.999.999.999.', errcode = 'P0001';
  end if;
  return v_goal;
end $$;

-- DECISIONS.md (SQL fixer r2): SQLSTATE cru de dado (classe 22: 22P02/22007/22003/22001) ou de integridade
-- (classe 23: 23514/23502/23503/23505) que escape da validação explícita de uma RPC de escrita vira
-- INVALID_ARGUMENT (P0001, detail pt-BR com o campo/constraint) — §9: "toda escrita do fluxo normal
-- passa por RPC e devolve código do catálogo". FK de perfil inexistente → PROFILE_NOT_FOUND.
-- Chamado só de dentro de um handler `exception when data_exception or integrity_constraint_violation`.
create or replace function private.fail_invalid(p_sqlstate text, p_column text, p_constraint text, p_message text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_where text;
begin
  if p_sqlstate = '23503' and coalesce(p_constraint, '') ~ 'profile' then
    raise exception using message = 'PROFILE_NOT_FOUND', detail = 'Perfil não encontrado.', errcode = 'P0001';
  end if;
  v_where := coalesce(nullif(p_column, ''), nullif(p_constraint, ''));
  raise exception using
    message = 'INVALID_ARGUMENT',
    detail = case
      when p_sqlstate = '23505' then 'Registro duplicado' || coalesce(' (' || v_where || ')', '') || '.'
      when p_sqlstate = '23502' then 'Campo obrigatório' || coalesce(' (' || v_where || ')', '') || '.'
      when p_sqlstate = '23503' then 'Referência inexistente' || coalesce(' (' || v_where || ')', '') || '.'
      when p_sqlstate = '22003' then 'Valor fora da faixa permitida' || coalesce(' (' || v_where || ')', '') || '.'
      when p_sqlstate = '22007' or p_sqlstate = '22008' then 'Data ou hora inválida.'
      else 'Valor inválido' || coalesce(' (' || v_where || ')', '') || '.'
    end,
    errcode = 'P0001';
end $$;

create or replace function private.assert_admin()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'NOT_ADMIN', detail = 'Apenas gestores podem executar esta ação.', errcode = '42501';
  end if;
end $$;

-- =============================================================================
-- 7.1 Cadastro e sessão
-- =============================================================================
create or replace function public.signup_mode()
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when not exists (select 1 from public.profiles p where p.role = 'admin')
     and coalesce((select not s.bootstrap_done from public.app_secrets s where s.id = 1), false)
    then 'first_admin' else 'team_code' end;
$$;

create or replace function public.validate_team_code(p_code text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select upper(trim(p_code)) = s.team_code from public.app_secrets s where s.id = 1), false);
$$;

create or replace function public.get_bootstrap()
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_me record;
  v_is_admin boolean;
  v_season_id uuid;
  v_me_json jsonb;
  v_season jsonb;
  v_settings jsonb;
  v_wheel jsonb;
  v_event jsonb;
  v_unread int;
  v_pending int;
begin
  if v_uid is null then
    raise exception using message = 'NOT_AUTHENTICATED', detail = 'Faça login para continuar.', errcode = '42501';
  end if;
  select p.id, p.status, p.full_name into v_me from public.profiles p where p.id = v_uid;
  if not found then
    raise exception using message = 'PROFILE_NOT_FOUND', detail = 'Perfil não encontrado.', errcode = 'P0001';
  end if;
  if v_me.status <> 'active' then
    return jsonb_build_object('me', jsonb_build_object('id', v_me.id, 'status', v_me.status, 'full_name', v_me.full_name));
  end if;

  v_is_admin := public.is_admin();
  v_season_id := public.active_season_id();

  if v_season_id is not null then
    select jsonb_build_object(
      'id', ps.profile_id, 'full_name', ps.full_name, 'avatar_path', ps.avatar_path, 'color', ps.color, 'job_title', ps.job_title,
      'team', ps.team, 'role', ps.role, 'status', ps.status, 'preferences', p.preferences,
      'email', ps.email, 'phone', ps.phone, 'goal_amount', ps.goal_amount, 'points', ps.points, 'points_earned', ps.points_earned,
      'level', ps.level, 'xp_in_level', ps.xp_in_level, 'xp_to_next', ps.xp_to_next, 'xp_per_level', ps.xp_per_level,
      'rank', ps.rank, 'gap_to_above', ps.gap_to_above, 'streak_days', ps.streak_days, 'coins_balance', ps.coins_balance,
      'sales_amount', ps.sales_amount, 'sales_count', ps.sales_count, 'meetings_held', ps.meetings_held,
      'conversion_pct', ps.conversion_pct, 'missions_completed', ps.missions_completed,
      'achievements_unlocked', ps.achievements_unlocked, 'pending_earned_spins', ps.pending_earned_spins)
    into v_me_json
    from public.v_profile_stats ps join public.profiles p on p.id = ps.profile_id
    where ps.profile_id = v_uid and ps.season_id = v_season_id;
    select jsonb_build_object('id', s.id, 'name', s.name, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'team_goal_amount', s.team_goal_amount,
                              'xp_per_level', s.xp_per_level, 'is_active', s.is_active, 'days_left', s.days_left)
    into v_season from public.v_seasons s where s.id = v_season_id;
  end if;
  if v_me_json is null then
    select jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'avatar_path', p.avatar_path, 'color', p.color, 'job_title', p.job_title,
      'team', p.team, 'role', p.role, 'status', p.status, 'preferences', p.preferences,
      'email', pp.email, 'phone', pp.phone, 'goal_amount', 0, 'points', 0, 'points_earned', 0,
      'level', 0, 'xp_in_level', 0, 'xp_to_next', st.xp_per_level, 'xp_per_level', st.xp_per_level,
      'rank', null, 'gap_to_above', null,
      'streak_days', coalesce(case when ls.streak_last_day >= public.local_today() - 1 then ls.streak_days else 0 end, 0),
      'coins_balance', coalesce(ls.coins_balance, 0),
      'sales_amount', 0, 'sales_count', 0, 'meetings_held', 0, 'conversion_pct', null, 'missions_completed', 0,
      'achievements_unlocked', (select count(distinct pa.achievement_id) from public.profile_achievements pa
                                 join public.achievements a on a.id = pa.achievement_id and a.is_active and a.deleted_at is null
                                 where pa.profile_id = p.id),
      'pending_earned_spins', (select count(*) from public.wheel_queue q where q.profile_id = p.id and q.status = 'waiting' and q.source = 'earned'))
    into v_me_json
    from public.profiles p
    left join public.profile_private pp on pp.profile_id = p.id
    left join public.profile_lifetime_stats ls on ls.profile_id = p.id
    cross join (select a.xp_per_level from public.app_settings a where a.id = 1) st
    where p.id = v_uid;
  end if;

  select jsonb_build_object('company_name', a.company_name, 'xp_per_level', a.xp_per_level, 'currency', a.currency, 'timezone', a.timezone,
                            'target_conversion_pct', a.target_conversion_pct, 'target_attendance_pct', a.target_attendance_pct,
                            'target_crm_pct', a.target_crm_pct, 'target_activities_count', a.target_activities_count, 'rank_admins', a.rank_admins)
  into v_settings from public.app_settings a where a.id = 1;

  select count(*)::int into v_unread from public.notifications n where n.profile_id = v_uid and not n.is_read;
  if v_is_admin then
    select count(*)::int into v_pending from public.profiles p where p.status = 'pending';
  else
    v_pending := 0;
  end if;

  select jsonb_build_object('active_queue_id', q.id, 'active_person_name', q.person_name, 'pending_spin_id', sp.id,
                            'my_turn', q.profile_id is not distinct from v_uid)
  into v_wheel
  from public.wheel_queue q left join public.wheel_spins sp on sp.queue_id = q.id and sp.status = 'pending'
  where q.status = 'active' limit 1;
  if v_wheel is null then
    v_wheel := jsonb_build_object('active_queue_id', null, 'active_person_name', null, 'pending_spin_id', null, 'my_turn', false);
  end if;

  select jsonb_build_object('id', e.id, 'name', e.name, 'multiplier', e.multiplier, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'state', e.state)
  into v_event from public.v_special_events e where e.state in ('upcoming', 'live') order by e.starts_at limit 1;

  return jsonb_build_object(
    'me', v_me_json,
    'season', v_season,
    'settings', v_settings,
    'unread_notifications', coalesce(v_unread, 0),
    'pending_members', coalesce(v_pending, 0),
    'wheel', v_wheel,
    'active_event', v_event);
end $$;

create or replace function public.get_dashboard(p_profile_id uuid default null, p_season_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status public.profile_status;
  v_profile uuid;
  v_season_id uuid;
  v_season jsonb;
  v_stats jsonb;
  v_ranking jsonb;
  v_missions jsonb;
  v_next jsonb;
  v_event jsonb;
  v_feed jsonb;
  v_balance int;
  v_pending_spins int;
begin
  if v_uid is null then
    raise exception using message = 'NOT_AUTHENTICATED', detail = 'Faça login para continuar.', errcode = '42501';
  end if;
  -- invoker não pode chamar private.assert_active_member(): replica a checagem lendo a própria linha (policy member or id = me)
  if not public.is_active_member() then
    select p.status into v_status from public.profiles p where p.id = v_uid;
    if not found then
      raise exception using message = 'PROFILE_NOT_FOUND', detail = 'Perfil não encontrado.', errcode = '42501';
    elsif v_status = 'pending' then
      raise exception using message = 'PROFILE_PENDING', detail = 'Seu cadastro está aguardando aprovação do gestor.', errcode = '42501';
    else
      raise exception using message = 'PROFILE_INACTIVE', detail = 'Este perfil está inativo.', errcode = '42501';
    end if;
  end if;
  v_profile := coalesce(p_profile_id, v_uid);
  if v_profile is distinct from v_uid and not public.is_admin() then
    raise exception using message = 'NOT_ADMIN', detail = 'Apenas gestores podem executar esta ação.', errcode = '42501';
  end if;
  v_season_id := coalesce(p_season_id, public.active_season_id());
  if v_season_id is null then
    return jsonb_build_object('season', null);
  end if;

  select jsonb_build_object('id', s.id, 'name', s.name, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'team_goal_amount', s.team_goal_amount,
                            'xp_per_level', s.xp_per_level, 'is_active', s.is_active, 'days_left', s.days_left)
  into v_season from public.v_seasons s where s.id = v_season_id;

  select to_jsonb(ps) into v_stats from public.v_profile_stats ps where ps.profile_id = v_profile and ps.season_id = v_season_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.rank), '[]'::jsonb) into v_ranking
  from (
    select * from public.v_ranking r where r.season_id = v_season_id and (r.rank <= 5 or r.profile_id = v_profile)
  ) r;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.is_completed, b.ends_at), '[]'::jsonb) into v_missions
  from (
    select * from public.v_mission_board mb
    where mb.profile_id = v_profile and mb.season_id = v_season_id and mb.kind in ('daily', 'lightning') and mb.is_current
    order by mb.is_completed, mb.ends_at limit 3
  ) b;

  v_balance := coalesce((v_stats ->> 'coins_balance')::int, 0);
  select jsonb_build_object('id', rw.id, 'name', rw.name, 'icon', rw.icon, 'cost_coins', rw.cost_coins, 'missing_coins', rw.cost_coins - v_balance)
  into v_next
  from public.rewards rw
  where rw.is_active and rw.deleted_at is null and rw.cost_coins > v_balance
  order by rw.cost_coins, rw.sort_order limit 1;

  select count(*)::int into v_pending_spins from public.wheel_queue q where q.profile_id = v_profile and q.status = 'waiting' and q.source = 'earned';

  select jsonb_build_object('id', e.id, 'name', e.name, 'multiplier', e.multiplier, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'state', e.state)
  into v_event from public.v_special_events e where e.state in ('upcoming', 'live') order by e.starts_at limit 1;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.occurred_at desc, f.id desc), '[]'::jsonb) into v_feed
  from (select * from public.v_activity_feed af order by af.occurred_at desc, af.id desc limit 20) f;

  return jsonb_build_object(
    'season', v_season,
    'stats', v_stats,
    'ranking_top', v_ranking,
    'missions_today', v_missions,
    'next_reward', v_next,
    'pending_earned_spins', coalesce(v_pending_spins, 0),
    'active_event', v_event,
    'feed', v_feed);
end $$;

-- =============================================================================
-- 7.2 Perfil e configuração (admin)
-- =============================================================================
create or replace function public.admin_update_profile(p_profile_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_key text;
  v_profile public.profiles;
  v_old_status public.profile_status;
  v_new_status public.profile_status;
  v_status_text text;
  v_season uuid;
  v_warnings text[] := '{}';
  v_old_goal numeric;
  v_new_goal numeric;
  v_default_goal numeric;
  v_company text;
  v_c public.challenges;
  v_result jsonb;
begin
  perform private.assert_admin();
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    perform private.fail('INVALID_PATCH_KEY', 'Campo não permitido: (patch inválido).');
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('full_name', 'avatar_path', 'color', 'job_title', 'team', 'role', 'status', 'email', 'phone', 'default_goal_amount', 'notes', 'goal_amount') then
      perform private.fail('INVALID_PATCH_KEY', 'Campo não permitido: ' || v_key || '.');
    end if;
  end loop;

  select * into v_profile from public.profiles p where p.id = p_profile_id for update;
  if not found then perform private.fail('PROFILE_NOT_FOUND', 'Perfil não encontrado.'); end if;
  v_old_status := v_profile.status;
  -- DECISIONS.md: metas validadas antes de qualquer escrita (GOAL_INVALID em vez de 23514 cru)
  v_new_goal := private.patch_goal(p_patch, 'goal_amount');
  if p_patch ? 'goal_amount' and v_new_goal is null then
    perform private.fail('GOAL_INVALID', 'A meta deve ser um valor entre 0 e 999.999.999.999.');
  end if;
  v_default_goal := private.patch_goal(p_patch, 'default_goal_amount');

  if p_patch ? 'status' then
    v_status_text := p_patch ->> 'status';
    if v_status_text not in ('active', 'inactive') then
      perform private.fail('PROFILE_STATUS_INVALID', 'Transição de status não permitida (um perfil só pode ser aprovado, recusado, inativado ou reativado).');
    end if;
    v_new_status := v_status_text::public.profile_status;
    if v_new_status = v_old_status then
      v_new_status := null; -- no-op
    elsif not ((v_old_status = 'pending' and v_new_status in ('active', 'inactive'))
               or (v_old_status = 'active' and v_new_status = 'inactive')
               or (v_old_status = 'inactive' and v_new_status = 'active')) then
      perform private.fail('PROFILE_STATUS_INVALID', 'Transição de status não permitida (um perfil só pode ser aprovado, recusado, inativado ou reativado).');
    end if;
  end if;

  update public.profiles p set
    full_name = coalesce(nullif(trim(p_patch ->> 'full_name'), ''), p.full_name),
    avatar_path = case when p_patch ? 'avatar_path' then p_patch ->> 'avatar_path' else p.avatar_path end,
    color = coalesce(p_patch ->> 'color', p.color),
    job_title = coalesce((p_patch ->> 'job_title')::public.job_title, p.job_title),
    team = case when p_patch ? 'team' then nullif(trim(p_patch ->> 'team'), '') else p.team end,
    role = coalesce((p_patch ->> 'role')::public.user_role, p.role),
    status = coalesce(v_new_status, p.status)
  where p.id = p_profile_id;

  if p_patch ?| array['email', 'phone', 'default_goal_amount', 'notes'] then
    -- SQL fixer r2: comparar exatamente o que o UPDATE grava (lower(trim())) — e-mail com espaços não pode
    -- passar pela checagem e estourar profile_private_email_uq (23505 cru)
    if p_patch ? 'email' and exists (
      select 1 from public.profile_private pp where lower(pp.email) = lower(trim(p_patch ->> 'email')) and pp.profile_id <> p_profile_id
    ) then
      perform private.fail('EMAIL_TAKEN', 'Este e-mail já está em uso.');
    end if;
    update public.profile_private pp set
      email = coalesce(lower(nullif(trim(p_patch ->> 'email'), '')), pp.email),
      phone = case when p_patch ? 'phone' then nullif(trim(p_patch ->> 'phone'), '') else pp.phone end,
      default_goal_amount = coalesce(v_default_goal, pp.default_goal_amount),
      notes = case when p_patch ? 'notes' then p_patch ->> 'notes' else pp.notes end,
      updated_by = (select auth.uid())
    where pp.profile_id = p_profile_id;
  end if;

  v_season := public.active_season_id();

  if p_patch ? 'goal_amount' then
    if v_season is null then
      v_warnings := array_append(v_warnings, 'no_active_season_for_goal');
    else
      select g.goal_amount into v_old_goal from public.season_goals g where g.season_id = v_season and g.profile_id = p_profile_id;
      insert into public.season_goals (season_id, profile_id, goal_amount, updated_by)
      values (v_season, p_profile_id, v_new_goal, (select auth.uid()))
      on conflict (season_id, profile_id) do update set goal_amount = excluded.goal_amount, updated_by = excluded.updated_by, updated_at = pg_catalog.now();
      if v_old_goal is distinct from v_new_goal then
        perform private.evaluate_goal_milestone(p_profile_id, v_season, pg_catalog.now());
      end if;
    end if;
  end if;

  if v_new_status is not null then
    if v_new_status = 'active' then
      if v_season is not null then
        insert into public.season_goals (season_id, profile_id, goal_amount)
        select v_season, p_profile_id, coalesce(pp.default_goal_amount, 0) from public.profile_private pp where pp.profile_id = p_profile_id
        on conflict do nothing;
      end if;
      if v_old_status = 'pending' then
        select a.company_name into v_company from public.app_settings a where a.id = 1;
        perform private.notify(p_profile_id, 'system', 'Cadastro aprovado',
          'Seu acesso ao ' || coalesce(v_company, 'Orbion') || ' foi liberado. Bem-vindo à equipe!', jsonb_build_object('profile_id', p_profile_id));
        perform private.notify_all('system', 'Novo membro', v_profile.full_name || ' entrou na equipe.', jsonb_build_object('profile_id', p_profile_id), p_profile_id);
      end if;
    elsif v_new_status = 'inactive' then
      if exists (
        select 1 from public.wheel_queue q join public.wheel_spins s on s.queue_id = q.id and s.status = 'pending'
        where q.profile_id = p_profile_id and q.status = 'active'
      ) then
        perform private.fail('SPIN_PENDING', 'Há um prêmio aguardando aprovação.');
      end if;
      update public.wheel_queue q set status = 'removed', finished_at = pg_catalog.now(), removed_by = (select auth.uid())
      where q.profile_id = p_profile_id and q.status in ('waiting', 'active');
      for v_c in
        select c.* from public.challenges c join public.challenge_participants cp on cp.challenge_id = c.id and cp.profile_id = p_profile_id
        where c.kind = 'duel' and c.status = 'active'
      loop
        perform public.cancel_challenge(v_c.id, 'Duelo cancelado: participante inativado');
      end loop;
      delete from public.challenge_participants cp using public.challenges c
      where c.id = cp.challenge_id and cp.profile_id = p_profile_id and c.kind = 'team' and c.status = 'draft';
    end if;
  end if;

  perform private.audit('rpc', 'admin_update_profile', p_profile_id::text,
    jsonb_build_object('old_status', v_old_status),
    p_patch || jsonb_build_object('new_status', coalesce(v_new_status, v_old_status)));

  if v_season is not null then
    select to_jsonb(ps) into v_result from public.v_profile_stats ps where ps.profile_id = p_profile_id and ps.season_id = v_season;
  end if;
  return jsonb_build_object('profile', v_result, 'warnings', to_jsonb(v_warnings));
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.rotate_team_code()
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
begin
  perform private.assert_admin();
  perform pg_catalog.set_config('app.rpc', 'on', true);
  update public.app_secrets s
     set team_code = upper(pg_catalog.encode(extensions.gen_random_bytes(6), 'hex')),
         team_code_rotated_at = pg_catalog.now(),
         updated_by = (select auth.uid())
   where s.id = 1
  returning s.team_code into v_code;
  if v_code is null then perform private.fail('BOOTSTRAP_NOT_CONFIGURED', 'Instalação incompleta: aplique o schema.sql por inteiro.'); end if;
  perform private.audit('rpc', 'rotate_team_code', '1', null, jsonb_build_object('team_code', '********' || right(v_code, 4)));
  return v_code;
end $$;

create or replace function public.update_app_settings(p_patch jsonb)
returns public.app_settings language plpgsql security definer set search_path = ''
as $$
declare
  v_key text;
  v_row public.app_settings;
  v_tz text;
begin
  perform private.assert_admin();
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    perform private.fail('INVALID_PATCH_KEY', 'Campo não permitido: (patch inválido).');
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('company_name', 'xp_per_level', 'currency', 'timezone', 'target_conversion_pct', 'target_attendance_pct',
                     'target_crm_pct', 'target_activities_count', 'rank_admins', 'auto_approve_members') then
      perform private.fail('INVALID_PATCH_KEY', 'Campo não permitido: ' || v_key || '.');
    end if;
  end loop;
  if p_patch ? 'timezone' then
    select a.timezone into v_tz from public.app_settings a where a.id = 1;
    if (p_patch ->> 'timezone') is distinct from v_tz and exists (select 1 from public.point_entries) then
      perform private.fail('TIMEZONE_LOCKED', 'O fuso só pode ser alterado antes do primeiro lançamento.');
    end if;
  end if;
  update public.app_settings a set
    company_name = coalesce(p_patch ->> 'company_name', a.company_name),
    xp_per_level = coalesce((p_patch ->> 'xp_per_level')::int, a.xp_per_level),
    currency = coalesce(p_patch ->> 'currency', a.currency),
    timezone = coalesce(p_patch ->> 'timezone', a.timezone),
    target_conversion_pct = coalesce((p_patch ->> 'target_conversion_pct')::numeric, a.target_conversion_pct),
    target_attendance_pct = coalesce((p_patch ->> 'target_attendance_pct')::numeric, a.target_attendance_pct),
    target_crm_pct = coalesce((p_patch ->> 'target_crm_pct')::numeric, a.target_crm_pct),
    target_activities_count = coalesce((p_patch ->> 'target_activities_count')::int, a.target_activities_count),
    rank_admins = coalesce((p_patch ->> 'rank_admins')::boolean, a.rank_admins),
    auto_approve_members = coalesce((p_patch ->> 'auto_approve_members')::boolean, a.auto_approve_members)
  where a.id = 1
  returning a.* into v_row;
  perform private.audit('rpc', 'update_app_settings', '1', null, p_patch);
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.save_special_event(p jsonb)
returns public.special_events language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.special_events;
  v_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  perform private.assert_admin();
  -- SQL fixer r2: casts do jsonb no corpo (não no declare) para cair no handler INVALID_ARGUMENT
  v_id := (p ->> 'id')::uuid;
  v_starts := (p ->> 'starts_at')::timestamptz;
  v_ends := (p ->> 'ends_at')::timestamptz;
  if v_starts is null or v_ends is null or v_ends <= v_starts then
    perform private.fail('EVENT_RANGE_INVALID', 'A data final deve ser posterior à inicial.');
  end if;
  begin
    if v_id is null then
      insert into public.special_events (name, description, multiplier, starts_at, ends_at, is_active)
      values (p ->> 'name', p ->> 'description', coalesce((p ->> 'multiplier')::numeric, 2), v_starts, v_ends, coalesce((p ->> 'is_active')::boolean, true))
      returning * into v_row;
    else
      update public.special_events e set
        name = coalesce(p ->> 'name', e.name),
        description = case when p ? 'description' then p ->> 'description' else e.description end,
        multiplier = coalesce((p ->> 'multiplier')::numeric, e.multiplier),
        starts_at = v_starts, ends_at = v_ends,
        is_active = coalesce((p ->> 'is_active')::boolean, e.is_active)
      where e.id = v_id and e.deleted_at is null
      returning e.* into v_row;
      if not found then perform private.fail('EVENT_NOT_FOUND', 'Evento não encontrado.'); end if;
    end if;
  exception when exclusion_violation then
    raise exception using message = 'EVENT_OVERLAP', detail = 'O período conflita com outro evento ativo.', errcode = 'P0001';
  end;
  perform private.audit('rpc', 'save_special_event', v_row.id::text, null, p);
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.recompute_stats(p_profile_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_pid uuid;
  v_profiles int := 0;
  v_seasons int := 0;
  v_c public.challenges;
begin
  perform private.assert_admin();
  for v_pid in select p.id from public.profiles p where p_profile_id is null or p.id = p_profile_id loop
    perform private.lock_profile(v_pid, 'progress');
    v_profiles := v_profiles + 1;
    delete from public.profile_season_stats where profile_id = v_pid;
    insert into public.profile_season_stats (profile_id, season_id, points, points_earned, points_updated_at, coins_earned, coins_spent,
      sales_amount, sales_count, meetings_scheduled, meetings_held, calls, crm_updates, lead_recoveries, upsells, activities_count,
      missions_completed, last_entry_at)
    select e.profile_id, e.season_id,
      coalesce(sum(e.points), 0),
      coalesce(sum(case when e.reverses_entry_id is null then greatest(e.points, 0) else -greatest(o.points, 0) end), 0),
      max(e.occurred_at) filter (where e.points > 0 and e.reverses_entry_id is null),
      coalesce(sum(case when e.reverses_entry_id is null then greatest(e.coins, 0) else -greatest(o.coins, 0) end), 0),
      coalesce(sum(case when e.reverses_entry_id is null then greatest(-e.coins, 0) else -greatest(-o.coins, 0) end), 0),
      coalesce(sum(case when e.source in ('rule','manual','system') and e.metric in ('sale','upsell') then coalesce(e.amount, 0) else 0 end), 0),
      coalesce(sum(case when e.source in ('rule','manual','system') and e.metric = 'sale' then e.quantity * x.sgn else 0 end), 0),
      coalesce(sum(case when e.source in ('rule','manual','system') and e.metric = 'meeting_scheduled' then e.quantity * x.sgn else 0 end), 0),
      coalesce(sum(case when e.source in ('rule','manual','system') and e.metric = 'meeting_held' then e.quantity * x.sgn else 0 end), 0),
      coalesce(sum(case when e.source in ('rule','manual','system') and e.metric = 'call' then e.quantity * x.sgn else 0 end), 0),
      coalesce(sum(case when e.source in ('rule','manual','system') and e.metric = 'crm_update' then e.quantity * x.sgn else 0 end), 0),
      coalesce(sum(case when e.source in ('rule','manual','system') and e.metric = 'lead_recovery' then e.quantity * x.sgn else 0 end), 0),
      coalesce(sum(case when e.source in ('rule','manual','system') and e.metric = 'upsell' then e.quantity * x.sgn else 0 end), 0),
      coalesce(sum(case when coalesce(o.source, e.source) in ('rule','manual') and (e.metric is null or e.metric not in ('amount_step','weekly_goal','monthly_goal','custom')) then e.quantity * x.sgn else 0 end), 0),
      (select count(*)::int from public.mission_progress mp join public.missions m on m.id = mp.mission_id
        where mp.profile_id = e.profile_id and m.season_id = e.season_id and mp.completed_at is not null),
      max(e.occurred_at) filter (where private.counts_for_streak(e))
    from public.point_entries e
    left join public.point_entries o on o.id = e.reverses_entry_id
    cross join lateral (select case when e.points > 0 then 1 when e.points < 0 then -1 when e.reverses_entry_id is not null then -1 else 1 end as sgn) x
    where e.profile_id = v_pid
    group by e.profile_id, e.season_id;
    get diagnostics v_seasons = row_count;

    insert into public.profile_lifetime_stats (profile_id) values (v_pid) on conflict do nothing;
    update public.profile_lifetime_stats ls set
      coins_earned = coalesce(agg.coins_earned, 0),
      coins_spent = coalesce(agg.coins_spent, 0),
      sales_amount = coalesce(agg.sales_amount, 0),
      sales_count = coalesce(agg.sales_count, 0),
      first_sale_at = agg.first_sale_at,
      missions_completed = (select count(*)::int from public.mission_progress mp where mp.profile_id = v_pid and mp.completed_at is not null),
      updated_at = pg_catalog.now()
    from (
      select
        sum(case when e.reverses_entry_id is null then greatest(e.coins, 0) else -greatest(o.coins, 0) end) as coins_earned,
        sum(case when e.reverses_entry_id is null then greatest(-e.coins, 0) else -greatest(-o.coins, 0) end) as coins_spent,
        sum(case when e.source in ('rule','manual','system') and e.metric in ('sale','upsell') then coalesce(e.amount, 0) else 0 end) as sales_amount,
        sum(case when e.source in ('rule','manual','system') and e.metric = 'sale' then e.quantity * (case when e.points > 0 then 1 when e.points < 0 then -1 when e.reverses_entry_id is not null then -1 else 1 end) else 0 end) as sales_count,
        min(e.occurred_at) filter (where e.reverses_entry_id is null and e.source in ('rule','manual','system') and e.metric = 'sale' and coalesce(e.amount, 0) > 0) as first_sale_at
      from public.point_entries e left join public.point_entries o on o.id = e.reverses_entry_id
      where e.profile_id = v_pid
    ) agg
    where ls.profile_id = v_pid;
    perform private.recompute_streak(v_pid);

    for v_c in select c.* from public.challenges c join public.challenge_participants cp on cp.challenge_id = c.id and cp.profile_id = v_pid where c.status = 'active' loop
      update public.challenge_participants cp
         set current_value = coalesce((select sum(private.challenge_value(v_c.metric, e)) from public.point_entries e
                                        where e.profile_id = v_pid and e.season_id = v_c.season_id and e.occurred_at >= v_c.starts_at and e.occurred_at < v_c.ends_at), 0),
             updated_at = pg_catalog.now()
       where cp.challenge_id = v_c.id and cp.profile_id = v_pid;
    end loop;
  end loop;
  perform private.audit('rpc', 'recompute_stats', coalesce(p_profile_id::text, 'all'), null, jsonb_build_object('profiles', v_profiles));
  return jsonb_build_object('profiles', v_profiles, 'seasons', (select count(*)::int from public.seasons));
end $$;

-- =============================================================================
-- 7.3 Temporada (admin)
-- =============================================================================
create or replace function public.create_season(
  p_name text, p_starts_on date, p_ends_on date, p_team_goal_amount numeric default 0, p_activate boolean default false
)
returns public.seasons language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text := public.app_timezone();
  v_row public.seasons;
  v_xp int;
begin
  perform private.assert_admin();
  -- DECISIONS.md: validar antes do insert para nunca vazar 23502/23514 cru (§9: RPC devolve código do catálogo)
  if p_name is null or length(trim(p_name)) < 1 or length(trim(p_name)) > 60 then
    perform private.fail('NAME_REQUIRED', 'Informe o nome (1 a 60 caracteres).');
  end if;
  if p_team_goal_amount is not null and (p_team_goal_amount < 0 or p_team_goal_amount > 999999999999) then
    perform private.fail('GOAL_INVALID', 'A meta deve ser um valor entre 0 e 999.999.999.999.');
  end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then
    perform private.fail('SEASON_RANGE_INVALID', 'A data final deve ser posterior à inicial.');
  end if;
  select a.xp_per_level into v_xp from public.app_settings a where a.id = 1;
  begin
    insert into public.seasons (name, starts_at, ends_at, team_goal_amount, xp_per_level, is_active)
    values (trim(p_name), (p_starts_on::timestamp) at time zone v_tz, ((p_ends_on + 1)::timestamp) at time zone v_tz, coalesce(p_team_goal_amount, 0), coalesce(v_xp, 400), false)
    returning * into v_row;
  exception when exclusion_violation then
    raise exception using message = 'SEASON_OVERLAP', detail = 'O período conflita com outra temporada.', errcode = 'P0001';
  end;
  insert into public.season_goals (season_id, profile_id, goal_amount)
  select v_row.id, p.id, coalesce(pp.default_goal_amount, 0)
  from public.profiles p left join public.profile_private pp on pp.profile_id = p.id
  where p.status = 'active'
  on conflict do nothing;
  perform private.audit('rpc', 'create_season', v_row.id::text, null,
    jsonb_build_object('name', p_name, 'starts_on', p_starts_on, 'ends_on', p_ends_on, 'team_goal_amount', p_team_goal_amount, 'activate', p_activate));
  if coalesce(p_activate, false) then
    v_row := public.activate_season(v_row.id);
  end if;
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.update_season(p_season_id uuid, p_patch jsonb)
returns public.seasons language plpgsql security definer set search_path = ''
as $$
declare
  v_key text;
  v_tz text := public.app_timezone();
  v_row public.seasons;
  v_starts timestamptz;
  v_ends timestamptz;
  v_goal numeric;
begin
  perform private.assert_admin();
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    perform private.fail('INVALID_PATCH_KEY', 'Campo não permitido: (patch inválido).');
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('name', 'team_goal_amount', 'starts_on', 'ends_on') then
      perform private.fail('INVALID_PATCH_KEY', 'Campo não permitido: ' || v_key || '.');
    end if;
  end loop;
  select * into v_row from public.seasons s where s.id = p_season_id for update;
  if not found then perform private.fail('SEASON_NOT_FOUND', 'Temporada não encontrada.'); end if;

  -- DECISIONS.md: valores do patch são validados/convertidos aqui para nunca vazar 22007/22P02/23514 cru (§9)
  if p_patch ? 'name' and (p_patch ->> 'name') is not null
     and (length(trim(p_patch ->> 'name')) < 1 or length(trim(p_patch ->> 'name')) > 60) then
    perform private.fail('NAME_REQUIRED', 'Informe o nome (1 a 60 caracteres).');
  end if;
  v_goal := private.patch_goal(p_patch, 'team_goal_amount');

  v_starts := v_row.starts_at;
  v_ends := v_row.ends_at;
  if p_patch ?| array['starts_on', 'ends_on'] then
    if v_row.closed_at is not null then perform private.fail('SEASON_ALREADY_CLOSED', 'Temporada já encerrada.'); end if;
    begin
      if p_patch ? 'starts_on' then v_starts := ((p_patch ->> 'starts_on')::date::timestamp) at time zone v_tz; end if;
      if p_patch ? 'ends_on' then v_ends := (((p_patch ->> 'ends_on')::date + 1)::timestamp) at time zone v_tz; end if;
    exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then
      v_starts := null;
    end;
    if v_starts is null or v_ends is null or v_ends <= v_starts then perform private.fail('SEASON_RANGE_INVALID', 'A data final deve ser posterior à inicial.'); end if;
    if exists (select 1 from public.point_entries e where e.season_id = p_season_id and (e.occurred_at < v_starts or e.occurred_at >= v_ends)) then
      perform private.fail('SEASON_HAS_ENTRIES_OUTSIDE', 'Existem lançamentos fora do novo período.');
    end if;
    if exists (select 1 from public.missions m where m.season_id = p_season_id and m.deleted_at is null and (m.starts_at < v_starts or m.ends_at > v_ends))
       or exists (select 1 from public.challenges c where c.season_id = p_season_id and c.status <> 'cancelled' and (c.starts_at < v_starts or c.ends_at > v_ends)) then
      perform private.fail('SEASON_HAS_WINDOWS_OUTSIDE', 'Existem missões ou desafios com janela fora do novo período.');
    end if;
  end if;

  begin
    update public.seasons s set
      name = coalesce(nullif(trim(p_patch ->> 'name'), ''), s.name),
      team_goal_amount = coalesce(v_goal, s.team_goal_amount),
      starts_at = v_starts,
      ends_at = v_ends
    where s.id = p_season_id
    returning s.* into v_row;
  exception when exclusion_violation then
    raise exception using message = 'SEASON_OVERLAP', detail = 'O período conflita com outra temporada.', errcode = 'P0001';
  end;
  perform private.audit('rpc', 'update_season', p_season_id::text, null, p_patch);
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.activate_season(p_season_id uuid)
returns public.seasons language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.seasons;
  v_pid uuid;
  v_tz text := public.app_timezone();
begin
  perform private.assert_admin();
  select * into v_row from public.seasons s where s.id = p_season_id for update;
  if not found then perform private.fail('SEASON_NOT_FOUND', 'Temporada não encontrada.'); end if;
  if v_row.closed_at is not null then perform private.fail('SEASON_CLOSED', 'Esta temporada já foi encerrada.'); end if;
  if v_row.starts_at > pg_catalog.now() then
    perform private.fail('SEASON_NOT_STARTED', 'A temporada começa em ' || pg_catalog.to_char(v_row.starts_at at time zone v_tz, 'DD/MM') || '.');
  end if;
  update public.seasons s set is_active = false where s.is_active and s.id <> p_season_id;
  update public.seasons s set is_active = true where s.id = p_season_id returning s.* into v_row;

  insert into public.season_goals (season_id, profile_id, goal_amount)
  select p_season_id, p.id, coalesce(pp.default_goal_amount, 0)
  from public.profiles p left join public.profile_private pp on pp.profile_id = p.id
  where p.status = 'active'
  on conflict do nothing;

  for v_pid in select p.id from public.profiles p where p.status = 'active' loop
    perform private.evaluate_goal_milestone(v_pid, p_season_id, pg_catalog.now());
  end loop;

  perform private.notify_all('season', 'Nova temporada', v_row.name, jsonb_build_object('season_id', p_season_id));
  perform private.audit('rpc', 'activate_season', p_season_id::text, null, jsonb_build_object('name', v_row.name));
  return v_row;
end $$;

create or replace function public.close_season(p_season_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.seasons;
  v_tz text := public.app_timezone();
  v_ends_at timestamptz;
  v_c public.challenges;
  v_rank_admins boolean;
  v_champion uuid;
  v_champion_name text;
  v_ach public.achievements;
  v_r record;
  v_results jsonb;
  v_warnings text[] := '{}';
  v_next public.seasons;
  v_payload jsonb;
  v_result jsonb;
begin
  perform private.assert_admin();
  select * into v_row from public.seasons s where s.id = p_season_id for update;
  if not found then perform private.fail('SEASON_NOT_FOUND', 'Temporada não encontrada.'); end if;
  if v_row.closed_at is not null then perform private.fail('SEASON_ALREADY_CLOSED', 'Temporada já encerrada.'); end if;
  if pg_catalog.now() < v_row.starts_at then
    perform private.fail('SEASON_NOT_STARTED', 'A temporada começa em ' || pg_catalog.to_char(v_row.starts_at at time zone v_tz, 'DD/MM') || '.');
  end if;

  v_ends_at := case when pg_catalog.now() < v_row.ends_at
                    then ((public.local_today() + 1)::timestamp) at time zone v_tz
                    else v_row.ends_at end;
  perform pg_catalog.set_config('app.rpc', 'on', true);

  -- 3. clamp das janelas de missões e desafios
  update public.missions m
     set ends_at = least(m.ends_at, v_ends_at), is_active = (m.is_active and m.starts_at < v_ends_at)
   where m.season_id = p_season_id and m.ends_at > v_ends_at;
  update public.challenges c
     set ends_at = least(c.ends_at, v_ends_at)
   where c.season_id = p_season_id and c.status in ('draft', 'active') and c.ends_at > v_ends_at;

  -- 4. finaliza ativos, cancela rascunhos
  for v_c in select c.* from public.challenges c where c.season_id = p_season_id and c.status = 'active' loop
    perform public.finish_challenge(v_c.id);
  end loop;
  for v_c in select c.* from public.challenges c where c.season_id = p_season_id and c.status = 'draft' loop
    perform public.cancel_challenge(v_c.id, 'Temporada encerrada');
  end loop;

  -- 5. snapshot season_results
  select coalesce(a.rank_admins, true) into v_rank_admins from public.app_settings a where a.id = 1;
  delete from public.season_results r where r.season_id = p_season_id;
  insert into public.season_results (season_id, profile_id, final_rank, final_points, sales_amount, sales_count, goal_amount, goal_reached, level)
  select p_season_id, x.profile_id,
         case when x.is_rankable then (row_number() over (partition by x.is_rankable order by x.points desc, x.sales_amount desc, x.points_updated_at asc nulls last, x.profile_id))::int end,
         x.points, x.sales_amount, x.sales_count, x.goal_amount,
         (x.goal_amount > 0 and x.sales_amount >= x.goal_amount),
         (greatest(x.points, 0) / v_row.xp_per_level)::int
  from (
    select p.id as profile_id,
           coalesce(ss.points, 0) as points, coalesce(ss.sales_amount, 0) as sales_amount, coalesce(ss.sales_count, 0) as sales_count,
           ss.points_updated_at, coalesce(g.goal_amount, 0) as goal_amount,
           (p.status = 'active' and (v_rank_admins or p.role <> 'admin')) as is_rankable
    from public.profiles p
    left join public.profile_season_stats ss on ss.profile_id = p.id and ss.season_id = p_season_id
    left join public.season_goals g on g.season_id = p_season_id and g.profile_id = p.id
    where p.status = 'active' or ss.profile_id is not null or g.profile_id is not null
  ) x;

  -- 6. CAMPEÃO (só se o 1º tem pontos > 0) e META BATIDA
  select r.profile_id into v_champion from public.season_results r
   where r.season_id = p_season_id and r.final_rank = 1 and r.final_points > 0;
  if v_champion is not null then
    select p.full_name into v_champion_name from public.profiles p where p.id = v_champion;
    for v_ach in select a.* from public.achievements a where a.is_active and a.deleted_at is null and a.criteria = 'rank_first' loop
      perform private.grant_achievement(v_champion, v_ach.id, p_season_id, null, least(pg_catalog.now(), v_row.ends_at - interval '1 second'));
    end loop;
  end if;
  for v_r in select r.profile_id from public.season_results r where r.season_id = p_season_id and r.goal_reached loop
    perform private.evaluate_goal_milestone(v_r.profile_id, p_season_id, least(pg_catalog.now(), v_row.ends_at - interval '1 second'));
  end loop;

  -- 7. fecha
  update public.seasons s
     set is_active = false, closed_at = pg_catalog.now(), closed_by = (select auth.uid()), ends_at = v_ends_at
   where s.id = p_season_id
  returning s.* into v_row;

  -- 8. feed + notificação + auditoria
  v_payload := jsonb_build_object('season_name', v_row.name);
  if v_champion is not null then
    v_payload := v_payload || jsonb_build_object('champion_profile_id', v_champion, 'champion_name', v_champion_name);
  end if;
  perform private.push_feed('season_closed', null, p_season_id, v_payload, 'season_closed:' || p_season_id::text, pg_catalog.now());
  perform private.notify_all('season', 'Temporada encerrada',
    v_row.name || case when v_champion_name is not null then ' — campeão: ' || v_champion_name else ' — sem campeão' end,
    jsonb_build_object('season_id', p_season_id));

  -- 9. aviso de buraco até a próxima temporada
  select s.* into v_next from public.seasons s where s.starts_at > v_ends_at order by s.starts_at limit 1;
  if found and not exists (select 1 from public.seasons s where s.id <> p_season_id and s.starts_at <= v_ends_at and s.ends_at > v_ends_at) then
    v_warnings := array_append(v_warnings, 'gap_until_next_season');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('profile_id', r.profile_id, 'final_rank', r.final_rank, 'final_points', r.final_points,
                                               'sales_amount', r.sales_amount, 'goal_reached', r.goal_reached) order by r.final_rank nulls last, r.profile_id), '[]'::jsonb)
    into v_results from public.season_results r where r.season_id = p_season_id;

  v_result := jsonb_build_object('season_id', p_season_id, 'results', v_results, 'champion_profile_id', v_champion, 'warnings', to_jsonb(v_warnings));
  if v_next.id is not null then
    v_result := v_result || jsonb_build_object('next_season_id', v_next.id, 'next_starts_at', v_next.starts_at);
  end if;
  perform private.audit('rpc', 'close_season', p_season_id::text, null, v_result);
  return v_result;
end $$;

-- =============================================================================
-- 7.4 Ledger (admin)
-- =============================================================================
create or replace function public.record_rule_entry(
  p_profile_id uuid, p_rule_id uuid, p_quantity int default 1, p_amount numeric default null,
  p_occurred_at timestamptz default pg_catalog.now(), p_reason text default null
)
returns public.point_entries language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_rule public.point_rules;
  v_qty int := coalesce(p_quantity, 1);
  v_at timestamptz := coalesce(p_occurred_at, pg_catalog.now());
  v_key text;
  v_entry public.point_entries;
begin
  perform private.assert_admin();
  select * into v_profile from public.profiles p where p.id = p_profile_id;
  if not found then perform private.fail('PROFILE_NOT_FOUND', 'Perfil não encontrado.'); end if;
  if v_profile.status <> 'active' then perform private.fail('PROFILE_INACTIVE', 'Este perfil está inativo.'); end if;
  select * into v_rule from public.point_rules r where r.id = p_rule_id and r.deleted_at is null;
  if not found then perform private.fail('RULE_NOT_FOUND', 'Regra de pontuação não encontrada.'); end if;
  if v_qty < 1 or v_qty > 1000 then perform private.fail('QUANTITY_INVALID', 'Quantidade deve ser entre 1 e 1000.'); end if;
  -- DECISIONS.md: numeric(14,2) aceita até 999.999.999.999,99; validar o teto aqui evita 22003 cru (§9).
  -- Só o teto: null/negativo continuam como AMOUNT_REQUIRED em before_point_entry (§6.6).
  if p_amount is not null and p_amount > 999999999999 then
    perform private.fail('AMOUNT_INVALID', 'O valor em R$ deve ser no máximo 999.999.999.999.');
  end if;
  if v_rule.points * v_qty * 10 > 1000000 then
    perform private.fail('POINTS_INVALID', 'Pontos devem ser diferentes de zero e até 100.000 (com quantidade e multiplicador, até 1.000.000).');
  end if;
  if v_at > pg_catalog.now() + interval '5 minutes' or v_at < pg_catalog.now() - interval '90 days' then
    perform private.fail('OCCURRED_AT_INVALID', 'Data do lançamento inválida (até 90 dias atrás).');
  end if;
  if v_rule.metric = 'weekly_goal' then
    perform private.lock_profile(p_profile_id, 'progress');
    v_key := public.iso_week_key(public.local_day(v_at));
    if exists (select 1 from public.milestone_awards m where m.profile_id = p_profile_id and m.metric = 'weekly_goal' and m.period_key = v_key) then
      perform private.fail('MILESTONE_ALREADY_AWARDED', 'Meta semanal já lançada para esta semana.');
    end if;
    v_qty := 1;
  end if;

  insert into public.point_entries (profile_id, rule_id, quantity, amount, reason, source, occurred_at, base_points, points, coins)
  values (p_profile_id, p_rule_id, v_qty, p_amount, nullif(trim(p_reason), ''), 'rule', v_at, 0, 0, 0)
  returning * into v_entry;

  if v_rule.metric = 'weekly_goal' then
    insert into public.milestone_awards (profile_id, season_id, metric, period_key, entry_id)
    values (p_profile_id, v_entry.season_id, 'weekly_goal', v_key, v_entry.id);
  end if;
  return v_entry;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.record_manual_entry(p_profile_id uuid, p_points int, p_reason text, p_coins int default null)
returns public.point_entries language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_coins int;
  v_entry public.point_entries;
begin
  perform private.assert_admin();
  select * into v_profile from public.profiles p where p.id = p_profile_id;
  if not found then perform private.fail('PROFILE_NOT_FOUND', 'Perfil não encontrado.'); end if;
  if v_profile.status <> 'active' then perform private.fail('PROFILE_INACTIVE', 'Este perfil está inativo.'); end if;
  if p_points is null or p_points = 0 or p_points < -100000 or p_points > 100000 then
    perform private.fail('POINTS_INVALID', 'Pontos devem ser diferentes de zero e até 100.000 (com quantidade e multiplicador, até 1.000.000).');
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 or length(trim(p_reason)) > 500 then
    perform private.fail('REASON_REQUIRED', 'Informe o motivo (3 a 500 caracteres).');
  end if;
  v_coins := coalesce(p_coins, case when p_points > 0 then p_points else 0 end);
  if v_coins < -100000 or v_coins > 100000 then
    perform private.fail('POINTS_INVALID', 'Pontos devem ser diferentes de zero e até 100.000 (com quantidade e multiplicador, até 1.000.000).');
  end if;
  insert into public.point_entries (profile_id, source, base_points, points, coins, reason, occurred_at)
  values (p_profile_id, 'manual', p_points, p_points, v_coins, trim(p_reason), pg_catalog.now())
  returning * into v_entry;
  return v_entry;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.record_initial_points(p_profile_id uuid, p_points int)
returns public.point_entries language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_season uuid;
  v_entry public.point_entries;
begin
  perform private.assert_admin();
  select * into v_profile from public.profiles p where p.id = p_profile_id;
  if not found then perform private.fail('PROFILE_NOT_FOUND', 'Perfil não encontrado.'); end if;
  if v_profile.status <> 'active' then perform private.fail('PROFILE_INACTIVE', 'Este perfil está inativo.'); end if;
  if p_points is null or p_points < 1 or p_points > 100000 then
    perform private.fail('POINTS_INVALID', 'Pontos devem ser diferentes de zero e até 100.000 (com quantidade e multiplicador, até 1.000.000).');
  end if;
  v_season := private.season_for(pg_catalog.now());
  if v_season is null then perform private.fail('NO_SEASON_FOR_DATE', 'Não existe temporada cobrindo esta data.'); end if;
  if exists (select 1 from public.point_entries e where e.profile_id = p_profile_id and e.season_id = v_season
              and e.source = 'system' and e.metric is null and e.reason = 'Pontos iniciais' and e.reverses_entry_id is null) then
    perform private.fail('INITIAL_POINTS_EXISTS', 'Pontos iniciais já lançados para este perfil nesta temporada.');
  end if;
  insert into public.point_entries (profile_id, source, base_points, points, coins, reason, occurred_at)
  values (p_profile_id, 'system', p_points, p_points, 0, 'Pontos iniciais', pg_catalog.now())
  returning * into v_entry;
  return v_entry;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.reverse_entry(p_entry_id uuid, p_reason text)
returns public.point_entries language plpgsql security definer set search_path = ''
as $$
declare
  v_orig public.point_entries;
  v_entry public.point_entries;
begin
  perform private.assert_admin();
  select * into v_orig from public.point_entries e where e.id = p_entry_id for update;
  if not found then perform private.fail('ENTRY_NOT_FOUND', 'Lançamento não encontrado.'); end if;
  if exists (select 1 from public.point_entries r where r.reverses_entry_id = p_entry_id) then
    perform private.fail('ALREADY_REVERSED', 'Este lançamento já foi estornado.');
  end if;
  if v_orig.reverses_entry_id is not null then perform private.fail('CANNOT_REVERSE_REVERSAL', 'Não é possível estornar um estorno.'); end if;
  if v_orig.source = 'reward' or (v_orig.source = 'wheel' and exists (select 1 from public.wheel_spins s where s.entry_id = v_orig.id and s.redemption_id is not null)) then
    perform private.fail('USE_HANDLE_REDEMPTION', 'Cancele o resgate pela tela de recompensas.');
  end if;
  -- occurred_at/season_id/sinais/rule_id herdados pelo trigger before_point_entry (§6.6 passo 2);
  -- source = 'system' para rule/manual/system (§7.4), senão herda (o trigger reforça a mesma regra)
  insert into public.point_entries (profile_id, source, reverses_entry_id, reason, base_points, points, coins)
  values (v_orig.profile_id, case when v_orig.source in ('rule', 'manual', 'system') then 'system'::public.entry_source else v_orig.source end,
          p_entry_id, coalesce(nullif(trim(p_reason), ''), 'Estorno'), 0, 0, 0)
  returning * into v_entry;
  perform private.audit('rpc', 'reverse_entry', p_entry_id::text, to_jsonb(v_orig), jsonb_build_object('reversal_id', v_entry.id, 'reason', p_reason));
  return v_entry;
end $$;

-- =============================================================================
-- 7.5 Missões e desafios (admin)
-- =============================================================================
create or replace function public.save_mission(p jsonb)
returns public.missions language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_row public.missions;
  v_old public.missions;
  v_spin public.wheel_kind;
  v_audience public.mission_audience;
  v_ids uuid[];
  v_pid uuid;
begin
  perform private.assert_admin();
  -- SQL fixer r2: casts do jsonb no corpo (não no declare) para cair no handler INVALID_ARGUMENT
  v_id := (p ->> 'id')::uuid;
  v_spin := (p ->> 'reward_spin')::public.wheel_kind;
  v_audience := coalesce((p ->> 'audience')::public.mission_audience, 'all');
  if v_spin is not null and not exists (select 1 from public.wheels w where w.kind = v_spin and w.is_active) then
    perform private.fail('WHEEL_INACTIVE', 'Esta roleta está desativada.');
  end if;
  if p ? 'participant_ids' and jsonb_typeof(p -> 'participant_ids') = 'array' then
    select coalesce(array_agg(x::uuid), '{}') into v_ids from jsonb_array_elements_text(p -> 'participant_ids') as x;
  else
    v_ids := '{}';
  end if;
  if v_audience = 'selected' and coalesce(array_length(v_ids, 1), 0) = 0 then
    perform private.fail('PARTICIPANTS_REQUIRED', 'Selecione ao menos um participante.');
  end if;

  if v_id is null then
    insert into public.missions (title, description, icon, kind, metric, target_kind, target_value, reward_points, reward_coins, reward_spin,
                                 starts_at, ends_at, audience, is_active, season_id)
    values (p ->> 'title', p ->> 'description', p ->> 'icon', (p ->> 'kind')::public.mission_kind, (p ->> 'metric')::public.metric_type,
            coalesce((p ->> 'target_kind')::public.mission_target_kind, 'count'), (p ->> 'target_value')::numeric,
            coalesce((p ->> 'reward_points')::int, 0), coalesce((p ->> 'reward_coins')::int, 0), v_spin,
            (p ->> 'starts_at')::timestamptz, (p ->> 'ends_at')::timestamptz, v_audience, coalesce((p ->> 'is_active')::boolean, true),
            coalesce(private.season_for((p ->> 'starts_at')::timestamptz), '00000000-0000-0000-0000-000000000000'::uuid))
    returning * into v_row;
  else
    select * into v_old from public.missions m where m.id = v_id and m.deleted_at is null for update;
    if not found then perform private.fail('MISSION_NOT_FOUND', 'Missão não encontrada.'); end if;
    if exists (select 1 from public.mission_progress mp where mp.mission_id = v_id)
       and ((p ? 'metric' and (p ->> 'metric')::public.metric_type is distinct from v_old.metric)
            or (p ? 'target_kind' and (p ->> 'target_kind')::public.mission_target_kind is distinct from v_old.target_kind)
            or (p ? 'target_value' and (p ->> 'target_value')::numeric is distinct from v_old.target_value)
            or (p ? 'kind' and (p ->> 'kind')::public.mission_kind is distinct from v_old.kind)) then
      perform private.fail('MISSION_HAS_PROGRESS', 'Missão já tem progresso; crie uma nova.');
    end if;
    update public.missions m set
      title = coalesce(p ->> 'title', m.title),
      description = case when p ? 'description' then p ->> 'description' else m.description end,
      icon = case when p ? 'icon' then p ->> 'icon' else m.icon end,
      kind = coalesce((p ->> 'kind')::public.mission_kind, m.kind),
      metric = coalesce((p ->> 'metric')::public.metric_type, m.metric),
      target_kind = coalesce((p ->> 'target_kind')::public.mission_target_kind, m.target_kind),
      target_value = coalesce((p ->> 'target_value')::numeric, m.target_value),
      reward_points = coalesce((p ->> 'reward_points')::int, m.reward_points),
      reward_coins = coalesce((p ->> 'reward_coins')::int, m.reward_coins),
      reward_spin = case when p ? 'reward_spin' then v_spin else m.reward_spin end,
      starts_at = coalesce((p ->> 'starts_at')::timestamptz, m.starts_at),
      ends_at = coalesce((p ->> 'ends_at')::timestamptz, m.ends_at),
      audience = coalesce((p ->> 'audience')::public.mission_audience, m.audience),
      is_active = coalesce((p ->> 'is_active')::boolean, m.is_active)
    where m.id = v_id
    returning m.* into v_row;
  end if;

  if v_row.audience = 'selected' then
    delete from public.mission_participants mp where mp.mission_id = v_row.id and mp.profile_id <> all (v_ids);
    foreach v_pid in array v_ids loop
      insert into public.mission_participants (mission_id, profile_id) values (v_row.id, v_pid) on conflict do nothing;
    end loop;
  else
    delete from public.mission_participants mp where mp.mission_id = v_row.id;
  end if;
  perform private.audit('rpc', 'save_mission', v_row.id::text, null, p);
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.delete_mission(p_mission_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin();
  update public.missions m set deleted_at = pg_catalog.now(), is_active = false where m.id = p_mission_id and m.deleted_at is null;
  if not found then perform private.fail('MISSION_NOT_FOUND', 'Missão não encontrada.'); end if;
  perform private.audit('rpc', 'delete_mission', p_mission_id::text, null, null);
end $$;

create or replace function public.save_challenge(p jsonb)
returns public.challenges language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_row public.challenges;
  v_old public.challenges;
  v_kind public.challenge_kind;
  v_spin public.wheel_kind;
  v_ids uuid[];
  v_pid uuid;
begin
  perform private.assert_admin();
  -- SQL fixer r2: casts do jsonb no corpo (não no declare) para cair no handler INVALID_ARGUMENT
  v_id := (p ->> 'id')::uuid;
  v_kind := (p ->> 'kind')::public.challenge_kind;
  v_spin := (p ->> 'reward_spin')::public.wheel_kind;
  if v_spin is not null and not exists (select 1 from public.wheels w where w.kind = v_spin and w.is_active) then
    perform private.fail('WHEEL_INACTIVE', 'Esta roleta está desativada.');
  end if;
  if p ? 'participant_ids' and jsonb_typeof(p -> 'participant_ids') = 'array' then
    select coalesce(array_agg(distinct x::uuid), '{}') into v_ids from jsonb_array_elements_text(p -> 'participant_ids') as x;
  else
    v_ids := '{}';
  end if;

  if v_id is not null then
    select * into v_old from public.challenges c where c.id = v_id for update;
    if not found then perform private.fail('CHALLENGE_NOT_FOUND', 'Desafio não encontrado.'); end if;
    if v_old.status <> 'draft' then perform private.fail('CHALLENGE_NOT_DRAFT', 'O desafio já foi ativado.'); end if;
    v_kind := coalesce(v_kind, v_old.kind);
  end if;
  if v_kind = 'team' and coalesce(array_length(v_ids, 1), 0) = 0 then
    select coalesce(array_agg(pr.id), '{}') into v_ids from public.profiles pr where pr.status = 'active';
  end if;
  if v_kind = 'duel' and coalesce(array_length(v_ids, 1), 0) <> 2 then
    perform private.fail('DUEL_NEEDS_TWO', 'Um duelo precisa de exatamente 2 participantes.');
  end if;

  if v_id is null then
    insert into public.challenges (name, description, kind, metric, target_value, reward_points, reward_coins, reward_spin, reward_description,
                                   starts_at, ends_at, season_id)
    values (p ->> 'name', p ->> 'description', v_kind, (p ->> 'metric')::public.challenge_metric, (p ->> 'target_value')::numeric,
            coalesce((p ->> 'reward_points')::int, 0), coalesce((p ->> 'reward_coins')::int, 0), v_spin, p ->> 'reward_description',
            (p ->> 'starts_at')::timestamptz, (p ->> 'ends_at')::timestamptz,
            coalesce(private.season_for((p ->> 'starts_at')::timestamptz), '00000000-0000-0000-0000-000000000000'::uuid))
    returning * into v_row;
  else
    update public.challenges c set
      name = coalesce(p ->> 'name', c.name),
      description = case when p ? 'description' then p ->> 'description' else c.description end,
      kind = v_kind,
      metric = coalesce((p ->> 'metric')::public.challenge_metric, c.metric),
      target_value = coalesce((p ->> 'target_value')::numeric, c.target_value),
      reward_points = coalesce((p ->> 'reward_points')::int, c.reward_points),
      reward_coins = coalesce((p ->> 'reward_coins')::int, c.reward_coins),
      reward_spin = case when p ? 'reward_spin' then v_spin else c.reward_spin end,
      reward_description = case when p ? 'reward_description' then p ->> 'reward_description' else c.reward_description end,
      starts_at = coalesce((p ->> 'starts_at')::timestamptz, c.starts_at),
      ends_at = coalesce((p ->> 'ends_at')::timestamptz, c.ends_at)
    where c.id = v_id
    returning c.* into v_row;
  end if;

  delete from public.challenge_participants cp where cp.challenge_id = v_row.id and cp.profile_id <> all (v_ids);
  foreach v_pid in array v_ids loop
    insert into public.challenge_participants (challenge_id, profile_id) values (v_row.id, v_pid) on conflict do nothing;
  end loop;
  perform private.audit('rpc', 'save_challenge', v_row.id::text, null, p);
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.activate_challenge(p_challenge_id uuid)
returns public.challenges language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.challenges;
  v_total int;
  v_pid uuid;
begin
  perform private.assert_admin();
  select * into v_row from public.challenges c where c.id = p_challenge_id for update;
  if not found then perform private.fail('CHALLENGE_NOT_FOUND', 'Desafio não encontrado.'); end if;
  if v_row.status <> 'draft' then perform private.fail('CHALLENGE_NOT_DRAFT', 'O desafio já foi ativado.'); end if;
  if v_row.ends_at <= pg_catalog.now() then
    perform private.fail('CHALLENGE_WINDOW_INVALID', 'O período do desafio precisa estar dentro da temporada e no futuro.');
  end if;
  select count(*) into v_total from public.challenge_participants cp where cp.challenge_id = p_challenge_id;
  if v_row.kind = 'duel' and v_total <> 2 then perform private.fail('DUEL_NEEDS_TWO', 'Um duelo precisa de exatamente 2 participantes.'); end if;
  if v_row.kind = 'team' and v_total < 2 then perform private.fail('TEAM_NEEDS_TWO', 'Um desafio coletivo precisa de ao menos 2 participantes.'); end if;
  if exists (select 1 from public.challenge_participants cp join public.profiles p on p.id = cp.profile_id
              where cp.challenge_id = p_challenge_id and p.status <> 'active') then
    perform private.fail('PARTICIPANT_INACTIVE', 'Há participante inativo.');
  end if;

  update public.challenge_participants cp
     set current_value = coalesce((select sum(private.challenge_value(v_row.metric, e)) from public.point_entries e
                                    where e.profile_id = cp.profile_id and e.season_id = v_row.season_id
                                      and e.occurred_at >= v_row.starts_at and e.occurred_at < v_row.ends_at), 0),
         updated_at = pg_catalog.now()
   where cp.challenge_id = p_challenge_id;

  perform pg_catalog.set_config('app.rpc', 'on', true);
  update public.challenges c set status = 'active', activated_at = pg_catalog.now() where c.id = p_challenge_id returning c.* into v_row;
  for v_pid in select cp.profile_id from public.challenge_participants cp where cp.challenge_id = p_challenge_id loop
    perform private.notify(v_pid, 'challenge', 'Novo desafio', v_row.name, jsonb_build_object('challenge_id', p_challenge_id));
  end loop;
  perform private.audit('rpc', 'activate_challenge', p_challenge_id::text, null, jsonb_build_object('name', v_row.name));
  return v_row;
end $$;

create or replace function public.finish_challenge(p_challenge_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.challenges;
  v_r record;
  v_winners uuid[] := '{}';
  v_max numeric;
  v_sum numeric;
  v_active_count int;
  v_entry public.point_entries;
  v_queue_id uuid;
  v_wheel_id uuid;
  v_at timestamptz;
  v_results jsonb;
begin
  perform private.assert_admin();
  if not exists (select 1 from public.challenges c where c.id = p_challenge_id) then
    perform private.fail('CHALLENGE_NOT_FOUND', 'Desafio não encontrado.');
  end if;
  perform pg_catalog.set_config('app.rpc', 'on', true);
  update public.challenges c set status = 'finished', finished_at = pg_catalog.now()
   where c.id = p_challenge_id and c.status = 'active' returning c.* into v_row;
  if not found then perform private.fail('CHALLENGE_NOT_ACTIVE', 'O desafio não está ativo.'); end if;
  v_at := least(pg_catalog.now(), v_row.ends_at - interval '1 second');

  delete from public.challenge_results cr where cr.challenge_id = p_challenge_id;
  insert into public.challenge_results (challenge_id, profile_id, final_value)
  select p_challenge_id, cp.profile_id,
         coalesce((select sum(private.challenge_value(v_row.metric, e)) from public.point_entries e
                    where e.profile_id = cp.profile_id and e.season_id = v_row.season_id
                      and e.occurred_at >= v_row.starts_at and e.occurred_at < v_row.ends_at), 0)
  from public.challenge_participants cp where cp.challenge_id = p_challenge_id;

  -- vencedores (inativos nunca vencem — B.17)
  select count(*) into v_active_count
  from public.challenge_results cr join public.profiles p on p.id = cr.profile_id
  where cr.challenge_id = p_challenge_id and p.status = 'active';
  if v_row.kind = 'duel' then
    select max(cr.final_value) into v_max from public.challenge_results cr join public.profiles p on p.id = cr.profile_id
    where cr.challenge_id = p_challenge_id and p.status = 'active';
    if v_max is not null and v_max > 0 then
      select coalesce(array_agg(cr.profile_id), '{}') into v_winners
      from public.challenge_results cr join public.profiles p on p.id = cr.profile_id
      where cr.challenge_id = p_challenge_id and p.status = 'active' and cr.final_value = v_max;
    end if;
  else
    select coalesce(sum(cr.final_value), 0) into v_sum from public.challenge_results cr where cr.challenge_id = p_challenge_id;
    if v_sum >= v_row.target_value then
      select coalesce(array_agg(cr.profile_id), '{}') into v_winners
      from public.challenge_results cr join public.profiles p on p.id = cr.profile_id
      where cr.challenge_id = p_challenge_id and p.status = 'active';
    end if;
  end if;
  update public.challenges c set winner_ids = v_winners where c.id = p_challenge_id returning c.* into v_row;
  update public.challenge_results cr set is_winner = (cr.profile_id = any (v_winners)) where cr.challenge_id = p_challenge_id;

  for v_r in select cr.profile_id, cr.is_winner from public.challenge_results cr where cr.challenge_id = p_challenge_id loop
    if v_r.is_winner then
      if v_row.reward_points > 0 or v_row.reward_coins > 0 then
        v_entry := private.insert_entry(v_r.profile_id, 'challenge', null, v_row.reward_points, v_row.reward_coins, v_row.name, v_at, (select auth.uid()));
        update public.challenge_results cr set entry_id = v_entry.id where cr.challenge_id = p_challenge_id and cr.profile_id = v_r.profile_id;
      end if;
      if v_row.reward_spin is not null then
        select w.id into v_wheel_id from public.wheels w where w.kind = v_row.reward_spin;
        v_queue_id := null;
        insert into public.wheel_queue (profile_id, person_name, wheel_id, source, reference_kind, reference_id)
        select v_r.profile_id, p.full_name, v_wheel_id, 'earned', 'challenge_result', p_challenge_id::text || ':' || v_r.profile_id::text
        from public.profiles p where p.id = v_r.profile_id
        on conflict (reference_kind, reference_id) where reference_id is not null do nothing
        returning id into v_queue_id;
        if v_queue_id is not null then
          update public.challenge_results cr set queue_id = v_queue_id where cr.challenge_id = p_challenge_id and cr.profile_id = v_r.profile_id;
        end if;
      end if;
    end if;
    perform private.push_feed('challenge_finished', v_r.profile_id, v_row.season_id,
      jsonb_build_object('name', v_row.name, 'kind', v_row.kind, 'is_winner', v_r.is_winner),
      'challenge_finished:' || p_challenge_id::text || ':' || v_r.profile_id::text, v_at);
    perform private.notify(v_r.profile_id, 'challenge', case when v_r.is_winner then 'Você venceu o desafio!' else 'Desafio encerrado' end, v_row.name,
      jsonb_build_object('challenge_id', p_challenge_id, 'is_winner', v_r.is_winner));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('profile_id', cr.profile_id, 'final_value', cr.final_value, 'is_winner', cr.is_winner, 'entry_id', cr.entry_id)
                            order by cr.final_value desc, cr.profile_id), '[]'::jsonb)
    into v_results from public.challenge_results cr where cr.challenge_id = p_challenge_id;
  perform private.audit('rpc', 'finish_challenge', p_challenge_id::text, null, jsonb_build_object('winner_ids', to_jsonb(v_winners)));
  return jsonb_build_object('challenge_id', p_challenge_id, 'winner_ids', to_jsonb(v_winners), 'results', v_results);
end $$;

create or replace function public.cancel_challenge(p_challenge_id uuid, p_reason text default null)
returns public.challenges language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.challenges;
  v_pid uuid;
begin
  perform private.assert_admin();
  select * into v_row from public.challenges c where c.id = p_challenge_id for update;
  if not found then perform private.fail('CHALLENGE_NOT_FOUND', 'Desafio não encontrado.'); end if;
  if v_row.status not in ('draft', 'active') then perform private.fail('CHALLENGE_FINAL', 'Desafio finalizado/cancelado não pode mudar.'); end if;
  perform pg_catalog.set_config('app.rpc', 'on', true);
  update public.challenges c set status = 'cancelled', cancelled_at = pg_catalog.now() where c.id = p_challenge_id returning c.* into v_row;
  for v_pid in select cp.profile_id from public.challenge_participants cp join public.profiles p on p.id = cp.profile_id
               where cp.challenge_id = p_challenge_id and p.status = 'active' loop
    perform private.notify(v_pid, 'challenge', coalesce(nullif(trim(p_reason), ''), 'Desafio cancelado'), v_row.name, jsonb_build_object('challenge_id', p_challenge_id));
  end loop;
  perform private.audit('rpc', 'cancel_challenge', p_challenge_id::text, null, jsonb_build_object('reason', p_reason));
  return v_row;
end $$;

-- =============================================================================
-- 7.6 Roleta
-- =============================================================================
create or replace function public.enqueue_wheel(
  p_profile_id uuid default null, p_person_name text default null, p_wheel_kind public.wheel_kind default 'classic', p_attempts int default 1
)
returns public.wheel_queue language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_wheel public.wheels;
  v_name text;
  v_row public.wheel_queue;
begin
  perform private.assert_admin();
  if (p_profile_id is null and nullif(trim(coalesce(p_person_name, '')), '') is null)
     or (p_profile_id is not null and nullif(trim(coalesce(p_person_name, '')), '') is not null) then
    perform private.fail('QUEUE_TARGET_REQUIRED', 'Informe um colaborador ou um nome.');
  end if;
  if p_profile_id is not null then
    select * into v_profile from public.profiles p where p.id = p_profile_id;
    if not found then perform private.fail('PROFILE_NOT_FOUND', 'Perfil não encontrado.'); end if;
    if v_profile.status <> 'active' then perform private.fail('PROFILE_INACTIVE', 'Este perfil está inativo.'); end if;
    v_name := v_profile.full_name;
  else
    v_name := left(trim(p_person_name), 80);
  end if;
  select * into v_wheel from public.wheels w where w.kind = coalesce(p_wheel_kind, 'classic');
  if not found or not v_wheel.is_active then perform private.fail('WHEEL_INACTIVE', 'Esta roleta está desativada.'); end if;
  if p_attempts is null or p_attempts < 1 or p_attempts > 20 then
    perform private.fail('ATTEMPTS_INVALID', 'Tentativas devem ser entre 1 e 20 e maiores que as já usadas (0).');
  end if;
  if exists (
    select 1 from public.wheel_queue q
    where q.status in ('waiting', 'active') and q.source = 'manual'
      and ((p_profile_id is not null and q.profile_id = p_profile_id)
           or (p_profile_id is null and q.profile_id is null and lower(q.person_name) = lower(v_name)))
  ) then
    perform private.fail('ALREADY_IN_QUEUE', 'Esta pessoa já está na fila (entrada manual).');
  end if;
  insert into public.wheel_queue (profile_id, person_name, wheel_id, attempts_allowed, status, source, created_by)
  values (p_profile_id, v_name, v_wheel.id, p_attempts, 'waiting', 'manual', (select auth.uid()))
  returning * into v_row;
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.update_queue_entry(p_queue_id uuid, p_wheel_kind public.wheel_kind default null, p_attempts int default null)
returns public.wheel_queue language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.wheel_queue;
  v_wheel public.wheels;
begin
  perform private.assert_admin();
  select * into v_row from public.wheel_queue q where q.id = p_queue_id for update;
  if not found then perform private.fail('QUEUE_NOT_FOUND', 'Entrada da fila não encontrada.'); end if;
  if v_row.status not in ('waiting', 'active') then perform private.fail('QUEUE_NOT_EDITABLE', 'Esta entrada da fila não pode mais ser alterada.'); end if;
  if exists (select 1 from public.wheel_spins s where s.queue_id = p_queue_id and s.status = 'pending') then
    perform private.fail('SPIN_PENDING', 'Há um prêmio aguardando aprovação.');
  end if;
  if p_wheel_kind is not null then
    select * into v_wheel from public.wheels w where w.kind = p_wheel_kind;
    if not found or not v_wheel.is_active then perform private.fail('WHEEL_INACTIVE', 'Esta roleta está desativada.'); end if;
  end if;
  if p_attempts is not null and (p_attempts <= v_row.attempts_used or p_attempts > 20) then
    perform private.fail('ATTEMPTS_INVALID', 'Tentativas devem ser maiores que as já usadas (' || v_row.attempts_used || ') e até 20.');
  end if;
  update public.wheel_queue q set
    wheel_id = coalesce(v_wheel.id, q.wheel_id),
    attempts_allowed = coalesce(p_attempts, q.attempts_allowed)
  where q.id = p_queue_id
  returning q.* into v_row;
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

create or replace function public.remove_from_queue(p_queue_id uuid)
returns public.wheel_queue language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.wheel_queue;
begin
  perform private.assert_admin();
  select * into v_row from public.wheel_queue q where q.id = p_queue_id for update;
  if not found then perform private.fail('QUEUE_NOT_FOUND', 'Entrada da fila não encontrada.'); end if;
  if exists (select 1 from public.wheel_spins s where s.queue_id = p_queue_id and s.status = 'pending') then
    perform private.fail('SPIN_PENDING', 'Há um prêmio aguardando aprovação.');
  end if;
  if v_row.status not in ('waiting', 'active') then perform private.fail('QUEUE_NOT_EDITABLE', 'Esta entrada da fila não pode mais ser alterada.'); end if;
  update public.wheel_queue q set status = 'removed', finished_at = pg_catalog.now(), removed_by = (select auth.uid())
  where q.id = p_queue_id returning q.* into v_row;
  return v_row;
end $$;

create or replace function public.release_turn(p_queue_id uuid)
returns public.wheel_queue language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.wheel_queue;
  v_status public.profile_status;
  v_wheel public.wheels;
begin
  perform private.assert_admin();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('wheel_turn'));
  select * into v_row from public.wheel_queue q where q.id = p_queue_id for update;
  if not found then perform private.fail('QUEUE_NOT_FOUND', 'Entrada da fila não encontrada.'); end if;
  if v_row.profile_id is not null then
    select p.status into v_status from public.profiles p where p.id = v_row.profile_id;
    if v_status is distinct from 'active' then perform private.fail('PROFILE_INACTIVE', 'Este perfil está inativo.'); end if;
  end if;
  select * into v_wheel from public.wheels w where w.id = v_row.wheel_id;
  if not v_wheel.is_active then perform private.fail('WHEEL_INACTIVE', 'Esta roleta está desativada.'); end if;
  if exists (select 1 from public.wheel_spins s where s.status = 'pending') then
    perform private.fail('SPIN_PENDING', 'Há um prêmio aguardando aprovação.');
  end if;
  -- §7.6 passo 5: QUEUE_NOT_WAITING antes de ATTEMPTS_EXHAUSTED (linha já travada com for update)
  if v_row.status <> 'waiting' then perform private.fail('QUEUE_NOT_WAITING', 'Só entradas em espera podem ser liberadas.'); end if;
  if v_row.attempts_used >= v_row.attempts_allowed then perform private.fail('ATTEMPTS_EXHAUSTED', 'Tentativas esgotadas.'); end if;
  update public.wheel_queue q set status = 'waiting', released_at = null where q.status = 'active' and q.id <> p_queue_id;
  update public.wheel_queue q set status = 'active', released_at = pg_catalog.now()
   where q.id = p_queue_id and q.status = 'waiting' returning q.* into v_row;
  if not found then perform private.fail('QUEUE_NOT_WAITING', 'Só entradas em espera podem ser liberadas.'); end if;
  perform private.notify(v_row.profile_id, 'wheel', 'Sua vez na roleta!', 'Gire a ' || v_wheel.name || ' agora.', jsonb_build_object('queue_id', p_queue_id));
  return v_row;
end $$;

-- monta o retorno de um sorteio (spin_wheel / spin_wheel_free)
create or replace function private.spin_payload(p_wheel public.wheels, p_prize public.wheel_prizes, p_resolved public.wheel_prizes)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_index int;
  v_count int;
begin
  select count(*) filter (where p.sort_order < p_prize.sort_order or (p.sort_order = p_prize.sort_order and p.id < p_prize.id)), count(*)
    into v_index, v_count
  from public.wheel_prizes p where p.wheel_id = p_wheel.id and p.is_active and p.deleted_at is null;
  return jsonb_build_object(
    'wheel_kind', p_wheel.kind,
    'prize', jsonb_build_object('id', p_prize.id, 'label', p_prize.label, 'kind', p_prize.kind, 'value', p_prize.value, 'sort_order', p_prize.sort_order),
    'resolved_prize', jsonb_build_object('id', p_resolved.id, 'label', p_resolved.label, 'kind', p_resolved.kind, 'value', p_resolved.value),
    'sector_index', v_index, 'sector_count', v_count, 'prizes_hash', private.prizes_hash(p_wheel.id));
end $$;

create or replace function public.spin_wheel(p_queue_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_queue public.wheel_queue;
  v_wheel public.wheels;
  v_prize public.wheel_prizes;
  v_resolved public.wheel_prizes;
  v_rand bigint;
  v_draw record;
  v_spin public.wheel_spins;
  v_avatar text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('wheel_turn'));
  select * into v_queue from public.wheel_queue q where q.id = p_queue_id for update;
  if not found then perform private.fail('QUEUE_NOT_FOUND', 'Entrada da fila não encontrada.'); end if;
  if not (public.is_admin() or (public.is_active_member() and v_queue.profile_id is not distinct from (select auth.uid()))) then
    raise exception using message = 'NOT_ALLOWED', detail = 'Você não pode executar esta ação.', errcode = '42501';
  end if;
  if v_queue.status <> 'active' then perform private.fail('NO_ACTIVE_TURN', 'Não há vez liberada.'); end if;
  select * into v_wheel from public.wheels w where w.id = v_queue.wheel_id;
  if not v_wheel.is_active then perform private.fail('WHEEL_INACTIVE', 'Esta roleta está desativada.'); end if;
  if v_queue.attempts_used >= v_queue.attempts_allowed then perform private.fail('ATTEMPTS_EXHAUSTED', 'Tentativas esgotadas.'); end if;
  if exists (select 1 from public.wheel_spins s where s.queue_id = p_queue_id and s.status = 'pending') then
    perform private.fail('SPIN_PENDING', 'Há um prêmio aguardando aprovação.');
  end if;

  select d.* into v_draw from private.draw_prize(v_wheel.id, '{}'::public.prize_kind[]) d;
  v_prize := v_draw.prize; v_rand := v_draw.random_value;
  if v_prize.kind = 'mystery' then
    select d.* into v_draw from private.draw_prize(v_wheel.id, array['mystery', 'extra_spin']::public.prize_kind[]) d;
    v_resolved := v_draw.prize;
  else
    v_resolved := v_prize;
  end if;

  insert into public.wheel_spins (queue_id, profile_id, person_name, wheel_id, attempt_index, prize_id, prize_label, prize_kind, prize_value,
                                  resolved_prize_id, resolved_label, resolved_kind, resolved_value, random_value, prizes_hash, status, spun_by)
  values (p_queue_id, v_queue.profile_id, v_queue.person_name, v_wheel.id, v_queue.attempts_used + 1, v_prize.id, v_prize.label, v_prize.kind, v_prize.value,
          v_resolved.id, v_resolved.label, v_resolved.kind, v_resolved.value, v_rand, private.prizes_hash(v_wheel.id), 'pending', (select auth.uid()))
  returning * into v_spin;
  select p.avatar_path into v_avatar from public.profiles p where p.id = v_queue.profile_id;

  return jsonb_build_object('spin_id', v_spin.id, 'queue_id', p_queue_id, 'person_name', v_queue.person_name, 'profile_id', v_queue.profile_id,
                            'avatar_path', v_avatar, 'attempt_index', v_spin.attempt_index, 'attempts_allowed', v_queue.attempts_allowed)
         || private.spin_payload(v_wheel, v_prize, v_resolved);
end $$;

create or replace function public.spin_wheel_free(p_wheel_kind public.wheel_kind)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_wheel public.wheels;
  v_prize public.wheel_prizes;
  v_resolved public.wheel_prizes;
  v_draw record;
begin
  perform private.assert_active_member();
  select * into v_wheel from public.wheels w where w.kind = p_wheel_kind;
  if not found or not v_wheel.is_active then perform private.fail('WHEEL_INACTIVE', 'Esta roleta está desativada.'); end if;
  select d.* into v_draw from private.draw_prize(v_wheel.id, '{}'::public.prize_kind[]) d;
  v_prize := v_draw.prize;
  if v_prize.kind = 'mystery' then
    select d.* into v_draw from private.draw_prize(v_wheel.id, array['mystery', 'extra_spin']::public.prize_kind[]) d;
    v_resolved := v_draw.prize;
  else
    v_resolved := v_prize;
  end if;
  return jsonb_build_object('is_free', true) || private.spin_payload(v_wheel, v_prize, v_resolved);
end $$;

create or replace function public.approve_spin(p_spin_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_spin public.wheel_spins;
  v_queue public.wheel_queue;
  v_wheel public.wheels;
  v_status public.profile_status;
  v_entry public.point_entries;
  v_redemption_id uuid;
  v_boost_id uuid;
  v_credited boolean := false;
  v_notes text := null;
begin
  perform private.assert_admin();
  select * into v_spin from public.wheel_spins s where s.id = p_spin_id;
  if not found then perform private.fail('SPIN_NOT_FOUND', 'Giro não encontrado.'); end if;
  if v_spin.profile_id is not null then
    select p.status into v_status from public.profiles p where p.id = v_spin.profile_id;
    if v_status is distinct from 'active' then perform private.fail('PROFILE_INACTIVE', 'Este perfil está inativo.'); end if;
  end if;
  update public.wheel_spins s set status = 'approved', approved_by = (select auth.uid()), approved_at = pg_catalog.now()
   where s.id = p_spin_id and s.status = 'pending' returning s.* into v_spin;
  if not found then perform private.fail('SPIN_NOT_PENDING', 'Este giro já foi processado.'); end if;
  select * into v_queue from public.wheel_queue q where q.id = v_spin.queue_id for update;
  select * into v_wheel from public.wheels w where w.id = v_spin.wheel_id;

  if v_spin.resolved_kind = 'points' then
    if v_spin.profile_id is not null then
      v_entry := private.insert_entry(v_spin.profile_id, 'wheel', null, v_spin.resolved_value::int, 0, 'Roleta: ' || v_spin.resolved_label, pg_catalog.now(), (select auth.uid()));
      v_credited := true;
    end if;
  elsif v_spin.resolved_kind = 'coins' then
    if v_spin.profile_id is not null then
      v_entry := private.insert_entry(v_spin.profile_id, 'wheel', null, 0, v_spin.resolved_value::int, 'Roleta: ' || v_spin.resolved_label, pg_catalog.now(), (select auth.uid()));
      v_credited := true;
    end if;
  elsif v_spin.resolved_kind in ('cash', 'voucher') then
    insert into public.reward_redemptions (source, spin_id, profile_id, person_name, title, cost_coins, value_amount, status, handled_by, handled_at)
    values ('wheel', p_spin_id, v_spin.profile_id, v_spin.person_name, v_spin.resolved_label, 0, v_spin.resolved_value, 'approved', (select auth.uid()), pg_catalog.now())
    returning id into v_redemption_id;
    v_credited := true;
  elsif v_spin.resolved_kind = 'extra_spin' then
    if v_queue.attempts_allowed >= 20 then
      v_credited := false; v_notes := 'extra_spin não creditado: limite de 20 tentativas';
    else
      update public.wheel_queue q set attempts_allowed = least(q.attempts_allowed + 1, 20) where q.id = v_queue.id;
      v_credited := true;
    end if;
  elsif v_spin.resolved_kind = 'multiplier' then
    if v_spin.profile_id is not null then
      insert into public.profile_boosts (profile_id, multiplier, starts_at, expires_at, spin_id)
      values (v_spin.profile_id, v_spin.resolved_value, pg_catalog.now(), pg_catalog.now() + interval '24 hours', p_spin_id)
      returning id into v_boost_id;
      v_credited := true;
    end if;
  else
    v_credited := false; -- custom: só histórico
  end if;

  update public.wheel_spins s
     set entry_id = coalesce(v_entry.id, s.entry_id), redemption_id = coalesce(v_redemption_id, s.redemption_id),
         boost_id = coalesce(v_boost_id, s.boost_id), credited = v_credited
   where s.id = p_spin_id returning s.* into v_spin;

  update public.wheel_queue q
     set attempts_used = q.attempts_used + 1,
         status = case when q.attempts_used + 1 >= q.attempts_allowed then 'done'::public.queue_status else q.status end,
         finished_at = case when q.attempts_used + 1 >= q.attempts_allowed then pg_catalog.now() else q.finished_at end
   where q.id = v_queue.id returning q.* into v_queue;

  if v_spin.profile_id is not null then
    perform private.push_feed('wheel_prize', v_spin.profile_id, public.active_season_id(),
      jsonb_build_object('label', v_spin.resolved_label, 'kind', v_spin.resolved_kind, 'wheel_kind', v_wheel.kind), 'wheel:' || p_spin_id::text, pg_catalog.now());
    perform private.notify(v_spin.profile_id, 'wheel', 'Prêmio aprovado', v_spin.resolved_label, jsonb_build_object('spin_id', p_spin_id));
  end if;
  perform private.audit('rpc', 'approve_spin', p_spin_id::text, null,
    jsonb_build_object('resolved_kind', v_spin.resolved_kind, 'credited', v_credited, 'notes', v_notes));

  return jsonb_build_object(
    'spin', jsonb_build_object('id', v_spin.id, 'status', v_spin.status, 'credited', v_spin.credited, 'entry_id', v_spin.entry_id,
                               'redemption_id', v_spin.redemption_id, 'boost_id', v_spin.boost_id),
    'queue', jsonb_build_object('id', v_queue.id, 'status', v_queue.status, 'attempts_used', v_queue.attempts_used, 'attempts_allowed', v_queue.attempts_allowed));
end $$;

create or replace function public.reject_spin(p_spin_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_spin public.wheel_spins;
  v_queue public.wheel_queue;
begin
  perform private.assert_admin();
  if not exists (select 1 from public.wheel_spins s where s.id = p_spin_id) then perform private.fail('SPIN_NOT_FOUND', 'Giro não encontrado.'); end if;
  update public.wheel_spins s set status = 'rejected', approved_by = (select auth.uid()), approved_at = pg_catalog.now()
   where s.id = p_spin_id and s.status = 'pending' returning s.* into v_spin;
  if not found then perform private.fail('SPIN_NOT_PENDING', 'Este giro já foi processado.'); end if;
  select * into v_queue from public.wheel_queue q where q.id = v_spin.queue_id;
  perform private.audit('rpc', 'reject_spin', p_spin_id::text, null, jsonb_build_object('queue_id', v_spin.queue_id));
  return jsonb_build_object(
    'spin', jsonb_build_object('id', v_spin.id, 'status', v_spin.status, 'credited', v_spin.credited, 'entry_id', v_spin.entry_id,
                               'redemption_id', v_spin.redemption_id, 'boost_id', v_spin.boost_id),
    'queue', jsonb_build_object('id', v_queue.id, 'status', v_queue.status, 'attempts_used', v_queue.attempts_used, 'attempts_allowed', v_queue.attempts_allowed));
end $$;

create or replace function public.save_wheel_prizes(p_wheel_kind public.wheel_kind, p_prizes jsonb)
returns setof public.wheel_prizes language plpgsql security definer set search_path = ''
as $$
declare
  v_wheel public.wheels;
  v_item jsonb;
  v_id uuid;
  v_keep uuid[] := '{}';
  v_sort int;
begin
  perform private.assert_admin();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('wheel_turn'));
  select * into v_wheel from public.wheels w where w.kind = p_wheel_kind;
  if not found then perform private.fail('WHEEL_INACTIVE', 'Esta roleta está desativada.'); end if;
  if exists (select 1 from public.wheel_spins s where s.wheel_id = v_wheel.id and s.status = 'pending') then
    perform private.fail('SPIN_PENDING', 'Há um prêmio aguardando aprovação.');
  end if;
  if p_prizes is null or jsonb_typeof(p_prizes) <> 'array' then
    perform private.fail('SORT_ORDER_DUPLICATE', 'Há prêmios com a mesma posição.');
  end if;
  -- SQL fixer r2: cada item precisa ser objeto com sort_order inteiro >= 0 — a fase 1 usa o espaço negativo
  -- (-1 - sort_order) como área temporária, e um sort_order negativo na entrada colidiria com ele (23505 cru).
  if exists (
    select 1 from jsonb_array_elements(p_prizes) x
    where jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'sort_order') <> 'number' or (x ->> 'sort_order')::numeric < 0
       or (x ->> 'sort_order')::numeric <> floor((x ->> 'sort_order')::numeric)
  ) then
    perform private.fail('INVALID_ARGUMENT', 'Valor inválido (sort_order): informe a posição de cada prêmio como inteiro a partir de 0.');
  end if;
  if (select count(*) from jsonb_array_elements(p_prizes) x) <> (select count(distinct (x ->> 'sort_order')::int) from jsonb_array_elements(p_prizes) x) then
    perform private.fail('SORT_ORDER_DUPLICATE', 'Há prêmios com a mesma posição.');
  end if;

  -- fase 1: espaço negativo temporário
  update public.wheel_prizes p set sort_order = -1 - p.sort_order where p.wheel_id = v_wheel.id and p.deleted_at is null;

  -- fase 2: upsert dos presentes
  for v_item in select x from jsonb_array_elements(p_prizes) x loop
    v_id := (v_item ->> 'id')::uuid;
    v_sort := (v_item ->> 'sort_order')::int;
    if v_id is not null and exists (select 1 from public.wheel_prizes p where p.id = v_id and p.wheel_id = v_wheel.id and p.deleted_at is null) then
      update public.wheel_prizes p set
        label = coalesce(v_item ->> 'label', p.label),
        kind = coalesce((v_item ->> 'kind')::public.prize_kind, p.kind),
        value = case when v_item ? 'value' then (v_item ->> 'value')::numeric else p.value end,
        weight = coalesce((v_item ->> 'weight')::int, p.weight),
        color = case when v_item ? 'color' then v_item ->> 'color' else p.color end,
        sort_order = v_sort,
        is_active = coalesce((v_item ->> 'is_active')::boolean, p.is_active)
      where p.id = v_id;
      v_keep := v_keep || v_id;
    else
      insert into public.wheel_prizes (wheel_id, label, kind, value, weight, color, sort_order, is_active)
      values (v_wheel.id, v_item ->> 'label', (v_item ->> 'kind')::public.prize_kind, (v_item ->> 'value')::numeric,
              coalesce((v_item ->> 'weight')::int, 1), v_item ->> 'color', v_sort, coalesce((v_item ->> 'is_active')::boolean, true))
      returning id into v_id;
      v_keep := v_keep || v_id;
    end if;
  end loop;

  -- ausentes da lista → soft delete (saem do índice parcial)
  update public.wheel_prizes p set deleted_at = pg_catalog.now(), is_active = false, sort_order = -1 - p.sort_order
   where p.wheel_id = v_wheel.id and p.deleted_at is null and not (p.id = any (v_keep));

  perform private.audit('rpc', 'save_wheel_prizes', v_wheel.id::text, null, p_prizes);
  return query select p.* from public.wheel_prizes p where p.wheel_id = v_wheel.id and p.deleted_at is null and p.is_active order by p.sort_order, p.id;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

-- =============================================================================
-- 7.7 Recompensas
-- =============================================================================
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reward public.rewards;
  v_balance int;
  v_entry public.point_entries;
  v_redemption_id uuid;
  v_name text;
begin
  perform private.assert_active_member();
  perform private.lock_profile(v_uid, 'wallet');
  select * into v_reward from public.rewards r where r.id = p_reward_id and r.is_active and r.deleted_at is null for update;
  if not found then perform private.fail('REWARD_UNAVAILABLE', 'Recompensa indisponível.'); end if;
  select coalesce(sum(e.coins), 0)::int into v_balance from public.point_entries e where e.profile_id = v_uid;
  if v_balance < v_reward.cost_coins then
    perform private.fail('INSUFFICIENT_COINS', 'Moedas insuficientes (faltam ' || (v_reward.cost_coins - v_balance) || ').');
  end if;
  if v_reward.stock is not null then
    update public.rewards r set stock = r.stock - 1 where r.id = p_reward_id and r.stock > 0;
    if not found then perform private.fail('OUT_OF_STOCK', 'Recompensa esgotada.'); end if;
  end if;
  v_entry := private.insert_entry(v_uid, 'reward', null, 0, -v_reward.cost_coins, 'Resgate: ' || v_reward.name, pg_catalog.now(), v_uid);
  select p.full_name into v_name from public.profiles p where p.id = v_uid;
  insert into public.reward_redemptions (source, reward_id, profile_id, person_name, title, cost_coins, value_amount, status, entry_id)
  values ('store', p_reward_id, v_uid, v_name, v_reward.name, v_reward.cost_coins, v_reward.value_amount, 'requested', v_entry.id)
  returning id into v_redemption_id;
  perform private.notify_admins('reward', 'Novo pedido de resgate', v_name || ' resgatou ' || v_reward.name || '.',
    jsonb_build_object('redemption_id', v_redemption_id, 'profile_id', v_uid));
  perform private.audit('rpc', 'redeem_reward', v_redemption_id::text, null, jsonb_build_object('reward_id', p_reward_id, 'cost_coins', v_reward.cost_coins));
  return jsonb_build_object('redemption_id', v_redemption_id, 'coins_balance', v_balance - v_reward.cost_coins);
end $$;

create or replace function public.handle_redemption(p_redemption_id uuid, p_action text, p_notes text default null)
returns public.reward_redemptions language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.reward_redemptions;
  v_new public.redemption_status;
  v_refund public.point_entries;
begin
  perform private.assert_admin();
  if p_action is null or p_action not in ('approve', 'deliver', 'cancel') then perform private.fail('ACTION_INVALID', 'Ação inválida.'); end if;
  select * into v_row from public.reward_redemptions r where r.id = p_redemption_id for update;
  if not found then perform private.fail('REDEMPTION_NOT_FOUND', 'Pedido de resgate não encontrado.'); end if;
  if p_action = 'approve' and v_row.status = 'requested' then v_new := 'approved';
  elsif p_action = 'deliver' and v_row.status in ('requested', 'approved') then v_new := 'delivered';
  elsif p_action = 'cancel' and v_row.status in ('requested', 'approved') then v_new := 'cancelled';
  else perform private.fail('REDEMPTION_TRANSITION_INVALID', 'Transição de status não permitida.');
  end if;

  if v_new = 'cancelled' and v_row.source = 'store' then
    perform private.lock_profile(v_row.profile_id, 'wallet');
    v_refund := private.insert_entry(v_row.profile_id, 'reward', null, 0, 0, coalesce(nullif(trim(p_notes), ''), 'Resgate cancelado'),
                                     null, (select auth.uid()), null, 1, null, v_row.entry_id);
    update public.rewards r set stock = r.stock + 1 where r.id = v_row.reward_id and r.stock is not null;
  end if;

  update public.reward_redemptions r
     set status = v_new, handled_by = (select auth.uid()), handled_at = pg_catalog.now(),
         notes = coalesce(nullif(trim(p_notes), ''), r.notes),
         refund_entry_id = coalesce(v_refund.id, r.refund_entry_id)
   where r.id = p_redemption_id returning r.* into v_row;

  perform private.notify(v_row.profile_id, 'reward',
    case v_new when 'approved' then 'Resgate aprovado' when 'delivered' then 'Recompensa entregue' else 'Resgate cancelado' end,
    v_row.title || coalesce(' — ' || nullif(trim(p_notes), ''), ''), jsonb_build_object('redemption_id', p_redemption_id, 'status', v_new));
  perform private.audit('rpc', 'handle_redemption', p_redemption_id::text, null, jsonb_build_object('action', p_action, 'notes', p_notes, 'status', v_new));
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- DECISIONS.md (SQL fixer r2): nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

-- =============================================================================
-- 7.8 Notificações
-- =============================================================================
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = ''
as $$
declare
  v_n int;
begin
  perform private.assert_active_member();
  update public.notifications n set is_read = true
   where n.profile_id = (select auth.uid()) and not n.is_read and (p_ids is null or n.id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- =============================================================================
-- 7.9 Grants (repetidos na varredura final de 0011)
-- =============================================================================
revoke all on all functions in schema private from public, anon, authenticated;
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
    if f.proname in ('signup_mode', 'validate_team_code') then
      execute format('grant execute on function %s to anon', f.sig);
    end if;
  end loop;
end $$;
