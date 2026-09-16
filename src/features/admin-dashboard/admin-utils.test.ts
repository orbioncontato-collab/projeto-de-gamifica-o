import { describe, expect, test } from 'vitest'
import type { VRanking, VSalesTimeline, VTeamStats } from '@/lib/database.types'
import {
  activitiesPerPerson,
  buildIndicators,
  dayLabel,
  hasTimelineData,
  indicatorTone,
  progressOf,
  toPersonPoints,
  toPointsSeries,
  toSalesSeries,
} from './admin-utils'

const day = (over: Partial<VSalesTimeline> = {}): VSalesTimeline => ({
  season_id: 's1',
  day: '2026-09-01',
  sales_amount: 0,
  sales_count: 0,
  sales_cum: 0,
  points: 0,
  points_cum: 0,
  entries_count: 0,
  ...over,
})

const rankRow = (over: Partial<VRanking> = {}): VRanking => ({
  season_id: 's1',
  rank: 1,
  gap_to_above: null,
  is_tied_with_above: false,
  has_points: true,
  profile_id: 'p1',
  full_name: 'Usuário de Teste',
  avatar_path: null,
  color: 'var(--avatar-fallback)',
  job_title: 'closer',
  team: null,
  points: 0,
  level: 1,
  sales_amount: 0,
  sales_count: 0,
  conversion_pct: null,
  meetings_held: 0,
  ...over,
})

const teamStats = (over: Partial<VTeamStats> = {}): VTeamStats => ({
  season_id: 's1',
  season_name: 'Setembro',
  starts_at: '2026-09-01T03:00:00Z',
  ends_at: '2026-10-01T03:00:00Z',
  is_active: true,
  team_goal_amount: 0,
  xp_per_level: 400,
  sales_amount: 0,
  attainment_pct: null,
  sales_missing_amount: 0,
  points_total: 0,
  points_distributed: 0,
  active_count: 1,
  pending_count: 0,
  total_count: 1,
  sales_count: 0,
  meetings_scheduled: 0,
  meetings_held: 0,
  calls: 0,
  crm_updates: 0,
  activities_count: 0,
  missions_completed: 0,
  avg_conversion_pct: null,
  attendance_pct: null,
  crm_pct: null,
  queue_count: 0,
  target_conversion_pct: 30,
  target_attendance_pct: 80,
  target_crm_pct: 90,
  target_activities_count: 20,
  ...over,
})

describe('admin-utils › séries', () => {
  test('hasTimelineData is false for a fresh database (zero points, zero sales)', () => {
    expect(hasTimelineData([])).toBe(false)
    expect(hasTimelineData([day(), day({ day: '2026-09-02' })])).toBe(false)
  })

  test('hasTimelineData is true once any cumulative value or entry exists', () => {
    expect(hasTimelineData([day({ points_cum: 10 })])).toBe(true)
    expect(hasTimelineData([day({ entries_count: 1 })])).toBe(true)
  })

  test('toSalesSeries / toPointsSeries map the view columns', () => {
    const rows = [day({ sales_cum: 1500, sales_amount: 500, points: 20, points_cum: 120 })]
    expect(toSalesSeries(rows)).toEqual([{ day: '2026-09-01', salesCum: 1500, salesAmount: 500 }])
    expect(toPointsSeries(rows)).toEqual([{ day: '2026-09-01', points: 20, pointsCum: 120 }])
  })

  test('toPersonPoints drops people with 0 points and respects the limit', () => {
    const rows = [
      rankRow({ points: 50 }),
      rankRow({ profile_id: 'p2', points: 0, rank: 2 }),
      rankRow({ profile_id: 'p3', points: 10, rank: 3 }),
    ]
    expect(toPersonPoints(rows).map((p) => p.profileId)).toEqual(['p1', 'p3'])
    expect(toPersonPoints(rows, 1)).toHaveLength(1)
  })

  test('dayLabel formats YYYY-MM-DD as DD/MM without Date', () => {
    expect(dayLabel('2026-09-05')).toBe('05/09')
    expect(dayLabel('x')).toBe('x')
  })
})

describe('admin-utils › indicadores', () => {
  test('indicatorTone: null is muted, ≥ target success, ≥ 70 % warning, below danger', () => {
    expect(indicatorTone(null, 30)).toBe('muted')
    expect(indicatorTone(30, 30)).toBe('success')
    expect(indicatorTone(21, 30)).toBe('warning')
    expect(indicatorTone(10, 30)).toBe('danger')
  })

  test('progressOf clamps to 0..100 and never divides by zero', () => {
    expect(progressOf(15, 30)).toBe(50)
    expect(progressOf(90, 30)).toBe(100)
    expect(progressOf(10, 0)).toBe(0)
    expect(progressOf(null, 30)).toBe(0)
  })

  test('activitiesPerPerson returns 0 when there are no active members', () => {
    expect(activitiesPerPerson({ activities_count: 10, active_count: 0 })).toBe(0)
    expect(activitiesPerPerson({ activities_count: 10, active_count: 4 })).toBe(3)
  })

  test('buildIndicators on a fresh database shows "—" with targets and no NaN', () => {
    const items = buildIndicators(teamStats())
    expect(items.map((i) => i.value)).toEqual(['—', '—', '—', '—'])
    expect(items.every((i) => i.tone === 'muted' && i.progress === 0)).toBe(true)
    expect(items[0]?.target).toBe('meta 30%')
    expect(JSON.stringify(items)).not.toContain('NaN')
  })
})
