import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeSwitch } from '@/features/theme/theme-switch'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import { Brand } from './brand'
import { CoinsChip } from './coins-chip'
import { SeasonChip } from './season-chip'
import { UserMenu } from './user-menu'

export interface TopbarProps {
  onOpenMenu: () => void
}

/** Topbar (FRONTEND-ARCH §3.6): menu (mobile) · temporada · moedas · sino · tema · usuário. */
export function Topbar({ onOpenMenu }: TopbarProps) {
  return (
    <header className="glass sticky top-0 z-20 border-b">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-3 sm:px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl lg:hidden"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
        >
          <Menu aria-hidden="true" />
        </Button>
        <Brand compact className="lg:hidden" />
        <div className="ml-1 hidden min-w-0 items-center gap-2 sm:flex">
          <SeasonChip />
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <CoinsChip />
          <NotificationBell />
          <ThemeSwitch compact className="hidden sm:inline-flex" />
          <UserMenu />
        </div>
      </div>
      <div className="flex items-center px-3 pb-2 sm:hidden">
        <SeasonChip className="max-w-full" />
      </div>
    </header>
  )
}
