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
