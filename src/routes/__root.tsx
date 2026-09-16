import { lazy, Suspense } from 'react'
import { createRootRouteWithContext, Link, Outlet, type ErrorComponentProps } from '@tanstack/react-router'
import { Compass } from 'lucide-react'
import type { RouterContext } from '@/router'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/shared/error-state'
import { ConfigMissingScreen } from '@/components/shared/config-missing-screen'
import { isSupabaseConfigured } from '@/lib/supabase'

const Devtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-router-devtools').then((m) => ({ default: m.TanStackRouterDevtools })))
  : () => null

function RootLayout() {
  if (!isSupabaseConfigured()) return <ConfigMissingScreen />
  return (
    <>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV ? (
        <div className="fixed inset-0 z-50 hidden overflow-hidden [pointer-events:none] sm:block [&>*]:[pointer-events:auto]">
          <Suspense fallback={null}>
            <Devtools position="bottom-right" />
          </Suspense>
        </div>
      ) : null}
    </>
  )
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="premium-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="eyebrow">404</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted">O endereço não existe ou foi movido.</p>
        <Button asChild className="mt-6">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  )
}

function RootErrorState({ error, reset }: ErrorComponentProps) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <ErrorState error={error} title="Algo deu errado" onRetry={reset} />
      </div>
    </main>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RootErrorState,
})
