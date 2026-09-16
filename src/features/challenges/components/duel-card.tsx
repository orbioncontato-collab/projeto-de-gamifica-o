import { Swords, Trophy } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { PremiumCard } from '@/components/shared/premium-card'
import { formatDaysLeft } from '@/lib/format'
import { CHALLENGE_METRIC_LABELS, JOB_TITLE_LABELS, PROFILE_STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { ChallengeParticipant, VChallengeBoard } from '@/lib/database.types'
import { challengeRewardLabel, duelShare, formatMetricValue } from '../challenge-logic'

/** Duelo 1×1: avatares, valor de cada um, VS, objetivo, barra proporcional, prêmio, "finaliza em N dias". */
export function DuelCard({ challenge }: { challenge: VChallengeBoard }) {
  const [left, right] = challenge.participants
  const finished = challenge.status === 'finished'
  const share = duelShare(left?.value ?? 0, right?.value ?? 0)
  return (
    <PremiumCard as="article" padding="md" className="flex flex-col gap-5" aria-label={challenge.name}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-red-soft">Duelo</p>
          <h3 className="mt-1 text-lg font-black leading-tight text-text">{challenge.name}</h3>
          {challenge.description ? <p className="mt-1 text-sm text-muted">{challenge.description}</p> : null}
        </div>
        <Badge tone={finished ? 'dark' : 'gold'}>{challengeRewardLabel(challenge)}</Badge>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <DuelSide participant={left ?? null} metric={challenge.metric} align="start" />
        <div
          className="grid h-12 w-12 place-items-center rounded-full border border-red/25 bg-red/10 text-sm font-black text-red-soft"
          aria-hidden="true"
        >
          VS
        </div>
        <DuelSide participant={right ?? null} metric={challenge.metric} align="end" />
      </div>

      <div className="flex flex-col gap-2">
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-surface-deep"
          role="img"
          aria-label={`${left?.full_name ?? 'Lado A'} ${share}% contra ${right?.full_name ?? 'lado B'} ${100 - share}%`}
        >
          <div
            className="h-full bg-[linear-gradient(90deg,var(--accent),var(--accent-hover))] transition-[width] duration-500"
            style={{ width: `${share}%` }}
          />
          <div className="h-full flex-1 bg-[linear-gradient(90deg,var(--red),var(--red-soft))]" />
        </div>
        <div className="flex items-center justify-between text-[0.7rem] font-black uppercase tracking-[0.18em] text-muted">
          <span>
            Objetivo: {formatMetricValue(challenge.metric, challenge.target_value)} ·{' '}
            {CHALLENGE_METRIC_LABELS[challenge.metric]}
          </span>
          <span className={cn(finished && 'text-accent')}>
            {finished
              ? 'Finalizado'
              : challenge.status === 'draft'
                ? 'Rascunho'
                : formatDaysLeft(challenge.days_left)}
          </span>
        </div>
      </div>
    </PremiumCard>
  )
}

function DuelSide({
  participant,
  metric,
  align,
}: {
  participant: ChallengeParticipant | null
  metric: VChallengeBoard['metric']
  align: 'start' | 'end'
}) {
  const alignCls = align === 'end' ? 'items-end text-right' : 'items-start text-left'
  if (!participant) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-1', alignCls)}>
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-line-strong text-muted"
          aria-hidden="true"
        >
          <Swords className="h-5 w-5" />
        </div>
        <span className="text-xs font-semibold text-muted">Vaga em aberto</span>
      </div>
    )
  }
  const inactive = participant.status !== 'active'
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', alignCls)}>
      <div className="relative">
        <Avatar
          name={participant.full_name}
          color={participant.color}
          avatarPath={participant.avatar_path}
          size="md"
          ring={participant.is_winner}
        />
        {participant.is_winner ? (
          <span
            className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-accent-fg"
            aria-label="Vencedor"
          >
            <Trophy className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <span className="max-w-full truncate text-sm font-black text-text">{participant.full_name}</span>
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-2">
        {inactive ? PROFILE_STATUS_LABELS[participant.status] : JOB_TITLE_LABELS[participant.job_title]}
      </span>
      <span className="text-xl font-black tabular-nums text-text">
        {formatMetricValue(metric, participant.value)}
      </span>
    </div>
  )
}
