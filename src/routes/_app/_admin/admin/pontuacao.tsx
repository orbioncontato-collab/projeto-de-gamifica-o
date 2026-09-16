import { createFileRoute } from '@tanstack/react-router'
import { PointsPage, type PointsTab } from '@/features/points/components/points-page'

export type { PointsTab }
export interface PointsSearch {
  aba: PointsTab
  perfil?: string
}

/** /admin/pontuacao?aba=regras|lancar|historico&perfil — `PointsPage` (WP7). */
export const Route = createFileRoute('/_app/_admin/admin/pontuacao')({
  validateSearch: (s: Record<string, unknown>): PointsSearch => ({
    aba: s['aba'] === 'regras' || s['aba'] === 'historico' ? s['aba'] : 'lancar',
    ...(typeof s['perfil'] === 'string' && s['perfil'] ? { perfil: s['perfil'] } : {}),
  }),
  component: PointsRoute,
})

function PointsRoute() {
  const { aba, perfil } = Route.useSearch()
  return <PointsPage tab={aba} profileId={perfil} />
}
