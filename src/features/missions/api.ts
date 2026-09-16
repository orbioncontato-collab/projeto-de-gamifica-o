import { callRpc, supabase, unwrap } from '@/lib/supabase'
import { missionFilterKinds, type MissionFilter } from '@/lib/gamification'
import type { MissionRow, SaveMissionInput, VMissionBoard } from '@/lib/database.types'

/**
 * Acesso a dados de Missões (FRONTEND-ARCH §4.5 features/missions). Única camada que fala com o supabase.
 */

export type MissionAdminRow = MissionRow & { participant_ids: string[] }

/** `v_mission_board` do perfil, só missões correntes, por filtro (hoje = daily+lightning, semana, especiais). */
export async function getMissionBoard(filter: MissionFilter, profileId: string): Promise<VMissionBoard[]> {
  const rows = await unwrap(
    supabase
      .from('v_mission_board')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_current', true)
      .in('kind', missionFilterKinds[filter])
      .order('is_completed', { ascending: true })
      .order('ends_at', { ascending: true }),
  )
  return (rows ?? []) as VMissionBoard[]
}

type MissionWithParticipants = MissionRow & { mission_participants: { profile_id: string }[] | null }

/** Lista administrativa: missões da temporada (sem soft-deleted) com ids dos participantes. */
export async function getMissionsAdmin(seasonId: string): Promise<MissionAdminRow[]> {
  const rows = await unwrap(
    supabase
      .from('missions')
      .select('*, mission_participants(profile_id)')
      .is('deleted_at', null)
      .eq('season_id', seasonId)
      .order('starts_at', { ascending: false }),
  )
  return ((rows ?? []) as unknown as MissionWithParticipants[]).map(
    ({ mission_participants, ...mission }) => ({
      ...mission,
      participant_ids: (mission_participants ?? []).map((p) => p.profile_id),
    }),
  )
}

/** rpc `save_mission(p)` — upsert + substitui participantes numa transação (DATA-MODEL §7.4). */
export async function saveMission(input: SaveMissionInput): Promise<MissionRow> {
  return callRpc('save_mission', { p: input })
}

/** rpc `delete_mission` — soft delete. */
export async function deleteMission(missionId: string): Promise<void> {
  await callRpc('delete_mission', { p_mission_id: missionId })
}
