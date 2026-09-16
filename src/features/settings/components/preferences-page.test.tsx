import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload } from '@/lib/database.types'

const updateMyPreferences = vi.fn()
let bootstrap: BootstrapPayload = makeBootstrap()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/realtime', () => ({
  subscribeToTables: () => () => undefined,
  useRealtimeInvalidate: () => undefined,
}))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(bootstrap),
  useMeOptional: () => toMe(bootstrap),
}))
vi.mock('@/features/auth/profile-api', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/profile-api')>()),
  updateMyPreferences: (...a: unknown[]) => updateMyPreferences(...a),
}))

import { PreferencesPage } from './preferences-page'

beforeEach(() => {
  bootstrap = makeBootstrap({ me: makeMe({ preferences: { notifications: true, event_alerts: false } }) })
  updateMyPreferences.mockReset().mockResolvedValue({ notifications: false, event_alerts: false })
})

describe('PreferencesPage', () => {
  test('mostra as preferências atuais e o botão salvar desabilitado sem mudanças; colaborador não vê "Plataforma"', async () => {
    renderInRouter(<PreferencesPage />)
    expect(await screen.findByRole('switch', { name: /Notificações no app/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Alertas de evento especial/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Salvar preferências' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /Plataforma/ })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument()
  })

  test('alterar um toggle habilita salvar e chama updateMyPreferences com o patch', async () => {
    const user = userEvent.setup()
    renderInRouter(<PreferencesPage />)
    await user.click(await screen.findByRole('switch', { name: /Notificações no app/ }))
    const save = screen.getByRole('button', { name: 'Salvar preferências' })
    expect(save).toBeEnabled()
    await user.click(save)
    expect(updateMyPreferences).toHaveBeenCalledWith(
      bootstrap.me.id,
      { notifications: true, event_alerts: false },
      { notifications: false, event_alerts: false },
    )
  })

  test('gestor vê o atalho para as configurações da plataforma', async () => {
    bootstrap = makeBootstrap({ me: makeMe({ role: 'admin' }) })
    renderInRouter(<PreferencesPage />)
    expect(await screen.findByRole('link', { name: /Plataforma/ })).toBeInTheDocument()
  })
})
