import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload, PointRuleRow, VPointEntryHistory } from '@/lib/database.types'

const getPointRules = vi.fn()
const getEntriesHistory = vi.fn()
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
  getProfileStat: vi.fn().mockResolvedValue(null),
  getPendingMembers: vi.fn(),
  getProfilePrivate: vi.fn(),
  getAchievementBoard: vi.fn(),
}))
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getPointRules: (...a: unknown[]) => getPointRules(...a),
  getEntriesHistory: (...a: unknown[]) => getEntriesHistory(...a),
  savePointRule: vi.fn(),
  deletePointRule: vi.fn(),
  recordRuleEntry: vi.fn(),
  recordManualEntry: vi.fn(),
  reverseEntry: vi.fn(),
}))

import { PointsPage } from './points-page'

const SEASON = {
  id: 's1',
  name: 'Setembro',
  starts_at: '2026-09-01T03:00:00Z',
  ends_at: '2026-10-01T03:00:00Z',
  team_goal_amount: 0,
  xp_per_level: 400,
  is_active: true,
  days_left: 15,
}
const ADMIN = makeMe({ role: 'admin' })

/** Regra do catálogo (DATA-MODEL §13.4) — nenhuma pessoa fictícia. */
const rule = (over: Partial<PointRuleRow>): PointRuleRow => ({
  id: over.id ?? 'r1',
  name: 'Venda realizada',
  metric: 'sale',
  points: 100,
  coins: 100,
  trigger_kind: 'manual',
  amount_step: null,
  requires_amount: true,
  is_active: true,
  sort_order: 10,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...over,
})

/** Lançamento do próprio gestor de teste (usuário da sessão), sem terceiros. */
const entry = (over: Partial<VPointEntryHistory>): VPointEntryHistory => ({
  entry_id: over.entry_id ?? 'e1',
  profile_id: ADMIN.id,
  full_name: ADMIN.full_name,
  avatar_path: null,
  color: ADMIN.color,
  season_id: 's1',
  source: 'rule',
  metric: 'sale',
  rule_id: 'r1',
  rule_name: 'Venda realizada',
  quantity: 1,
  amount: 8500,
  base_points: 100,
  multiplier: 1,
  points: 100,
  coins: 100,
  reason: null,
  special_event_name: null,
  occurred_at: '2026-09-15T15:00:00Z',
  created_at: '2026-09-15T15:00:00Z',
  created_by: ADMIN.id,
  created_by_name: ADMIN.full_name,
  reverses_entry_id: null,
  reversed_by_entry_id: null,
  is_reversed: false,
  ...over,
})

beforeEach(() => {
  bootstrap = makeBootstrap({ season: SEASON, me: ADMIN })
  getPointRules.mockReset().mockResolvedValue([])
  getEntriesHistory.mockReset().mockResolvedValue({ rows: [], total: 0 })
})

describe('PointsPage', () => {
  test('aba Regras vazia mostra EmptyState e botão "Nova regra"', async () => {
    renderInRouter(<PointsPage tab="regras" />)
    expect(await screen.findByText('Nenhuma regra cadastrada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nova regra/ })).toBeInTheDocument()
    expect(getPointRules).toHaveBeenCalledWith({ includeInactive: true })
  })

  test('aba Regras com catálogo lista nome, pontos, moedas e status', async () => {
    getPointRules.mockResolvedValue([
      rule({}),
      rule({
        id: 'r2',
        name: 'Reunião realizada',
        metric: 'meeting_held',
        points: 20,
        coins: 20,
        is_active: false,
        requires_amount: false,
      }),
    ])
    renderInRouter(<PointsPage tab="regras" />)
    expect((await screen.findAllByText('Venda realizada')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('100 pts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inativa').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Editar Venda realizada' }).length).toBeGreaterThan(0)
  })

  test('aba Lançar sem regra manual ativa mostra estado vazio e o formulário manual', async () => {
    renderInRouter(<PointsPage tab="lancar" />)
    expect(await screen.findByText('Nenhuma regra manual ativa')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lançamento manual' })).toBeInTheDocument()
    expect(getPointRules).toHaveBeenCalledWith({ includeInactive: false })
  })

  test('aba Lançar sem temporada ativa desabilita o botão e aponta para temporadas', async () => {
    bootstrap = makeBootstrap({ season: null, me: ADMIN })
    getPointRules.mockResolvedValue([rule({})])
    renderInRouter(<PointsPage tab="lancar" />)
    expect(await screen.findByRole('button', { name: 'Lançar pontos' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Criar/ativar temporada' })).toBeInTheDocument()
  })

  test('aba Histórico vazia (banco recém-instalado)', async () => {
    renderInRouter(<PointsPage tab="historico" />)
    expect(await screen.findByText('Nenhum lançamento ainda')).toBeInTheDocument()
    expect(getEntriesHistory).toHaveBeenCalledWith({ profileId: null, page: 0, pageSize: 25 })
  })

  test('aba Histórico com dados mostra estorno marcado como is_reversed e sem botão de estornar', async () => {
    getEntriesHistory.mockResolvedValue({
      rows: [
        entry({ is_reversed: true, reversed_by_entry_id: 'e2' }),
        entry({
          entry_id: 'e2',
          reverses_entry_id: 'e1',
          points: -100,
          coins: -100,
          reason: 'Lançamento de teste',
          created_at: '2026-09-15T16:00:00Z',
        }),
      ],
      total: 2,
    })
    renderInRouter(<PointsPage tab="historico" />)
    expect((await screen.findAllByText('Estornado')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Estorno').length).toBeGreaterThan(0)
    expect(screen.getAllByText('R$ 8.500').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Estornar lançamento/ })).not.toBeInTheDocument()
  })
})
