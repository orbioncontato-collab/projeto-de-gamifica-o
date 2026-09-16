import { describe, expect, test } from 'vitest'
import {
  authErrorMessage,
  isDatabaseErrorSavingUser,
  loginSchema,
  normalizeTeamCode,
  SIGNUP_DB_ERROR_MESSAGE,
  signupFirstAdminSchema,
  signupTeamCodeSchema,
} from './schemas'

const base = {
  fullName: 'Nome Sobrenome',
  email: 'a@b.com',
  password: 'senha1234',
  confirmPassword: 'senha1234',
}

describe('loginSchema', () => {
  test('accepts e-mail and password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
  test('rejects invalid e-mail and empty password with pt-BR messages', () => {
    const r = loginSchema.safeParse({ email: 'nope', password: '' })
    expect(r.success).toBe(false)
    const messages = r.error?.issues.map((i) => i.message) ?? []
    expect(messages).toContain('Informe um e-mail válido.')
    expect(messages).toContain('Informe a senha.')
  })
})

describe('signup schemas', () => {
  test('first admin: no team code required', () => {
    expect(signupFirstAdminSchema.safeParse(base).success).toBe(true)
  })
  test('rejects password mismatch on confirmPassword', () => {
    const r = signupFirstAdminSchema.safeParse({ ...base, confirmPassword: 'outra1234' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['confirmPassword'])
    expect(r.error?.issues[0]?.message).toBe('As senhas não conferem.')
  })
  test('rejects short password (min 8)', () => {
    const r = signupFirstAdminSchema.safeParse({ ...base, password: '1234567', confirmPassword: '1234567' })
    expect(r.success).toBe(false)
    expect(r.error?.issues.map((i) => i.message)).toContain('A senha precisa ter pelo menos 8 caracteres.')
  })
  test('team code: normalizes mask and case to 12 chars A-Z0-9', () => {
    const r = signupTeamCodeSchema.safeParse({ ...base, teamCode: 'a3f9-c21b-7e04' })
    expect(r.success).toBe(true)
    expect(r.data?.teamCode).toBe('A3F9C21B7E04')
  })
  test('team code: rejects wrong length with catalog message', () => {
    const r = signupTeamCodeSchema.safeParse({ ...base, teamCode: 'ABC' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('Código da equipe inválido.')
  })
})

describe('normalizeTeamCode', () => {
  test('uppercases and strips spaces and hyphens', () => {
    expect(normalizeTeamCode(' a3f9-c21b 7e04 ')).toBe('A3F9C21B7E04')
  })
})

describe('authErrorMessage', () => {
  test('maps invalid_credentials', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'E-mail ou senha inválidos.',
    )
  })
  test('maps user_already_exists', () => {
    expect(authErrorMessage({ code: 'user_already_exists', message: 'User already registered' })).toBe(
      'Este e-mail já está cadastrado.',
    )
  })
  test('"Database error saving new user" becomes the team-code hint', () => {
    const e = { code: 'unexpected_failure', message: 'Database error saving new user' }
    expect(isDatabaseErrorSavingUser(e)).toBe(true)
    expect(authErrorMessage(e)).toBe(SIGNUP_DB_ERROR_MESSAGE)
  })
  test('falls back to message-based detection and generic text', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toBe('E-mail ou senha inválidos.')
    expect(authErrorMessage({ message: 'something else' })).toBe(
      'Não foi possível concluir. Tente novamente.',
    )
    expect(authErrorMessage(null)).toBe('Não foi possível concluir. Tente novamente.')
  })
})
