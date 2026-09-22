import { createFileRoute } from '@tanstack/react-router'
import { ChallengesPage } from '@/features/challenges/components/challenges-page'

export interface ChallengesSearch {
  novo?: boolean
  gerenciar?: boolean
}

/** /desafios?novo&gerenciar — `ChallengesPage` (+ `ChallengesManager` se admin). */
export const Route = createFileRoute('/_app/desafios')({
  validateSearch: (s: Record<string, unknown>): ChallengesSearch => ({
    ...(s['novo'] === true || s['novo'] === 'true' ? { novo: true } : {}),
    ...(s['gerenciar'] === true || s['gerenciar'] === 'true' ? { gerenciar: true } : {}),
  }),
  component: ChallengesRoute,
})

function ChallengesRoute() {
  const { novo, gerenciar } = Route.useSearch()
  return <ChallengesPage openNew={novo === true} manage={gerenciar === true} />
}
