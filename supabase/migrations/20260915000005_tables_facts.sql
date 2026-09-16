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

-- DECISIONS.md (SQL fixer r2): estorno de rule/manual/system nasce com source = 'system' (§7.4) e herda rule_id
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
