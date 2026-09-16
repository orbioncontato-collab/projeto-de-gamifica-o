import { Coins, Gift, Target, TrendingUp, Trophy, CheckCircle2 } from 'lucide-react'
import type { VAdminKpis, VTeamStats } from '@/lib/database.types'
import { formatBRL, formatNumber, formatPct, formatPoints, pluralize } from '@/lib/format'
import { StatCard } from '@/components/shared/stat-card'
import { CardSkeleton } from '@/components/shared/skeletons'

export interface AdminMetricsProps {
  stats: VTeamStats | null
  kpis: VAdminKpis | null
}

const GOAL_UNDEFINED = 'meta não definida'

/** 6 métricas (FEATURE §10): Meta, Realizado, Atingimento, Pontos distribuídos, Recompensas entregues, Missões. */
export function AdminMetrics({ stats, kpis }: AdminMetricsProps) {
  const goal = stats?.team_goal_amount ?? 0
  const sales = stats?.sales_amount ?? 0
  const hasGoal = goal > 0
  const attainment = hasGoal ? formatPct(stats?.attainment_pct ?? 0) : '—'
  const missing = stats?.sales_missing_amount ?? 0
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Meta do time"
        value={hasGoal ? formatBRL(goal, { compact: true }) : '—'}
        icon={Target}
        tone="blue"
        hint={hasGoal ? 'temporada atual' : GOAL_UNDEFINED}
      />
      <StatCard
        label="Realizado"
        value={formatBRL(sales, { compact: true })}
        icon={TrendingUp}
        tone="success"
        hint={pluralize(stats?.sales_count ?? 0, 'venda', 'vendas')}
      />
      <StatCard
        label="Atingimento"
        value={attainment}
        icon={Trophy}
        tone="gold"
        hint={hasGoal ? `faltam ${formatBRL(missing, { compact: true })}` : GOAL_UNDEFINED}
      />
      <StatCard
        label="Pontos distribuídos"
        value={formatPoints(stats?.points_distributed ?? 0)}
        icon={Coins}
        tone="purple"
        hint={`${formatNumber(kpis?.coins_issued ?? 0)} moedas emitidas`}
      />
      <StatCard
        label="Recompensas"
        value={formatBRL(kpis?.redemptions_delivered_amount ?? 0, { compact: true })}
        icon={Gift}
        tone="danger"
        hint={pluralize(kpis?.redemptions_pending_count ?? 0, 'pedido pendente', 'pedidos pendentes')}
      />
      <StatCard
        label="Missões concluídas"
        value={formatNumber(stats?.missions_completed ?? 0)}
        icon={CheckCircle2}
        tone="cyan"
        hint="na temporada"
      />
    </div>
  )
}

export function AdminMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  )
}
