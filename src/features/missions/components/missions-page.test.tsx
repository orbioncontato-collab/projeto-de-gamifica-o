import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload, VMissionBoard } from '@/lib/database.types'

const getMissionBoard = vi.fn()
const getMissionsAdmin = vi.fn()
let bootstrap: BootstrapPayload = makeBootstrap()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/realtime', () => ({
  subscribeToTables: () => () => undefined,
  useRealtimeInvalidate: () => undefined,
}))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(bootstrap),
  useMeOptional: () => toMe(bootstrap),
}))
vi.mock('@/features/profiles/api', () => ({
  getActiveProfiles: vi.fn().mockResolvedValue([]),
  getRanking: vi.fn(),
  getProfileStats: vi.fn(),
  getProfileStat: vi.fn(),
  getPendingMembers: vi.fn(),
  getProfilePrivate: vi.fn(),
  getAchievementBoard: vi.fn(),
}))
vi.mock('../api', () => ({
  getMissionBoard: (...a: unknown[]) => getMissionBoard(...a),
  getMissionsAdmin: (...a: unknown[]) => getMissionsAdmin(...a),
  saveMission: vi.fn(),
  deleteMission: vi.fn(),
}))

import { MissionsPage } from './missions-page'

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
const ME = makeMe()

const mission = (over: Partial<VMissionBoard>): VMissionBoard => ({
  mission_id: over.mission_id ?? 'm1',
  season_id: 's1',
  profile_id: ME.id,
  title: 'Fazer 5 ligações',
  description: null,
  icon: '📞',
  kind: 'daily',
  metric: 'call',
  target_kind: 'count',
  target_value: 5,
  reward_points: 50,
  reward_coins: 0,
  reward_spin: null,
  starts_at: '2026-09-15T12:00:00Z',
  ends_at: '2026-09-15T21:00:00Z',
  audience: 'all',
  is_active: true,
  is_current: true,
  period_key: '2026-09-15',
  period_start: '2026-09-15T03:00:00Z',
  period_end: '2026-09-16T03:00:00Z',
  progress_value: 2,
  progress_pct: 40,
  is_completed: false,
  completed_at: null,
  seconds_remaining: 3600,
  spin_queue_status: null,
  ...over,
})

beforeEach(() => {
  bootstrap = makeBootstrap({ season: SEASON })
  getMissionBoard.mockReset().mockResolvedValue([])
  getMissionsAdmin.mockReset().mockResolvedValue([])
})

describe('MissionsPage', () => {
  test('without an active season: §9 state and no query', async () => {
    bootstrap = makeBootstrap()
    renderInRouter(<MissionsPage filter="hoje" openNew={false} />)
    expect(await screen.findByText('A próxima temporada ainda não começou')).toBeInTheDocument()
    expect(getMissionBoard).not.toHaveBeenCalled()
  })

  test('empty board (fresh install): "Sem missão relâmpago hoje" + "Nenhuma missão para hoje"; collaborator has no "Nova missão"', async () => {
    renderInRouter(<MissionsPage filter="hoje" openNew={false} />)
    expect(await screen.findByText('Nenhuma missão para hoje')).toBeInTheDocument()
    expect(screen.getByText('Sem missão relâmpago hoje')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nova missão/ })).not.toBeInTheDocument()
    expect(getMissionBoard).toHaveBeenCalledWith('hoje', ME.id)
    expect(getMissionsAdmin).not.toHaveBeenCalled()
  })

  test('with data: lightning goes to the hero with countdown, daily card shows progress and reward', async () => {
    getMissionBoard.mockResolvedValue([
      mission({}),
      mission({
        mission_id: 'm2',
        kind: 'lightning',
        title: 'Realize uma venda hoje',
        reward_spin: 'premium',
        reward_points: 0,
        metric: 'sale',
        target_value: 1,
        progress_value: 0,
        progress_pct: 0,
      }),
      mission({
        mission_id: 'm3',
        title: 'Agendar 2 reuniões',
        metric: 'meeting_scheduled',
        target_value: 2,
        progress_value: 2,
        progress_pct: 100,
        is_completed: true,
        completed_at: '2026-09-15T14:00:00Z',
      }),
    ])
    renderInRouter(<MissionsPage filter="hoje" openNew={false} />)
    expect(await screen.findByRole('heading', { name: 'Realize uma venda hoje' })).toBeInTheDocument()
    expect(screen.getByText('1 giro na Roleta Premium')).toBeInTheDocument()
    expect(screen.getByText('2/5')).toBeInTheDocument()
    expect(screen.getAllByText('+50 pts')).toHaveLength(2)
    expect(screen.getAllByText('Em progresso')).toHaveLength(2)
    expect(screen.getAllByText('Missão concluída').length).toBeGreaterThan(0)
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument()
  })

  test('admin: "Nova missão" button, admin list with empty state and filter links', async () => {
    bootstrap = makeBootstrap({ season: SEASON, me: makeMe({ role: 'admin' }) })
    renderInRouter(<MissionsPage filter="semana" openNew={false} />)
    expect(await screen.findByText('Nenhuma missão para a semana')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma missão criada')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Nova missão/ }).length).toBeGreaterThanOrEqual(2)
    expect(getMissionsAdmin).toHaveBeenCalledWith('s1')
    expect(screen.getByRole('link', { name: 'Semana' })).toHaveAttribute('aria-current', 'page')
  })

  test('admin ?novo=true opens the editor dialog', async () => {
    bootstrap = makeBootstrap({ season: SEASON, me: makeMe({ role: 'admin' }) })
    renderInRouter(<MissionsPage filter="hoje" openNew />)
    expect(await screen.findByRole('dialog', { name: 'Nova missão' })).toBeInTheDocument()
  })
})
