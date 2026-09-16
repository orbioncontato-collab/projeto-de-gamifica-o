import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { callRpc, supabase } from '@/lib/supabase'
import { qk } from '@/lib/query-keys'
import {
  isBlockedMe,
  type ActiveEvent,
  type BootstrapMe,
  type BootstrapPayload,
  type BootstrapSeason,
  type BootstrapSettings,
  type BootstrapWheel,
} from '@/lib/database.types'
import { useAuth } from './auth-provider'

/**
 * `get_bootstrap` + retentativa best-effort da limpeza do `team_code` na metadata do usuário
 * (DATA-MODEL §6.4, §14.1 passo 6): repete em cada bootstrap até a metadata sumir; nunca bloqueia nem mostra toast.
 */
export async function getBootstrap(): Promise<BootstrapPayload> {
  const data = await callRpc('get_bootstrap')
  void supabase.auth
    .getUser()
    .then(({ data: { user } }) => {
      const meta = user?.user_metadata as Record<string, unknown> | undefined
      if (meta && meta['team_code']) {
        return supabase.auth.updateUser({ data: { team_code: null } }).then(() => undefined)
      }
      return undefined
    })
    .catch(() => undefined)
  return data
}

const BOOTSTRAP_STALE_MS = 60_000
const BOOTSTRAP_GC_MS = 5 * 60_000

export const bootstrapQueryOptions = () =>
  queryOptions({
    queryKey: qk.bootstrap(),
    queryFn: getBootstrap,
    staleTime: BOOTSTRAP_STALE_MS,
    gcTime: BOOTSTRAP_GC_MS,
  })

/** Query do bootstrap (só roda com sessão). `/aguardando` usa isto direto para ler `me.status`. */
export function useBootstrap(): UseQueryResult<BootstrapPayload> {
  const auth = useAuth()
  return useQuery({ ...bootstrapQueryOptions(), enabled: auth.status === 'signed_in' })
}

export interface Me {
  me: BootstrapMe
  season: BootstrapSeason | null
  settings: BootstrapSettings
  wheel: BootstrapWheel
  activeEvent: ActiveEvent | null
  unread: number
  pendingMembers: number
  isAdmin: boolean
  seasonId: string | null
}

export function toMe(bootstrap: BootstrapPayload): Me {
  if (isBlockedMe(bootstrap.me)) {
    throw new Error('useMe() só pode ser usado com perfil ativo (dentro de /_app).')
  }
  return {
    me: bootstrap.me,
    season: bootstrap.season,
    settings: bootstrap.settings,
    wheel: bootstrap.wheel,
    activeEvent: bootstrap.active_event,
    unread: bootstrap.unread_notifications,
    pendingMembers: bootstrap.pending_members,
    isAdmin: bootstrap.me.role === 'admin',
    seasonId: bootstrap.season?.id ?? null,
  }
}

/**
 * Lê o bootstrap já carregado pelo guard de `_app` (FRONTEND-ARCH §4.5). Lança se ausente ou se o perfil
 * está bloqueado — dentro de `_app` o guard garante `status = 'active'`.
 */
export function useMe(): Me {
  const { data } = useBootstrap()
  if (!data) throw new Error('useMe() chamado antes do bootstrap carregar (fora de /_app?).')
  return toMe(data)
}

/** Variante segura para componentes compartilhados que também vivem fora de `_app` (ex.: EmptyState.adminHint). */
export function useMeOptional(): Me | null {
  const { data } = useBootstrap()
  if (!data || isBlockedMe(data.me)) return null
  return toMe(data)
}
