import { SidebarContent } from './sidebar-content'

export const SIDEBAR_WIDTH_CLASS = 'w-[250px]'

/** Sidebar fixa 250 px em `lg+` (FRONTEND-ARCH §3.6); abaixo disso vira `MobileDrawer`. */
export function Sidebar() {
  return (
    <aside
      className={`glass fixed inset-y-0 left-0 z-30 hidden ${SIDEBAR_WIDTH_CLASS} border-r lg:block`}
      aria-label="Menu lateral"
    >
      <SidebarContent />
    </aside>
  )
}
