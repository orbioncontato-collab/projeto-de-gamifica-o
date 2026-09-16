import { Coins, Dices, Target, TrendingUp } from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import type { VTeamStats } from '@/lib/database.types'
import { managerMetrics } from '../dashboard-utils'

const ICONS = [Target, TrendingUp, Coins, Dices] as const
const TONES = ['gold', 'green', 'blue', 'purple'] as const

/** 4 métricas do gestor (FEATURE §2b): meta do time, vendas, pontos do time, fila da roleta. */
export function ManagerMetrics({ team }: { team: VTeamStats | null }) {
  const metrics = managerMetrics(team)
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {metrics.map((m, i) => (
        <StatCard
          key={m.label}
          label={m.label}
          value={m.value}
          hint={m.hint}
          icon={ICONS[i] ?? Target}
          tone={TONES[i] ?? 'green'}
          {...(i === 3 ? { to: '/roleta' as const } : {})}
        />
      ))}
    </div>
  )
}
