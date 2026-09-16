import { useState, type KeyboardEvent } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => Promise<void> | void
  loading?: boolean
}

/** Confirmação destrutiva/importante (AlertDialog); `Enter` confirma, `Esc` cancela. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const isBusy = busy || loading

  const confirm = async () => {
    if (isBusy) return
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !isBusy) {
      e.preventDefault()
      void confirm()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !isBusy && onOpenChange(v)}>
      <AlertDialogContent onKeyDown={onKeyDown}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>{cancelLabel}</AlertDialogCancel>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={isBusy}
            onClick={() => void confirm()}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
