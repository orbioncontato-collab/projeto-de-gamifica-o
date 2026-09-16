import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { LoginForm } from '@/features/auth/components/login-form'

/** /login — anônimo; logado vai para `redirect ?? '/'` (FRONTEND-ARCH §3.3). */
export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s['redirect'] === 'string' && s['redirect'].startsWith('/') ? { redirect: s['redirect'] } : {},
  beforeLoad: ({ context, search }) => {
    if (context.auth.status === 'signed_in') throw redirect({ to: search.redirect ?? '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  return (
    <AuthLayout eyebrow="Acesso" title="Entrar" subtitle="Use o e-mail e a senha do seu cadastro.">
      <LoginForm redirect={target} />
    </AuthLayout>
  )
}
