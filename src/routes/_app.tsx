import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { bootstrapQueryOptions } from '@/features/auth/bootstrap-query'
import { AppShell } from '@/components/layout/app-shell'
import { supabase } from '@/lib/supabase'
import { isAuthError, isCode } from '@/lib/rpc-errors'
import { notify } from '@/lib/notify'
import type { BootstrapPayload } from '@/lib/database.types'

/** Layout pathless do app autenticado (FRONTEND-ARCH §3.4): guarda de sessão + bootstrap; `<AppShell/>` + `<Outlet/>`. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    if (context.auth.status !== 'signed_in') {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    let bootstrap: BootstrapPayload
    try {
      bootstrap = await context.queryClient.ensureQueryData(bootstrapQueryOptions())
    } catch (error) {
      if (isCode(error, 'PROFILE_NOT_FOUND')) {
        // usuário do Auth sem linha em profiles (DATA-MODEL §7.1): "Tentar novamente" repetiria o erro para sempre
        await supabase.auth.signOut()
        notify.error(error, 'Cadastro incompleto')
        throw redirect({ to: '/login' })
      }
      if (isAuthError(error)) {
        await supabase.auth.signOut()
        throw redirect({ to: '/login' })
      }
      throw error // RouteErrorState: "Não foi possível carregar seus dados" + Tentar novamente
    }
    if (bootstrap.me.status !== 'active') throw redirect({ to: '/aguardando' }) // 'pending' ou 'inactive'
    return { bootstrap }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
