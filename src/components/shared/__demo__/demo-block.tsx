import type { ReactNode } from 'react'

/** Bloco de demonstração da vitrine com título eyebrow. */
export function Demo({
  title,
  children,
  stack = false,
}: {
  title: string
  children: ReactNode
  stack?: boolean
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h3 className="eyebrow">{title}</h3>
      <div className={stack ? 'space-y-3' : 'flex flex-wrap items-start gap-3'}>{children}</div>
    </section>
  )
}
