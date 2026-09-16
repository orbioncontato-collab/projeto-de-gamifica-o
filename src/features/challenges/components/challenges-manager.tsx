import { Swords } from 'lucide-react'
import { Badge } from '@/components/shared/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ListSkeleton } from '@/components/shared/skeletons'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { SectionHeader } from '@/components/shared/section-header'
import { StatusPill } from '@/components/shared/status-pill'
import type { Tone } from '@/components/shared/types'
import { formatDateTime, pluralize } from '@/lib/format'
import { CHALLENGE_KIND_LABELS, CHALLENGE_METRIC_LABELS, CHALLENGE_STATUS_LABELS } from '@/lib/labels'
import type { ChallengeStatus, VChallengeBoard } from '@/lib/database.types'
import { useMe } from '@/features/auth/hooks'
import { challengeRewardLabel, formatMetricValue } from '../challenge-logic'
import { useChallengeBoard } from '../hooks'
import { ChallengeActions } from './challenge-actions'

const ALL_STATUSES: readonly ChallengeStatus[] = ['active', 'draft', 'finished', 'cancelled']
const STATUS_ORDER: Record<ChallengeStatus, number> = { active: 0, draft: 1, finished: 2, cancelled: 3 }

const CHALLENGE_STATUS_MAP: Record<ChallengeStatus, { label: string; tone: Tone }> = {
  draft: { label: CHALLENGE_STATUS_LABELS.draft, tone: 'warning' },
  active: { label: CHALLENGE_STATUS_LABELS.active, tone: 'success' },
  finished: { label: CHALLENGE_STATUS_LABELS.finished, tone: 'info' },
  cancelled: { label: CHALLENGE_STATUS_LABELS.cancelled, tone: 'muted' },
}

interface ChallengesManagerProps {
  onEdit: (challenge: VChallengeBoard) => void
  onCreate: () => void
}

/** Gestão (admin): lista com status, tipo, métrica, meta, prêmio, período, participantes e ações por status. */
export function ChallengesManager({ onEdit, onCreate }: ChallengesManagerProps) {
  const { seasonId, settings } = useMe()
  const query = useChallengeBoard(seasonId, ALL_STATUSES)
  const tz = settings.timezone

  return (
    <section
      id="gerenciar"
      aria-labelledby="challenges-manager-title"
      className="flex flex-col gap-4 scroll-mt-24"
    >
      <SectionHeader eyebrow="Gestão" title="Desafios da temporada" />
      <QueryBoundary
        query={query}
        skeleton={<ListSkeleton rows={3} />}
        empty={{
          when: (rows) => rows.length === 0,
          render: (
            <EmptyState
              icon={Swords}
              title="Nenhum desafio criado"
              description="Crie um duelo entre dois colaboradores ou um desafio coletivo com meta para o time."
              action={{ label: 'Novo desafio', onClick: onCreate }}
              compact
            />
          ),
        }}
      >
        {(rows) => (
          <ul className="flex flex-col gap-2">
            {[...rows]
              .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
              .map((c) => (
                <li
                  key={c.challenge_id}
                  className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-text">{c.name}</span>
                      <Badge tone={c.kind === 'duel' ? 'red' : 'purple'}>
                        {CHALLENGE_KIND_LABELS[c.kind]}
                      </Badge>
                      <StatusPill status={c.status} map={CHALLENGE_STATUS_MAP} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {CHALLENGE_METRIC_LABELS[c.metric]} · meta {formatMetricValue(c.metric, c.target_value)}{' '}
                      · prêmio {challengeRewardLabel(c)} ·{' '}
                      {c.participants_count === 0
                        ? 'todos os ativos'
                        : pluralize(c.participants_count, 'participante', 'participantes')}
                    </p>
                    <p className="text-xs text-muted-2">
                      {formatDateTime(c.starts_at, tz)} até {formatDateTime(c.ends_at, tz)}
                    </p>
                  </div>
                  <ChallengeActions challenge={c} onEdit={onEdit} />
                </li>
              ))}
          </ul>
        )}
      </QueryBoundary>
    </section>
  )
}
