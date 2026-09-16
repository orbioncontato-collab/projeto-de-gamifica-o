import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload, ChallengeParticipant, VChallengeBoard } from '@/lib/database.types'

const getChallengeBoard = vi.fn()
const activateChallenge = vi.fn()
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
  BOARD_STATUSES: ['active', 'draft', 'finished'],
  getChallengeBoard: (...a: unknown[]) => getChallengeBoard(...a),
  saveChallenge: vi.fn(),
  activateChallenge: (...a: unknown[]) => activateChallenge(...a),
  finishChallenge: vi.fn(),
  cancelChallenge: vi.fn(),
}))

import { ChallengesPage } from './challenges-page'

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

// Participantes de teste sem pessoas fictícias: o próprio usuário de teste e um segundo perfil genérico.
const participant = (over: Partial<ChallengeParticipant>): ChallengeParticipant => ({
  profile_id: ME.id,
  full_name: ME.full_name,
  avatar_path: null,
  color: ME.color,
  job_title: 'sdr',
  status: 'active',
  value: 0,
  pct: 0,
  is_winner: false,
  ...over,
})

const challenge = (over: Partial<VChallengeBoard>): VChallengeBoard => ({
  challenge_id: over.challenge_id ?? 'c1',
  season_id: 's1',
  name: 'Duelo de vendas',
  description: null,
  kind: 'duel',
  metric: 'sales_count',
  target_value: 10,
  reward_points: 300,
  reward_coins: 0,
  reward_spin: null,
  reward_description: null,
  starts_at: '2026-09-15T03:00:00Z',
  ends_at: '2026-09-22T03:00:00Z',
  status: 'active',
  winner_ids: [],
  activated_at: '2026-09-15T03:00:00Z',
  finished_at: null,
  days_left: 3,
  total_value: 4,
  total_pct: 40,
  participants_count: 2,
  participants: [
    participant({ value: 3, pct: 30 }),
    participant({
      profile_id: '00000000-0000-4000-8000-000000000002',
      full_name: 'Segundo Perfil de Teste',
      value: 1,
      pct: 10,
    }),
  ],
  ...over,
})

beforeEach(() => {
  bootstrap = makeBootstrap({ season: SEASON })
  getChallengeBoard.mockReset().mockResolvedValue([])
  activateChallenge.mockReset()
})

describe('ChallengesPage', () => {
  test('without an active season: §9 state and no query', async () => {
    bootstrap = makeBootstrap()
    renderInRouter(<ChallengesPage openNew={false} manage={false} />)
    expect(await screen.findByText('A próxima temporada ainda não começou')).toBeInTheDocument()
    expect(getChallengeBoard).not.toHaveBeenCalled()
  })

  test('empty board: "Nenhum desafio em andamento"; collaborator sees no manager', async () => {
    renderInRouter(<ChallengesPage openNew={false} manage={false} />)
    expect(await screen.findByText('Nenhum desafio em andamento')).toBeInTheDocument()
    expect(screen.queryByText('Desafios da temporada')).not.toBeInTheDocument()
    expect(getChallengeBoard).toHaveBeenCalledWith('s1', ['active', 'finished'])
  })

  test('with data: duel shows both sides, VS, values, reward and "finaliza em N dias"; team shows goal/done/%', async () => {
    getChallengeBoard.mockResolvedValue([
      challenge({}),
      challenge({
        challenge_id: 'c2',
        kind: 'team',
        name: 'Meta do time',
        metric: 'revenue',
        target_value: 50000,
        total_value: 38500,
        total_pct: 77,
        reward_description: 'Roleta Premium para todos',
        participants_count: 0,
        participants: [],
      }),
    ])
    renderInRouter(<ChallengesPage openNew={false} manage={false} />)
    expect(await screen.findByRole('heading', { name: 'Duelo de vendas' })).toBeInTheDocument()
    expect(screen.getByText('VS')).toBeInTheDocument()
    expect(screen.getByText('Segundo Perfil de Teste')).toBeInTheDocument()
    expect(screen.getByText('+300 pts')).toBeInTheDocument()
    expect(screen.getAllByText(/finaliza em 3 dias/).length).toBe(2)
    expect(screen.getByText('R$ 50.000')).toBeInTheDocument()
    expect(screen.getByText('R$ 38.500')).toBeInTheDocument()
    expect(screen.getByText('77%')).toBeInTheDocument()
    expect(screen.getByText('Roleta Premium para todos')).toBeInTheDocument()
    expect(screen.getByText('Todos os colaboradores ativos')).toBeInTheDocument()
  })

  test('admin: manager lists statuses with actions; draft shows Editar/Ativar; activate asks confirmation then calls RPC', async () => {
    bootstrap = makeBootstrap({ season: SEASON, me: makeMe({ role: 'admin' }) })
    getChallengeBoard.mockImplementation((_s: string, statuses: string[]) =>
      Promise.resolve(
        statuses.includes('draft')
          ? [
              challenge({
                challenge_id: 'd1',
                name: 'Rascunho de duelo',
                status: 'draft',
                activated_at: null,
              }),
            ]
          : [],
      ),
    )
    activateChallenge.mockResolvedValue({})
    const user = userEvent.setup()
    renderInRouter(<ChallengesPage openNew={false} manage />)
    expect(await screen.findByText('Rascunho de duelo')).toBeInTheDocument()
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ativar' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Ativar desafio?')
    await user.click(within(dialog).getByRole('button', { name: 'Ativar' }))
    await waitFor(() => expect(activateChallenge).toHaveBeenCalledWith('d1'))
  })

  test('admin ?novo=true opens the editor dialog', async () => {
    bootstrap = makeBootstrap({ season: SEASON, me: makeMe({ role: 'admin' }) })
    renderInRouter(<ChallengesPage openNew manage={false} />)
    expect(await screen.findByRole('dialog', { name: 'Novo desafio' })).toBeInTheDocument()
  })
})
