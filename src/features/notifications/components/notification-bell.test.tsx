import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { NotificationRow } from '@/lib/database.types'
import { makeBootstrap, renderInRouter } from '@/features/auth/test-utils'
import { toMe, type Me } from '@/features/auth/bootstrap-query'

const me: { current: Me } = { current: toMe(makeBootstrap()) }
const getNotifications = vi.fn<() => Promise<NotificationRow[]>>()
const markNotificationsRead = vi.fn<() => Promise<number>>()
const subscribe = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  callRpc: vi.fn(),
  unwrap: vi.fn(),
  avatarUrl: () => null,
  avatarObjectPath: () => '',
  AVATAR_MAX_BYTES: 1,
  AVATAR_MIME: [],
}))
vi.mock('@/lib/realtime', () => ({
  useRealtimeInvalidate: (opts: { table: string; filter?: string }) => subscribe(opts.table, opts.filter),
}))
vi.mock('@/features/auth/hooks', () => ({ useMe: () => me.current }))
vi.mock('../api', () => ({
  NOTIFICATIONS_DEFAULT_LIMIT: 20,
  getNotifications: () => getNotifications(),
  markNotificationsRead: () => markNotificationsRead(),
}))

import { NotificationBell } from './notification-bell'

const row = (over: Partial<NotificationRow>): NotificationRow => ({
  id: over.id ?? 'n1',
  profile_id: me.current.me.id,
  kind: 'system',
  title: 'Novo membro aguardando aprovação',
  message: 'Um cadastro aguarda sua aprovação.',
  payload: { action: 'approve_member', profile_id: 'p' },
  is_read: false,
  created_at: new Date().toISOString(),
  ...over,
})

beforeEach(() => {
  me.current = toMe(makeBootstrap())
  getNotifications.mockReset()
  markNotificationsRead.mockReset().mockResolvedValue(1)
  subscribe.mockReset()
})

describe('NotificationBell', () => {
  test('no badge when unread = 0; opens with "Sem notificações" (empty state) and subscribes to realtime', async () => {
    getNotifications.mockResolvedValue([])
    renderInRouter(<NotificationBell />)
    const button = await screen.findByRole('button', { name: 'Notificações' })
    expect(subscribe).toHaveBeenCalledWith('notifications', `profile_id=eq.${me.current.me.id}`)
    await userEvent.click(button)
    expect(await screen.findByText('Sem notificações')).toBeInTheDocument()
  })
  test('badge from bootstrap unread; list with data; approve_member links to Equipe; "marcar todas" calls RPC', async () => {
    me.current = toMe(makeBootstrap({ unread_notifications: 3 }))
    getNotifications.mockResolvedValue([
      row({ id: 'n1' }),
      row({ id: 'n2', kind: 'level', title: 'Subiu de nível', payload: {}, is_read: true }),
    ])
    renderInRouter(<NotificationBell />)
    const button = await screen.findByRole('button', { name: 'Notificações: 3 não lidas' })
    await userEvent.click(button)
    const link = await screen.findByRole('link', { name: /Novo membro aguardando aprovação/ })
    expect(link.getAttribute('href')).toContain('/admin/equipe?pendentes=true')
    expect(screen.getByText('Subiu de nível')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Subiu de nível/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Marcar todas como lidas/ }))
    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalledTimes(1))
  })
  test('error state with retry when the list fails', async () => {
    getNotifications.mockRejectedValue(new Error('falhou'))
    renderInRouter(<NotificationBell />)
    await userEvent.click(await screen.findByRole('button', { name: 'Notificações' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument()
  })
})
