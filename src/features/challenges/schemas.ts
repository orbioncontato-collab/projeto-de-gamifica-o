import { z } from 'zod'
import { zInt, zLocalDateTime, zMoney, zText, zTextOptional } from '@/lib/forms'
import type { ChallengeKind, ChallengeMetric, WheelKind } from '@/lib/database.types'

/** Esquema do editor de desafio (DATA-MODEL §4.18 + `save_challenge` §7.4). */

export const CHALLENGE_NAME_MAX = 80
export const CHALLENGE_DESCRIPTION_MAX = 300
export const REWARD_DESCRIPTION_MAX = 120
export const REWARD_MAX = 100_000
export const DUEL_SIZE = 2

export const CHALLENGE_KINDS: readonly ChallengeKind[] = ['duel', 'team']
export const CHALLENGE_METRICS: readonly ChallengeMetric[] = [
  'meetings_held',
  'sales_count',
  'revenue',
  'points',
  'activities',
]
const WHEEL_KINDS: readonly WheelKind[] = ['classic', 'premium']

const TARGET_REQUIRED = 'O objetivo precisa ser maior que zero.'
const DUEL_NEEDS_TWO = 'Um duelo precisa de exatamente 2 participantes.'
const END_AFTER_START = 'O fim precisa ser depois do início.'

export const challengeFormSchema = z
  .object({
    name: zText(CHALLENGE_NAME_MAX),
    description: zTextOptional(CHALLENGE_DESCRIPTION_MAX),
    kind: z.enum(CHALLENGE_KINDS as [ChallengeKind, ...ChallengeKind[]]),
    metric: z.enum(CHALLENGE_METRICS as [ChallengeMetric, ...ChallengeMetric[]]),
    targetValue: zMoney,
    rewardPoints: zInt(0, REWARD_MAX),
    rewardCoins: zInt(0, REWARD_MAX),
    rewardSpin: z.enum(['none', ...WHEEL_KINDS] as ['none', WheelKind, ...WheelKind[]]),
    rewardDescription: zTextOptional(REWARD_DESCRIPTION_MAX),
    startsAt: zLocalDateTime,
    endsAt: zLocalDateTime,
    /** duelo: exatamente 2; coletivo: vazio = todos os ativos */
    participantIds: z.array(z.string()),
  })
  .refine((v) => v.targetValue > 0, { message: TARGET_REQUIRED, path: ['targetValue'] })
  .refine((v) => v.kind === 'team' || v.participantIds.length === DUEL_SIZE, {
    message: DUEL_NEEDS_TWO,
    path: ['participantIds'],
  })
  .refine((v) => v.endsAt > v.startsAt, { message: END_AFTER_START, path: ['endsAt'] })

export type ChallengeFormInput = z.input<typeof challengeFormSchema>
export type ChallengeFormValues = z.output<typeof challengeFormSchema>
