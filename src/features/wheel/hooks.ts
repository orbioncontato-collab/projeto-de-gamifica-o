import { useMemo } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { invalidateAfterLedgerChange, qk } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import type {
  ApproveSpinPayload,
  SpinResultPayload,
  VWheelHistory,
  VWheelQueue,
  WheelKind,
  WheelPrizeRow,
  WheelQueueRow,
} from '@/lib/database.types'
import type { WheelState } from '@/lib/gamification'
import { useMe } from '@/features/auth/bootstrap-query'
import {
  approveSpin,
  enqueueWheel,
  getWheelConfig,
  getWheelHistory,
  getWheelQueue,
  rejectSpin,
  releaseTurn,
  removeFromQueue,
  saveWheelPrizes,
  spinWheel,
  spinWheelFree,
  updateQueueEntry,
  WHEEL_HISTORY_DEFAULT_LIMIT,
  type EnqueueInput,
  type SaveWheelPrizesInput,
  type UpdateQueueEntryInput,
  type WheelConfig,
} from './api'

export { useWheelRealtime } from './realtime'

const QUEUE_STALE_MS = 10_000

export function useWheelConfig(): UseQueryResult<WheelConfig> {
  return useQuery({ queryKey: qk.wheel.config(), queryFn: getWheelConfig })
}

export function useWheelQueue(): UseQueryResult<VWheelQueue[]> {
  return useQuery({ queryKey: qk.wheel.queue(), queryFn: getWheelQueue, staleTime: QUEUE_STALE_MS })
}

export function useWheelHistory(limit = WHEEL_HISTORY_DEFAULT_LIMIT): UseQueryResult<VWheelHistory[]> {
  return useQuery({ queryKey: qk.wheel.history(limit), queryFn: () => getWheelHistory(limit) })
}

/** Estado puro derivado da fila (testável sem React). */
export function deriveWheelState(
  queue: readonly VWheelQueue[] | undefined,
  meId: string,
  fallbackKind: WheelKind,
): WheelState {
  const active = queue?.find((row) => row.status === 'active') ?? null
  const pendingSpinId = active?.pending_spin_id ?? null
  const mode: WheelState['mode'] = pendingSpinId ? 'pending' : active ? 'turn' : 'free'
  return {
    mode,
    active,
    pendingSpinId,
    pendingLabel: active?.pending_prize_label ?? null,
    myTurn: active?.profile_id === meId,
    wheelKind: active?.wheel_kind ?? fallbackKind,
  }
}

/** Derivado de `useWheelQueue` + `me.id`. `fallbackKind` é a roleta escolhida no seletor quando não há vez ativa. */
export function useWheelState(
  fallbackKind: WheelKind = 'classic',
): WheelState & { queueQuery: UseQueryResult<VWheelQueue[]> } {
  const { me } = useMe()
  const queueQuery = useWheelQueue()
  const state = useMemo(
    () => deriveWheelState(queueQuery.data, me.id, fallbackKind),
    [queueQuery.data, me.id, fallbackKind],
  )
  return { ...state, queueQuery }
}

function useInvalidateQueue() {
  const qc = useQueryClient()
  return async (alsoBootstrap = false): Promise<void> => {
    await qc.invalidateQueries({ queryKey: qk.wheel.queue() })
    if (alsoBootstrap) await qc.invalidateQueries({ queryKey: qk.bootstrap() })
  }
}

export function useEnqueue(): UseMutationResult<WheelQueueRow, Error, EnqueueInput> {
  const invalidate = useInvalidateQueue()
  return useMutation({
    mutationFn: enqueueWheel,
    onSuccess: async (row) => {
      notify.success('Adicionado à fila', row.person_name)
      await invalidate(true)
    },
  })
}

export function useUpdateQueueEntry(): UseMutationResult<WheelQueueRow, Error, UpdateQueueEntryInput> {
  const invalidate = useInvalidateQueue()
  return useMutation({ mutationFn: updateQueueEntry, onSuccess: () => invalidate() })
}

export function useRemoveFromQueue(): UseMutationResult<WheelQueueRow, Error, string> {
  const invalidate = useInvalidateQueue()
  return useMutation({
    mutationFn: removeFromQueue,
    onSuccess: async (row) => {
      notify.success('Removido da fila', row.person_name)
      await invalidate(true)
    },
  })
}

export function useReleaseTurn(): UseMutationResult<WheelQueueRow, Error, string> {
  const invalidate = useInvalidateQueue()
  return useMutation({
    mutationFn: releaseTurn,
    onSuccess: async (row) => {
      notify.success('Giro liberado', `Vez de ${row.person_name}`)
      await invalidate(true)
    },
  })
}

/** rpc `spin_wheel` — quem chama anima com o retorno; invalida a fila só depois da animação (ver WheelPage). */
export function useSpinWheel(): UseMutationResult<SpinResultPayload, Error, string> {
  return useMutation({ mutationFn: spinWheel })
}

export function useSpinWheelFree(): UseMutationResult<SpinResultPayload, Error, WheelKind> {
  return useMutation({ mutationFn: spinWheelFree })
}

function useAfterSpinDecision() {
  const qc = useQueryClient()
  return async (): Promise<void> => {
    await invalidateAfterLedgerChange(qc)
  }
}

export function useApproveSpin(): UseMutationResult<ApproveSpinPayload, Error, string> {
  const after = useAfterSpinDecision()
  return useMutation({
    mutationFn: approveSpin,
    onSuccess: async (payload) => {
      const done = payload.queue.status === 'done'
      notify.success(
        payload.spin.credited ? 'Prêmio aprovado e creditado' : 'Prêmio aprovado (sem crédito automático)',
        done
          ? 'Tentativas esgotadas — saiu da fila.'
          : `Tentativa ${payload.queue.attempts_used} de ${payload.queue.attempts_allowed}.`,
      )
      await after()
    },
  })
}

export function useRejectSpin(): UseMutationResult<ApproveSpinPayload, Error, string> {
  const after = useAfterSpinDecision()
  return useMutation({
    mutationFn: rejectSpin,
    onSuccess: async () => {
      notify.info('Giro fechado sem aprovação', 'A tentativa não foi consumida.')
      await after()
    },
  })
}

export function useSaveWheelPrizes(): UseMutationResult<WheelPrizeRow[], Error, SaveWheelPrizesInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveWheelPrizes,
    onSuccess: async () => {
      notify.success('Prêmios salvos', 'A roleta foi atualizada para todos.')
      await qc.invalidateQueries({ queryKey: qk.wheel.config() })
    },
  })
}
