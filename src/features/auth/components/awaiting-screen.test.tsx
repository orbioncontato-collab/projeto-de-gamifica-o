import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import type { BootstrapPayload } from '@/lib/database.types'
import { makeBootstrap, renderInRouter } from '../test-utils'

type State = {
  isPending: boolean
  isError: boolean
  isFetching: boolean
  data?: BootstrapPayload
  error?: unknown
  refetch: () => void
}
const state: { current: State } = {
  current: { isPending: true, isError: false, isFetching: false, refetch: vi.fn() },
}

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } },
  callRpc: vi.fn(),
  unwrap: vi.fn(),
  avatarUrl: () => null,
  avatarObjectPath: () => '',
  AVATAR_MAX_BYTES: 1,
  AVATAR_MIME: [],
}))
vi.mock('../bootstrap-query', () => ({
  useBootstrap: () => state.current,
  useMe: () => {
    throw new Error('not used')
  },
  useMeOptional: () => null,
}))

import { AwaitingScreen } from './awaiting-screen'

beforeEach(() => {
  state.current = { isPending: true, isError: false, isFetching: false, refetch: vi.fn() }
})

describe('AwaitingScreen', () => {
  test('loading state', async () => {
    renderInRouter(<AwaitingScreen />)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Verificando seu cadastro')
  })
  test('pending: explains approval and offers "Verificar novamente" + "Sair"', async () => {
    state.current = {
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
      data: makeBootstrap({ me: { id: 'x', full_name: 'Pessoa Pendente', status: 'pending' } }),
    }
    renderInRouter(<AwaitingScreen />)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Seu cadastro está aguardando aprovação do gestor',
    )
    expect(screen.getByText(/Olá, Pessoa\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Verificar novamente/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sair/ })).toBeInTheDocument()
  })
  test('inactive: "Seu acesso foi desativado" with only "Sair"', async () => {
    state.current = {
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
      data: makeBootstrap({ me: { id: 'x', full_name: 'Pessoa Inativa', status: 'inactive' } }),
    }
    renderInRouter(<AwaitingScreen />)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Seu acesso foi desativado')
    expect(screen.getByText('Fale com o gestor da sua equipe.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Verificar novamente/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sair/ })).toBeInTheDocument()
  })
  test('error: ErrorState with retry', async () => {
    state.current = {
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
      error: new Error('falhou'),
    }
    renderInRouter(<AwaitingScreen />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument()
  })
})
