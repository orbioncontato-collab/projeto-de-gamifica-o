-- =============================================================================
-- Orbion Sales League — schema completo do banco (Supabase / Postgres)
-- Arquivo GERADO por supabase/build-schema.mjs a partir de supabase/migrations/*.sql.
-- NÃO edite este arquivo à mão: altere a migration correspondente e rode
--   node supabase/build-schema.mjs
--
-- Como aplicar (instalação nova):
--   1. Abra o projeto no Supabase → SQL Editor → New query.
--   2. Cole este arquivo INTEIRO (ele começa com "begin;" e termina com "commit;")
--      e clique em Run. Tudo roda numa única transação: ou aplica por completo,
--      ou nada é gravado (um schema pela metade — sem a linha de app_secrets ou
--      sem RLS numa tabela — nunca pode existir).
--   3. Confira: select bootstrap_done, team_code from public.app_secrets;
--      deve devolver 1 linha com bootstrap_done = false.
--   4. IMEDIATAMENTE crie o primeiro gestor em Authentication → Users → Add user
--      → Create new user com "Auto confirm" marcado (DATA-MODEL §16.1), ANTES de
--      publicar a URL do app. Só depois configure a Vercel.
--
-- O script é idempotente: pode ser executado de novo sobre um banco já instalado
-- (create ... if not exists, create or replace, drop ... if exists, seeds com
-- on conflict do nothing). O team_code e os dados existentes são preservados.
--
-- Ordem das migrations concatenadas (DATA-MODEL §15):
--    1. 20260915000001_extensions_schemas_grants.sql
--    2. 20260915000002_enums.sql
--    3. 20260915000003_tables_core.sql
--    4. 20260915000004_tables_catalog.sql
--    5. 20260915000005_tables_facts.sql
--    6. 20260915000006_helpers.sql
--    7. 20260915000007_trigger_functions.sql
--    8. 20260915000008_triggers.sql
--    9. 20260915000009_views.sql
--   10. 20260915000010_rpcs.sql
--   11. 20260915000011_rls.sql
--   12. 20260915000012_storage_realtime.sql
--   13. 20260915000013_seed.sql
--   14. 20260921000014_branding.sql
-- Gerado em: 2026-09-22T19:17:13.900Z
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- >>> 20260915000001_extensions_schemas_grants.sql
-- -----------------------------------------------------------------------------
-- 0001 — schemas, extensões e default privileges (DATA-MODEL §2.1–2.2)
-- Roda como postgres (owner de tudo). Idempotente.

create schema if not exists private;
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- private: só triggers e funções definer (owner postgres) chegam aqui.
revoke all on schema private from public, anon, authenticated;

-- Desfaz os default privileges do Supabase (grant all ... to anon, authenticated, service_role)
-- para o role postgres: toda tabela/view/função/sequence nova nasce SEM privilégio para
-- anon/authenticated; só os grants explícitos de 0011 valem. service_role mantém os defaults.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema private revoke all on functions from anon, authenticated, public;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated;

-- -----------------------------------------------------------------------------
-- >>> 20260915000002_enums.sql
-- -----------------------------------------------------------------------------
-- 0002 — enums (DATA-MODEL §3). Cada type guardado por "if not exists" em pg_type.

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'user_role') then
    create type public.user_role as enum ('admin', 'collaborator');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'profile_status') then
    create type public.profile_status as enum ('active', 'inactive', 'pending');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'job_title') then
    create type public.job_title as enum ('sdr', 'closer', 'social_seller', 'supervisor', 'manager');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'metric_type') then
    create type public.metric_type as enum ('sale', 'meeting_scheduled', 'meeting_held', 'call', 'crm_update', 'lead_recovery', 'upsell', 'amount_step', 'weekly_goal', 'monthly_goal', 'activity', 'custom');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'rule_trigger_kind') then
    create type public.rule_trigger_kind as enum ('manual', 'auto_amount_step', 'auto_goal');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'entry_source') then
    create type public.entry_source as enum ('rule', 'manual', 'system', 'mission', 'challenge', 'wheel', 'reward', 'achievement');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'mission_kind') then
    create type public.mission_kind as enum ('daily', 'weekly', 'special', 'lightning');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'mission_target_kind') then
    create type public.mission_target_kind as enum ('count', 'amount');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'mission_audience') then
    create type public.mission_audience as enum ('all', 'selected');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'challenge_kind') then
    create type public.challenge_kind as enum ('duel', 'team');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'challenge_metric') then
    create type public.challenge_metric as enum ('meetings_held', 'sales_count', 'revenue', 'points', 'activities');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'challenge_status') then
    create type public.challenge_status as enum ('draft', 'active', 'finished', 'cancelled');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'wheel_kind') then
    create type public.wheel_kind as enum ('classic', 'premium');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'prize_kind') then
    create type public.prize_kind as enum ('points', 'coins', 'cash', 'voucher', 'extra_spin', 'multiplier', 'mystery', 'custom');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'queue_status') then
    create type public.queue_status as enum ('waiting', 'active', 'done', 'removed');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'queue_source') then
    create type public.queue_source as enum ('manual', 'earned');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'spin_status') then
    create type public.spin_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'redemption_source') then
    create type public.redemption_source as enum ('store', 'wheel');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'redemption_status') then
    create type public.redemption_status as enum ('requested', 'approved', 'delivered', 'cancelled');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'achievement_criteria') then
    create type public.achievement_criteria as enum ('first_sale', 'streak_days', 'sales_total', 'monthly_goal', 'rank_first', 'points_total', 'missions_completed');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'achievement_scope') then
    create type public.achievement_scope as enum ('lifetime', 'season');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'feed_kind') then
    create type public.feed_kind as enum ('sale', 'achievement', 'wheel_prize', 'level_up', 'mission_completed', 'challenge_finished', 'season_closed');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'notification_kind') then
    create type public.notification_kind as enum ('ranking', 'mission', 'reward', 'wheel', 'challenge', 'achievement', 'level', 'event', 'season', 'system');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'audit_action') then
    create type public.audit_action as enum ('insert', 'update', 'delete', 'rpc');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- >>> 20260915000003_tables_core.sql
-- -----------------------------------------------------------------------------
-- 0003 — tabelas núcleo (DATA-MODEL §4.1–4.9, §4.31): sem dependência do ledger.
-- profiles vem primeiro porque quase tudo referencia profiles(id).

-- 4.6 profiles (1:1 com auth.users; nunca apagados)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(full_name) between 1 and 80),
  avatar_path text check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpe?g|png|webp)$'),
  color text not null default '#F97316' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  job_title public.job_title not null default 'sdr',
  team text check (team is null or length(team) <= 40),
  role public.user_role not null default 'collaborator',
  status public.profile_status not null default 'active',
  preferences jsonb not null default '{"notifications": true, "event_alerts": true}'::jsonb
    check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_admin_idx on public.profiles (role) where role = 'admin';

-- 4.1 app_settings (singleton público, sem segredos)
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'Orbion' check (length(company_name) between 1 and 80),
  xp_per_level int not null default 400 check (xp_per_level between 50 and 100000),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'America/Sao_Paulo',
  target_conversion_pct numeric(5,2) not null default 25 check (target_conversion_pct between 0 and 100),
  target_attendance_pct numeric(5,2) not null default 70 check (target_attendance_pct between 0 and 100),
  target_crm_pct numeric(5,2) not null default 95 check (target_crm_pct between 0 and 100),
  target_activities_count int not null default 1000 check (target_activities_count >= 0),
  streak_business_days_only boolean not null default false,
  rank_admins boolean not null default true,
  auto_approve_members boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- 4.2 app_secrets (singleton privado, só admin)
create table if not exists public.app_secrets (
  id int primary key default 1 check (id = 1),
  team_code text not null check (team_code ~ '^[A-Z0-9]{12}$'),
  team_code_rotated_at timestamptz not null default now(),
  bootstrap_email text check (bootstrap_email is null or bootstrap_email = lower(bootstrap_email)),
  bootstrap_done boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- 4.3 seasons
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  team_goal_amount numeric(14,2) not null default 0 check (team_goal_amount >= 0),
  xp_per_level int not null check (xp_per_level > 0),
  is_active boolean not null default false,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_range_ck check (ends_at > starts_at),
  constraint seasons_closed_not_active_ck check (closed_at is null or not is_active),
  constraint seasons_no_overlap exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
);
create unique index if not exists seasons_one_active on public.seasons ((true)) where is_active;
create index if not exists seasons_starts_at_idx on public.seasons (starts_at);

-- 4.4 season_goals (meta individual por temporada)
create table if not exists public.season_goals (
  season_id uuid not null references public.seasons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  goal_amount numeric(14,2) not null default 0 check (goal_amount >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (season_id, profile_id)
);
create index if not exists season_goals_profile_idx on public.season_goals (profile_id);

-- 4.5 season_results (snapshot do fechamento)
create table if not exists public.season_results (
  season_id uuid not null references public.seasons(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  final_rank int,
  final_points int not null default 0,
  sales_amount numeric(14,2) not null default 0,
  sales_count int not null default 0,
  goal_amount numeric(14,2) not null default 0,
  goal_reached boolean not null default false,
  level int not null default 0,
  created_at timestamptz not null default now(),
  primary key (season_id, profile_id)
);
create index if not exists season_results_profile_idx on public.season_results (profile_id);

-- 4.7 profile_private (PII: só dono/admin)
create table if not exists public.profile_private (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  email text not null check (length(email) <= 254),
  phone text check (phone is null or length(phone) <= 30),
  default_goal_amount numeric(14,2) not null default 0 check (default_goal_amount >= 0),
  notes text check (notes is null or length(notes) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists profile_private_email_uq on public.profile_private (lower(email));

-- 4.8 profile_season_stats (agregado por temporada, escrito só por trigger/recompute)
create table if not exists public.profile_season_stats (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  points int not null default 0,
  points_earned int not null default 0,
  points_updated_at timestamptz,
  coins_earned int not null default 0,
  coins_spent int not null default 0,
  sales_amount numeric(14,2) not null default 0,
  sales_count int not null default 0,
  meetings_scheduled int not null default 0,
  meetings_held int not null default 0,
  calls int not null default 0,
  crm_updates int not null default 0,
  lead_recoveries int not null default 0,
  upsells int not null default 0,
  activities_count int not null default 0,
  missions_completed int not null default 0,
  last_entry_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, season_id)
);
create index if not exists profile_season_stats_rank_idx on public.profile_season_stats (season_id, points desc);

-- 4.9 profile_lifetime_stats (agregado vitalício)
create table if not exists public.profile_lifetime_stats (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  coins_earned int not null default 0,
  coins_spent int not null default 0,
  coins_balance int generated always as (coins_earned - coins_spent) stored,
  sales_amount numeric(14,2) not null default 0,
  sales_count int not null default 0,
  first_sale_at timestamptz,
  missions_completed int not null default 0,
  streak_days int not null default 0,
  streak_last_day date,
  best_streak_days int not null default 0,
  updated_at timestamptz not null default now()
);

-- 4.31 audit_log
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action public.audit_action not null,
  table_name text not null,
  row_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_table_row_idx on public.audit_log (table_name, row_id);

-- -----------------------------------------------------------------------------
-- >>> 20260915000004_tables_catalog.sql
-- -----------------------------------------------------------------------------
-- 0004 — tabelas de catálogo (DATA-MODEL §4.10, §4.13, §4.15–4.16, §4.18–4.19, §4.21–4.22, §4.25, §4.27).

-- 4.10 point_rules
create table if not exists public.point_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  metric public.metric_type not null default 'activity',
  points int not null check (points between 0 and 100000),
  coins int not null check (coins between 0 and 100000),
  trigger_kind public.rule_trigger_kind not null default 'manual',
  amount_step numeric(14,2) check (amount_step is null or amount_step > 0),
  requires_amount boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint point_rules_auto_amount_step_ck check (trigger_kind <> 'auto_amount_step' or (metric = 'amount_step' and amount_step is not null)),
  constraint point_rules_auto_goal_ck check (trigger_kind <> 'auto_goal' or metric = 'monthly_goal'),
  constraint point_rules_auto_metric_ck check (metric not in ('amount_step', 'monthly_goal') or trigger_kind <> 'manual')
);
create unique index if not exists point_rules_name_uq on public.point_rules (lower(name)) where deleted_at is null;
create unique index if not exists point_rules_auto_kind_uq on public.point_rules (trigger_kind) where trigger_kind <> 'manual' and deleted_at is null and is_active;

-- 4.13 special_events (multiplicador de pontos por janela)
create table if not exists public.special_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  description text check (description is null or length(description) <= 300),
  multiplier numeric(4,2) not null default 2 check (multiplier between 1.1 and 10),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_events_range_ck check (ends_at > starts_at),
  constraint special_events_no_overlap exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&) where (is_active and deleted_at is null)
);
create index if not exists special_events_starts_idx on public.special_events (starts_at) where is_active and deleted_at is null;

-- 4.21 wheels (2 linhas fixas do seed)
create table if not exists public.wheels (
  id uuid primary key default gen_random_uuid(),
  kind public.wheel_kind not null unique,
  name text not null check (length(name) between 1 and 40),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 4.22 wheel_prizes
create table if not exists public.wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  wheel_id uuid not null references public.wheels(id) on delete restrict,
  label text not null check (length(label) between 1 and 40),
  kind public.prize_kind not null,
  value numeric(14,2),
  weight int not null default 1 check (weight between 1 and 1000),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint wheel_prizes_value_ck check (
    (kind in ('points', 'coins', 'cash', 'voucher') and value > 0)
    or (kind = 'multiplier' and value between 1.1 and 10)
    or (kind in ('extra_spin', 'mystery', 'custom') and value is null)
  )
);
create unique index if not exists wheel_prizes_sort_uq on public.wheel_prizes (wheel_id, sort_order) where deleted_at is null;
create index if not exists wheel_prizes_active_idx on public.wheel_prizes (wheel_id, is_active) where deleted_at is null;

-- 4.25 rewards (loja)
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  category text check (category is null or length(category) <= 40),
  value_amount numeric(14,2) check (value_amount is null or value_amount >= 0),
  cost_coins int not null check (cost_coins between 1 and 1000000),
  stock int check (stock is null or stock >= 0),
  icon text check (icon is null or length(icon) <= 40),
  is_active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.27 achievements (catálogo)
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  title text not null check (length(title) between 1 and 60),
  description text check (description is null or length(description) <= 200),
  icon text,
  criteria public.achievement_criteria not null,
  criteria_value numeric(14,2),
  scope public.achievement_scope not null,
  reward_points int not null default 0 check (reward_points between 0 and 100000),
  reward_coins int not null default 0 check (reward_coins between 0 and 100000),
  is_active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint achievements_criteria_value_ck check (
    (criteria in ('first_sale', 'monthly_goal', 'rank_first') and criteria_value is null)
    or (criteria in ('streak_days', 'sales_total', 'points_total', 'missions_completed') and criteria_value > 0)
  ),
  constraint achievements_scope_ck check (
    (criteria in ('monthly_goal', 'rank_first') and scope = 'season') or criteria not in ('monthly_goal', 'rank_first')
  )
);

-- 4.15 missions
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  title text not null check (length(title) between 1 and 80),
  description text check (description is null or length(description) <= 300),
  icon text check (icon is null or length(icon) <= 40),
  kind public.mission_kind not null,
  metric public.metric_type not null check (metric not in ('amount_step', 'weekly_goal', 'monthly_goal')),
  target_kind public.mission_target_kind not null default 'count',
  target_value numeric(14,2) not null check (target_value > 0),
  reward_points int not null default 0 check (reward_points between 0 and 100000),
  reward_coins int not null default 0 check (reward_coins between 0 and 100000),
  reward_spin public.wheel_kind,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  audience public.mission_audience not null default 'all',
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_range_ck check (ends_at > starts_at),
  constraint missions_target_kind_ck check (target_kind <> 'amount' or metric in ('sale', 'upsell')),
  constraint missions_reward_ck check (reward_points > 0 or reward_coins > 0 or reward_spin is not null)
);
create index if not exists missions_window_idx on public.missions (season_id, is_active, starts_at, ends_at);
create index if not exists missions_kind_idx on public.missions (kind);

-- 4.16 mission_participants (só audience = 'selected')
create table if not exists public.mission_participants (
  mission_id uuid not null references public.missions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  primary key (mission_id, profile_id)
);

-- 4.18 challenges
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  name text not null check (length(name) between 1 and 80),
  description text check (description is null or length(description) <= 300),
  kind public.challenge_kind not null,
  metric public.challenge_metric not null,
  target_value numeric(14,2) not null check (target_value > 0),
  reward_points int not null default 0 check (reward_points between 0 and 100000),
  reward_coins int not null default 0 check (reward_coins between 0 and 100000),
  reward_spin public.wheel_kind,
  reward_description text check (reward_description is null or length(reward_description) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.challenge_status not null default 'draft',
  winner_ids uuid[] not null default '{}',
  activated_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_range_ck check (ends_at > starts_at),
  constraint challenges_active_ck check (status <> 'active' or activated_at is not null),
  constraint challenges_finished_ck check (status <> 'finished' or finished_at is not null)
);
create index if not exists challenges_season_status_idx on public.challenges (season_id, status);

-- 4.19 challenge_participants
create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  current_value numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);
create index if not exists challenge_participants_profile_idx on public.challenge_participants (profile_id);

-- -----------------------------------------------------------------------------
-- >>> 20260915000005_tables_facts.sql
-- -----------------------------------------------------------------------------
-- 0005 — tabelas de fatos (DATA-MODEL §4.11–4.12, §4.14, §4.17, §4.20, §4.23–4.24, §4.26, §4.28–4.30).
-- FKs circulares (point_entries.boost_id → profile_boosts → wheel_spins → point_entries,
-- wheel_spins.redemption_id → reward_redemptions → wheel_spins) adicionadas ao final com guarda.

-- 4.11 point_entries (LEDGER, append-only)
create table if not exists public.point_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null constraint point_entries_profile_id_fkey references public.profiles(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  rule_id uuid references public.point_rules(id) on delete restrict,
  metric public.metric_type,
  quantity int not null default 1 check (quantity >= 1),
  amount numeric(14,2),
  base_points int not null,
  multiplier numeric(4,2) not null default 1 check (multiplier between 1 and 10),
  points int not null check (abs(points) <= 1000000),
  coins int not null default 0 check (abs(coins) <= 1000000),
  source public.entry_source not null,
  reason text check (reason is null or length(reason) <= 500),
  special_event_id uuid references public.special_events(id) on delete restrict,
  boost_id uuid,
  reverses_entry_id uuid unique references public.point_entries(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_by uuid constraint point_entries_created_by_fkey references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint point_entries_amount_metric_ck check (amount is null or metric in ('sale', 'upsell')),
  constraint point_entries_amount_sign_ck check (amount is null or amount >= 0 or reverses_entry_id is not null),
  constraint point_entries_reverses_self_ck check (reverses_entry_id is null or reverses_entry_id <> id),
  constraint point_entries_occurred_at_ck check (occurred_at <= now() + interval '5 minutes'),
  constraint point_entries_reason_manual_ck check (source <> 'manual' or reason is not null),
  constraint point_entries_rule_needs_rule_ck check (source <> 'rule' or rule_id is not null),
  constraint point_entries_rule_only_ck check (source in ('rule') or rule_id is null or reverses_entry_id is not null),
  constraint point_entries_reward_ck check (source <> 'reward' or (coins < 0 and points = 0) or reverses_entry_id is not null),
  constraint point_entries_metric_null_ck check (source not in ('mission', 'challenge', 'wheel', 'achievement') or metric is null),
  constraint point_entries_not_empty_ck check (source = 'rule' or points <> 0 or coins <> 0 or amount is not null or reverses_entry_id is not null),
  constraint point_entries_multiplier_ck check (multiplier = 1 or source = 'rule')
);

-- Nota de implementação: estorno de rule/manual/system nasce com source = 'system' (§7.4) e herda rule_id
-- (§6.6 passo 2); um estorno de regra 0/0 também precisa passar. Reaplicação em banco existente: troca os dois CKs.
alter table public.point_entries drop constraint if exists point_entries_rule_only_ck;
alter table public.point_entries add constraint point_entries_rule_only_ck check (source in ('rule') or rule_id is null or reverses_entry_id is not null);
alter table public.point_entries drop constraint if exists point_entries_not_empty_ck;
alter table public.point_entries add constraint point_entries_not_empty_ck check (source = 'rule' or points <> 0 or coins <> 0 or amount is not null or reverses_entry_id is not null);
create index if not exists point_entries_profile_season_idx on public.point_entries (profile_id, season_id);
create index if not exists point_entries_profile_occurred_idx on public.point_entries (profile_id, occurred_at desc);
create index if not exists point_entries_season_occurred_idx on public.point_entries (season_id, occurred_at);
create index if not exists point_entries_profile_metric_idx on public.point_entries (profile_id, metric, occurred_at);
create index if not exists point_entries_season_source_idx on public.point_entries (season_id, source);
create index if not exists point_entries_sales_idx on public.point_entries (occurred_at desc) where metric = 'sale';
create index if not exists point_entries_rule_idx on public.point_entries (rule_id);
create index if not exists point_entries_created_by_idx on public.point_entries (created_by);
create index if not exists point_entries_special_event_idx on public.point_entries (special_event_id) where special_event_id is not null;

-- 4.12 milestone_awards (idempotência de marcos)
create table if not exists public.milestone_awards (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  metric public.metric_type not null check (metric in ('amount_step', 'weekly_goal', 'monthly_goal')),
  period_key text not null,
  entry_id uuid not null unique references public.point_entries(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, season_id, metric, period_key)
);
create unique index if not exists milestone_awards_weekly_uq on public.milestone_awards (profile_id, metric, period_key) where metric = 'weekly_goal';

-- 4.14 profile_boosts (prêmio "2x pontos")
create table if not exists public.profile_boosts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  multiplier numeric(4,2) not null default 2 check (multiplier between 1.1 and 10),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  spin_id uuid not null unique,
  created_at timestamptz not null default now(),
  constraint profile_boosts_range_ck check (expires_at > starts_at)
);
create index if not exists profile_boosts_profile_idx on public.profile_boosts (profile_id, expires_at);

-- 4.23 wheel_queue
create table if not exists public.wheel_queue (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete restrict,
  person_name text not null check (length(person_name) between 1 and 80),
  wheel_id uuid not null references public.wheels(id) on delete restrict,
  attempts_allowed int not null default 1 check (attempts_allowed between 1 and 20),
  attempts_used int not null default 0 check (attempts_used >= 0 and attempts_used <= attempts_allowed),
  status public.queue_status not null default 'waiting',
  source public.queue_source not null default 'manual',
  reference_kind text check (reference_kind is null or reference_kind in ('mission_progress', 'challenge_result')),
  reference_id text,
  released_at timestamptz,
  finished_at timestamptz,
  removed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wheel_queue_earned_profile_ck check (profile_id is not null or source = 'manual'),
  constraint wheel_queue_released_ck check (status <> 'active' or released_at is not null),
  constraint wheel_queue_finished_ck check (status not in ('done', 'removed') or finished_at is not null)
);
create unique index if not exists wheel_queue_one_active on public.wheel_queue ((true)) where status = 'active';
create unique index if not exists wheel_queue_reference_uq on public.wheel_queue (reference_kind, reference_id) where reference_id is not null;
create index if not exists wheel_queue_open_idx on public.wheel_queue (status, created_at) where status in ('waiting', 'active');
create index if not exists wheel_queue_profile_idx on public.wheel_queue (profile_id, status);

-- 4.17 mission_progress
create table if not exists public.mission_progress (
  mission_id uuid not null references public.missions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  period_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  value numeric(14,2) not null default 0,
  completed_at timestamptz,
  entry_id uuid unique references public.point_entries(id) on delete restrict,
  queue_id uuid unique references public.wheel_queue(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (mission_id, profile_id, period_key)
);
create index if not exists mission_progress_profile_idx on public.mission_progress (profile_id, completed_at);
create index if not exists mission_progress_mission_idx on public.mission_progress (mission_id);

-- 4.24 wheel_spins
create table if not exists public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.wheel_queue(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete restrict,
  person_name text not null,
  wheel_id uuid not null references public.wheels(id) on delete restrict,
  attempt_index int not null,
  prize_id uuid not null references public.wheel_prizes(id) on delete restrict,
  prize_label text not null,
  prize_kind public.prize_kind not null,
  prize_value numeric(14,2),
  resolved_prize_id uuid not null references public.wheel_prizes(id) on delete restrict,
  resolved_label text not null,
  resolved_kind public.prize_kind not null check (resolved_kind <> 'mystery'),
  resolved_value numeric(14,2),
  random_value bigint not null,
  prizes_hash text not null,
  status public.spin_status not null default 'pending',
  spun_by uuid references public.profiles(id) on delete set null,
  spun_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  entry_id uuid unique references public.point_entries(id) on delete restrict,
  redemption_id uuid unique,
  boost_id uuid unique references public.profile_boosts(id) on delete restrict,
  credited boolean not null default false,
  constraint wheel_spins_approved_at_ck check ((status = 'pending') = (approved_at is null))
);
create unique index if not exists wheel_spins_one_pending_per_queue on public.wheel_spins (queue_id) where status = 'pending';
create index if not exists wheel_spins_status_idx on public.wheel_spins (status, spun_at desc);
create index if not exists wheel_spins_profile_idx on public.wheel_spins (profile_id, spun_at desc);

-- 4.26 reward_redemptions
create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  source public.redemption_source not null,
  reward_id uuid references public.rewards(id) on delete restrict,
  spin_id uuid unique references public.wheel_spins(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete restrict,
  person_name text not null,
  title text not null,
  cost_coins int not null default 0 check (cost_coins >= 0),
  value_amount numeric(14,2),
  status public.redemption_status not null default 'requested',
  requested_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  notes text check (notes is null or length(notes) <= 500),
  entry_id uuid unique references public.point_entries(id) on delete restrict,
  refund_entry_id uuid unique references public.point_entries(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint reward_redemptions_source_ck check (
    (source = 'store' and reward_id is not null and profile_id is not null and entry_id is not null and cost_coins > 0)
    or (source = 'wheel' and spin_id is not null and cost_coins = 0 and entry_id is null)
  ),
  constraint reward_redemptions_profile_ck check (profile_id is not null or source = 'wheel'),
  constraint reward_redemptions_refund_ck check (status <> 'cancelled' or source = 'wheel' or refund_entry_id is not null)
);
create index if not exists reward_redemptions_profile_idx on public.reward_redemptions (profile_id, status);
create index if not exists reward_redemptions_status_idx on public.reward_redemptions (status, requested_at);

-- 4.20 challenge_results
create table if not exists public.challenge_results (
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  final_value numeric(14,2) not null default 0,
  is_winner boolean not null default false,
  entry_id uuid unique references public.point_entries(id) on delete restrict,
  queue_id uuid unique references public.wheel_queue(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);

-- 4.28 profile_achievements
create table if not exists public.profile_achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  achievement_id uuid not null references public.achievements(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  entry_id uuid unique references public.point_entries(id) on delete restrict,
  trigger_entry_id uuid references public.point_entries(id) on delete set null
);
create unique index if not exists profile_achievements_lifetime_uq on public.profile_achievements (profile_id, achievement_id) where season_id is null;
create unique index if not exists profile_achievements_season_uq on public.profile_achievements (profile_id, achievement_id, season_id) where season_id is not null;
create index if not exists profile_achievements_profile_idx on public.profile_achievements (profile_id, unlocked_at desc);

-- 4.29 feed_events (feed público)
create table if not exists public.feed_events (
  id uuid primary key default gen_random_uuid(),
  kind public.feed_kind not null,
  profile_id uuid references public.profiles(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists feed_events_occurred_idx on public.feed_events (occurred_at desc, id desc);

-- 4.30 notifications (fan-out)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (length(title) <= 80),
  message text not null check (length(message) <= 300),
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (profile_id) where not is_read;

-- FKs circulares (guardadas por nome em pg_constraint)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'point_entries_boost_id_fkey') then
    alter table public.point_entries add constraint point_entries_boost_id_fkey
      foreign key (boost_id) references public.profile_boosts(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profile_boosts_spin_id_fkey') then
    alter table public.profile_boosts add constraint profile_boosts_spin_id_fkey
      foreign key (spin_id) references public.wheel_spins(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wheel_spins_redemption_id_fkey') then
    alter table public.wheel_spins add constraint wheel_spins_redemption_id_fkey
      foreign key (redemption_id) references public.reward_redemptions(id) on delete restrict;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- >>> 20260915000006_helpers.sql
-- -----------------------------------------------------------------------------
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
-- Nota de implementação: stable (não immutable) — para métrica 'activities' o estorno (source 'system', §7.4)
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

-- -----------------------------------------------------------------------------
-- >>> 20260915000007_trigger_functions.sql
-- -----------------------------------------------------------------------------
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
    -- §7.4 / Nota de implementação: estorno de rule/manual/system nasce 'system'; demais sources herdam
    NEW.source := case when v_orig.source in ('rule', 'manual', 'system') then 'system'::public.entry_source else v_orig.source end;
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
    activities_count = ss.activities_count + case when (case when v_is_reversal then v_orig.source else NEW.source end) in ('rule', 'manual')
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
                         -- least(): venda retroativa (occurred_at anterior) reproduz o min(occurred_at) de recompute_stats (§7.2)
                         then least(ls.first_sale_at, NEW.occurred_at) else ls.first_sale_at end,
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
    -- Nota de implementação: a original deixa de contar como atividade (§4.8) — last_entry_at da temporada
    -- é recalculado do ledger para reproduzir recompute_stats (§7.2); greatest() sozinho manteria a data estornada.
    update public.profile_season_stats ss
       set last_entry_at = (select max(e.occurred_at) from public.point_entries e
                             where e.profile_id = NEW.profile_id and e.season_id = NEW.season_id and private.counts_for_streak(e)),
           updated_at = pg_catalog.now()
     where ss.profile_id = NEW.profile_id and ss.season_id = NEW.season_id;
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

-- -----------------------------------------------------------------------------
-- >>> 20260915000008_triggers.sql
-- -----------------------------------------------------------------------------
-- 0008 — triggers (DATA-MODEL §8). Cada um com drop trigger if exists antes do create.

-- auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- app_settings
drop trigger if exists app_settings_validate_tz on public.app_settings;
create trigger app_settings_validate_tz before insert or update on public.app_settings
  for each row execute function private.validate_timezone();
drop trigger if exists app_settings_updated_at on public.app_settings;
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();
drop trigger if exists app_settings_audit on public.app_settings;
create trigger app_settings_audit after update on public.app_settings
  for each row execute function private.audit_row();

-- app_secrets
drop trigger if exists app_secrets_protect on public.app_secrets;
create trigger app_secrets_protect before update on public.app_secrets
  for each row execute function private.protect_app_secrets();
drop trigger if exists app_secrets_updated_at on public.app_secrets;
create trigger app_secrets_updated_at before update on public.app_secrets
  for each row execute function private.set_updated_at();
drop trigger if exists app_secrets_audit on public.app_secrets;
create trigger app_secrets_audit after update on public.app_secrets
  for each row execute function private.audit_row();

-- seasons
drop trigger if exists seasons_updated_at on public.seasons;
create trigger seasons_updated_at before update on public.seasons
  for each row execute function private.set_updated_at();
drop trigger if exists seasons_stamp_actor on public.seasons;
create trigger seasons_stamp_actor before insert on public.seasons
  for each row execute function private.stamp_actor();
drop trigger if exists seasons_audit on public.seasons;
create trigger seasons_audit after insert or update on public.seasons
  for each row execute function private.audit_row();

-- season_goals
drop trigger if exists season_goals_updated_at on public.season_goals;
create trigger season_goals_updated_at before update on public.season_goals
  for each row execute function private.set_updated_at();
drop trigger if exists season_goals_goal_milestone on public.season_goals;
create trigger season_goals_goal_milestone after update of goal_amount on public.season_goals
  for each row execute function private.on_goal_amount_changed();

-- profiles
drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns before update on public.profiles
  for each row execute function private.protect_profile_columns();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update on public.profiles
  for each row
  when ((old.role, old.status, old.job_title, old.team) is distinct from (new.role, new.status, new.job_title, new.team))
  execute function private.audit_row();

-- profile_private
drop trigger if exists profile_private_updated_at on public.profile_private;
create trigger profile_private_updated_at before update on public.profile_private
  for each row execute function private.set_updated_at();

-- point_rules
drop trigger if exists point_rules_stamp_actor on public.point_rules;
create trigger point_rules_stamp_actor before insert on public.point_rules
  for each row execute function private.stamp_actor();
drop trigger if exists point_rules_updated_at on public.point_rules;
create trigger point_rules_updated_at before update on public.point_rules
  for each row execute function private.set_updated_at();
drop trigger if exists point_rules_audit on public.point_rules;
create trigger point_rules_audit after insert or update on public.point_rules
  for each row execute function private.audit_row();

-- point_entries (ledger)
drop trigger if exists point_entries_before on public.point_entries;
create trigger point_entries_before before insert on public.point_entries
  for each row execute function private.before_point_entry();
drop trigger if exists point_entries_after on public.point_entries;
create trigger point_entries_after after insert on public.point_entries
  for each row execute function private.after_point_entry();
drop trigger if exists point_entries_immutable on public.point_entries;
create trigger point_entries_immutable before update or delete on public.point_entries
  for each row execute function private.forbid_ledger_mutation();

-- special_events
drop trigger if exists special_events_stamp_actor on public.special_events;
create trigger special_events_stamp_actor before insert on public.special_events
  for each row execute function private.stamp_actor();
drop trigger if exists special_events_updated_at on public.special_events;
create trigger special_events_updated_at before update on public.special_events
  for each row execute function private.set_updated_at();
drop trigger if exists special_events_audit on public.special_events;
create trigger special_events_audit after insert or update on public.special_events
  for each row execute function private.audit_row();
drop trigger if exists special_events_notify on public.special_events;
create trigger special_events_notify after insert or update of is_active on public.special_events
  for each row execute function private.notify_special_event();

-- missions
drop trigger if exists missions_validate_window on public.missions;
create trigger missions_validate_window before insert or update on public.missions
  for each row execute function private.validate_mission_window();
drop trigger if exists missions_stamp_actor on public.missions;
create trigger missions_stamp_actor before insert on public.missions
  for each row execute function private.stamp_actor();
drop trigger if exists missions_updated_at on public.missions;
create trigger missions_updated_at before update on public.missions
  for each row execute function private.set_updated_at();

-- mission_progress
drop trigger if exists mission_progress_updated_at on public.mission_progress;
create trigger mission_progress_updated_at before update on public.mission_progress
  for each row execute function private.set_updated_at();

-- challenges
drop trigger if exists challenges_validate_window on public.challenges;
create trigger challenges_validate_window before insert or update on public.challenges
  for each row execute function private.validate_challenge_window();
drop trigger if exists challenges_protect_status on public.challenges;
create trigger challenges_protect_status before update on public.challenges
  for each row execute function private.protect_challenge_status();
drop trigger if exists challenges_cardinality on public.challenges;
create constraint trigger challenges_cardinality after update of status on public.challenges
  deferrable initially deferred
  for each row execute function private.check_challenge_cardinality();
drop trigger if exists challenges_stamp_actor on public.challenges;
create trigger challenges_stamp_actor before insert on public.challenges
  for each row execute function private.stamp_actor();
drop trigger if exists challenges_updated_at on public.challenges;
create trigger challenges_updated_at before update on public.challenges
  for each row execute function private.set_updated_at();

-- challenge_participants
drop trigger if exists cp_protect on public.challenge_participants;
create trigger cp_protect before insert or delete on public.challenge_participants
  for each row execute function private.protect_challenge_participants();
drop trigger if exists cp_cardinality on public.challenge_participants;
create constraint trigger cp_cardinality after insert or delete on public.challenge_participants
  deferrable initially deferred
  for each row execute function private.check_challenge_cardinality();
drop trigger if exists cp_updated_at on public.challenge_participants;
create trigger cp_updated_at before update on public.challenge_participants
  for each row execute function private.set_updated_at();

-- wheels
drop trigger if exists wheels_updated_at on public.wheels;
create trigger wheels_updated_at before update on public.wheels
  for each row execute function private.set_updated_at();
drop trigger if exists wheels_protect_inactive on public.wheels;
create trigger wheels_protect_inactive before update of is_active on public.wheels
  for each row execute function private.protect_wheel_deactivation();
drop trigger if exists wheels_check_prizes on public.wheels;
create constraint trigger wheels_check_prizes after update of is_active on public.wheels
  deferrable initially deferred
  for each row execute function private.check_wheel_prizes_on_wheel();

-- wheel_prizes
drop trigger if exists wheel_prizes_min on public.wheel_prizes;
create constraint trigger wheel_prizes_min after insert or update or delete on public.wheel_prizes
  deferrable initially deferred
  for each row execute function private.check_wheel_min_prizes();
drop trigger if exists wheel_prizes_block_pending on public.wheel_prizes;
create trigger wheel_prizes_block_pending before update or delete on public.wheel_prizes
  for each row execute function private.block_prize_change_with_pending_spin();
drop trigger if exists wheel_prizes_updated_at on public.wheel_prizes;
create trigger wheel_prizes_updated_at before update on public.wheel_prizes
  for each row execute function private.set_updated_at();
drop trigger if exists wheel_prizes_audit on public.wheel_prizes;
create trigger wheel_prizes_audit after insert or update on public.wheel_prizes
  for each row execute function private.audit_row();

-- wheel_queue
drop trigger if exists wheel_queue_updated_at on public.wheel_queue;
create trigger wheel_queue_updated_at before update on public.wheel_queue
  for each row execute function private.set_updated_at();

-- rewards
drop trigger if exists rewards_stamp_actor on public.rewards;
create trigger rewards_stamp_actor before insert on public.rewards
  for each row execute function private.stamp_actor();
drop trigger if exists rewards_updated_at on public.rewards;
create trigger rewards_updated_at before update on public.rewards
  for each row execute function private.set_updated_at();
drop trigger if exists rewards_audit on public.rewards;
create trigger rewards_audit after insert or update on public.rewards
  for each row execute function private.audit_row();

-- reward_redemptions
drop trigger if exists reward_redemptions_updated_at on public.reward_redemptions;
create trigger reward_redemptions_updated_at before update on public.reward_redemptions
  for each row execute function private.set_updated_at();

-- achievements
drop trigger if exists achievements_updated_at on public.achievements;
create trigger achievements_updated_at before update on public.achievements
  for each row execute function private.set_updated_at();
drop trigger if exists achievements_audit on public.achievements;
create trigger achievements_audit after insert or update on public.achievements
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- >>> 20260915000009_views.sql
-- -----------------------------------------------------------------------------
-- 0009 — views (DATA-MODEL §5). Todas security_invoker + security_barrier; só SELECT para authenticated.
-- Regras transversais: percentuais limitados a 999.99 (numeric(5,2)); progresso em [0,100];
-- só funções de public (local_day/local_today/mission_period); colunas own-or-admin saem NULL/0 via RLS.

-- 5.1 v_profile_stats — perfil × temporada (inclui inativos/pendentes com rank NULL)
create or replace view public.v_profile_stats with (security_invoker = true, security_barrier = true) as
with base as (
  select
    p.id as profile_id,
    s.id as season_id,
    p.full_name, p.avatar_path, p.color, p.job_title, p.team, p.role, p.status,
    pp.email, pp.phone,
    s.name as season_name, s.starts_at as season_starts_at, s.ends_at as season_ends_at, s.is_active as season_is_active,
    coalesce(ss.points, 0) as points,
    coalesce(ss.points_earned, 0) as points_earned,
    ss.points_updated_at,
    coalesce(ss.sales_amount, 0)::numeric(14,2) as sales_amount,
    coalesce(ss.sales_count, 0) as sales_count,
    coalesce(ss.meetings_scheduled, 0) as meetings_scheduled,
    coalesce(ss.meetings_held, 0) as meetings_held,
    coalesce(ss.calls, 0) as calls,
    coalesce(ss.crm_updates, 0) as crm_updates,
    coalesce(ss.lead_recoveries, 0) as lead_recoveries,
    coalesce(ss.upsells, 0) as upsells,
    coalesce(ss.activities_count, 0) as activities_count,
    coalesce(ss.missions_completed, 0) as missions_completed,
    coalesce(g.goal_amount, 0)::numeric(14,2) as goal_amount,
    s.xp_per_level,
    coalesce(ls.coins_balance, 0) as coins_balance,
    coalesce(ls.coins_earned, 0) as coins_earned_lifetime,
    coalesce(ls.coins_spent, 0) as coins_spent_lifetime,
    coalesce(case when ls.streak_last_day >= public.local_today() - 1 then ls.streak_days else 0 end, 0) as streak_days,
    coalesce(ls.best_streak_days, 0) as best_streak_days,
    coalesce(ls.sales_amount, 0)::numeric(14,2) as sales_amount_lifetime,
    coalesce(ls.sales_count, 0) as sales_count_lifetime,
    ss.last_entry_at,
    (p.status = 'active' and (coalesce((select a.rank_admins from public.app_settings a where a.id = 1), true) or p.role <> 'admin')) as is_rankable,
    greatest(least(public.local_today(), public.local_day(s.ends_at - interval '1 second')) - public.local_day(s.starts_at), 1) as days_elapsed
  from public.profiles p
  cross join public.seasons s
  left join public.profile_season_stats ss on ss.profile_id = p.id and ss.season_id = s.id
  left join public.profile_lifetime_stats ls on ls.profile_id = p.id
  left join public.season_goals g on g.season_id = s.id and g.profile_id = p.id
  left join public.profile_private pp on pp.profile_id = p.id
), ranked as (
  select b.*,
    case when b.is_rankable then
      row_number() over (partition by b.season_id, b.is_rankable order by b.points desc, b.sales_amount desc, b.points_updated_at asc nulls last, b.profile_id)
    end as rank_pos,
    case when b.is_rankable then
      lag(b.points) over (partition by b.season_id, b.is_rankable order by b.points desc, b.sales_amount desc, b.points_updated_at asc nulls last, b.profile_id)
    end as above_points
  from base b
)
select
  r.profile_id, r.season_id,
  r.full_name, r.avatar_path, r.color, r.job_title, r.team, r.role, r.status,
  r.email, r.phone,
  r.season_name, r.season_starts_at, r.season_ends_at, r.season_is_active,
  r.points, r.points_earned,
  r.sales_amount, r.sales_count, r.meetings_scheduled, r.meetings_held, r.calls, r.crm_updates, r.lead_recoveries, r.upsells,
  r.activities_count, r.missions_completed,
  (case when r.meetings_held > 0 then least(round(r.sales_count::numeric / r.meetings_held * 100, 2), 999.99) end)::numeric(5,2) as conversion_pct,
  (case when r.meetings_scheduled > 0 then least(round(r.meetings_held::numeric / r.meetings_scheduled * 100, 2), 999.99) end)::numeric(5,2) as attendance_pct,
  r.goal_amount,
  (case when r.goal_amount > 0 then least(round(r.sales_amount / r.goal_amount * 100, 2), 999.99) end)::numeric(5,2) as goal_pct,
  greatest(r.goal_amount - r.sales_amount, 0)::numeric(14,2) as goal_missing_amount,
  (case
     when r.goal_amount > 0 and r.sales_amount > 0 and r.sales_amount < r.goal_amount and r.days_elapsed > 0
          and ceil(r.goal_amount / (r.sales_amount / r.days_elapsed)) <= 3650
     then public.local_day(r.season_starts_at) + ceil(r.goal_amount / (r.sales_amount / r.days_elapsed))::int
   end) as projected_goal_date,
  r.xp_per_level,
  (greatest(r.points, 0) / r.xp_per_level)::int as level,
  (greatest(r.points, 0) - (greatest(r.points, 0) / r.xp_per_level) * r.xp_per_level)::int as xp_in_level,
  (r.xp_per_level - (greatest(r.points, 0) - (greatest(r.points, 0) / r.xp_per_level) * r.xp_per_level))::int as xp_to_next,
  r.coins_balance, r.coins_earned_lifetime, r.coins_spent_lifetime,
  r.streak_days, r.best_streak_days, r.sales_amount_lifetime, r.sales_count_lifetime,
  r.rank_pos::int as rank,
  (case when r.rank_pos is not null then r.above_points - r.points end)::int as gap_to_above,
  coalesce(r.rank_pos is not null and r.above_points = r.points, false) as is_tied_with_above,
  (r.points > 0) as has_points,
  (select count(distinct pa.achievement_id)::int from public.profile_achievements pa
     join public.achievements a on a.id = pa.achievement_id and a.is_active and a.deleted_at is null
    where pa.profile_id = r.profile_id) as achievements_unlocked,
  (select count(*)::int from public.achievements a where a.is_active and a.deleted_at is null) as achievements_total,
  (select count(*)::int from public.wheel_queue q where q.profile_id = r.profile_id and q.status = 'waiting' and q.source = 'earned') as pending_earned_spins,
  r.last_entry_at
from ranked r;

-- 5.2 v_ranking
create or replace view public.v_ranking with (security_invoker = true, security_barrier = true) as
select season_id, rank, gap_to_above, is_tied_with_above, has_points, profile_id, full_name, avatar_path, color, job_title, team,
       points, level, sales_amount, sales_count, conversion_pct, meetings_held
from public.v_profile_stats
where rank is not null;

-- 5.3 v_team_stats — uma linha por temporada
create or replace view public.v_team_stats with (security_invoker = true, security_barrier = true) as
select
  s.id as season_id, s.name as season_name, s.starts_at, s.ends_at, s.is_active, s.team_goal_amount, s.xp_per_level,
  coalesce(agg.sales_amount, 0)::numeric(14,2) as sales_amount,
  (case when s.team_goal_amount > 0 then least(round(coalesce(agg.sales_amount, 0) / s.team_goal_amount * 100, 2), 999.99) end)::numeric(5,2) as attainment_pct,
  greatest(s.team_goal_amount - coalesce(agg.sales_amount, 0), 0)::numeric(14,2) as sales_missing_amount,
  coalesce(agg.points_total, 0)::int as points_total,
  coalesce(agg.points_distributed, 0)::int as points_distributed,
  cnt.active_count, cnt.pending_count, cnt.total_count,
  coalesce(agg.sales_count, 0)::int as sales_count,
  coalesce(agg.meetings_scheduled, 0)::int as meetings_scheduled,
  coalesce(agg.meetings_held, 0)::int as meetings_held,
  coalesce(agg.calls, 0)::int as calls,
  coalesce(agg.crm_updates, 0)::int as crm_updates,
  coalesce(agg.activities_count, 0)::int as activities_count,
  coalesce(agg.missions_completed, 0)::int as missions_completed,
  (case when agg.avg_conversion is not null then least(round(agg.avg_conversion * 100, 2), 999.99) end)::numeric(5,2) as avg_conversion_pct,
  (case when coalesce(agg.meetings_scheduled, 0) > 0 then least(round(agg.meetings_held::numeric / agg.meetings_scheduled * 100, 2), 999.99) end)::numeric(5,2) as attendance_pct,
  (case when cnt.active_count > 0 then least(round(coalesce(agg.crm_profiles, 0)::numeric / cnt.active_count * 100, 2), 999.99) end)::numeric(5,2) as crm_pct,
  (select count(*)::int from public.wheel_queue q where q.status in ('waiting', 'active')) as queue_count,
  st.target_conversion_pct, st.target_attendance_pct, st.target_crm_pct, st.target_activities_count
from public.seasons s
cross join lateral (
  select count(*) filter (where p.status = 'active')::int as active_count,
         count(*) filter (where p.status = 'pending')::int as pending_count,
         count(*)::int as total_count
  from public.profiles p
) cnt
cross join lateral (
  select a.target_conversion_pct, a.target_attendance_pct, a.target_crm_pct, a.target_activities_count
  from public.app_settings a where a.id = 1
) st
left join lateral (
  select sum(ss.sales_amount) as sales_amount,
         sum(ss.points) as points_total,
         sum(ss.points_earned) as points_distributed,
         sum(ss.sales_count) as sales_count,
         sum(ss.meetings_scheduled) as meetings_scheduled,
         sum(ss.meetings_held) as meetings_held,
         sum(ss.calls) as calls,
         sum(ss.crm_updates) as crm_updates,
         sum(ss.activities_count) as activities_count,
         sum(ss.missions_completed) as missions_completed,
         avg(ss.sales_count::numeric / nullif(ss.meetings_held, 0)) filter (where p.status = 'active' and ss.meetings_held > 0) as avg_conversion,
         count(distinct ss.profile_id) filter (where ss.crm_updates > 0 and p.status = 'active') as crm_profiles
  from public.profile_season_stats ss
  join public.profiles p on p.id = ss.profile_id
  where ss.season_id = s.id
) agg on true;

-- 5.4 v_admin_kpis — só admin
create or replace view public.v_admin_kpis with (security_invoker = true, security_barrier = true) as
select
  s.id as season_id,
  coalesce((select sum(coalesce(r.value_amount, 0)) from public.reward_redemptions r
             where r.status = 'delivered' and r.handled_at >= s.starts_at and r.handled_at < s.ends_at), 0)::numeric(14,2) as redemptions_delivered_amount,
  (select count(*)::int from public.reward_redemptions r where r.status in ('requested', 'approved')) as redemptions_pending_count,
  (select count(*)::int from public.point_entries e where e.season_id = s.id and e.source in ('rule', 'manual')) as entries_count,
  coalesce((select sum(e.coins) from public.point_entries e where e.season_id = s.id and e.coins > 0), 0)::int as coins_issued
from public.seasons s
where (select public.is_admin());

-- 5.5 v_sales_timeline — série diária zero-filled (ledger)
create or replace view public.v_sales_timeline with (security_invoker = true, security_barrier = true) as
select
  s.id as season_id,
  d.day::date as day,
  coalesce(agg.sales_amount, 0)::numeric(14,2) as sales_amount,
  coalesce(agg.sales_count, 0)::int as sales_count,
  sum(coalesce(agg.sales_amount, 0)) over (partition by s.id order by d.day)::numeric(14,2) as sales_cum,
  coalesce(agg.points, 0)::int as points,
  sum(coalesce(agg.points, 0)) over (partition by s.id order by d.day)::int as points_cum,
  coalesce(agg.entries_count, 0)::int as entries_count
from public.seasons s
cross join lateral generate_series(
  public.local_day(s.starts_at)::timestamp,
  least(public.local_day(s.ends_at - interval '1 second'), public.local_today())::timestamp,
  interval '1 day'
) as d(day)
left join lateral (
  select
    sum(case when e.metric in ('sale', 'upsell') and e.source in ('rule', 'manual', 'system') then coalesce(e.amount, 0) else 0 end) as sales_amount,
    sum(case when e.metric = 'sale' and e.source in ('rule', 'manual', 'system')
             then e.quantity * (case when e.points < 0 or (e.points = 0 and e.reverses_entry_id is not null) then -1 else 1 end) else 0 end) as sales_count,
    sum(e.points) as points,
    count(*) as entries_count
  from public.point_entries e
  where e.season_id = s.id
    and e.occurred_at >= (d.day::date::timestamp at time zone public.app_timezone())
    and e.occurred_at < ((d.day::date + 1)::timestamp at time zone public.app_timezone())
) agg on true;

-- 5.6 v_mission_board — missão × perfil elegível
create or replace view public.v_mission_board with (security_invoker = true, security_barrier = true) as
select
  m.id as mission_id, m.season_id, p.id as profile_id,
  m.title, m.description, m.icon, m.kind, m.metric, m.target_kind, m.target_value, m.reward_points, m.reward_coins, m.reward_spin,
  m.starts_at, m.ends_at, m.audience, m.is_active,
  (m.is_active and now() >= m.starts_at and now() < m.ends_at) as is_current,
  case when m.is_active and now() >= m.starts_at and now() < m.ends_at then per.period_key end as period_key,
  case when m.is_active and now() >= m.starts_at and now() < m.ends_at then per.period_start end as period_start,
  case when m.is_active and now() >= m.starts_at and now() < m.ends_at then per.period_end end as period_end,
  coalesce(mp.value, 0)::numeric(14,2) as progress_value,
  greatest(least(round(coalesce(mp.value, 0) / m.target_value * 100), 100), 0)::int as progress_pct,
  (mp.completed_at is not null) as is_completed,
  mp.completed_at,
  case when m.is_active and now() >= m.starts_at and now() < m.ends_at
       then greatest(extract(epoch from least(per.period_end, m.ends_at) - now()), 0)::int end as seconds_remaining,
  q.status as spin_queue_status
from public.missions m
join public.profiles p on p.status = 'active'
  and (m.audience = 'all' or exists (select 1 from public.mission_participants mpt where mpt.mission_id = m.id and mpt.profile_id = p.id))
left join lateral public.mission_period(m.kind, now(), m.starts_at, m.ends_at) per on true
left join public.mission_progress mp on mp.mission_id = m.id and mp.profile_id = p.id and mp.period_key = per.period_key
left join public.wheel_queue q on q.id = mp.queue_id
where m.deleted_at is null;

-- 5.7 v_challenge_board — um desafio por linha, participantes em jsonb
create or replace view public.v_challenge_board with (security_invoker = true, security_barrier = true) as
select
  c.id as challenge_id, c.season_id, c.name, c.description, c.kind, c.metric, c.target_value,
  c.reward_points, c.reward_coins, c.reward_spin, c.reward_description, c.starts_at, c.ends_at, c.status, c.winner_ids,
  c.activated_at, c.finished_at,
  greatest(ceil(extract(epoch from c.ends_at - now()) / 86400), 0)::int as days_left,
  coalesce(agg.total_value, 0)::numeric(14,2) as total_value,
  greatest(least(round(coalesce(agg.total_value, 0) / c.target_value * 100), 100), 0)::int as total_pct,
  coalesce(agg.participants_count, 0)::int as participants_count,
  coalesce(agg.participants, '[]'::jsonb) as participants
from public.challenges c
left join lateral (
  select
    sum(case when c.status = 'finished' then coalesce(cr.final_value, cp.current_value) else cp.current_value end) as total_value,
    count(*) as participants_count,
    jsonb_agg(jsonb_build_object(
      'profile_id', p.id, 'full_name', p.full_name, 'avatar_path', p.avatar_path, 'color', p.color, 'job_title', p.job_title, 'status', p.status,
      'value', case when c.status = 'finished' then coalesce(cr.final_value, cp.current_value) else cp.current_value end,
      'pct', greatest(least(round((case when c.status = 'finished' then coalesce(cr.final_value, cp.current_value) else cp.current_value end) / c.target_value * 100), 100), 0),
      'is_winner', p.id = any (c.winner_ids)
    ) order by (case when c.status = 'finished' then coalesce(cr.final_value, cp.current_value) else cp.current_value end) desc, p.full_name) as participants
  from public.challenge_participants cp
  join public.profiles p on p.id = cp.profile_id
  left join public.challenge_results cr on cr.challenge_id = cp.challenge_id and cr.profile_id = cp.profile_id
  where cp.challenge_id = c.id
) agg on true;

-- 5.8 v_achievement_board — conquista × perfil ativo
create or replace view public.v_achievement_board with (security_invoker = true, security_barrier = true) as
select
  a.id as achievement_id, p.id as profile_id, a.code, a.title, a.description, a.icon, a.criteria, a.criteria_value, a.scope,
  a.reward_points, a.reward_coins, a.sort_order,
  (pa.unlocked_count > 0) as is_unlocked,
  pa.unlocked_at,
  coalesce(pa.unlocked_count, 0)::int as unlocked_count
from public.achievements a
cross join public.profiles p
left join lateral (
  select max(x.unlocked_at) as unlocked_at, count(*)::int as unlocked_count
  from public.profile_achievements x where x.achievement_id = a.id and x.profile_id = p.id
) pa on true
where a.is_active and a.deleted_at is null and p.status = 'active';

-- 5.9 v_wheel_queue — fila ativa/esperando
create or replace view public.v_wheel_queue with (security_invoker = true, security_barrier = true) as
select
  q.id as queue_id,
  row_number() over (order by (q.status = 'active') desc, q.created_at, q.id)::int as position,
  q.profile_id, q.person_name, p.avatar_path, p.color, q.source,
  q.wheel_id, w.kind as wheel_kind, w.name as wheel_name,
  q.attempts_allowed, q.attempts_used, (q.attempts_allowed - q.attempts_used) as attempts_remaining,
  q.status, q.released_at, q.created_at,
  sp.id as pending_spin_id, sp.prize_label as pending_prize_label, sp.prize_kind as pending_prize_kind,
  sp.resolved_label as pending_resolved_label, sp.spun_at as pending_spun_at
from public.wheel_queue q
join public.wheels w on w.id = q.wheel_id
left join public.profiles p on p.id = q.profile_id
left join public.wheel_spins sp on sp.queue_id = q.id and sp.status = 'pending'
where q.status in ('waiting', 'active');

-- 5.10 v_wheel_history — últimas aprovações
create or replace view public.v_wheel_history with (security_invoker = true, security_barrier = true) as
select
  s.id as spin_id, s.queue_id, s.profile_id, s.person_name, p.avatar_path, p.color, w.kind as wheel_kind,
  s.prize_label, s.prize_kind, s.prize_value, s.resolved_label, s.resolved_kind, s.resolved_value, s.credited,
  s.attempt_index, s.spun_at, s.approved_at, ap.full_name as approved_by_name
from public.wheel_spins s
join public.wheels w on w.id = s.wheel_id
left join public.profiles p on p.id = s.profile_id
left join public.profiles ap on ap.id = s.approved_by
where s.status = 'approved';

-- 5.11 v_redemptions
create or replace view public.v_redemptions with (security_invoker = true, security_barrier = true) as
select
  r.id as redemption_id, r.source, r.reward_id, rw.icon as reward_icon, rw.category as reward_category,
  r.profile_id, r.person_name, p.avatar_path, r.title, r.cost_coins, r.value_amount, r.status, r.requested_at,
  r.handled_at, h.full_name as handled_by_name, r.notes, r.spin_id
from public.reward_redemptions r
left join public.rewards rw on rw.id = r.reward_id
left join public.profiles p on p.id = r.profile_id
left join public.profiles h on h.id = r.handled_by;

-- 5.12 v_wallet — carteira por perfil (ledger, própria ou admin)
create or replace view public.v_wallet with (security_invoker = true, security_barrier = true) as
select
  ls.profile_id,
  ls.coins_balance, ls.coins_earned, ls.coins_spent,
  coalesce(agg.coins_from_sales, 0)::int as coins_from_sales,
  coalesce(agg.coins_from_missions, 0)::int as coins_from_missions,
  coalesce(agg.coins_from_goals, 0)::int as coins_from_goals,
  coalesce(agg.coins_from_wheel, 0)::int as coins_from_wheel,
  coalesce(agg.coins_from_challenges, 0)::int as coins_from_challenges,
  coalesce(agg.coins_from_achievements, 0)::int as coins_from_achievements,
  coalesce(agg.coins_from_manual, 0)::int as coins_from_manual
from public.profile_lifetime_stats ls
join public.profiles p on p.id = ls.profile_id
left join lateral (
  select
    sum(e.coins) filter (where e.source = 'rule' and e.metric in ('sale', 'upsell')) as coins_from_sales,
    sum(e.coins) filter (where e.source = 'mission') as coins_from_missions,
    sum(e.coins) filter (where e.metric in ('weekly_goal', 'monthly_goal', 'amount_step')) as coins_from_goals,
    sum(e.coins) filter (where e.source = 'wheel') as coins_from_wheel,
    sum(e.coins) filter (where e.source = 'challenge') as coins_from_challenges,
    sum(e.coins) filter (where e.source = 'achievement') as coins_from_achievements,
    sum(e.coins) filter (where e.source in ('manual', 'system') and (e.metric is null or e.metric not in ('weekly_goal', 'monthly_goal', 'amount_step'))) as coins_from_manual
  from public.point_entries e
  where e.profile_id = ls.profile_id and e.coins > 0
) agg on true;

-- 5.13 v_point_entries_history — histórico de lançamentos (ledger)
create or replace view public.v_point_entries_history with (security_invoker = true, security_barrier = true) as
select
  e.id as entry_id, e.profile_id, p.full_name, p.avatar_path, p.color, e.season_id, e.source, e.metric,
  e.rule_id, r.name as rule_name, e.quantity, e.amount, e.base_points, e.multiplier, e.points, e.coins, e.reason,
  ev.name as special_event_name, e.occurred_at, e.created_at, e.created_by, c.full_name as created_by_name,
  e.reverses_entry_id, rev.id as reversed_by_entry_id, (rev.id is not null) as is_reversed
from public.point_entries e
join public.profiles p on p.id = e.profile_id
left join public.profiles c on c.id = e.created_by
left join public.point_rules r on r.id = e.rule_id
left join public.special_events ev on ev.id = e.special_event_id
left join public.point_entries rev on rev.reverses_entry_id = e.id;

-- 5.14 v_activity_feed
create or replace view public.v_activity_feed with (security_invoker = true, security_barrier = true) as
select f.id, f.kind, f.profile_id, p.full_name, p.avatar_path, p.color, p.job_title, f.season_id, f.payload, f.occurred_at
from public.feed_events f
left join public.profiles p on p.id = f.profile_id;

-- 5.15 v_seasons
create or replace view public.v_seasons with (security_invoker = true, security_barrier = true) as
select
  s.*,
  (now() >= s.starts_at and now() < s.ends_at) as is_current,
  (public.local_day(s.ends_at - interval '1 second') - public.local_day(s.starts_at) + 1)::int as days_total,
  greatest(least(public.local_today() - public.local_day(s.starts_at),
                 public.local_day(s.ends_at - interval '1 second') - public.local_day(s.starts_at) + 1), 0)::int as days_elapsed,
  greatest(least(public.local_day(s.ends_at - interval '1 second') - public.local_today() + 1,
                 public.local_day(s.ends_at - interval '1 second') - public.local_day(s.starts_at) + 1), 0)::int as days_left
from public.seasons s;

-- 5.16 v_special_events
create or replace view public.v_special_events with (security_invoker = true, security_barrier = true) as
select
  e.*,
  case when not e.is_active then 'inactive' when now() < e.starts_at then 'upcoming' when now() < e.ends_at then 'live' else 'ended' end as state,
  greatest(extract(epoch from e.starts_at - now()), 0)::int as seconds_to_start,
  greatest(extract(epoch from e.ends_at - now()), 0)::int as seconds_to_end
from public.special_events e
where e.deleted_at is null;

-- grants (repetidos na varredura final de 0011)
do $$
declare v text;
begin
  foreach v in array array['v_profile_stats','v_ranking','v_team_stats','v_admin_kpis','v_sales_timeline','v_mission_board','v_challenge_board',
                           'v_achievement_board','v_wheel_queue','v_wheel_history','v_redemptions','v_wallet','v_point_entries_history',
                           'v_activity_feed','v_seasons','v_special_events'] loop
    execute format('revoke all on public.%I from anon, authenticated', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- >>> 20260915000010_rpcs.sql
-- -----------------------------------------------------------------------------
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

-- Nota de implementação: lê um valor monetário de um patch jsonb e valida a faixa de numeric(14,2) (0 .. 999.999.999.999)
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

-- Nota de implementação: SQLSTATE cru de dado (classe 22: 22P02/22007/22003/22001) ou de integridade
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
  -- Nota de implementação: metas validadas antes de qualquer escrita (GOAL_INVALID em vez de 23514 cru)
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
    -- Nota de implementação: comparar exatamente o que o UPDATE grava (lower(trim())) — e-mail com espaços não pode
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: casts do jsonb no corpo (não no declare) para cair no handler INVALID_ARGUMENT
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: validar antes do insert para nunca vazar 23502/23514 cru (§9: RPC devolve código do catálogo)
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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

  -- Nota de implementação: valores do patch são validados/convertidos aqui para nunca vazar 22007/22P02/23514 cru (§9)
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: numeric(14,2) aceita até 999.999.999.999,99; validar o teto aqui evita 22003 cru (§9).
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: casts do jsonb no corpo (não no declare) para cair no handler INVALID_ARGUMENT
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: casts do jsonb no corpo (não no declare) para cair no handler INVALID_ARGUMENT
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: cada item precisa ser objeto com sort_order inteiro >= 0 — a fase 1 usa o espaço negativo
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
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

-- -----------------------------------------------------------------------------
-- >>> 20260915000011_rls.sql
-- -----------------------------------------------------------------------------
-- 0011 — RLS: enable + policies (DATA-MODEL §10) + varredura final de privilégios (§2.2) + grants explícitos (§6.1/§7.9/§10).
-- me = (select auth.uid()); member = (select public.is_active_member()); admin = (select public.is_admin()).
-- Toda policy "própria" é member and (...). Única exceção: SELECT da própria linha em profiles (member or id = me).

-- =============================================================================
-- enable RLS em todas as tabelas de public
-- =============================================================================
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;

-- =============================================================================
-- policies
-- =============================================================================
-- app_settings
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated using ((select public.is_active_member()));
drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- app_secrets
drop policy if exists app_secrets_select on public.app_secrets;
create policy app_secrets_select on public.app_secrets for select to authenticated using ((select public.is_admin()));
drop policy if exists app_secrets_update on public.app_secrets;
create policy app_secrets_update on public.app_secrets for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- seasons
drop policy if exists seasons_select on public.seasons;
create policy seasons_select on public.seasons for select to authenticated using ((select public.is_active_member()));

-- season_goals
drop policy if exists season_goals_select on public.season_goals;
create policy season_goals_select on public.season_goals for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));
drop policy if exists season_goals_insert on public.season_goals;
create policy season_goals_insert on public.season_goals for insert to authenticated with check ((select public.is_admin()));
drop policy if exists season_goals_update on public.season_goals;
create policy season_goals_update on public.season_goals for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- season_results
drop policy if exists season_results_select on public.season_results;
create policy season_results_select on public.season_results for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((select public.is_active_member()) or id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using ((select public.is_active_member()) and (id = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_member()) and (id = (select auth.uid()) or (select public.is_admin())));

-- profile_private
drop policy if exists profile_private_select on public.profile_private;
create policy profile_private_select on public.profile_private for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));
drop policy if exists profile_private_update on public.profile_private;
create policy profile_private_update on public.profile_private for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- profile_season_stats
drop policy if exists profile_season_stats_select on public.profile_season_stats;
create policy profile_season_stats_select on public.profile_season_stats for select to authenticated using ((select public.is_active_member()));

-- profile_lifetime_stats
drop policy if exists profile_lifetime_stats_select on public.profile_lifetime_stats;
create policy profile_lifetime_stats_select on public.profile_lifetime_stats for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- point_rules
drop policy if exists point_rules_select on public.point_rules;
create policy point_rules_select on public.point_rules for select to authenticated using ((select public.is_active_member()));
drop policy if exists point_rules_insert on public.point_rules;
create policy point_rules_insert on public.point_rules for insert to authenticated with check ((select public.is_admin()));
drop policy if exists point_rules_update on public.point_rules;
create policy point_rules_update on public.point_rules for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- point_entries
drop policy if exists point_entries_select on public.point_entries;
create policy point_entries_select on public.point_entries for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));
drop policy if exists point_entries_insert on public.point_entries;
create policy point_entries_insert on public.point_entries for insert to authenticated with check ((select public.is_admin()));

-- milestone_awards
drop policy if exists milestone_awards_select on public.milestone_awards;
create policy milestone_awards_select on public.milestone_awards for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- special_events
drop policy if exists special_events_select on public.special_events;
create policy special_events_select on public.special_events for select to authenticated using ((select public.is_active_member()));
drop policy if exists special_events_insert on public.special_events;
create policy special_events_insert on public.special_events for insert to authenticated with check ((select public.is_admin()));
drop policy if exists special_events_update on public.special_events;
create policy special_events_update on public.special_events for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- profile_boosts
drop policy if exists profile_boosts_select on public.profile_boosts;
create policy profile_boosts_select on public.profile_boosts for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- missions
drop policy if exists missions_select on public.missions;
create policy missions_select on public.missions for select to authenticated using ((select public.is_active_member()));
drop policy if exists missions_insert on public.missions;
create policy missions_insert on public.missions for insert to authenticated with check ((select public.is_admin()));
drop policy if exists missions_update on public.missions;
create policy missions_update on public.missions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- mission_participants
drop policy if exists mission_participants_select on public.mission_participants;
create policy mission_participants_select on public.mission_participants for select to authenticated using ((select public.is_active_member()));
drop policy if exists mission_participants_insert on public.mission_participants;
create policy mission_participants_insert on public.mission_participants for insert to authenticated with check ((select public.is_admin()));
drop policy if exists mission_participants_delete on public.mission_participants;
create policy mission_participants_delete on public.mission_participants for delete to authenticated using ((select public.is_admin()));

-- mission_progress
drop policy if exists mission_progress_select on public.mission_progress;
create policy mission_progress_select on public.mission_progress for select to authenticated using ((select public.is_active_member()));

-- challenges
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select to authenticated using ((select public.is_active_member()));
drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges for insert to authenticated with check ((select public.is_admin()));
drop policy if exists challenges_update on public.challenges;
create policy challenges_update on public.challenges for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- challenge_participants
drop policy if exists challenge_participants_select on public.challenge_participants;
create policy challenge_participants_select on public.challenge_participants for select to authenticated using ((select public.is_active_member()));
drop policy if exists challenge_participants_insert on public.challenge_participants;
create policy challenge_participants_insert on public.challenge_participants for insert to authenticated with check ((select public.is_admin()));
drop policy if exists challenge_participants_delete on public.challenge_participants;
create policy challenge_participants_delete on public.challenge_participants for delete to authenticated using ((select public.is_admin()));

-- challenge_results
drop policy if exists challenge_results_select on public.challenge_results;
create policy challenge_results_select on public.challenge_results for select to authenticated using ((select public.is_active_member()));

-- wheels
drop policy if exists wheels_select on public.wheels;
create policy wheels_select on public.wheels for select to authenticated using ((select public.is_active_member()));
drop policy if exists wheels_update on public.wheels;
create policy wheels_update on public.wheels for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- wheel_prizes
drop policy if exists wheel_prizes_select on public.wheel_prizes;
create policy wheel_prizes_select on public.wheel_prizes for select to authenticated using ((select public.is_active_member()));
drop policy if exists wheel_prizes_insert on public.wheel_prizes;
create policy wheel_prizes_insert on public.wheel_prizes for insert to authenticated with check ((select public.is_admin()));
drop policy if exists wheel_prizes_update on public.wheel_prizes;
create policy wheel_prizes_update on public.wheel_prizes for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- wheel_queue
drop policy if exists wheel_queue_select on public.wheel_queue;
create policy wheel_queue_select on public.wheel_queue for select to authenticated using ((select public.is_active_member()));

-- wheel_spins
drop policy if exists wheel_spins_select on public.wheel_spins;
create policy wheel_spins_select on public.wheel_spins for select to authenticated
  using ((select public.is_active_member()) and (status in ('approved', 'pending') or profile_id = (select auth.uid()) or (select public.is_admin())));

-- rewards
drop policy if exists rewards_select on public.rewards;
create policy rewards_select on public.rewards for select to authenticated using ((select public.is_active_member()));
drop policy if exists rewards_insert on public.rewards;
create policy rewards_insert on public.rewards for insert to authenticated with check ((select public.is_admin()));
drop policy if exists rewards_update on public.rewards;
create policy rewards_update on public.rewards for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- reward_redemptions
drop policy if exists reward_redemptions_select on public.reward_redemptions;
create policy reward_redemptions_select on public.reward_redemptions for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- achievements
drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements for select to authenticated using ((select public.is_active_member()));
drop policy if exists achievements_insert on public.achievements;
create policy achievements_insert on public.achievements for insert to authenticated with check ((select public.is_admin()));
drop policy if exists achievements_update on public.achievements;
create policy achievements_update on public.achievements for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- profile_achievements
drop policy if exists profile_achievements_select on public.profile_achievements;
create policy profile_achievements_select on public.profile_achievements for select to authenticated using ((select public.is_active_member()));

-- feed_events
drop policy if exists feed_events_select on public.feed_events;
create policy feed_events_select on public.feed_events for select to authenticated using ((select public.is_active_member()));

-- notifications
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using ((select public.is_active_member()) and profile_id = (select auth.uid()));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using ((select public.is_active_member()) and profile_id = (select auth.uid()))
  with check ((select public.is_active_member()) and profile_id = (select auth.uid()));

-- audit_log
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using ((select public.is_admin()));

-- =============================================================================
-- Varredura final de segurança (§2.2): revoga tudo e reaplica só os grants explícitos
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;

-- tabelas: select
grant select on public.app_settings, public.app_secrets, public.seasons, public.season_goals, public.season_results, public.profiles,
  public.profile_private, public.profile_season_stats, public.profile_lifetime_stats, public.point_rules, public.point_entries,
  public.milestone_awards, public.special_events, public.profile_boosts, public.missions, public.mission_participants, public.mission_progress,
  public.challenges, public.challenge_participants, public.challenge_results, public.wheels, public.wheel_prizes, public.wheel_queue,
  public.wheel_spins, public.rewards, public.reward_redemptions, public.achievements, public.profile_achievements, public.feed_events,
  public.notifications, public.audit_log
to authenticated;

-- tabelas: insert
grant insert on public.season_goals, public.point_rules, public.point_entries, public.special_events, public.missions, public.mission_participants,
  public.challenges, public.challenge_participants, public.wheel_prizes, public.rewards, public.achievements
to authenticated;

-- tabelas: update (inteiro)
grant update on public.app_settings, public.app_secrets, public.season_goals, public.profile_private, public.point_rules, public.special_events,
  public.missions, public.challenges, public.wheels, public.wheel_prizes, public.rewards, public.achievements
to authenticated;

-- tabelas: update por coluna
grant update (full_name, avatar_path, color, preferences) on public.profiles to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- tabelas: delete (únicas exceções)
grant delete on public.mission_participants, public.challenge_participants to authenticated;

-- views: só select
grant select on public.v_profile_stats, public.v_ranking, public.v_team_stats, public.v_admin_kpis, public.v_sales_timeline, public.v_mission_board,
  public.v_challenge_board, public.v_achievement_board, public.v_wheel_queue, public.v_wheel_history, public.v_redemptions, public.v_wallet,
  public.v_point_entries_history, public.v_activity_feed, public.v_seasons, public.v_special_events
to authenticated;

-- funções de public: todas para authenticated; signup_mode/validate_team_code também para anon
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('grant execute on function %s to authenticated', f.sig);
    if f.proname in ('signup_mode', 'validate_team_code') then
      execute format('grant execute on function %s to anon', f.sig);
    end if;
  end loop;
end $$;

-- trigger em auth.users roda como supabase_auth_admin
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema private to supabase_auth_admin;
    grant execute on function private.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- >>> 20260915000012_storage_realtime.sql
-- -----------------------------------------------------------------------------
-- 0012_storage_realtime.sql — DATA-MODEL §11 (Storage) e §12 (Realtime)
-- Bucket único `avatars` (público para leitura direta, sem SVG/GIF), 4 policies em
-- storage.objects e a publication supabase_realtime. Tudo idempotente e guardado
-- para rodar tanto no Supabase quanto no PGlite (harness com shim de storage).

-- ---------------------------------------------------------------------------
-- 11. Storage — bucket `avatars`
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1572864, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- public.avatar_count(uuid) é criada em 0006_helpers.sql (security definer, grant a
-- authenticated). Garantia extra caso a migration seja aplicada isolada:
create or replace function public.avatar_count(p_uid uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = p_uid::text;
$$;
revoke execute on function public.avatar_count(uuid) from public, anon;
grant execute on function public.avatar_count(uuid) to authenticated;

-- Policies em storage.objects (nenhuma para anon/public: list/download exigem membro ativo;
-- a leitura direta do objeto em bucket público não passa por policy).
drop policy if exists avatars_select_members on storage.objects;
create policy avatars_select_members on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (select public.is_active_member()));

drop policy if exists avatars_insert_own_or_admin on storage.objects;
create policy avatars_insert_own_or_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (
        (select public.is_active_member())
        and name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$')
        and (select public.avatar_count((select auth.uid()))) < 3
      )
      or (
        (select public.is_admin())
        and name ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$'
      )
    )
  );

drop policy if exists avatars_update_own_or_admin on storage.objects;
create policy avatars_update_own_or_admin on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (
        (select public.is_active_member())
        and name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$')
      )
      or (
        (select public.is_admin())
        and name ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$'
      )
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (
        (select public.is_active_member())
        and name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$')
        and (select public.avatar_count((select auth.uid()))) < 3
      )
      or (
        (select public.is_admin())
        and name ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$'
      )
    )
  );

drop policy if exists avatars_delete_own_or_admin on storage.objects;
create policy avatars_delete_own_or_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (select public.is_active_member())
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

-- ---------------------------------------------------------------------------
-- 12. Realtime — publication supabase_realtime (guardada: no PGlite pode não existir)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['wheel_queue', 'wheel_spins', 'wheel_prizes', 'notifications', 'feed_events'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

alter table public.wheel_queue replica identity full;
alter table public.wheel_spins replica identity full;
alter table public.wheel_prizes replica identity full;
alter table public.notifications replica identity full;

-- -----------------------------------------------------------------------------
-- >>> 20260915000013_seed.sql
-- -----------------------------------------------------------------------------
-- 0013_seed.sql — DATA-MODEL §13 (catálogo e configuração)
-- Cria APENAS catálogo e configuração. Nenhuma pessoa, perfil, lançamento, missão,
-- desafio, giro, resgate, fila ou notificação fictícia. Todo insert é idempotente
-- (on conflict do nothing / where not exists) e usa chaves naturais estáveis
-- (code, kind, lower(name)); linhas apagadas pelo gestor (deleted_at) NÃO voltam.

-- 13.1 app_settings (singleton)
insert into public.app_settings (
  id, company_name, xp_per_level, currency, timezone,
  target_conversion_pct, target_attendance_pct, target_crm_pct, target_activities_count,
  rank_admins, auto_approve_members
)
values (1, 'Orbion', 400, 'BRL', 'America/Sao_Paulo', 25, 70, 95, 1000, true, false)
on conflict (id) do nothing;

-- 13.2 app_secrets (singleton) — team_code aleatório gerado NESTA execução;
-- numa reexecução a linha já existe e o código é preservado.
insert into public.app_secrets (id, team_code, bootstrap_email, bootstrap_done)
values (1, upper(encode(extensions.gen_random_bytes(6), 'hex')), null, false)
on conflict (id) do nothing;

-- 13.3 seasons — uma temporada ativa nomeada pelo mês corrente (America/Sao_Paulo),
-- do 1º dia 00:00 local até o 1º dia do mês seguinte (exclusivo). Só na instalação nova.
insert into public.seasons (name, starts_at, ends_at, team_goal_amount, xp_per_level, is_active)
select
  (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'])
    [extract(month from (now() at time zone 'America/Sao_Paulo'))::int]
  || ' ' || extract(year from (now() at time zone 'America/Sao_Paulo'))::int,
  date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo',
  (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo',
  0, 400, true
where not exists (select 1 from public.seasons);

-- 13.4 point_rules (10 regras; coins = points)
insert into public.point_rules (name, metric, points, coins, trigger_kind, amount_step, requires_amount, sort_order)
select v.name, v.metric::public.metric_type, v.points, v.coins, v.trigger_kind::public.rule_trigger_kind,
       v.amount_step, v.requires_amount, v.sort_order
from (values
  ('Reunião agendada',   'meeting_scheduled', 10,  10,  'manual',           null::numeric, false, 1),
  ('Reunião realizada',  'meeting_held',      20,  20,  'manual',           null,          false, 2),
  ('Venda realizada',    'sale',              100, 100, 'manual',           null,          true,  3),
  ('R$ 10.000 vendidos', 'amount_step',       150, 150, 'auto_amount_step', 10000,         false, 4),
  ('Meta semanal',       'weekly_goal',       200, 200, 'manual',           null,          false, 5),
  ('Meta mensal',        'monthly_goal',      500, 500, 'auto_goal',        null,          false, 6),
  ('CRM atualizado',     'crm_update',        10,  10,  'manual',           null,          false, 7),
  ('Recuperação de lead','lead_recovery',     30,  30,  'manual',           null,          false, 8),
  ('Upsell',             'upsell',            80,  80,  'manual',           null,          false, 9),
  ('Ligação realizada',  'call',              5,   5,   'manual',           null,          false, 10)
) as v(name, metric, points, coins, trigger_kind, amount_step, requires_amount, sort_order)
where not exists (select 1 from public.point_rules r where lower(r.name) = lower(v.name));

-- 13.5 wheels (2)
insert into public.wheels (kind, name)
values ('classic', 'Roleta Clássica'), ('premium', 'Roleta Premium')
on conflict (kind) do nothing;

-- 13.5 wheel_prizes — Clássica (6) e Premium (8), peso 1 cada
insert into public.wheel_prizes (wheel_id, label, kind, value, weight, color, sort_order)
select w.id, v.label, v.kind::public.prize_kind, v.value, 1, v.color, v.sort_order
from (values
  ('classic', 0, 'R$ 10 PIX',   'cash',       10::numeric, '#F97316'),
  ('classic', 1, '100 pontos',  'points',     100,         '#22C55E'),
  ('classic', 2, 'R$ 20 PIX',   'cash',       20,          '#3B82F6'),
  ('classic', 3, 'Giro extra',  'extra_spin', null,        '#A855F7'),
  ('classic', 4, 'R$ 30 iFood', 'voucher',    30,          '#EF4444'),
  ('classic', 5, '200 pontos',  'points',     200,         '#EAB308'),
  ('premium', 0, 'R$ 50 PIX',   'cash',       50,          '#F97316'),
  ('premium', 1, '500 pontos',  'points',     500,         '#22C55E'),
  ('premium', 2, 'R$ 100 PIX',  'cash',       100,         '#3B82F6'),
  ('premium', 3, 'Giro extra',  'extra_spin', null,        '#A855F7'),
  ('premium', 4, 'R$ 50 iFood', 'voucher',    50,          '#EF4444'),
  ('premium', 5, '1.000 pontos','points',     1000,        '#EAB308'),
  ('premium', 6, '2x pontos',   'multiplier', 2,           '#14B8A6'),
  ('premium', 7, 'Mystery Box', 'mystery',    null,        '#EC4899')
) as v(wheel_kind, sort_order, label, kind, value, color)
join public.wheels w on w.kind = v.wheel_kind::public.wheel_kind
where not exists (
  select 1 from public.wheel_prizes p where p.wheel_id = w.id and p.sort_order = v.sort_order
);

-- 13.6 achievements (6)
insert into public.achievements (code, title, description, icon, criteria, criteria_value, scope, reward_points, reward_coins, sort_order)
select v.code, v.title, v.description, v.icon, v.criteria::public.achievement_criteria, v.criteria_value,
       v.scope::public.achievement_scope, v.reward_points, v.reward_coins, v.sort_order
from (values
  ('first_sale',   'PRIMEIRA VENDA', 'Realize sua primeira venda',          '🎯', 'first_sale',   null::numeric, 'lifetime', 50,  50,  1),
  ('on_fire',      'EM CHAMAS',      '7 dias consecutivos com atividade',   '🔥', 'streak_days',  7,             'lifetime', 100, 100, 2),
  ('club_50k',     '50K CLUB',       'R$ 50.000 vendidos',                  '💎', 'sales_total',  50000,         'lifetime', 300, 300, 3),
  ('goal_reached', 'META BATIDA',    'Bateu a meta mensal',                 '✅', 'monthly_goal', null,          'season',   200, 200, 4),
  ('champion',     'CAMPEÃO',        '1º lugar no mês',                     '🏆', 'rank_first',   null,          'season',   500, 500, 5),
  ('club_100k',    '100K CLUB',      'R$ 100.000 vendidos',                 '👑', 'sales_total',  100000,        'lifetime', 600, 600, 6)
) as v(code, title, description, icon, criteria, criteria_value, scope, reward_points, reward_coins, sort_order)
on conflict (code) do nothing;

-- 13.7 rewards (7) — loja
insert into public.rewards (name, category, value_amount, cost_coins, stock, icon, sort_order)
select v.name, v.category, v.value_amount, v.cost_coins, v.stock, v.icon, v.sort_order
from (values
  ('R$ 20 iFood',        'Voucher',   20::numeric, 500,  null::int, '🍔', 1),
  ('R$ 50 iFood',        'Voucher',   50,          1000, null,      '🍕', 2),
  ('R$ 50 PIX',          'PIX',       50,          1200, null,      '💸', 3),
  ('R$ 100 PIX',         'PIX',       100,         2200, null,      '💰', 4),
  ('Almoço pago',        'Benefício', null,        1500, null,      '🍽️', 5),
  ('Sair 2h mais cedo',  'Benefício', null,        1800, null,      '⏰', 6),
  ('Day Off',            'Benefício', null,        5000, null,      '🏖️', 7)
) as v(name, category, value_amount, cost_coins, stock, icon, sort_order)
where not exists (select 1 from public.rewards r where lower(r.name) = lower(v.name));

-- 13.8 O seed NÃO cria: profiles, profile_private, season_goals, point_entries, missions,
-- challenges, special_events, wheel_queue, wheel_spins, reward_redemptions,
-- profile_achievements, feed_events, notifications, audit_log (fora dos triggers de auditoria
-- das próprias linhas de catálogo acima).

-- -----------------------------------------------------------------------------
-- >>> 20260921000014_branding.sql
-- -----------------------------------------------------------------------------
-- =============================================================================
-- 14. Marca (white-label): nome da plataforma, preset de cor, logo e tema padrão
--     em app_settings + RPC pública get_branding() para a tela de login (anon).
-- =============================================================================

alter table public.app_settings
  add column if not exists platform_name text not null default 'Sales League'
    check (length(platform_name) between 1 and 40),
  add column if not exists brand_preset text not null default 'esmeralda'
    check (brand_preset in ('esmeralda', 'safira', 'ametista', 'ambar', 'coral', 'ciano', 'rosa')),
  -- data-URL (PNG/JPEG/WebP/SVG) de até ~200 KB: fica na própria linha, sem bucket no Storage
  add column if not exists logo_data_url text
    check (logo_data_url is null or (logo_data_url ~ '^data:image/(png|jpeg|webp|svg\+xml);base64,' and length(logo_data_url) <= 280000)),
  add column if not exists default_theme text not null default 'dark'
    check (default_theme in ('dark', 'light'));

-- 14.1 update_app_settings: aceita os campos novos (logo_data_url pode ser apagado com null)
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
                     'target_crm_pct', 'target_activities_count', 'rank_admins', 'auto_approve_members',
                     'platform_name', 'brand_preset', 'logo_data_url', 'default_theme') then
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
    auto_approve_members = coalesce((p_patch ->> 'auto_approve_members')::boolean, a.auto_approve_members),
    platform_name = coalesce(p_patch ->> 'platform_name', a.platform_name),
    brand_preset = coalesce(p_patch ->> 'brand_preset', a.brand_preset),
    logo_data_url = case when p_patch ? 'logo_data_url' then p_patch ->> 'logo_data_url' else a.logo_data_url end,
    default_theme = coalesce(p_patch ->> 'default_theme', a.default_theme)
  where a.id = 1
  returning a.* into v_row;
  -- a logo (até 280 KB) não vai para o audit: só o fato de ter mudado
  perform private.audit('rpc', 'update_app_settings', '1', null,
    case when p_patch ? 'logo_data_url'
      then (p_patch - 'logo_data_url') || jsonb_build_object('logo_data_url', case when p_patch ->> 'logo_data_url' is null then null else '<logo>' end)
      else p_patch end);
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

-- 14.2 get_branding(): só o que a tela de login precisa mostrar antes de autenticar.
--      Executável por anon. Nunca expõe metas, fuso, código de equipe ou qualquer outra coluna.
create or replace function public.get_branding()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'company_name', a.company_name,
    'platform_name', a.platform_name,
    'brand_preset', a.brand_preset,
    'logo_data_url', a.logo_data_url,
    'default_theme', a.default_theme
  )
  from public.app_settings a where a.id = 1;
$$;

revoke execute on function public.get_branding() from public;
grant execute on function public.get_branding() to anon, authenticated;

commit;
