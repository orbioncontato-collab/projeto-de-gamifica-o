import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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
  updateAppSettings: vi.fn(),
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
