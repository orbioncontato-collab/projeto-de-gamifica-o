import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Database, RpcName, RpcArgs, RpcResult } from './database.types'
import { RpcError } from './rpc-errors'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** false quando as variáveis VITE_* não foram definidas — a raiz mostra `ConfigMissingScreen` em vez de tela branca. */
export const isSupabaseConfigured = (): boolean => Boolean(url && key)

/** Quais variáveis faltam (para a tela de configuração). */
export const missingSupabaseEnv = (): string[] => {
  const missing: string[] = []
  if (!url) missing.push('VITE_SUPABASE_URL')
  if (!key) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')
  return missing
}

// Placeholders só para o client não lançar no import quando o env está ausente (nenhuma chamada é feita nesse caso).
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'sb_publishable_placeholder'

export const supabase = createClient<Database>(url || PLACEHOLDER_URL, key || PLACEHOLDER_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  realtime: { params: { eventsPerSecond: 5 } },
})

/** Chama uma RPC e converte { data, error } em valor | throw RpcError. */
export async function callRpc<N extends RpcName>(name: N, args?: RpcArgs<N>): Promise<RpcResult<N>> {
  const { data, error } = await supabase.rpc(name, args as RpcArgs<RpcName>)
  if (error) throw RpcError.fromPostgrest(error)
  // O banco devolve `Json`; o formato real é o payload tipado de DATA-MODEL §7 (RpcPayloads).
  return data as unknown as RpcResult<N>
}

/** Idem para builders do PostgREST: unwrap(supabase.from('rewards').select()) */
export async function unwrap<T>(
  q: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<T> {
  const { data, error } = await q
  if (error) throw RpcError.fromPostgrest(error)
  return data as T
}

const AVATAR_BUCKET = 'avatars'
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}
export function avatarObjectPath(profileId: string, file: File): string {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return `${profileId}/avatar-${Date.now()}.${ext}`
}
export const AVATAR_MAX_BYTES = 1_572_864
export const AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
