/**
 * Tipos do banco escritos à mão a partir de docs/spec/DATA-MODEL.md (§3 enums, §4 tabelas, §5 views, §7 RPCs).
 * Formato compatível com `supabase gen types` para troca futura sem mexer no app (FRONTEND-ARCH §4.2).
 * Regras: Row = colunas exatamente como em DATA-MODEL §4 (NN → não-null, — → | null); Insert/Update só
 * para tabelas que o front escreve diretamente por policy; o resto é `never` (tudo passa por RPC).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ---------------------------------------------------------------------------
// Enums (DATA-MODEL §3 — 22 enums)
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'collaborator'
export type ProfileStatus = 'active' | 'inactive' | 'pending'
export type JobTitle = 'sdr' | 'closer' | 'social_seller' | 'supervisor' | 'manager'
export type MetricType =
  | 'sale'
  | 'meeting_scheduled'
  | 'meeting_held'
  | 'call'
  | 'crm_update'
  | 'lead_recovery'
  | 'upsell'
  | 'amount_step'
  | 'weekly_goal'
  | 'monthly_goal'
  | 'activity'
  | 'custom'
export type RuleTriggerKind = 'manual' | 'auto_amount_step' | 'auto_goal'
export type EntrySource = 'rule' | 'manual' | 'system' | 'mission' | 'challenge' | 'wheel' | 'reward' | 'achievement'
export type MissionKind = 'daily' | 'weekly' | 'special' | 'lightning'
export type MissionTargetKind = 'count' | 'amount'
export type MissionAudience = 'all' | 'selected'
export type ChallengeKind = 'duel' | 'team'
export type ChallengeMetric = 'meetings_held' | 'sales_count' | 'revenue' | 'points' | 'activities'
export type ChallengeStatus = 'draft' | 'active' | 'finished' | 'cancelled'
export type WheelKind = 'classic' | 'premium'
export type PrizeKind = 'points' | 'coins' | 'cash' | 'voucher' | 'extra_spin' | 'multiplier' | 'mystery' | 'custom'
export type QueueStatus = 'waiting' | 'active' | 'done' | 'removed'
export type QueueSource = 'manual' | 'earned'
export type SpinStatus = 'pending' | 'approved' | 'rejected'
export type RedemptionSource = 'store' | 'wheel'
export type RedemptionStatus = 'requested' | 'approved' | 'delivered' | 'cancelled'
export type AchievementCriteria =
  | 'first_sale'
  | 'streak_days'
  | 'sales_total'
  | 'monthly_goal'
  | 'rank_first'
  | 'points_total'
  | 'missions_completed'
export type AchievementScope = 'lifetime' | 'season'
export type FeedKind =
  | 'sale'
  | 'achievement'
  | 'wheel_prize'
  | 'level_up'
  | 'mission_completed'
  | 'challenge_finished'
  | 'season_closed'
export type NotificationKind =
  | 'ranking'
  | 'mission'
  | 'reward'
  | 'wheel'
  | 'challenge'
  | 'achievement'
  | 'level'
  | 'event'
  | 'season'
  | 'system'
export type AuditAction = 'insert' | 'update' | 'delete' | 'rpc'

// ---------------------------------------------------------------------------
// Rows (DATA-MODEL §4 — 31 tabelas)
// ---------------------------------------------------------------------------

export interface ProfilePreferences {
  notifications: boolean
  event_alerts: boolean
}

export interface AppSettingsRow {
  id: number
  company_name: string
  xp_per_level: number
  currency: string
  timezone: string
  target_conversion_pct: number
  target_attendance_pct: number
  target_crm_pct: number
  target_activities_count: number
  streak_business_days_only: boolean
  rank_admins: boolean
  auto_approve_members: boolean
  updated_at: string
  updated_by: string | null
}

export interface AppSecretsRow {
  id: number
  team_code: string
  team_code_rotated_at: string
  bootstrap_email: string | null
  bootstrap_done: boolean
  updated_at: string
  updated_by: string | null
}

export interface SeasonRow {
  id: string
  name: string
  starts_at: string
  ends_at: string
  team_goal_amount: number
  xp_per_level: number
  is_active: boolean
  closed_at: string | null
  closed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SeasonGoalRow {
  season_id: string
  profile_id: string
  goal_amount: number
  updated_at: string
  updated_by: string | null
}
export interface SeasonGoalInsert {
  season_id: string
  profile_id: string
  goal_amount?: number
}

export interface SeasonResultRow {
  season_id: string
  profile_id: string
  final_rank: number | null
  final_points: number
  sales_amount: number
  sales_count: number
  goal_amount: number
  goal_reached: boolean
  level: number
  created_at: string
}

export interface ProfileRow {
  id: string
  full_name: string
  avatar_path: string | null
  color: string
  job_title: JobTitle
  team: string | null
  role: UserRole
  status: ProfileStatus
  preferences: ProfilePreferences
  created_at: string
  updated_at: string
}

export interface ProfilePrivateRow {
  profile_id: string
  email: string
  phone: string | null
  default_goal_amount: number
  notes: string | null
  updated_at: string
  updated_by: string | null
}

export interface ProfileSeasonStatsRow {
  profile_id: string
  season_id: string
  points: number
  points_earned: number
  points_updated_at: string | null
  coins_earned: number
  coins_spent: number
  sales_amount: number
  sales_count: number
  meetings_scheduled: number
  meetings_held: number
  calls: number
  crm_updates: number
  lead_recoveries: number
  upsells: number
  activities_count: number
  missions_completed: number
  last_entry_at: string | null
  updated_at: string
}

export interface ProfileLifetimeStatsRow {
  profile_id: string
  coins_earned: number
  coins_spent: number
  coins_balance: number
  sales_amount: number
  sales_count: number
  first_sale_at: string | null
  missions_completed: number
  streak_days: number
  streak_last_day: string | null
  best_streak_days: number
  updated_at: string
}

export interface PointRuleRow {
  id: string
  name: string
  metric: MetricType
  points: number
  coins: number
  trigger_kind: RuleTriggerKind
  amount_step: number | null
  requires_amount: boolean
  is_active: boolean
  sort_order: number
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}
export interface PointRuleInsert {
  id?: string
  name: string
  metric?: MetricType
  points: number
  coins: number
  trigger_kind?: RuleTriggerKind
  amount_step?: number | null
  requires_amount?: boolean
  is_active?: boolean
  sort_order?: number
}

export interface PointEntryRow {
  id: string
  profile_id: string
  season_id: string
  rule_id: string | null
  metric: MetricType | null
  quantity: number
  amount: number | null
  base_points: number
  multiplier: number
  points: number
  coins: number
  source: EntrySource
  reason: string | null
  special_event_id: string | null
  boost_id: string | null
  reverses_entry_id: string | null
  occurred_at: string
  created_by: string | null
  created_at: string
}

export interface MilestoneAwardRow {
  profile_id: string
  season_id: string
  metric: MetricType
  period_key: string
  entry_id: string
  created_at: string
}

export interface SpecialEventRow {
  id: string
  name: string
  description: string | null
  multiplier: number
  starts_at: string
  ends_at: string
  is_active: boolean
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ProfileBoostRow {
  id: string
  profile_id: string
  multiplier: number
  starts_at: string
  expires_at: string
  spin_id: string
  created_at: string
}

export interface MissionRow {
  id: string
  season_id: string
  title: string
  description: string | null
  icon: string | null
  kind: MissionKind
  metric: MetricType
  target_kind: MissionTargetKind
  target_value: number
  reward_points: number
  reward_coins: number
  reward_spin: WheelKind | null
  starts_at: string
  ends_at: string
  audience: MissionAudience
  is_active: boolean
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface MissionParticipantRow {
  mission_id: string
  profile_id: string
}

export interface MissionProgressRow {
  mission_id: string
  profile_id: string
  period_key: string
  period_start: string
  period_end: string
  value: number
  completed_at: string | null
  entry_id: string | null
  queue_id: string | null
  updated_at: string
}

export interface ChallengeRow {
  id: string
  season_id: string
  name: string
  description: string | null
  kind: ChallengeKind
  metric: ChallengeMetric
  target_value: number
  reward_points: number
  reward_coins: number
  reward_spin: WheelKind | null
  reward_description: string | null
  starts_at: string
  ends_at: string
  status: ChallengeStatus
  winner_ids: string[]
  activated_at: string | null
  finished_at: string | null
  cancelled_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ChallengeParticipantRow {
  challenge_id: string
  profile_id: string
  current_value: number
  updated_at: string
}

export interface ChallengeResultRow {
  challenge_id: string
  profile_id: string
  final_value: number
  is_winner: boolean
  entry_id: string | null
  queue_id: string | null
  created_at: string
}

export interface WheelRow {
  id: string
  kind: WheelKind
  name: string
  is_active: boolean
  updated_at: string
}

export interface WheelPrizeRow {
  id: string
  wheel_id: string
  label: string
  kind: PrizeKind
  value: number | null
  weight: number
  color: string | null
  sort_order: number
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface WheelQueueRow {
  id: string
  profile_id: string | null
  person_name: string
  wheel_id: string
  attempts_allowed: number
  attempts_used: number
  status: QueueStatus
  source: QueueSource
  reference_kind: string | null
  reference_id: string | null
  released_at: string | null
  finished_at: string | null
  removed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WheelSpinRow {
  id: string
  queue_id: string
  profile_id: string | null
  person_name: string
  wheel_id: string
  attempt_index: number
  prize_id: string
  prize_label: string
  prize_kind: PrizeKind
  prize_value: number | null
  resolved_prize_id: string
  resolved_label: string
  resolved_kind: PrizeKind
  resolved_value: number | null
  random_value: number
  prizes_hash: string
  status: SpinStatus
  spun_by: string | null
  spun_at: string
  approved_by: string | null
  approved_at: string | null
  entry_id: string | null
  redemption_id: string | null
  boost_id: string | null
  credited: boolean
}

export interface RewardRow {
  id: string
  name: string
  category: string | null
  value_amount: number | null
  cost_coins: number
  stock: number | null
  icon: string | null
  is_active: boolean
  sort_order: number
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}
export interface RewardInsert {
  id?: string
  name: string
  category?: string | null
  value_amount?: number | null
  cost_coins: number
  stock?: number | null
  icon?: string | null
  is_active?: boolean
  sort_order?: number
}

export interface RewardRedemptionRow {
  id: string
  source: RedemptionSource
  reward_id: string | null
  spin_id: string | null
  profile_id: string | null
  person_name: string
  title: string
  cost_coins: number
  value_amount: number | null
  status: RedemptionStatus
  requested_at: string
  handled_by: string | null
  handled_at: string | null
  notes: string | null
  entry_id: string | null
  refund_entry_id: string | null
  updated_at: string
}

export interface AchievementRow {
  id: string
  code: string
  title: string
  description: string | null
  icon: string | null
  criteria: AchievementCriteria
  criteria_value: number | null
  scope: AchievementScope
  reward_points: number
  reward_coins: number
  is_active: boolean
  sort_order: number
  deleted_at: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}
export interface AchievementInsert {
  id?: string
  code: string
  title: string
  description?: string | null
  icon?: string | null
  criteria: AchievementCriteria
  criteria_value?: number | null
  scope: AchievementScope
  reward_points?: number
  reward_coins?: number
  is_active?: boolean
  sort_order?: number
}

export interface ProfileAchievementRow {
  id: string
  profile_id: string
  achievement_id: string
  season_id: string | null
  unlocked_at: string
  entry_id: string | null
  trigger_entry_id: string | null
}

export interface FeedEventRow {
  id: string
  kind: FeedKind
  profile_id: string | null
  season_id: string | null
  payload: Json
  dedupe_key: string | null
  occurred_at: string
  created_at: string
}

export interface NotificationRow {
  id: string
  profile_id: string
  kind: NotificationKind
  title: string
  message: string
  payload: Json
  is_read: boolean
  created_at: string
}

export interface AuditLogRow {
  id: number
  actor_id: string | null
  action: AuditAction
  table_name: string
  row_id: string | null
  old_data: Json | null
  new_data: Json | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Views (DATA-MODEL §5 — 16 views; agregados não-nulos por coalesce)
// ---------------------------------------------------------------------------

export interface VProfileStats {
  profile_id: string
  season_id: string
  full_name: string
  avatar_path: string | null
  color: string
  job_title: JobTitle
  team: string | null
  role: UserRole
  status: ProfileStatus
  email: string | null
  phone: string | null
  season_name: string
  season_starts_at: string
  season_ends_at: string
  season_is_active: boolean
  points: number
  points_earned: number
  sales_amount: number
  sales_count: number
  meetings_scheduled: number
  meetings_held: number
  calls: number
  crm_updates: number
  lead_recoveries: number
  upsells: number
  activities_count: number
  missions_completed: number
  conversion_pct: number | null
  attendance_pct: number | null
  goal_amount: number
  goal_pct: number | null
  goal_missing_amount: number
  projected_goal_date: string | null
  xp_per_level: number
  level: number
  xp_in_level: number
  xp_to_next: number
  coins_balance: number
  coins_earned_lifetime: number
  coins_spent_lifetime: number
  streak_days: number
  best_streak_days: number
  sales_amount_lifetime: number
  sales_count_lifetime: number
  rank: number | null
  gap_to_above: number | null
  is_tied_with_above: boolean
  has_points: boolean
  achievements_unlocked: number
  achievements_total: number
  pending_earned_spins: number
  last_entry_at: string | null
}

export interface VRanking {
  season_id: string
  rank: number
  gap_to_above: number | null
  is_tied_with_above: boolean
  has_points: boolean
  profile_id: string
  full_name: string
  avatar_path: string | null
  color: string
  job_title: JobTitle
  team: string | null
  points: number
  level: number
  sales_amount: number
  sales_count: number
  conversion_pct: number | null
  meetings_held: number
}

export interface VTeamStats {
  season_id: string
  season_name: string
  starts_at: string
  ends_at: string
  is_active: boolean
  team_goal_amount: number
  xp_per_level: number
  sales_amount: number
  attainment_pct: number | null
  sales_missing_amount: number
  points_total: number
  points_distributed: number
  active_count: number
  pending_count: number
  total_count: number
  sales_count: number
  meetings_scheduled: number
  meetings_held: number
  calls: number
  crm_updates: number
  activities_count: number
  missions_completed: number
  avg_conversion_pct: number | null
  attendance_pct: number | null
  crm_pct: number | null
  queue_count: number
  target_conversion_pct: number
  target_attendance_pct: number
  target_crm_pct: number
  target_activities_count: number
}

export interface VAdminKpis {
  season_id: string
  redemptions_delivered_amount: number
  redemptions_pending_count: number
  entries_count: number
  coins_issued: number
}

export interface VSalesTimeline {
  season_id: string
  day: string
  sales_amount: number
  sales_count: number
  sales_cum: number
  points: number
  points_cum: number
  entries_count: number
}

export interface VMissionBoard {
  mission_id: string
  season_id: string
  profile_id: string
  title: string
  description: string | null
  icon: string | null
  kind: MissionKind
  metric: MetricType
  target_kind: MissionTargetKind
  target_value: number
  reward_points: number
  reward_coins: number
  reward_spin: WheelKind | null
  starts_at: string
  ends_at: string
  audience: MissionAudience
  is_active: boolean
  is_current: boolean
  period_key: string | null
  period_start: string | null
  period_end: string | null
  progress_value: number
  progress_pct: number
  is_completed: boolean
  completed_at: string | null
  seconds_remaining: number | null
  spin_queue_status: QueueStatus | null
}

export interface ChallengeParticipant {
  profile_id: string
  full_name: string
  avatar_path: string | null
  color: string
  job_title: JobTitle
  status: ProfileStatus
  value: number
  pct: number
  is_winner: boolean
}

export interface VChallengeBoard {
  challenge_id: string
  season_id: string
  name: string
  description: string | null
  kind: ChallengeKind
  metric: ChallengeMetric
  target_value: number
  reward_points: number
  reward_coins: number
  reward_spin: WheelKind | null
  reward_description: string | null
  starts_at: string
  ends_at: string
  status: ChallengeStatus
  winner_ids: string[]
  activated_at: string | null
  finished_at: string | null
  days_left: number
  total_value: number
  total_pct: number
  participants_count: number
  participants: ChallengeParticipant[]
}

export interface VAchievementBoard {
  achievement_id: string
  profile_id: string
  code: string
  title: string
  description: string | null
  icon: string | null
  criteria: AchievementCriteria
  criteria_value: number | null
  scope: AchievementScope
  reward_points: number
  reward_coins: number
  sort_order: number
  is_unlocked: boolean
  unlocked_at: string | null
  unlocked_count: number
}

export interface VWheelQueue {
  queue_id: string
  position: number
  profile_id: string | null
  person_name: string
  avatar_path: string | null
  color: string | null
  source: QueueSource
  wheel_id: string
  wheel_kind: WheelKind
  wheel_name: string
  attempts_allowed: number
  attempts_used: number
  attempts_remaining: number
  status: QueueStatus
  released_at: string | null
  created_at: string
  pending_spin_id: string | null
  pending_prize_label: string | null
  pending_prize_kind: PrizeKind | null
  pending_resolved_label: string | null
  pending_spun_at: string | null
}

export interface VWheelHistory {
  spin_id: string
  queue_id: string
  profile_id: string | null
  person_name: string
  avatar_path: string | null
  color: string | null
  wheel_kind: WheelKind
  prize_label: string
  prize_kind: PrizeKind
  prize_value: number | null
  resolved_label: string
  resolved_kind: PrizeKind
  resolved_value: number | null
  credited: boolean
  attempt_index: number
  spun_at: string
  approved_at: string
  approved_by_name: string | null
}

export interface VRedemption {
  redemption_id: string
  source: RedemptionSource
  reward_id: string | null
  reward_icon: string | null
  reward_category: string | null
  profile_id: string | null
  person_name: string
  avatar_path: string | null
  title: string
  cost_coins: number
  value_amount: number | null
  status: RedemptionStatus
  requested_at: string
  handled_at: string | null
  handled_by_name: string | null
  notes: string | null
  spin_id: string | null
}

export interface VWallet {
  profile_id: string
  coins_balance: number
  coins_earned: number
  coins_spent: number
  coins_from_sales: number
  coins_from_missions: number
  coins_from_goals: number
  coins_from_wheel: number
  coins_from_challenges: number
  coins_from_achievements: number
  coins_from_manual: number
}

export interface VPointEntryHistory {
  entry_id: string
  profile_id: string
  full_name: string
  avatar_path: string | null
  color: string
  season_id: string
  source: EntrySource
  metric: MetricType | null
  rule_id: string | null
  rule_name: string | null
  quantity: number
  amount: number | null
  base_points: number
  multiplier: number
  points: number
  coins: number
  reason: string | null
  special_event_name: string | null
  occurred_at: string
  created_at: string
  created_by: string | null
  created_by_name: string | null
  reverses_entry_id: string | null
  reversed_by_entry_id: string | null
  is_reversed: boolean
}

/** payload de `feed_events` por `kind` (DATA-MODEL §4.29) — lido de forma defensiva em `feedSentence` */
export type FeedPayload = { [key: string]: Json | undefined }

export interface VActivityFeed {
  id: string
  kind: FeedKind
  profile_id: string | null
  full_name: string | null
  avatar_path: string | null
  color: string | null
  job_title: JobTitle | null
  season_id: string | null
  payload: FeedPayload
  occurred_at: string
}

export interface VSeason extends SeasonRow {
  is_current: boolean
  days_total: number
  days_elapsed: number
  days_left: number
}

export type SpecialEventState = 'inactive' | 'upcoming' | 'live' | 'ended'
export interface VSpecialEvent extends SpecialEventRow {
  state: SpecialEventState
  seconds_to_start: number
  seconds_to_end: number
}

// ---------------------------------------------------------------------------
// Payloads jsonb de RPCs (DATA-MODEL §7) — tipos fortes
// ---------------------------------------------------------------------------

export interface BootstrapMe {
  id: string
  full_name: string
  avatar_path: string | null
  color: string
  job_title: JobTitle
  team: string | null
  role: UserRole
  status: ProfileStatus
  preferences: ProfilePreferences
  email: string | null
  phone: string | null
  goal_amount: number
  points: number
  points_earned: number
  level: number
  xp_in_level: number
  xp_to_next: number
  xp_per_level: number
  rank: number | null
  gap_to_above: number | null
  streak_days: number
  coins_balance: number
  sales_amount: number
  sales_count: number
  meetings_held: number
  conversion_pct: number | null
  missions_completed: number
  achievements_unlocked: number
  pending_earned_spins: number
}
export interface BootstrapSeason {
  id: string
  name: string
  starts_at: string
  ends_at: string
  team_goal_amount: number
  xp_per_level: number
  is_active: boolean
  days_left: number
}
export interface BootstrapSettings {
  company_name: string
  xp_per_level: number
  currency: string
  timezone: string
  target_conversion_pct: number
  target_attendance_pct: number
  target_crm_pct: number
  target_activities_count: number
  rank_admins: boolean
}
export interface BootstrapWheel {
  active_queue_id: string | null
  active_person_name: string | null
  pending_spin_id: string | null
  my_turn: boolean
}
export interface ActiveEvent {
  id: string
  name: string
  multiplier: number
  starts_at: string
  ends_at: string
  state: 'upcoming' | 'live'
}
/** DATA-MODEL §7.1 passo 2: perfil `inactive` ou `pending` recebe só isto */
export type BootstrapMeBlocked = Pick<BootstrapMe, 'id' | 'full_name'> & { status: 'inactive' | 'pending' }
export interface BootstrapPayload {
  me: BootstrapMe | BootstrapMeBlocked
  season: BootstrapSeason | null
  settings: BootstrapSettings
  unread_notifications: number
  /** cadastros aguardando aprovação; só admin recebe > 0 — badge da sidebar */
  pending_members: number
  wheel: BootstrapWheel
  active_event: ActiveEvent | null
}
export const isBlockedMe = (me: BootstrapPayload['me']): me is BootstrapMeBlocked => me.status !== 'active'

/** profiles + embed profile_private (admin) — DATA-MODEL §10 */
export interface PendingMember {
  id: string
  full_name: string
  avatar_path: string | null
  color: string
  created_at: string
  profile_private: { email: string } | null
}

export interface NextRewardHint {
  id: string
  name: string
  icon: string | null
  cost_coins: number
  missing_coins: number
}
/** get_dashboard devolve APENAS { season: null } quando não há temporada (DATA-MODEL §7.1) */
export interface DashboardData {
  season: BootstrapSeason
  stats: VProfileStats | null
  ranking_top: VRanking[]
  missions_today: VMissionBoard[]
  next_reward: NextRewardHint | null
  pending_earned_spins: number
  active_event: ActiveEvent | null
  feed: VActivityFeed[]
}
export type DashboardPayload = { season: null } | DashboardData
export const hasDashboard = (d: DashboardPayload): d is DashboardData => d.season !== null

export interface SpinPrize {
  id: string
  label: string
  kind: PrizeKind
  value: number | null
  sort_order?: number
}
export interface SpinResultPayload {
  spin_id: string | null
  queue_id: string | null
  wheel_kind: WheelKind
  person_name: string | null
  profile_id: string | null
  avatar_path: string | null
  attempt_index: number | null
  attempts_allowed: number | null
  prize: SpinPrize
  resolved_prize: SpinPrize
  sector_index: number
  sector_count: number
  prizes_hash: string
  is_free?: true
}
export interface ApproveSpinPayload {
  spin: {
    id: string
    status: SpinStatus
    credited: boolean
    entry_id: string | null
    redemption_id: string | null
    boost_id: string | null
  }
  queue: { id: string; status: QueueStatus; attempts_used: number; attempts_allowed: number }
}
export interface RedeemPayload {
  redemption_id: string
  coins_balance: number
}
export interface FinishChallengePayload {
  challenge_id: string
  winner_ids: string[]
  results: { profile_id: string; final_value: number; is_winner: boolean; entry_id: string | null }[]
}
export interface CloseSeasonPayload {
  season_id: string
  champion_profile_id: string | null
  results: {
    profile_id: string
    final_rank: number | null
    final_points: number
    sales_amount: number
    goal_reached: boolean
  }[]
  /** 'gap_until_next_season' quando há temporada futura sem cobertura até ela (DATA-MODEL §7.3 passo 9) */
  warnings: string[]
  next_season_id?: string
  next_starts_at?: string
}
export interface AdminUpdateProfilePayload {
  profile: VProfileStats
  warnings: string[]
}
export interface RecomputeStatsPayload {
  profiles: number
  seasons: number
}
export interface RpcPayloads {
  get_bootstrap: BootstrapPayload
  get_dashboard: DashboardPayload
  spin_wheel: SpinResultPayload
  spin_wheel_free: SpinResultPayload
  approve_spin: ApproveSpinPayload
  reject_spin: ApproveSpinPayload
  redeem_reward: RedeemPayload
  finish_challenge: FinishChallengePayload
  close_season: CloseSeasonPayload
  admin_update_profile: AdminUpdateProfilePayload
  recompute_stats: RecomputeStatsPayload
}

// Inputs jsonb de RPCs
export interface AdminProfilePatch {
  full_name?: string
  avatar_path?: string | null
  color?: string
  job_title?: JobTitle
  team?: string | null
  role?: UserRole
  /** nunca 'pending' — PROFILE_STATUS_INVALID; 'active' sobre pendente = aprovar, 'inactive' = recusar */
  status?: 'active' | 'inactive'
  email?: string
  phone?: string | null
  default_goal_amount?: number
  notes?: string | null
  goal_amount?: number
}
export interface AppSettingsPatch {
  company_name?: string
  xp_per_level?: number
  currency?: string
  timezone?: string
  target_conversion_pct?: number
  target_attendance_pct?: number
  target_crm_pct?: number
  target_activities_count?: number
  rank_admins?: boolean
  auto_approve_members?: boolean
}
export interface SaveSpecialEventInput {
  id?: string
  name: string
  description?: string | null
  multiplier: number
  starts_at: string
  ends_at: string
  is_active?: boolean
}
export interface SeasonPatch {
  name?: string
  team_goal_amount?: number
  starts_on?: string
  ends_on?: string
}
export interface SaveMissionInput {
  id?: string
  title: string
  description?: string | null
  icon?: string | null
  kind: MissionKind
  metric: MetricType
  target_kind?: MissionTargetKind
  target_value: number
  reward_points?: number
  reward_coins?: number
  reward_spin?: WheelKind | null
  starts_at: string
  ends_at: string
  audience?: MissionAudience
  participant_ids?: string[]
  is_active?: boolean
}
export interface SaveChallengeInput {
  id?: string
  name: string
  description?: string | null
  kind: ChallengeKind
  metric: ChallengeMetric
  target_value: number
  reward_points?: number
  reward_coins?: number
  reward_spin?: WheelKind | null
  reward_description?: string | null
  starts_at: string
  ends_at: string
  participant_ids: string[]
}
export interface SavePrizeInput {
  id?: string
  label: string
  kind: PrizeKind
  value?: number | null
  weight?: number
  color?: string | null
  sort_order: number
  is_active?: boolean
}

// ---------------------------------------------------------------------------
// Database (formato do gerador oficial)
// ---------------------------------------------------------------------------

type NoRel = []
type Rel<T extends readonly unknown[]> = T

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: AppSettingsRow
        Insert: never
        Update: Partial<
          Pick<
            AppSettingsRow,
            | 'company_name'
            | 'xp_per_level'
            | 'currency'
            | 'timezone'
            | 'target_conversion_pct'
            | 'target_attendance_pct'
            | 'target_crm_pct'
            | 'target_activities_count'
            | 'rank_admins'
            | 'auto_approve_members'
          >
        >
        Relationships: NoRel
      }
      app_secrets: { Row: AppSecretsRow; Insert: never; Update: never; Relationships: NoRel }
      seasons: { Row: SeasonRow; Insert: never; Update: never; Relationships: NoRel }
      season_goals: {
        Row: SeasonGoalRow
        Insert: SeasonGoalInsert
        Update: Partial<SeasonGoalInsert>
        Relationships: Rel<
          [
            {
              foreignKeyName: 'season_goals_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'season_goals_season_id_fkey'
              columns: ['season_id']
              isOneToOne: false
              referencedRelation: 'seasons'
              referencedColumns: ['id']
            },
          ]
        >
      }
      season_results: { Row: SeasonResultRow; Insert: never; Update: never; Relationships: NoRel }
      profiles: {
        Row: ProfileRow
        Insert: never
        Update: Partial<Pick<ProfileRow, 'full_name' | 'avatar_path' | 'color' | 'preferences'>>
        Relationships: NoRel
      }
      profile_private: {
        Row: ProfilePrivateRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'profile_private_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: true
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
          ]
        >
      }
      profile_season_stats: {
        Row: ProfileSeasonStatsRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'profile_season_stats_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
          ]
        >
      }
      profile_lifetime_stats: {
        Row: ProfileLifetimeStatsRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'profile_lifetime_stats_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: true
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
          ]
        >
      }
      point_rules: {
        Row: PointRuleRow
        Insert: PointRuleInsert
        Update: Partial<PointRuleInsert> & { deleted_at?: string | null }
        Relationships: NoRel
      }
      point_entries: {
        Row: PointEntryRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'point_entries_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'point_entries_created_by_fkey'
              columns: ['created_by']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'point_entries_rule_id_fkey'
              columns: ['rule_id']
              isOneToOne: false
              referencedRelation: 'point_rules'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'point_entries_season_id_fkey'
              columns: ['season_id']
              isOneToOne: false
              referencedRelation: 'seasons'
              referencedColumns: ['id']
            },
          ]
        >
      }
      milestone_awards: { Row: MilestoneAwardRow; Insert: never; Update: never; Relationships: NoRel }
      special_events: {
        Row: SpecialEventRow
        Insert: never
        Update: Pick<SpecialEventRow, 'is_active'> & { deleted_at?: string | null }
        Relationships: NoRel
      }
      profile_boosts: { Row: ProfileBoostRow; Insert: never; Update: never; Relationships: NoRel }
      missions: {
        Row: MissionRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'missions_season_id_fkey'
              columns: ['season_id']
              isOneToOne: false
              referencedRelation: 'seasons'
              referencedColumns: ['id']
            },
          ]
        >
      }
      mission_participants: {
        Row: MissionParticipantRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'mission_participants_mission_id_fkey'
              columns: ['mission_id']
              isOneToOne: false
              referencedRelation: 'missions'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'mission_participants_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
          ]
        >
      }
      mission_progress: {
        Row: MissionProgressRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'mission_progress_mission_id_fkey'
              columns: ['mission_id']
              isOneToOne: false
              referencedRelation: 'missions'
              referencedColumns: ['id']
            },
          ]
        >
      }
      challenges: { Row: ChallengeRow; Insert: never; Update: never; Relationships: NoRel }
      challenge_participants: {
        Row: ChallengeParticipantRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'challenge_participants_challenge_id_fkey'
              columns: ['challenge_id']
              isOneToOne: false
              referencedRelation: 'challenges'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'challenge_participants_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
          ]
        >
      }
      challenge_results: { Row: ChallengeResultRow; Insert: never; Update: never; Relationships: NoRel }
      wheels: {
        Row: WheelRow
        Insert: never
        Update: Partial<Pick<WheelRow, 'name' | 'is_active'>>
        Relationships: NoRel
      }
      wheel_prizes: {
        Row: WheelPrizeRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'wheel_prizes_wheel_id_fkey'
              columns: ['wheel_id']
              isOneToOne: false
              referencedRelation: 'wheels'
              referencedColumns: ['id']
            },
          ]
        >
      }
      wheel_queue: {
        Row: WheelQueueRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'wheel_queue_wheel_id_fkey'
              columns: ['wheel_id']
              isOneToOne: false
              referencedRelation: 'wheels'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'wheel_queue_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
          ]
        >
      }
      wheel_spins: {
        Row: WheelSpinRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'wheel_spins_queue_id_fkey'
              columns: ['queue_id']
              isOneToOne: false
              referencedRelation: 'wheel_queue'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'wheel_spins_wheel_id_fkey'
              columns: ['wheel_id']
              isOneToOne: false
              referencedRelation: 'wheels'
              referencedColumns: ['id']
            },
          ]
        >
      }
      rewards: {
        Row: RewardRow
        Insert: RewardInsert
        Update: Partial<RewardInsert> & { deleted_at?: string | null }
        Relationships: NoRel
      }
      reward_redemptions: {
        Row: RewardRedemptionRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'reward_redemptions_reward_id_fkey'
              columns: ['reward_id']
              isOneToOne: false
              referencedRelation: 'rewards'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'reward_redemptions_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
          ]
        >
      }
      achievements: {
        Row: AchievementRow
        Insert: AchievementInsert
        Update: Partial<AchievementInsert>
        Relationships: NoRel
      }
      profile_achievements: {
        Row: ProfileAchievementRow
        Insert: never
        Update: never
        Relationships: Rel<
          [
            {
              foreignKeyName: 'profile_achievements_achievement_id_fkey'
              columns: ['achievement_id']
              isOneToOne: false
              referencedRelation: 'achievements'
              referencedColumns: ['id']
            },
            {
              foreignKeyName: 'profile_achievements_profile_id_fkey'
              columns: ['profile_id']
              isOneToOne: false
              referencedRelation: 'profiles'
              referencedColumns: ['id']
            },
          ]
        >
      }
      feed_events: { Row: FeedEventRow; Insert: never; Update: never; Relationships: NoRel }
      notifications: {
        Row: NotificationRow
        Insert: never
        Update: Pick<NotificationRow, 'is_read'>
        Relationships: NoRel
      }
      audit_log: { Row: AuditLogRow; Insert: never; Update: never; Relationships: NoRel }
    }
    Views: {
      v_profile_stats: { Row: VProfileStats; Relationships: NoRel }
      v_ranking: { Row: VRanking; Relationships: NoRel }
      v_team_stats: { Row: VTeamStats; Relationships: NoRel }
      v_admin_kpis: { Row: VAdminKpis; Relationships: NoRel }
      v_sales_timeline: { Row: VSalesTimeline; Relationships: NoRel }
      v_mission_board: { Row: VMissionBoard; Relationships: NoRel }
      v_challenge_board: { Row: VChallengeBoard; Relationships: NoRel }
      v_achievement_board: { Row: VAchievementBoard; Relationships: NoRel }
      v_wheel_queue: { Row: VWheelQueue; Relationships: NoRel }
      v_wheel_history: { Row: VWheelHistory; Relationships: NoRel }
      v_redemptions: { Row: VRedemption; Relationships: NoRel }
      v_wallet: { Row: VWallet; Relationships: NoRel }
      v_point_entries_history: { Row: VPointEntryHistory; Relationships: NoRel }
      v_activity_feed: { Row: VActivityFeed; Relationships: NoRel }
      v_seasons: { Row: VSeason; Relationships: NoRel }
      v_special_events: { Row: VSpecialEvent; Relationships: NoRel }
    }
    Functions: {
      signup_mode: { Args: Record<string, never>; Returns: 'first_admin' | 'team_code' }
      validate_team_code: { Args: { p_code: string }; Returns: boolean }
      get_bootstrap: { Args: Record<string, never>; Returns: Json }
      get_dashboard: { Args: { p_profile_id?: string | null; p_season_id?: string | null }; Returns: Json }
      admin_update_profile: { Args: { p_profile_id: string; p_patch: AdminProfilePatch }; Returns: Json }
      rotate_team_code: { Args: Record<string, never>; Returns: string }
      update_app_settings: { Args: { p_patch: AppSettingsPatch }; Returns: AppSettingsRow }
      save_special_event: { Args: { p: SaveSpecialEventInput }; Returns: SpecialEventRow }
      recompute_stats: { Args: { p_profile_id?: string | null }; Returns: Json }
      create_season: {
        Args: {
          p_name: string
          p_starts_on: string
          p_ends_on: string
          p_team_goal_amount?: number
          p_activate?: boolean
        }
        Returns: SeasonRow
      }
      update_season: { Args: { p_season_id: string; p_patch: SeasonPatch }; Returns: SeasonRow }
      activate_season: { Args: { p_season_id: string }; Returns: SeasonRow }
      close_season: { Args: { p_season_id: string }; Returns: Json }
      record_rule_entry: {
        Args: {
          p_profile_id: string
          p_rule_id: string
          p_quantity?: number
          p_amount?: number | null
          p_occurred_at?: string
          p_reason?: string | null
        }
        Returns: PointEntryRow
      }
      record_manual_entry: {
        Args: { p_profile_id: string; p_points: number; p_reason: string; p_coins?: number | null }
        Returns: PointEntryRow
      }
      record_initial_points: { Args: { p_profile_id: string; p_points: number }; Returns: PointEntryRow }
      reverse_entry: { Args: { p_entry_id: string; p_reason: string }; Returns: PointEntryRow }
      save_mission: { Args: { p: SaveMissionInput }; Returns: MissionRow }
      delete_mission: { Args: { p_mission_id: string }; Returns: undefined }
      save_challenge: { Args: { p: SaveChallengeInput }; Returns: ChallengeRow }
      activate_challenge: { Args: { p_challenge_id: string }; Returns: ChallengeRow }
      finish_challenge: { Args: { p_challenge_id: string }; Returns: Json }
      cancel_challenge: { Args: { p_challenge_id: string; p_reason?: string | null }; Returns: ChallengeRow }
      enqueue_wheel: {
        Args: {
          p_profile_id?: string | null
          p_person_name?: string | null
          p_wheel_kind?: WheelKind
          p_attempts?: number
        }
        Returns: WheelQueueRow
      }
      update_queue_entry: {
        Args: { p_queue_id: string; p_wheel_kind?: WheelKind | null; p_attempts?: number | null }
        Returns: WheelQueueRow
      }
      remove_from_queue: { Args: { p_queue_id: string }; Returns: WheelQueueRow }
      release_turn: { Args: { p_queue_id: string }; Returns: WheelQueueRow }
      spin_wheel: { Args: { p_queue_id: string }; Returns: Json }
      spin_wheel_free: { Args: { p_wheel_kind: WheelKind }; Returns: Json }
      approve_spin: { Args: { p_spin_id: string }; Returns: Json }
      reject_spin: { Args: { p_spin_id: string }; Returns: Json }
      save_wheel_prizes: { Args: { p_wheel_kind: WheelKind; p_prizes: SavePrizeInput[] }; Returns: WheelPrizeRow[] }
      redeem_reward: { Args: { p_reward_id: string }; Returns: Json }
      handle_redemption: {
        Args: { p_redemption_id: string; p_action: 'approve' | 'deliver' | 'cancel'; p_notes?: string | null }
        Returns: RewardRedemptionRow
      }
      mark_notifications_read: { Args: { p_ids?: string[] | null }; Returns: number }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_active_member: { Args: Record<string, never>; Returns: boolean }
      active_season_id: { Args: Record<string, never>; Returns: string | null }
      app_timezone: { Args: Record<string, never>; Returns: string }
    }
    Enums: {
      user_role: UserRole
      profile_status: ProfileStatus
      job_title: JobTitle
      metric_type: MetricType
      rule_trigger_kind: RuleTriggerKind
      entry_source: EntrySource
      mission_kind: MissionKind
      mission_target_kind: MissionTargetKind
      mission_audience: MissionAudience
      challenge_kind: ChallengeKind
      challenge_metric: ChallengeMetric
      challenge_status: ChallengeStatus
      wheel_kind: WheelKind
      prize_kind: PrizeKind
      queue_status: QueueStatus
      queue_source: QueueSource
      spin_status: SpinStatus
      redemption_source: RedemptionSource
      redemption_status: RedemptionStatus
      achievement_criteria: AchievementCriteria
      achievement_scope: AchievementScope
      feed_kind: FeedKind
      notification_kind: NotificationKind
      audit_action: AuditAction
    }
    CompositeTypes: Record<string, never>
  }
}

// ---------------------------------------------------------------------------
// Helpers (mesmos nomes do gerador oficial + extras)
// ---------------------------------------------------------------------------

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Views<V extends keyof Database['public']['Views']> = Database['public']['Views'][V]['Row']
export type Enums<E extends keyof Database['public']['Enums']> = Database['public']['Enums'][E]
export type RpcName = keyof Database['public']['Functions']
export type RpcArgs<N extends RpcName> = Database['public']['Functions'][N]['Args']
export type RpcResult<N extends RpcName> = N extends keyof RpcPayloads
  ? RpcPayloads[N]
  : Database['public']['Functions'][N]['Returns']
