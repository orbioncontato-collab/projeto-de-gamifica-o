import type {
  AdminProfilePatch,
  AppSettingsPatch,
  AppSettingsRow,
  ChallengeRow,
  Json,
  MissionRow,
  PointEntryRow,
  RewardRedemptionRow,
  SaveChallengeInput,
  SaveMissionInput,
  SavePrizeInput,
  SaveSpecialEventInput,
  SeasonPatch,
  SeasonRow,
  SpecialEventRow,
  WheelKind,
  WheelPrizeRow,
  WheelQueueRow,
} from '../database.types'

// ---------------------------------------------------------------------------
// Database.public.Functions (RPCs, DATA-MODEL §7)
// ---------------------------------------------------------------------------

export type PublicFunctions = {
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
  save_wheel_prizes: {
    Args: { p_wheel_kind: WheelKind; p_prizes: SavePrizeInput[] }
    Returns: WheelPrizeRow[]
  }
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
