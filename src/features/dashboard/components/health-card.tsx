import { HeartPulse } from 'lucide-react'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import { Progress } from '@/components/shared/progress'
import { SectionHeader } from '@/components/shared/section-header'
import { TONE_TEXT } from '@/components/shared/types'
import type { VTeamStats } from '@/lib/database.types'
import { healthItems } from '../dashboard-utils'

/** "Saúde comercial": conversão média vs meta, time ativo, atingimento (FEATURE §2b; §9 "— (sem reuniões registradas)"). */
export function HealthCard({ team }: { team: VTeamStats | null }) {
  const items = healthItems(team)
  return (
    <PremiumCard as="section" aria-labelledby="health-title">
      <SectionHeader
        eyebrow="Indicadores"
        title="Saúde comercial"
        action={<IconTile icon={HeartPulse} tone="green" size="sm" />}
      />
      <span id="health-title" className="sr-only">
        Saúde comercial
      </span>
      <ul className="mt-4 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">{item.label}</span>
              <span className="text-[11px] font-semibold text-muted-2">{item.target}</span>
            </div>
            <div className={`nums mb-2 text-lg font-black ${TONE_TEXT[item.tone]}`}>{item.value}</div>
            <Progress value={item.pct} tone={item.tone} size="sm" label={item.label} />
          </li>
        ))}
      </ul>
    </PremiumCard>
  )
}
