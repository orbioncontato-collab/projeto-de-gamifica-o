import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { qk, invalidateAfterLedgerChange } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import { formatPoints } from '@/lib/format'
import type { PointEntryRow, PointRuleInsert, PointRuleRow, RpcArgs } from '@/lib/database.types'
import {
  deletePointRule,
  getEntriesHistory,
  getPointRules,
  recordManualEntry,
  recordRuleEntry,
  reverseEntry,
  savePointRule,
  HISTORY_PAGE_SIZE,
  type EntriesHistoryPage,
  type EntriesHistoryParams,
} from './api'

/** Hooks de Pontuação (FRONTEND-ARCH §4.5 features/points). Erros de mutation: MutationCache → notify.error. */

export function usePointRules(opts?: { includeInactive?: boolean }): UseQueryResult<PointRuleRow[]> {
  const includeInactive = opts?.includeInactive ?? true
  return useQuery({
    queryKey: [...qk.ledger.rules(), includeInactive] as const,
    queryFn: () => getPointRules({ includeInactive }),
  })
}

export function useSavePointRule(): UseMutationResult<
  PointRuleRow,
  Error,
  PointRuleInsert & { id?: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: savePointRule,
    onSuccess: async (_row, vars) => {
      notify.success(vars.id ? 'Regra atualizada' : 'Regra criada')
      await qc.invalidateQueries({ queryKey: qk.ledger.rules() })
    },
  })
}

export function useDeletePointRule(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePointRule,
    onSuccess: async () => {
      notify.success('Regra excluída')
      await qc.invalidateQueries({ queryKey: qk.ledger.rules() })
    },
  })
}

export function useEntriesHistory(params: EntriesHistoryParams): UseQueryResult<EntriesHistoryPage> {
  const pageSize = params.pageSize ?? HISTORY_PAGE_SIZE
  return useQuery({
    queryKey: qk.ledger.history({ profileId: params.profileId, page: params.page, pageSize }),
    queryFn: () => getEntriesHistory({ ...params, pageSize }),
    placeholderData: keepPreviousData,
  })
}

export function useRecordRuleEntry(): UseMutationResult<PointEntryRow, Error, RpcArgs<'record_rule_entry'>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordRuleEntry,
    onSuccess: async (row) => {
      notify.success('Lançamento registrado', `${formatPoints(row.points)} creditados.`)
      await invalidateAfterLedgerChange(qc)
    },
  })
}

export function useRecordManualEntry(): UseMutationResult<
  PointEntryRow,
  Error,
  RpcArgs<'record_manual_entry'>
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordManualEntry,
    onSuccess: async (row) => {
      notify.success('Ajuste registrado', `${formatPoints(row.points)} aplicados.`)
      await invalidateAfterLedgerChange(qc)
    },
  })
}

export function useReverseEntry(): UseMutationResult<
  PointEntryRow,
  Error,
  { entryId: string; reason: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reverseEntry,
    onSuccess: async () => {
      notify.success('Lançamento estornado')
      await invalidateAfterLedgerChange(qc)
    },
  })
}
