import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/shared/badge'
import { pendingBadgeLabel, teamLinkFor, type NavItem } from './sidebar-nav'

export interface NavLinkProps {
  item: NavItem
  /** `bootstrap.pending_members` — só o item com `badge: 'pending_members'` usa */
  pendingMembers?: number | undefined
  onNavigate?: (() => void) | undefined
  className?: string | undefined
}

/** Item de navegação da sidebar/drawer (`.nav-item` de components.css; ativo via `data-status`). */
export function NavLink({ item, pendingMembers = 0, onNavigate, className }: NavLinkProps) {
  const Icon = item.icon
  const showBadge = item.badge === 'pending_members' && pendingMembers > 0
  const link = item.badge === 'pending_members' ? teamLinkFor(pendingMembers) : item.link
  return (
    <Link
      {...link}
      activeOptions={{ exact: item.exact ?? false, includeSearch: item.matchSearch ?? false }}
      activeProps={{ 'data-status': 'active', 'aria-current': 'page' }}
      onClick={onNavigate}
      className={cn('nav-item min-h-11', className)}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{item.label}</span>
      {showBadge ? (
        <Badge tone="warning" aria-label={pendingBadgeLabel(pendingMembers)}>
          {pendingMembers}
        </Badge>
      ) : null}
    </Link>
  )
}
