import { useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { avatarUrl } from '@/lib/supabase'
import { initials } from '@/lib/format'

export interface AvatarProps {
  name: string
  /** cor da pessoa (`profiles.color`, hex vindo do banco) */
  color: string
  avatarPath?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  ring?: boolean
  className?: string
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 rounded-lg text-[9px]',
  sm: 'h-8 w-8 rounded-xl text-[10px]',
  md: 'h-10 w-10 rounded-2xl text-xs',
  lg: 'h-14 w-14 rounded-2xl text-sm',
  xl: 'h-20 w-20 rounded-[20px] text-lg',
}

const FALLBACK_COLOR = '#F97316' // default de `profiles.color` (DATA-MODEL §4.6)
const isHex = (c: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(c)

/** Foto (via `avatarUrl`) ou iniciais sobre gradiente da `color`; `alt` = nome. */
export function Avatar({ name, color, avatarPath, size = 'md', ring = false, className }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const url = broken ? null : avatarUrl(avatarPath)
  const style = { '--avatar-color': isHex(color) ? color : FALLBACK_COLOR } as CSSProperties
  return (
    <div
      className={cn('avatar-tile', SIZE[size], className)}
      style={style}
      data-ring={ring ? 'true' : undefined}
      role={url ? undefined : 'img'}
      aria-label={url ? undefined : name}
      title={name}
    >
      {url ? <img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} /> : <span aria-hidden="true">{initials(name)}</span>}
    </div>
  )
}
