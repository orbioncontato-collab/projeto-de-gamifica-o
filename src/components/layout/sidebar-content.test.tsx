import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe, type Me } from '@/features/auth/bootstrap-query'

const me: { current: Me } = { current: toMe(makeBootstrap()) }
const logoutMutate = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } },
  callRpc: vi.fn(),
  unwrap: vi.fn(),
  avatarUrl: () => null,
  avatarObjectPath: () => '',
  AVATAR_MAX_BYTES: 1,
  AVATAR_MIME: [],
}))
vi.mock('@/features/auth/hooks', () => ({
  useMe: () => me.current,
  useLogout: () => ({ mutate: logoutMutate, isPending: false }),
}))

import { SidebarContent } from './sidebar-content'

beforeEach(() => {
  me.current = toMe(makeBootstrap())
})

describe('SidebarContent', () => {
  test('collaborator: 8 main items, Configurações and Sair; no "Administração"', async () => {
    renderInRouter(<SidebarContent />)
    expect(await screen.findByRole('link', { name: 'Visão Geral' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(9) // 8 + Configurações
    expect(screen.queryByText('Administração')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })
  test('admin: "Administração" with 8 items and no badge when pending_members = 0', async () => {
    me.current = toMe(makeBootstrap({ me: makeMe({ role: 'admin' }) }))
    renderInRouter(<SidebarContent />)
    expect(await screen.findByText('Administração')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(17)
    expect(screen.queryByLabelText(/aguardando aprovação/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Equipe' })).toHaveAttribute('href', '/admin/equipe')
  })
  test('admin: badge "2" on Equipe with aria-label and ?pendentes=true when pending_members > 0', async () => {
    me.current = toMe(makeBootstrap({ me: makeMe({ role: 'admin' }), pending_members: 2 }))
    renderInRouter(<SidebarContent />)
    const badge = await screen.findByLabelText('2 cadastros aguardando aprovação')
    expect(badge).toHaveTextContent('2')
    const team = screen.getByRole('link', { name: /Equipe/ })
    expect(team.getAttribute('href')).toContain('/admin/equipe?pendentes=true')
  })
  test('"Sair" calls logout', async () => {
    renderInRouter(<SidebarContent />)
    ;(await screen.findByRole('button', { name: 'Sair' })).click()
    expect(logoutMutate).toHaveBeenCalled()
  })
})
