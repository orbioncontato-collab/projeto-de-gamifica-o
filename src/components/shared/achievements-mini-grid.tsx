import { Lock, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAchievementBoard } from '@/features/profiles/hooks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { QueryBoundary } from './query-boundary'
import { ListSkeleton } from './skeletons'
import { EmptyState } from './empty-state'

export interface AchievementsMiniGridProps {
  /** default: o próprio usuário */
  profileId?: string
  limit?: number
  className?: string
}

/** Mini-grid de conquistas (Perfil, ) alimentado por `useAchievementBoard` de features/profiles. */
export function AchievementsMiniGrid({ profileId, limit, className }: AchievementsMiniGridProps) {
  const query = useAchievementBoard(profileId)
  return (
    <QueryBoundary
      query={query}
      skeleton={<ListSkeleton rows={2} />}
      compact
      empty={{
        when: (rows) => rows.length === 0,
        render: (
          <EmptyState
            compact
            icon={Medal}
            title="Nenhuma conquista cadastrada"
            description="As conquistas aparecem aqui quando o catálogo estiver ativo."
          />
        ),
      }}
    >
      {(rows) => {
        const shown = limit ? rows.slice(0, limit) : rows
        const unlocked = rows.filter((r) => r.is_unlocked).length
        return (
          <div className={className}>
            <div className="mb-3 text-xs font-bold text-muted">
              <span className="text-text">{unlocked}</span> de {rows.length} desbloqueadas
            </div>
            <TooltipProvider delayDuration={200}>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Conquistas">
                {shown.map((a) => (
                  <li key={a.achievement_id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition',
                            a.is_unlocked
                              ? 'border-gold/25 bg-gold/10 text-gold'
                              : 'border-line bg-surface text-muted',
                          )}
                          role="group"
                          aria-label={`${a.title}${a.is_unlocked ? ' (desbloqueada)' : ' (bloqueada)'}`}
                          tabIndex={0}
                        >
                          <span
                            className={cn('text-xl leading-none', !a.is_unlocked && 'opacity-60')}
                            aria-hidden="true"
                          >
                            {a.is_unlocked ? (a.icon ?? '🏆') : <Lock className="h-4 w-4" />}
                          </span>
                          <span className="line-clamp-2 text-[9px] font-black uppercase tracking-wide">
                            {a.title}
                          </span>
                          {a.is_unlocked && a.unlocked_count > 1 ? (
                            <span className="nums text-[9px] font-bold text-gold">×{a.unlocked_count}</span>
                          ) : null}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{a.description ?? a.title}</TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          </div>
        )
      }}
    </QueryBoundary>
  )
}
