import { AVATAR_MAX_BYTES, AVATAR_MIME, avatarObjectPath, supabase, unwrap } from '@/lib/supabase'
import { RpcError } from '@/lib/rpc-errors'
import type { ProfileRow } from '@/lib/database.types'

const AVATAR_BUCKET = 'avatars'
const STORAGE_QUOTA_STATUS = '403'

type AvatarMime = (typeof AVATAR_MIME)[number]
const isAllowedMime = (type: string): type is AvatarMime => (AVATAR_MIME as readonly string[]).includes(type)

/** Valida MIME e tamanho antes de qualquer rede (> 1,5 MB ou SVG bloqueado antes do envio). */
export function assertAvatarFile(file: File): void {
  if (!isAllowedMime(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('A imagem precisa ter no máximo 1,5 MB.')
}

/**
 * Remove todo objeto de `avatars/<profileId>` diferente de `keepPath` (cota de 3 objetos por pasta — DATA-MODEL §11).
 * Best-effort: nunca lança para o chamador do upload. Devolve quantos objetos foram removidos.
 */
export async function cleanupAvatarFolder(profileId: string, keepPath: string | null): Promise<number> {
  try {
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).list(profileId)
    if (error || !data) return 0
    const stale = data.map((o) => `${profileId}/${o.name}`).filter((path) => path !== keepPath)
    if (stale.length === 0) return 0
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove(stale)
    return removeError ? 0 : stale.length
  } catch {
    return 0
  }
}

const isQuotaError = (error: { message: string; statusCode?: string | number }): boolean =>
  String(error.statusCode ?? '') === STORAGE_QUOTA_STATUS || /quota|limit|policy/i.test(error.message)

/**
 * Upload da própria foto (FRONTEND-ARCH §4.5 `useUploadMyAvatar`): limpa a pasta → sobe → grava `avatar_path` →
 * remove a anterior (best-effort). 403 do Storage vira `RpcError('AVATAR_QUOTA')`.
 */
export async function uploadMyAvatar(
  profileId: string,
  currentPath: string | null,
  file: File,
): Promise<string> {
  assertAvatarFile(file)
  await cleanupAvatarFolder(profileId, currentPath)
  const path = avatarObjectPath(profileId, file)
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '3600' })
  if (error) {
    const e = error as { message: string; statusCode?: string | number }
    if (isQuotaError(e)) throw new RpcError('AVATAR_QUOTA', 'AVATAR_QUOTA', null, STORAGE_QUOTA_STATUS)
    throw new Error('Não foi possível enviar a foto. Tente novamente.')
  }
  const row = await unwrap(
    supabase
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', profileId)
      .select('avatar_path')
      .single(),
  )
  if (currentPath && currentPath !== path) {
    void supabase.storage
      .from(AVATAR_BUCKET)
      .remove([currentPath])
      .catch(() => undefined)
  }
  return (row as Pick<ProfileRow, 'avatar_path'> | null)?.avatar_path ?? path
}
