import { createContext, useContext, type AriaAttributes } from 'react'

/** Ids de erro/dica publicados por `FormField` para os controles filhos (`Input`, `Textarea`, `SelectTrigger`). */
export interface FieldA11yContextValue {
  errorId?: string
  hintId?: string
  invalid: boolean
}

export const FieldA11yContext = createContext<FieldA11yContextValue | null>(null)

export interface FieldA11yProps {
  'aria-describedby'?: string | undefined
  'aria-invalid'?: AriaAttributes['aria-invalid']
}

const joinIds = (...ids: Array<string | undefined>): string | undefined => {
  const unique = Array.from(new Set(ids.flatMap((id) => (id ? id.split(/\s+/) : [])).filter(Boolean)))
  return unique.length ? unique.join(' ') : undefined
}

/**
 * Mescla `aria-describedby`/`aria-invalid` explícitos com os ids do `FormField` envolvente.
 * Fora de um `FormField` devolve os props como vieram.
 */
export function useFieldA11y(props: FieldA11yProps): FieldA11yProps {
  const ctx = useContext(FieldA11yContext)
  if (!ctx) return props
  const describedBy = joinIds(props['aria-describedby'], ctx.errorId, ctx.hintId)
  const invalid = props['aria-invalid'] ?? (ctx.invalid || undefined)
  return {
    ...(describedBy !== undefined ? { 'aria-describedby': describedBy } : {}),
    ...(invalid !== undefined ? { 'aria-invalid': invalid } : {}),
  }
}
