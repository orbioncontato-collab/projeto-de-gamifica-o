import { useMemo } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { qk, invalidateAfterLedgerChange } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import { firstName } from '@/lib/format'
import type {
  AdminUpdateProfilePayload,
  DashboardPayload,
  PointEntryRow,
  VProfileStats,
} from '@/lib/database.types'
import { useMe } from '@/features/auth/bootstrap-query'
import { useProfileStats } from '@/features/profiles/hooks'
import {
  adminUpdateProfile,
  getCollaboratorDashboard,
  getInitialPointsSum,
  getTeamCode,
  recordInitialPoints,
  uploadAdminAvatar,
  type AdminUpdateProfileInput,
  type AdminUploadAvatarInput,
  type RecordInitialPointsInput,
} from './api'
import { filterRoster } from './team-utils'

/** Hooks da Equipe (FRONTEND-ARCH §4.5 features/team). Erros de mutation: MutationCache → notify.error. */

const NO_SEASON_GOAL_WARNING = 'no_active_season_for_goal'

/** Todos os perfis da temporada (ativos, inativos e pendentes); busca filtrada no cliente. */
export interface TeamRoster {
  query: UseQueryResult<VProfileStats[]>
  /** linhas já filtradas pela busca */
  rows: VProfileStats[]
}

export function useTeamRoster(seasonId: string | null, search: string): TeamRoster {
  const query = useProfileStats(seasonId, { includeInactive: true })
  const rows = useMemo(() => filterRoster(query.data ?? [], search), [query.data, search])
  return { query, rows }
}

async function invalidateProfiles(
  qc: ReturnType<typeof useQueryClient>,
  includeBootstrap: boolean,
): Promise<void> {
  const keys: (readonly unknown[])[] = [qk.profiles.all(), qk.admin.all()]
  if (includeBootstrap) keys.push(qk.bootstrap())
  await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

export function useAdminUpdateProfile(): UseMutationResult<
  AdminUpdateProfilePayload,
  Error,
  AdminUpdateProfileInput
> {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: adminUpdateProfile,
    onSuccess: async (payload, { profileId }) => {
      await invalidateProfiles(qc, profileId === me.id)
      if (payload.warnings.includes(NO_SEASON_GOAL_WARNING)) {
        notify.warning(
          'Meta individual não gravada',
          'Não há temporada ativa — ative uma para definir metas.',
        )
      }
    },
  })
}

/** Aprovar cadastro pendente: `admin_update_profile({ status: 'active' })` → some da lista + badge da sidebar. */
export function useApproveMember(): UseMutationResult<
  AdminUpdateProfilePayload,
  Error,
  { profileId: string; name: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId }) => adminUpdateProfile({ profileId, patch: { status: 'active' } }),
    onSuccess: async (_payload, { name }) => {
      await invalidateProfiles(qc, true)
      notify.success('Cadastro aprovado', `${firstName(name)} já pode entrar.`)
    },
  })
}

/** Recusar cadastro pendente: `{ status: 'inactive' }` (poderá ser aprovado depois na lista de inativos). */
export function useRejectMember(): UseMutationResult<
  AdminUpdateProfilePayload,
  Error,
  { profileId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId }) => adminUpdateProfile({ profileId, patch: { status: 'inactive' } }),
    onSuccess: async () => {
      await invalidateProfiles(qc, true)
      notify.success('Cadastro recusado')
    },
  })
}

export function useCollaboratorDashboard(profileId: string | null): UseQueryResult<DashboardPayload> {
  const { seasonId } = useMe()
  return useQuery({
    queryKey: qk.dashboard.one(profileId, seasonId),
    queryFn: () => getCollaboratorDashboard(profileId as string, seasonId as string),
    enabled: !!profileId && !!seasonId,
  })
}

/** "Lançar pontos iniciais" — ação separada do formulário; erros pelo catálogo (MutationCache). */
export function useRecordInitialPoints(): UseMutationResult<PointEntryRow, Error, RecordInitialPointsInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordInitialPoints,
    onSuccess: async (entry) => {
      await invalidateAfterLedgerChange(qc)
      notify.success('Pontos iniciais lançados', `${entry.points} pontos creditados.`)
    },
  })
}

/** "Pontos iniciais lançados: N" — 0 sem temporada ativa (query desabilitada). */
export function useInitialPointsSum(profileId: string | null): {
  query: UseQueryResult<number>
  sum: number
} {
  const { seasonId } = useMe()
  const query = useQuery({
    queryKey: qk.ledger.initialPoints(profileId ?? '', seasonId),
    queryFn: () => getInitialPointsSum(profileId as string, seasonId as string),
    enabled: !!profileId && !!seasonId,
  })
  return { query, sum: query.data ?? 0 }
}

export function useAdminUploadAvatar(): UseMutationResult<string, Error, AdminUploadAvatarInput> {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: uploadAdminAvatar,
    onSuccess: async (_path, { profileId }) => {
      await invalidateProfiles(qc, profileId === me.id)
      notify.success('Foto atualizada')
    },
  })
}

/** Código da equipe para o `InviteDialog` (`?convidar=true`) — sem importar de `features/settings`. */
export function useTeamCode(): UseQueryResult<string> {
  return useQuery({ queryKey: qk.settings.secrets(), queryFn: getTeamCode })
}
