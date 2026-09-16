-- 0006 — helpers (DATA-MODEL §6.1–6.3).
-- Todas: security definer, set search_path = '', owner postgres, nomes totalmente qualificados.
-- Helpers de public marcados (auth) recebem grant execute to authenticated (repetido na varredura de 0011).
-- Helpers de private nunca recebem EXECUTE para anon/authenticated/public (chamados por trigger/definer).

-- =============================================================================
-- 6.1 Helpers de papel e tempo (public)
-- =============================================================================

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'
  );
$$;

create or replace function public.active_season_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select s.id from public.seasons s where s.is_active limit 1;
$$;

create or replace function public.app_timezone()
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce((select s.timezone from public.app_settings s where s.id = 1), 'America/Sao_Paulo');
$$;

create or replace function public.local_day(ts timestamptz)
returns date language sql stable security definer set search_path = ''
as $$
  select (ts at time zone public.app_timezone())::date;
$$;

create or replace function public.local_today()
returns date language sql stable security definer set search_path = ''
as $$
  select public.local_day(pg_catalog.now());
$$;

create or replace function public.iso_week_key(d date)
returns text language sql immutable security definer set search_path = ''
as $$
  select pg_catalog.to_char(d, 'IYYY-"W"IW');
$$;

-- Usada pela policy de INSERT do Storage (roda como o invocador): conta objetos da pasta.
create or replace function public.avatar_count(p_uid uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = p_uid::text;
$$;

-- Período de conclusão de uma missão para o instante p_ts (0 linhas fora da janela).
create or replace function public.mission_period(
  p_kind public.mission_kind, p_ts timestamptz, p_starts timestamptz, p_ends timestamptz
)
returns table (period_key text, period_start timestamptz, period_end timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text := public.app_timezone();
  v_day date;
  v_week_start date;
begin
  if p_ts is null or p_ts < p_starts or p_ts >= p_ends then
    return;
  end if;
  if p_kind = 'daily' then
    v_day := public.local_day(p_ts);
    return query select v_day::text,
      greatest((v_day::timestamp) at time zone v_tz, p_starts),
      least(((v_day + 1)::timestamp) at time zone v_tz, p_ends);
  elsif p_kind = 'weekly' then
    v_day := public.local_day(p_ts);
    v_week_start := pg_catalog.date_trunc('week', v_day::timestamp)::date;
    return query select public.iso_week_key(v_day),
      greatest((v_week_start::timestamp) at time zone v_tz, p_starts),
      least(((v_week_start + 7)::timestamp) at time zone v_tz, p_ends);
  else
    return query select 'once'::text, p_starts, p_ends;
  end if;
end $$;

-- =============================================================================
-- 6.2 Helpers de private
-- =============================================================================

create or replace function private.season_for(ts timestamptz)
returns uuid language sql stable security definer set search_path = ''
as $$
  select s.id from public.seasons s where ts >= s.starts_at and ts < s.ends_at limit 1;
$$;

-- Critério único de "entrada de atividade" (streak, last_entry_at) — §4.9, B.16
create or replace function private.counts_for_streak(e public.point_entries)
returns boolean language sql stable security definer set search_path = ''
as $$
  select e.reverses_entry_id is null
    and not exists (select 1 from public.point_entries r where r.reverses_entry_id = e.id)
    and (e.source = 'rule' or (e.source = 'manual' and e.points > 0));
$$;

create or replace function private.lock_profile(p_profile_id uuid, p_scope text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_scope || ':' || p_profile_id::text));
end $$;

create or replace function private.audit(p_action public.audit_action, p_table text, p_row_id text, p_old jsonb, p_new jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, table_name, row_id, old_data, new_data)
  values ((select auth.uid()), p_action, p_table, p_row_id, p_old, p_new);
end $$;

create or replace function private.push_feed(
  p_kind public.feed_kind, p_profile_id uuid, p_season_id uuid, p_payload jsonb, p_dedupe_key text,
  p_occurred_at timestamptz default pg_catalog.now()
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.feed_events (kind, profile_id, season_id, payload, dedupe_key, occurred_at)
  values (p_kind, p_profile_id, p_season_id, coalesce(p_payload, '{}'::jsonb), p_dedupe_key, coalesce(p_occurred_at, pg_catalog.now()))
  on conflict (dedupe_key) do nothing;
end $$;

-- Notificação individual: só perfil ativo e respeitando preferences.
create or replace function private.notify(
  p_profile_id uuid, p_kind public.notification_kind, p_title text, p_message text, p_payload jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if p_profile_id is null then return; end if;
  select * into v_profile from public.profiles where id = p_profile_id;
  if not found or v_profile.status <> 'active' then return; end if;
  if (v_profile.preferences ->> 'notifications') is not distinct from 'false' then return; end if;
  if p_kind = 'event' and (v_profile.preferences ->> 'event_alerts') is not distinct from 'false' then return; end if;
  insert into public.notifications (profile_id, kind, title, message, payload)
  values (p_profile_id, p_kind, left(p_title, 80), left(coalesce(p_message, ''), 300), coalesce(p_payload, '{}'::jsonb));
end $$;

create or replace function private.notify_all(
  p_kind public.notification_kind, p_title text, p_message text, p_payload jsonb default '{}'::jsonb, p_exclude uuid default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select p.id from public.profiles p where p.status = 'active' and (p_exclude is null or p.id <> p_exclude) loop
    perform private.notify(v_id, p_kind, p_title, p_message, p_payload);
  end loop;
end $$;

create or replace function private.notify_admins(
  p_kind public.notification_kind, p_title text, p_message text, p_payload jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select p.id from public.profiles p where p.role = 'admin' and p.status = 'active' loop
    perform private.notify(v_id, p_kind, p_title, p_message, p_payload);
  end loop;
end $$;

-- Checagem de chamador das RPCs de membro: PROFILE_PENDING / PROFILE_INACTIVE / PROFILE_NOT_FOUND
create or replace function private.assert_active_member()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.profile_status;
begin
  if (select auth.uid()) is null then
    raise exception using message = 'NOT_AUTHENTICATED', detail = 'Faça login para continuar.', errcode = '42501';
  end if;
  if public.is_active_member() then return; end if;
  select p.status into v_status from public.profiles p where p.id = (select auth.uid());
  if not found then
    raise exception using message = 'PROFILE_NOT_FOUND', detail = 'Perfil não encontrado.', errcode = '42501';
  end if;
  if v_status = 'pending' then
    raise exception using message = 'PROFILE_PENDING', detail = 'Seu cadastro está aguardando aprovação do gestor.', errcode = '42501';
  end if;
  raise exception using message = 'PROFILE_INACTIVE', detail = 'Este perfil está inativo.', errcode = '42501';
end $$;

-- Wrapper interno para inserir no ledger com created_by explícito (triggers/RPCs).
create or replace function private.insert_entry(
  p_profile_id uuid,
  p_source public.entry_source,
  p_metric public.metric_type,
  p_base_points int,
  p_coins int,
  p_reason text,
  p_occurred_at timestamptz,
  p_created_by uuid,
  p_amount numeric default null,
  p_quantity int default 1,
  p_rule_id uuid default null,
  p_reverses_entry_id uuid default null
)
returns public.point_entries language plpgsql security definer set search_path = ''
as $$
declare
  v_entry public.point_entries;
begin
  insert into public.point_entries (profile_id, source, metric, base_points, points, coins, reason, occurred_at, created_by, amount, quantity, rule_id, reverses_entry_id)
  values (p_profile_id, p_source, p_metric, coalesce(p_base_points, 0), coalesce(p_base_points, 0), coalesce(p_coins, 0), p_reason,
          coalesce(p_occurred_at, pg_catalog.now()), p_created_by, p_amount, coalesce(p_quantity, 1), p_rule_id, p_reverses_entry_id)
  returning * into v_entry;
  return v_entry;
end $$;

-- Recalcula streak pela técnica de ilhas sobre os dias locais com entrada de atividade.
create or replace function private.recompute_streak(p_profile_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_streak int := 0;
  v_last date := null;
  v_best int := 0;
begin
  with days as (
    select distinct public.local_day(e.occurred_at) as d
    from public.point_entries e
    where e.profile_id = p_profile_id and private.counts_for_streak(e)
  ), islands as (
    select d, d - (row_number() over (order by d))::int as grp from days
  ), runs as (
    select grp, count(*)::int as len, max(d) as last_day from islands group by grp
  )
  select coalesce(max(len), 0),
         (select r2.len from runs r2 order by r2.last_day desc limit 1),
         (select r2.last_day from runs r2 order by r2.last_day desc limit 1)
    into v_best, v_streak, v_last
  from runs;

  update public.profile_lifetime_stats
     set streak_days = coalesce(v_streak, 0),
         streak_last_day = v_last,
         -- §6.2: best = max(ilhas) do ledger (não greatest com o valor antigo), para recompute_stats corrigir drift
         best_streak_days = coalesce(v_best, 0),
         updated_at = pg_catalog.now()
   where profile_id = p_profile_id;
end $$;

-- Concede conquista (idempotente); paga a recompensa; feed; notificação. Devolve o id ou NULL.
create or replace function private.grant_achievement(
  p_profile_id uuid, p_achievement_id uuid, p_season_id uuid, p_trigger_entry_id uuid, p_occurred_at timestamptz
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_ach public.achievements;
  v_id uuid;
  v_entry public.point_entries;
begin
  select * into v_ach from public.achievements where id = p_achievement_id;
  if not found then return null; end if;

  insert into public.profile_achievements (profile_id, achievement_id, season_id, trigger_entry_id, unlocked_at)
  values (p_profile_id, p_achievement_id, case when v_ach.scope = 'season' then p_season_id else null end, p_trigger_entry_id, pg_catalog.now())
  on conflict do nothing
  returning id into v_id;
  if v_id is null then return null; end if;

  if v_ach.reward_points > 0 or v_ach.reward_coins > 0 then
    v_entry := private.insert_entry(p_profile_id, 'achievement', null, v_ach.reward_points, v_ach.reward_coins, v_ach.title,
                                    coalesce(p_occurred_at, pg_catalog.now()), (select auth.uid()));
    update public.profile_achievements set entry_id = v_entry.id where id = v_id;
  end if;

  perform private.push_feed('achievement', p_profile_id, coalesce(p_season_id, private.season_for(coalesce(p_occurred_at, pg_catalog.now()))),
    jsonb_build_object('code', v_ach.code, 'title', v_ach.title, 'icon', v_ach.icon),
    'achievement:' || v_id::text, coalesce(p_occurred_at, pg_catalog.now()));
  perform private.notify(p_profile_id, 'achievement', 'Conquista desbloqueada', v_ach.title,
    jsonb_build_object('achievement_id', p_achievement_id, 'profile_achievement_id', v_id));
  return v_id;
end $$;

-- Mínimo de prêmios de uma roleta ativa (núcleo dos constraint triggers).
create or replace function private.assert_wheel_prizes(p_wheel_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_active boolean;
  v_count int;
  v_pool int;
begin
  select w.is_active into v_active from public.wheels w where w.id = p_wheel_id;
  if not coalesce(v_active, false) then return; end if;
  select count(*), count(*) filter (where kind not in ('mystery', 'extra_spin'))
    into v_count, v_pool
  from public.wheel_prizes p where p.wheel_id = p_wheel_id and p.is_active and p.deleted_at is null;
  if v_count < 2 then
    raise exception using message = 'MIN_PRIZES', detail = 'Cada roleta precisa de ao menos 2 prêmios ativos.', errcode = 'P0001';
  end if;
  if v_pool < 1 then
    raise exception using message = 'MYSTERY_NEEDS_POOL', detail = 'A roleta precisa de um prêmio comum além de Mystery/Giro extra.', errcode = 'P0001';
  end if;
end $$;

-- Delta que uma entry soma num desafio (§4.18); 0 se não se aplica.
-- DECISIONS.md (SQL fixer r2): stable (não immutable) — para métrica 'activities' o estorno (source 'system', §7.4)
-- precisa olhar a source da original para decrementar o que ela somou.
create or replace function private.challenge_value(p_metric public.challenge_metric, p_entry public.point_entries)
returns numeric language plpgsql stable security definer set search_path = ''
as $$
declare
  v_sign int;
  v_src public.entry_source := p_entry.source;
begin
  if p_entry.source = 'reward' then return 0; end if;
  v_sign := case when p_entry.points < 0 then -1 when p_entry.points > 0 then 1
                 when p_entry.reverses_entry_id is not null then -1 else 1 end;
  if p_metric = 'points' then
    return p_entry.points;
  end if;
  if p_entry.source not in ('rule', 'manual', 'system') then return 0; end if;
  if p_metric = 'meetings_held' then
    return case when p_entry.metric = 'meeting_held' then p_entry.quantity * v_sign else 0 end;
  elsif p_metric = 'sales_count' then
    return case when p_entry.metric = 'sale' then p_entry.quantity * v_sign else 0 end;
  elsif p_metric = 'revenue' then
    return case when p_entry.metric in ('sale', 'upsell') then coalesce(p_entry.amount, 0) else 0 end;
  elsif p_metric = 'activities' then
    if p_entry.reverses_entry_id is not null then
      select o.source into v_src from public.point_entries o where o.id = p_entry.reverses_entry_id;
    end if;
    return case when v_src in ('rule', 'manual')
                 and (p_entry.metric is null or p_entry.metric not in ('amount_step', 'weekly_goal', 'monthly_goal', 'custom'))
                then p_entry.quantity * v_sign else 0 end;
  end if;
  return 0;
end $$;

-- CSPRNG (pgcrypto) uniforme em [0, p_n)
create or replace function private.rand_below(p_n bigint)
returns bigint language sql volatile security definer set search_path = ''
as $$
  select ((('x' || pg_catalog.encode(extensions.gen_random_bytes(8), 'hex'))::bit(64)::bigint & 9223372036854775807) % p_n);
$$;

-- Sorteio ponderado; soma de pesos 0 → NO_PRIZES.
create or replace function private.draw_prize(p_wheel_id uuid, p_exclude_kinds public.prize_kind[])
returns table (prize public.wheel_prizes, random_value bigint)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_total bigint;
  v_r bigint;
  v_acc bigint := 0;
  v_p public.wheel_prizes;
begin
  select coalesce(sum(p.weight), 0) into v_total
  from public.wheel_prizes p
  where p.wheel_id = p_wheel_id and p.is_active and p.deleted_at is null
    and (p_exclude_kinds is null or not (p.kind = any (p_exclude_kinds)));
  if v_total <= 0 then
    raise exception using message = 'NO_PRIZES', detail = 'A roleta está sem prêmios ativos.', errcode = 'P0001';
  end if;
  v_r := private.rand_below(v_total);
  for v_p in
    select p.* from public.wheel_prizes p
    where p.wheel_id = p_wheel_id and p.is_active and p.deleted_at is null
      and (p_exclude_kinds is null or not (p.kind = any (p_exclude_kinds)))
    order by p.sort_order, p.id
  loop
    v_acc := v_acc + v_p.weight;
    if v_r < v_acc then
      prize := v_p; random_value := v_r;
      return next;
      return;
    end if;
  end loop;
  raise exception using message = 'NO_PRIZES', detail = 'A roleta está sem prêmios ativos.', errcode = 'P0001';
end $$;

create or replace function private.prizes_hash(p_wheel_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select pg_catalog.md5(coalesce(string_agg(
    p.id::text || ':' || p.sort_order || ':' || p.label || ':' || p.kind::text || ':' || coalesce(p.value::text, '') || ':' || coalesce(p.color, ''),
    ',' order by p.sort_order, p.id), ''))
  from public.wheel_prizes p
  where p.wheel_id = p_wheel_id and p.is_active and p.deleted_at is null;
$$;

-- =============================================================================
-- 6.3 Funções de trigger genéricas (private)
-- =============================================================================

create or replace function private.set_updated_at()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(NEW);
begin
  NEW.updated_at := pg_catalog.now();
  if v_row ? 'updated_by' then
    NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_by', coalesce((select auth.uid()), (v_row ->> 'updated_by')::uuid)));
    NEW.updated_at := pg_catalog.now();
  end if;
  return NEW;
end $$;

create or replace function private.stamp_actor()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  NEW.created_by := coalesce((select auth.uid()), NEW.created_by);
  return NEW;
end $$;

create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end;
  v_new jsonb := to_jsonb(NEW);
begin
  if TG_TABLE_NAME = 'app_secrets' then
    if v_old is not null and v_old ? 'team_code' then
      v_old := v_old || jsonb_build_object('team_code', '********' || right(v_old ->> 'team_code', 4));
    end if;
    if v_new ? 'team_code' then
      v_new := v_new || jsonb_build_object('team_code', '********' || right(v_new ->> 'team_code', 4));
    end if;
  end if;
  perform private.audit(case when TG_OP = 'INSERT' then 'insert'::public.audit_action else 'update'::public.audit_action end,
                        TG_TABLE_NAME, v_new ->> 'id', v_old, v_new);
  return NEW;
end $$;

create or replace function private.forbid_ledger_mutation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  raise exception using message = 'LEDGER_IMMUTABLE', detail = 'Lançamentos não podem ser alterados nem apagados; use um estorno.', errcode = '42501';
end $$;

create or replace function private.validate_timezone()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  begin
    perform pg_catalog.now() at time zone NEW.timezone;
  exception when others then
    raise exception using message = 'INVALID_TIMEZONE', detail = 'Fuso horário inválido.', errcode = 'P0001';
  end;
  if TG_OP = 'UPDATE' and NEW.timezone is distinct from OLD.timezone and exists (select 1 from public.point_entries) then
    raise exception using message = 'TIMEZONE_LOCKED', detail = 'O fuso só pode ser alterado antes do primeiro lançamento.', errcode = 'P0001';
  end if;
  return NEW;
end $$;

create or replace function private.protect_app_secrets()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if OLD.bootstrap_done and not NEW.bootstrap_done then
    raise exception using message = 'BOOTSTRAP_LOCKED', detail = 'O bootstrap da instalação não pode ser reaberto.', errcode = 'P0001';
  end if;
  if NEW.team_code is distinct from OLD.team_code and pg_catalog.current_setting('app.rpc', true) is distinct from 'on' then
    raise exception using message = 'TEAM_CODE_VIA_RPC_ONLY', detail = 'Use "Gerar novo código" para trocar o código da equipe.', errcode = 'P0001';
  end if;
  return NEW;
end $$;

-- grants dos helpers públicos (repetidos na varredura final de 0011)
revoke execute on function public.is_active_member() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.active_season_id() from public, anon;
revoke execute on function public.app_timezone() from public, anon;
revoke execute on function public.local_day(timestamptz) from public, anon;
revoke execute on function public.local_today() from public, anon;
revoke execute on function public.iso_week_key(date) from public, anon;
revoke execute on function public.avatar_count(uuid) from public, anon;
revoke execute on function public.mission_period(public.mission_kind, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.active_season_id() to authenticated;
grant execute on function public.app_timezone() to authenticated;
grant execute on function public.local_day(timestamptz) to authenticated;
grant execute on function public.local_today() to authenticated;
grant execute on function public.iso_week_key(date) to authenticated;
grant execute on function public.avatar_count(uuid) to authenticated;
grant execute on function public.mission_period(public.mission_kind, timestamptz, timestamptz, timestamptz) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
