import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload, DashboardData, VProfileStats, VRanking } from '@/lib/database.types'

const getDashboard = vi.fn()
const getActivityFeedPage = vi.fn()
let bootstrap: BootstrapPayload = makeBootstrap()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/realtime', () => ({ useRealtimeInvalidate: vi.fn() }))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(bootstrap),
  useMeOptional: () => toMe(bootstrap),
}))
vi.mock('../api', () => ({
  FEED_PAGE_SIZE: 20,
  getDashboard: (...a: unknown[]) => getDashboard(...a),
  getActivityFeedPage: (...a: unknown[]) => getActivityFeedPage(...a),
  getTeamOverview: vi.fn(),
}))

import { CollaboratorDashboard } from './collaborator-dashboard'

const SEASON = {
  id: 's1',
  name: 'Setembro',
  starts_at: '2026-09-01T03:00:00Z',
  ends_at: '2026-10-01T03:00:00Z',
  team_goal_amount: 0,
  xp_per_level: 400,
  is_active: true,
  days_left: 15,
}
const ME_ID = makeMe().id

const emptyData = (): DashboardData => ({
  season: SEASON,
  stats: null,
  ranking_top: [],
  missions_today: [],
  next_reward: null,
  pending_earned_spins: 0,
  active_event: null,
  feed: [],
})

const statsRow = (over: Partial<VProfileStats> = {}): VProfileStats => {
  const me = makeMe()
  return {
    profile_id: me.id,
    season_id: 's1',
    full_name: me.full_name,
    avatar_path: null,
    color: me.color,
    job_title: 'closer',
    team: null,
    role: 'collaborator',
    status: 'active',
    email: null,
    phone: null,
    season_name: 'Setembro',
    season_starts_at: SEASON.starts_at,
    season_ends_at: SEASON.ends_at,
    season_is_active: true,
    points: 850,
    points_earned: 850,
    sales_amount: 2500,
    sales_count: 1,
    meetings_scheduled: 0,
    meetings_held: 2,
    calls: 0,
    crm_updates: 0,
    lead_recoveries: 0,
    upsells: 0,
    activities_count: 0,
    missions_completed: 0,
    conversion_pct: 50,
    attendance_pct: null,
    goal_amount: 10000,
    goal_pct: 25,
    goal_missing_amount: 7500,
    projected_goal_date: '2026-09-25',
    xp_per_level: 400,
    level: 2,
    xp_in_level: 50,
    xp_to_next: 350,
    coins_balance: 40,
    coins_earned_lifetime: 40,
    coins_spent_lifetime: 0,
    streak_days: 3,
    best_streak_days: 3,
    sales_amount_lifetime: 2500,
    sales_count_lifetime: 1,
    rank: 2,
    gap_to_above: 120,
    is_tied_with_above: false,
    has_points: true,
    achievements_unlocked: 0,
    achievements_total: 6,
    pending_earned_spins: 0,
    last_entry_at: null,
    ...over,
  }
}
const rankingRow = (rank: number, id: string, name: string): VRanking => ({
  season_id: 's1',
  rank,
  gap_to_above: rank === 1 ? null : 120,
  is_tied_with_above: false,
  has_points: true,
  profile_id: id,
  full_name: name,
  avatar_path: null,
  color: makeMe().color,
  job_title: 'closer',
  team: null,
  points: 1000 - rank * 100,
  level: 2,
  sales_amount: 0,
  sales_count: 0,
  conversion_pct: null,
  meetings_held: 0,
})

beforeEach(() => {
  bootstrap = makeBootstrap()
  getDashboard.mockReset().mockResolvedValue(emptyData())
  getActivityFeedPage.mockReset().mockResolvedValue({ rows: [], nextCursor: null })
})

describe('CollaboratorDashboard', () => {
  test('sem temporada ativa: mostra o estado §9 e não chama get_dashboard', async () => {
    renderInRouter(<CollaboratorDashboard />)
    expect(await screen.findByText('Sem temporada ativa')).toBeInTheDocument()
    expect(getDashboard).not.toHaveBeenCalled()
  })

  test('temporada ativa com banco vazio: nível 0, "—" no ranking, estados vazios de §9, sem NaN', async () => {
    bootstrap = makeBootstrap({ season: SEASON, me: makeMe({ level: 0, xp_to_next: 400 }) })
    getDashboard.mockResolvedValue({
      ...emptyData(),
      ranking_top: [{ ...rankingRow(1, ME_ID, makeMe().full_name), points: 0, has_points: false }],
    })
    const { container } = renderInRouter(<CollaboratorDashboard />)
    expect(await screen.findByText('Nível 0')).toBeInTheDocument()
    expect(screen.getByText('faltam 400 pts para o nível 1')).toBeInTheDocument()
    expect(screen.getByText('Sua meta ainda não foi definida')).toBeInTheDocument()
    expect(screen.getByText('Você é o único no ranking por enquanto')).toBeInTheDocument()
    expect(screen.getByText('Nenhum evento especial agendado')).toBeInTheDocument()
    expect(screen.getByText('Sem missões para hoje')).toBeInTheDocument()
    expect(await screen.findByText('Ainda não há atividade')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/NaN|undefined/)
  })

  test('com dados: stats, meta com projeção, top 5 com "Você" e evento com contador', async () => {
    bootstrap = makeBootstrap({ season: SEASON })
    const future = new Date(Date.now() + 3_600_000).toISOString()
    const later = new Date(Date.now() + 7_200_000).toISOString()
    getDashboard.mockResolvedValue({
      ...emptyData(),
      stats: statsRow(),
      ranking_top: [rankingRow(1, 'other-1', 'Colaborador A'), rankingRow(2, ME_ID, makeMe().full_name)],
      active_event: {
        id: 'e1',
        name: 'Hora do fogo',
        multiplier: 2,
        starts_at: future,
        ends_at: later,
        state: 'upcoming',
      },
    })
    renderInRouter(<CollaboratorDashboard />)
    expect(await screen.findByText('Nível 2')).toBeInTheDocument()
    expect(screen.getByText('R$ 2.500 de R$ 10.000')).toBeInTheDocument()
    expect(screen.getByText('Ritmo atual: meta projetada para 25/09')).toBeInTheDocument()
    expect(screen.getByText('Você')).toBeInTheDocument()
    expect(screen.getByText('Colaborador A')).toBeInTheDocument()
    expect(screen.getByText('começa em')).toBeInTheDocument()
    expect(screen.getByText(/TODOS OS PONTOS EM DOBRO/)).toBeInTheDocument()
    await waitFor(() => expect(getActivityFeedPage).toHaveBeenCalled())
  })
})
