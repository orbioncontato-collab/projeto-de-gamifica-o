import { useMemo, type ReactNode } from 'react'
import { FieldA11yContext, type FieldA11yContextValue } from '@/components/ui/field-context'
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

/**
 * Rótulo `.field-label` + campo + erro/dica. Passe `htmlFor` igual ao `id` do input.
 * Os controles de `components/ui` (`Input`, `Textarea`, `SelectTrigger`) e `MoneyInput`
 * recebem `aria-describedby` (erro/dica) e `aria-invalid` automaticamente via contexto.
 */
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
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined
  const showHint = !error && Boolean(hint)
  const a11y = useMemo<FieldA11yContextValue>(
    () => ({
      ...(error && errorId ? { errorId } : {}),
      ...(showHint && hintId ? { hintId } : {}),
      invalid: Boolean(error),
    }),
    [error, errorId, showHint, hintId],
  )
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
      <FieldA11yContext.Provider value={a11y}>{children}</FieldA11yContext.Provider>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-red-soft">
          {error}
        </p>
      ) : showHint ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted-2">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
