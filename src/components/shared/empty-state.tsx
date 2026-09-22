import { Link, type LinkProps } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useMeOptional } from '@/features/auth/bootstrap-query'
import type { LinkTo } from './types'

export interface EmptyStateAction {
  label: string
  to?: LinkTo
  /** search params obrigatórios da rota destino (ex.: `{ aba: 'temporadas' }`) */
  search?: LinkProps['search']
  onClick?: () => void
}

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: EmptyStateAction
  compact?: boolean
  /** só renderiza para gestor (`useMe().isAdmin`) — orientação da próxima ação (FRONTEND-ARCH §9) */
  adminHint?: string
  className?: string
}

/** Estado vazio bem desenhado — toda tela nasce assim com o banco recém-instalado. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  adminHint,
  className,
}: EmptyStateProps) {
  const me = useMeOptional()
  const showHint = Boolean(adminHint) && me?.isAdmin === true
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <div
        className={cn(
          'grid place-items-center rounded-2xl bg-accent/10 text-accent',
          compact ? 'h-10 w-10' : 'h-14 w-14',
        )}
      >
        <Icon className={compact ? 'h-5 w-5' : 'h-7 w-7'} aria-hidden="true" />
      </div>
      <p className={cn('font-black tracking-tight text-text', compact ? 'text-sm' : 'text-lg')}>{title}</p>
      <p className="max-w-md text-sm text-muted">{description}</p>
      {showHint ? (
        <p className="mt-1 inline-flex max-w-md items-start gap-2 rounded-xl border border-gold/20 bg-gold/10 px-3 py-2 text-left text-xs font-semibold text-gold">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{adminHint}</span>
        </p>
      ) : null}
      {action ? (
        action.to ? (
          <Button asChild variant="primary" size="sm" className="mt-2">
            <Link to={action.to} search={action.search as never} onClick={action.onClick}>
              {action.label}
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="primary" size="sm" className="mt-2" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  )
}
