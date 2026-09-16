import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { MISSION_FILTERS, type MissionFilter } from '@/lib/gamification'

const MISSION_FILTER_LABELS: Record<MissionFilter, string> = {
  hoje: 'Hoje',
  semana: 'Semana',
  especiais: 'Especiais',
}

/** Filtro Hoje / Semana / Especiais como links (`?filtro=`) — estado na URL, não em memória. */
export function MissionFilters({ value }: { value: MissionFilter }) {
  return (
    <nav aria-label="Filtro de missões" className="flex flex-wrap gap-2">
      {MISSION_FILTERS.map((filter) => {
        const isActive = filter === value
        return (
          <Link
            key={filter}
            to="/missoes"
            search={(prev) => ({ ...prev, filtro: filter })}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex h-11 min-w-[5.5rem] items-center justify-center rounded-[var(--radius-ctl)] border px-4 text-[0.72rem] font-black uppercase tracking-[0.18em] transition',
              isActive
                ? 'border-accent/30 bg-accent/12 text-accent shadow-[var(--glow-accent)]'
                : 'border-line-strong bg-surface text-muted hover:bg-surface-hover hover:text-text',
            )}
          >
            {MISSION_FILTER_LABELS[filter]}
          </Link>
        )
      })}
    </nav>
  )
}
