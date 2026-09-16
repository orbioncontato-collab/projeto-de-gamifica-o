import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/render'
import { makeBootstrap } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload } from '@/lib/database.types'

const getDashboard = vi.fn()
const getActivityFeedPage = vi.fn()
const getTeamOverview = vi.fn()
const useRealtimeInvalidate = vi.fn()
let bootstrap: BootstrapPayload = makeBootstrap()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/realtime', () => ({ useRealtimeInvalidate: (o: unknown) => useRealtimeInvalidate(o) }))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(bootstrap),
}))
vi.mock('./api', () => ({
  FEED_PAGE_SIZE: 2,
  getDashboard: (...a: unknown[]) => getDashboard(...a),
  getActivityFeedPage: (...a: unknown[]) => getActivityFeedPage(...a),
  getTeamOverview: (...a: unknown[]) => getTeamOverview(...a),
}))

import { useActivityFeed, useDashboard, useFeedRealtime, useTeamOverview } from './hooks'

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

const setup = () => {
  const qc = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

beforeEach(() => {
  bootstrap = makeBootstrap()
  getDashboard.mockReset().mockResolvedValue({ season: null })
  getActivityFeedPage.mockReset()
  getTeamOverview.mockReset().mockResolvedValue(null)
  useRealtimeInvalidate.mockReset()
})

describe('useDashboard', () => {
  test('sem temporada ativa não consulta (DoD WP2)', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useDashboard(), { wrapper })
    await act(async () => {})
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
    expect(getDashboard).not.toHaveBeenCalled()
  })
  test('com temporada chama get_dashboard sem p_profile_id (próprio) e com a temporada ativa', async () => {
    bootstrap = makeBootstrap({ season: SEASON })
    const { wrapper } = setup()
    const { result } = renderHook(() => useDashboard(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getDashboard).toHaveBeenCalledWith(null, 's1')
  })
})

describe('useActivityFeed', () => {
  test('pagina por cursor occurred_at e para quando nextCursor é null', async () => {
    getActivityFeedPage
      .mockResolvedValueOnce({
        rows: [
          { id: 'a', occurred_at: '2026-09-15T12:00:00Z' },
          { id: 'b', occurred_at: '2026-09-15T11:00:00Z' },
        ],
        nextCursor: '2026-09-15T11:00:00Z',
      })
      .mockResolvedValueOnce({ rows: [{ id: 'c', occurred_at: '2026-09-15T10:00:00Z' }], nextCursor: null })
    const { wrapper } = setup()
    const { result } = renderHook(() => useActivityFeed(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getActivityFeedPage).toHaveBeenNthCalledWith(1, null)
    expect(result.current.hasNextPage).toBe(true)
    await act(async () => {
      await result.current.fetchNextPage()
    })
    expect(getActivityFeedPage).toHaveBeenNthCalledWith(2, '2026-09-15T11:00:00Z')
    await waitFor(() => expect(result.current.hasNextPage).toBe(false))
    expect(result.current.data?.pages).toHaveLength(2)
  })
})

describe('useTeamOverview / useFeedRealtime', () => {
  test('useTeamOverview fica desabilitado sem temporada', async () => {
    const { wrapper } = setup()
    renderHook(() => useTeamOverview(null), { wrapper })
    await act(async () => {})
    expect(getTeamOverview).not.toHaveBeenCalled()
  })
  test('useFeedRealtime assina feed_events invalidando feed, dashboard, bootstrap e perfis', () => {
    const { wrapper } = setup()
    renderHook(() => useFeedRealtime(), { wrapper })
    expect(useRealtimeInvalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'feed_events',
        keys: [['feed'], ['dashboard'], ['bootstrap'], ['profiles']],
      }),
    )
  })
})
