import { createFileRoute } from '@tanstack/react-router'
import { TeamPage } from '@/features/team/components/team-page'

export interface TeamSearch {
  perfil?: string
  busca?: string
  editar?: string
  convidar?: boolean
  pendentes?: boolean
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)
const flag = (v: unknown): boolean => v === true || v === 'true'

/** /admin/equipe?perfil&busca&editar&convidar&pendentes — `TeamPage` (WP6). */
export const Route = createFileRoute('/_app/_admin/admin/equipe')({
  validateSearch: (s: Record<string, unknown>): TeamSearch => {
    const perfil = str(s['perfil'])
    const busca = str(s['busca'])
    const editar = str(s['editar'])
    return {
      ...(perfil ? { perfil } : {}),
      ...(busca ? { busca } : {}),
      ...(editar ? { editar } : {}),
      ...(flag(s['convidar']) ? { convidar: true } : {}),
      ...(flag(s['pendentes']) ? { pendentes: true } : {}),
    }
  },
  component: TeamRoute,
})

function TeamRoute() {
  const search = Route.useSearch()
  return <TeamPage search={search} />
}
