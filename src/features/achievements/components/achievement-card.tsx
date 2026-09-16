import { Lock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import type { VAchievementBoard } from '@/lib/database.types'
import { Badge } from '@/components/shared/badge'
import { criteriaHint, rewardSummary, SCOPE_LABELS } from '../achievements-utils'

export interface AchievementCardProps {
  achievement: VAchievementBoard
  tz?: string
}

/** Rodapé: data do desbloqueio; bloqueada mostra como desbloquear (sem repetir a descrição ausente). */
function footerText(a: VAchievementBoard, tz?: string): string {
  if (a.is_unlocked)
    return a.unlocked_at ? `Desbloqueada em ${formatDate(a.unlocked_at, tz)}` : 'Desbloqueada'
  return a.description ? criteriaHint(a.criteria, a.criteria_value, a.scope) : ''
}

/** Card da grade: desbloqueada (dourada, ✨, data, ×N) ou bloqueada (cadeado, como desbloquear). */
export function AchievementCard({ achievement: a, tz }: AchievementCardProps) {
  const unlocked = a.is_unlocked
  const reward = rewardSummary(a.reward_points, a.reward_coins)
  return (
    <article
      className={cn(
        'premium-card relative flex h-full flex-col p-5 transition duration-300',
        unlocked ? 'hover:-translate-y-1 motion-reduce:hover:translate-y-0' : 'opacity-85',
      )}
      data-tone={unlocked ? 'gold' : undefined}
      data-glow={unlocked ? 'true' : undefined}
      aria-label={`${a.title} — ${unlocked ? 'desbloqueada' : 'bloqueada'}`}
    >
      {unlocked ? (
        <Sparkles className="absolute right-4 top-4 h-4 w-4 text-gold" aria-hidden="true" />
      ) : (
        <Lock className="absolute right-4 top-4 h-4 w-4 text-muted-3" aria-hidden="true" />
      )}
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl leading-none',
            unlocked ? 'bg-gold/18' : 'bg-surface-hover grayscale',
          )}
          aria-hidden="true"
        >
          {a.icon ?? '🏆'}
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'text-sm font-black uppercase tracking-[0.08em]',
              unlocked ? 'text-gold' : 'text-text',
            )}
          >
            {a.title}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {a.description ?? criteriaHint(a.criteria, a.criteria_value, a.scope)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={unlocked ? 'gold' : 'dark'}>{unlocked ? 'Desbloqueada' : 'Bloqueada'}</Badge>
        <Badge tone="dark">{SCOPE_LABELS[a.scope]}</Badge>
        {unlocked && a.unlocked_count > 1 ? (
          <Badge tone="gold">
            <span className="nums">×{a.unlocked_count}</span>
          </Badge>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2 text-[11px]">
        <span className="text-muted">{footerText(a, tz)}</span>
        {reward ? <span className="nums shrink-0 font-bold text-accent">{reward}</span> : null}
      </div>
    </article>
  )
}
