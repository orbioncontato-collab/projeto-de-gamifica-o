import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { BootstrapPayload, VWheelQueue, WheelPrizeRow, WheelRow } from '@/lib/database.types'
import type { WheelConfig } from '../api'

const getWheelConfig = vi.fn()
const getWheelQueue = vi.fn()
const getWheelHistory = vi.fn()
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
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getWheelConfig: (...a: unknown[]) => getWheelConfig(...a),
  getWheelQueue: (...a: unknown[]) => getWheelQueue(...a),
  getWheelHistory: (...a: unknown[]) => getWheelHistory(...a),
}))

import { WheelPage } from './wheel-page'

const ME = makeMe()

/** Catálogo do seed (DATA-MODEL §13): só prêmios, nenhuma pessoa. */
const wheel = (kind: WheelRow['kind']): WheelRow => ({
  id: `w-${kind}`,
  kind,
  name: kind === 'classic' ? 'Roleta Clássica' : 'Roleta Premium',
  is_active: true,
  updated_at: '2026-01-01T00:00:00Z',
})
const prize = (wheelId: string, i: number, label: string): WheelPrizeRow => ({
  id: `${wheelId}-p${i}`,
  wheel_id: wheelId,
  label,
  kind: 'points',
  value: 100,
  weight: 1,
  color: null,
  sort_order: i,
  is_active: true,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  updated_by: null,
})
const CLASSIC_LABELS = ['R$ 10 PIX', '100 pontos', 'R$ 20 PIX', 'Giro extra', 'R$ 30 iFood', '200 pontos']
const PREMIUM_LABELS = [
  'R$ 50 PIX',
  '500 pontos',
  'R$ 100 PIX',
  'Giro extra',
  'R$ 50 iFood',
  '1.000 pontos',
  '2x pontos',
  'Mystery Box',
]
const CONFIG: WheelConfig = {
  classic: { wheel: wheel('classic'), prizes: CLASSIC_LABELS.map((l, i) => prize('w-classic', i, l)) },
  premium: { wheel: wheel('premium'), prizes: PREMIUM_LABELS.map((l, i) => prize('w-premium', i, l)) },
}
const queueRow = (over: Partial<VWheelQueue>): VWheelQueue => ({
  queue_id: 'q1',
  position: 1,
  profile_id: ME.id,
  person_name: ME.full_name,
  avatar_path: null,
  color: null,
  source: 'manual',
  wheel_id: 'w-premium',
  wheel_kind: 'premium',
  wheel_name: 'Roleta Premium',
  attempts_allowed: 2,
  attempts_used: 0,
  attempts_remaining: 2,
  status: 'active',
  released_at: '2026-09-15T12:00:00Z',
  created_at: '2026-09-15T11:00:00Z',
  pending_spin_id: null,
  pending_prize_label: null,
  pending_prize_kind: null,
  pending_resolved_label: null,
  pending_spun_at: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  bootstrap = makeBootstrap()
  getWheelConfig.mockResolvedValue(CONFIG)
  getWheelQueue.mockResolvedValue([])
  getWheelHistory.mockResolvedValue([])
})

describe('WheelPage (colaborador)', () => {
  test('banco recém-instalado: roda com os prêmios do seed, GIRO LIVRE e histórico vazio', async () => {
    renderInRouter(<WheelPage />)
    expect(await screen.findByText('GIRO LIVRE')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /Roleta Clássica com 6 prêmios/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /GIRAR ROLETA/ })).toBeEnabled()
    expect(await screen.findByText('Nenhuma aprovação ainda')).toBeInTheDocument()
    // colaborador não vê os painéis da fila
    expect(screen.queryByText('Fila da roleta')).not.toBeInTheDocument()
    expect(screen.queryByText('Ninguém na fila')).not.toBeInTheDocument()
  })

  test('vez de outra pessoa: seletor travado na roleta da fila e botão "Aguardando liberação"', async () => {
    getWheelQueue.mockResolvedValue([queueRow({ profile_id: 'other', person_name: 'Participante de Teste' })])
    renderInRouter(<WheelPage />)
    expect(await screen.findByText(/VEZ DE PARTICIPANTE DE TESTE • Tentativa 1 de 2/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aguardando liberação' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Clássica/ })).toBeDisabled()
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /Roleta Premium com 8 prêmios/ })).toBeInTheDocument(),
    )
  })

  test('minha vez: posso girar; com prêmio pendente vejo "VER PRÊMIO"', async () => {
    getWheelQueue.mockResolvedValue([queueRow({})])
    const { unmount } = renderInRouter(<WheelPage />)
    expect(await screen.findByRole('button', { name: /GIRAR ROLETA • Usuário de Teste/ })).toBeEnabled()
    unmount()
    getWheelQueue.mockResolvedValue([
      queueRow({
        pending_spin_id: 'sp1',
        pending_prize_label: 'Giro extra',
        pending_prize_kind: 'extra_spin',
      }),
    ])
    renderInRouter(<WheelPage />)
    expect(await screen.findByText('AGUARDANDO APROVAÇÃO • Giro extra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /VER PRÊMIO/ })).toBeEnabled()
  })
})

describe('WheelPage (gestor)', () => {
  test('mostra painéis da fila com "Ninguém na fila" e formulário habilitado', async () => {
    bootstrap = makeBootstrap({ me: makeMe({ role: 'admin' }) })
    renderInRouter(<WheelPage />)
    expect(await screen.findByText('Fila da roleta')).toBeInTheDocument()
    expect(await screen.findByText('Ninguém na fila')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: /Adicionar à fila/ })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    for (const b of buttons) expect(b).toBeEnabled()
  })

  test('fila com dados: linha com posição, restantes e "Liberado"', async () => {
    bootstrap = makeBootstrap({ me: makeMe({ role: 'admin' }) })
    getWheelQueue.mockResolvedValue([
      queueRow({}),
      queueRow({
        queue_id: 'q2',
        position: 2,
        profile_id: null,
        person_name: 'Convidado de Teste',
        status: 'waiting',
        released_at: null,
        attempts_allowed: 1,
        attempts_remaining: 1,
      }),
    ])
    renderInRouter(<WheelPage />)
    expect((await screen.findAllByText('Convidado de Teste')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /Liberado/ }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /Liberar giro/ }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('2 restantes').length).toBeGreaterThanOrEqual(1)
  })
})
