import { callRpc, supabase, unwrap } from '@/lib/supabase'
import { RpcError } from '@/lib/rpc-errors'
import type {
  AppSecretsRow,
  AppSettingsPatch,
  AppSettingsRow,
  CloseSeasonPayload,
  RecomputeStatsPayload,
  SaveSpecialEventInput,
  SeasonPatch,
  SeasonRow,
  SpecialEventRow,
  VSeason,
  VSpecialEvent,
} from '@/lib/database.types'

/** Funções puras async de Configurações (FRONTEND-ARCH §4.5 features/settings). */

export async function getAppSettings(): Promise<AppSettingsRow> {
  return unwrap(supabase.from('app_settings').select('*').eq('id', 1).single())
}

/** Só admin (RLS). Único ponto do app que lê `app_secrets` fora da Equipe (DATA-MODEL §4.2). */
export async function getAppSecrets(): Promise<AppSecretsRow> {
  return unwrap(supabase.from('app_secrets').select('*').eq('id', 1).single())
}

export async function updateAppSettings(patch: AppSettingsPatch): Promise<AppSettingsRow> {
  return callRpc('update_app_settings', { p_patch: patch })
}

export async function rotateTeamCode(): Promise<string> {
  return callRpc('rotate_team_code')
}

export async function getSeasons(): Promise<VSeason[]> {
  return unwrap(supabase.from('v_seasons').select('*').order('starts_at', { ascending: false }))
}

export interface CreateSeasonInput {
  name: string
  startsOn: string
  endsOn: string
  teamGoalAmount: number
  activate: boolean
}

export async function createSeason(input: CreateSeasonInput): Promise<SeasonRow> {
  return callRpc('create_season', {
    p_name: input.name,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_team_goal_amount: input.teamGoalAmount,
    p_activate: input.activate,
  })
}

export async function updateSeason(input: { seasonId: string; patch: SeasonPatch }): Promise<SeasonRow> {
  return callRpc('update_season', { p_season_id: input.seasonId, p_patch: input.patch })
}

export async function activateSeason(seasonId: string): Promise<SeasonRow> {
  return callRpc('activate_season', { p_season_id: seasonId })
}

export async function closeSeason(seasonId: string): Promise<CloseSeasonPayload> {
  return callRpc('close_season', { p_season_id: seasonId })
}

export async function getSpecialEvents(): Promise<VSpecialEvent[]> {
  return unwrap(supabase.from('v_special_events').select('*').order('starts_at', { ascending: false }))
}

/** `EVENT_OVERLAP`/`EVENT_RANGE_INVALID` chegam pelo catálogo (DATA-MODEL §7.2). */
export async function saveSpecialEvent(input: SaveSpecialEventInput): Promise<SpecialEventRow> {
  return callRpc('save_special_event', { p: input })
}

/** Único write direto em `special_events`: soft delete (policy admin). */
export async function deleteSpecialEvent(id: string): Promise<void> {
  await unwrap(
    supabase
      .from('special_events')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id),
  )
}

export async function recomputeStats(profileId?: string | null): Promise<RecomputeStatsPayload> {
  return callRpc('recompute_stats', { p_profile_id: profileId ?? null })
}

/** Existe algum lançamento no ledger? Trava o fuso (TIMEZONE_LOCKED, DATA-MODEL §7.2). Chave em `qk.ledger.all()`. */
export async function hasLedgerEntries(): Promise<boolean> {
  const { count, error } = await supabase
    .from('v_point_entries_history')
    .select('entry_id', { count: 'exact', head: true })
  if (error) throw RpcError.fromPostgrest(error)
  return (count ?? 0) > 0
}
