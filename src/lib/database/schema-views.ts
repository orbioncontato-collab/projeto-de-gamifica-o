import type {
  AchievementCriteria,
  AchievementScope,
  AuditAction,
  ChallengeKind,
  ChallengeMetric,
  ChallengeStatus,
  EntrySource,
  FeedKind,
  JobTitle,
  MetricType,
  MissionAudience,
  MissionKind,
  MissionTargetKind,
  NotificationKind,
  PrizeKind,
  ProfileStatus,
  QueueSource,
  QueueStatus,
  RedemptionSource,
  RedemptionStatus,
  RuleTriggerKind,
  SpinStatus,
  UserRole,
  VAchievementBoard,
  VActivityFeed,
  VAdminKpis,
  VChallengeBoard,
  VMissionBoard,
  VPointEntryHistory,
  VProfileStats,
  VRanking,
  VRedemption,
  VSalesTimeline,
  VSeason,
  VSpecialEvent,
  VTeamStats,
  VWallet,
  VWheelHistory,
  VWheelQueue,
  WheelKind,
} from '../database.types'

// ---------------------------------------------------------------------------
// Database.public.Views / Enums
// ---------------------------------------------------------------------------

type NoRel = []

export type PublicViews = {
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

export type PublicEnums = {
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
