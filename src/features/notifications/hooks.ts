import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import { useRealtimeInvalidate } from '@/lib/realtime'
import type { NotificationRow } from '@/lib/database.types'
import { useMe } from '@/features/auth/hooks'
import { getNotifications, markNotificationsRead, NOTIFICATIONS_DEFAULT_LIMIT } from './api'

export function useNotifications(limit = NOTIFICATIONS_DEFAULT_LIMIT): UseQueryResult<NotificationRow[]> {
  return useQuery({ queryKey: qk.notifications.list(limit), queryFn: () => getNotifications(limit) })
}

/** `mark_notifications_read(ids?)` → invalida notifications e bootstrap (contador do sino). Sem toast. */
export function useMarkNotificationsRead(): UseMutationResult<number, Error, string[] | undefined> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids) => markNotificationsRead(ids),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.notifications.all() }),
        qc.invalidateQueries({ queryKey: qk.bootstrap() }),
      ])
    },
    meta: { silent: true },
  })
}

/**
 * Canal `notifications:<uid>` (FRONTEND-ARCH §4.5/§4.6): qualquer mudança invalida notifications + bootstrap
 * (debounce 250 ms em `useRealtimeInvalidate`); INSERT mostra `notify.info(title)` imediatamente.
 */
export function useNotificationsRealtime(): void {
  const { me } = useMe()
  const profileId = me.id
  useRealtimeInvalidate({
    table: 'notifications',
    filter: `profile_id=eq.${profileId}`,
    keys: [qk.notifications.all(), qk.bootstrap()],
    onChange: (payload) => {
      if (payload.eventType !== 'INSERT') return
      const row = payload.new as Partial<NotificationRow>
      if (row.title) notify.info(row.title, row.message)
    },
  })
}
