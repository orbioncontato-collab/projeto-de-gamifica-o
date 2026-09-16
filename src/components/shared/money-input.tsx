import { forwardRef, useEffect, useState, type ChangeEvent, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface MoneyInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: number | null
  onChange: (n: number | null) => void
}

const toDisplay = (n: number | null): string => (n === null || !Number.isFinite(n) ? '' : formatNumber(n, 2))
const fromDigits = (raw: string): number | null => {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  return Number(digits) / 100
}

/** Campo em reais com máscara pt-BR ("8.500,00"); devolve número (centavos digitados da direita para a esquerda). */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, className, ...props },
  ref,
) {
  const [text, setText] = useState(() => toDisplay(value))

  useEffect(() => {
    setText((current) => (fromDigits(current) === value ? current : toDisplay(value)))
  }, [value])

  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const n = fromDigits(e.target.value)
    setText(toDisplay(n))
    onChange(n)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted" aria-hidden="true">
        R$
      </span>
      <Input ref={ref} inputMode="decimal" value={text} onChange={handle} className={cn('pl-9 text-right', className)} {...props} />
    </div>
  )
})
