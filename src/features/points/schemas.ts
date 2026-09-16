import { z } from 'zod'
import { zInt, zLocalDateTime, zMoneyOptional, zText, zTextOptional, zUuid } from '@/lib/forms'
import type { MetricType, RuleTriggerKind } from '@/lib/database.types'

/** Schemas de formulário de Pontuação (WP7). Limites espelham os CHECKs de DATA-MODEL §4.10/§7.4. */

export const RULE_METRICS: readonly MetricType[] = [
  'sale',
  'meeting_scheduled',
  'meeting_held',
  'call',
  'crm_update',
  'lead_recovery',
  'upsell',
  'amount_step',
  'weekly_goal',
  'monthly_goal',
  'activity',
  'custom',
]
export const RULE_TRIGGERS: readonly RuleTriggerKind[] = ['manual', 'auto_amount_step', 'auto_goal']

export const RULE_POINTS_MAX = 100_000
export const RULE_NAME_MAX = 60
export const QUANTITY_MAX = 1000
export const MANUAL_POINTS_MAX = 100_000
export const REASON_MIN = 3
export const REASON_MAX = 500
/** DATA-MODEL §7.4: `p_occurred_at` entre `now() - 90 dias` e `now() + 5 min`. */
export const OCCURRED_AT_MAX_DAYS_BACK = 90
export const OCCURRED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000

export const ruleFormSchema = z
  .object({
    name: zText(RULE_NAME_MAX),
    metric: z.enum(RULE_METRICS as [MetricType, ...MetricType[]]),
    points: zInt(0, RULE_POINTS_MAX),
    coins: zInt(0, RULE_POINTS_MAX),
    triggerKind: z.enum(RULE_TRIGGERS as [RuleTriggerKind, ...RuleTriggerKind[]]),
    amountStep: zMoneyOptional,
    requiresAmount: z.boolean(),
    isActive: z.boolean(),
    sortOrder: zInt(0, 9999),
  })
  .superRefine((v, ctx) => {
    if (
      v.triggerKind === 'auto_amount_step' &&
      (v.metric !== 'amount_step' || !v.amountStep || v.amountStep <= 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountStep'],
        message: 'Regra automática por faturamento exige métrica "Bloco de faturamento" e valor do bloco.',
      })
    }
    if (v.triggerKind === 'auto_goal' && v.metric !== 'monthly_goal') {
      ctx.addIssue({
        code: 'custom',
        path: ['metric'],
        message: 'Regra automática de meta exige a métrica "Meta mensal".',
      })
    }
    if (v.triggerKind === 'manual' && (v.metric === 'amount_step' || v.metric === 'monthly_goal')) {
      ctx.addIssue({
        code: 'custom',
        path: ['triggerKind'],
        message: 'Bloco de faturamento e Meta mensal só existem como regras automáticas.',
      })
    }
  })
export type RuleFormInput = z.input<typeof ruleFormSchema>
export type RuleFormValues = z.output<typeof ruleFormSchema>

export const ruleEntryFormSchema = z.object({
  profileId: zUuid,
  ruleId: zUuid,
  quantity: zInt(1, QUANTITY_MAX),
  amount: zMoneyOptional,
  occurredAt: zLocalDateTime,
  reason: zTextOptional(REASON_MAX),
})
export type RuleEntryFormInput = z.input<typeof ruleEntryFormSchema>
export type RuleEntryFormValues = z.output<typeof ruleEntryFormSchema>

export const manualEntryFormSchema = z.object({
  profileId: zUuid,
  direction: z.enum(['add', 'remove']),
  points: zInt(1, MANUAL_POINTS_MAX),
  reason: zText(REASON_MAX, REASON_MIN),
  coins: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce
      .number({ error: 'Informe um número.' })
      .int()
      .min(-MANUAL_POINTS_MAX)
      .max(MANUAL_POINTS_MAX)
      .nullable(),
  ),
})
export type ManualEntryFormInput = z.input<typeof manualEntryFormSchema>
export type ManualEntryFormValues = z.output<typeof manualEntryFormSchema>

export const reverseFormSchema = z.object({ reason: zText(REASON_MAX, REASON_MIN) })
export type ReverseFormInput = z.input<typeof reverseFormSchema>
export type ReverseFormValues = z.output<typeof reverseFormSchema>
