import { callRpc, supabase, unwrap } from '@/lib/supabase'
import type { NotificationRow } from '@/lib/database.types'

export const NOTIFICATIONS_DEFAULT_LIMIT = 20

/** Últimas notificações do próprio usuário (RLS: `profile_id = auth.uid()`), mais recentes primeiro. */
export async function getNotifications(limit = NOTIFICATIONS_DEFAULT_LIMIT): Promise<NotificationRow[]> {
  const rows = await unwrap(
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit),
  )
  return (rows ?? []) as NotificationRow[]
}

/** rpc `mark_notifications_read(p_ids?)` — sem ids marca todas; devolve linhas afetadas. */
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  const result = await callRpc(
    'mark_notifications_read',
    ids && ids.length > 0 ? { p_ids: ids } : { p_ids: null },
  )
  return typeof result === 'number' ? result : 0
}
