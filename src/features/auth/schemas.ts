import { z } from 'zod'
import { zEmail, zPassword, zTeamCode, zText } from '@/lib/forms'

/** Esquemas dos formulários de acesso (FRONTEND-ARCH §3.3). Mensagens pt-BR. */

export const loginSchema = z.object({
  email: zEmail,
  password: z.string().min(1, 'Informe a senha.'),
})
export type LoginInput = z.input<typeof loginSchema>
export type LoginValues = z.output<typeof loginSchema>

const FULL_NAME_MAX = 80
const PASSWORD_MISMATCH = 'As senhas não conferem.'

const signupBase = z.object({
  fullName: zText(FULL_NAME_MAX, 3),
  email: zEmail,
  password: zPassword,
  confirmPassword: z.string().min(1, 'Confirme a senha.'),
})

/** Primeiro gestor da instalação: sem código da equipe. */
export const signupFirstAdminSchema = signupBase.refine((v) => v.password === v.confirmPassword, {
  message: PASSWORD_MISMATCH,
  path: ['confirmPassword'],
})

/** Colaborador: exige código da equipe (12 caracteres A-Z0-9, normalizado). */
export const signupTeamCodeSchema = signupBase
  .extend({ teamCode: zTeamCode })
  .refine((v) => v.password === v.confirmPassword, { message: PASSWORD_MISMATCH, path: ['confirmPassword'] })

export type SignupFormInput = z.input<typeof signupBase> & { teamCode?: string }
export type SignupFormValues = z.output<typeof signupBase> & { teamCode?: string }

export type SignupMode = 'first_admin' | 'team_code'

export const signupSchemaFor = (mode: SignupMode) =>
  mode === 'team_code' ? signupTeamCodeSchema : signupFirstAdminSchema

/** "a3f9c21b7e04" | "A3F9-C21B-7E04" → "A3F9C21B7E04" */
export const normalizeTeamCode = (raw: string): string => raw.toUpperCase().replace(/[\s-]/g, '')

/** Mensagens pt-BR para códigos do GoTrue (supabase-js `AuthError.code`). */
export const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha inválidos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_already_exists: 'Este e-mail já está cadastrado.',
  email_exists: 'Este e-mail já está cadastrado.',
  weak_password: 'A senha precisa ter pelo menos 8 caracteres.',
  signup_disabled: 'Cadastros estão desativados nesta instalação.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um instante e tente de novo.',
  over_email_send_rate_limit: 'Muitos e-mails enviados. Aguarde alguns minutos e tente de novo.',
  email_address_invalid: 'Informe um e-mail válido.',
  user_banned: 'Este acesso foi bloqueado. Fale com o gestor da sua equipe.',
  validation_failed: 'Verifique os dados informados.',
  request_timeout: 'A conexão demorou demais. Tente novamente.',
}

/** `Database error saving new user` = `INVALID_TEAM_CODE` do trigger chegando pelo GoTrue (FRONTEND-ARCH §3.3). */
export const SIGNUP_DB_ERROR_MESSAGE = 'Não foi possível concluir o cadastro. Verifique o código.'
export const AUTH_FALLBACK_MESSAGE = 'Não foi possível concluir. Tente novamente.'

export interface AuthErrorLike {
  message?: string | undefined
  code?: string | undefined
  status?: number | undefined
}

export const isDatabaseErrorSavingUser = (error: AuthErrorLike): boolean =>
  /database error saving new user/i.test(error.message ?? '')

/** Converte um erro do GoTrue em texto pt-BR. */
export function authErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return AUTH_FALLBACK_MESSAGE
  const e = error as AuthErrorLike
  if (isDatabaseErrorSavingUser(e)) return SIGNUP_DB_ERROR_MESSAGE
  if (e.code && AUTH_MESSAGES[e.code]) return AUTH_MESSAGES[e.code]!
  if (/invalid login credentials/i.test(e.message ?? '')) return AUTH_MESSAGES['invalid_credentials']!
  if (/already registered/i.test(e.message ?? '')) return AUTH_MESSAGES['user_already_exists']!
  return AUTH_FALLBACK_MESSAGE
}
