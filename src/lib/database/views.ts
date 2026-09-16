import type {
  AchievementCriteria,
  AchievementScope,
  ChallengeKind,
  ChallengeMetric,
  ChallengeStatus,
  EntrySource,
  FeedKind,
  JobTitle,
  Json,
  MetricType,
  MissionAudience,
  MissionKind,
  MissionTargetKind,
  PrizeKind,
  ProfileStatus,
  QueueSource,
  QueueStatus,
  RedemptionSource,
  RedemptionStatus,
  SeasonRow,
  SpecialEventRow,
  UserRole,
  WheelKind,
} from '../database.types'

// ---------------------------------------------------------------------------
// Views (DATA-MODEL §5 — 16 views; agregados não-nulos por coalesce)
// ---------------------------------------------------------------------------

export type VProfileStats = {
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

export type VRanking = {
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

export type VTeamStats = {
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

export type VAdminKpis = {
  season_id: string
  redemptions_delivered_amount: number
  redemptions_pending_count: number
  entries_count: number
  coins_issued: number
}

export type VSalesTimeline = {
  season_id: string
  day: string
  sales_amount: number
  sales_count: number
  sales_cum: number
  points: number
  points_cum: number
  entries_count: number
}

export type VMissionBoard = {
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

export type ChallengeParticipant = {
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

export type VChallengeBoard = {
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

export type VAchievementBoard = {
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

export type VWheelQueue = {
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

export type VWheelHistory = {
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

export type VRedemption = {
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

export type VWallet = {
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

export type VPointEntryHistory = {
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

export type VActivityFeed = {
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

export type VSeason = SeasonRow & {
  is_current: boolean
  days_total: number
  days_elapsed: number
  days_left: number
}

export type SpecialEventState = 'inactive' | 'upcoming' | 'live' | 'ended'
export type VSpecialEvent = SpecialEventRow & {
  state: SpecialEventState
  seconds_to_start: number
  seconds_to_end: number
}
