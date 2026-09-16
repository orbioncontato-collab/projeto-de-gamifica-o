import { Controller } from 'react-hook-form'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/shared/form-field'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { PersonPicker } from '@/features/profiles/components/person-picker'
import { useMe } from '@/features/auth/bootstrap-query'
import { useZodForm } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { getErrorMessage, isCode } from '@/lib/rpc-errors'
import { useRecordManualEntry } from '../hooks'
import { toManualEntryArgs } from '../entry-logic'
import { manualEntryFormSchema, type ManualEntryFormInput, type ManualEntryFormValues } from '../schemas'
import { BalanceHint } from './balance-hint'

export interface ManualEntryFormProps {
  initialProfileId?: string | undefined
}

/** Lançamento manual livre: ±pontos, motivo obrigatório, moedas opcionais (DATA-MODEL §7.4). */
export function ManualEntryForm({ initialProfileId }: ManualEntryFormProps) {
  const { seasonId } = useMe()
  const record = useRecordManualEntry()
  const form = useZodForm<ManualEntryFormInput, ManualEntryFormValues>(manualEntryFormSchema, {
    profileId: initialProfileId ?? '',
    direction: 'add',
    points: 10,
    reason: '',
    coins: '',
  })
  const { control, register, handleSubmit, watch, setError, reset, formState } = form
  const { errors } = formState
  const busy = record.isPending
  const noSeason = !seasonId
  const profileId = watch('profileId')
  const direction = watch('direction')

  const onSubmit = handleSubmit(async (values) => {
    try {
      await record.mutateAsync(toManualEntryArgs(values))
      reset({ profileId: values.profileId, direction: 'add', points: 10, reason: '', coins: '' })
    } catch (error) {
      if (isCode(error, 'POINTS_INVALID')) setError('points', { message: getErrorMessage(error) })
      else if (isCode(error, 'REASON_REQUIRED')) setError('reason', { message: getErrorMessage(error) })
      else if (isCode(error, 'NO_SEASON_FOR_DATE') || isCode(error, 'NO_ACTIVE_SEASON'))
        setError('profileId', { message: getErrorMessage(error) })
    }
  })

  return (
    <PremiumCard as="section" padding="lg">
      <SectionHeader eyebrow="Ajuste livre" title="Lançamento manual" />
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <FormField label="Colaborador" htmlFor="manual-profile" error={errors.profileId?.message} required>
          <Controller
            control={control}
            name="profileId"
            render={({ field }) => (
              <PersonPicker
                id="manual-profile"
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? '')}
                disabled={busy || noSeason}
              />
            )}
          />
          <BalanceHint profileId={profileId || null} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr]">
          <FormField label="Operação" htmlFor="manual-direction-add">
            <Controller
              control={control}
              name="direction"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Operação" className="flex gap-2">
                  <DirectionButton
                    id="manual-direction-add"
                    active={field.value === 'add'}
                    onClick={() => field.onChange('add')}
                    disabled={busy}
                    tone="add"
                  />
                  <DirectionButton
                    id="manual-direction-remove"
                    active={field.value === 'remove'}
                    onClick={() => field.onChange('remove')}
                    disabled={busy}
                    tone="remove"
                  />
                </div>
              )}
            />
          </FormField>
          <FormField label="Pontos" htmlFor="manual-points" error={errors.points?.message} required>
            <Input
              id="manual-points"
              type="number"
              min={1}
              max={100000}
              inputMode="numeric"
              disabled={busy || noSeason}
              {...register('points')}
            />
          </FormField>
          <FormField
            label="Moedas (opcional)"
            htmlFor="manual-coins"
            error={errors.coins?.message}
            hint={direction === 'add' ? 'Vazio = mesma quantidade dos pontos.' : 'Vazio = não retira moedas.'}
          >
            <Input
              id="manual-coins"
              type="number"
              min={-100000}
              max={100000}
              inputMode="numeric"
              disabled={busy || noSeason}
              {...register('coins')}
            />
          </FormField>
        </div>
        <FormField
          label="Motivo"
          htmlFor="manual-reason"
          error={errors.reason?.message}
          hint="Aparece no histórico e na carteira do colaborador."
          required
        >
          <Textarea
            id="manual-reason"
            rows={2}
            maxLength={500}
            disabled={busy || noSeason}
            {...register('reason')}
          />
        </FormField>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant={direction === 'remove' ? 'danger' : 'primary'}
            loading={busy}
            disabled={noSeason}
          >
            {direction === 'remove' ? 'Remover pontos' : 'Adicionar pontos'}
          </Button>
        </div>
      </form>
    </PremiumCard>
  )
}

interface DirectionButtonProps {
  id: string
  active: boolean
  onClick: () => void
  disabled: boolean
  tone: 'add' | 'remove'
}

function DirectionButton({ id, active, onClick, disabled, tone }: DirectionButtonProps) {
  const Icon = tone === 'add' ? Plus : Minus
  return (
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={tone === 'add' ? 'Adicionar pontos' : 'Remover pontos'}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-11 w-11 place-items-center rounded-[var(--radius-ctl)] border transition',
        active && tone === 'add' && 'border-accent bg-accent/15 text-accent',
        active && tone === 'remove' && 'border-red/40 bg-red/15 text-red-soft',
        !active && 'border-line bg-surface text-muted hover:text-text',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
