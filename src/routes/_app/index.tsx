import { createFileRoute } from '@tanstack/react-router'
import { useMe } from '@/features/auth/bootstrap-query'
import { CollaboratorDashboard } from '@/features/dashboard/components/collaborator-dashboard'
import { ManagerOverview } from '@/features/dashboard/components/manager-overview'

function HomePage() {
  const { isAdmin } = useMe()
  return isAdmin ? <ManagerOverview /> : <CollaboratorDashboard />
}

/** / — Visão geral (colaborador) | Visão do gestor (admin), por `me.role` (WP2). */
export const Route = createFileRoute('/_app/')({ component: HomePage })
