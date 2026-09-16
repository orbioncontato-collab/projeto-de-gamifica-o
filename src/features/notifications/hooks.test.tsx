import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/render'
import { makeBootstrap } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import { qk } from '@/lib/query-keys'

type Handler = (payload: { eventType: string; new: Record<string, unknown> }) => void
const handlers: Handler[] = []
const unsubscribe = vi.fn()
const info = vi.fn()
const markNotificationsRead = vi.fn()
const getNotifications = vi.fn()

// Canal realtime falso: `subscribeToTables` (real) registra o handler aqui; `removeChannel` = unsubscribe
vi.mock('@/lib/supabase', () => {
  const channel = {
    on: (_e: string, _o: unknown, cb: Handler) => {
      handlers.push(cb)
      return channel
    },
    subscribe: () => channel,
  }
  return {
    supabase: { channel: () => channel, removeChannel: (...a: unknown[]) => unsubscribe(...a) },
    callRpc: vi.fn(),
    unwrap: vi.fn(),
    avatarUrl: () => null,
  }
})
vi.mock('@/lib/notify', () => ({
  notify: { info: (...a: unknown[]) => info(...a), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))
vi.mock('@/features/auth/hooks', () => ({ useMe: () => toMe(makeBootstrap()) }))
vi.mock('./api', () => ({
  NOTIFICATIONS_DEFAULT_LIMIT: 20,
  getNotifications: (...a: unknown[]) => getNotifications(...a),
  markNotificationsRead: (...a: unknown[]) => markNotificationsRead(...a),
}))

import { useMarkNotificationsRead, useNotifications, useNotificationsRealtime } from './hooks'

const setup = () => {
  const qc = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

beforeEach(() => {
  handlers.length = 0
  unsubscribe.mockReset()
  info.mockReset()
  markNotificationsRead.mockReset().mockResolvedValue(2)
  getNotifications.mockReset().mockResolvedValue([])
})

describe('useNotificationsRealtime', () => {
  test('INSERT shows notify.info(title) and invalidates notifications + bootstrap (debounced); cleanup unsubscribes', async () => {
    vi.useFakeTimers()
    const { qc, wrapper } = setup()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useNotificationsRealtime(), { wrapper })
    expect(handlers).toHaveLength(1)
    act(() =>
      handlers[0]?.({ eventType: 'INSERT', new: { title: 'Cadastro aprovado', message: 'Bem-vindo' } }),
    )
    expect(info).toHaveBeenCalledWith('Cadastro aprovado', 'Bem-vindo')
    expect(spy).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.notifications.all() })
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.bootstrap() })
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
    vi.useRealTimers()
  })
  test('UPDATE does not toast', () => {
    const { wrapper } = setup()
    renderHook(() => useNotificationsRealtime(), { wrapper })
    act(() => handlers[0]?.({ eventType: 'UPDATE', new: { title: 'x' } }))
    expect(info).not.toHaveBeenCalled()
  })
})

describe('useNotifications / useMarkNotificationsRead', () => {
  test('lists with the given limit', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useNotifications(8), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getNotifications).toHaveBeenCalledWith(8)
  })
  test('mark read invalidates notifications and bootstrap', async () => {
    const { qc, wrapper } = setup()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(['a'])
    })
    expect(markNotificationsRead).toHaveBeenCalledWith(['a'])
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.notifications.all() })
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.bootstrap() })
  })
})
