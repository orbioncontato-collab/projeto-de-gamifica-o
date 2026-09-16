import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { qk } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import type { ProfilePreferences, ProfileRow } from '@/lib/database.types'
import { useMe } from './bootstrap-query'
import {
  getSignupMode,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  uploadMyAvatar,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from './api'
import { updateMyPreferences, updateMyProfile, type UpdateMyProfileInput } from './profile-api'
import type { SignupMode } from './schemas'

export { useAuth } from './auth-provider'
export { useBootstrap, useMe, useMeOptional } from './bootstrap-query'

const SIGNUP_MODE_STALE_MS = 30_000
/** Erros de formulário são mostrados no próprio campo — sem toast global (MutationCache `meta.silent`). */
const SILENT = { silent: true } as const

/** rpc `signup_mode` (anon): decide o formulário de /signup. */
export function useSignupMode(): UseQueryResult<SignupMode> {
  return useQuery({ queryKey: qk.signupMode(), queryFn: getSignupMode, staleTime: SIGNUP_MODE_STALE_MS })
}

/** Após sessão criada: recarrega o bootstrap e re-roda os guards (FRONTEND-ARCH §3.3). */
function useAfterSession() {
  const qc = useQueryClient()
  const router = useRouter()
  return async (): Promise<void> => {
    await qc.invalidateQueries({ queryKey: qk.bootstrap() })
    await router.invalidate()
  }
}

export function useLogin(): UseMutationResult<void, Error, SignInInput> {
  const afterSession = useAfterSession()
  return useMutation({ mutationFn: signIn, onSuccess: afterSession, meta: SILENT })
}

export function useSignup(): UseMutationResult<SignUpResult, Error, SignUpInput> {
  const afterSession = useAfterSession()
  return useMutation({
    mutationFn: signUp,
    onSuccess: async (result) => {
      if (!result.needsEmailConfirmation) await afterSession()
    },
    meta: SILENT,
  })
}

/** `auth.signOut()` (escopo global): o `SIGNED_OUT` limpa o cache e navega para /login (main.tsx). */
export function useLogout(): UseMutationResult<void, Error, void> {
  return useMutation({ mutationFn: signOut })
}

export function useRequestPasswordReset(): UseMutationResult<void, Error, string> {
  return useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => notify.success('E-mail enviado', 'Se o e-mail não chegar, peça ao gestor.'),
    meta: SILENT,
  })
}

export function useUpdateMyProfile(): UseMutationResult<ProfileRow, Error, UpdateMyProfileInput> {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (patch) => updateMyProfile(me.id, patch),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.bootstrap() }),
        qc.invalidateQueries({ queryKey: qk.profiles.all() }),
      ])
      notify.success('Perfil atualizado')
    },
  })
}

/** Upload da própria foto; erro `AVATAR_QUOTA` → a UI oferece "Limpar fotos antigas" (`cleanupAvatarFolder`). */
export function useUploadMyAvatar(): UseMutationResult<string, Error, File> {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (file) => uploadMyAvatar(me.id, me.avatar_path, file),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.bootstrap() }),
        qc.invalidateQueries({ queryKey: qk.profiles.all() }),
      ])
      notify.success('Foto atualizada')
    },
  })
}

export function useUpdateMyPreferences(): UseMutationResult<
  ProfilePreferences,
  Error,
  Partial<ProfilePreferences>
> {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (patch) => updateMyPreferences(me.id, me.preferences, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.bootstrap() })
      notify.success('Preferências salvas')
    },
  })
}
