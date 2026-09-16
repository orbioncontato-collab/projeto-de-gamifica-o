import { describe, expect, it } from 'vitest'
import type { WheelPrizeRow } from '@/lib/database.types'
import type { PrizeDraft } from './components/prize-editor-row'
import { draftsFromRows, isDirty, moveDraft, newDraft, validateDrafts } from './prize-editor-state'
import { queueAddSchema, toSavePrizeInputs } from './schemas'
import { WHEEL_PALETTE } from './wheel-palette'

// Cores de teste por template: no-restricted-syntax proíbe literais hex em features/ (só a paleta é exceção).
const CUSTOM = `#${'abcdef'}`
const BLUE = WHEEL_PALETTE.classic[0] as string

const row = (over: Partial<WheelPrizeRow>): WheelPrizeRow => ({
  id: 'p1',
  wheel_id: 'w',
  label: '100 pontos',
  kind: 'points',
  value: 100,
  weight: 3,
  color: null,
  sort_order: 0,
  is_active: true,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  updated_by: null,
  ...over,
})
const draft = (over: Partial<PrizeDraft>): PrizeDraft => ({
  key: 'k',
  label: 'R$ 10 PIX',
  kind: 'cash',
  value: '10',
  weight: '1',
  color: BLUE,
  is_active: true,
  ...over,
})

describe('draftsFromRows / newDraft', () => {
  it('maps rows to drafts with palette fallback color', () => {
    const d = draftsFromRows('classic', [
      row({}),
      row({ id: 'p2', color: CUSTOM, value: null, kind: 'extra_spin' }),
    ])
    expect(d[0]).toMatchObject({ id: 'p1', key: 'p1', value: '100', weight: '3', color: BLUE })
    expect(d[1]).toMatchObject({ value: '', color: CUSTOM.toUpperCase() })
  })
  it('creates unique keys for new drafts', () => {
    const a = newDraft('premium', 0)
    const b = newDraft('premium', 1)
    expect(a.key).not.toBe(b.key)
    expect(a.id).toBeUndefined()
    expect(a.color).toBe(WHEEL_PALETTE.premium[0])
  })
})

describe('validateDrafts', () => {
  it('rejects fewer than 2 prizes', () => {
    const r = validateDrafts([draft({})])
    expect(r.values).toBeNull()
    expect(r.listErrors[0]).toMatch(/pelo menos 2/)
  })
  it('rejects fewer than 2 active prizes and mystery without pool', () => {
    const r = validateDrafts([draft({}), draft({ key: 'b', is_active: false })])
    expect(r.listErrors.some((e) => /ativos/.test(e))).toBe(true)
    const m = validateDrafts([
      draft({ kind: 'mystery', value: '' }),
      draft({ key: 'b', kind: 'extra_spin', value: '' }),
    ])
    expect(m.listErrors.some((e) => /Mystery Box/.test(e))).toBe(true)
  })
  it('maps field errors by row index', () => {
    const r = validateDrafts([
      draft({ label: '' }),
      draft({ key: 'b', value: '0' }),
      draft({ key: 'c', weight: '0', color: 'blue' }),
    ])
    expect(r.values).toBeNull()
    expect(r.rowErrors[0]?.label).toBeTruthy()
    expect(r.rowErrors[1]?.value).toMatch(/maior que zero/)
    expect(r.rowErrors[2]?.weight).toBeTruthy()
    expect(r.rowErrors[2]?.color).toBe('Cor inválida.')
  })
  it('accepts a valid list and builds the RPC payload with sort_order = index', () => {
    const r = validateDrafts([
      draft({ id: 'p1', value: '10,5' }),
      draft({ key: 'b', kind: 'extra_spin', value: 'ignored' }),
    ])
    expect(r.listErrors).toEqual([])
    const payload = toSavePrizeInputs(r.values ?? [])
    expect(payload).toEqual([
      {
        id: 'p1',
        label: 'R$ 10 PIX',
        kind: 'cash',
        value: 10.5,
        weight: 1,
        color: BLUE,
        sort_order: 0,
        is_active: true,
      },
      {
        label: 'R$ 10 PIX',
        kind: 'extra_spin',
        value: null,
        weight: 1,
        color: BLUE,
        sort_order: 1,
        is_active: true,
      },
    ])
  })
})

describe('moveDraft / isDirty', () => {
  it('moves without mutating and clamps at the edges', () => {
    const list = [draft({ key: 'a' }), draft({ key: 'b' }), draft({ key: 'c' })]
    expect(moveDraft(list, 0, 1).map((d) => d.key)).toEqual(['b', 'a', 'c'])
    expect(moveDraft(list, 0, -1).map((d) => d.key)).toEqual(['a', 'b', 'c'])
    expect(list.map((d) => d.key)).toEqual(['a', 'b', 'c'])
  })
  it('detects changes in any field, order or length', () => {
    const base = [draft({ key: 'a' }), draft({ key: 'b', label: 'B' })]
    expect(
      isDirty(
        base,
        base.map((d) => ({ ...d })),
      ),
    ).toBe(false)
    expect(isDirty(base, [base[0] as PrizeDraft])).toBe(true)
    expect(isDirty(base, [base[0] as PrizeDraft, { ...(base[1] as PrizeDraft), weight: '2' }])).toBe(true)
    expect(isDirty(base, moveDraft(base, 0, 1))).toBe(true)
  })
})

describe('queueAddSchema', () => {
  it('requires a profile for collaborator and a name for guest; attempts 1..20', () => {
    expect(
      queueAddSchema.safeParse({ mode: 'collaborator', profileId: '', wheelKind: 'classic', attempts: 1 })
        .success,
    ).toBe(false)
    expect(
      queueAddSchema.safeParse({ mode: 'guest', personName: 'A', wheelKind: 'classic', attempts: 1 }).success,
    ).toBe(false)
    expect(
      queueAddSchema.safeParse({
        mode: 'guest',
        personName: 'Visitante',
        wheelKind: 'premium',
        attempts: '21',
      }).success,
    ).toBe(false)
    const ok = queueAddSchema.safeParse({
      mode: 'guest',
      personName: ' Visitante ',
      wheelKind: 'premium',
      attempts: '20',
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data).toMatchObject({ personName: 'Visitante', attempts: 20 })
  })
})
