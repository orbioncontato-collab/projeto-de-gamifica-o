import { Link } from '@tanstack/react-router'
import { AlertTriangle, CalendarDays } from 'lucide-react'
import { useMe } from '@/features/auth/hooks'
import { formatDaysLeft } from '@/lib/format'
import { cn } from '@/lib/utils'

const chipClass =
  'inline-flex h-9 max-w-[220px] items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-[0.12em]'

/** "Temporada {nome}" ou, sem temporada ativa, "Sem temporada ativa" em vermelho (admin vai para as temporadas). */
export function SeasonChip({ className }: { className?: string }) {
  const { season, isAdmin } = useMe()
  if (!season) {
    const label = 'Sem temporada ativa'
    const classes = cn(chipClass, 'border-red/25 bg-red/10 text-red-soft', className)
    if (!isAdmin) {
      return (
        <span className={classes} title="A próxima temporada ainda não começou">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
      )
    }
    return (
      <Link
        to="/admin/configuracoes"
        search={{ aba: 'temporadas' }}
        className={cn(classes, 'transition hover:bg-red/15')}
        title="Criar ou ativar temporada"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </Link>
    )
  }
  return (
    <span
      className={cn(chipClass, 'border-accent/20 bg-accent/10 text-accent', className)}
      title={`${season.name} · ${formatDaysLeft(season.days_left)}`}
    >
      <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">Temporada {season.name}</span>
    </span>
  )
}
