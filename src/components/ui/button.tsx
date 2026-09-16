import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-ctl)] text-[0.78rem] font-black tracking-wide transition duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-fg shadow-[var(--glow-accent)] hover:bg-accent-hover hover:-translate-y-px motion-reduce:hover:translate-y-0',
        secondary: 'border border-line-strong bg-surface text-text-2 hover:bg-surface-hover hover:text-text',
        ghost: 'text-muted hover:bg-surface-hover hover:text-text',
        danger: 'border border-red/25 bg-red/10 text-red-soft hover:bg-red/15',
        gold: 'border border-gold/20 bg-gold/10 text-gold hover:bg-gold/15',
        blue: 'border border-blue/20 bg-blue/10 text-blue-soft hover:bg-blue/15',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 min-w-9 px-3 text-[0.7rem]',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-sm',
        icon: 'h-11 w-11',
        'icon-sm': 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** mostra spinner e desabilita (sem duplo clique) */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children // Slot exige exatamente um filho React; o spinner só faz sentido no <button> real
        ) : (
          <>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
