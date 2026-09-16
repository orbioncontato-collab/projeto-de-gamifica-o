import { Target } from 'lucide-react'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import { Progress } from '@/components/shared/progress'
import type { VProfileStats } from '@/lib/database.types'
import { salesTargetCopy } from '../dashboard-utils'

export interface SalesTargetProps {
  stats: Pick<
    VProfileStats,
    | 'goal_amount'
    | 'sales_amount'
    | 'goal_pct'
    | 'goal_missing_amount'
    | 'projected_goal_date'
    | 'season_ends_at'
  >
  tz: string
}

/** Vendas do período vs meta individual, %, faltam R$ e projeção (FEATURE §2 `SalesTarget`). */
export function SalesTarget({ stats, tz }: SalesTargetProps) {
  const copy = salesTargetCopy(stats, tz)
  return (
    <PremiumCard as="section" aria-labelledby="sales-target-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile icon={Target} tone="gold" size="sm" />
          <div>
            <div className="eyebrow" data-tone="muted">
              Meta individual
            </div>
            <h3 id="sales-target-title" className="nums mt-0.5 text-lg font-black tracking-tight text-text">
              {copy.headline}
            </h3>
          </div>
        </div>
        <div className="nums shrink-0 text-2xl font-black text-gold">{copy.pctLabel}</div>
      </div>
      <div className="mt-5">
        <Progress
          value={copy.pct}
          tone="gold"
          size="md"
          glow={copy.hasGoal}
          label="Progresso da meta individual"
        />
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs font-semibold text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="nums">{copy.missing}</span>
        <span className={copy.hasGoal ? 'text-text-2' : 'text-muted-2'}>{copy.projection}</span>
      </div>
    </PremiumCard>
  )
}
