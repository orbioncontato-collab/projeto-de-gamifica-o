import { beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installZodPtBr } from '@/lib/forms'
import { renderInRouter } from '../test-utils'

const signIn = vi.fn()
const signUp = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: {} },
  callRpc: vi.fn(),
  unwrap: vi.fn(),
  avatarUrl: () => null,
  avatarObjectPath: () => '',
  AVATAR_MAX_BYTES: 1,
  AVATAR_MIME: [],
}))
vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    signIn: (...a: unknown[]) => signIn(...a),
    signUp: (...a: unknown[]) => signUp(...a),
    requestPasswordReset: vi.fn(),
    getSignupMode: vi.fn(),
    signOut: vi.fn(),
  }
})

import { AuthFormError } from '../api'
import { LoginForm } from './login-form'
import { SignupForm } from './signup-form'
import { SignupSuccess } from './signup-success'

installZodPtBr()

beforeEach(() => {
  signIn.mockReset()
  signUp.mockReset()
})

describe('LoginForm', () => {
  test('shows "E-mail ou senha inválidos." on invalid credentials and keeps the button enabled', async () => {
    signIn.mockRejectedValue(new AuthFormError('form', 'E-mail ou senha inválidos.'))
    renderInRouter(<LoginForm />)
    await userEvent.type(await screen.findByLabelText(/E-mail/), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/^Senha/), 'senha-errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(signIn.mock.calls[0]?.[0]).toEqual({ email: 'a@b.com', password: 'senha-errada' })
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })
  test('validates before calling the API', async () => {
    renderInRouter(<LoginForm />)
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })
})

describe('SignupForm', () => {
  const fill = async () => {
    await userEvent.type(await screen.findByLabelText(/Nome completo/), 'Nome Sobrenome')
    await userEvent.type(screen.getByLabelText(/E-mail/), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/^Senha/), 'senha1234')
    await userEvent.type(screen.getByLabelText(/Confirmar senha/), 'senha1234')
  }
  test('first_admin: no team-code field, no approval notice', async () => {
    renderInRouter(<SignupForm mode="first_admin" onNeedsEmailConfirmation={() => undefined} />)
    expect(await screen.findByRole('button', { name: 'Criar conta de gestor' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Código da equipe/)).not.toBeInTheDocument()
    expect(screen.queryByText(/analisado por um gestor/)).not.toBeInTheDocument()
  })
  test('team_code: masks the code, shows the approval notice and puts the API field error on the field', async () => {
    signUp.mockRejectedValue(new AuthFormError('teamCode', 'Código da equipe inválido.'))
    renderInRouter(<SignupForm mode="team_code" onNeedsEmailConfirmation={() => undefined} />)
    await fill()
    const code = screen.getByLabelText(/Código da equipe/)
    await userEvent.type(code, 'a3f9c21b7e04')
    expect(code).toHaveValue('A3F9-C21B-7E04')
    expect(
      screen.getByText('Seu cadastro será analisado por um gestor antes de liberar o acesso.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }))
    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0]?.[0]).toMatchObject({ mode: 'team_code', teamCode: 'A3F9C21B7E04' })
    expect(await screen.findByText('Código da equipe inválido.')).toBeInTheDocument()
  })
  test('team_code: needsEmailConfirmation hands the result to the parent', async () => {
    const onNeeds = vi.fn()
    signUp.mockResolvedValue({ needsEmailConfirmation: true, awaitsApproval: true })
    renderInRouter(<SignupForm mode="team_code" onNeedsEmailConfirmation={onNeeds} />)
    await fill()
    await userEvent.type(screen.getByLabelText(/Código da equipe/), 'A3F9C21B7E04')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }))
    await waitFor(() =>
      expect(onNeeds).toHaveBeenCalledWith({ needsEmailConfirmation: true, awaitsApproval: true }),
    )
  })
})

describe('SignupSuccess', () => {
  test('e-mail variant mentions confirmation and manager approval', async () => {
    renderInRouter(<SignupSuccess needsEmailConfirmation awaitsApproval />)
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('Confirme seu e-mail')
    expect(screen.getByText(/aprovação de um gestor/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao login' })).toHaveAttribute('href', '/login')
  })
})
