import { Link } from '@tanstack/react-router'
import { BellOff } from 'lucide-react'
import { formatRelative } from '@/lib/format'
import { NOTIFICATION_KIND_ICONS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { NotificationRow } from '@/lib/database.types'
import { EmptyState } from '@/components/shared/empty-state'
import { notificationLink } from '../notification-utils'

export interface NotificationListProps {
  items: readonly NotificationRow[]
  timezone: string
  onNavigate?: () => void
  className?: string
}

/** Lista do sino: item `approve_member` navega para Equipe › Pendentes; os demais só informam. */
export function NotificationList({ items, timezone, onNavigate, className }: NotificationListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="Sem notificações"
        description="Você será avisado por aqui quando algo acontecer."
        compact
      />
    )
  }
  return (
    <ul className={cn('divide-y divide-line', className)} aria-label="Notificações">
      {items.map((n) => {
        const link = notificationLink(n)
        const body = (
          <>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-base"
              aria-hidden="true"
            >
              {NOTIFICATION_KIND_ICONS[n.kind]}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block truncate text-[13px]',
                  n.is_read ? 'font-semibold text-text-2' : 'font-black text-text',
                )}
              >
                {n.title}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.message}</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-2">
                {formatRelative(n.created_at, Date.now(), timezone)}
              </span>
            </span>
            {!n.is_read ? (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Não lida" />
            ) : null}
          </>
        )
        const rowClass = 'flex w-full items-start gap-3 px-3 py-3 text-left'
        return (
          <li key={n.id}>
            {link ? (
              <Link
                {...link}
                onClick={onNavigate}
                className={cn(rowClass, 'transition hover:bg-surface-hover focus-visible:outline-none')}
              >
                {body}
              </Link>
            ) : (
              <div className={rowClass}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
