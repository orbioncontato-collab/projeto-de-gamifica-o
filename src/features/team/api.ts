import { avatarObjectPath, callRpc, supabase, unwrap } from '@/lib/supabase'
import { RpcError } from '@/lib/rpc-errors'
import type {
  AdminProfilePatch,
  AdminUpdateProfilePayload,
  AppSecretsRow,
  DashboardPayload,
  PointEntryRow,
  VPointEntryHistory,
} from '@/lib/database.types'
import { assertAvatarFile, cleanupAvatarFolder } from '@/features/auth/api'

/** API da Equipe (FRONTEND-ARCH §4.5 features/team). Toda chamada supabase da feature vive aqui. */

export { cleanupAvatarFolder }

const AVATAR_BUCKET = 'avatars'
const STORAGE_QUOTA_STATUS = '403'
const INITIAL_POINTS_REASON = 'Pontos iniciais'

/** `app_secrets.team_code` — chave `qk.settings.secrets()` (a mesma que `useRotateTeamCode` invalida). */
export async function getTeamCode(): Promise<string> {
  // `unwrap<T>` com retorno contextual `Promise<string>` infere `never` no builder; tipagem explícita da linha.
  const row = await unwrap<Pick<AppSecretsRow, 'team_code'> | null>(
    supabase.from('app_secrets').select('team_code').eq('id', 1).single(),
  )
  if (!row) throw new Error('Código da equipe indisponível.')
  return row.team_code
}

export interface AdminUpdateProfileInput {
  profileId: string
  patch: AdminProfilePatch
}

/** rpc `admin_update_profile` (DATA-MODEL §7.2) — nunca lança pontos. */
export async function adminUpdateProfile({
  profileId,
  patch,
}: AdminUpdateProfileInput): Promise<AdminUpdateProfilePayload> {
  const data = await callRpc('admin_update_profile', { p_profile_id: profileId, p_patch: patch })
  return data as AdminUpdateProfilePayload
}

export interface RecordInitialPointsInput {
  profileId: string
  points: number
}

/** rpc `record_initial_points` (DATA-MODEL §7.4) — no máximo uma por (perfil, temporada). */
export async function recordInitialPoints({
  profileId,
  points,
}: RecordInitialPointsInput): Promise<PointEntryRow> {
  return callRpc('record_initial_points', { p_profile_id: profileId, p_points: points })
}

/** Soma dos "Pontos iniciais" do perfil na temporada (entries `system`, não estornadas). */
export async function getInitialPointsSum(profileId: string, seasonId: string): Promise<number> {
  const rows = await unwrap(
    supabase
      .from('v_point_entries_history')
      .select('points')
      .eq('profile_id', profileId)
      .eq('season_id', seasonId)
      .eq('source', 'system')
      .eq('reason', INITIAL_POINTS_REASON)
      .is('reverses_entry_id', null),
  )
  return sumPoints((rows ?? []) as Pick<VPointEntryHistory, 'points'>[])
}

export const sumPoints = (rows: readonly Pick<VPointEntryHistory, 'points'>[]): number =>
  rows.reduce((acc, r) => acc + (Number.isFinite(r.points) ? r.points : 0), 0)

/** rpc `get_dashboard(p_profile_id)` — visão individual de um colaborador (admin). */
export async function getCollaboratorDashboard(
  profileId: string,
  seasonId: string,
): Promise<DashboardPayload> {
  const data = await callRpc('get_dashboard', { p_profile_id: profileId, p_season_id: seasonId })
  return data as DashboardPayload
}

/** Mesma regra do perfil próprio (MIME + 1,5 MB), agora reexportada por `features/auth/api` (). */
export const assertAdminAvatarFile = assertAvatarFile

const isQuotaError = (error: { message: string; statusCode?: string | number }): boolean =>
  String(error.statusCode ?? '') === STORAGE_QUOTA_STATUS || /quota|limit|policy/i.test(error.message)

export interface AdminUploadAvatarInput {
  profileId: string
  currentAvatarPath: string | null
  file: File
}

/**
 * Upload da foto de um colaborador pelo gestor (§4.5 `useAdminUploadAvatar`): limpa a pasta → sobe →
 * `admin_update_profile({ avatar_path })` → remove a anterior (best-effort). 403 vira `AVATAR_QUOTA`.
 */
export async function uploadAdminAvatar({
  profileId,
  currentAvatarPath,
  file,
}: AdminUploadAvatarInput): Promise<string> {
  assertAdminAvatarFile(file)
  await cleanupAvatarFolder(profileId, currentAvatarPath)
  const path = avatarObjectPath(profileId, file)
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '3600' })
  if (error) {
    const e = error as { message: string; statusCode?: string | number }
    if (isQuotaError(e)) throw new RpcError('AVATAR_QUOTA', 'AVATAR_QUOTA', null, STORAGE_QUOTA_STATUS)
    throw new Error('Não foi possível enviar a foto. Tente novamente.')
  }
  const payload = await adminUpdateProfile({ profileId, patch: { avatar_path: path } })
  if (currentAvatarPath && currentAvatarPath !== path) {
    void supabase.storage
      .from(AVATAR_BUCKET)
      .remove([currentAvatarPath])
      .catch(() => undefined)
  }
  return payload.profile?.avatar_path ?? path
}
