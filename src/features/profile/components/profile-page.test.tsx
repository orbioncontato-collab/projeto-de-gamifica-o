import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload, VAchievementBoard, VProfileStats } from '@/lib/database.types'

const getProfileStat = vi.fn()
const getAchievementBoard = vi.fn()
const updateMyProfile = vi.fn()
let bootstrap: BootstrapPayload = makeBootstrap()

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  callRpc: vi.fn(),
  unwrap: vi.fn(),
  avatarUrl: () => null,
  AVATAR_MIME: ['image/jpeg', 'image/png', 'image/webp'],
  AVATAR_MAX_BYTES: 1_572_864,
  avatarObjectPath: () => 'x',
}))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(bootstrap),
  useMeOptional: () => toMe(bootstrap),
}))
vi.mock('@/features/auth/api', () => ({
  cleanupAvatarFolder: vi.fn().mockResolvedValue(0),
  uploadMyAvatar: vi.fn(),
}))
vi.mock('@/features/auth/profile-api', () => ({
  updateMyProfile: (...a: unknown[]) => updateMyProfile(...a),
  updateMyPreferences: vi.fn(),
}))
vi.mock('@/features/profiles/api', () => ({
  getProfileStat: (...a: unknown[]) => getProfileStat(...a),
  getAchievementBoard: (...a: unknown[]) => getAchievementBoard(...a),
  getRanking: vi.fn(),
  getProfileStats: vi.fn(),
  getActiveProfiles: vi.fn(),
  getPendingMembers: vi.fn(),
  getProfilePrivate: vi.fn(),
}))

import { ProfilePage } from './profile-page'

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

const achievement = (i: number, unlocked: boolean): VAchievementBoard =>
  ({
    achievement_id: `a${i}`,
    profile_id: ME.id,
    code: `code_${i}`,
    title: `Conquista ${i}`,
    description: null,
    icon: null,
    criteria: 'sales_count',
    threshold: 1,
    scope: 'lifetime',
    is_repeatable: false,
    reward_points: 0,
    reward_coins: 0,
    sort_order: i,
    is_unlocked: unlocked,
    unlocked_count: unlocked ? 1 : 0,
    first_unlocked_at: null,
    last_unlocked_at: null,
  }) as unknown as VAchievementBoard

const stats = (): VProfileStats => ({
  profile_id: ME.id,
  season_id: 's1',
  full_name: ME.full_name,
  avatar_path: null,
  color: ME.color,
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
  points: 300,
  points_earned: 300,
  sales_amount: 12000,
  sales_count: 2,
  meetings_scheduled: 0,
  meetings_held: 4,
  calls: 0,
  crm_updates: 0,
  lead_recoveries: 0,
  upsells: 0,
  activities_count: 0,
  missions_completed: 0,
  conversion_pct: 50,
  attendance_pct: null,
  goal_amount: 0,
  goal_pct: null,
  goal_missing_amount: 0,
  projected_goal_date: null,
  xp_per_level: 400,
  level: 0,
  xp_in_level: 300,
  xp_to_next: 100,
  coins_balance: 0,
  coins_earned_lifetime: 0,
  coins_spent_lifetime: 0,
  streak_days: 0,
  best_streak_days: 0,
  sales_amount_lifetime: 12000,
  sales_count_lifetime: 2,
  rank: 3,
  gap_to_above: 10,
  is_tied_with_above: false,
  has_points: true,
  achievements_unlocked: 1,
  achievements_total: 2,
  pending_earned_spins: 0,
  last_entry_at: null,
})

beforeEach(() => {
  bootstrap = makeBootstrap({ season: SEASON })
  getProfileStat.mockReset().mockResolvedValue(null)
  getAchievementBoard.mockReset().mockResolvedValue([])
  updateMyProfile.mockReset().mockResolvedValue({})
})

describe('ProfilePage', () => {
  test('banco vazio: "R$ 0 · 0 · — · —", conquistas vazias, botão Editar perfil', async () => {
    const { container } = renderInRouter(<ProfilePage />)
    expect(await screen.findByText('R$ 0')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBe(2)
    expect(screen.getByText('0 pts · sem posição')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma conquista cadastrada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar perfil' })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/NaN|undefined/)
  })

  test('sem temporada: números do bootstrap e estado "Sem temporada ativa" nos stats', async () => {
    bootstrap = makeBootstrap()
    renderInRouter(<ProfilePage />)
    expect(await screen.findByText('Sem temporada ativa')).toBeInTheDocument()
    expect(getProfileStat).not.toHaveBeenCalled()
  })

  test('com dados: stats da temporada e mini-grid "1 de 2 desbloqueadas"', async () => {
    getProfileStat.mockResolvedValue(stats())
    getAchievementBoard.mockResolvedValue([achievement(1, true), achievement(2, false)])
    renderInRouter(<ProfilePage />)
    expect(await screen.findByText('R$ 12 mil')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('3º')).toBeInTheDocument()
    expect(await screen.findByText('de 2 desbloqueadas')).toBeInTheDocument()
  })

  test('Editar perfil abre o diálogo e salva só o que mudou', async () => {
    const user = userEvent.setup()
    renderInRouter(<ProfilePage />)
    await user.click(await screen.findByRole('button', { name: 'Editar perfil' }))
    const name = await screen.findByLabelText(/Nome/)
    await user.clear(name)
    await user.type(name, 'Usuário Renomeado')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(updateMyProfile).toHaveBeenCalledWith(ME.id, { full_name: 'Usuário Renomeado' }),
    )
  })
})
