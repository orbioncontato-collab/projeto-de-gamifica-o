import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { invalidateAfterLedgerChange, qk } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import { useRealtimeInvalidate } from '@/lib/realtime'
import type {
  ChallengeRow,
  ChallengeStatus,
  FinishChallengePayload,
  SaveChallengeInput,
  VChallengeBoard,
} from '@/lib/database.types'
import {
  activateChallenge,
  BOARD_STATUSES,
  cancelChallenge,
  finishChallenge,
  getChallengeBoard,
  saveChallenge,
} from './api'

/** Hooks de Desafios (FRONTEND-ARCH §4.5). Sem temporada ativa a query fica desabilitada. */

export function useChallengeBoard(
  seasonId: string | null,
  statuses: readonly ChallengeStatus[] = BOARD_STATUSES,
): UseQueryResult<VChallengeBoard[]> {
  const key = [...statuses].sort().join(',')
  return useQuery({
    queryKey: qk.challenges.board(seasonId, key),
    queryFn: () => getChallengeBoard(seasonId as string, statuses),
    enabled: !!seasonId,
  })
}

export function useSaveChallenge(): UseMutationResult<ChallengeRow, Error, SaveChallengeInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input) => saveChallenge(input),
    onSuccess: async (_row, input) => {
      notify.success(
        input.id ? 'Desafio atualizado' : 'Desafio criado como rascunho',
        'Ative quando estiver pronto.',
      )
      await qc.invalidateQueries({ queryKey: qk.challenges.all() })
    },
  })
}

export function useActivateChallenge(): UseMutationResult<ChallengeRow, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => activateChallenge(id),
    onSuccess: async () => {
      notify.success('Desafio ativado', 'Os participantes foram avisados.')
      await qc.invalidateQueries({ queryKey: qk.challenges.all() })
    },
  })
}

/** `finish_challenge` credita prêmios no ledger → `invalidateAfterLedgerChange`. */
export function useFinishChallenge(): UseMutationResult<FinishChallengePayload, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => finishChallenge(id),
    onSuccess: async (payload) => {
      const winners = payload.winner_ids.length
      notify.success(
        'Desafio finalizado',
        winners > 0
          ? 'Prêmios creditados aos vencedores.'
          : 'Ninguém atingiu o objetivo — nada foi creditado.',
      )
      await invalidateAfterLedgerChange(qc)
    },
  })
}

export function useCancelChallenge(): UseMutationResult<
  ChallengeRow,
  Error,
  { id: string; reason?: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }) => cancelChallenge(id, reason),
    onSuccess: async () => {
      notify.success('Desafio cancelado')
      await qc.invalidateQueries({ queryKey: qk.challenges.all() })
    },
  })
}

/** Progresso dos desafios chega pelo `feed_events` (vendas, reuniões…). */
export function useChallengesRealtime(): void {
  useRealtimeInvalidate({ table: 'feed_events', keys: [qk.challenges.all(), qk.missions.all()] })
}
