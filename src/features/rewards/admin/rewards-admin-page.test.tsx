import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RewardRow, VRedemption } from '@/lib/database.types'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe, type Me } from '@/features/auth/bootstrap-query'

const me: { current: Me } = { current: toMe(makeBootstrap({ me: makeMe({ role: 'admin' }) })) }
const getRewardsCatalog = vi.fn<() => Promise<RewardRow[]>>()
const getRedemptionsAdmin = vi.fn<(status: string | null) => Promise<VRedemption[]>>()
const handleRedemption = vi.fn<(input: unknown) => Promise<unknown>>()
const saveReward = vi.fn<(input: unknown) => Promise<unknown>>()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))
vi.mock('@/features/auth/bootstrap-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => me.current,
  useMeOptional: () => me.current,
}))
vi.mock('../api', () => ({
  RECENT_CREDITS_LIMIT: 3,
  getWallet: vi.fn(),
  getRecentCredits: vi.fn(),
  getRewardsCatalog: () => getRewardsCatalog(),
  getMyRedemptions: vi.fn(),
  getRedemptionsAdmin: (status: string | null) => getRedemptionsAdmin(status),
  redeemReward: vi.fn(),
  handleRedemption: (input: unknown) => handleRedemption(input),
  saveReward: (input: unknown) => saveReward(input),
  deleteReward: vi.fn(),
}))

import { RewardsAdminPage } from './rewards-admin-page'

const redemption = (over: Partial<VRedemption> = {}): VRedemption => ({
  redemption_id: 'rd1',
  source: 'store',
  reward_id: 'r1',
  reward_icon: '🍔',
  reward_category: 'Voucher',
  profile_id: me.current.me.id,
  person_name: me.current.me.full_name,
  avatar_path: null,
  title: 'R$ 20 iFood',
  cost_coins: 500,
  value_amount: 20,
  status: 'requested',
  requested_at: '2026-09-10T12:00:00Z',
  handled_at: null,
  handled_by_name: null,
  notes: null,
  spin_id: null,
  ...over,
})

beforeEach(() => {
  getRewardsCatalog.mockReset().mockResolvedValue([])
  getRedemptionsAdmin.mockReset().mockResolvedValue([])
  handleRedemption.mockReset().mockResolvedValue({})
  saveReward.mockReset().mockResolvedValue({})
})

describe('RewardsAdminPage › Pedidos', () => {
  test('empty queue shows "Nenhum pedido pendente"', async () => {
    renderInRouter(<RewardsAdminPage tab="pedidos" status={null} />)
    expect(await screen.findByText('Nenhum pedido pendente')).toBeInTheDocument()
    expect(getRedemptionsAdmin).toHaveBeenCalledWith(null)
  })

  test('requested order shows Aprovar/Entregar/Cancelar; cancel sends notes to handle_redemption', async () => {
    getRedemptionsAdmin.mockResolvedValue([redemption()])
    const user = userEvent.setup()
    renderInRouter(<RewardsAdminPage tab="pedidos" status="requested" />)
    expect(await screen.findByText('R$ 20 iFood')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entregar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('heading', { name: 'Cancelar pedido' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Notas para o colaborador'), 'Sem estoque no fornecedor')
    await user.click(screen.getByRole('button', { name: 'Cancelar', hidden: false }))
    await waitFor(() =>
      expect(handleRedemption).toHaveBeenCalledWith({
        id: 'rd1',
        action: 'cancel',
        notes: 'Sem estoque no fornecedor',
      }),
    )
  })

  test('delivered order has no actions', async () => {
    getRedemptionsAdmin.mockResolvedValue([
      redemption({ status: 'delivered', handled_at: '2026-09-11T12:00:00Z' }),
    ])
    renderInRouter(<RewardsAdminPage tab="pedidos" status="delivered" />)
    expect(await screen.findByText('Entregue')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entregar' })).not.toBeInTheDocument()
  })
})

describe('RewardsAdminPage › Catálogo', () => {
  test('empty catalog shows the empty state; editor validates and saves an upsert payload', async () => {
    const user = userEvent.setup()
    renderInRouter(<RewardsAdminPage tab="catalogo" status={null} />)
    expect(await screen.findByText('Nenhuma recompensa cadastrada')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Cadastrar recompensa' })[0]!)
    expect(await screen.findByRole('heading', { name: 'Cadastrar recompensa' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Campo obrigatório.')
    expect(saveReward).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Nome/), 'R$ 20 iFood')
    await user.clear(screen.getByLabelText(/Custo em moedas/))
    await user.type(screen.getByLabelText(/Custo em moedas/), '500')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    await waitFor(() => expect(saveReward).toHaveBeenCalled())
    expect(saveReward.mock.calls[0]?.[0]).toMatchObject({
      name: 'R$ 20 iFood',
      cost_coins: 500,
      stock: null,
      is_active: true,
    })
    expect(saveReward.mock.calls[0]?.[0]).not.toHaveProperty('id')
  })
})
