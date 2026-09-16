import type { WheelState } from '@/lib/gamification'
import { wheelStatusLine } from '@/lib/gamification'
import { cn } from '@/lib/utils'

const TONE_BY_MODE: Record<WheelState['mode'], string> = {
  free: 'border-accent/25 bg-accent/10 text-accent',
  turn: 'border-gold/25 bg-gold/10 text-gold',
  pending: 'border-purple/25 bg-purple/10 text-purple-soft',
}

/** Pílula "GIRO LIVRE" / "VEZ DE {NOME} • Tentativa i de n" / "AGUARDANDO APROVAÇÃO • {prêmio}". */
export function WheelStatusPill({ state, className }: { state: WheelState; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em]',
        TONE_BY_MODE[state.mode],
        className,
      )}
    >
      <span className="wheel-status-dot" aria-hidden="true" />
      <span className="truncate">{wheelStatusLine(state)}</span>
    </div>
  )
}
