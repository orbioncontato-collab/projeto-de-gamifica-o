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
