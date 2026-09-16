import { describe, expect, test } from 'vitest'
import type { VChallengeBoard } from '@/lib/database.types'
import {
  challengeFormDefaults,
  challengeRewardLabel,
  checkChallengeWindow,
  duelShare,
  formatMetricValue,
  toSaveChallengeInput,
} from './challenge-logic'
import { challengeFormSchema, type ChallengeFormValues } from './schemas'

const TZ = 'America/Sao_Paulo'
const season = { starts_at: '2026-09-01T03:00:00.000Z', ends_at: '2026-10-01T03:00:00.000Z' }
const NOW = new Date('2026-09-15T12:00:00.000Z').getTime()

const base = (over: Partial<ChallengeFormValues> = {}): ChallengeFormValues => ({
  name: 'Duelo de vendas',
  description: null,
  kind: 'duel',
  metric: 'sales_count',
  targetValue: 10,
  rewardPoints: 300,
  rewardCoins: 0,
  rewardSpin: 'none',
  rewardDescription: null,
  startsAt: '2026-09-15T00:00',
  endsAt: '2026-09-22T23:59',
  participantIds: ['a', 'b'],
  ...over,
})

describe('checkChallengeWindow', () => {
  test('accepts a window inside the season ending in the future', () => {
    const r = checkChallengeWindow(base(), season, TZ, NOW)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.startsAt).toBe('2026-09-15T03:00:00.000Z')
  })
  test('rejects end in the past, outside the season, or without season', () => {
    expect(
      checkChallengeWindow(
        base({ startsAt: '2026-09-10T00:00', endsAt: '2026-09-14T23:59' }),
        season,
        TZ,
        NOW,
      ),
    ).toMatchObject({ ok: false, field: 'endsAt' })
    expect(checkChallengeWindow(base({ endsAt: '2026-10-05T00:00' }), season, TZ, NOW)).toMatchObject({
      ok: false,
      field: 'endsAt',
    })
    expect(checkChallengeWindow(base({ startsAt: '2026-08-20T00:00' }), season, TZ, NOW)).toMatchObject({
      ok: false,
      field: 'startsAt',
    })
    expect(checkChallengeWindow(base(), null, TZ, NOW)).toMatchObject({ ok: false })
  })
})

describe('challengeFormSchema', () => {
  test('duel requires exactly 2 participants; team accepts empty (= everyone)', () => {
    expect(challengeFormSchema.safeParse(base({ participantIds: ['a'] })).success).toBe(false)
    expect(challengeFormSchema.safeParse(base({ participantIds: ['a', 'b', 'c'] })).success).toBe(false)
    expect(challengeFormSchema.safeParse(base()).success).toBe(true)
    expect(challengeFormSchema.safeParse(base({ kind: 'team', participantIds: [] })).success).toBe(true)
  })
})

describe('toSaveChallengeInput', () => {
  test('maps fields and keeps empty participant_ids for team (= all active)', () => {
    const win = { startsAt: '2026-09-15T03:00:00.000Z', endsAt: '2026-09-23T02:59:00.000Z' }
    const input = toSaveChallengeInput(
      base({ kind: 'team', participantIds: [], rewardSpin: 'premium' }),
      win,
      'c1',
    )
    expect(input).toMatchObject({
      id: 'c1',
      kind: 'team',
      participant_ids: [],
      reward_spin: 'premium',
      starts_at: win.startsAt,
    })
    expect(toSaveChallengeInput(base(), win)).not.toHaveProperty('id')
  })
})

describe('labels', () => {
  test('formatMetricValue by metric', () => {
    expect(formatMetricValue('revenue', 38500)).toBe('R$ 38.500')
    expect(formatMetricValue('points', 1850)).toBe('1.850 pts')
    expect(formatMetricValue('sales_count', 7)).toBe('7')
    expect(formatMetricValue('activities', Number.NaN)).toBe('0')
  })
  test('challengeRewardLabel prefers the free text, else composes parts', () => {
    expect(
      challengeRewardLabel({
        reward_points: 300,
        reward_coins: 0,
        reward_spin: null,
        reward_description: null,
      }),
    ).toBe('+300 pts')
    expect(
      challengeRewardLabel({
        reward_points: 0,
        reward_coins: 50,
        reward_spin: 'premium',
        reward_description: null,
      }),
    ).toBe('50 moedas · Roleta Premium')
    expect(
      challengeRewardLabel({
        reward_points: 0,
        reward_coins: 0,
        reward_spin: null,
        reward_description: 'Roleta Premium para todos',
      }),
    ).toBe('Roleta Premium para todos')
    expect(
      challengeRewardLabel({
        reward_points: 0,
        reward_coins: 0,
        reward_spin: null,
        reward_description: null,
      }),
    ).toBe('Sem prêmio definido')
  })
  test('duelShare is proportional and 50/50 when both are zero', () => {
    expect(duelShare(0, 0)).toBe(50)
    expect(duelShare(3, 1)).toBe(75)
    expect(duelShare(0, 5)).toBe(0)
  })
})

describe('challengeFormDefaults', () => {
  test('new challenge spans today → +7 days in the app timezone', () => {
    const d = challengeFormDefaults(null, TZ, new Date('2026-09-15T12:00:00.000Z'))
    expect(d.startsAt).toBe('2026-09-15T00:00')
    expect(d.endsAt).toBe('2026-09-22T23:59')
    expect(d.kind).toBe('duel')
  })
  test('editing a draft loads its participants', () => {
    const row = {
      name: 'Meta coletiva',
      description: null,
      kind: 'team',
      metric: 'revenue',
      target_value: 50000,
      reward_points: 0,
      reward_coins: 0,
      reward_spin: 'premium',
      reward_description: 'Roleta Premium para todos',
      starts_at: '2026-09-15T03:00:00.000Z',
      ends_at: '2026-09-30T02:59:00.000Z',
      participants: [{ profile_id: 'p1' }, { profile_id: 'p2' }],
    } as unknown as VChallengeBoard
    const d = challengeFormDefaults(row, TZ)
    expect(d.participantIds).toEqual(['p1', 'p2'])
    expect(d.rewardSpin).toBe('premium')
    expect(d.startsAt).toBe('2026-09-15T00:00')
  })
})
