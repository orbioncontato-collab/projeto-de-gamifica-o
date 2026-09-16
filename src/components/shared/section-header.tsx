import type { ReactNode } from 'react'

export interface SectionHeaderProps {
  eyebrow: string
  title: string
  action?: ReactNode
}

export function SectionHeader({ eyebrow, title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="eyebrow" data-tone="muted">
          {eyebrow}
        </div>
        <h3 className="mt-1 text-lg font-black tracking-tight text-text">{title}</h3>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
