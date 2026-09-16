import type { ReactNode } from 'react'
import { PageFrame } from '@/components/shared/page-frame'
import { Badge } from '@/components/shared/badge'
import { ErrorState } from '@/components/shared/error-state'
import { CardSkeleton, TableSkeleton } from '@/components/shared/skeletons'
import { useMe } from '@/features/auth/bootstrap-query'
import { useProfileStats, useRanking } from '@/features/profiles/hooks'
import { formatDaysLeft } from '@/lib/format'
import { useTeamOverview } from '../hooks'
import { NoSeasonState } from './no-season-state'
import { OnboardingCard } from './onboarding-card'
import { ManagerMetrics } from './manager-metrics'
import { TeamPerformanceTable } from './team-performance-table'
import { Top3Card } from './top3-card'
import { HealthCard } from './health-card'

/** Visão do gestor (FEATURE §2b) — substitui a do colaborador quando `role = 'admin'`. */
export function ManagerOverview() {
  const { season, seasonId } = useMe()
  const team = useTeamOverview(seasonId)
  const roster = useProfileStats(seasonId)
  const ranking = useRanking(seasonId, 3)

  const seasonBadge = season ? (
    <Badge tone="green">{`${season.name} · ${formatDaysLeft(season.days_left)}`}</Badge>
  ) : null

  let body: ReactNode
  if (!season) body = <NoSeasonState />
  else {
    const teamData = team.data ?? null
    const showOnboarding = teamData === null || teamData.sales_count === 0 || teamData.total_count <= 1
    body = (
      <div className="flex flex-col gap-4 sm:gap-6">
        {team.isPending ? (
          <CardSkeleton lines={2} />
        ) : team.isError ? (
          <ErrorState error={team.error} onRetry={() => void team.refetch()} compact />
        ) : (
          <ManagerMetrics team={teamData} />
        )}
        {!team.isPending && !team.isError && showOnboarding ? <OnboardingCard /> : null}
        {roster.isPending ? (
          <TableSkeleton rows={3} cols={5} />
        ) : roster.isError ? (
          <ErrorState error={roster.error} onRetry={() => void roster.refetch()} compact />
        ) : (
          <TeamPerformanceTable rows={roster.data} />
        )}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {ranking.isPending ? (
            <CardSkeleton lines={3} />
          ) : ranking.isError ? (
            <ErrorState error={ranking.error} onRetry={() => void ranking.refetch()} compact />
          ) : (
            <Top3Card rows={ranking.data} />
          )}
          {team.isPending ? (
            <CardSkeleton lines={3} />
          ) : team.isError ? (
            <ErrorState error={team.error} onRetry={() => void team.refetch()} compact />
          ) : (
            <HealthCard team={teamData} />
          )}
        </div>
      </div>
    )
  }

  return (
    <PageFrame
      eyebrow="Visão do gestor"
      title="Visão geral da operação"
      subtitle="Time, meta e saúde comercial da temporada"
      action={seasonBadge}
    >
      {body}
    </PageFrame>
  )
}
