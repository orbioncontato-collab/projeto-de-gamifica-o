import { createFileRoute } from '@tanstack/react-router'
import type { RedemptionStatus } from '@/lib/database.types'
import { RewardsAdminPage, type RewardsAdminTab } from '@/features/rewards/admin/rewards-admin-page'

export type { RewardsAdminTab }
export interface RewardsAdminSearch {
  aba: RewardsAdminTab
  status?: RedemptionStatus
  novo?: boolean
}

const STATUSES: readonly RedemptionStatus[] = ['requested', 'approved', 'delivered', 'cancelled']
const isStatus = (v: unknown): v is RedemptionStatus => STATUSES.includes(v as RedemptionStatus)

/** /admin/recompensas?aba=pedidos|catalogo&status&novo — `RewardsAdminPage` (WP5). */
export const Route = createFileRoute('/_app/_admin/admin/recompensas')({
  validateSearch: (s: Record<string, unknown>): RewardsAdminSearch => ({
    aba: s['aba'] === 'catalogo' ? 'catalogo' : 'pedidos',
    ...(isStatus(s['status']) ? { status: s['status'] } : {}),
    ...(s['novo'] === true || s['novo'] === 'true' ? { novo: true } : {}),
  }),
  component: RewardsAdminRoute,
})

function RewardsAdminRoute() {
  const { aba, status, novo } = Route.useSearch()
  return <RewardsAdminPage tab={aba} status={status ?? null} openNew={novo === true} />
}
