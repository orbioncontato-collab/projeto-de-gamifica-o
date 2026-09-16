import { Link } from '@tanstack/react-router'
import { ChevronRight, Target } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { Progress } from '@/components/shared/progress'
import { SectionHeader } from '@/components/shared/section-header'
import { Badge } from '@/components/shared/badge'
import { formatBRL, formatNumber, formatPoints } from '@/lib/format'
import { MISSION_KIND_LABELS } from '@/lib/labels'
import type { VMissionBoard } from '@/lib/database.types'

const progressLabel = (m: VMissionBoard): string =>
  m.target_kind === 'amount'
    ? `${formatBRL(m.progress_value)} de ${formatBRL(m.target_value)}`
    : `${formatNumber(m.progress_value)} de ${formatNumber(m.target_value)}`

/** 3 missões de hoje com progresso (FEATURE §2 `MissionPreview`); §9: "Sem missões para hoje". */
export function MissionPreview({ missions }: { missions: VMissionBoard[] }) {
  return (
    <PremiumCard as="section" aria-labelledby="mission-preview-title">
      <SectionHeader
        eyebrow="Metas"
        title="Missões de hoje"
        action={
          <Link
            to="/missoes"
            search={{ filtro: 'hoje' }}
            className="inline-flex min-h-11 items-center gap-1 text-xs font-black text-accent hover:underline"
          >
            Ver todas
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />
      <span id="mission-preview-title" className="sr-only">
        Missões de hoje
      </span>
      {missions.length === 0 ? (
        <EmptyState
          compact
          className="mt-4"
          icon={Target}
          title="Sem missões para hoje"
          description="As missões diárias e relâmpago do dia aparecem aqui."
          adminHint="Crie a primeira missão em Missões › Nova missão."
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-3" aria-label="Missões de hoje">
          {missions.slice(0, 3).map((m) => (
            <li key={m.mission_id} className="rounded-2xl border border-line bg-surface px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span aria-hidden="true">{m.icon ?? '🎯'}</span>
                    <span className="break-safe text-sm font-bold text-text">{m.title}</span>
                    <Badge tone={m.kind === 'lightning' ? 'purple' : 'dark'}>
                      {MISSION_KIND_LABELS[m.kind]}
                    </Badge>
                  </div>
                  <p className="nums mt-1 text-xs font-semibold text-muted">
                    {progressLabel(m)} · +{formatPoints(m.reward_points)}
                  </p>
                </div>
                {m.is_completed ? <Badge tone="green">Concluída</Badge> : null}
              </div>
              <div className="mt-2">
                <Progress
                  value={m.progress_pct}
                  tone={m.is_completed ? 'green' : 'blue'}
                  size="sm"
                  label={`Progresso de ${m.title}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PremiumCard>
  )
}
