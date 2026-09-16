import { Controller, type UseFormReturn } from 'react-hook-form'
import { FormField } from '@/components/shared/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CHALLENGE_KIND_LABELS, CHALLENGE_METRIC_LABELS, WHEEL_KIND_LABELS } from '@/lib/labels'
import {
  CHALLENGE_KINDS,
  CHALLENGE_METRICS,
  DUEL_SIZE,
  type ChallengeFormInput,
  type ChallengeFormValues,
} from '../schemas'
import { ParticipantsPicker } from '@/features/profiles/components/participants-picker'

type Form = UseFormReturn<ChallengeFormInput, unknown, ChallengeFormValues>

interface FieldsProps {
  form: Form
  disabled: boolean
}

const METRIC_HINTS: Record<ChallengeFormValues['metric'], string> = {
  meetings_held: 'Conta reuniões realizadas lançadas no período.',
  sales_count: 'Conta vendas lançadas no período.',
  revenue: 'Soma o valor em R$ de vendas e upsells no período.',
  points: 'Soma os pontos ganhos no período (exceto resgates).',
  activities: 'Conta atividades lançadas por regra ou manualmente.',
}

/** Campos do editor de desafio — parte 1: nome, tipo, métrica, objetivo, descrição. */
export function ChallengeIdentityFields({ form, disabled }: FieldsProps) {
  const { errors } = form.formState
  const metric = form.watch('metric')
  const kind = form.watch('kind')
  return (
    <>
      <FormField label="Nome" htmlFor="challenge-name" error={errors.name?.message} required>
        <Input
          id="challenge-name"
          maxLength={80}
          disabled={disabled}
          autoComplete="off"
          {...form.register('name')}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Tipo"
          htmlFor="challenge-kind"
          error={errors.kind?.message}
          hint={
            kind === 'duel' ? 'Dois colaboradores, o maior valor vence.' : 'O time soma para bater a meta.'
          }
          required
        >
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  if (v === 'duel')
                    form.setValue('participantIds', form.getValues('participantIds').slice(0, DUEL_SIZE))
                }}
                disabled={disabled}
              >
                <SelectTrigger id="challenge-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHALLENGE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {CHALLENGE_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          label="Métrica"
          htmlFor="challenge-metric"
          error={errors.metric?.message}
          hint={METRIC_HINTS[metric]}
          required
        >
          <Controller
            control={form.control}
            name="metric"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id="challenge-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHALLENGE_METRICS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {CHALLENGE_METRIC_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>
      <FormField
        label={kind === 'duel' ? 'Objetivo (referência da barra)' : 'Meta do time'}
        htmlFor="challenge-target"
        error={errors.targetValue?.message}
        {...(metric === 'revenue' ? { hint: 'Em reais, ex.: 50.000' } : {})}
        required
      >
        <Input
          id="challenge-target"
          inputMode="decimal"
          disabled={disabled}
          {...form.register('targetValue')}
        />
      </FormField>
      <FormField label="Descrição" htmlFor="challenge-description" error={errors.description?.message}>
        <Textarea
          id="challenge-description"
          rows={2}
          maxLength={300}
          disabled={disabled}
          {...form.register('description')}
        />
      </FormField>
    </>
  )
}

/** Campos do editor de desafio — parte 2: prêmio, período, participantes. */
export function ChallengeRewardFields({ form, disabled }: FieldsProps) {
  const { errors } = form.formState
  const kind = form.watch('kind')
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Pontos" htmlFor="challenge-points" error={errors.rewardPoints?.message}>
          <Input
            id="challenge-points"
            type="number"
            min={0}
            inputMode="numeric"
            disabled={disabled}
            {...form.register('rewardPoints')}
          />
        </FormField>
        <FormField label="Moedas" htmlFor="challenge-coins" error={errors.rewardCoins?.message}>
          <Input
            id="challenge-coins"
            type="number"
            min={0}
            inputMode="numeric"
            disabled={disabled}
            {...form.register('rewardCoins')}
          />
        </FormField>
        <FormField label="Giro na roleta" htmlFor="challenge-spin" error={errors.rewardSpin?.message}>
          <Controller
            control={form.control}
            name="rewardSpin"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id="challenge-spin">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem giro</SelectItem>
                  <SelectItem value="classic">{WHEEL_KIND_LABELS.classic}</SelectItem>
                  <SelectItem value="premium">{WHEEL_KIND_LABELS.premium}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>
      <FormField
        label="Texto do prêmio"
        htmlFor="challenge-reward-description"
        error={errors.rewardDescription?.message}
        hint="Opcional. Ex.: Roleta Premium para todos."
      >
        <Input
          id="challenge-reward-description"
          maxLength={120}
          disabled={disabled}
          {...form.register('rewardDescription')}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Início" htmlFor="challenge-starts" error={errors.startsAt?.message} required>
          <Input
            id="challenge-starts"
            type="datetime-local"
            disabled={disabled}
            {...form.register('startsAt')}
          />
        </FormField>
        <FormField label="Fim" htmlFor="challenge-ends" error={errors.endsAt?.message} required>
          <Input id="challenge-ends" type="datetime-local" disabled={disabled} {...form.register('endsAt')} />
        </FormField>
      </div>
      <FormField
        label="Participantes"
        htmlFor="challenge-participants"
        error={errors.participantIds?.message}
        hint={
          kind === 'duel'
            ? 'Exatamente 2 colaboradores.'
            : 'Deixe vazio para incluir todos os colaboradores ativos.'
        }
        required={kind === 'duel'}
      >
        <Controller
          control={form.control}
          name="participantIds"
          render={({ field }) => (
            <ParticipantsPicker
              id="challenge-participants"
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
              {...(kind === 'duel' ? { max: DUEL_SIZE } : {})}
            />
          )}
        />
      </FormField>
    </>
  )
}
