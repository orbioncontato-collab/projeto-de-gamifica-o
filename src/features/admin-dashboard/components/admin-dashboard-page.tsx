import { Link } from '@tanstack/react-router'
import { CalendarOff, Flag, Swords, Users } from 'lucide-react'
import { useMe } from '@/features/auth/bootstrap-query'
import { useRanking } from '@/features/profiles/hooks'
import { PageFrame } from '@/components/shared/page-frame'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { useAdminKpis, useSalesTimeline, useTeamStats } from '../hooks'
import { AdminMetrics, AdminMetricsSkeleton } from './admin-metrics'
import { ChartCardSkeleton } from './chart-card'
import { SalesAreaChart } from './sales-area-chart'
import { PointsBarChart } from './points-bar-chart'
import { PointsLineChart } from './points-line-chart'
import { HealthIndicators } from './health-indicators'
import { OperationsBar } from './operations-bar'

/** /admin — Dashboard administrativo (FEATURE §10, FRONTEND-ARCH §6 WP6). */
export function AdminDashboardPage() {
  const { season, seasonId } = useMe()
  const stats = useTeamStats(seasonId)
  const kpis = useAdminKpis(seasonId)
  const timeline = useSalesTimeline(seasonId)
  const ranking = useRanking(seasonId)

  const shortcuts = (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="primary" size="sm">
        <Link to="/missoes" search={{ filtro: 'hoje', novo: true }}>
          <Flag aria-hidden="true" />
          Criar missão
        </Link>
      </Button>
      <Button asChild variant="blue" size="sm">
        <Link to="/desafios" search={{ novo: true }}>
          <Swords aria-hidden="true" />
          Criar desafio
        </Link>
      </Button>
      <Button asChild variant="secondary" size="sm">
        <Link to="/admin/equipe" search={{}}>
          <Users aria-hidden="true" />
          Gerenciar equipe
        </Link>
      </Button>
    </div>
  )

  if (!seasonId) {
    return (
      <PageFrame
        eyebrow="Administração"
        title="Dashboard"
        subtitle="Visão consolidada da temporada."
        action={shortcuts}
      >
        <EmptyState
          icon={CalendarOff}
          title="Sem temporada ativa"
          description="As métricas e os gráficos aparecem assim que uma temporada estiver ativa."
          adminHint="Crie ou ative a temporada em Administração › Configurações › Temporadas."
          action={{
            label: 'Criar/ativar temporada',
            to: '/admin/configuracoes',
            search: { aba: 'temporadas' },
          }}
        />
      </PageFrame>
    )
  }

  const isLoading = stats.isPending || kpis.isPending || timeline.isPending || ranking.isPending
  const failed = [stats, kpis, timeline, ranking].find((q) => q.isError)

  return (
    <PageFrame
      eyebrow="Administração"
      title="Dashboard"
      subtitle={season ? `Temporada ${season.name}` : 'Visão consolidada da temporada.'}
      action={shortcuts}
    >
      {failed ? (
        <ErrorState
          error={failed.error}
          onRetry={() => {
            void Promise.all([stats.refetch(), kpis.refetch(), timeline.refetch(), ranking.refetch()])
          }}
        />
      ) : isLoading ? (
        <div className="space-y-6">
          <AdminMetricsSkeleton />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCardSkeleton title="Evolução acumulada" />
            <ChartCardSkeleton title="Pontos por colaborador" />
          </div>
          <ChartCardSkeleton title="Evolução de pontos" />
        </div>
      ) : (
        <div className="space-y-6">
          <AdminMetrics stats={stats.data ?? null} kpis={kpis.data ?? null} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SalesAreaChart rows={timeline.data ?? []} />
            <PointsBarChart ranking={ranking.data ?? []} />
          </div>
          <PointsLineChart rows={timeline.data ?? []} />
          {stats.data ? <HealthIndicators stats={stats.data} /> : null}
          <OperationsBar stats={stats.data ?? null} kpis={kpis.data ?? null} />
        </div>
      )}
    </PageFrame>
  )
}
