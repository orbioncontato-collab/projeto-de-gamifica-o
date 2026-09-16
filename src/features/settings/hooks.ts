import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { qk, invalidateAfterLedgerChange } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
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
import { useMe } from '@/features/auth/bootstrap-query'
import {
  activateSeason,
  closeSeason,
  createSeason,
  deleteSpecialEvent,
  getAppSecrets,
  getAppSettings,
  getSeasons,
  getSpecialEvents,
  hasLedgerEntries,
  recomputeStats,
  rotateTeamCode,
  saveSpecialEvent,
  updateAppSettings,
  updateSeason,
  type CreateSeasonInput,
} from './api'

/** Hooks de Configurações (FRONTEND-ARCH §4.5 features/settings). Erros de mutation: MutationCache → notify.error. */

export function useAppSettings(): UseQueryResult<AppSettingsRow> {
  return useQuery({ queryKey: qk.settings.app(), queryFn: getAppSettings })
}

export function useAppSecrets(): UseQueryResult<AppSecretsRow> {
  const { isAdmin } = useMe()
  return useQuery({ queryKey: qk.settings.secrets(), queryFn: getAppSecrets, enabled: isAdmin })
}

async function invalidateSettings(qc: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.settings.app() }),
    qc.invalidateQueries({ queryKey: qk.bootstrap() }),
  ])
}

/** `rank_admins`/`auto_approve_members` também passam por aqui; ranking reflete após invalidar profiles. */
export function useUpdateAppSettings(): UseMutationResult<AppSettingsRow, Error, AppSettingsPatch> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAppSettings,
    onSuccess: async (_row, patch) => {
      notify.success('Configurações salvas')
      await invalidateSettings(qc)
      if ('rank_admins' in patch) await qc.invalidateQueries({ queryKey: qk.profiles.all() })
    },
  })
}

export function useRotateTeamCode(): UseMutationResult<string, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => rotateTeamCode(),
    onSuccess: async () => {
      notify.success('Novo código gerado', 'O código anterior deixou de valer.')
      await qc.invalidateQueries({ queryKey: qk.settings.secrets() })
    },
  })
}

/** `true` quando já existe lançamento — o fuso trava (invalidada por `qk.ledger.all()` após lançar). */
export function useHasLedgerEntries(): UseQueryResult<boolean> {
  return useQuery({ queryKey: qk.ledger.hasEntries(), queryFn: hasLedgerEntries })
}

export function useSeasons(): UseQueryResult<VSeason[]> {
  return useQuery({ queryKey: qk.settings.seasons(), queryFn: getSeasons })
}

async function invalidateSeasons(qc: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.settings.seasons() }),
    qc.invalidateQueries({ queryKey: qk.bootstrap() }),
  ])
}

export function useCreateSeason(): UseMutationResult<SeasonRow, Error, CreateSeasonInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSeason,
    onSuccess: async (row) => {
      notify.success(row.is_active ? 'Temporada criada e ativada' : 'Temporada criada')
      await invalidateSeasons(qc)
    },
  })
}

export function useUpdateSeason(): UseMutationResult<
  SeasonRow,
  Error,
  { seasonId: string; patch: SeasonPatch }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateSeason,
    onSuccess: async () => {
      notify.success('Temporada atualizada')
      await invalidateSeasons(qc)
    },
  })
}

export function useActivateSeason(): UseMutationResult<SeasonRow, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateSeason,
    onSuccess: async (row) => {
      notify.success('Temporada ativada', row.name)
      await invalidateSeasons(qc)
      await qc.invalidateQueries({ queryKey: qk.profiles.all() })
    },
  })
}

/** Encerrar toca o ledger (conquistas/marcos) → `invalidateAfterLedgerChange`. Devolve `warnings`. */
export function useCloseSeason(): UseMutationResult<CloseSeasonPayload, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: closeSeason,
    onSuccess: async () => {
      notify.success('Temporada encerrada')
      await invalidateSeasons(qc)
      await invalidateAfterLedgerChange(qc)
    },
  })
}

export function useSpecialEvents(): UseQueryResult<VSpecialEvent[]> {
  return useQuery({ queryKey: qk.settings.events(), queryFn: getSpecialEvents })
}

async function invalidateEvents(qc: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.settings.events() }),
    qc.invalidateQueries({ queryKey: qk.bootstrap() }),
    qc.invalidateQueries({ queryKey: qk.dashboard.all() }),
  ])
}

export function useSaveSpecialEvent(): UseMutationResult<SpecialEventRow, Error, SaveSpecialEventInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveSpecialEvent,
    onSuccess: async (_row, vars) => {
      notify.success(vars.id ? 'Evento atualizado' : 'Evento criado')
      await invalidateEvents(qc)
    },
  })
}

export function useDeleteSpecialEvent(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSpecialEvent,
    onSuccess: async () => {
      notify.success('Evento desativado')
      await invalidateEvents(qc)
    },
  })
}

export function useRecomputeStats(): UseMutationResult<
  RecomputeStatsPayload,
  Error,
  string | null | undefined
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileId) => recomputeStats(profileId),
    onSuccess: async (payload) => {
      notify.success(
        'Estatísticas recalculadas',
        `${payload.profiles} perfis · ${payload.seasons} temporadas`,
      )
      await invalidateAfterLedgerChange(qc)
    },
  })
}
