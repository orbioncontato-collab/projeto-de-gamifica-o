import { callRpc, supabase, unwrap } from '@/lib/supabase'
import type {
  ApproveSpinPayload,
  SavePrizeInput,
  SpinResultPayload,
  VWheelHistory,
  VWheelQueue,
  WheelKind,
  WheelPrizeRow,
  WheelQueueRow,
  WheelRow,
} from '@/lib/database.types'
import { activePrizes } from './spin-engine'

export const WHEEL_HISTORY_DEFAULT_LIMIT = 10
export const WHEEL_KINDS: readonly WheelKind[] = ['classic', 'premium']

export interface WheelConfigEntry {
  wheel: WheelRow
  prizes: WheelPrizeRow[]
}
export type WheelConfig = Record<WheelKind, WheelConfigEntry>

type WheelWithPrizes = WheelRow & { wheel_prizes: WheelPrizeRow[] | null }

/** `wheels` + `wheel_prizes` embutidos; filtra ativos/não apagados e ordena por `sort_order` no cliente. */
export async function getWheelConfig(): Promise<WheelConfig> {
  const rows = await unwrap(supabase.from('wheels').select('*, wheel_prizes(*)').order('kind'))
  const list = (rows ?? []) as unknown as WheelWithPrizes[]
  const config: Partial<WheelConfig> = {}
  for (const row of list) {
    const { wheel_prizes, ...wheel } = row
    config[wheel.kind] = { wheel, prizes: activePrizes(wheel_prizes ?? []) }
  }
  const missing = WHEEL_KINDS.filter((k) => !config[k])
  if (missing.length > 0) throw new Error(`Roleta não encontrada no catálogo: ${missing.join(', ')}.`)
  return config as WheelConfig
}

export async function getWheelQueue(): Promise<VWheelQueue[]> {
  const rows = await unwrap(supabase.from('v_wheel_queue').select('*').order('position'))
  return (rows ?? []) as VWheelQueue[]
}

export async function getWheelHistory(limit = WHEEL_HISTORY_DEFAULT_LIMIT): Promise<VWheelHistory[]> {
  const rows = await unwrap(
    supabase.from('v_wheel_history').select('*').order('approved_at', { ascending: false }).limit(limit),
  )
  return (rows ?? []) as VWheelHistory[]
}

export interface EnqueueInput {
  profileId?: string | null
  personName?: string | null
  wheelKind: WheelKind
  attempts: number
}

export function enqueueWheel(input: EnqueueInput): Promise<WheelQueueRow> {
  return callRpc('enqueue_wheel', {
    p_profile_id: input.profileId ?? null,
    p_person_name: input.personName ?? null,
    p_wheel_kind: input.wheelKind,
    p_attempts: input.attempts,
  })
}

export interface UpdateQueueEntryInput {
  queueId: string
  wheelKind?: WheelKind | null
  attempts?: number | null
}

export function updateQueueEntry(input: UpdateQueueEntryInput): Promise<WheelQueueRow> {
  return callRpc('update_queue_entry', {
    p_queue_id: input.queueId,
    p_wheel_kind: input.wheelKind ?? null,
    p_attempts: input.attempts ?? null,
  })
}

export const removeFromQueue = (queueId: string): Promise<WheelQueueRow> =>
  callRpc('remove_from_queue', { p_queue_id: queueId })

export const releaseTurn = (queueId: string): Promise<WheelQueueRow> =>
  callRpc('release_turn', { p_queue_id: queueId })

export const spinWheel = (queueId: string): Promise<SpinResultPayload> =>
  callRpc('spin_wheel', { p_queue_id: queueId })

export const spinWheelFree = (wheelKind: WheelKind): Promise<SpinResultPayload> =>
  callRpc('spin_wheel_free', { p_wheel_kind: wheelKind })

export const approveSpin = (spinId: string): Promise<ApproveSpinPayload> =>
  callRpc('approve_spin', { p_spin_id: spinId })

export const rejectSpin = (spinId: string): Promise<ApproveSpinPayload> =>
  callRpc('reject_spin', { p_spin_id: spinId })

export interface SaveWheelPrizesInput {
  wheelKind: WheelKind
  prizes: SavePrizeInput[]
}

export async function saveWheelPrizes(input: SaveWheelPrizesInput): Promise<WheelPrizeRow[]> {
  const rows = await callRpc('save_wheel_prizes', { p_wheel_kind: input.wheelKind, p_prizes: input.prizes })
  return activePrizes(rows ?? [])
}
