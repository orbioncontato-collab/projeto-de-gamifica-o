import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RewardRow, VRedemption, VWallet } from '@/lib/database.types'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe, type Me } from '@/features/auth/bootstrap-query'
import type { RecentCredit } from '../api'
import { EMPTY_WALLET } from '../rewards-utils'

const me: { current: Me } = { current: toMe(makeBootstrap()) }
const getWallet = vi.fn<() => Promise<VWallet | null>>()
const getRecentCredits = vi.fn<() => Promise<RecentCredit[]>>()
const getRewardsCatalog = vi.fn<() => Promise<RewardRow[]>>()
const getMyRedemptions = vi.fn<() => Promise<VRedemption[]>>()
const redeemReward = vi.fn<(id: string) => Promise<{ redemption_id: string; coins_balance: number }>>()

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
  getWallet: () => getWallet(),
  getRecentCredits: () => getRecentCredits(),
  getRewardsCatalog: () => getRewardsCatalog(),
  getMyRedemptions: () => getMyRedemptions(),
  getRedemptionsAdmin: vi.fn(),
  redeemReward: (id: string) => redeemReward(id),
  handleRedemption: vi.fn(),
  saveReward: vi.fn(),
  deleteReward: vi.fn(),
}))

import { RewardsPage } from './rewards-page'

/** Item do catálogo do seed (DATA-MODEL §13.7) — sem pessoas fictícias. */
const reward = (over: Partial<RewardRow> = {}): RewardRow => ({
  id: 'r1',
  name: 'R$ 20 iFood',
  category: 'Voucher',
  value_amount: 20,
  cost_coins: 500,
  stock: null,
  icon: '🍔',
  is_active: true,
  sort_order: 1,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...over,
})

beforeEach(() => {
  me.current = toMe(makeBootstrap())
  getWallet.mockReset().mockResolvedValue(null)
  getRecentCredits.mockReset().mockResolvedValue([])
  getRewardsCatalog.mockReset().mockResolvedValue([])
  getMyRedemptions.mockReset().mockResolvedValue([])
  redeemReward.mockReset()
})

describe('RewardsPage (banco recém-instalado)', () => {
  test('wallet shows zeros, no credits, empty store and no NaN', async () => {
    renderInRouter(<RewardsPage tab="loja" />)
    expect(await screen.findByTestId('wallet-balance')).toHaveTextContent('0')
    expect(screen.getByText('Como ganhar moedas: vendas, missões e metas.')).toBeInTheDocument()
    expect(screen.getAllByText('+0')).toHaveLength(3)
    expect(await screen.findByText('Nenhum crédito ainda')).toBeInTheDocument()
    expect(await screen.findByText('A loja ainda está vazia')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })

  test('"Meus pedidos" tab shows the empty state', async () => {
    renderInRouter(<RewardsPage tab="pedidos" />)
    expect(await screen.findByText('Você ainda não resgatou nada')).toBeInTheDocument()
  })
})

describe('RewardsPage (com dados)', () => {
  test('fixed origins come from v_wallet, credit title falls back to the rule name, store shows "Faltam N moedas"', async () => {
    getWallet.mockResolvedValue({
      ...EMPTY_WALLET,
      profile_id: me.current.me.id,
      coins_balance: 120,
      coins_earned: 120,
      coins_from_sales: 100,
      coins_from_missions: 20,
    })
    getRecentCredits.mockResolvedValue([
      {
        id: 'e1',
        coins: 100,
        reason: null,
        source: 'rule',
        metric: 'sale',
        occurred_at: new Date().toISOString(),
        rule: { name: 'Venda realizada' },
      },
    ])
    getRewardsCatalog.mockResolvedValue([reward()])
    me.current = toMe(makeBootstrap({ me: makeMe({ coins_balance: 120 }) }))

    renderInRouter(<RewardsPage tab="loja" />)
    expect(await screen.findByTestId('wallet-balance')).toHaveTextContent('120')
    expect(screen.getByText('+100')).toBeInTheDocument()
    expect(screen.getByText('+20')).toBeInTheDocument()
    expect(await screen.findByText('Venda realizada')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'R$ 20 iFood' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Faltam 380 moedas/ })).toBeDisabled()
  })

  test('redeem flow: confirm dialog → rpc → bootstrap coins_balance updated', async () => {
    getRewardsCatalog.mockResolvedValue([reward()])
    redeemReward.mockResolvedValue({ redemption_id: 'rd1', coins_balance: 200 })
    me.current = toMe(makeBootstrap({ me: makeMe({ coins_balance: 700 }) }))
    const user = userEvent.setup()
    const { queryClient } = renderInRouter(<RewardsPage tab="loja" />)
    const setQueryData = vi.spyOn(queryClient, 'setQueryData')

    await user.click(await screen.findByRole('button', { name: 'Resgatar' }))
    expect(await screen.findByRole('heading', { name: 'Resgatar R$ 20 iFood?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar resgate' }))

    await waitFor(() => expect(redeemReward).toHaveBeenCalledWith('r1'))
    await waitFor(() => expect(setQueryData).toHaveBeenCalledWith(['bootstrap'], expect.any(Function)))
    // o chip lê `bootstrap.me.coins_balance`: o updater aplica o saldo devolvido pela RPC (gcTime 0 no teste)
    const updater = setQueryData.mock.calls.find((c) => c[0][0] === 'bootstrap')?.[1] as (
      prev: ReturnType<typeof makeBootstrap>,
    ) => ReturnType<typeof makeBootstrap>
    expect(toMe(updater(makeBootstrap({ me: makeMe({ coins_balance: 700 }) }))).me.coins_balance).toBe(200)
  })

  test('out-of-stock reward shows "Esgotado" and my redemptions list status + notes', async () => {
    getRewardsCatalog.mockResolvedValue([reward({ stock: 0 })])
    getMyRedemptions.mockResolvedValue([
      {
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
        status: 'cancelled',
        requested_at: '2026-09-10T12:00:00Z',
        handled_at: '2026-09-11T12:00:00Z',
        handled_by_name: null,
        notes: 'Sem estoque no fornecedor',
        spin_id: null,
      },
    ])
    const { unmount } = renderInRouter(<RewardsPage tab="loja" />)
    expect(await screen.findByRole('button', { name: /Esgotado/ })).toBeDisabled()
    unmount()
    renderInRouter(<RewardsPage tab="pedidos" />)
    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByText('Sem estoque no fornecedor')).toBeInTheDocument()
  })
})
