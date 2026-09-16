import { useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/shared/form-field'
import { useMe } from '@/features/auth/bootstrap-query'
import { useZodForm } from '@/lib/forms'
import { getErrorMessage, isCode } from '@/lib/rpc-errors'
import type { VSpecialEvent } from '@/lib/database.types'
import { useSaveSpecialEvent } from '../hooks'
import { eventFormDefaults, toSaveSpecialEventInput } from '../season-logic'
import {
  eventFormSchema,
  EVENT_MULTIPLIER_MAX,
  EVENT_MULTIPLIER_MIN,
  type EventFormInput,
  type EventFormValues,
} from '../schemas'

export interface SpecialEventEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = novo evento */
  event: VSpecialEvent | null
}

/** Criar/editar evento especial via `save_special_event`; `EVENT_OVERLAP`/`EVENT_RANGE_INVALID` viram erro de campo. */
export function SpecialEventEditorDialog({ open, onOpenChange, event }: SpecialEventEditorDialogProps) {
  const { settings } = useMe()
  const tz = settings.timezone
  const save = useSaveSpecialEvent()
  const form = useZodForm<EventFormInput, EventFormValues>(eventFormSchema, eventFormDefaults(event, tz))
  const { register, control, handleSubmit, reset, setError, formState } = form
  const { errors } = formState

  useEffect(() => {
    if (open) reset(eventFormDefaults(event, tz))
  }, [open, event, tz, reset])

  const busy = save.isPending

  const onSubmit = handleSubmit(async (values) => {
    const check = toSaveSpecialEventInput(values, tz, event?.id)
    if (!check.ok) {
      setError(check.field, { message: check.message })
      return
    }
    try {
      await save.mutateAsync(check.input)
      onOpenChange(false)
    } catch (error) {
      if (isCode(error, 'EVENT_OVERLAP')) setError('startsAt', { message: getErrorMessage(error) })
      else if (isCode(error, 'EVENT_RANGE_INVALID')) setError('endsAt', { message: getErrorMessage(error) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent aria-describedby="event-editor-description">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar evento especial' : 'Novo evento especial'}</DialogTitle>
          <DialogDescription id="event-editor-description">
            Durante a janela, os pontos de todo lançamento são multiplicados. Moedas não mudam. Eventos ativos
            não podem se sobrepor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="Nome" htmlFor="event-name" error={errors.name?.message} required>
            <Input
              id="event-name"
              maxLength={60}
              disabled={busy}
              autoComplete="off"
              placeholder="Ex.: Semana 2x"
              {...register('name')}
            />
          </FormField>
          <FormField
            label="Descrição (opcional)"
            htmlFor="event-description"
            error={errors.description?.message}
          >
            <Textarea
              id="event-description"
              rows={2}
              maxLength={300}
              disabled={busy}
              {...register('description')}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label="Multiplicador"
              htmlFor="event-multiplier"
              error={errors.multiplier?.message}
              hint={`Entre ${EVENT_MULTIPLIER_MIN}x e ${EVENT_MULTIPLIER_MAX}x.`}
              required
            >
              <Input
                id="event-multiplier"
                type="number"
                step="0.1"
                min={EVENT_MULTIPLIER_MIN}
                max={EVENT_MULTIPLIER_MAX}
                inputMode="decimal"
                disabled={busy}
                {...register('multiplier')}
              />
            </FormField>
            <FormField label="Início" htmlFor="event-starts" error={errors.startsAt?.message} required>
              <Input id="event-starts" type="datetime-local" disabled={busy} {...register('startsAt')} />
            </FormField>
            <FormField label="Fim" htmlFor="event-ends" error={errors.endsAt?.message} required>
              <Input id="event-ends" type="datetime-local" disabled={busy} {...register('endsAt')} />
            </FormField>
          </div>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label
                htmlFor="event-active"
                className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface px-3 py-2"
              >
                <span>
                  <span className="block text-sm font-bold text-text">Evento ativo</span>
                  <span className="block text-xs text-muted">
                    Desligado: fica salvo mas não multiplica nem aparece no banner.
                  </span>
                </span>
                <Switch
                  id="event-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={busy}
                />
              </label>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {event ? 'Salvar alterações' : 'Criar evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
