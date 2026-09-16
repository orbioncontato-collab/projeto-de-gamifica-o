import { useMemo, type ChangeEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { UserPlus } from 'lucide-react'
import { useZodForm } from '@/lib/forms'
import { maskTeamCode } from '@/lib/format'
import { FormField } from '@/components/shared/form-field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthFormError, type SignUpResult } from '../api'
import { useSignup } from '../hooks'
import {
  normalizeTeamCode,
  signupSchemaFor,
  type SignupFormInput,
  type SignupFormValues,
  type SignupMode,
} from '../schemas'
import { PasswordInput } from './password-input'

const TEAM_CODE_LENGTH = 12
const TEAM_CODE_MASKED_LENGTH = 14

export interface SignupFormProps {
  mode: SignupMode
  /** chamado quando o cadastro exige confirmação de e-mail (sem sessão) */
  onNeedsEmailConfirmation: (result: SignUpResult) => void
}

/** /signup (FRONTEND-ARCH §3.3): `first_admin` sem código; `team_code` com pré-validação e aviso de aprovação. */
export function SignupForm({ mode, onNeedsEmailConfirmation }: SignupFormProps) {
  const navigate = useNavigate()
  const signup = useSignup()
  const isTeamMode = mode === 'team_code'
  const schema = useMemo(() => signupSchemaFor(mode), [mode])
  const form = useZodForm<SignupFormInput, SignupFormValues>(schema, {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    teamCode: '',
  })
  const { errors, isSubmitting } = form.formState
  const busy = isSubmitting || signup.isPending

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await signup.mutateAsync({
        mode,
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        teamCode: isTeamMode ? normalizeTeamCode(values.teamCode ?? '') : undefined,
      })
      if (result.needsEmailConfirmation) {
        onNeedsEmailConfirmation(result)
        return
      }
      await navigate({ to: '/' }) // o guard de _app decide entre / e /aguardando pelo `me.status`
    } catch (error) {
      if (error instanceof AuthFormError) {
        form.setError(error.field === 'form' ? 'root' : error.field, { message: error.message })
        return
      }
      form.setError('root', { message: 'Não foi possível concluir o cadastro. Tente novamente.' })
    }
  })

  const teamCodeField = form.register('teamCode')
  const onTeamCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const clean = normalizeTeamCode(event.target.value).slice(0, TEAM_CODE_LENGTH)
    form.setValue('teamCode', maskTeamCode(clean), { shouldDirty: true })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField label="Nome completo" htmlFor="signup-name" error={errors.fullName?.message} required>
        <Input
          id="signup-name"
          autoComplete="name"
          placeholder="Como você quer aparecer no ranking"
          aria-invalid={Boolean(errors.fullName) || undefined}
          {...form.register('fullName')}
        />
      </FormField>
      <FormField label="E-mail" htmlFor="signup-email" error={errors.email?.message} required>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@empresa.com.br"
          aria-invalid={Boolean(errors.email) || undefined}
          {...form.register('email')}
        />
      </FormField>
      <FormField
        label="Senha"
        htmlFor="signup-password"
        error={errors.password?.message}
        hint="Mínimo de 8 caracteres."
        required
      >
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password) || undefined}
          {...form.register('password')}
        />
      </FormField>
      <FormField
        label="Confirmar senha"
        htmlFor="signup-confirm"
        error={errors.confirmPassword?.message}
        required
      >
        <PasswordInput
          id="signup-confirm"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword) || undefined}
          {...form.register('confirmPassword')}
        />
      </FormField>
      {isTeamMode ? (
        <FormField
          label="Código da equipe"
          htmlFor="signup-team-code"
          error={errors.teamCode?.message}
          hint="12 caracteres, fornecido pelo gestor."
          required
        >
          <Input
            id="signup-team-code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX"
            maxLength={TEAM_CODE_MASKED_LENGTH}
            className="font-mono uppercase tracking-[0.18em]"
            aria-invalid={Boolean(errors.teamCode) || undefined}
            {...teamCodeField}
            onChange={onTeamCodeChange}
          />
        </FormField>
      ) : null}
      {errors.root?.message ? (
        <p
          role="alert"
          className="rounded-xl border border-red/25 bg-red/10 px-3 py-2 text-xs font-semibold text-red-soft"
        >
          {errors.root.message}
        </p>
      ) : null}
      {isTeamMode ? (
        <p className="rounded-xl border border-gold/20 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">
          Seu cadastro será analisado por um gestor antes de liberar o acesso.
        </p>
      ) : null}
      <Button type="submit" loading={busy} className="w-full" size="lg">
        {!busy ? <UserPlus aria-hidden="true" /> : null}
        {isTeamMode ? 'Enviar cadastro' : 'Criar conta de gestor'}
      </Button>
      <p className="text-center text-sm text-muted">
        Já tem conta?{' '}
        <Link to="/login" className="font-bold text-accent underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}
