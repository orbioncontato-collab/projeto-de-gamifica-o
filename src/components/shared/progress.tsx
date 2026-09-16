import { cn } from '@/lib/utils'

export interface ProgressProps {
  /** 0–100 (valores fora são limitados) */
  value: number
  tone?: 'green' | 'gold' | 'red' | 'blue' | 'purple'
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
  /** rótulo acessível (aria-label); sem ele usa "Progresso" */
  label?: string
  className?: string
}

const SIZE: Record<NonNullable<ProgressProps['size']>, string> = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }

const clamp = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0)

/** Barra com gradiente e `aria-valuenow`. */
export function Progress({ value, tone = 'green', size = 'md', glow = false, label, className }: ProgressProps) {
  const pct = clamp(value)
  return (
    <div
      role="progressbar"
      aria-label={label ?? 'Progresso'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('progress-track w-full', SIZE[size], className)}
    >
      <div className="progress-fill" data-tone={tone} data-glow={glow ? 'true' : undefined} style={{ width: `${pct}%` }} />
    </div>
  )
}
