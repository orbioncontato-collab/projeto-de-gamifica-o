import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import type { VAdminKpis, VSalesTimeline, VTeamStats } from '@/lib/database.types'
import { getAdminKpis, getSalesTimeline, getTeamStats } from './api'

/**
 * Hooks do Dashboard administrativo (FRONTEND-ARCH §4.5). Sem temporada ativa (`seasonId === null`)
 * nenhuma query roda e a página mostra o estado "Sem temporada ativa" (§9).
 */

export function useTeamStats(seasonId: string | null): UseQueryResult<VTeamStats | null> {
  return useQuery({
    queryKey: qk.admin.teamStats(seasonId),
    queryFn: () => getTeamStats(seasonId as string),
    enabled: !!seasonId,
  })
}

export function useAdminKpis(seasonId: string | null): UseQueryResult<VAdminKpis | null> {
  return useQuery({
    queryKey: qk.admin.kpis(seasonId),
    queryFn: () => getAdminKpis(seasonId as string),
    enabled: !!seasonId,
  })
}

export function useSalesTimeline(seasonId: string | null): UseQueryResult<VSalesTimeline[]> {
  return useQuery({
    queryKey: qk.admin.timeline(seasonId),
    queryFn: () => getSalesTimeline(seasonId as string),
    enabled: !!seasonId,
  })
}
