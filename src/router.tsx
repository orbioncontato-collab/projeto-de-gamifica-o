import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { queryClient } from '@/lib/query-client'
import type { AuthState } from '@/features/auth/auth-provider'
import { PageSkeleton } from '@/components/shared/skeletons'
import { RouteErrorState } from '@/components/shared/route-error-state'

export interface RouterContext {
  queryClient: typeof queryClient
  auth: AuthState
}

export const router = createRouter({
  routeTree,
  context: { queryClient, auth: undefined! }, // auth é injetado pelo RouterProvider em main.tsx
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0, // React Query é o cache
  scrollRestoration: true,
  defaultPendingComponent: PageSkeleton,
  defaultPendingMs: 200,
  defaultErrorComponent: RouteErrorState,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
