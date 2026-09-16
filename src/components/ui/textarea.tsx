import * as React from 'react'
import { cn } from '@/lib/utils'
import { useFieldA11y } from './field-context'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }, ref) => {
    const a11y = useFieldA11y({ 'aria-describedby': describedBy, 'aria-invalid': invalid })
    return (
      <textarea
        className={cn(
          'field-input min-h-[90px] resize-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
        {...a11y}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
