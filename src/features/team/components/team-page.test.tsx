import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PendingMember, VProfileStats } from '@/lib/database.types'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe, type Me } from '@/features/auth/bootstrap-query'
import { makeProfileStats } from '../test-fixtures'

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
const getProfileStats = vi.fn<() => Promise<VProfileStats[]>>()
const getPendingMembers = vi.fn<() => Promise<PendingMember[]>>()
const adminUpdateProfile = vi.fn<(input: unknown) => Promise<unknown>>()
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  callRpc: vi.fn(),
  unwrap: vi.fn(),
  avatarUrl: () => null,
  AVATAR_MIME: ['image/jpeg'],
}))
vi.mock('@/lib/notify', () => ({ notify }))
vi.mock('@/features/auth/bootstrap-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => me.current,
  useMeOptional: () => me.current,
}))
vi.mock('@/features/profiles/api', () => ({
  getProfileStats: () => getProfileStats(),
  getPendingMembers: () => getPendingMembers(),
  getProfileStat: vi.fn(),
  getRanking: vi.fn(),
  getActiveProfiles: vi.fn(),
  getProfilePrivate: vi.fn(),
  getAchievementBoard: vi.fn(),
}))
vi.mock('../api', () => ({
  cleanupAvatarFolder: vi.fn(),
  getTeamCode: vi.fn().mockResolvedValue('ABCD1234EFGH'),
  adminUpdateProfile: (input: unknown) => adminUpdateProfile(input),
  recordInitialPoints: vi.fn(),
  getInitialPointsSum: vi.fn().mockResolvedValue(0),
  sumPoints: () => 0,
  getCollaboratorDashboard: vi.fn().mockResolvedValue({ season: null }),
  uploadAdminAvatar: vi.fn(),
  assertAdminAvatarFile: vi.fn(),
}))

import { TeamPage } from './team-page'

const pendingMember = (over: Partial<PendingMember> = {}): PendingMember => ({
  id: '00000000-0000-4000-8000-000000000002',
  full_name: 'Cadastro de Teste',
  avatar_path: null,
  color: 'var(--avatar-fallback)',
  created_at: '2026-09-14T12:00:00Z',
  profile_private: { email: 'cadastro@exemplo.com' },
  ...over,
})

beforeEach(() => {
  getProfileStats.mockReset().mockResolvedValue([])
  getPendingMembers.mockReset().mockResolvedValue([])
  adminUpdateProfile.mockReset().mockResolvedValue({ profile: makeProfileStats(), warnings: [] })
  Object.values(notify).forEach((fn) => fn.mockReset())
})

describe('TeamPage › vazio', () => {
  test('fresh database: "Ainda só você aqui" and no pending section', async () => {
    renderInRouter(<TeamPage search={{}} />)
    expect(await screen.findByText('Ainda só você aqui')).toBeInTheDocument()
    expect(screen.queryByText(/Cadastros aguardando aprovação/)).not.toBeInTheDocument()
  })

  test('?pendentes=true shows the section with "Nenhum cadastro aguardando"', async () => {
    renderInRouter(<TeamPage search={{ pendentes: true }} />)
    expect(await screen.findByText('Nenhum cadastro aguardando')).toBeInTheDocument()
    expect(screen.getByText('Cadastros aguardando aprovação (0)')).toBeInTheDocument()
  })

  test('?convidar=true opens the invite dialog with the masked team code', async () => {
    renderInRouter(<TeamPage search={{ convidar: true }} />)
    expect(await screen.findByRole('dialog', { name: 'Como adicionar colaboradores' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/ABCD/)).toBeInTheDocument())
    expect(screen.queryByText('ABCD1234EFGH')).not.toBeInTheDocument()
    expect(screen.getAllByText(/\/signup/).length).toBeGreaterThan(0)
  })
})

describe('TeamPage › com dados', () => {
  test('table lists rows with status pills; pending shows "Pendente"', async () => {
    getProfileStats.mockResolvedValue([
      makeProfileStats({ profile_id: 'p1', full_name: 'Usuário de Teste' }),
      makeProfileStats({
        profile_id: 'p2',
        full_name: 'Cadastro de Teste',
        status: 'pending',
        role: 'collaborator',
      }),
    ])
    renderInRouter(<TeamPage search={{}} />)
    expect(await screen.findAllByText('Usuário de Teste')).not.toHaveLength(0)
    expect(screen.getAllByText('Pendente').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ativo').length).toBeGreaterThan(0)
  })

  test('pending section: Aprovar calls admin_update_profile({status:"active"}) and toasts', async () => {
    getPendingMembers.mockResolvedValue([pendingMember()])
    const user = userEvent.setup()
    renderInRouter(<TeamPage search={{}} />)
    expect(await screen.findByText('Cadastros aguardando aprovação (1)')).toBeInTheDocument()
    expect(screen.getByText(/cadastro@exemplo.com/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aprovar' }))
    await waitFor(() =>
      expect(adminUpdateProfile).toHaveBeenCalledWith({
        profileId: pendingMember().id,
        patch: { status: 'active' },
      }),
    )
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith(
        'Cadastro aprovado',
        expect.stringContaining('já pode entrar'),
      ),
    )
  })

  test('pending section: Recusar asks for confirmation then sends status inactive', async () => {
    getPendingMembers.mockResolvedValue([pendingMember()])
    const user = userEvent.setup()
    renderInRouter(<TeamPage search={{}} />)
    await user.click(await screen.findByRole('button', { name: 'Recusar' }))
    expect(await screen.findByText(/Recusar cadastro de Cadastro de Teste\?/)).toBeInTheDocument()
    expect(adminUpdateProfile).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Recusar' }))
    await waitFor(() =>
      expect(adminUpdateProfile).toHaveBeenCalledWith({
        profileId: pendingMember().id,
        patch: { status: 'inactive' },
      }),
    )
  })

  test('?perfil= opens the detail dialog by URL', async () => {
    getProfileStats.mockResolvedValue([makeProfileStats({ profile_id: 'p1', full_name: 'Usuário de Teste' })])
    renderInRouter(<TeamPage search={{ perfil: 'p1' }} />)
    expect(await screen.findByRole('dialog', { name: 'Usuário de Teste' })).toBeInTheDocument()
    expect(screen.getByText('Meta ainda não definida')).toBeInTheDocument()
  })
})
