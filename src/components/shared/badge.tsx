import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { normalizeTone, TONE_PILL, type Tone } from './types'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: Tone
  children: ReactNode
}

/** Pílula uppercase 9px (identidade do original). */
export function Badge({ tone, children, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em]',
        TONE_PILL[normalizeTone(tone)],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
