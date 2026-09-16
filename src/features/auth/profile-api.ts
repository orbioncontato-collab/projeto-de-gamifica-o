import { supabase, unwrap } from '@/lib/supabase'
import type { ProfilePreferences, ProfileRow } from '@/lib/database.types'

export interface UpdateMyProfileInput {
  full_name?: string
  color?: string
}

/** `profiles.update` do próprio perfil (policy do dono) — nome e cor. */
export async function updateMyProfile(profileId: string, patch: UpdateMyProfileInput): Promise<ProfileRow> {
  const data: Partial<Pick<ProfileRow, 'full_name' | 'color'>> = {}
  if (patch.full_name !== undefined) data.full_name = patch.full_name.trim()
  if (patch.color !== undefined) data.color = patch.color
  return unwrap(
    supabase.from('profiles').update(data).eq('id', profileId).select('*').single(),
  ) as Promise<ProfileRow>
}

/** `profiles.update({ preferences })` — mescla com as preferências atuais. */
export async function updateMyPreferences(
  profileId: string,
  current: ProfilePreferences,
  patch: Partial<ProfilePreferences>,
): Promise<ProfilePreferences> {
  const preferences: ProfilePreferences = { ...current, ...patch }
  const row = await unwrap(
    supabase.from('profiles').update({ preferences }).eq('id', profileId).select('preferences').single(),
  )
  return (row as Pick<ProfileRow, 'preferences'> | null)?.preferences ?? preferences
}
