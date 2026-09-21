import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

/**
 * Setup global do vitest (FRONTEND-ARCH §2.1 `test/setup.ts`): jest-dom, mock de matchMedia
 * (ThemeProvider lê `prefers-color-scheme`) e env falso do Supabase (nenhum teste faz rede).
 */

// findBy*/waitFor: 1 s padrão é curto quando 52 arquivos rodam em paralelo (ver vitest.config.ts)
configure({ asyncUtilTimeout: 10_000 })

vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')

const matchMediaMock = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: matchMediaMock })
  // jsdom não implementa scrollTo; o router chama no reset de rolagem entre rotas.
  Object.defineProperty(window, 'scrollTo', { writable: true, configurable: true, value: () => undefined })
  if (!('ResizeObserver' in window)) {
    class ResizeObserverMock {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: ResizeObserverMock,
    })
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
