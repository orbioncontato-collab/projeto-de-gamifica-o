import { useState, type ReactNode } from 'react'
import { BottomNav } from './bottom-nav'
import { MobileDrawer } from './mobile-drawer'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

/**
 * Casca do app autenticado (FRONTEND-ARCH §2.1 `_app.tsx`): sidebar fixa em lg+, drawer + bottom nav abaixo,
 * `main` com `pb-28` no mobile para o bottom nav não cobrir conteúdo (Definition of Done §7.4).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return (
    <div className="min-h-dvh bg-bg text-text">
      <Sidebar />
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <div className="flex min-h-dvh flex-col lg:pl-[250px]">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-6 lg:pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
