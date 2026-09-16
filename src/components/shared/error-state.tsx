import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/rpc-errors'

export interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  compact?: boolean
  title?: string
  className?: string
}

/** Erro de query com mensagem do catálogo e "Tentar novamente". */
export function ErrorState({
  error,
  onRetry,
  compact = false,
  title = 'Não foi possível carregar',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-red/25 bg-red/10 text-center',
        compact ? 'gap-2 px-4 py-5' : 'gap-3 px-6 py-10',
        className,
      )}
    >
      <div
        className={cn(
          'grid place-items-center rounded-2xl bg-red/15 text-red-soft',
          compact ? 'h-9 w-9' : 'h-12 w-12',
        )}
      >
        <AlertTriangle className={compact ? 'h-4 w-4' : 'h-6 w-6'} aria-hidden="true" />
      </div>
      <p className={cn('font-black text-text', compact ? 'text-sm' : 'text-base')}>{title}</p>
      <p className="max-w-md text-sm text-muted">{getErrorMessage(error)}</p>
      {onRetry ? (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  )
}
