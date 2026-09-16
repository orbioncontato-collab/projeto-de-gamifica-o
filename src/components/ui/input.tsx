import * as React from 'react'
import { cn } from '@/lib/utils'
import { useFieldA11y } from './field-context'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }, ref) => {
    const a11y = useFieldA11y({ 'aria-describedby': describedBy, 'aria-invalid': invalid })
    return (
      <input
        type={type}
        className={cn(
          'field-input h-11 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-text',
          className,
        )}
        ref={ref}
        {...props}
        {...a11y}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
