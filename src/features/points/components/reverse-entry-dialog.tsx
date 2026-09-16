import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/shared/form-field'
import { useMe } from '@/features/auth/bootstrap-query'
import { useZodForm } from '@/lib/forms'
import { formatDateTime, formatPoints } from '@/lib/format'
import { getErrorMessage, isCode } from '@/lib/rpc-errors'
import type { VPointEntryHistory } from '@/lib/database.types'
import { useReverseEntry } from '../hooks'
import { reverseFormSchema, type ReverseFormInput, type ReverseFormValues } from '../schemas'

export interface ReverseEntryDialogProps {
  entry: VPointEntryHistory | null
  onOpenChange: (open: boolean) => void
}

const BLOCKING_CODES = [
  'ALREADY_REVERSED',
  'CANNOT_REVERSE_REVERSAL',
  'USE_HANDLE_REDEMPTION',
  'ENTRY_NOT_FOUND',
]

/** Estorno com motivo obrigatório: insere linha com sinais invertidos (DATA-MODEL §7.4 `reverse_entry`). */
export function ReverseEntryDialog({ entry, onOpenChange }: ReverseEntryDialogProps) {
  const { settings } = useMe()
  const reverse = useReverseEntry()
  const form = useZodForm<ReverseFormInput, ReverseFormValues>(reverseFormSchema, { reason: '' })
  const { register, handleSubmit, reset, setError, formState } = form
  const open = entry !== null
  const busy = reverse.isPending

  useEffect(() => {
    if (open) reset({ reason: '' })
  }, [open, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!entry) return
    try {
      await reverse.mutateAsync({ entryId: entry.entry_id, reason: values.reason })
      onOpenChange(false)
    } catch (error) {
      if (BLOCKING_CODES.some((c) => isCode(error, c)))
        setError('reason', { message: getErrorMessage(error) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent aria-describedby="reverse-entry-description">
        <DialogHeader>
          <DialogTitle>Estornar lançamento?</DialogTitle>
          <DialogDescription id="reverse-entry-description">
            {entry
              ? `${entry.full_name} · ${formatPoints(entry.points)} em ${formatDateTime(entry.occurred_at, settings.timezone)}. O estorno cria um lançamento inverso (pontos e moedas) na mesma data do fato.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            label="Motivo do estorno"
            htmlFor="reverse-reason"
            error={formState.errors.reason?.message}
            required
          >
            <Textarea
              id="reverse-reason"
              rows={3}
              maxLength={500}
              disabled={busy}
              autoFocus
              {...register('reason')}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Estornar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
