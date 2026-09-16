import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Hourglass, LogOut, RefreshCw, ShieldOff } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { firstName } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { IconTile } from '@/components/shared/icon-tile'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/skeletons'
import { useBootstrap } from '../bootstrap-query'
import { useLogout } from '../hooks'
import { AuthLayout } from './auth-layout'

/**
 * /aguardando (FRONTEND-ARCH §3.3): `pending` → aguardando aprovação + "Verificar novamente"; `inactive` → acesso desativado.
 * Não faz `signOut()` automático; sair só no clique.
 */
export function AwaitingScreen() {
  const bootstrap = useBootstrap()
  const qc = useQueryClient()
  const router = useRouter()
  const logout = useLogout()

  const checkAgain = async () => {
    await qc.invalidateQueries({ queryKey: qk.bootstrap() })
    await router.invalidate() // com `active`, o `beforeLoad` da rota redireciona para /
  }

  if (bootstrap.isPending) {
    return (
      <AuthLayout eyebrow="Acesso" title="Verificando seu cadastro">
        <LoadingState />
      </AuthLayout>
    )
  }
  if (bootstrap.isError) {
    return (
      <AuthLayout eyebrow="Acesso" title="Não foi possível carregar seus dados">
        <ErrorState error={bootstrap.error} onRetry={() => void bootstrap.refetch()} compact />
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => logout.mutate()}
          loading={logout.isPending}
        >
          <LogOut aria-hidden="true" />
          Sair
        </Button>
      </AuthLayout>
    )
  }

  const me = bootstrap.data.me
  if (me.status === 'inactive') {
    return (
      <AuthLayout
        eyebrow="Acesso"
        title="Seu acesso foi desativado"
        subtitle="Fale com o gestor da sua equipe."
      >
        <div className="flex flex-col items-center">
          <IconTile icon={ShieldOff} tone="danger" size="lg" />
          <Button
            variant="secondary"
            className="mt-6 w-full"
            onClick={() => logout.mutate()}
            loading={logout.isPending}
          >
            <LogOut aria-hidden="true" />
            Sair
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Acesso"
      title="Seu cadastro está aguardando aprovação do gestor"
      subtitle={`Olá, ${firstName(me.full_name) || me.full_name}. Um gestor precisa aprovar sua entrada na equipe. Você receberá o acesso assim que isso acontecer.`}
    >
      <div className="flex flex-col items-center">
        <IconTile icon={Hourglass} tone="warning" size="lg" />
        <div className="mt-6 flex w-full flex-col gap-2">
          <Button
            className="w-full"
            size="lg"
            onClick={() => void checkAgain()}
            loading={bootstrap.isFetching}
          >
            <RefreshCw aria-hidden="true" />
            Verificar novamente
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => logout.mutate()}
            loading={logout.isPending}
          >
            <LogOut aria-hidden="true" />
            Sair
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
