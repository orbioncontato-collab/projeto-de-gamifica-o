import { describe, expect, test, vi } from 'vitest'

/** `isSupabaseConfigured()`/`missingSupabaseEnv()` decidem entre o app e a tela de configuração (FRONTEND-ARCH §3.2). */
describe('supabase env detection', () => {
  test('reports both variables when the env is empty', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    vi.resetModules()
    const mod = await import('./supabase')
    expect(mod.isSupabaseConfigured()).toBe(false)
    expect(mod.missingSupabaseEnv()).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])
    vi.unstubAllEnvs()
  })
  test('is configured when both variables exist', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    vi.resetModules()
    const mod = await import('./supabase')
    expect(mod.isSupabaseConfigured()).toBe(true)
    expect(mod.missingSupabaseEnv()).toEqual([])
  })
})
