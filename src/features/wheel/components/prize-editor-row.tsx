import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import type { PrizeKind } from '@/lib/database.types'
import { PRIZE_KIND_LABELS } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MAX_PRIZE_WEIGHT, PRIZE_KIND_VALUES, PRIZE_LABEL_MAX, VALUE_REQUIRED_KINDS } from '../schemas'

/** Linha editável do editor (estado local, sem id até salvar). */
export interface PrizeDraft {
  key: string
  id?: string
  label: string
  kind: PrizeKind
  value: string
  weight: string
  color: string
  is_active: boolean
}

export interface PrizeRowErrors {
  label?: string
  value?: string
  weight?: string
  color?: string
}

interface PrizeEditorRowProps {
  draft: PrizeDraft
  index: number
  total: number
  errors: PrizeRowErrors | undefined
  disabled: boolean
  onChange: (patch: Partial<PrizeDraft>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

const VALUE_HINT: Partial<Record<PrizeKind, string>> = {
  points: 'pontos',
  coins: 'moedas',
  cash: 'R$',
  voucher: 'R$',
  multiplier: 'x (ex.: 2)',
}

export function PrizeEditorRow({
  draft,
  index,
  total,
  errors,
  disabled,
  onChange,
  onMove,
  onRemove,
}: PrizeEditorRowProps) {
  const needsValue = VALUE_REQUIRED_KINDS.includes(draft.kind)
  const id = `prize-${draft.key}`
  return (
    <li className="grid gap-3 rounded-2xl border border-line bg-surface p-3 md:grid-cols-[auto_1fr_10rem_7rem_6rem_6.5rem_auto] md:items-end">
      <div className="flex items-center gap-1 md:flex-col md:items-center">
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-xs font-black text-muted-2"
          style={{ background: draft.color || 'var(--wheel-dark-1)' }}
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <div className="flex gap-0.5 md:flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mover para cima"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mover para baixo"
            disabled={disabled || index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs font-bold text-muted-2">
        Rótulo
        <Input
          id={`${id}-label`}
          value={draft.label}
          maxLength={PRIZE_LABEL_MAX}
          disabled={disabled}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-invalid={Boolean(errors?.label)}
        />
        {errors?.label ? (
          <span role="alert" className="text-red-soft">
            {errors.label}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-xs font-bold text-muted-2">
        Tipo
        <Select
          value={draft.kind}
          disabled={disabled}
          onValueChange={(v) => onChange({ kind: v as PrizeKind })}
        >
          <SelectTrigger id={`${id}-kind`} className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIZE_KIND_VALUES.map((k) => (
              <SelectItem key={k} value={k}>
                {PRIZE_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-bold text-muted-2">
        Valor{' '}
        {VALUE_HINT[draft.kind] ? <span className="font-normal">({VALUE_HINT[draft.kind]})</span> : null}
        <Input
          id={`${id}-value`}
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          value={draft.value}
          disabled={disabled || !needsValue}
          placeholder={needsValue ? '' : '—'}
          onChange={(e) => onChange({ value: e.target.value })}
          aria-invalid={Boolean(errors?.value)}
        />
        {errors?.value ? (
          <span role="alert" className="text-red-soft">
            {errors.value}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-xs font-bold text-muted-2">
        Peso
        <Input
          id={`${id}-weight`}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_PRIZE_WEIGHT}
          value={draft.weight}
          disabled={disabled}
          onChange={(e) => onChange({ weight: e.target.value })}
          aria-invalid={Boolean(errors?.weight)}
        />
        {errors?.weight ? (
          <span role="alert" className="text-red-soft">
            {errors.weight}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-xs font-bold text-muted-2">
        Cor
        <span className="flex items-center gap-1">
          <input
            type="color"
            id={`${id}-color`}
            value={draft.color}
            disabled={disabled}
            onChange={(e) => onChange({ color: e.target.value.toUpperCase() })}
            className="h-11 w-11 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
            aria-label="Cor do setor"
          />
          <span className="text-[0.65rem] font-semibold uppercase text-muted">{draft.color}</span>
        </span>
        {errors?.color ? (
          <span role="alert" className="text-red-soft">
            {errors.color}
          </span>
        ) : null}
      </label>

      <div className="flex items-center justify-between gap-2 md:flex-col md:items-center">
        <label className="flex items-center gap-2 text-xs font-bold text-muted-2">
          <Switch
            checked={draft.is_active}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ is_active: v })}
            aria-label="Prêmio ativo"
          />
          Ativo
        </label>
        <Button
          type="button"
          variant="danger"
          size="icon-sm"
          aria-label={`Remover prêmio ${draft.label || index + 1}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
