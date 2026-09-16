import { createFileRoute, redirect } from '@tanstack/react-router'
import { bootstrapQueryOptions } from '@/features/auth/bootstrap-query'
import { AwaitingScreen } from '@/features/auth/components/awaiting-screen'
import { supabase } from '@/lib/supabase'
import { notify } from '@/lib/notify'
import { isAuthError, isCode } from '@/lib/rpc-errors'
import type { BootstrapPayload } from '@/lib/database.types'

/** /aguardando — perfil `pending` ou `inactive` (FRONTEND-ARCH §3.3); `active` volta para /. */
export const Route = createFileRoute('/aguardando')({
  beforeLoad: async ({ context }) => {
    if (context.auth.status !== 'signed_in') throw redirect({ to: '/login' })
    let bootstrap: BootstrapPayload
    try {
      bootstrap = await context.queryClient.ensureQueryData(bootstrapQueryOptions())
    } catch (error) {
      if (isCode(error, 'PROFILE_NOT_FOUND')) {
        await supabase.auth.signOut()
        notify.error(error, 'Cadastro incompleto')
        throw redirect({ to: '/login' })
      }
      if (isAuthError(error)) {
        await supabase.auth.signOut()
        throw redirect({ to: '/login' })
      }
      throw error
    }
    if (bootstrap.me.status === 'active') throw redirect({ to: '/' }) // aprovado enquanto a aba estava aberta
  },
  component: AwaitingScreen,
})
