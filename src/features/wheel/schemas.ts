import { z } from 'zod'
import { zHexColor, zInt, zText } from '@/lib/forms'
import type { PrizeKind, SavePrizeInput, WheelKind } from '@/lib/database.types'

export const MAX_ATTEMPTS = 20
export const MIN_ATTEMPTS = 1
export const MIN_PRIZES = 2
export const MAX_PRIZES = 12
export const MAX_PRIZE_WEIGHT = 1000
export const PRIZE_LABEL_MAX = 40
export const GUEST_NAME_MAX = 80

export const WHEEL_KIND_VALUES = ['classic', 'premium'] as const satisfies readonly WheelKind[]
export const PRIZE_KIND_VALUES = [
  'points',
  'coins',
  'cash',
  'voucher',
  'extra_spin',
  'multiplier',
  'mystery',
  'custom',
] as const satisfies readonly PrizeKind[]

/** Tipos cujo `value` é obrigatório (> 0). */
export const VALUE_REQUIRED_KINDS: readonly PrizeKind[] = ['points', 'coins', 'cash', 'voucher', 'multiplier']

export const zWheelKind = z.enum(WHEEL_KIND_VALUES)
export const zAttempts = zInt(MIN_ATTEMPTS, MAX_ATTEMPTS)

export const queueAddSchema = z
  .object({
    mode: z.enum(['collaborator', 'guest']),
    profileId: z.string().optional(),
    personName: z.string().trim().max(GUEST_NAME_MAX, `No máximo ${GUEST_NAME_MAX} caracteres.`).optional(),
    wheelKind: zWheelKind,
    attempts: zAttempts,
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'collaborator' && !v.profileId) {
      ctx.addIssue({ code: 'custom', path: ['profileId'], message: 'Escolha um colaborador.' })
    }
    if (v.mode === 'guest' && !(v.personName && v.personName.length >= 2)) {
      ctx.addIssue({ code: 'custom', path: ['personName'], message: 'Informe o nome do convidado.' })
    }
  })
export type QueueAddInput = z.input<typeof queueAddSchema>
export type QueueAddValues = z.output<typeof queueAddSchema>

export const prizeRowSchema = z
  .object({
    id: z.string().optional(),
    label: zText(PRIZE_LABEL_MAX),
    kind: z.enum(PRIZE_KIND_VALUES),
    value: z.number().nullable(),
    weight: zInt(1, MAX_PRIZE_WEIGHT),
    color: zHexColor.nullable(),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (VALUE_REQUIRED_KINDS.includes(v.kind) && !(typeof v.value === 'number' && v.value > 0)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Informe um valor maior que zero.' })
    }
  })
export type PrizeRowValues = z.output<typeof prizeRowSchema>

export const prizeListSchema = z
  .array(prizeRowSchema)
  .min(MIN_PRIZES, `A roleta precisa de pelo menos ${MIN_PRIZES} prêmios.`)
  .max(MAX_PRIZES, `No máximo ${MAX_PRIZES} prêmios.`)
  .superRefine((list, ctx) => {
    const active = list.filter((p) => p.is_active)
    if (active.length < MIN_PRIZES) {
      ctx.addIssue({ code: 'custom', message: `Pelo menos ${MIN_PRIZES} prêmios precisam estar ativos.` })
    }
    const hasMystery = active.some((p) => p.kind === 'mystery')
    const pool = active.filter((p) => p.kind !== 'mystery' && p.kind !== 'extra_spin')
    if (hasMystery && pool.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mystery Box precisa de pelo menos um prêmio comum para sortear.',
      })
    }
  })

/** Converte as linhas do editor (ordem = índice) no payload `save_wheel_prizes`. */
export function toSavePrizeInputs(rows: readonly PrizeRowValues[]): SavePrizeInput[] {
  return rows.map((row, index) => ({
    ...(row.id ? { id: row.id } : {}),
    label: row.label,
    kind: row.kind,
    value: VALUE_REQUIRED_KINDS.includes(row.kind) ? row.value : null,
    weight: row.weight,
    color: row.color,
    sort_order: index,
    is_active: row.is_active,
  }))
}
