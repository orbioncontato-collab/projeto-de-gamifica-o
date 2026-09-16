import { describe, expect, test } from 'vitest'
import type { PointRuleRow } from '@/lib/database.types'
import {
  checkOccurredAt,
  nextSortOrder,
  pageCount,
  previewRuleEntry,
  selectableRules,
  toManualEntryArgs,
  toRuleEntryArgs,
  toRuleInsert,
} from './entry-logic'
import { manualEntryFormSchema, ruleFormSchema } from './schemas'

const TZ = 'America/Sao_Paulo'

const rule = (over: Partial<PointRuleRow>): PointRuleRow => ({
  id: over.id ?? '11111111-1111-4111-8111-111111111111',
  name: 'Venda realizada',
  metric: 'sale',
  points: 100,
  coins: 100,
  trigger_kind: 'manual',
  amount_step: null,
  requires_amount: true,
  is_active: true,
  sort_order: 10,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...over,
})

describe('checkOccurredAt', () => {
  const now = new Date('2026-09-15T15:00:00Z').getTime() // 12:00 em São Paulo

  test('aceita agora e devolve ISO', () => {
    const r = checkOccurredAt('2026-09-15T12:00', TZ, now)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.iso).toBe('2026-09-15T15:00:00.000Z')
  })

  test('bloqueia data futura além de 5 minutos', () => {
    const r = checkOccurredAt('2026-09-15T12:06', TZ, now)
    expect(r).toEqual({ ok: false, message: 'A data não pode estar no futuro.' })
  })

  test('tolera até 5 minutos no futuro', () => {
    expect(checkOccurredAt('2026-09-15T12:04', TZ, now).ok).toBe(true)
  })

  test('bloqueia mais de 90 dias atrás', () => {
    const r = checkOccurredAt('2026-06-01T12:00', TZ, now)
    expect(r.ok).toBe(false)
  })

  test('rejeita valor inválido', () => {
    expect(checkOccurredAt('abc', TZ, now).ok).toBe(false)
  })
})

describe('regras', () => {
  test('selectableRules filtra manuais e ativas', () => {
    const rules = [
      rule({ id: 'a' }),
      rule({ id: 'b', is_active: false }),
      rule({ id: 'c', trigger_kind: 'auto_goal', metric: 'monthly_goal' }),
    ]
    expect(selectableRules(rules).map((r) => r.id)).toEqual(['a'])
  })

  test('previewRuleEntry multiplica pela quantidade e zera sem regra', () => {
    expect(previewRuleEntry(rule({}), 3)).toEqual({ points: 300, coins: 300 })
    expect(previewRuleEntry(null, 3)).toEqual({ points: 0, coins: 0 })
    expect(previewRuleEntry(rule({}), 0)).toEqual({ points: 0, coins: 0 })
  })

  test('nextSortOrder = maior + 10', () => {
    expect(nextSortOrder([])).toBe(10)
    expect(nextSortOrder([rule({ sort_order: 40 }), rule({ sort_order: 20 })])).toBe(50)
  })

  test('toRuleInsert limpa amount_step fora de auto_amount_step', () => {
    const parsed = ruleFormSchema.parse({
      name: 'Ligação',
      metric: 'call',
      points: '5',
      coins: '5',
      triggerKind: 'manual',
      amountStep: '10.000,00',
      requiresAmount: false,
      isActive: true,
      sortOrder: 10,
    })
    expect(toRuleInsert(parsed, 'x').amount_step).toBeNull()
    expect(toRuleInsert(parsed).id).toBeUndefined()
  })

  test('ruleFormSchema recusa manual com métrica automática', () => {
    const r = ruleFormSchema.safeParse({
      name: 'Meta',
      metric: 'monthly_goal',
      points: 500,
      coins: 500,
      triggerKind: 'manual',
      amountStep: null,
      requiresAmount: false,
      isActive: true,
      sortOrder: 0,
    })
    expect(r.success).toBe(false)
  })
})

describe('lançamentos', () => {
  test('toRuleEntryArgs mapeia campos', () => {
    const args = toRuleEntryArgs(
      {
        profileId: '00000000-0000-4000-8000-000000000001',
        ruleId: '11111111-1111-4111-8111-111111111111',
        quantity: 2,
        amount: 8500,
        occurredAt: '2026-09-15T12:00',
        reason: null,
      },
      '2026-09-15T15:00:00.000Z',
    )
    expect(args).toEqual({
      p_profile_id: '00000000-0000-4000-8000-000000000001',
      p_rule_id: '11111111-1111-4111-8111-111111111111',
      p_quantity: 2,
      p_amount: 8500,
      p_occurred_at: '2026-09-15T15:00:00.000Z',
      p_reason: null,
    })
  })

  test('toManualEntryArgs inverte sinal ao remover e mantém moedas null', () => {
    const values = manualEntryFormSchema.parse({
      profileId: '00000000-0000-4000-8000-000000000001',
      direction: 'remove',
      points: '200',
      reason: 'Ajuste de duplicidade',
      coins: '',
    })
    expect(toManualEntryArgs(values)).toEqual({
      p_profile_id: '00000000-0000-4000-8000-000000000001',
      p_points: -200,
      p_reason: 'Ajuste de duplicidade',
      p_coins: null,
    })
  })

  test('pageCount nunca é menor que 1', () => {
    expect(pageCount(0, 25)).toBe(1)
    expect(pageCount(26, 25)).toBe(2)
    expect(pageCount(10, 0)).toBe(1)
  })
})
