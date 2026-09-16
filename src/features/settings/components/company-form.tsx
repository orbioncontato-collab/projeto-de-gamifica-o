import { useEffect, useState } from 'react'
import { Controller } from 'react-hook-form'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/form-field'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { useZodForm } from '@/lib/forms'
import { getErrorMessage, isCode } from '@/lib/rpc-errors'
import type { AppSettingsRow } from '@/lib/database.types'
import { useHasLedgerEntries, useUpdateAppSettings } from '../hooks'
import { companyFormDefaults, toAppSettingsPatch } from '../season-logic'
import {
  companyFormSchema,
  TIMEZONE_OPTIONS,
  type CompanyFormInput,
  type CompanyFormValues,
} from '../schemas'

export interface CompanyFormProps {
  settings: AppSettingsRow
}

/**
 * Aba "Geral": empresa, XP por nível, metas de indicadores, `rank_admins`, fuso.
 * Fuso desabilitado quando já existe lançamento ou após `TIMEZONE_LOCKED` (DATA-MODEL §7.2, Apêndice B.18).
 */
export function CompanyForm({ settings }: CompanyFormProps) {
  const update = useUpdateAppSettings()
  const hasEntries = useHasLedgerEntries()
  const [tzLockedByError, setTzLockedByError] = useState(false)
  const form = useZodForm<CompanyFormInput, CompanyFormValues>(
    companyFormSchema,
    companyFormDefaults(settings),
  )
  const { register, control, handleSubmit, reset, setError, formState } = form
  const { errors, isDirty } = formState

  useEffect(() => {
    reset(companyFormDefaults(settings))
  }, [settings, reset])

  const busy = update.isPending
  const tzLocked = tzLockedByError || hasEntries.data === true
  const tzOptions = TIMEZONE_OPTIONS.some((o) => o.value === settings.timezone)
    ? TIMEZONE_OPTIONS
    : [{ value: settings.timezone, label: settings.timezone }, ...TIMEZONE_OPTIONS]

  const onSubmit = handleSubmit(async (values) => {
    const patch = toAppSettingsPatch(values, settings)
    if (Object.keys(patch).length === 0) return
    try {
      await update.mutateAsync(patch)
    } catch (error) {
      if (isCode(error, 'TIMEZONE_LOCKED')) {
        setTzLockedByError(true)
        setError('timezone', { message: getErrorMessage(error) })
      } else if (isCode(error, 'INVALID_TIMEZONE')) setError('timezone', { message: getErrorMessage(error) })
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <PremiumCard as="section" padding="lg">
        <SectionHeader eyebrow="Empresa" title="Identidade e progressão" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField
            label="Nome da empresa"
            htmlFor="company-name"
            error={errors.companyName?.message}
            required
          >
            <Input
              id="company-name"
              maxLength={80}
              disabled={busy}
              autoComplete="organization"
              {...register('companyName')}
            />
          </FormField>
          <FormField
            label="XP por nível"
            htmlFor="company-xp"
            error={errors.xpPerLevel?.message}
            hint="Pontos para subir um nível. Vale para as próximas temporadas."
            required
          >
            <Input
              id="company-xp"
              type="number"
              min={50}
              max={100000}
              inputMode="numeric"
              disabled={busy}
              {...register('xpPerLevel')}
            />
          </FormField>
          <FormField
            label="Fuso horário"
            htmlFor="company-timezone"
            error={errors.timezone?.message}
            hint={
              tzLocked
                ? 'Trava após o primeiro lançamento.'
                : 'Define o "dia" de streaks, missões e temporadas. Trava após o primeiro lançamento.'
            }
          >
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={busy || tzLocked || hasEntries.isPending}
                >
                  <SelectTrigger
                    id="company-timezone"
                    aria-describedby={tzLocked ? 'company-timezone-lock' : undefined}
                  >
                    {tzLocked ? <Lock className="h-3.5 w-3.5 text-muted-2" aria-hidden="true" /> : null}
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tzOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {tzLocked ? (
              <span id="company-timezone-lock" className="sr-only">
                Fuso travado: já existem lançamentos.
              </span>
            ) : null}
          </FormField>
          <Controller
            control={control}
            name="rankAdmins"
            render={({ field }) => (
              <label
                htmlFor="company-rank-admins"
                className="flex min-h-11 items-center justify-between gap-3 self-end rounded-[var(--radius-ctl)] border border-line bg-surface px-3 py-2"
              >
                <span>
                  <span className="block text-sm font-bold text-text">Gestores participam do ranking</span>
                  <span className="block text-xs text-muted">
                    Desligado: gestores ficam fora do pódio e da lista.
                  </span>
                </span>
                <Switch
                  id="company-rank-admins"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={busy}
                />
              </label>
            )}
          />
        </div>
      </PremiumCard>

      <PremiumCard as="section" padding="lg">
        <SectionHeader eyebrow="Indicadores" title="Metas do painel" />
        <p className="mt-1 text-sm text-muted">
          Referências usadas nos indicadores de saúde do dashboard administrativo.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FormField
            label="Conversão (%)"
            htmlFor="target-conversion"
            error={errors.targetConversionPct?.message}
          >
            <Input
              id="target-conversion"
              type="number"
              min={0}
              max={100}
              step="0.5"
              inputMode="decimal"
              disabled={busy}
              {...register('targetConversionPct')}
            />
          </FormField>
          <FormField
            label="Comparecimento (%)"
            htmlFor="target-attendance"
            error={errors.targetAttendancePct?.message}
          >
            <Input
              id="target-attendance"
              type="number"
              min={0}
              max={100}
              step="0.5"
              inputMode="decimal"
              disabled={busy}
              {...register('targetAttendancePct')}
            />
          </FormField>
          <FormField label="CRM atualizado (%)" htmlFor="target-crm" error={errors.targetCrmPct?.message}>
            <Input
              id="target-crm"
              type="number"
              min={0}
              max={100}
              step="0.5"
              inputMode="decimal"
              disabled={busy}
              {...register('targetCrmPct')}
            />
          </FormField>
          <FormField
            label="Atividades no mês"
            htmlFor="target-activities"
            error={errors.targetActivitiesCount?.message}
          >
            <Input
              id="target-activities"
              type="number"
              min={0}
              inputMode="numeric"
              disabled={busy}
              {...register('targetActivitiesCount')}
            />
          </FormField>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={busy} disabled={!isDirty}>
            Salvar configurações
          </Button>
        </div>
      </PremiumCard>
    </form>
  )
}
