import { LogOut } from 'lucide-react'
import { useLogout, useMe } from '@/features/auth/hooks'
import { Button } from '@/components/ui/button'
import { Brand } from './brand'
import { NavLink } from './nav-link'
import { ADMIN_NAV, FOOTER_NAV, MAIN_NAV } from './sidebar-nav'

export interface SidebarContentProps {
  /** fecha o drawer ao navegar (mobile) */
  onNavigate?: () => void
  /** oculta a marca (o drawer já mostra no cabeçalho) */
  hideBrand?: boolean
}

/** Conteúdo da sidebar (FRONTEND-ARCH §3.6): nav principal, "Administração" só para admin, Configurações e Sair. */
export function SidebarContent({ onNavigate, hideBrand = false }: SidebarContentProps) {
  const { isAdmin, pendingMembers } = useMe()
  const logout = useLogout()
  return (
    <div className="flex h-full flex-col">
      {!hideBrand ? <Brand className="px-4 pb-2 pt-5" /> : null}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navegação principal">
        <div className="eyebrow px-3 pb-2 pt-4" data-tone="muted">
          Menu
        </div>
        <ul className="space-y-0.5">
          {MAIN_NAV.map((item) => (
            <li key={item.id}>
              <NavLink item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        {isAdmin ? (
          <>
            <div className="eyebrow px-3 pb-2 pt-6" data-tone="muted">
              Administração
            </div>
            <ul className="space-y-0.5" aria-label="Administração">
              {ADMIN_NAV.map((item) => (
                <li key={item.id}>
                  <NavLink item={item} pendingMembers={pendingMembers} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>
      <div className="border-t border-line px-3 py-3">
        <ul className="space-y-0.5">
          {FOOTER_NAV.map((item) => (
            <li key={item.id}>
              <NavLink item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          className="mt-1 w-full justify-start px-3 text-sm font-semibold"
          onClick={() => logout.mutate()}
          loading={logout.isPending}
        >
          {!logout.isPending ? <LogOut aria-hidden="true" /> : null}
          Sair
        </Button>
      </div>
    </div>
  )
}
