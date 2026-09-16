import type { ReactNode } from 'react'

export interface PageFrameProps {
  eyebrow: string
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}

/** Cabeçalho de página do original: eyebrow verde uppercase, h1 black, subtítulo muted. */
export function PageFrame({ eyebrow, title, subtitle, action, children }: PageFrameProps) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-text sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </div>
  )
}
