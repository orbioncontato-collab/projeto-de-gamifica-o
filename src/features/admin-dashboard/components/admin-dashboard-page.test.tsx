import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import type { VAdminKpis, VRanking, VSalesTimeline, VTeamStats } from '@/lib/database.types'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe, type Me } from '@/features/auth/bootstrap-query'

const SEASON = {
  id: 's1',
  name: 'Setembro',
  starts_at: '2026-09-01T03:00:00Z',
  ends_at: '2026-10-01T03:00:00Z',
  team_goal_amount: 0,
  xp_per_level: 400,
  is_active: true,
  days_left: 10,
}
const me: { current: Me } = {
  current: toMe(makeBootstrap({ me: makeMe({ role: 'admin' }), season: SEASON })),
}
const getTeamStats = vi.fn<() => Promise<VTeamStats | null>>()
const getAdminKpis = vi.fn<() => Promise<VAdminKpis | null>>()
const getSalesTimeline = vi.fn<() => Promise<VSalesTimeline[]>>()
const getRanking = vi.fn<() => Promise<VRanking[]>>()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))
vi.mock('@/features/auth/bootstrap-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => me.current,
  useMeOptional: () => me.current,
}))
vi.mock('@/features/profiles/api', () => ({
  getRanking: () => getRanking(),
  getProfileStats: vi.fn(),
  getPendingMembers: vi.fn(),
  getProfileStat: vi.fn(),
  getActiveProfiles: vi.fn(),
  getProfilePrivate: vi.fn(),
  getAchievementBoard: vi.fn(),
}))
vi.mock('../api', () => ({
  getTeamStats: () => getTeamStats(),
  getAdminKpis: () => getAdminKpis(),
  getSalesTimeline: () => getSalesTimeline(),
}))

import { AdminDashboardPage } from './admin-dashboard-page'

const teamStats = (over: Partial<VTeamStats> = {}): VTeamStats => ({
  season_id: 's1',
  season_name: 'Setembro',
  starts_at: SEASON.starts_at,
  ends_at: SEASON.ends_at,
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
const kpis = (over: Partial<VAdminKpis> = {}): VAdminKpis => ({
  season_id: 's1',
  redemptions_delivered_amount: 0,
  redemptions_pending_count: 0,
  entries_count: 0,
  coins_issued: 0,
  ...over,
})

beforeEach(() => {
  getTeamStats.mockReset().mockResolvedValue(teamStats())
  getAdminKpis.mockReset().mockResolvedValue(kpis())
  getSalesTimeline.mockReset().mockResolvedValue([])
  getRanking.mockReset().mockResolvedValue([])
})

describe('AdminDashboardPage', () => {
  test('fresh database: metrics zeroed, "meta não definida", charts replaced by empty states, ops bar counters', async () => {
    renderInRouter(<AdminDashboardPage />)
    expect(await screen.findByText('Meta do time')).toBeInTheDocument()
    expect(screen.getAllByText('meta não definida').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sem lançamentos na temporada — lance a primeira venda.').length).toBe(3)
    expect(screen.getByText('1 colaborador · 0 pontos · 0 lançamentos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cadastrar colaborador/ })).toHaveAttribute(
      'href',
      expect.stringContaining('convidar=true'),
    )
    expect(document.body.textContent).not.toContain('NaN')
    expect(document.body.textContent).not.toContain('undefined')
  })

  test('with data: attainment and indicators computed, charts rendered (no empty state)', async () => {
    getTeamStats.mockResolvedValue(
      teamStats({
        team_goal_amount: 10000,
        sales_amount: 2500,
        attainment_pct: 25,
        sales_missing_amount: 7500,
        sales_count: 3,
        avg_conversion_pct: 40,
        points_total: 300,
        points_distributed: 300,
      }),
    )
    getSalesTimeline.mockResolvedValue([
      {
        season_id: 's1',
        day: '2026-09-01',
        sales_amount: 2500,
        sales_count: 3,
        sales_cum: 2500,
        points: 300,
        points_cum: 300,
        entries_count: 3,
      },
    ])
    getRanking.mockResolvedValue([
      {
        season_id: 's1',
        rank: 1,
        gap_to_above: null,
        is_tied_with_above: false,
        has_points: true,
        profile_id: me.current.me.id,
        full_name: me.current.me.full_name,
        avatar_path: null,
        color: 'var(--avatar-fallback)',
        job_title: 'closer',
        team: null,
        points: 300,
        level: 1,
        sales_amount: 2500,
        sales_count: 3,
        conversion_pct: 40,
        meetings_held: 0,
      },
    ])
    renderInRouter(<AdminDashboardPage />)
    expect(await screen.findByText('25%')).toBeInTheDocument()
    expect(
      screen.queryByText('Sem lançamentos na temporada — lance a primeira venda.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('1 colaborador · 300 pontos · 0 lançamentos')).toBeInTheDocument()
  })

  test('without an active season: "Sem temporada ativa" and no queries', async () => {
    me.current = toMe(makeBootstrap({ me: makeMe({ role: 'admin' }), season: null }))
    renderInRouter(<AdminDashboardPage />)
    expect(await screen.findByText('Sem temporada ativa')).toBeInTheDocument()
    expect(getTeamStats).not.toHaveBeenCalled()
    me.current = toMe(makeBootstrap({ me: makeMe({ role: 'admin' }), season: SEASON }))
  })
})
