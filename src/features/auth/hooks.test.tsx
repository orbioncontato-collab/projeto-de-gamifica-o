import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/render'
import { qk } from '@/lib/query-keys'
import { makeBootstrap, makeMe } from './test-utils'

const routerInvalidate = vi.fn().mockResolvedValue(undefined)
const api = {
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getSignupMode: vi.fn(),
  requestPasswordReset: vi.fn(),
  uploadMyAvatar: vi.fn(),
}
const profileApi = { updateMyProfile: vi.fn(), updateMyPreferences: vi.fn() }
const success = vi.fn()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/notify', () => ({
  notify: { success: (...a: unknown[]) => success(...a), info: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate: routerInvalidate }) }))
vi.mock('./api', () => ({
  signIn: (...a: unknown[]) => api.signIn(...a),
  signUp: (...a: unknown[]) => api.signUp(...a),
  signOut: (...a: unknown[]) => api.signOut(...a),
  getSignupMode: (...a: unknown[]) => api.getSignupMode(...a),
  requestPasswordReset: (...a: unknown[]) => api.requestPasswordReset(...a),
  uploadMyAvatar: (...a: unknown[]) => api.uploadMyAvatar(...a),
}))
vi.mock('./profile-api', () => ({
  updateMyProfile: (...a: unknown[]) => profileApi.updateMyProfile(...a),
  updateMyPreferences: (...a: unknown[]) => profileApi.updateMyPreferences(...a),
}))
vi.mock('./bootstrap-query', async () => {
  const actual = await vi.importActual<typeof import('./bootstrap-query')>('./bootstrap-query')
  return {
    ...actual,
    useMe: () => actual.toMe(makeBootstrap({ me: makeMe({ avatar_path: 'old.jpg' }) })),
    useBootstrap: vi.fn(),
    useMeOptional: () => null,
  }
})
vi.mock('./auth-provider', () => ({ useAuth: () => ({ status: 'signed_in', session: null, userId: 'u' }) }))

import {
  useLogin,
  useSignup,
  useSignupMode,
  useUpdateMyPreferences,
  useUpdateMyProfile,
  useUploadMyAvatar,
} from './hooks'

const setup = () => {
  const qc = createTestQueryClient()
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, spy, wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
  routerInvalidate.mockResolvedValue(undefined)
})

describe('auth hooks', () => {
  test('useSignupMode queries signup_mode', async () => {
    api.getSignupMode.mockResolvedValue('first_admin')
    const { wrapper } = setup()
    const { result } = renderHook(() => useSignupMode(), { wrapper })
    await waitFor(() => expect(result.current.data).toBe('first_admin'))
  })
  test('useLogin: success invalidates bootstrap and the router', async () => {
    api.signIn.mockResolvedValue(undefined)
    const { spy, wrapper } = setup()
    const { result } = renderHook(() => useLogin(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ email: 'a@b.com', password: 'x' })
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.bootstrap() })
    expect(routerInvalidate).toHaveBeenCalled()
  })
  test('useSignup: with e-mail confirmation pending nothing is invalidated', async () => {
    api.signUp.mockResolvedValue({ needsEmailConfirmation: true, awaitsApproval: true })
    const { spy, wrapper } = setup()
    const { result } = renderHook(() => useSignup(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        mode: 'team_code',
        fullName: 'N S',
        email: 'a@b.com',
        password: 'senha1234',
        teamCode: 'A',
      })
    })
    expect(spy).not.toHaveBeenCalled()
    expect(routerInvalidate).not.toHaveBeenCalled()
  })
  test('useSignup: with session invalidates bootstrap', async () => {
    api.signUp.mockResolvedValue({ needsEmailConfirmation: false, awaitsApproval: false })
    const { spy, wrapper } = setup()
    const { result } = renderHook(() => useSignup(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        mode: 'first_admin',
        fullName: 'N S',
        email: 'a@b.com',
        password: 'senha1234',
      })
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.bootstrap() })
  })
  test('useUpdateMyProfile passes me.id, invalidates bootstrap + profiles and toasts', async () => {
    profileApi.updateMyProfile.mockResolvedValue({})
    const { spy, wrapper } = setup()
    const { result } = renderHook(() => useUpdateMyProfile(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ full_name: 'Novo Nome' })
    })
    expect(profileApi.updateMyProfile).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', {
      full_name: 'Novo Nome',
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.profiles.all() })
    expect(success).toHaveBeenCalledWith('Perfil atualizado')
  })
  test('useUploadMyAvatar passes current avatar_path', async () => {
    api.uploadMyAvatar.mockResolvedValue('new.jpg')
    const { wrapper } = setup()
    const { result } = renderHook(() => useUploadMyAvatar(), { wrapper })
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    await act(async () => {
      await result.current.mutateAsync(file)
    })
    expect(api.uploadMyAvatar).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', 'old.jpg', file)
  })
  test('useUpdateMyPreferences merges with current preferences', async () => {
    profileApi.updateMyPreferences.mockResolvedValue({ notifications: false, event_alerts: true })
    const { wrapper } = setup()
    const { result } = renderHook(() => useUpdateMyPreferences(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ notifications: false })
    })
    expect(profileApi.updateMyPreferences).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      { notifications: true, event_alerts: true },
      { notifications: false },
    )
  })
})
