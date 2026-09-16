import { cn } from '@/lib/utils'

/** Logo "Orbion / Sales League" (FEATURE-INVENTORY §1) — tile verde com "O" + nome + subtítulo. */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg shadow-[var(--glow-accent)]"
        aria-hidden="true"
      >
        <span className="text-base font-black">O</span>
      </div>
      {!compact ? (
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-black tracking-tight text-text">Orbion</div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">Sales League</div>
        </div>
      ) : (
        <span className="sr-only">Orbion Sales League</span>
      )}
    </div>
  )
}
