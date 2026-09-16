import { useEffect, useState } from 'react'
import { formatCoins } from '@/lib/format'
import type { VRedemption } from '@/lib/database.types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/shared/form-field'
import type { RedemptionAction } from '../api'
import { useHandleRedemption } from '../hooks'
import { REDEMPTION_ACTION_LABELS } from '../rewards-utils'

export interface HandleRedemptionDialogProps {
  target: { row: VRedemption; action: RedemptionAction } | null
  onClose: () => void
}

export const NOTES_MAX = 500

const COPY: Record<
  RedemptionAction,
  { title: string; description: (r: VRedemption) => string; hint: string }
> = {
  approve: {
    title: 'Aprovar pedido',
    description: (r) => `${r.person_name} vai ser avisado que "${r.title}" foi aprovado.`,
    hint: 'Opcional — ex.: “Entrego na sexta”.',
  },
  deliver: {
    title: 'Marcar como entregue',
    description: (r) =>
      `Confirma a entrega de "${r.title}" para ${r.person_name}. Entra em “Recompensas entregues”.`,
    hint: 'Opcional — ex.: “Entregue no PIX 12/09”.',
  },
  cancel: {
    title: 'Cancelar pedido',
    description: (r) =>
      r.cost_coins > 0
        ? `${formatCoins(r.cost_coins)} voltam para ${r.person_name} e o estoque é devolvido.`
        : `O prêmio "${r.title}" de ${r.person_name} será cancelado.`,
    hint: 'Motivo — ex.: “Sem estoque no fornecedor”.',
  },
}

/** Aprovar / entregar / cancelar com notas (DATA-MODEL §7.7 `handle_redemption`). */
export function HandleRedemptionDialog({ target, onClose }: HandleRedemptionDialogProps) {
  const handle = useHandleRedemption()
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (target) setNotes('')
  }, [target])

  const submit = async () => {
    if (!target) return
    const trimmed = notes.trim()
    const ok = await handle
      .mutateAsync({ id: target.row.redemption_id, action: target.action, notes: trimmed ? trimmed : null })
      .then(
        () => true,
        () => false,
      )
    if (ok) onClose()
  }
  const copy = target ? COPY[target.action] : null

  return (
    <Dialog open={target !== null} onOpenChange={(v) => !v && !handle.isPending && onClose()}>
      <DialogContent>
        {target && copy ? (
          <>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description(target.row)}</DialogDescription>
            </DialogHeader>
            <FormField label="Notas para o colaborador" htmlFor="redemption-notes" hint={copy.hint}>
              <Textarea
                id="redemption-notes"
                value={notes}
                maxLength={NOTES_MAX}
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose} disabled={handle.isPending}>
                Voltar
              </Button>
              <Button
                type="button"
                variant={target.action === 'cancel' ? 'danger' : 'primary'}
                loading={handle.isPending}
                onClick={() => void submit()}
              >
                {REDEMPTION_ACTION_LABELS[target.action]}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
