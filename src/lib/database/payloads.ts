import type {
  ChallengeKind,
  ChallengeMetric,
  JobTitle,
  MetricType,
  MissionAudience,
  MissionKind,
  MissionTargetKind,
  PrizeKind,
  ProfilePreferences,
  ProfileStatus,
  QueueStatus,
  SpinStatus,
  UserRole,
  VActivityFeed,
  VMissionBoard,
  VProfileStats,
  VRanking,
  WheelKind,
} from '../database.types'

// ---------------------------------------------------------------------------
// Payloads jsonb de RPCs (DATA-MODEL §7) — tipos fortes
// ---------------------------------------------------------------------------

export type BootstrapMe = {
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
export type BootstrapSeason = {
  id: string
  name: string
  starts_at: string
  ends_at: string
  team_goal_amount: number
  xp_per_level: number
  is_active: boolean
  days_left: number
}
export type BootstrapSettings = {
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
export type BootstrapWheel = {
  active_queue_id: string | null
  active_person_name: string | null
  pending_spin_id: string | null
  my_turn: boolean
}
export type ActiveEvent = {
  id: string
  name: string
  multiplier: number
  starts_at: string
  ends_at: string
  state: 'upcoming' | 'live'
}
/** DATA-MODEL §7.1 passo 2: perfil `inactive` ou `pending` recebe só isto */
export type BootstrapMeBlocked = Pick<BootstrapMe, 'id' | 'full_name'> & { status: 'inactive' | 'pending' }
export type BootstrapPayload = {
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
export type PendingMember = {
  id: string
  full_name: string
  avatar_path: string | null
  color: string
  created_at: string
  profile_private: { email: string } | null
}

export type NextRewardHint = {
  id: string
  name: string
  icon: string | null
  cost_coins: number
  missing_coins: number
}
/** get_dashboard devolve APENAS { season: null } quando não há temporada (DATA-MODEL §7.1) */
export type DashboardData = {
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

export type SpinPrize = {
  id: string
  label: string
  kind: PrizeKind
  value: number | null
  sort_order?: number
}
export type SpinResultPayload = {
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
export type ApproveSpinPayload = {
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
export type RedeemPayload = {
  redemption_id: string
  coins_balance: number
}
export type FinishChallengePayload = {
  challenge_id: string
  winner_ids: string[]
  results: { profile_id: string; final_value: number; is_winner: boolean; entry_id: string | null }[]
}
export type CloseSeasonPayload = {
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
export type AdminUpdateProfilePayload = {
  profile: VProfileStats
  warnings: string[]
}
export type RecomputeStatsPayload = {
  profiles: number
  seasons: number
}
export type RpcPayloads = {
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
export type AdminProfilePatch = {
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
export type AppSettingsPatch = {
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
export type SaveSpecialEventInput = {
  id?: string
  name: string
  description?: string | null
  multiplier: number
  starts_at: string
  ends_at: string
  is_active?: boolean
}
export type SeasonPatch = {
  name?: string
  team_goal_amount?: number
  starts_on?: string
  ends_on?: string
}
export type SaveMissionInput = {
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
export type SaveChallengeInput = {
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
export type SavePrizeInput = {
  id?: string
  label: string
  kind: PrizeKind
  value?: number | null
  weight?: number
  color?: string | null
  sort_order: number
  is_active?: boolean
}
