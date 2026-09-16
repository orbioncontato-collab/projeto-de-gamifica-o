import type { VTeamStats } from '@/lib/database.types'
import { PremiumCard } from '@/components/shared/premium-card'
import { Progress } from '@/components/shared/progress'
import { SectionHeader } from '@/components/shared/section-header'
import { buildIndicators, type Indicator } from '../admin-utils'

const TONE_TEXT: Record<Indicator['tone'], string> = {
  success: 'text-accent',
  warning: 'text-gold',
  danger: 'text-red-soft',
  muted: 'text-muted',
}
const TONE_BAR: Record<Indicator['tone'], 'green' | 'gold' | 'red'> = {
  success: 'green',
  warning: 'gold',
  danger: 'red',
  muted: 'red',
}

export function HealthIndicators({ stats }: { stats: VTeamStats }) {
  const items = buildIndicators(stats)
  return (
    <section aria-labelledby="admin-indicators-title">
      <SectionHeader eyebrow="Saúde comercial" title="Indicadores vs metas" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((it) => (
          <PremiumCard key={it.key} padding="md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-2">{it.label}</p>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className={`nums text-2xl font-black tracking-tight ${TONE_TEXT[it.tone]}`}>
                {it.value}
              </span>
              <span className="text-[11px] font-semibold text-muted">{it.target}</span>
            </div>
            <Progress
              value={it.progress}
              tone={TONE_BAR[it.tone]}
              size="sm"
              className="mt-3"
              label={`${it.label}: ${it.value} (${it.target})`}
            />
          </PremiumCard>
        ))}
      </div>
    </section>
  )
}
