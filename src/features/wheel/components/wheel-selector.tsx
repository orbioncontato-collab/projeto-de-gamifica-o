import { Crown, Lock, Sparkles } from 'lucide-react'
import type { WheelKind } from '@/lib/database.types'
import { WHEEL_KIND_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { WHEEL_KINDS } from '../api'

interface WheelSelectorProps {
  value: WheelKind
  onChange: (kind: WheelKind) => void
  /** Bloqueado quando há vez ativa (a roleta é a da fila). */
  locked: boolean
  prizeCounts: Record<WheelKind, number>
}

/** Seletor Clássica/Premium (bloqueado na roleta da vez ativa). */
export function WheelSelector({ value, onChange, locked, prizeCounts }: WheelSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Escolher roleta"
      className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-1.5"
    >
      {WHEEL_KINDS.map((kind) => {
        const selected = kind === value
        const Icon = kind === 'premium' ? Crown : Sparkles
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={locked && !selected}
            onClick={() => onChange(kind)}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[0.72rem] font-black uppercase tracking-wider transition',
              selected
                ? kind === 'premium'
                  ? 'bg-gold/15 text-gold shadow-[var(--glow-gold)]'
                  : 'bg-blue/15 text-blue-soft'
                : 'text-muted hover:bg-surface-hover hover:text-text',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{WHEEL_KIND_LABELS[kind].replace('Roleta ', '')}</span>
            <span className="rounded-full bg-surface-deep px-1.5 py-0.5 text-[0.62rem] text-muted-2">
              {prizeCounts[kind]}
            </span>
            {locked && selected ? <Lock size={12} aria-label="Roleta da vez ativa" /> : null}
          </button>
        )
      })}
    </div>
  )
}
