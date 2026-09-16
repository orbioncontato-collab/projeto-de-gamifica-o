import { useState } from 'react'
import { Controller } from 'react-hook-form'
import { Lock, LockOpen, UserPlus } from 'lucide-react'
import type { WheelKind } from '@/lib/database.types'
import { WHEEL_KIND_LABELS } from '@/lib/labels'
import { useZodForm } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { FormField } from '@/components/shared/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useActiveProfiles } from '@/features/profiles/hooks'
import { WHEEL_KINDS } from '../api'
import { useEnqueue } from '../hooks'
import {
  MAX_ATTEMPTS,
  MIN_ATTEMPTS,
  queueAddSchema,
  type QueueAddInput,
  type QueueAddValues,
} from '../schemas'

interface QueueAddFormProps {
  defaultWheelKind: WheelKind
  compact?: boolean
  onAdded?: () => void
}

/** Adicionar colaborador cadastrado OU convidado (nome manual), roleta e tentativas (cadeado destrava até 20). */
export function QueueAddForm({ defaultWheelKind, compact = false, onAdded }: QueueAddFormProps) {
  const profiles = useActiveProfiles()
  const enqueue = useEnqueue()
  const [unlocked, setUnlocked] = useState(false)
  const form = useZodForm<QueueAddInput, QueueAddValues>(queueAddSchema, {
    mode: 'collaborator',
    profileId: '',
    personName: '',
    wheelKind: defaultWheelKind,
    attempts: MIN_ATTEMPTS,
  })
  const mode = form.watch('mode')
  const idPrefix = compact ? 'qq' : 'qf'

  const submit = form.handleSubmit(async (values) => {
    try {
      await enqueue.mutateAsync({
        profileId: values.mode === 'collaborator' ? (values.profileId ?? null) : null,
        personName: values.mode === 'guest' ? (values.personName ?? null) : null,
        wheelKind: values.wheelKind,
        attempts: values.attempts,
      })
    } catch {
      return // toast global (MutationCache) já mostrou a mensagem do catálogo
    }
    form.reset({
      mode: values.mode,
      profileId: '',
      personName: '',
      wheelKind: values.wheelKind,
      attempts: MIN_ATTEMPTS,
    })
    setUnlocked(false)
    onAdded?.()
  })

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className={cn('grid gap-3', compact ? 'md:grid-cols-[1fr_auto_auto_auto]' : 'md:grid-cols-2')}
      noValidate
    >
      <div className={cn('flex flex-col gap-2', compact ? '' : 'md:col-span-2')}>
        <div
          role="radiogroup"
          aria-label="Tipo de participante"
          className="flex gap-1 rounded-xl border border-line bg-surface p-1"
        >
          {(['collaborator', 'guest'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => form.setValue('mode', m, { shouldValidate: false })}
              className={cn(
                'h-9 flex-1 rounded-lg text-[0.7rem] font-black uppercase tracking-wider transition',
                mode === m ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text',
              )}
            >
              {m === 'collaborator' ? 'Colaborador' : 'Convidado'}
            </button>
          ))}
        </div>
        {mode === 'collaborator' ? (
          <FormField
            label="Colaborador"
            htmlFor={`${idPrefix}-profile`}
            error={form.formState.errors.profileId?.message}
            required
          >
            <Controller
              control={form.control}
              name="profileId"
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  disabled={profiles.isPending}
                >
                  <SelectTrigger id={`${idPrefix}-profile`} className="h-11">
                    <SelectValue
                      placeholder={
                        profiles.isPending
                          ? 'Carregando…'
                          : profiles.isError
                            ? 'Erro ao carregar'
                            : 'Escolha um colaborador'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(profiles.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                    {profiles.data?.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted">Nenhum colaborador ativo.</div>
                    ) : null}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        ) : (
          <FormField
            label="Nome do convidado"
            htmlFor={`${idPrefix}-guest`}
            error={form.formState.errors.personName?.message}
            required
          >
            <Input
              id={`${idPrefix}-guest`}
              placeholder="Ex.: cliente visitante"
              maxLength={80}
              {...form.register('personName')}
            />
          </FormField>
        )}
      </div>

      <FormField label="Roleta" htmlFor={`${idPrefix}-wheel`}>
        <Controller
          control={form.control}
          name="wheelKind"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-wheel`} className="h-11 md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WHEEL_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {WHEEL_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      <FormField
        label="Tentativas"
        htmlFor={`${idPrefix}-attempts`}
        error={form.formState.errors.attempts?.message}
        {...(unlocked ? { hint: `De ${MIN_ATTEMPTS} a ${MAX_ATTEMPTS}` } : {})}
      >
        <div className="flex items-center gap-1">
          <Input
            id={`${idPrefix}-attempts`}
            type="number"
            inputMode="numeric"
            min={MIN_ATTEMPTS}
            max={MAX_ATTEMPTS}
            disabled={!unlocked}
            className="w-20 text-center"
            {...form.register('attempts')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={unlocked}
            aria-label={unlocked ? 'Travar tentativas' : 'Destravar tentativas'}
            onClick={() => setUnlocked((v) => !v)}
          >
            {unlocked ? <LockOpen /> : <Lock />}
          </Button>
        </div>
      </FormField>

      <div className={cn('flex items-end', compact ? '' : 'md:col-span-2')}>
        <Button type="submit" className="w-full md:w-auto" loading={enqueue.isPending}>
          <UserPlus aria-hidden="true" /> Adicionar à fila
        </Button>
      </div>
    </form>
  )
}
