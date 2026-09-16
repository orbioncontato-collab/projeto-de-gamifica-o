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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/form-field'
import { MoneyInput } from '@/components/shared/money-input'
import { useZodForm } from '@/lib/forms'
import { getErrorMessage, isCode } from '@/lib/rpc-errors'
import { METRIC_LABELS } from '@/lib/labels'
import type { PointRuleRow } from '@/lib/database.types'
import { useSavePointRule } from '../hooks'
import { nextSortOrder, ruleFormDefaults, toRuleInsert } from '../entry-logic'
import {
  ruleFormSchema,
  RULE_METRICS,
  RULE_TRIGGERS,
  type RuleFormInput,
  type RuleFormValues,
} from '../schemas'

export interface RuleEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = nova regra */
  rule: PointRuleRow | null
  existingRules: readonly PointRuleRow[]
}

const TRIGGER_LABELS: Record<RuleFormValues['triggerKind'], string> = {
  manual: 'Manual (o gestor lança)',
  auto_amount_step: 'Automática por bloco de faturamento',
  auto_goal: 'Automática ao bater a meta mensal',
}

/** Editor de regra (admin). Upsert direto em `point_rules`; `DUPLICATE` vira erro no campo nome. */
export function RuleEditorDialog({ open, onOpenChange, rule, existingRules }: RuleEditorDialogProps) {
  const save = useSavePointRule()
  const form = useZodForm<RuleFormInput, RuleFormValues>(ruleFormSchema, ruleFormDefaults(rule))
  const { reset, setError, handleSubmit, register, control, watch, formState } = form
  const { errors } = formState

  useEffect(() => {
    if (open) reset(ruleFormDefaults(rule, nextSortOrder(existingRules)))
  }, [open, rule, existingRules, reset])

  const busy = save.isPending
  const triggerKind = watch('triggerKind')

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toRuleInsert(values, rule?.id))
      onOpenChange(false)
    } catch (error) {
      if (isCode(error, 'DUPLICATE')) setError('name', { message: 'Já existe uma regra com esse nome.' })
      else if (isCode(error, 'LEDGER_CONSTRAINT'))
        setError('triggerKind', { message: getErrorMessage(error) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent aria-describedby="rule-editor-description">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar regra' : 'Nova regra'}</DialogTitle>
          <DialogDescription id="rule-editor-description">
            Defina quantos pontos e moedas a atividade vale. Moedas são creditadas na carteira do colaborador.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="Nome" htmlFor="rule-name" error={errors.name?.message} required>
            <Input id="rule-name" maxLength={60} disabled={busy} autoComplete="off" {...register('name')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Métrica" htmlFor="rule-metric" error={errors.metric?.message} required>
              <Controller
                control={control}
                name="metric"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                    <SelectTrigger id="rule-metric">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_METRICS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {METRIC_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Tipo" htmlFor="rule-trigger" error={errors.triggerKind?.message} required>
              <Controller
                control={control}
                name="triggerKind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                    <SelectTrigger id="rule-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TRIGGERS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TRIGGER_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Pontos" htmlFor="rule-points" error={errors.points?.message} required>
              <Input
                id="rule-points"
                type="number"
                min={0}
                max={100000}
                inputMode="numeric"
                disabled={busy}
                {...register('points')}
              />
            </FormField>
            <FormField
              label="Moedas"
              htmlFor="rule-coins"
              error={errors.coins?.message}
              hint="Orb Coins creditadas por lançamento."
              required
            >
              <Input
                id="rule-coins"
                type="number"
                min={0}
                max={100000}
                inputMode="numeric"
                disabled={busy}
                {...register('coins')}
              />
            </FormField>
          </div>
          {triggerKind === 'auto_amount_step' ? (
            <FormField
              label="Valor do bloco (R$)"
              htmlFor="rule-amount-step"
              error={errors.amountStep?.message}
              hint="A cada bloco vendido, os pontos são creditados automaticamente."
              required
            >
              <Controller
                control={control}
                name="amountStep"
                render={({ field }) => (
                  <MoneyInput
                    id="rule-amount-step"
                    value={field.value as number | null}
                    onChange={field.onChange}
                    disabled={busy}
                  />
                )}
              />
            </FormField>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <SwitchField
              control={control}
              name="requiresAmount"
              id="rule-requires-amount"
              label="Exige valor em R$"
              disabled={busy}
            />
            <SwitchField
              control={control}
              name="isActive"
              id="rule-active"
              label="Regra ativa"
              disabled={busy}
            />
            <FormField label="Ordem" htmlFor="rule-sort" error={errors.sortOrder?.message}>
              <Input
                id="rule-sort"
                type="number"
                min={0}
                max={9999}
                inputMode="numeric"
                disabled={busy}
                {...register('sortOrder')}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {rule ? 'Salvar alterações' : 'Criar regra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface SwitchFieldProps {
  control: ReturnType<typeof useZodForm<RuleFormInput, RuleFormValues>>['control']
  name: 'requiresAmount' | 'isActive'
  id: string
  label: string
  disabled: boolean
}

function SwitchField({ control, name, id, label, disabled }: SwitchFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label
          htmlFor={id}
          className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface px-3 text-sm font-semibold text-text-2"
        >
          {label}
          <Switch id={id} checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
        </label>
      )}
    />
  )
}
