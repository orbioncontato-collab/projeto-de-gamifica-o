import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload, VProfileStats, VTeamStats } from '@/lib/database.types'

const getTeamOverview = vi.fn()
const getProfileStats = vi.fn()
const getRanking = vi.fn()
let bootstrap: BootstrapPayload = makeBootstrap()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/realtime', () => ({ useRealtimeInvalidate: vi.fn() }))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(bootstrap),
  useMeOptional: () => toMe(bootstrap),
}))
vi.mock('@/features/profiles/api', () => ({
  getProfileStats: (...a: unknown[]) => getProfileStats(...a),
  getRanking: (...a: unknown[]) => getRanking(...a),
  getProfileStat: vi.fn(),
  getActiveProfiles: vi.fn(),
  getPendingMembers: vi.fn(),
  getProfilePrivate: vi.fn(),
  getAchievementBoard: vi.fn(),
}))
vi.mock('../api', () => ({
  FEED_PAGE_SIZE: 20,
  getDashboard: vi.fn(),
  getActivityFeedPage: vi.fn(),
  getTeamOverview: (...a: unknown[]) => getTeamOverview(...a),
}))

import { ManagerOverview } from './manager-overview'

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
const admin = () => makeMe({ role: 'admin', job_title: 'manager' })

const team = (over: Partial<VTeamStats> = {}): VTeamStats => ({
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
  target_conversion_pct: 25,
  target_attendance_pct: 80,
  target_crm_pct: 90,
  target_activities_count: 20,
  ...over,
})
const meStats = (): VProfileStats => {
  const me = admin()
  return {
    profile_id: me.id,
    season_id: 's1',
    full_name: me.full_name,
    avatar_path: null,
    color: me.color,
    job_title: 'manager',
    team: null,
    role: 'admin',
    status: 'active',
    email: null,
    phone: null,
    season_name: 'Setembro',
    season_starts_at: SEASON.starts_at,
    season_ends_at: SEASON.ends_at,
    season_is_active: true,
    points: 0,
    points_earned: 0,
    sales_amount: 0,
    sales_count: 0,
    meetings_scheduled: 0,
    meetings_held: 0,
    calls: 0,
    crm_updates: 0,
    lead_recoveries: 0,
    upsells: 0,
    activities_count: 0,
    missions_completed: 0,
    conversion_pct: null,
    attendance_pct: null,
    goal_amount: 0,
    goal_pct: null,
    goal_missing_amount: 0,
    projected_goal_date: null,
    xp_per_level: 400,
    level: 0,
    xp_in_level: 0,
    xp_to_next: 400,
    coins_balance: 0,
    coins_earned_lifetime: 0,
    coins_spent_lifetime: 0,
    streak_days: 0,
    best_streak_days: 0,
    sales_amount_lifetime: 0,
    sales_count_lifetime: 0,
    rank: 1,
    gap_to_above: null,
    is_tied_with_above: false,
    has_points: false,
    achievements_unlocked: 0,
    achievements_total: 6,
    pending_earned_spins: 0,
    last_entry_at: null,
  }
}

beforeEach(() => {
  bootstrap = makeBootstrap({ me: admin() })
  getTeamOverview.mockReset().mockResolvedValue(team())
  getProfileStats.mockReset().mockResolvedValue([meStats()])
  getRanking.mockReset().mockResolvedValue([])
})

describe('ManagerOverview', () => {
  test('sem temporada: estado §9 com CTA do gestor; nenhuma view consultada', async () => {
    renderInRouter(<ManagerOverview />)
    expect(await screen.findByText('Sem temporada ativa')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar/ativar temporada' })).toBeInTheDocument()
    expect(getTeamOverview).not.toHaveBeenCalled()
  })

  test('só o gestor cadastrado: métricas zeradas, onboarding de 4 passos, tabela com 1 linha, Top 3 aguardando, saúde "—"', async () => {
    bootstrap = makeBootstrap({ me: admin(), season: SEASON })
    const { container } = renderInRouter(<ManagerOverview />)
    expect((await screen.findAllByText('meta não definida')).length).toBeGreaterThan(0)
    expect(screen.getByText('1 ativo')).toBeInTheDocument()
    expect(screen.getByText('Coloque a operação para rodar')).toBeInTheDocument()
    expect(screen.getByText('1. Defina a meta do time')).toBeInTheDocument()
    expect(screen.getAllByText('Usuário de Teste').length).toBeGreaterThan(0)
    expect(screen.getByText('Aguardando os primeiros pontos')).toBeInTheDocument()
    expect(screen.getByText('— (sem reuniões registradas)')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/NaN|undefined/)
  })

  test('com meta e vendas: % atingido, "faltam", sem onboarding', async () => {
    bootstrap = makeBootstrap({ me: admin(), season: SEASON })
    getTeamOverview.mockResolvedValue(
      team({
        team_goal_amount: 100000,
        sales_amount: 25000,
        attainment_pct: 25,
        sales_missing_amount: 75000,
        sales_count: 3,
        total_count: 2,
        active_count: 2,
      }),
    )
    renderInRouter(<ManagerOverview />)
    expect(await screen.findByText('25% atingido')).toBeInTheDocument()
    expect(screen.getByText('faltam R$ 75 mil')).toBeInTheDocument()
    expect(screen.queryByText('Coloque a operação para rodar')).not.toBeInTheDocument()
  })
})
