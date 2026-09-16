import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeBootstrap, makeMe, renderInRouter } from '@/features/auth/test-utils'
import { toMe } from '@/features/auth/bootstrap-query'
import type { WheelPrizeRow, WheelRow } from '@/lib/database.types'
import type { WheelConfig } from '../api'

const getWheelConfig = vi.fn()
const saveWheelPrizes = vi.fn()

vi.mock('@/lib/supabase', () => ({ supabase: {}, callRpc: vi.fn(), unwrap: vi.fn(), avatarUrl: () => null }))
vi.mock('@/lib/realtime', () => ({
  subscribeToTables: () => () => undefined,
  useRealtimeInvalidate: () => undefined,
}))
vi.mock('@/features/auth/bootstrap-query', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/bootstrap-query')>()),
  useMe: () => toMe(makeBootstrap({ me: makeMe({ role: 'admin' }) })),
  useMeOptional: () => toMe(makeBootstrap({ me: makeMe({ role: 'admin' }) })),
}))
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getWheelConfig: (...a: unknown[]) => getWheelConfig(...a),
  getWheelQueue: vi.fn().mockResolvedValue([]),
  getWheelHistory: vi.fn().mockResolvedValue([]),
  saveWheelPrizes: (...a: unknown[]) => saveWheelPrizes(...a),
}))

import { PrizeEditor } from './prize-editor'

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
const CONFIG: WheelConfig = {
  classic: {
    wheel: wheel('classic'),
    prizes: ['R$ 10 PIX', '100 pontos', 'R$ 20 PIX'].map((l, i) => prize('w-classic', i, l)),
  },
  premium: {
    wheel: wheel('premium'),
    prizes: ['R$ 50 PIX', '500 pontos'].map((l, i) => prize('w-premium', i, l)),
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  getWheelConfig.mockResolvedValue(CONFIG)
})

describe('PrizeEditor', () => {
  test('lista os prêmios do seed, Salvar desabilitado sem alteração, pré-visualização com os setores', async () => {
    renderInRouter(<PrizeEditor />)
    expect(await screen.findByText('3 prêmios')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar prêmios/ })).toBeDisabled()
    expect(screen.getByRole('img', { name: /Roleta Clássica com 3 prêmios/ })).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('R$ 10 PIX').length).toBe(1)
  })

  test('recusa salvar com menos de 2 prêmios e não chama a RPC', async () => {
    const user = userEvent.setup()
    renderInRouter(<PrizeEditor />)
    const list = await screen.findByRole('list')
    const removeButtons = within(list).getAllByRole('button', { name: /Remover prêmio/ })
    await user.click(removeButtons[0] as HTMLElement)
    await user.click(within(list).getAllByRole('button', { name: /Remover prêmio/ })[0] as HTMLElement)
    expect(screen.getByText('1 prêmios')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: /Salvar prêmios/ })
    expect(save).toBeEnabled()
    await user.click(save)
    expect(await screen.findByRole('alert')).toHaveTextContent(/pelo menos 2 prêmios/)
    expect(saveWheelPrizes).not.toHaveBeenCalled()
  })

  test('salvar envia sort_order pela ordem da lista e re-renderiza com o retorno', async () => {
    const user = userEvent.setup()
    saveWheelPrizes.mockImplementation(async (input: { prizes: { label: string }[] }) =>
      input.prizes.map((p, i) => prize('w-classic', i, p.label)),
    )
    renderInRouter(<PrizeEditor />)
    await screen.findByText('3 prêmios')
    await user.click(screen.getAllByRole('button', { name: 'Mover para baixo' })[0] as HTMLElement)
    await user.click(screen.getByRole('button', { name: /Salvar prêmios/ }))
    await screen.findByText('3 prêmios')
    expect(saveWheelPrizes).toHaveBeenCalledTimes(1)
    const arg = saveWheelPrizes.mock.calls[0]?.[0] as {
      wheelKind: string
      prizes: { label: string; sort_order: number }[]
    }
    expect(arg.wheelKind).toBe('classic')
    expect(arg.prizes.map((p) => [p.label, p.sort_order])).toEqual([
      ['100 pontos', 0],
      ['R$ 10 PIX', 1],
      ['R$ 20 PIX', 2],
    ])
    expect(screen.getByRole('button', { name: /Salvar prêmios/ })).toBeDisabled()
  })
})
