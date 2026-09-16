import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload, VRanking } from '@/lib/database.types'

const getRanking = vi.fn()
let bootstrap: BootstrapPayload = makeBootstrap()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(bootstrap),
  useMeOptional: () => toMe(bootstrap),
}))
vi.mock('@/features/profiles/api', () => ({
  getRanking: (...a: unknown[]) => getRanking(...a),
  getProfileStats: vi.fn(),
  getProfileStat: vi.fn(),
  getActiveProfiles: vi.fn(),
  getPendingMembers: vi.fn(),
  getProfilePrivate: vi.fn(),
  getAchievementBoard: vi.fn(),
}))

import { RankingPage } from './ranking-page'

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

const row = (
  rank: number,
  points: number,
  id: string,
  name: string,
  gap: number | null = rank === 1 ? null : 50,
): VRanking => ({
  season_id: 's1',
  rank,
  gap_to_above: gap,
  is_tied_with_above: gap === 0,
  has_points: points > 0,
  profile_id: id,
  full_name: name,
  avatar_path: null,
  color: ME.color,
  job_title: 'sdr',
  team: null,
  points,
  level: 0,
  sales_amount: 0,
  sales_count: 0,
  conversion_pct: null,
  meetings_held: 0,
})

beforeEach(() => {
  bootstrap = makeBootstrap({ season: SEASON })
  getRanking.mockReset().mockResolvedValue([])
})

describe('RankingPage', () => {
  test('sem temporada: estado §9 e nenhuma consulta', async () => {
    bootstrap = makeBootstrap()
    renderInRouter(<RankingPage />)
    expect(await screen.findByText('Sem temporada ativa')).toBeInTheDocument()
    expect(getRanking).not.toHaveBeenCalled()
  })

  test('só eu, sem pontos: pódio em aberto e lista com "Você" líder', async () => {
    getRanking.mockResolvedValue([row(1, 0, ME.id, ME.full_name)])
    renderInRouter(<RankingPage />)
    expect(await screen.findByText('Pódio em aberto')).toBeInTheDocument()
    expect(screen.getByText('Você')).toBeInTheDocument()
    expect(screen.getByText('Líder')).toBeInTheDocument()
  })

  test('1 pessoa com pontos: pódio parcial com 2º/3º "vaga em aberto"', async () => {
    getRanking.mockResolvedValue([row(1, 120, ME.id, ME.full_name)])
    renderInRouter(<RankingPage />)
    expect((await screen.findAllByText('vaga em aberto')).length).toBe(2)
    expect(screen.getAllByText('Você').length).toBeGreaterThan(0)
  })

  test('3 pessoas: pódio completo, gap e empate na lista', async () => {
    getRanking.mockResolvedValue([
      row(1, 300, 'p1', 'Colaborador A'),
      row(2, 250, ME.id, ME.full_name, 50),
      row(3, 250, 'p3', 'Colaborador C', 0),
    ])
    renderInRouter(<RankingPage />)
    expect(await screen.findByText('50 pts para o 1º')).toBeInTheDocument()
    expect(screen.getByText('Empatado com o 2º')).toBeInTheDocument()
    expect(screen.queryByText('vaga em aberto')).not.toBeInTheDocument()
    expect(screen.getByText('Temporada ativa')).toBeInTheDocument()
  })
})
