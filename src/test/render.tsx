import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { ThemeProvider } from '@/features/theme/theme-provider'
import type { BootstrapMe, BootstrapPayload, BootstrapSettings } from '@/lib/database.types'

/** QueryClient isolado por teste: sem retry, sem cache entre casos. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } },
  })
}

/** renderWithProviders(): QueryClientProvider + ThemeProvider (FRONTEND-ARCH §2.1 `test/render.tsx`). */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = createTestQueryClient()
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  )
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}

/**
 * Renderiza `ui` dentro de um router de memória (Link/useNavigate/useRouter funcionam) + QueryClient + Theme.
 * Helper comum a todos os testes de página (promovido de `features/auth/test-utils` — ).
 */
export function renderInRouter(ui: ReactElement, initialPath = '/') {
  const queryClient = createTestQueryClient()
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const page = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => ui })
  const catchAll = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => <div data-testid="other-route" />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([page, catchAll]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { queryClient },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  )
  const utils = render(<RouterProvider router={router as never} />, { wrapper: Wrapper })
  return { ...utils, router, queryClient }
}

export const TEST_SETTINGS: BootstrapSettings = {
  company_name: 'Orbion',
  xp_per_level: 400,
  currency: 'BRL',
  timezone: 'America/Sao_Paulo',
  target_conversion_pct: 30,
  target_attendance_pct: 80,
  target_crm_pct: 90,
  target_activities_count: 20,
  rank_admins: true,
}

/** `me` ativo sem dados fictícios de pessoas: nome genérico de teste, zero em tudo (banco recém-instalado). */
export function makeMe(overrides: Partial<BootstrapMe> = {}): BootstrapMe {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    full_name: 'Usuário de Teste',
    avatar_path: null,
    color: '#f97316', // hex como no banco (DATA-MODEL §4.6) — mesmo valor de `--avatar-fallback`
    job_title: 'closer',
    team: null,
    role: 'collaborator',
    status: 'active',
    preferences: { notifications: true, event_alerts: true },
    email: null,
    phone: null,
    goal_amount: 0,
    points: 0,
    points_earned: 0,
    level: 1,
    xp_in_level: 0,
    xp_to_next: 400,
    xp_per_level: 400,
    rank: null,
    gap_to_above: null,
    streak_days: 0,
    coins_balance: 0,
    sales_amount: 0,
    sales_count: 0,
    meetings_held: 0,
    conversion_pct: null,
    missions_completed: 0,
    achievements_unlocked: 0,
    pending_earned_spins: 0,
    ...overrides,
  }
}

export function makeBootstrap(overrides: Partial<BootstrapPayload> = {}): BootstrapPayload {
  return {
    me: makeMe(),
    season: null,
    settings: TEST_SETTINGS,
    unread_notifications: 0,
    pending_members: 0,
    wheel: { active_queue_id: null, active_person_name: null, pending_spin_id: null, my_turn: false },
    active_event: null,
    ...overrides,
  }
}
