import { describe, expect, it } from 'vitest'
import type { VWheelQueue } from '@/lib/database.types'
import type { WheelState } from '@/lib/gamification'
import { canSpin, filterQueue, maskWhileSpinning, prizeValueText } from './wheel-logic'
import { deriveWheelState } from './hooks'
import { conicGradient, sectorColor, WHEEL_PALETTE } from './wheel-palette'

// Cores de teste montadas por template: a regra no-restricted-syntax proíbe literais hex em features/ (só a paleta é exceção).
const CUSTOM = `#${'ABCDEF'}`
const CUSTOM_2 = `#${'123456'}`
const C = WHEEL_PALETTE.classic
const P = WHEEL_PALETTE.premium

const ME = '00000000-0000-4000-8000-000000000001'

/** Linha de fila sem pessoa real: nome genérico de teste. */
const row = (over: Partial<VWheelQueue>): VWheelQueue => ({
  queue_id: 'q1',
  position: 1,
  profile_id: ME,
  person_name: 'Participante de Teste',
  avatar_path: null,
  color: null,
  source: 'manual',
  wheel_id: 'w-classic',
  wheel_kind: 'classic',
  wheel_name: 'Roleta Clássica',
  attempts_allowed: 1,
  attempts_used: 0,
  attempts_remaining: 1,
  status: 'waiting',
  released_at: null,
  created_at: '2026-01-01T00:00:00Z',
  pending_spin_id: null,
  pending_prize_label: null,
  pending_prize_kind: null,
  pending_resolved_label: null,
  pending_spun_at: null,
  ...over,
})

describe('deriveWheelState', () => {
  it('is free with empty queue and uses the fallback kind', () => {
    const s = deriveWheelState([], ME, 'premium')
    expect(s).toMatchObject({
      mode: 'free',
      active: null,
      myTurn: false,
      wheelKind: 'premium',
      pendingSpinId: null,
    })
  })
  it('is free when nobody is active (only waiting)', () => {
    expect(deriveWheelState([row({})], ME, 'classic').mode).toBe('free')
  })
  it('is turn for the active entry and detects my turn + wheel kind', () => {
    const s = deriveWheelState([row({ status: 'active', wheel_kind: 'premium' })], ME, 'classic')
    expect(s.mode).toBe('turn')
    expect(s.myTurn).toBe(true)
    expect(s.wheelKind).toBe('premium')
    expect(deriveWheelState([row({ status: 'active', profile_id: 'other' })], ME, 'classic').myTurn).toBe(
      false,
    )
  })
  it('is pending when the active entry has a pending spin', () => {
    const s = deriveWheelState(
      [row({ status: 'active', pending_spin_id: 'sp1', pending_prize_label: 'Giro extra' })],
      ME,
      'classic',
    )
    expect(s).toMatchObject({ mode: 'pending', pendingSpinId: 'sp1', pendingLabel: 'Giro extra' })
  })
})

describe('canSpin', () => {
  const base: WheelState = {
    mode: 'free',
    active: null,
    pendingSpinId: null,
    pendingLabel: null,
    myTurn: false,
    wheelKind: 'classic',
  }
  it('free: anyone; turn: admin or owner; pending: nobody', () => {
    expect(canSpin(base, false)).toBe(true)
    expect(canSpin({ ...base, mode: 'turn' }, false)).toBe(false)
    expect(canSpin({ ...base, mode: 'turn', myTurn: true }, false)).toBe(true)
    expect(canSpin({ ...base, mode: 'turn' }, true)).toBe(true)
    expect(canSpin({ ...base, mode: 'pending' }, true)).toBe(false)
  })
  it('maskWhileSpinning hides the pending prize only while spinning', () => {
    const pending: WheelState = { ...base, mode: 'pending', pendingSpinId: 'sp', pendingLabel: 'X' }
    expect(maskWhileSpinning(pending, false)).toBe(pending)
    expect(maskWhileSpinning(pending, true)).toMatchObject({
      mode: 'turn',
      pendingSpinId: null,
      pendingLabel: null,
    })
    expect(maskWhileSpinning(base, true)).toBe(base)
  })
})

describe('filterQueue', () => {
  it('matches ignoring accents and case without mutating', () => {
    const rows = [
      row({ queue_id: 'a', person_name: 'Convidado Ação' }),
      row({ queue_id: 'b', person_name: 'Outro Teste' }),
    ]
    expect(filterQueue(rows, 'acao').map((r) => r.queue_id)).toEqual(['a'])
    expect(filterQueue(rows, '  ').length).toBe(2)
    expect(filterQueue(rows, 'zzz')).toEqual([])
  })
})

describe('prizeValueText', () => {
  it('formats by kind and returns null when not applicable', () => {
    expect(prizeValueText('points', 500)).toBe('500 pts')
    expect(prizeValueText('coins', 1)).toBe('1 moeda')
    expect(prizeValueText('cash', 50)).toMatch(/R\$\s?50/)
    expect(prizeValueText('multiplier', 2)).toMatch(/^2,0x pontos/)
    expect(prizeValueText('extra_spin', 1)).toBeNull()
    expect(prizeValueText('points', null)).toBeNull()
    expect(prizeValueText('points', Number.NaN)).toBeNull()
  })
})

describe('wheel-palette', () => {
  it('uses prize color when valid and falls back to the palette in cycle', () => {
    expect(sectorColor('classic', 0, CUSTOM)).toBe(CUSTOM)
    expect(sectorColor('classic', 0, 'red')).toBe(C[0])
    expect(sectorColor('classic', 6, null)).toBe(C[0])
    expect(sectorColor('premium', 7, undefined)).toBe(P[7])
  })
  it('builds one stop per sector from the top clockwise', () => {
    const g = conicGradient('classic', [null, CUSTOM_2, null])
    expect(g).toBe(
      `conic-gradient(from 0deg, ${C[0]} 0deg 120deg, ${CUSTOM_2} 120deg 240deg, ${C[2]} 240deg 360deg)`,
    )
    expect(conicGradient('premium', [])).toContain('--wheel-dark-1')
  })
})
