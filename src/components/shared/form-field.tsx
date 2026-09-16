import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string | undefined
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}

/** Rótulo `.field-label` + campo + erro/dica. Passe `htmlFor` igual ao `id` do input. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}: FormFieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  return (
    <div className={cn('block', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-1 text-red-soft" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-red-soft">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-2">{hint}</p>
      ) : null}
    </div>
  )
}
