import { Controller, type UseFormReturn } from 'react-hook-form'
import type { VProfileStats } from '@/lib/database.types'
import { JOB_TITLE_LABELS, USER_ROLE_LABELS } from '@/lib/labels'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/shared/form-field'
import { MoneyInput } from '@/components/shared/money-input'
import { JOB_TITLES, USER_ROLES, type CollaboratorFormInput, type CollaboratorFormOutput } from '../schemas'

export interface CollaboratorFormFieldsProps {
  form: UseFormReturn<CollaboratorFormInput, unknown, CollaboratorFormOutput>
  profile: VProfileStats
  disabled: boolean
}

/** Campos do editor (FEATURE §11): nome, e-mail, cargo, status, equipe, telefone, meta individual, papel; nível só leitura. */
export function CollaboratorFormFields({ form, profile, disabled }: CollaboratorFormFieldsProps) {
  const { errors } = form.formState
  const isPending = profile.status === 'pending'
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Nome" htmlFor="collab-name" error={errors.full_name?.message} required>
          <Input id="collab-name" maxLength={80} disabled={disabled} {...form.register('full_name')} />
        </FormField>
        <FormField
          label="E-mail"
          htmlFor="collab-email"
          error={errors.email?.message}
          required
          hint="Não altera o e-mail de login"
        >
          <Input
            id="collab-email"
            type="email"
            inputMode="email"
            disabled={disabled}
            {...form.register('email')}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Cargo" htmlFor="collab-job" error={errors.job_title?.message}>
          <Controller
            control={form.control}
            name="job_title"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id="collab-job">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map((j) => (
                    <SelectItem key={j} value={j}>
                      {JOB_TITLE_LABELS[j]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          label="Papel"
          htmlFor="collab-role"
          error={errors.role?.message}
          hint="Gestor administra a plataforma"
        >
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id="collab-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {USER_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          label="Status"
          htmlFor="collab-status"
          error={errors.status?.message}
          {...(isPending ? { hint: 'Pendente: aprove ou recuse na seção Pendentes' } : {})}
        >
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled || isPending}>
                <SelectTrigger id="collab-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Equipe" htmlFor="collab-team" error={errors.team?.message} hint="Opcional">
          <Input id="collab-team" maxLength={40} disabled={disabled} {...form.register('team')} />
        </FormField>
        <FormField label="Telefone" htmlFor="collab-phone" error={errors.phone?.message} hint="Opcional">
          <Input
            id="collab-phone"
            type="tel"
            inputMode="tel"
            maxLength={30}
            disabled={disabled}
            {...form.register('phone')}
          />
        </FormField>
        <FormField
          label="Meta individual (R$)"
          htmlFor="collab-goal"
          error={errors.goal_amount?.message}
          hint="Temporada atual"
        >
          <Controller
            control={form.control}
            name="goal_amount"
            render={({ field }) => (
              <MoneyInput
                id="collab-goal"
                value={typeof field.value === 'number' ? field.value : null}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputMode="decimal"
                disabled={disabled}
              />
            )}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <FormField label="Nível" htmlFor="collab-level" hint="Derivado dos pontos">
          <Input id="collab-level" value={String(profile.level)} readOnly disabled aria-readonly="true" />
        </FormField>
        <FormField
          label="Observações"
          htmlFor="collab-notes"
          error={errors.notes?.message}
          hint="Visível só para gestores"
        >
          <Textarea
            id="collab-notes"
            rows={2}
            maxLength={500}
            disabled={disabled}
            {...form.register('notes')}
          />
        </FormField>
      </div>
    </div>
  )
}
