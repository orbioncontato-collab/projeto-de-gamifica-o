import { describe, expect, test } from 'vitest'
import { ADMIN_NAV, BOTTOM_NAV, FOOTER_NAV, MAIN_NAV, pendingBadgeLabel, teamLinkFor } from './sidebar-nav'
import { userSubtitle } from './user-subtitle'

describe('sidebar-nav', () => {
  test('main nav has 8 items, admin nav 8, bottom nav 5, footer 1 (FRONTEND-ARCH §3.6)', () => {
    expect(MAIN_NAV).toHaveLength(8)
    expect(ADMIN_NAV).toHaveLength(8)
    expect(BOTTOM_NAV).toHaveLength(5)
    expect(FOOTER_NAV).toHaveLength(1)
    expect(BOTTOM_NAV[0]?.label).toBe('Início')
    expect(BOTTOM_NAV[0]?.exact).toBe(true)
  })
  test('admin "Equipe" carries the pending badge and "Desafios" opens the manager tab', () => {
    const team = ADMIN_NAV.find((i) => i.id === 'admin-team')
    expect(team?.badge).toBe('pending_members')
    const challenges = ADMIN_NAV.find((i) => i.id === 'admin-challenges')
    expect(challenges?.link).toEqual({ to: '/desafios', search: { gerenciar: true } })
    expect(challenges?.matchSearch).toBe(true)
    expect(MAIN_NAV.find((i) => i.id === 'challenges')?.matchSearch).toBe(true)
  })
  test('teamLinkFor adds ?pendentes=true only when there are pending members', () => {
    expect(teamLinkFor(0)).toEqual({ to: '/admin/equipe' })
    expect(teamLinkFor(3)).toEqual({ to: '/admin/equipe', search: { pendentes: true } })
  })
  test('pendingBadgeLabel pluralizes in pt-BR', () => {
    expect(pendingBadgeLabel(1)).toBe('1 cadastro aguardando aprovação')
    expect(pendingBadgeLabel(2)).toBe('2 cadastros aguardando aprovação')
  })
  test('userSubtitle', () => {
    expect(userSubtitle(true, 'Closer', 7)).toBe('Gestor · Visão da operação')
    expect(userSubtitle(false, 'Closer', 7)).toBe('Closer · Nível 7')
    expect(userSubtitle(false, 'SDR', Number.NaN)).toBe('SDR · Nível 1')
  })
})
