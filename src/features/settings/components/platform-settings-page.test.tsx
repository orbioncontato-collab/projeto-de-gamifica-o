import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type {
  AppSecretsRow,
  AppSettingsRow,
  BootstrapPayload,
  VSeason,
  VSpecialEvent,
} from '@/lib/database.types'

const getAppSettings = vi.fn()
const getAppSecrets = vi.fn()
const getSeasons = vi.fn()
const getSpecialEvents = vi.fn()
const hasLedgerEntries = vi.fn()
const updateAppSettings = vi.fn()
let bootstrap: BootstrapPayload = makeBootstrap()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/features/branding/api', () => ({ getBranding: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/realtime', () => ({
  subscribeToTables: () => () => undefined,
  useRealtimeInvalidate: () => undefined,
}))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(bootstrap),
  useMeOptional: () => toMe(bootstrap),
}))
vi.mock('@/features/profiles/api', () => ({
  getActiveProfiles: vi.fn().mockResolvedValue([]),
  getRanking: vi.fn(),
  getProfileStats: vi.fn(),
  getProfileStat: vi.fn(),
  getPendingMembers: vi.fn(),
  getProfilePrivate: vi.fn(),
  getAchievementBoard: vi.fn(),
}))
vi.mock('../api', () => ({
  getAppSettings: (...a: unknown[]) => getAppSettings(...a),
  getAppSecrets: (...a: unknown[]) => getAppSecrets(...a),
  getSeasons: (...a: unknown[]) => getSeasons(...a),
  getSpecialEvents: (...a: unknown[]) => getSpecialEvents(...a),
  hasLedgerEntries: (...a: unknown[]) => hasLedgerEntries(...a),
  updateAppSettings: (...a: unknown[]) => updateAppSettings(...a),
  rotateTeamCode: vi.fn(),
  createSeason: vi.fn(),
  updateSeason: vi.fn(),
  activateSeason: vi.fn(),
  closeSeason: vi.fn(),
  saveSpecialEvent: vi.fn(),
  deleteSpecialEvent: vi.fn(),
  recomputeStats: vi.fn(),
}))

import { PlatformSettingsPage } from './platform-settings-page'

const ADMIN = makeMe({ role: 'admin' })

/** Linha do seed (DATA-MODEL §13.1). */
const SETTINGS: AppSettingsRow = {
  id: 1,
  company_name: 'Orbion',
  xp_per_level: 400,
  currency: 'BRL',
  timezone: 'America/Sao_Paulo',
  target_conversion_pct: 25,
  target_attendance_pct: 70,
  target_crm_pct: 95,
  target_activities_count: 1000,
  streak_business_days_only: false,
  rank_admins: true,
  auto_approve_members: false,
  platform_name: 'Sales League',
  brand_preset: 'esmeralda',
  logo_data_url: null,
  default_theme: 'dark',
  updated_at: '2026-09-01T00:00:00Z',
  updated_by: null,
}
const SECRETS: AppSecretsRow = {
  id: 1,
  team_code: 'A3F9C21B7E04',
  team_code_rotated_at: '2026-09-01T00:00:00Z',
  bootstrap_email: null,
  bootstrap_done: true,
  updated_at: '2026-09-01T00:00:00Z',
  updated_by: null,
}
const season = (over: Partial<VSeason>): VSeason => ({
  id: over.id ?? 's1',
  name: 'Setembro',
  starts_at: '2026-09-01T03:00:00Z',
  ends_at: '2026-10-01T03:00:00Z',
  team_goal_amount: 0,
  xp_per_level: 400,
  is_active: true,
  closed_at: null,
  closed_by: null,
  created_by: null,
  created_at: '2026-08-31T00:00:00Z',
  updated_at: '2026-08-31T00:00:00Z',
  is_current: true,
  days_total: 30,
  days_elapsed: 15,
  days_left: 15,
  ...over,
})
const event = (over: Partial<VSpecialEvent>): VSpecialEvent => ({
  id: over.id ?? 'ev1',
  name: 'Semana 2x',
  description: null,
  multiplier: 2,
  starts_at: '2026-09-20T03:00:00Z',
  ends_at: '2026-09-27T03:00:00Z',
  is_active: true,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  state: 'upcoming',
  seconds_to_start: 3600,
  seconds_to_end: 7200,
  ...over,
})

beforeEach(() => {
  bootstrap = makeBootstrap({ me: ADMIN })
  getAppSettings.mockReset().mockResolvedValue(SETTINGS)
  getAppSecrets.mockReset().mockResolvedValue(SECRETS)
  getSeasons.mockReset().mockResolvedValue([])
  getSpecialEvents.mockReset().mockResolvedValue([])
  hasLedgerEntries.mockReset().mockResolvedValue(false)
  updateAppSettings
    .mockReset()
    .mockImplementation(async (patch: Partial<AppSettingsRow>) => ({ ...SETTINGS, ...patch }))
  delete document.documentElement.dataset['brand']
})

describe('PlatformSettingsPage', () => {
  test('aba Geral: empresa do seed, fuso editável com 0 lançamentos, toggle de ranking ligado', async () => {
    renderInRouter(<PlatformSettingsPage tab="geral" />)
    expect(await screen.findByLabelText(/Nome da empresa/)).toHaveValue('Orbion')
    expect(screen.getByLabelText(/XP por nível/)).toHaveValue(400)
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Fuso horário/ })).toBeEnabled())
    expect(screen.getByRole('switch', { name: /Gestores participam do ranking/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Salvar configurações' })).toBeDisabled()
  })

  test('aba Geral: fuso travado quando já existe lançamento', async () => {
    hasLedgerEntries.mockResolvedValue(true)
    renderInRouter(<PlatformSettingsPage tab="geral" />)
    await screen.findByLabelText(/Nome da empresa/)
    expect(await screen.findByText('Trava após o primeiro lançamento.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Fuso horário/ })).toBeDisabled()
  })

  test('aba Marca: nome da plataforma do seed, 7 cores com Esmeralda marcada, tema escuro, sem logo', async () => {
    renderInRouter(<PlatformSettingsPage tab="marca" />)
    expect(await screen.findByLabelText(/Nome da plataforma/)).toHaveValue('Sales League')
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(7)
    expect(screen.getByRole('radio', { name: 'Esmeralda' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Safira' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Enviar logo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover logo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar marca' })).toBeDisabled()
  })

  test('aba Marca: escolher cor pré-visualiza em html[data-brand] e salvar manda só o que mudou', async () => {
    const user = userEvent.setup()
    renderInRouter(<PlatformSettingsPage tab="marca" />)
    await screen.findByLabelText(/Nome da plataforma/)
    await user.click(screen.getByRole('radio', { name: 'Coral' }))
    expect(screen.getByRole('radio', { name: 'Coral' })).toBeChecked()
    expect(document.documentElement.dataset['brand']).toBe('coral')
    const name = screen.getByLabelText(/Nome da plataforma/)
    await user.clear(name)
    await user.type(name, 'Liga Acme')
    await user.click(screen.getByRole('button', { name: 'Salvar marca' }))
    await waitFor(() => expect(updateAppSettings).toHaveBeenCalledTimes(1))
    expect(updateAppSettings.mock.calls[0]?.[0]).toEqual({
      platform_name: 'Liga Acme',
      brand_preset: 'coral',
    })
  })

  test('aba Marca: com logo salva, mostra prévia e "Remover logo" manda logo_data_url: null', async () => {
    const PNG =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    getAppSettings.mockResolvedValue({ ...SETTINGS, logo_data_url: PNG })
    const user = userEvent.setup()
    renderInRouter(<PlatformSettingsPage tab="marca" />)
    expect(await screen.findByTestId('branding-logo-preview')).toHaveAttribute('src', PNG)
    await user.click(screen.getByRole('button', { name: 'Remover logo' }))
    expect(screen.queryByTestId('branding-logo-preview')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar marca' }))
    await waitFor(() => expect(updateAppSettings).toHaveBeenCalledTimes(1))
    expect(updateAppSettings.mock.calls[0]?.[0]).toEqual({ logo_data_url: null })
  })

  test('aba Temporadas vazia', async () => {
    renderInRouter(<PlatformSettingsPage tab="temporadas" />)
    expect(await screen.findByText('Nenhuma temporada')).toBeInTheDocument()
  })

  test('aba Temporadas: ativa com meta 0 destaca "defina a meta"; futura tem "Ativar" desabilitado com "Começa em"', async () => {
    getSeasons.mockResolvedValue([
      season({}),
      season({
        id: 's2',
        name: 'Outubro',
        is_active: false,
        starts_at: '2099-10-01T03:00:00Z',
        ends_at: '2099-11-01T03:00:00Z',
        is_current: false,
      }),
    ])
    renderInRouter(<PlatformSettingsPage tab="temporadas" />)
    expect((await screen.findAllByText(/defina a meta/)).length).toBe(2)
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeDisabled()
    expect(screen.getByLabelText('Começa em 01/10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Encerrar' })).toBeInTheDocument()
  })

  test('aba Temporadas: temporada ativa que terminou mostra alerta', async () => {
    getSeasons.mockResolvedValue([
      season({ starts_at: '2020-01-01T03:00:00Z', ends_at: '2020-02-01T03:00:00Z' }),
    ])
    renderInRouter(<PlatformSettingsPage tab="temporadas" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/terminou em/)
  })

  test('aba Eventos vazia e com evento agendado', async () => {
    const { unmount } = renderInRouter(<PlatformSettingsPage tab="eventos" />)
    expect(await screen.findByText('Nenhum evento')).toBeInTheDocument()
    unmount()
    getSpecialEvents.mockResolvedValue([event({})])
    renderInRouter(<PlatformSettingsPage tab="eventos" />)
    expect(await screen.findByText('Semana 2x')).toBeInTheDocument()
    expect(screen.getByText('2,0x pontos')).toBeInTheDocument()
    expect(screen.getByText('Agendado')).toBeInTheDocument()
  })

  test('aba Código: código mascarado com só os 4 últimos, botão copiar e toggle de aprovação desligado', async () => {
    renderInRouter(<PlatformSettingsPage tab="codigo" />)
    expect(await screen.findByText('••••-••••-7E04')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copiar/ })).toBeInTheDocument()
    expect(
      await screen.findByRole('switch', { name: /Aprovar novos membros automaticamente/ }),
    ).not.toBeChecked()
    expect(screen.getByText(/confirmação de e-mail/)).toBeInTheDocument()
  })
})
