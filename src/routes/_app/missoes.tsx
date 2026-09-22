import { createFileRoute } from '@tanstack/react-router'
import type { MissionFilter } from '@/lib/gamification'
import { MissionsPage } from '@/features/missions/components/missions-page'

export interface MissionsSearch {
  filtro: MissionFilter
  novo?: boolean
}

/** /missoes?filtro=hoje|semana|especiais&novo — `MissionsPage`. validateSearch como função pura (FRONTEND-ARCH §2.2). */
export const Route = createFileRoute('/_app/missoes')({
  validateSearch: (s: Record<string, unknown>): MissionsSearch => ({
    filtro: s['filtro'] === 'semana' || s['filtro'] === 'especiais' ? s['filtro'] : 'hoje',
    ...(s['novo'] === true || s['novo'] === 'true' ? { novo: true } : {}),
  }),
  component: MissionsRoute,
})

function MissionsRoute() {
  const { filtro, novo } = Route.useSearch()
  return <MissionsPage filter={filtro} openNew={novo === true} />
}
