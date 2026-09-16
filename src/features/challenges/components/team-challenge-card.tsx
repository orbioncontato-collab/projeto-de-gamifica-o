import { Users } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { PremiumCard } from '@/components/shared/premium-card'
import { Progress } from '@/components/shared/progress'
import { formatDaysLeft, formatPct, pluralize } from '@/lib/format'
import { CHALLENGE_METRIC_LABELS } from '@/lib/labels'
import type { VChallengeBoard } from '@/lib/database.types'
import { challengeRewardLabel, formatMetricValue } from '../challenge-logic'

const MAX_FACES = 6

/** Desafio coletivo (card vermelho): meta, realizado, %, prêmio coletivo, participantes, prazo. */
export function TeamChallengeCard({ challenge }: { challenge: VChallengeBoard }) {
  const finished = challenge.status === 'finished'
  const faces = challenge.participants.slice(0, MAX_FACES)
  const extra = challenge.participants.length - faces.length
  return (
    <PremiumCard
      as="article"
      tone="red"
      padding="md"
      className="flex flex-col gap-5"
      aria-label={challenge.name}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red/18 text-red-soft"
            aria-hidden="true"
          >
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-red-soft">
              Desafio coletivo
            </p>
            <h3 className="mt-1 text-lg font-black leading-tight text-text">{challenge.name}</h3>
            {challenge.description ? (
              <p className="mt-1 text-sm text-muted">{challenge.description}</p>
            ) : null}
          </div>
        </div>
        <Badge tone={finished ? 'dark' : 'gold'}>{challengeRewardLabel(challenge)}</Badge>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Meta" value={formatMetricValue(challenge.metric, challenge.target_value)} />
        <Stat label="Realizado" value={formatMetricValue(challenge.metric, challenge.total_value)} />
        <Stat label="Progresso" value={formatPct(challenge.total_pct)} />
      </dl>

      <Progress
        value={challenge.total_pct}
        tone={challenge.total_pct >= 100 ? 'green' : 'red'}
        size="md"
        glow={challenge.total_pct >= 100}
        label={`Progresso do desafio ${challenge.name}`}
      />

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex -space-x-2"
            aria-label={pluralize(challenge.participants_count, 'participante', 'participantes')}
          >
            {faces.map((p) => (
              <Avatar
                key={p.profile_id}
                name={p.full_name}
                color={p.color}
                avatarPath={p.avatar_path}
                size="xs"
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-muted">
            {challenge.participants_count === 0
              ? 'Todos os colaboradores ativos'
              : `${pluralize(challenge.participants_count, 'participante', 'participantes')}${extra > 0 ? ` (+${extra} não exibidos)` : ''}`}
          </span>
        </div>
        <span className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-muted">
          {CHALLENGE_METRIC_LABELS[challenge.metric]} ·{' '}
          {finished
            ? 'Finalizado'
            : challenge.status === 'draft'
              ? 'Rascunho'
              : formatDaysLeft(challenge.days_left)}
        </span>
      </footer>
    </PremiumCard>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <dt className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-muted-2">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-black tabular-nums text-text">{value}</dd>
    </div>
  )
}
