import { Link } from '@tanstack/react-router'
import { BOTTOM_NAV } from './sidebar-nav'

/** 5 atalhos fixos no rodapé em telas < lg (FRONTEND-ARCH §3.6); "/" com `exact`. */
export function BottomNav() {
  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-30 border-t lg:hidden" aria-label="Atalhos">
      <ul className="grid grid-cols-5">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.id}>
              <Link
                {...item.link}
                activeOptions={{ exact: item.exact ?? false, includeSearch: false }}
                activeProps={{ 'data-status': 'active', 'aria-current': 'page' }}
                className="group flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-black uppercase tracking-[0.08em] text-muted transition data-[status=active]:text-accent"
              >
                <span className="grid h-7 w-9 place-items-center rounded-xl transition group-data-[status=active]:bg-accent/12">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
