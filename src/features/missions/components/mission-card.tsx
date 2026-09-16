import { CheckCircle2, Target } from 'lucide-react'
import { PremiumCard } from '@/components/shared/premium-card'
import { Badge } from '@/components/shared/badge'
import { Progress } from '@/components/shared/progress'
import { MISSION_KIND_LABELS, METRIC_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { VMissionBoard } from '@/lib/database.types'
import { missionProgressLabel, missionRewardLabel } from '../mission-copy'

/** Card de missão: ícone, título, descrição, badge de recompensa, "EM PROGRESSO x/y" ou "MISSÃO CONCLUÍDA", barra. */
export function MissionCard({ mission }: { mission: VMissionBoard }) {
  const done = mission.is_completed
  return (
    <PremiumCard
      as="article"
      padding="md"
      className={cn('flex flex-col gap-4', done && 'border-accent/25')}
      aria-label={mission.title}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl',
            done ? 'bg-accent/18 text-accent' : 'bg-surface-hover text-text',
          )}
          aria-hidden="true"
        >
          {mission.icon ? mission.icon : <Target className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black leading-tight text-text">{mission.title}</h3>
            <Badge tone="dark">{MISSION_KIND_LABELS[mission.kind]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{mission.description ?? METRIC_LABELS[mission.metric]}</p>
        </div>
        <Badge tone={done ? 'green' : 'gold'}>{missionRewardLabel(mission)}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[0.7rem] font-black uppercase tracking-[0.18em]">
          {done ? (
            <span className="inline-flex items-center gap-1.5 text-accent">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Missão concluída
            </span>
          ) : (
            <span className="text-muted">Em progresso</span>
          )}
          <span className="font-mono tabular-nums text-text-2">{missionProgressLabel(mission)}</span>
        </div>
        <Progress
          value={done ? 100 : mission.progress_pct}
          tone={done ? 'green' : 'gold'}
          size="sm"
          glow={done}
          label={`Progresso da missão ${mission.title}`}
        />
      </div>
    </PremiumCard>
  )
}
