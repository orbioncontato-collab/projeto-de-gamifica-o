import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboardPage } from '@/features/admin-dashboard/components/admin-dashboard-page'

/** /admin — `AdminDashboardPage` (WP6). */
export const Route = createFileRoute('/_app/_admin/admin/')({
  component: AdminDashboardPage,
})
