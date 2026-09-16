import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import type { PendingMember, ProfilePrivateRow, VAchievementBoard, VProfileStats, VRanking } from '@/lib/database.types'
import { useMe, useMeOptional } from '@/features/auth/bootstrap-query'
import {
  getAchievementBoard,
  getActiveProfiles,
  getPendingMembers,
  getProfilePrivate,
  getProfileStat,
  getProfileStats,
  getRanking,
  type ActiveProfile,
} from './api'

/**
 * Hooks do read-model de perfis (FRONTEND-ARCH §4.5). Quando `seasonId === null` (sem temporada ativa)
 * os hooks de temporada ficam desabilitados e devolvem `[]`/`null` sem consultar.
 */

const EMPTY: never[] = []

export function useProfileStats(
  seasonId: string | null,
  opts?: { includeInactive?: boolean },
): UseQueryResult<VProfileStats[]> {
  const includeInactive = opts?.includeInactive === true
  return useQuery({
    queryKey: [...qk.profiles.stats(seasonId), includeInactive ? 'all' : 'active'] as const,
    queryFn: () => getProfileStats(seasonId as string, { includeInactive }),
    enabled: !!seasonId,
    placeholderData: seasonId ? undefined : EMPTY,
  })
}

export function useProfileStat(profileId: string, seasonId: string | null): UseQueryResult<VProfileStats | null> {
  return useQuery({
    queryKey: qk.profiles.one(profileId, seasonId),
    queryFn: () => getProfileStat(profileId, seasonId as string),
    enabled: !!seasonId && !!profileId,
  })
}

export function useRanking(seasonId: string | null, limit?: number): UseQueryResult<VRanking[]> {
  return useQuery({
    queryKey: [...qk.profiles.ranking(seasonId), limit ?? 'all'] as const,
    queryFn: () => getRanking(seasonId as string, limit),
    enabled: !!seasonId,
  })
}

export function useActiveProfiles(): UseQueryResult<ActiveProfile[]> {
  return useQuery({ queryKey: qk.profiles.active(), queryFn: getActiveProfiles })
}

/** admin: `enabled: isAdmin`; o badge da sidebar NÃO usa este hook (usa `bootstrap.pending_members`). */
export function usePendingMembers(): UseQueryResult<PendingMember[]> {
  const me = useMeOptional()
  return useQuery({
    queryKey: qk.profiles.pending(),
    queryFn: getPendingMembers,
    enabled: me?.isAdmin === true,
  })
}

export function useProfilePrivate(profileId: string): UseQueryResult<ProfilePrivateRow | null> {
  return useQuery({
    queryKey: qk.profiles.private(profileId),
    queryFn: () => getProfilePrivate(profileId),
    enabled: !!profileId,
  })
}

/** Conquistas × perfil (Perfil e Conquistas consomem daqui). Default: o próprio usuário. */
export function useAchievementBoard(profileId?: string): UseQueryResult<VAchievementBoard[]> {
  const { me } = useMe()
  const id = profileId ?? me.id
  return useQuery({
    queryKey: qk.achievements.one(id),
    queryFn: () => getAchievementBoard(id),
    enabled: !!id,
  })
}
