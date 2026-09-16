import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { createTestQueryClient } from '@/test/render'
import { emptyBootstrapFor, makeFakeSupabase, TEST_SESSION, TEST_USER_ID } from '@/test/fake-supabase'
import { THEME_STORAGE_KEY, type Theme } from '@/features/theme/use-theme'

/**
 * Smoke de integração (onda 3, FRONTEND-ARCH §7 DoD): toda rota renderiza com banco recém-instalado
 * (nenhuma linha, `season = null`) para gestor e colaborador, nos dois temas, sem lançar e sem estourar o
 * `RouteErrorState`. Nenhum dado fictício de pessoa: o `me` é o usuário genérico de teste.
 */

const state: { bootstrap: ReturnType<typeof emptyBootstrapFor> } = {
  bootstrap: emptyBootstrapFor('collaborator'),
}

vi.stubEnv('DEV', false)

vi.mock('@/lib/supabase', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase')>()
  const client = () => makeFakeSupabase({ bootstrap: state.bootstrap })
  return {
    ...original,
    isSupabaseConfigured: () => true,
    supabase: new Proxy({}, { get: (_t, prop) => (client() as Record<PropertyKey, unknown>)[prop] }),
    callRpc: async (name: string, args?: unknown) => {
      const { data, error } = await client().rpc(name, args)
      if (error) throw error
      return data
    },
    unwrap: async (q: PromiseLike<{ data: unknown; error: unknown }>) => (await q).data,
  }
})

vi.mock('@/features/auth/auth-provider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ status: 'signed_in', session: TEST_SESSION, userId: TEST_USER_ID }),
}))

import { routeTree } from '@/routeTree.gen'
import { ThemeProvider } from '@/features/theme/theme-provider'

const PUBLIC_ROUTES = ['/login', '/signup', '/aguardando'] as const
const APP_ROUTES = [
  '/',
  '/ranking',
  '/missoes?filtro=hoje',
  '/desafios',
  '/roleta',
  '/recompensas?aba=loja',
  '/conquistas',
  '/perfil',
  '/configuracoes',
] as const
const ADMIN_ROUTES = [
  '/admin',
  '/admin/equipe',
  '/admin/pontuacao?aba=lancar',
  '/admin/pontuacao?aba=regras',
  '/admin/pontuacao?aba=historico',
  '/admin/recompensas?aba=pedidos',
  '/admin/recompensas?aba=catalogo',
  '/admin/roleta',
  '/admin/configuracoes?aba=geral',
  '/admin/configuracoes?aba=temporadas',
  '/admin/configuracoes?aba=codigo',
  '/admin/guia',
  '/desafios?gerenciar=true',
] as const

async function mountRoute(path: string, theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  document.documentElement.dataset['theme'] = theme
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient, auth: { status: 'signed_in', session: TEST_SESSION, userId: TEST_USER_ID } },
    defaultPendingMs: 0,
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  )
  const utils = render(<RouterProvider router={router as never} />, { wrapper: Wrapper })
  await act(async () => {
    await router.load()
  })
  await waitFor(() => expect(router.state.status).toBe('idle'))
  return { ...utils, router, queryClient }
}

const errors: string[] = []
beforeEach(() => {
  errors.length = 0
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(
      args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack ?? ''}` : String(a))).join(' '),
    )
  })
})

/** Avisos do React que denunciam bug de render (chave duplicada, DOM inválido, act) — o router loga o resto. */
const REACT_WARNING =
  /Each child in a list|validateDOMNesting|cannot appear as a|not wrapped in act|Cannot update a component/i

function expectNoCrash() {
  const crash = screen.queryByText(/Algo deu errado|Não foi possível carregar/i)
  if (crash) throw new Error(`Rota quebrou: ${JSON.stringify(errors.slice(0, 3), null, 1).slice(0, 2500)}`)
  const warnings = errors.filter((e) => REACT_WARNING.test(e))
  expect(warnings, warnings.join('\n').slice(0, 2000)).toEqual([])
  expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0)
}

describe.each<Theme>(['dark', 'light'])('rotas com banco vazio — tema %s', (theme) => {
  test.each([...PUBLIC_ROUTES])('%s renderiza', async (path) => {
    state.bootstrap = emptyBootstrapFor('collaborator')
    const { unmount } = await mountRoute(path, theme)
    expect(document.documentElement.dataset['theme']).toBe(theme)
    expectNoCrash()
    unmount()
  })

  test.each([...APP_ROUTES])('colaborador: %s renderiza', async (path) => {
    state.bootstrap = emptyBootstrapFor('collaborator')
    const { router, unmount } = await mountRoute(path, theme)
    expect(router.state.location.pathname).toBe(path.split('?')[0])
    expectNoCrash()
    unmount()
  })

  test.each([...APP_ROUTES, ...ADMIN_ROUTES])('gestor: %s renderiza', async (path) => {
    state.bootstrap = emptyBootstrapFor('admin')
    const { router, unmount } = await mountRoute(path, theme)
    expect(router.state.location.pathname).toBe(path.split('?')[0])
    expectNoCrash()
    unmount()
  })

  test('colaborador em /admin é redirecionado para /', async () => {
    state.bootstrap = emptyBootstrapFor('collaborator')
    const { router, unmount } = await mountRoute('/admin', theme)
    expect(router.state.location.pathname).toBe('/')
    unmount()
  })
})
