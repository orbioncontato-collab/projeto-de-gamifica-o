import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeTone, TONE_TILE, type Tone } from './types'

export interface IconTileProps {
  icon: LucideIcon
  tone: Tone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE: Record<NonNullable<IconTileProps['size']>, { box: string; icon: string }> = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5' },
  lg: { box: 'h-12 w-12 rounded-2xl', icon: 'h-6 w-6' },
}

/** Quadrado com ícone colorido (tile a 18 % de opacidade, como os StatCards do original). */
export function IconTile({ icon: Icon, tone, size = 'md', className }: IconTileProps) {
  const s = SIZE[size]
  return (
    <div className={cn('grid shrink-0 place-items-center', s.box, TONE_TILE[normalizeTone(tone)], className)}>
      <Icon className={s.icon} aria-hidden="true" />
    </div>
  )
}
