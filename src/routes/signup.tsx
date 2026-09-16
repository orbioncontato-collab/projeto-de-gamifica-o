import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { SignupForm } from '@/features/auth/components/signup-form'
import { SignupSuccess } from '@/features/auth/components/signup-success'
import { useSignupMode } from '@/features/auth/hooks'
import type { SignUpResult } from '@/features/auth/api'
import { ErrorState } from '@/components/shared/error-state'
import { CardSkeleton } from '@/components/shared/skeletons'

/** /signup — anônimo (FRONTEND-ARCH §3.3): `signup_mode` decide primeiro gestor × colaborador com código. */
export const Route = createFileRoute('/signup')({
  beforeLoad: ({ context }) => {
    if (context.auth.status === 'signed_in') throw redirect({ to: '/' })
  },
  component: SignupPage,
})

const COPY = {
  first_admin: {
    title: 'Você será o gestor desta instalação',
    subtitle: 'O primeiro cadastro cria o gestor. Depois, compartilhe o código da equipe com o time.',
  },
  team_code: {
    title: 'Criar conta',
    subtitle: 'Informe seus dados e o código da equipe fornecido pelo gestor.',
  },
} as const

function SignupPage() {
  const mode = useSignupMode()
  const [success, setSuccess] = useState<SignUpResult | null>(null)

  if (success) {
    return (
      <AuthLayout eyebrow="Cadastro" title="Tudo certo por aqui">
        <SignupSuccess
          needsEmailConfirmation={success.needsEmailConfirmation}
          awaitsApproval={success.awaitsApproval}
        />
      </AuthLayout>
    )
  }
  if (mode.isPending) {
    return (
      <AuthLayout eyebrow="Cadastro" title="Criar conta">
        <CardSkeleton lines={6} />
      </AuthLayout>
    )
  }
  if (mode.isError) {
    return (
      <AuthLayout eyebrow="Cadastro" title="Criar conta">
        <ErrorState
          error={mode.error}
          onRetry={() => void mode.refetch()}
          title="Não foi possível carregar o cadastro"
        />
      </AuthLayout>
    )
  }
  const copy = COPY[mode.data]
  return (
    <AuthLayout eyebrow="Cadastro" title={copy.title} subtitle={copy.subtitle}>
      <SignupForm mode={mode.data} onNeedsEmailConfirmation={setSuccess} />
    </AuthLayout>
  )
}
