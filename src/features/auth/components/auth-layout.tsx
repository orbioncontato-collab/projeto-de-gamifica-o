import type { ReactNode } from 'react'
import { Brand } from '@/components/layout/brand'
import { ThemeSwitch } from '@/features/theme/theme-switch'

export interface AuthLayoutProps {
  eyebrow: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

/** Tela sem sidebar/topbar: logo, card central, tema no canto (/login, /signup, /aguardando). */
export function AuthLayout({ eyebrow, title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-dvh flex-col bg-bg text-text">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Brand />
        <ThemeSwitch compact />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-10 pt-2 sm:px-6">
        <section className="premium-card w-full max-w-md p-6 sm:p-8" aria-labelledby="auth-title">
          <div className="eyebrow">{eyebrow}</div>
          <h1 id="auth-title" className="mt-2 text-2xl font-black tracking-tight sm:text-[28px]">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? (
            <div className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">{footer}</div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
