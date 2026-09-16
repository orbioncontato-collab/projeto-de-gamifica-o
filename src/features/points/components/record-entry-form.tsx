import { useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/form-field'
import { MoneyInput } from '@/components/shared/money-input'
import { PremiumCard } from '@/components/shared/premium-card'
import { EmptyState } from '@/components/shared/empty-state'
import { CardSkeleton } from '@/components/shared/skeletons'
import { ErrorState } from '@/components/shared/error-state'
import { PersonPicker } from '@/features/profiles/components/person-picker'
import { useMe } from '@/features/auth/bootstrap-query'
import { useZodForm } from '@/lib/forms'
import { formatCoins, formatPoints } from '@/lib/format'
import { METRIC_LABELS } from '@/lib/labels'
import { getErrorMessage, isCode } from '@/lib/rpc-errors'
import { usePointRules, useRecordRuleEntry } from '../hooks'
import {
  checkOccurredAt,
  nowLocalValue,
  previewRuleEntry,
  selectableRules,
  toRuleEntryArgs,
} from '../entry-logic'
import { ruleEntryFormSchema, type RuleEntryFormInput, type RuleEntryFormValues } from '../schemas'
import { BalanceHint } from './balance-hint'

export interface RecordEntryFormProps {
  /** pré-seleção via `?perfil=` */
  initialProfileId?: string | undefined
}

/** Lançar por regra: colaborador (com saldo), regra manual, quantidade, valor R$ quando `requires_amount`, data ≤ 90 dias, motivo. */
export function RecordEntryForm({ initialProfileId }: RecordEntryFormProps) {
  const { settings, seasonId } = useMe()
  const tz = settings.timezone
  const rulesQuery = usePointRules({ includeInactive: false })
  const record = useRecordRuleEntry()
  const form = useZodForm<RuleEntryFormInput, RuleEntryFormValues>(ruleEntryFormSchema, {
    profileId: initialProfileId ?? '',
    ruleId: '',
    quantity: 1,
    amount: null,
    occurredAt: nowLocalValue(tz),
    reason: '',
  })
  const { control, register, handleSubmit, watch, setError, reset, formState } = form
  const { errors } = formState

  useEffect(() => {
    if (initialProfileId) form.setValue('profileId', initialProfileId)
  }, [initialProfileId, form])

  const rules = selectableRules(rulesQuery.data ?? [])
  const ruleId = watch('ruleId')
  const profileId = watch('profileId')
  const quantity = Number(watch('quantity'))
  const rule = rules.find((r) => r.id === ruleId) ?? null
  const preview = previewRuleEntry(rule, quantity)
  const busy = record.isPending
  const noSeason = !seasonId

  const onSubmit = handleSubmit(async (values) => {
    const when = checkOccurredAt(values.occurredAt, tz)
    if (!when.ok) {
      setError('occurredAt', { message: when.message })
      return
    }
    if (rule?.requires_amount && (values.amount === null || values.amount <= 0)) {
      setError('amount', { message: 'Esta regra exige o valor em R$.' })
      return
    }
    try {
      await record.mutateAsync(toRuleEntryArgs(values, when.iso))
      reset({
        profileId: values.profileId,
        ruleId: '',
        quantity: 1,
        amount: null,
        occurredAt: nowLocalValue(tz),
        reason: '',
      })
    } catch (error) {
      if (
        isCode(error, 'OCCURRED_AT_INVALID') ||
        isCode(error, 'NO_SEASON_FOR_DATE') ||
        isCode(error, 'SEASON_CLOSED')
      )
        setError('occurredAt', { message: getErrorMessage(error) })
      else if (isCode(error, 'MILESTONE_ALREADY_AWARDED') || isCode(error, 'RULE_NOT_FOUND'))
        setError('ruleId', { message: getErrorMessage(error) })
      else if (isCode(error, 'AMOUNT_REQUIRED')) setError('amount', { message: getErrorMessage(error) })
      else if (isCode(error, 'QUANTITY_INVALID') || isCode(error, 'POINTS_INVALID'))
        setError('quantity', { message: getErrorMessage(error) })
    }
  })

  if (rulesQuery.isPending) return <CardSkeleton lines={6} />
  if (rulesQuery.isError)
    return <ErrorState error={rulesQuery.error} onRetry={() => void rulesQuery.refetch()} />
  if (rules.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nenhuma regra manual ativa"
        description="Crie ou ative uma regra na aba Regras para lançar pontos por atividade."
        action={{ label: 'Ir para Regras', to: '/admin/pontuacao', search: { aba: 'regras' } }}
      />
    )
  }

  return (
    <PremiumCard as="section" padding="lg">
      {noSeason ? (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-[var(--radius-ctl)] border border-red/25 bg-red/10 px-3 py-2 text-sm text-red-soft"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Sem temporada ativa: os lançamentos ficam desabilitados.{' '}
            <Link to="/admin/configuracoes" search={{ aba: 'temporadas' }} className="font-bold underline">
              Criar/ativar temporada
            </Link>
          </span>
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Colaborador" htmlFor="entry-profile" error={errors.profileId?.message} required>
            <Controller
              control={control}
              name="profileId"
              render={({ field }) => (
                <PersonPicker
                  id="entry-profile"
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  disabled={busy || noSeason}
                />
              )}
            />
            <BalanceHint profileId={profileId || null} />
          </FormField>
          <FormField label="Regra" htmlFor="entry-rule" error={errors.ruleId?.message} required>
            <Controller
              control={control}
              name="ruleId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={busy || noSeason}>
                  <SelectTrigger id="entry-rule">
                    <SelectValue placeholder="Selecione a regra" />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} · {formatPoints(r.points)} · {METRIC_LABELS[r.metric]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Quantidade" htmlFor="entry-quantity" error={errors.quantity?.message} required>
            <Input
              id="entry-quantity"
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              disabled={busy || noSeason}
              {...register('quantity')}
            />
          </FormField>
          <FormField
            label="Valor (R$)"
            htmlFor="entry-amount"
            error={errors.amount?.message}
            hint={rule?.requires_amount ? 'Obrigatório para esta regra.' : 'Opcional.'}
            required={rule?.requires_amount === true}
          >
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <MoneyInput
                  id="entry-amount"
                  value={field.value as number | null}
                  onChange={field.onChange}
                  disabled={busy || noSeason}
                />
              )}
            />
          </FormField>
          <FormField
            label="Data e hora"
            htmlFor="entry-occurred-at"
            error={errors.occurredAt?.message}
            hint="Até 90 dias atrás."
            required
          >
            <Input
              id="entry-occurred-at"
              type="datetime-local"
              disabled={busy || noSeason}
              {...register('occurredAt')}
            />
          </FormField>
        </div>
        <FormField label="Motivo (opcional)" htmlFor="entry-reason" error={errors.reason?.message}>
          <Textarea
            id="entry-reason"
            rows={2}
            maxLength={500}
            disabled={busy || noSeason}
            {...register('reason')}
          />
        </FormField>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted" aria-live="polite">
            Prévia: <span className="font-black text-accent">{formatPoints(preview.points)}</span>
            <span className="mx-2 text-muted-2">·</span>
            <span className="text-gold">{formatCoins(preview.coins)}</span>
            <span className="ml-1 text-xs text-muted-2">(sem multiplicador de evento)</span>
          </p>
          <Button type="submit" loading={busy} disabled={noSeason}>
            Lançar pontos
          </Button>
        </div>
      </form>
    </PremiumCard>
  )
}
