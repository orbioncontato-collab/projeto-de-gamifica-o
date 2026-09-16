import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type CardTone = 'default' | 'green' | 'gold' | 'purple' | 'red' | 'blue'

export interface PremiumCardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  as?: 'section' | 'div' | 'article'
  tone?: CardTone
  glow?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
}

const PADDING: Record<NonNullable<PremiumCardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-5 sm:p-7',
}

/** `.premium-card` (gradiente + borda 1px + raio 22px); `tone` aplica os gradientes tonais do original. */
export const PremiumCard = forwardRef<HTMLElement, PremiumCardProps>(function PremiumCard(
  { as = 'div', tone = 'default', glow = false, padding = 'md', className, children, ...props },
  ref,
) {
  const Comp = as
  return (
    <Comp
      ref={ref as never}
      className={cn('premium-card', PADDING[padding], className)}
      data-tone={tone === 'default' ? undefined : tone}
      data-glow={glow ? 'true' : undefined}
      {...props}
    >
      {children}
    </Comp>
  )
})
