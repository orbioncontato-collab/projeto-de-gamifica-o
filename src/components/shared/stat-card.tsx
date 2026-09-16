import { Link } from '@tanstack/react-router'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconTile } from './icon-tile'
import type { LinkTo, Tone } from './types'

export interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  tone: Tone
  hint?: string
  to?: LinkTo
  className?: string
}

/** Card de métrica do dashboard: tile colorido, rótulo uppercase, valor black, seta no hover quando navegável. */
export function StatCard({ label, value, icon, tone, hint, to, className }: StatCardProps) {
  const body = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <IconTile icon={icon} tone={tone} size="sm" className="rounded-xl" />
        {to ? (
          <ChevronRight
            className="h-4 w-4 text-muted-3 transition group-hover:translate-x-0.5 group-hover:text-muted"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-2">{label}</div>
      <div className="nums mt-1 truncate text-lg font-black tracking-tight text-text sm:text-xl">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted">{hint}</div> : null}
    </>
  )
  const classes = cn(
    'premium-card group block p-4 transition duration-300',
    to && 'hover:-translate-y-1 motion-reduce:hover:translate-y-0',
    className,
  )
  if (to) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    )
  }
  return <div className={classes}>{body}</div>
}
