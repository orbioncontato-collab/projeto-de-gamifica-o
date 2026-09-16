import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Skeletons com a mesma altura do conteúdo (`animate-pulse` sobre `--surface`). */

export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('premium-card p-5', className)} aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-6 w-2/3" />
      <div className="mt-5 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div className={cn('premium-card overflow-hidden p-0', className)} aria-hidden="true">
      <div className="flex gap-3 border-b border-line px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-line px-4 py-4 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando">
      <div>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-8 w-64" />
        <Skeleton className="mt-2 h-3 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="premium-card p-4">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="mt-4 h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={2} />
      </div>
    </div>
  )
}

export function WheelSkeleton() {
  return (
    <div className="flex w-full flex-col items-center gap-5" aria-hidden="true">
      <Skeleton className="aspect-square w-full max-w-[470px] rounded-full" />
      <Skeleton className="h-8 w-56 rounded-full" />
      <Skeleton className="h-12 w-64 rounded-xl" />
    </div>
  )
}

/** Tela inteira de carregamento (sessão/rota) — usada por main.tsx enquanto a sessão é desconhecida. */
export function AppSplash({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg text-text" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="pulse-glow grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-fg shadow-[var(--glow-accent)]">
          <span className="text-xl font-black" aria-hidden="true">
            O
          </span>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted">Orbion</div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}

export function LoadingState({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn('flex items-center justify-center gap-3 py-10 text-sm text-muted', className)}
      role="status"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent"
        aria-hidden="true"
      />
      {label}
    </div>
  )
}
