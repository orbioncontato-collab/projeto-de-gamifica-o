import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import { useRealtimeInvalidate } from '@/lib/realtime'
import type { MissionFilter } from '@/lib/gamification'
import type { MissionRow, SaveMissionInput, VMissionBoard } from '@/lib/database.types'
import { useMe } from '@/features/auth/hooks'
import { deleteMission, getMissionBoard, getMissionsAdmin, saveMission, type MissionAdminRow } from './api'

/** Hooks de Missões (FRONTEND-ARCH §4.5). Sem temporada ativa as queries ficam desabilitadas. */

export function useMissionBoard(filter: MissionFilter, profileId?: string): UseQueryResult<VMissionBoard[]> {
  const { me, seasonId } = useMe()
  const id = profileId ?? me.id
  return useQuery({
    queryKey: qk.missions.board(id, filter),
    queryFn: () => getMissionBoard(filter, id),
    enabled: !!seasonId && !!id,
  })
}

export function useMissionsAdmin(seasonId: string | null): UseQueryResult<MissionAdminRow[]> {
  return useQuery({
    queryKey: qk.missions.admin(seasonId),
    queryFn: () => getMissionsAdmin(seasonId as string),
    enabled: !!seasonId,
  })
}

async function invalidateMissions(qc: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.missions.all() }),
    qc.invalidateQueries({ queryKey: qk.dashboard.all() }),
  ])
}

/** rpc `save_mission` → invalida missions e dashboard (preview "Missões de hoje"). Toast de erro vem do MutationCache. */
export function useSaveMission(): UseMutationResult<MissionRow, Error, SaveMissionInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input) => saveMission(input),
    onSuccess: async (_row, input) => {
      notify.success(input.id ? 'Missão atualizada' : 'Missão criada')
      await invalidateMissions(qc)
    },
  })
}

export function useDeleteMission(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteMission(id),
    onSuccess: async () => {
      notify.success('Missão excluída')
      await invalidateMissions(qc)
    },
  })
}

/** Progresso chega pelo `feed_events` (INSERT em `mission_completed`, vendas etc.) — invalida missões e desafios. */
export function useMissionsRealtime(): void {
  useRealtimeInvalidate({ table: 'feed_events', keys: [qk.missions.all(), qk.challenges.all()] })
}
