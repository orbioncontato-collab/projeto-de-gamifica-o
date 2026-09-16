import { useMemo } from 'react'
import { Zap } from 'lucide-react'
import { PremiumCard } from '@/components/shared/premium-card'
import { Badge } from '@/components/shared/badge'
import { Countdown } from '@/components/shared/countdown'
import { Progress } from '@/components/shared/progress'
import type { VMissionBoard } from '@/lib/database.types'
import { countdownTarget, missionProgressLabel, missionRewardLabel } from '../mission-copy'

interface LightningMissionProps {
  mission: VMissionBoard | null
  /** `dataUpdatedAt` da query — ancora `seconds_remaining` no instante da leitura */
  readAt: number
  onExpire?: () => void
}

/** Card roxo da missão relâmpago com contador (`seconds_remaining`). Sem missão: "Sem missão relâmpago hoje". */
export function LightningMission({ mission, readAt, onExpire }: LightningMissionProps) {
  const target = useMemo(
    () => (mission ? countdownTarget(mission.seconds_remaining, readAt) : null),
    [mission, readAt],
  )

  return (
    <PremiumCard as="section" tone="purple" glow padding="md" aria-labelledby="lightning-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple/18 text-purple-soft"
            aria-hidden="true"
          >
            <Zap className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-purple-soft">
              Missão relâmpago
            </p>
            <h2 id="lightning-title" className="mt-1 text-lg font-black leading-tight text-text">
              {mission ? mission.title : 'Sem missão relâmpago hoje'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {mission
                ? (mission.description ?? `Recompensa: ${missionRewardLabel(mission)}`)
                : 'Quando o gestor lançar uma, ela aparece aqui com o tempo restante.'}
            </p>
          </div>
        </div>
        {mission ? (
          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
            <Badge tone="purple">{missionRewardLabel(mission)}</Badge>
            {mission.is_completed ? (
              <span className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-accent">
                Concluída
              </span>
            ) : target !== null ? (
              <p className="text-2xl font-black text-text">
                <span className="sr-only">Tempo restante </span>
                <Countdown to={target} {...(onExpire ? { onZero: onExpire } : {})} />
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {mission ? (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[0.7rem] font-black uppercase tracking-[0.18em] text-muted">
            <span>{mission.is_completed ? 'Missão concluída' : 'Em progresso'}</span>
            <span className="font-mono tabular-nums text-text-2">{missionProgressLabel(mission)}</span>
          </div>
          <Progress
            value={mission.is_completed ? 100 : mission.progress_pct}
            tone={mission.is_completed ? 'green' : 'purple'}
            size="sm"
            label={`Progresso da missão ${mission.title}`}
          />
        </div>
      ) : null}
    </PremiumCard>
  )
}
