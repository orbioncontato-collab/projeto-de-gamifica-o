import type {
  AppSecretsRow,
  AppSettingsRow,
  MilestoneAwardRow,
  PointEntryRow,
  PointRuleInsert,
  PointRuleRow,
  ProfileBoostRow,
  ProfileLifetimeStatsRow,
  ProfilePrivateRow,
  ProfileRow,
  ProfileSeasonStatsRow,
  SeasonGoalInsert,
  SeasonGoalRow,
  SeasonResultRow,
  SeasonRow,
  SpecialEventRow,
  PublicTablesGame,
} from '../database.types'

// ---------------------------------------------------------------------------
// Database.public.Tables · parte 1 (instalação, temporadas, perfis, ledger, eventos)
// ---------------------------------------------------------------------------

type NoRel = []
/** Tabelas escritas só por RPC (`never` quebrava a inferência do builder em `select(colunas)` — handoff WP6). */
type RpcOnly = Record<string, never>
type Rel<T extends readonly unknown[]> = T

export type PublicTablesCore = {
  app_settings: {
    Row: AppSettingsRow
    Insert: RpcOnly
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
        | 'platform_name'
        | 'brand_preset'
        | 'logo_data_url'
        | 'default_theme'
      >
    >
    Relationships: NoRel
  }
  app_secrets: { Row: AppSecretsRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
  seasons: { Row: SeasonRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
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
  season_results: { Row: SeasonResultRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
  profiles: {
    Row: ProfileRow
    Insert: RpcOnly
    Update: Partial<Pick<ProfileRow, 'full_name' | 'avatar_path' | 'color' | 'preferences'>>
    Relationships: NoRel
  }
  profile_private: {
    Row: ProfilePrivateRow
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
    Insert: RpcOnly
    Update: RpcOnly
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
  milestone_awards: { Row: MilestoneAwardRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
  special_events: {
    Row: SpecialEventRow
    Insert: RpcOnly
    Update: Pick<SpecialEventRow, 'is_active'> & { deleted_at?: string | null }
    Relationships: NoRel
  }
  profile_boosts: { Row: ProfileBoostRow; Insert: RpcOnly; Update: RpcOnly; Relationships: NoRel }
}

/** Tabelas completas (formato do gerador): interseção das duas partes. */
export type PublicTables = PublicTablesCore & PublicTablesGame
