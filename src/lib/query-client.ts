import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isAuthError, isPendingError, RpcError } from './rpc-errors'
import { notify } from './notify'
import { supabase } from './supabase'
import { qk } from './query-keys'
import { isBlockedMe, type BootstrapPayload } from './database.types'

const MINUTE = 60_000

/**
 * Navegação de erro global registrada por main.tsx (evita import circular com o router).
 * `toLogin` e `toAwaiting` são chamados por `handleGlobalError`.
 */
export interface AuthNavigator {
  toLogin: () => void
  toAwaiting: () => void
}
let navigator: AuthNavigator | null = null
export function registerAuthNavigator(nav: AuthNavigator | null): void {
  navigator = nav
}

let signingOut = false

/**
 * Erro global de query (FRONTEND-ARCH §3.4): `PROFILE_PENDING` → invalida bootstrap e vai para /aguardando sem signOut;
 * demais erros de auth (42501/PGRST301/PROFILE_INACTIVE/NOT_AUTHENTICATED) → signOut + /login com toast.
 */
export async function handleGlobalError(error: unknown, client: QueryClient): Promise<void> {
  if (isPendingError(error)) {
    await client.invalidateQueries({ queryKey: qk.bootstrap() })
    navigator?.toAwaiting()
    return
  }
  if (!isAuthError(error) || signingOut) return
  const bootstrap = client.getQueryData<BootstrapPayload>(qk.bootstrap())
  const blocked = bootstrap ? isBlockedMe(bootstrap.me) : true
  if (!blocked && !(error instanceof RpcError && error.code === 'NOT_AUTHENTICATED')) {
    // Perfil ativo no cache mas o banco negou: pode ter sido inativado agora — reconsulta antes de derrubar.
    await client.invalidateQueries({ queryKey: qk.bootstrap() })
    const fresh = client.getQueryData<BootstrapPayload>(qk.bootstrap())
    if (fresh && !isBlockedMe(fresh.me)) return
  }
  signingOut = true
  try {
    await supabase.auth.signOut()
  } finally {
    signingOut = false
  }
  notify.warning('Seu acesso foi desativado.')
  navigator?.toLogin()
}

export function createAppQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * MINUTE,
        retry: (n, e) => !isAuthError(e) && !(e instanceof RpcError) && n < 2,
        refetchOnWindowFocus: true,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        void handleGlobalError(error, client)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.['silent'] === true) return
        notify.error(error)
      },
    }),
  })
  return client
}

export const queryClient = createAppQueryClient()
