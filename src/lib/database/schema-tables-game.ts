import type {
  AchievementInsert,
  AchievementRow,
  AuditLogRow,
  ChallengeParticipantRow,
  ChallengeResultRow,
  ChallengeRow,
  FeedEventRow,
  MissionParticipantRow,
  MissionProgressRow,
  MissionRow,
  NotificationRow,
  ProfileAchievementRow,
  RewardInsert,
  RewardRedemptionRow,
  RewardRow,
  WheelPrizeRow,
  WheelQueueRow,
  WheelRow,
  WheelSpinRow,
} from '../database.types'

// ---------------------------------------------------------------------------
// Database.public.Tables · parte 2 (missões, desafios, roleta, recompensas, conquistas, feed, notificações, auditoria)
// ---------------------------------------------------------------------------

type NoRel = []
/** Tabelas escritas só por RPC (`never` quebrava a inferência do builder em `select(colunas)`). */
type RpcOnly = Record<string, never>
type Rel<T extends readonly unknown[]> = T

export type PublicTablesGame = {
  missions: {
    Row: MissionRow
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
  challenges: { Row: ChallengeRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
  challenge_participants: {
    Row: ChallengeParticipantRow
    Insert: RpcOnly
    Update: RpcOnly
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
  challenge_results: { Row: ChallengeResultRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
  wheels: {
    Row: WheelRow
    Insert: RpcOnly
    Update: Partial<Pick<WheelRow, 'name' | 'is_active'>>
    Relationships: NoRel
  }
  wheel_prizes: {
    Row: WheelPrizeRow
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
  feed_events: { Row: FeedEventRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
  notifications: {
    Row: NotificationRow
    Insert: RpcOnly
    Update: Pick<NotificationRow, 'is_read'>
    Relationships: NoRel
  }
  audit_log: { Row: AuditLogRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
}
