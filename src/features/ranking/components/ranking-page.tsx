import { Trophy } from 'lucide-react'
import { PageFrame } from '@/components/shared/page-frame'
import { Badge } from '@/components/shared/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { SectionHeader } from '@/components/shared/section-header'
import { ListSkeleton } from '@/components/shared/skeletons'
import { useMe } from '@/features/auth/bootstrap-query'
import { useRanking } from '@/features/profiles/hooks'
import { NoSeasonState } from '@/features/dashboard/components/no-season-state'
import { formatDaysLeft } from '@/lib/format'
import { podiumSlots } from '../ranking-utils'
import { Podium } from './podium'
import { RankingList } from './ranking-list'

/** /ranking — pódio + classificação completa (FEATURE §3; §9 pódio parcial com 1 pessoa). */
export function RankingPage() {
  const { me, season, seasonId } = useMe()
  const query = useRanking(seasonId)
  const badge = season ? (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="green">Temporada ativa</Badge>
      <span className="text-xs font-semibold text-muted">
        {season.name} · {formatDaysLeft(season.days_left)}
      </span>
    </div>
  ) : null

  return (
    <PageFrame
      eyebrow="Competição"
      title="Ranking"
      subtitle="Quem está na frente nesta temporada"
      action={badge}
    >
      {!season ? (
        <NoSeasonState />
      ) : (
        <QueryBoundary query={query} skeleton={<ListSkeleton rows={6} />}>
          {(rows) => {
            const slots = podiumSlots(rows)
            return (
              <div className="flex flex-col gap-4 sm:gap-6">
                <PremiumCard as="section" tone="gold" aria-label="Pódio">
                  {slots ? (
                    <Podium slots={slots} meId={me.id} />
                  ) : (
                    <EmptyState
                      compact
                      icon={Trophy}
                      title="Pódio em aberto"
                      description="O pódio aparece assim que alguém marcar os primeiros pontos da temporada."
                      adminHint="Lance a primeira venda em Pontuação › Lançar."
                    />
                  )}
                </PremiumCard>
                <PremiumCard as="section" aria-label="Classificação completa">
                  <SectionHeader eyebrow="Temporada" title="Classificação completa" />
                  <div className="mt-4">
                    <RankingList rows={rows} meId={me.id} />
                  </div>
                </PremiumCard>
              </div>
            )
          }}
        </QueryBoundary>
      )}
    </PageFrame>
  )
}
