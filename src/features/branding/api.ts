import { callRpc } from '@/lib/supabase'
import type { Branding } from '@/lib/database.types'

/** rpc `get_branding` (executável por `anon`): nome, preset, logo e tema padrão — só isso. */
export async function getBranding(): Promise<Branding> {
  return callRpc('get_branding')
}
