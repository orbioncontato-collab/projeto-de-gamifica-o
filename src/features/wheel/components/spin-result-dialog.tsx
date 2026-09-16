import { Gift, PartyPopper } from 'lucide-react'
import { PRIZE_KIND_LABELS, WHEEL_KIND_LABELS } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/shared/badge'
import type { SpinResultView } from '../spin-controller'
import { prizeValueText } from '../wheel-logic'

interface SpinResultDialogProps {
  result: SpinResultView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  approving: boolean
  rejecting: boolean
  onApprove: (spinId: string) => void
  onReject: (spinId: string) => void
}

/** Prêmio, modo (fila/livre), tipo de roleta, Mystery Box → prêmio resolvido; Aprovar/Fechar sem aprovar (admin). */
export function SpinResultDialog({
  result,
  open,
  onOpenChange,
  isAdmin,
  approving,
  rejecting,
  onApprove,
  onReject,
}: SpinResultDialogProps) {
  const busy = approving || rejecting
  const isMystery = result?.prizeKind === 'mystery'
  const valueText = result ? prizeValueText(result.resolvedKind, result.resolvedValue) : null
  const canDecide = Boolean(result && isAdmin && !result.isFree && result.spinId)

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="text-gold" aria-hidden="true" />
            {result?.isFree ? 'Giro livre' : 'Prêmio sorteado'}
          </DialogTitle>
          <DialogDescription>
            {result
              ? `${WHEEL_KIND_LABELS[result.wheelKind]} • ${result.isFree ? 'giro livre (sem crédito)' : `giro pela fila${result.attemptIndex && result.attemptsAllowed ? ` • tentativa ${result.attemptIndex} de ${result.attemptsAllowed}` : ''}`}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            {result.personName ? (
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{result.personName}</p>
            ) : null}
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 text-gold">
              <Gift size={30} aria-hidden="true" />
            </div>
            {isMystery ? <p className="text-sm text-muted">Mystery Box abriu e revelou:</p> : null}
            <p className="text-2xl font-black leading-tight text-text">{result.resolvedLabel}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge tone={result.wheelKind === 'premium' ? 'gold' : 'blue'}>
                {PRIZE_KIND_LABELS[result.resolvedKind]}
              </Badge>
              {valueText ? <Badge tone="green">{valueText}</Badge> : null}
              {isMystery ? <Badge tone="purple">Mystery Box</Badge> : null}
            </div>
            {result.isFree ? (
              <p className="rounded-xl border border-line bg-surface px-3 py-2 text-xs text-muted">
                Giro livre não gera crédito nem entra na fila. Para valer, o gestor libera um giro pela fila.
              </p>
            ) : canDecide ? (
              <p className="text-xs text-muted">
                Aprovar credita o prêmio e consome 1 tentativa. Fechar sem aprovar mantém a vez ativa.
              </p>
            ) : (
              <p className="text-xs text-muted">Aguardando aprovação do gestor.</p>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          {canDecide && result?.spinId ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                loading={rejecting}
                onClick={() => onReject(result.spinId as string)}
              >
                Fechar sem aprovar
              </Button>
              <Button
                type="button"
                disabled={busy}
                loading={approving}
                onClick={() => onApprove(result.spinId as string)}
              >
                Aprovar prêmio e concluir giro
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {result?.isFree ? 'Concluir giro livre' : 'Fechar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
