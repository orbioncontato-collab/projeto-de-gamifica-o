import { describe, expect, it } from 'vitest'
import type { WheelPrizeRow } from '@/lib/database.types'
import {
  activePrizes,
  EXTRA_TURNS,
  resolveSectorIndex,
  sectorAngle,
  sectorAtRotation,
  sectorCenterDeg,
  SPIN_DURATION_MS,
  SPIN_EASING,
  targetRotation,
} from './spin-engine'

const prize = (over: Partial<WheelPrizeRow>): WheelPrizeRow => ({
  id: 'p',
  wheel_id: 'w',
  label: 'x',
  kind: 'points',
  value: 1,
  weight: 1,
  color: null,
  sort_order: 0,
  is_active: true,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  updated_by: null,
  ...over,
})

/** Gerador determinístico (LCG) — sem aleatoriedade real no teste. */
const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('spin-engine constants', () => {
  it('matches the contract', () => {
    expect(SPIN_DURATION_MS).toBe(8200)
    expect(SPIN_EASING).toBe('cubic-bezier(0.04, 0.82, 0.12, 1)')
    expect(EXTRA_TURNS).toBe(10)
  })
})

describe('sectorAngle / sectorCenterDeg', () => {
  it('splits 360 by count and centers each sector', () => {
    expect(sectorAngle(6)).toBe(60)
    expect(sectorAngle(8)).toBe(45)
    expect(sectorAngle(0)).toBe(0)
    expect(sectorCenterDeg(0, 6)).toBe(30)
    expect(sectorCenterDeg(5, 6)).toBe(330)
    expect(sectorCenterDeg(3, 8)).toBe(157.5)
  })
})

describe('targetRotation', () => {
  it('lands exactly on the requested sector in 100 spins (6 and 8 sectors, chained)', () => {
    const rand = lcg(42)
    for (const count of [6, 8, 2, 12]) {
      let current = 0
      for (let i = 0; i < 100; i += 1) {
        const index = Math.floor(rand() * count)
        const next = targetRotation(current, index, count)
        expect(next).toBeGreaterThanOrEqual(current + 360 * EXTRA_TURNS)
        expect(next).toBeLessThan(current + 360 * (EXTRA_TURNS + 1))
        expect(sectorAtRotation(next, count)).toBe(index)
        // o ponteiro fica no centro do setor (não na borda)
        const pointer = (360 - (next % 360) + 360) % 360
        expect(Math.abs(pointer - sectorCenterDeg(index, count)) % 360).toBeLessThan(1e-6)
        current = next
      }
    }
  })
  it('returns current when there are no sectors', () => {
    expect(targetRotation(123, 0, 0)).toBe(123)
  })
  it('handles negative current rotation', () => {
    const next = targetRotation(-400, 2, 6)
    expect(sectorAtRotation(next, 6)).toBe(2)
    expect(next).toBeGreaterThan(-400)
  })
})

describe('resolveSectorIndex / activePrizes', () => {
  it('finds the index by prize id or returns null', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(resolveSectorIndex(list, 'b')).toBe(1)
    expect(resolveSectorIndex(list, 'zz')).toBeNull()
    expect(resolveSectorIndex([], 'a')).toBeNull()
  })
  it('filters inactive/deleted and sorts by sort_order', () => {
    const rows = [
      prize({ id: 'c', sort_order: 2 }),
      prize({ id: 'x', sort_order: 1, is_active: false }),
      prize({ id: 'a', sort_order: 0 }),
      prize({ id: 'd', sort_order: 3, deleted_at: '2026-01-02T00:00:00Z' }),
    ]
    expect(activePrizes(rows).map((p) => p.id)).toEqual(['a', 'c'])
    expect(rows.map((p) => p.id)).toEqual(['c', 'x', 'a', 'd']) // não muta
  })
})
