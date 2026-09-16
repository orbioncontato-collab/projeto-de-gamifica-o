import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import type { VAchievementBoard } from '@/lib/database.types'
import { makeBootstrap, renderInRouter } from '@/features/auth/test-utils'
import { toMe, type Me } from '@/features/auth/bootstrap-query'

const me: { current: Me } = { current: toMe(makeBootstrap()) }
const getAchievementBoard = vi.fn<() => Promise<VAchievementBoard[]>>()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/features/auth/bootstrap-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => me.current,
  useMeOptional: () => me.current,
}))
vi.mock('@/features/profiles/api', () => ({ getAchievementBoard: () => getAchievementBoard() }))

import { AchievementsPage } from './achievements-page'

/** Catálogo do seed (DATA-MODEL §13.6) — sem pessoas fictícias. */
const row = (over: Partial<VAchievementBoard>): VAchievementBoard => ({
  achievement_id: over.achievement_id ?? 'a1',
  profile_id: me.current.me.id,
  code: 'first_sale',
  title: 'PRIMEIRA VENDA',
  description: 'Realize sua primeira venda',
  icon: '🎯',
  criteria: 'first_sale',
  criteria_value: null,
  scope: 'lifetime',
  reward_points: 50,
  reward_coins: 50,
  sort_order: 1,
  is_unlocked: false,
  unlocked_at: null,
  unlocked_count: 0,
  ...over,
})

const SEED: VAchievementBoard[] = [
  row({ achievement_id: 'a1' }),
  row({
    achievement_id: 'a2',
    code: 'on_fire',
    title: 'EM CHAMAS',
    description: '7 dias consecutivos com atividade',
    icon: '🔥',
    criteria: 'streak_days',
    criteria_value: 7,
    reward_points: 100,
    reward_coins: 100,
  }),
  row({
    achievement_id: 'a3',
    code: 'club_50k',
    title: '50K CLUB',
    description: 'R$ 50.000 vendidos',
    icon: '💎',
    criteria: 'sales_total',
    criteria_value: 50000,
    reward_points: 300,
    reward_coins: 300,
  }),
  row({
    achievement_id: 'a4',
    code: 'goal_reached',
    title: 'META BATIDA',
    description: 'Bateu a meta mensal',
    icon: '✅',
    criteria: 'monthly_goal',
    scope: 'season',
    reward_points: 200,
    reward_coins: 200,
  }),
  row({
    achievement_id: 'a5',
    code: 'champion',
    title: 'CAMPEÃO',
    description: '1º lugar no mês',
    icon: '🏆',
    criteria: 'rank_first',
    scope: 'season',
    reward_points: 500,
    reward_coins: 500,
  }),
  row({
    achievement_id: 'a6',
    code: 'club_100k',
    title: '100K CLUB',
    description: 'R$ 100.000 vendidos',
    icon: '👑',
    criteria: 'sales_total',
    criteria_value: 100000,
    reward_points: 600,
    reward_coins: 600,
  }),
]

beforeEach(() => {
  getAchievementBoard.mockReset()
})

describe('AchievementsPage', () => {
  test('seed with nothing unlocked: 6 locked cards and "0 de 6 desbloqueadas"', async () => {
    getAchievementBoard.mockResolvedValue(SEED)
    renderInRouter(<AchievementsPage />)
    expect(await screen.findByTestId('achievements-counter')).toHaveTextContent('0 de 6 desbloqueadas')
    expect(screen.getAllByText('Bloqueada')).toHaveLength(6)
    expect(screen.queryByText('Desbloqueada')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'PRIMEIRA VENDA' })).toBeInTheDocument()
  })

  test('unlocked + repeatable: shows ✨ state, date and ×N counter', async () => {
    getAchievementBoard.mockResolvedValue([
      row({
        achievement_id: 'a1',
        is_unlocked: true,
        unlocked_at: '2026-09-05T15:00:00Z',
        unlocked_count: 1,
      }),
      row({
        achievement_id: 'a4',
        code: 'goal_reached',
        title: 'META BATIDA',
        criteria: 'monthly_goal',
        scope: 'season',
        is_unlocked: true,
        unlocked_at: '2026-09-12T15:00:00Z',
        unlocked_count: 2,
      }),
      row({
        achievement_id: 'a5',
        code: 'champion',
        title: 'CAMPEÃO',
        criteria: 'rank_first',
        scope: 'season',
      }),
    ])
    renderInRouter(<AchievementsPage />)
    expect(await screen.findByTestId('achievements-counter')).toHaveTextContent('2 de 3 desbloqueadas')
    expect(screen.getAllByText('Desbloqueada')).toHaveLength(2)
    expect(screen.getByText('×2')).toBeInTheDocument()
    expect(screen.getByText('Desbloqueada em 05/09/2026')).toBeInTheDocument()
    expect(screen.getByText('Termine a temporada em 1º lugar')).toBeInTheDocument()
  })

  test('empty catalog shows the empty state', async () => {
    getAchievementBoard.mockResolvedValue([])
    renderInRouter(<AchievementsPage />)
    expect(await screen.findByText('Nenhuma conquista cadastrada')).toBeInTheDocument()
  })
})
