import { Link, useNavigate } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { useZodForm } from '@/lib/forms'
import { FormField } from '@/components/shared/form-field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthFormError } from '../api'
import { useLogin, useRequestPasswordReset } from '../hooks'
import { loginSchema, type LoginInput, type LoginValues } from '../schemas'
import { PasswordInput } from './password-input'

export interface LoginFormProps {
  /** destino após entrar (`?redirect=` validado pela rota) */
  redirect?: string | undefined
}

/** /login (FRONTEND-ARCH §3.3): e-mail + senha; erro `invalid_credentials` → "E-mail ou senha inválidos." */
export function LoginForm({ redirect }: LoginFormProps) {
  const navigate = useNavigate()
  const login = useLogin()
  const reset = useRequestPasswordReset()
  const form = useZodForm<LoginInput, LoginValues>(loginSchema, { email: '', password: '' })
  const { errors, isSubmitting } = form.formState
  const busy = isSubmitting || login.isPending

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      await navigate({ to: redirect ?? '/' })
    } catch (error) {
      if (error instanceof AuthFormError) {
        const field = error.field === 'email' || error.field === 'password' ? error.field : 'root'
        form.setError(field, { message: error.message })
        return
      }
      form.setError('root', { message: 'Não foi possível entrar. Tente novamente.' })
    }
  })

  const onForgotPassword = async () => {
    const valid = await form.trigger('email')
    if (!valid) return
    reset.mutate(form.getValues('email'), {
      onError: (error) => form.setError('email', { message: error.message }),
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField label="E-mail" htmlFor="login-email" error={errors.email?.message} required>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@empresa.com.br"
          {...form.register('email')}
        />
      </FormField>
      <FormField label="Senha" htmlFor="login-password" error={errors.password?.message} required>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          placeholder="Sua senha"
          {...form.register('password')}
        />
      </FormField>
      {errors.root?.message ? (
        <p
          role="alert"
          className="rounded-xl border border-red/25 bg-red/10 px-3 py-2 text-xs font-semibold text-red-soft"
        >
          {errors.root.message}
        </p>
      ) : null}
      <Button type="submit" loading={busy} className="w-full" size="lg">
        {!busy ? <LogIn aria-hidden="true" /> : null}
        Entrar
      </Button>
      <div className="flex flex-col items-center gap-1 text-center">
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => void onForgotPassword()}
          loading={reset.isPending}
        >
          Esqueci a senha
        </Button>
        <p className="text-[11px] text-muted-2">Se o e-mail de recuperação não chegar, peça ao gestor.</p>
      </div>
      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{' '}
        <Link to="/signup" className="font-bold text-accent underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  )
}
