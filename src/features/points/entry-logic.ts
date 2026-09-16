import type { PointRuleInsert, PointRuleRow, RpcArgs } from '@/lib/database.types'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/dates'
import {
  OCCURRED_AT_FUTURE_TOLERANCE_MS,
  OCCURRED_AT_MAX_DAYS_BACK,
  type ManualEntryFormValues,
  type RuleEntryFormValues,
  type RuleFormInput,
  type RuleFormValues,
} from './schemas'

/** Lógica pura de Pontuação (testada em entry-logic.test.ts). */

const DAY_MS = 24 * 60 * 60 * 1000

export type OccurredAtCheck = { ok: true; iso: string } | { ok: false; message: string }

/** Espelha a validação de `record_rule_entry`: ≤ now + 5 min e ≥ now − 90 dias (DATA-MODEL §7.4). */
export function checkOccurredAt(value: string, tz: string, now: number = Date.now()): OccurredAtCheck {
  const iso = fromDateTimeLocalValue(value, tz)
  if (!iso) return { ok: false, message: 'Informe data e hora válidas.' }
  const t = new Date(iso).getTime()
  if (t > now + OCCURRED_AT_FUTURE_TOLERANCE_MS)
    return { ok: false, message: 'A data não pode estar no futuro.' }
  if (t < now - OCCURRED_AT_MAX_DAYS_BACK * DAY_MS)
    return { ok: false, message: `Só é possível lançar até ${OCCURRED_AT_MAX_DAYS_BACK} dias atrás.` }
  return { ok: true, iso }
}

/** Regras elegíveis ao lançamento por regra: manuais e ativas (FRONTEND-ARCH §4.5). */
export function selectableRules(rules: readonly PointRuleRow[]): PointRuleRow[] {
  return rules.filter((r) => r.trigger_kind === 'manual' && r.is_active)
}

/** Prévia dos pontos/moedas de um lançamento por regra (sem multiplicador de evento — vem do banco). */
export function previewRuleEntry(
  rule: PointRuleRow | null,
  quantity: number,
): { points: number; coins: number } {
  if (!rule || !Number.isFinite(quantity) || quantity < 1) return { points: 0, coins: 0 }
  const q = Math.floor(quantity)
  return { points: rule.points * q, coins: rule.coins * q }
}

export function toRuleEntryArgs(
  values: RuleEntryFormValues,
  occurredAtIso: string,
): RpcArgs<'record_rule_entry'> {
  return {
    p_profile_id: values.profileId,
    p_rule_id: values.ruleId,
    p_quantity: values.quantity,
    p_amount: values.amount ?? null,
    p_occurred_at: occurredAtIso,
    p_reason: values.reason ?? null,
  }
}

/** ±pontos pela direção; moedas opcionais (null = padrão do banco: pontos positivos viram moedas). */
export function toManualEntryArgs(values: ManualEntryFormValues): RpcArgs<'record_manual_entry'> {
  const signed = values.direction === 'remove' ? -values.points : values.points
  return {
    p_profile_id: values.profileId,
    p_points: signed,
    p_reason: values.reason,
    p_coins: values.coins ?? null,
  }
}

export function ruleFormDefaults(rule: PointRuleRow | null, nextSortOrder = 0): RuleFormInput {
  if (!rule) {
    return {
      name: '',
      metric: 'activity',
      points: 10,
      coins: 10,
      triggerKind: 'manual',
      amountStep: null,
      requiresAmount: false,
      isActive: true,
      sortOrder: nextSortOrder,
    }
  }
  return {
    name: rule.name,
    metric: rule.metric,
    points: rule.points,
    coins: rule.coins,
    triggerKind: rule.trigger_kind,
    amountStep: rule.amount_step,
    requiresAmount: rule.requires_amount,
    isActive: rule.is_active,
    sortOrder: rule.sort_order,
  }
}

export function toRuleInsert(values: RuleFormValues, id?: string): PointRuleInsert & { id?: string } {
  return {
    ...(id ? { id } : {}),
    name: values.name,
    metric: values.metric,
    points: values.points,
    coins: values.coins,
    trigger_kind: values.triggerKind,
    amount_step: values.triggerKind === 'auto_amount_step' ? values.amountStep : null,
    requires_amount: values.requiresAmount,
    is_active: values.isActive,
    sort_order: values.sortOrder,
  }
}

/** Valor inicial do campo data/hora: agora, no fuso do app. */
export function nowLocalValue(tz: string, now: Date = new Date()): string {
  return toDateTimeLocalValue(now.toISOString(), tz)
}

/** Próximo `sort_order` livre (maior + 10, como o seed). */
export function nextSortOrder(rules: readonly PointRuleRow[]): number {
  return rules.reduce((max, r) => Math.max(max, r.sort_order), 0) + 10
}

/** Total de páginas do histórico (nunca menor que 1). */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(Math.max(total, 0) / pageSize))
}
