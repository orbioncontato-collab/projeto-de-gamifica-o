import { createFileRoute } from '@tanstack/react-router'
import { RewardsPage, type RewardsTab } from '@/features/rewards/components/rewards-page'

export type { RewardsTab }

/** /recompensas?aba=loja|pedidos — `RewardsPage` (WP5). */
export const Route = createFileRoute('/_app/recompensas')({
  validateSearch: (s: Record<string, unknown>): { aba: RewardsTab } => ({
    aba: s['aba'] === 'pedidos' ? 'pedidos' : 'loja',
  }),
  component: RewardsRoute,
})

function RewardsRoute() {
  const { aba } = Route.useSearch()
  return <RewardsPage tab={aba} />
}
