import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useMe } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ErrorState } from '@/components/shared/error-state'
import { ListSkeleton } from '@/components/shared/skeletons'
import { useMarkNotificationsRead, useNotifications, useNotificationsRealtime } from '../hooks'
import { countUnread } from '../notification-utils'
import { NotificationList } from './notification-list'

const BELL_LIMIT = 8
const BADGE_MAX = 99

/** Sino da topbar: badge `unread_notifications` do bootstrap, dropdown com as 8 últimas e "Marcar todas como lidas". */
export function NotificationBell({ className }: { className?: string }) {
  const { unread, settings } = useMe()
  const [open, setOpen] = useState(false)
  const list = useNotifications(BELL_LIMIT)
  const markRead = useMarkNotificationsRead()
  useNotificationsRealtime()

  const unreadInList = list.data ? countUnread(list.data) : 0
  const badge = Math.max(unread, unreadInList)
  const badgeLabel = badge > BADGE_MAX ? `${BADGE_MAX}+` : String(badge)
  const ariaLabel = badge > 0 ? `Notificações: ${badge} não lidas` : 'Notificações'

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          className={cn('relative rounded-2xl', className)}
        >
          <Bell aria-hidden="true" />
          {badge > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-bg bg-accent px-1 text-[10px] font-black tabular-nums text-accent-fg"
            >
              {badgeLabel}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="eyebrow">Notificações</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markRead.mutate(undefined)}
            loading={markRead.isPending}
            disabled={badge === 0}
            className="h-8 px-2 text-[10px]"
          >
            {!markRead.isPending ? <CheckCheck aria-hidden="true" /> : null}
            Marcar todas como lidas
          </Button>
        </div>
        <div className="max-h-[min(70vh,420px)] overflow-y-auto">
          {list.isPending ? (
            <ListSkeleton rows={4} className="p-3" />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} compact className="m-3" />
          ) : (
            <NotificationList
              items={list.data}
              timezone={settings.timezone}
              onNavigate={() => setOpen(false)}
            />
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
