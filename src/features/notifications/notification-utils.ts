import { linkOptions } from '@tanstack/react-router'
import type { Json, NotificationRow } from '@/lib/database.types'

/** Payload da notificação `system` "Novo membro aguardando aprovação" (DATA-MODEL §6.4 passo 11). */
export const APPROVE_MEMBER_ACTION = 'approve_member'

const isRecord = (v: Json): v is { [key: string]: Json | undefined } =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export const isApproveMemberNotification = (n: Pick<NotificationRow, 'payload'>): boolean =>
  isRecord(n.payload) && n.payload['action'] === APPROVE_MEMBER_ACTION

/** Só o item `approve_member` navega (para `/admin/equipe?pendentes=true`); os demais não. */
export function notificationLink(n: Pick<NotificationRow, 'payload'>) {
  return isApproveMemberNotification(n)
    ? linkOptions({ to: '/admin/equipe', search: { pendentes: true } })
    : null
}

export const unreadIds = (rows: readonly Pick<NotificationRow, 'id' | 'is_read'>[]): string[] =>
  rows.filter((r) => !r.is_read).map((r) => r.id)

export const countUnread = (rows: readonly Pick<NotificationRow, 'is_read'>[]): number =>
  rows.reduce((acc, r) => (r.is_read ? acc : acc + 1), 0)
