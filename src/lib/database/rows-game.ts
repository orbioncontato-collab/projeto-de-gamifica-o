import type {
  AchievementCriteria,
  AchievementScope,
  AuditAction,
  ChallengeKind,
  ChallengeMetric,
  ChallengeStatus,
  FeedKind,
  Json,
  MetricType,
  MissionAudience,
  MissionKind,
  MissionTargetKind,
  NotificationKind,
  PrizeKind,
  QueueSource,
  QueueStatus,
  RedemptionSource,
  RedemptionStatus,
  SpinStatus,
  WheelKind,
} from '../database.types'

// ---------------------------------------------------------------------------
// Rows (DATA-MODEL §4) · parte 2: missões, desafios, roleta, recompensas, conquistas, feed, notificações, auditoria
// ---------------------------------------------------------------------------

export type MissionRow = {
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

export type MissionParticipantRow = {
  mission_id: string
  profile_id: string
}

export type MissionProgressRow = {
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

export type ChallengeRow = {
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

export type ChallengeParticipantRow = {
  challenge_id: string
  profile_id: string
  current_value: number
  updated_at: string
}

export type ChallengeResultRow = {
  challenge_id: string
  profile_id: string
  final_value: number
  is_winner: boolean
  entry_id: string | null
  queue_id: string | null
  created_at: string
}

export type WheelRow = {
  id: string
  kind: WheelKind
  name: string
  is_active: boolean
  updated_at: string
}

export type WheelPrizeRow = {
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

export type WheelQueueRow = {
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

export type WheelSpinRow = {
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

export type RewardRow = {
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
export type RewardInsert = {
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

export type RewardRedemptionRow = {
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

export type AchievementRow = {
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
export type AchievementInsert = {
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

export type ProfileAchievementRow = {
  id: string
  profile_id: string
  achievement_id: string
  season_id: string | null
  unlocked_at: string
  entry_id: string | null
  trigger_entry_id: string | null
}

export type FeedEventRow = {
  id: string
  kind: FeedKind
  profile_id: string | null
  season_id: string | null
  payload: Json
  dedupe_key: string | null
  occurred_at: string
  created_at: string
}

export type NotificationRow = {
  id: string
  profile_id: string
  kind: NotificationKind
  title: string
  message: string
  payload: Json
  is_read: boolean
  created_at: string
}

export type AuditLogRow = {
  id: number
  actor_id: string | null
  action: AuditAction
  table_name: string
  row_id: string | null
  old_data: Json | null
  new_data: Json | null
  created_at: string
}
