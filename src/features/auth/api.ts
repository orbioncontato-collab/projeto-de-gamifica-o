import { callRpc, supabase } from '@/lib/supabase'
import {
  authErrorMessage,
  isDatabaseErrorSavingUser,
  SIGNUP_DB_ERROR_MESSAGE,
  type SignupMode,
} from './schemas'

export { assertAvatarFile, cleanupAvatarFolder, uploadMyAvatar } from './avatar-api'

/** Erro de formulário de acesso: já vem com mensagem pt-BR e o campo a destacar. */
export type AuthFormField = 'email' | 'password' | 'teamCode' | 'form'
export class AuthFormError extends Error {
  constructor(
    public field: AuthFormField,
    message: string,
  ) {
    super(message)
    this.name = 'AuthFormError'
  }
}

const fieldForAuthCode = (code: string | undefined): AuthFormField => {
  if (code === 'user_already_exists' || code === 'email_exists' || code === 'email_address_invalid')
    return 'email'
  if (code === 'weak_password') return 'password'
  return 'form'
}

/** rpc `signup_mode` (executável por `anon`): `'first_admin'` só enquanto não existe gestor. */
export async function getSignupMode(): Promise<SignupMode> {
  return callRpc('signup_mode')
}

/** rpc `validate_team_code` (só UX — DATA-MODEL §7.1): `false` = código inválido. Pode lançar por rede. */
export async function validateTeamCode(code: string): Promise<boolean> {
  const result = await callRpc('validate_team_code', { p_code: code })
  return result === true
}

export interface SignInInput {
  email: string
  password: string
}

export async function signIn({ email, password }: SignInInput): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error)
    throw new AuthFormError(
      error.code === 'invalid_credentials' ? 'form' : fieldForAuthCode(error.code),
      authErrorMessage(error),
    )
}

export interface SignUpInput {
  mode: SignupMode
  fullName: string
  email: string
  password: string
  teamCode?: string | undefined
}
export interface SignUpResult {
  needsEmailConfirmation: boolean
  awaitsApproval: boolean
}

/**
 * Cadastro (FRONTEND-ARCH §3.3): (1) modo `team_code` → pré-valida o código (`false` aborta; **throw** de rede é ignorado —
 * a validação que vale é a do trigger `handle_new_user`); (2) `auth.signUp` com metadata `{ full_name, team_code? }`;
 * (3) `identities.length === 0` → e-mail já cadastrado; (4) sem sessão → confirmar e-mail; (5) com sessão → limpa
 * `team_code` da metadata (best-effort; `getBootstrap` repete enquanto existir).
 */
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const isTeamMode = input.mode === 'team_code'
  const teamCode = isTeamMode ? (input.teamCode ?? '') : undefined
  if (isTeamMode) {
    if (!teamCode) throw new AuthFormError('teamCode', 'Código da equipe inválido.')
    const valid = await validateTeamCode(teamCode).catch(() => true)
    if (!valid) throw new AuthFormError('teamCode', 'Código da equipe inválido.')
  }

  const data: Record<string, string> = { full_name: input.fullName.trim() }
  if (isTeamMode && teamCode) data['team_code'] = teamCode
  const { data: result, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data },
  })
  if (error) {
    if (isDatabaseErrorSavingUser(error))
      throw new AuthFormError(isTeamMode ? 'teamCode' : 'form', SIGNUP_DB_ERROR_MESSAGE)
    throw new AuthFormError(fieldForAuthCode(error.code), authErrorMessage(error))
  }
  if (result.user?.identities?.length === 0)
    throw new AuthFormError('email', 'Este e-mail já está cadastrado.')
  if (!result.session) return { needsEmailConfirmation: true, awaitsApproval: isTeamMode }

  if (isTeamMode) {
    await supabase.auth
      .updateUser({ data: { team_code: null } })
      .then(() => undefined)
      .catch(() => undefined)
  }
  return { needsEmailConfirmation: false, awaitsApproval: isTeamMode }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(authErrorMessage(error))
}

/** Só funciona com SMTP próprio — a UI mostra o aviso "se o e-mail não chegar, peça ao gestor". */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim(),
    redirectTo ? { redirectTo } : undefined,
  )
  if (error) throw new AuthFormError('email', authErrorMessage(error))
}
