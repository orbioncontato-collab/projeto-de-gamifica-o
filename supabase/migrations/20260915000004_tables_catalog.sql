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
