import { describe, expect, test } from 'vitest'
import { countUnread, isApproveMemberNotification, notificationLink, unreadIds } from './notification-utils'

describe('notification-utils', () => {
  test('approve_member payload navigates to Equipe › Pendentes; others do not', () => {
    expect(isApproveMemberNotification({ payload: { action: 'approve_member', profile_id: 'x' } })).toBe(true)
    expect(notificationLink({ payload: { action: 'approve_member' } })).toEqual({
      to: '/admin/equipe',
      search: { pendentes: true },
    })
    expect(notificationLink({ payload: {} })).toBeNull()
    expect(notificationLink({ payload: null })).toBeNull()
    expect(notificationLink({ payload: ['approve_member'] })).toBeNull()
  })
  test('unreadIds and countUnread', () => {
    const rows = [
      { id: 'a', is_read: false },
      { id: 'b', is_read: true },
      { id: 'c', is_read: false },
    ]
    expect(unreadIds(rows)).toEqual(['a', 'c'])
    expect(countUnread(rows)).toBe(2)
    expect(countUnread([])).toBe(0)
  })
})
