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
import { FormField } from '@/components/shared/form-field'
import { MoneyInput } from '@/components/shared/money-input'
import { useMe } from '@/features/auth/bootstrap-query'
import { useZodForm } from '@/lib/forms'
import { getErrorMessage, isCode } from '@/lib/rpc-errors'
import type { VSeason } from '@/lib/database.types'
import { useCreateSeason, useUpdateSeason } from '../hooks'
import { seasonFormDefaults, toCreateSeasonInput, toSeasonPatch } from '../season-logic'
import { seasonFormSchema, type SeasonFormInput, type SeasonFormValues } from '../schemas'

export interface SeasonEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = nova temporada */
  season: VSeason | null
}

const DATE_ERRORS = [
  'SEASON_OVERLAP',
  'SEASON_RANGE_INVALID',
  'SEASON_HAS_ENTRIES_OUTSIDE',
  'SEASON_HAS_WINDOWS_OUTSIDE',
]

/** Criar/editar temporada (admin). Datas travadas quando encerrada; erros de janela viram erro de campo. */
export function SeasonEditorDialog({ open, onOpenChange, season }: SeasonEditorDialogProps) {
  const { settings } = useMe()
  const tz = settings.timezone
  const create = useCreateSeason()
  const update = useUpdateSeason()
  const form = useZodForm<SeasonFormInput, SeasonFormValues>(seasonFormSchema, seasonFormDefaults(season, tz))
  const { register, control, handleSubmit, reset, setError, formState } = form
  const { errors } = formState

  useEffect(() => {
    if (open) reset(seasonFormDefaults(season, tz))
  }, [open, season, tz, reset])

  const busy = create.isPending || update.isPending
  const datesLocked = season?.closed_at !== null && season !== null

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (season) {
        const patch = toSeasonPatch(values, season, tz)
        if (Object.keys(patch).length > 0) await update.mutateAsync({ seasonId: season.id, patch })
      } else {
        await create.mutateAsync(toCreateSeasonInput(values))
      }
      onOpenChange(false)
    } catch (error) {
      if (DATE_ERRORS.some((c) => isCode(error, c))) setError('endsOn', { message: getErrorMessage(error) })
      else if (isCode(error, 'SEASON_NOT_STARTED')) setError('activate', { message: getErrorMessage(error) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent aria-describedby="season-editor-description">
        <DialogHeader>
          <DialogTitle>{season ? 'Editar temporada' : 'Nova temporada'}</DialogTitle>
          <DialogDescription id="season-editor-description">
            As datas são no fuso do app. Temporadas não podem se sobrepor; o fim é inclusivo (último dia).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="Nome" htmlFor="season-name" error={errors.name?.message} required>
            <Input
              id="season-name"
              maxLength={60}
              disabled={busy}
              autoComplete="off"
              placeholder="Ex.: Outubro 2026"
              {...register('name')}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Início" htmlFor="season-starts" error={errors.startsOn?.message} required>
              <Input
                id="season-starts"
                type="date"
                disabled={busy || datesLocked}
                {...register('startsOn')}
              />
            </FormField>
            <FormField label="Último dia" htmlFor="season-ends" error={errors.endsOn?.message} required>
              <Input id="season-ends" type="date" disabled={busy || datesLocked} {...register('endsOn')} />
            </FormField>
          </div>
          <FormField
            label="Meta do time (R$)"
            htmlFor="season-goal"
            error={errors.teamGoalAmount?.message}
            hint="Faturamento que o time inteiro persegue na temporada."
          >
            <Controller
              control={control}
              name="teamGoalAmount"
              render={({ field }) => (
                <MoneyInput
                  id="season-goal"
                  value={field.value as number | null}
                  onChange={(n) => field.onChange(n ?? 0)}
                  disabled={busy}
                />
              )}
            />
          </FormField>
          {season ? null : (
            <Controller
              control={control}
              name="activate"
              render={({ field }) => (
                <label
                  htmlFor="season-activate"
                  className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface px-3 py-2"
                >
                  <span>
                    <span className="block text-sm font-bold text-text">Ativar ao criar</span>
                    <span className="block text-xs text-muted">
                      Só funciona se a data de início já chegou.
                    </span>
                    {errors.activate?.message ? (
                      <span className="block text-xs font-semibold text-red-soft">
                        {errors.activate.message}
                      </span>
                    ) : null}
                  </span>
                  <Switch
                    id="season-activate"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={busy}
                  />
                </label>
              )}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {season ? 'Salvar alterações' : 'Criar temporada'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
