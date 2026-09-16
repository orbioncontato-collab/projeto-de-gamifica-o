import { describe, expect, test } from 'vitest'
import {
  affordability,
  allowedActions,
  countByStatus,
  creditTitle,
  otherOriginsTotal,
  stockLabel,
  walletOrEmpty,
  EMPTY_WALLET,
} from './rewards-utils'

describe('creditTitle', () => {
  test('prefers reason, then rule name, then source label', () => {
    expect(creditTitle({ reason: 'Bônus de fechamento', rule: { name: 'Venda' }, source: 'rule' })).toBe(
      'Bônus de fechamento',
    )
    expect(creditTitle({ reason: null, rule: { name: 'Venda realizada' }, source: 'rule' })).toBe(
      'Venda realizada',
    )
    expect(creditTitle({ reason: '   ', rule: null, source: 'mission' })).toBe('Missão')
    expect(creditTitle({ reason: null, rule: null, source: 'wheel' })).toBe('Roleta')
  })
})

describe('walletOrEmpty', () => {
  test('returns zeros with the profile id when there is no row', () => {
    const w = walletOrEmpty(null, 'p1')
    expect(w.profile_id).toBe('p1')
    expect(w.coins_balance).toBe(0)
    expect(w.coins_from_sales).toBe(0)
  })
  test('keeps the row when present', () => {
    const row = { ...EMPTY_WALLET, profile_id: 'p2', coins_balance: 40 }
    expect(walletOrEmpty(row, 'p2')).toBe(row)
  })
})

describe('otherOriginsTotal', () => {
  test('sums wheel, challenges, achievements and manual only', () => {
    const w = {
      ...EMPTY_WALLET,
      coins_from_sales: 100,
      coins_from_wheel: 10,
      coins_from_challenges: 20,
      coins_from_achievements: 30,
      coins_from_manual: 5,
    }
    expect(otherOriginsTotal(w)).toBe(65)
  })
})

describe('affordability', () => {
  test('ok when balance covers the cost', () => {
    expect(affordability({ cost_coins: 500, stock: null }, 500)).toEqual({ kind: 'ok' })
  })
  test('missing N when balance is short', () => {
    expect(affordability({ cost_coins: 500, stock: 3 }, 120)).toEqual({ kind: 'missing', missing: 380 })
  })
  test('out of stock wins over balance', () => {
    expect(affordability({ cost_coins: 500, stock: 0 }, 9999)).toEqual({ kind: 'out_of_stock' })
  })
  test('debt (negative balance) reports missing greater than the cost', () => {
    expect(affordability({ cost_coins: 500, stock: null }, -200)).toEqual({ kind: 'debt', missing: 700 })
  })
})

describe('allowedActions', () => {
  test('follows DATA-MODEL §7.7 transitions', () => {
    expect(allowedActions('requested')).toEqual(['approve', 'deliver', 'cancel'])
    expect(allowedActions('approved')).toEqual(['deliver', 'cancel'])
    expect(allowedActions('delivered')).toEqual([])
    expect(allowedActions('cancelled')).toEqual([])
  })
})

describe('countByStatus', () => {
  test('counts every status and defaults to zero', () => {
    const counts = countByStatus([{ status: 'requested' }, { status: 'requested' }, { status: 'delivered' }])
    expect(counts).toEqual({ requested: 2, approved: 0, delivered: 1, cancelled: 0 })
  })
})

describe('stockLabel', () => {
  test('labels unlimited, exhausted, singular and plural', () => {
    expect(stockLabel(null)).toBe('Ilimitado')
    expect(stockLabel(0)).toBe('Esgotado')
    expect(stockLabel(1)).toBe('1 unidade')
    expect(stockLabel(7)).toBe('7 unidades')
  })
})
