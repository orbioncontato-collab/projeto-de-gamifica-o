import { Controller, type UseFormReturn } from 'react-hook-form'
import { FormField } from '@/components/shared/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { METRIC_LABELS, MISSION_KIND_LABELS, WHEEL_KIND_LABELS } from '@/lib/labels'
import {
  AMOUNT_METRICS,
  MISSION_KINDS,
  MISSION_METRICS,
  type MissionFormInput,
  type MissionFormValues,
} from '../schemas'
import { ParticipantsPicker } from '@/features/profiles/components/participants-picker'

type Form = UseFormReturn<MissionFormInput, unknown, MissionFormValues>

interface FieldsProps {
  form: Form
  disabled: boolean
  /** edição de missão com progresso: tipo/métrica/meta viram somente leitura (MISSION_HAS_PROGRESS) */
  lockTarget?: boolean
}

const KIND_HINTS: Record<MissionFormValues['kind'], string> = {
  daily: 'Zera todo dia: quem concluir hoje pode concluir de novo amanhã.',
  weekly: 'Conta a semana inteira (segunda a domingo).',
  special: 'Vale uma vez dentro do período informado.',
  lightning: 'Vale uma vez, com contador na tela. Máximo de 24 horas.',
}

/** Campos do editor de missão — parte 1: identificação, tipo, objetivo. */
export function MissionIdentityFields({ form, disabled, lockTarget = false }: FieldsProps) {
  const { errors } = form.formState
  const metric = form.watch('metric')
  const kind = form.watch('kind')
  const allowsAmount = AMOUNT_METRICS.includes(metric)
  return (
    <>
      <FormField label="Nome" htmlFor="mission-title" error={errors.title?.message} required>
        <Input
          id="mission-title"
          maxLength={80}
          disabled={disabled}
          autoComplete="off"
          {...form.register('title')}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Tipo"
          htmlFor="mission-kind"
          error={errors.kind?.message}
          hint={KIND_HINTS[kind]}
          required
        >
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled || lockTarget}>
                <SelectTrigger id="mission-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MISSION_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {MISSION_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          label="Objetivo (métrica)"
          htmlFor="mission-metric"
          error={errors.metric?.message}
          required
        >
          <Controller
            control={form.control}
            name="metric"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  if (!AMOUNT_METRICS.includes(v as MissionFormValues['metric']))
                    form.setValue('targetKind', 'count')
                }}
                disabled={disabled || lockTarget}
              >
                <SelectTrigger id="mission-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MISSION_METRICS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {METRIC_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          label="Medir por"
          htmlFor="mission-target-kind"
          error={errors.targetKind?.message}
          {...(allowsAmount ? {} : { hint: 'Valor em R$ só para Venda ou Upsell.' })}
        >
          <Controller
            control={form.control}
            name="targetKind"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled || lockTarget || !allowsAmount}
              >
                <SelectTrigger id="mission-target-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Quantidade</SelectItem>
                  <SelectItem value="amount">Valor em R$</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Meta" htmlFor="mission-target" error={errors.targetValue?.message} required>
          <Input
            id="mission-target"
            inputMode="decimal"
            disabled={disabled || lockTarget}
            {...form.register('targetValue')}
          />
        </FormField>
      </div>
      <FormField label="Descrição" htmlFor="mission-description" error={errors.description?.message}>
        <Textarea
          id="mission-description"
          rows={2}
          maxLength={300}
          disabled={disabled}
          {...form.register('description')}
        />
      </FormField>
    </>
  )
}

/** Campos do editor de missão — parte 2: recompensa, janela, participantes, ativa. */
export function MissionRewardFields({ form, disabled }: FieldsProps) {
  const { errors } = form.formState
  const audience = form.watch('audience')
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Pontos" htmlFor="mission-points" error={errors.rewardPoints?.message}>
          <Input
            id="mission-points"
            type="number"
            min={0}
            inputMode="numeric"
            disabled={disabled}
            {...form.register('rewardPoints')}
          />
        </FormField>
        <FormField label="Moedas" htmlFor="mission-coins" error={errors.rewardCoins?.message}>
          <Input
            id="mission-coins"
            type="number"
            min={0}
            inputMode="numeric"
            disabled={disabled}
            {...form.register('rewardCoins')}
          />
        </FormField>
        <FormField label="Giro na roleta" htmlFor="mission-spin" error={errors.rewardSpin?.message}>
          <Controller
            control={form.control}
            name="rewardSpin"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id="mission-spin">
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Início" htmlFor="mission-starts" error={errors.startsAt?.message} required>
          <Input
            id="mission-starts"
            type="datetime-local"
            disabled={disabled}
            {...form.register('startsAt')}
          />
        </FormField>
        <FormField label="Fim" htmlFor="mission-ends" error={errors.endsAt?.message} required>
          <Input id="mission-ends" type="datetime-local" disabled={disabled} {...form.register('endsAt')} />
        </FormField>
      </div>
      <FormField label="Participantes" htmlFor="mission-audience" error={errors.participantIds?.message}>
        <Controller
          control={form.control}
          name="audience"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger id="mission-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os colaboradores ativos</SelectItem>
                <SelectItem value="selected">Selecionar colaboradores</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {audience === 'selected' ? (
          <div className="mt-2">
            <Controller
              control={form.control}
              name="participantIds"
              render={({ field }) => (
                <ParticipantsPicker
                  id="mission-participants"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                />
              )}
            />
          </div>
        ) : null}
      </FormField>
      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <span className="text-sm font-semibold text-text">Missão ativa</span>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
              aria-label="Missão ativa"
            />
          </label>
        )}
      />
    </>
  )
}
