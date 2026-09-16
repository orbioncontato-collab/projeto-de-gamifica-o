import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
  type InfiniteData,
} from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { useRealtimeInvalidate } from '@/lib/realtime'
import type { DashboardPayload, VTeamStats } from '@/lib/database.types'
import { useMe } from '@/features/auth/bootstrap-query'
import { getActivityFeedPage, getDashboard, getTeamOverview, type FeedPage } from './api'

/**
 * Hooks da Visão geral (FRONTEND-ARCH §4.5 features/dashboard). Sem temporada ativa `useDashboard`
 * fica desabilitado e a tela mostra "Sem temporada ativa" (§9) em vez de zeros.
 */

export function useDashboard(profileId?: string, seasonId?: string): UseQueryResult<DashboardPayload> {
  const me = useMe()
  const targetProfile = profileId ?? me.me.id
  const targetSeason = seasonId ?? me.seasonId
  return useQuery({
    queryKey: qk.dashboard.one(targetProfile, targetSeason),
    queryFn: () => getDashboard(profileId ?? null, targetSeason),
    enabled: !!targetSeason,
  })
}

export type FeedInfiniteData = InfiniteData<FeedPage, string | null>

export function useActivityFeed(): UseInfiniteQueryResult<FeedInfiniteData> {
  return useInfiniteQuery({
    queryKey: qk.feed(),
    queryFn: ({ pageParam }) => getActivityFeedPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })
}

export function useTeamOverview(seasonId: string | null): UseQueryResult<VTeamStats | null> {
  return useQuery({
    queryKey: qk.admin.teamStats(seasonId),
    queryFn: () => getTeamOverview(seasonId as string),
    enabled: !!seasonId,
  })
}

/** Canal `feed`: qualquer `feed_events` novo invalida feed, dashboard, bootstrap e perfis. */
export function useFeedRealtime(): void {
  useRealtimeInvalidate({
    table: 'feed_events',
    keys: [qk.feed(), qk.dashboard.all(), qk.bootstrap(), qk.profiles.all()],
  })
}
