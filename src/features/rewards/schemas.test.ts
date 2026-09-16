import { describe, expect, test } from 'vitest'
import { formToRewardInsert, rewardSchema, rewardToForm, REWARD_FORM_DEFAULTS } from './schemas'
import type { RewardRow } from '@/lib/database.types'

const baseRow: RewardRow = {
  id: 'r1',
  name: 'Day Off',
  category: 'Benefício',
  value_amount: null,
  cost_coins: 5000,
  stock: null,
  icon: '🏖️',
  is_active: true,
  sort_order: 7,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

describe('rewardSchema', () => {
  test('accepts the defaults with a name and converts empty stock/value to null', () => {
    const parsed = rewardSchema.safeParse({ ...REWARD_FORM_DEFAULTS, name: 'R$ 20 iFood' })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.stock).toBeNull()
    expect(parsed.data.value_amount).toBeNull()
    expect(parsed.data.category).toBeNull()
  })
  test('rejects empty name, zero cost and negative stock', () => {
    expect(rewardSchema.safeParse({ ...REWARD_FORM_DEFAULTS, name: '' }).success).toBe(false)
    expect(rewardSchema.safeParse({ ...REWARD_FORM_DEFAULTS, name: 'x', cost_coins: 0 }).success).toBe(false)
    expect(rewardSchema.safeParse({ ...REWARD_FORM_DEFAULTS, name: 'x', stock: -1 }).success).toBe(false)
  })
  test('parses pt-BR money and numeric strings from inputs', () => {
    const parsed = rewardSchema.safeParse({
      ...REWARD_FORM_DEFAULTS,
      name: 'R$ 50 PIX',
      value_amount: '50,00',
      cost_coins: '1200',
      stock: '3',
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.value_amount).toBe(50)
    expect(parsed.data.cost_coins).toBe(1200)
    expect(parsed.data.stock).toBe(3)
  })
})

describe('rewardToForm / formToRewardInsert', () => {
  test('round-trips a row and keeps the id only when editing', () => {
    const form = rewardToForm(baseRow)
    expect(form.stock).toBe('')
    const parsed = rewardSchema.parse(form)
    expect(formToRewardInsert(parsed, baseRow.id)).toMatchObject({ id: 'r1', name: 'Day Off', stock: null })
    expect(formToRewardInsert(parsed)).not.toHaveProperty('id')
  })
})
