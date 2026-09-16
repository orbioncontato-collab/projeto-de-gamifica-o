import { describe, expect, test } from 'vitest'
import { checkMissionWindow, missionFormDefaults, toSaveMissionInput } from './mission-window'
import { missionFormSchema, type MissionFormValues } from './schemas'

const TZ = 'America/Sao_Paulo'
// Temporada de setembro/2026 no fuso do app (início 00:00 local = 03:00Z)
const season = { starts_at: '2026-09-01T03:00:00.000Z', ends_at: '2026-10-01T03:00:00.000Z' }

const base = (over: Partial<MissionFormValues> = {}): MissionFormValues => ({
  title: 'Fazer 5 ligações',
  description: null,
  icon: null,
  kind: 'daily',
  metric: 'call',
  targetKind: 'count',
  targetValue: 5,
  rewardPoints: 50,
  rewardCoins: 0,
  rewardSpin: 'none',
  startsAt: '2026-09-15T09:00',
  endsAt: '2026-09-15T18:00',
  audience: 'all',
  participantIds: [],
  isActive: true,
  ...over,
})

describe('checkMissionWindow', () => {
  test('accepts a window inside the season and converts to ISO in the app timezone', () => {
    const r = checkMissionWindow(base(), season, TZ)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.startsAt).toBe('2026-09-15T12:00:00.000Z')
      expect(r.endsAt).toBe('2026-09-15T21:00:00.000Z')
    }
  })
  test('rejects a window that starts before the season', () => {
    const r = checkMissionWindow(
      base({ startsAt: '2026-08-31T09:00', endsAt: '2026-09-01T18:00' }),
      season,
      TZ,
    )
    expect(r).toMatchObject({ ok: false, field: 'startsAt' })
  })
  test('rejects a window that ends after the season', () => {
    const r = checkMissionWindow(
      base({ startsAt: '2026-09-30T09:00', endsAt: '2026-10-02T18:00' }),
      season,
      TZ,
    )
    expect(r).toMatchObject({ ok: false, field: 'endsAt' })
  })
  test('rejects lightning missions longer than 24 hours', () => {
    const r = checkMissionWindow(
      base({ kind: 'lightning', startsAt: '2026-09-15T09:00', endsAt: '2026-09-16T10:00' }),
      season,
      TZ,
    )
    expect(r).toMatchObject({ ok: false, field: 'endsAt' })
    expect(r.ok ? '' : r.message).toContain('24')
  })
  test('accepts lightning of exactly 24 hours', () => {
    const r = checkMissionWindow(
      base({ kind: 'lightning', startsAt: '2026-09-15T09:00', endsAt: '2026-09-16T09:00' }),
      season,
      TZ,
    )
    expect(r.ok).toBe(true)
  })
  test('rejects end before start and missing season', () => {
    expect(checkMissionWindow(base({ endsAt: '2026-09-15T08:00' }), season, TZ)).toMatchObject({
      ok: false,
      field: 'endsAt',
    })
    expect(checkMissionWindow(base(), null, TZ)).toMatchObject({ ok: false, field: 'startsAt' })
  })
})

describe('toSaveMissionInput', () => {
  test('maps to save_mission payload; participant_ids only when audience = selected', () => {
    const win = { startsAt: '2026-09-15T12:00:00.000Z', endsAt: '2026-09-15T21:00:00.000Z' }
    const all = toSaveMissionInput(base(), win)
    expect(all).toMatchObject({
      title: 'Fazer 5 ligações',
      reward_spin: null,
      audience: 'all',
      starts_at: win.startsAt,
    })
    expect(all).not.toHaveProperty('participant_ids')
    expect(all).not.toHaveProperty('id')
    const selected = toSaveMissionInput(
      base({ audience: 'selected', participantIds: ['a', 'b'], rewardSpin: 'premium' }),
      win,
      'm1',
    )
    expect(selected.participant_ids).toEqual(['a', 'b'])
    expect(selected.id).toBe('m1')
    expect(selected.reward_spin).toBe('premium')
  })
})

describe('missionFormSchema', () => {
  test('requires some reward and participants when selected', () => {
    const noReward = missionFormSchema.safeParse(base({ rewardPoints: 0 }))
    expect(noReward.success).toBe(false)
    const noPeople = missionFormSchema.safeParse(base({ audience: 'selected', participantIds: [] }))
    expect(noPeople.success).toBe(false)
    const amountOnCall = missionFormSchema.safeParse(base({ targetKind: 'amount', metric: 'call' }))
    expect(amountOnCall.success).toBe(false)
    expect(missionFormSchema.safeParse(base({ targetKind: 'amount', metric: 'sale' })).success).toBe(true)
  })
})

describe('missionFormDefaults', () => {
  test('new mission defaults to today 09:00–18:00 in the app timezone', () => {
    const d = missionFormDefaults(null, TZ, new Date('2026-09-15T01:30:00.000Z')) // 22:30 do dia 14 em SP
    expect(d.startsAt).toBe('2026-09-14T09:00')
    expect(d.endsAt).toBe('2026-09-14T18:00')
    expect(d.audience).toBe('all')
  })
})
