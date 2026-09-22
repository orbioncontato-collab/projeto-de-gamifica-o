import type {
  EntrySource,
  JobTitle,
  MetricType,
  ProfileStatus,
  RuleTriggerKind,
  UserRole,
} from '../database.types'

// ---------------------------------------------------------------------------
// Rows (DATA-MODEL §4 — 31 tabelas) · parte 1: instalação, temporadas, perfis, ledger e eventos
// ---------------------------------------------------------------------------

export type ProfilePreferences = {
  notifications: boolean
  event_alerts: boolean
}

export type AppSettingsRow = {
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
  platform_name: string
  brand_preset: BrandPreset
  logo_data_url: string | null
  default_theme: 'dark' | 'light'
  updated_at: string
  updated_by: string | null
}

/** Presets de cor da marca (migration 14 — check constraint em `app_settings.brand_preset`). */
export type BrandPreset = 'esmeralda' | 'safira' | 'ametista' | 'ambar' | 'coral' | 'ciano' | 'rosa'

/** rpc `get_branding` (anon): só o que a tela de login precisa antes de autenticar. */
export type Branding = Pick<
  AppSettingsRow,
  'company_name' | 'platform_name' | 'brand_preset' | 'logo_data_url' | 'default_theme'
>

export type AppSecretsRow = {
  id: number
  team_code: string
  team_code_rotated_at: string
  bootstrap_email: string | null
  bootstrap_done: boolean
  updated_at: string
  updated_by: string | null
}

export type SeasonRow = {
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

export type SeasonGoalRow = {
  season_id: string
  profile_id: string
  goal_amount: number
  updated_at: string
  updated_by: string | null
}
export type SeasonGoalInsert = {
  season_id: string
  profile_id: string
  goal_amount?: number
}

export type SeasonResultRow = {
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

export type ProfileRow = {
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

export type ProfilePrivateRow = {
  profile_id: string
  email: string
  phone: string | null
  default_goal_amount: number
  notes: string | null
  updated_at: string
  updated_by: string | null
}

export type ProfileSeasonStatsRow = {
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

export type ProfileLifetimeStatsRow = {
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

export type PointRuleRow = {
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
export type PointRuleInsert = {
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

export type PointEntryRow = {
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

export type MilestoneAwardRow = {
  profile_id: string
  season_id: string
  metric: MetricType
  period_key: string
  entry_id: string
  created_at: string
}

export type SpecialEventRow = {
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

export type ProfileBoostRow = {
  id: string
  profile_id: string
  multiplier: number
  starts_at: string
  expires_at: string
  spin_id: string
  created_at: string
}
