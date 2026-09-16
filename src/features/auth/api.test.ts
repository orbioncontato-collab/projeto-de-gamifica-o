import { beforeEach, describe, expect, test, vi } from 'vitest'

const rpc = vi.fn()
const signUpMock = vi.fn()
const updateUser = vi.fn()
const signInWithPassword = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      updateUser: (...args: unknown[]) => updateUser(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: { from: () => ({}) },
    from: () => ({}),
  },
  callRpc: async (name: string, args?: unknown) => {
    const { data, error } = await rpc(name, args)
    if (error) throw new Error(error.message)
    return data
  },
  unwrap: async (q: Promise<{ data: unknown; error: unknown }>) => (await q).data,
  avatarObjectPath: (id: string) => `${id}/avatar.jpg`,
  AVATAR_MAX_BYTES: 1_572_864,
  AVATAR_MIME: ['image/jpeg', 'image/png', 'image/webp'],
}))

import { AuthFormError, signIn, signUp } from './api'

const input = { fullName: 'Nome Sobrenome', email: 'a@b.com', password: 'senha1234' }
const sessionResult = {
  data: { user: { identities: [{ id: 'i' }] }, session: { access_token: 't' } },
  error: null,
}

beforeEach(() => {
  rpc.mockReset()
  signUpMock.mockReset()
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null })
  signInWithPassword.mockReset()
})

describe('signUp — first admin', () => {
  test('does not validate code, sends metadata without team_code and returns awaitsApproval=false', async () => {
    signUpMock.mockResolvedValue(sessionResult)
    const r = await signUp({ ...input, mode: 'first_admin' })
    expect(rpc).not.toHaveBeenCalled()
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'senha1234',
      options: { data: { full_name: 'Nome Sobrenome' } },
    })
    expect(updateUser).not.toHaveBeenCalled()
    expect(r).toEqual({ needsEmailConfirmation: false, awaitsApproval: false })
  })
})

describe('signUp — team code', () => {
  test('validate_team_code=false aborts with field error and never calls signUp', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await expect(signUp({ ...input, mode: 'team_code', teamCode: 'A3F9C21B7E04' })).rejects.toMatchObject({
      field: 'teamCode',
      message: 'Código da equipe inválido.',
    })
    expect(rpc).toHaveBeenCalledWith('validate_team_code', { p_code: 'A3F9C21B7E04' })
    expect(signUpMock).not.toHaveBeenCalled()
  })
  test('RPC failure (network) does not block signUp; team_code goes in metadata and is cleared after', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'FetchError' } })
    signUpMock.mockResolvedValue(sessionResult)
    const r = await signUp({ ...input, mode: 'team_code', teamCode: 'A3F9C21B7E04' })
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { data: { full_name: 'Nome Sobrenome', team_code: 'A3F9C21B7E04' } },
      }),
    )
    expect(updateUser).toHaveBeenCalledWith({ data: { team_code: null } })
    expect(r).toEqual({ needsEmailConfirmation: false, awaitsApproval: true })
  })
  test('"Database error saving new user" becomes the team-code hint on the field', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'unexpected_failure', message: 'Database error saving new user' },
    })
    await expect(signUp({ ...input, mode: 'team_code', teamCode: 'A3F9C21B7E04' })).rejects.toMatchObject({
      field: 'teamCode',
      message: 'Não foi possível concluir o cadastro. Verifique o código.',
    })
  })
  test('identities.length === 0 → e-mail já cadastrado', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    signUpMock.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null })
    await expect(signUp({ ...input, mode: 'team_code', teamCode: 'A3F9C21B7E04' })).rejects.toMatchObject({
      field: 'email',
      message: 'Este e-mail já está cadastrado.',
    })
  })
  test('session === null → needsEmailConfirmation (updateUser not called yet)', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    signUpMock.mockResolvedValue({
      data: { user: { identities: [{ id: 'i' }] }, session: null },
      error: null,
    })
    const r = await signUp({ ...input, mode: 'team_code', teamCode: 'A3F9C21B7E04' })
    expect(r).toEqual({ needsEmailConfirmation: true, awaitsApproval: true })
    expect(updateUser).not.toHaveBeenCalled()
  })
  test('updateUser failure does not block the flow', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    signUpMock.mockResolvedValue(sessionResult)
    updateUser.mockRejectedValue(new Error('offline'))
    await expect(signUp({ ...input, mode: 'team_code', teamCode: 'A3F9C21B7E04' })).resolves.toEqual({
      needsEmailConfirmation: false,
      awaitsApproval: true,
    })
  })
})

describe('signIn', () => {
  test('invalid_credentials → "E-mail ou senha inválidos." as form error', async () => {
    signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    const err = await signIn({ email: ' a@b.com ', password: 'x' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AuthFormError)
    expect((err as AuthFormError).field).toBe('form')
    expect((err as AuthFormError).message).toBe('E-mail ou senha inválidos.')
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'x' })
  })
  test('resolves on success', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: null })
    await expect(signIn({ email: 'a@b.com', password: 'x' })).resolves.toBeUndefined()
  })
})
