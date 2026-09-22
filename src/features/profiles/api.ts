import { supabase, unwrap } from '@/lib/supabase'
import type {
  PendingMember,
  ProfilePrivateRow,
  ProfileRow,
  VAchievementBoard,
  VProfileStats,
  VRanking,
} from '@/lib/database.types'

/** Read-model compartilhado de perfis (FRONTEND-ARCH §4.5 features/profiles). Só leitura. */

export type ActiveProfile = Pick<
  ProfileRow,
  'id' | 'full_name' | 'avatar_path' | 'color' | 'job_title' | 'team' | 'role'
>

export async function getProfileStats(
  seasonId: string,
  opts?: { includeInactive?: boolean },
): Promise<VProfileStats[]> {
  let q = supabase.from('v_profile_stats').select('*').eq('season_id', seasonId)
  if (!opts?.includeInactive) q = q.eq('status', 'active')
  return unwrap(q.order('rank', { nullsFirst: false }).order('full_name'))
}

export async function getProfileStat(profileId: string, seasonId: string): Promise<VProfileStats | null> {
  return unwrap(
    supabase
      .from('v_profile_stats')
      .select('*')
      .eq('season_id', seasonId)
      .eq('profile_id', profileId)
      .maybeSingle(),
  )
}

export async function getRanking(seasonId: string, limit?: number): Promise<VRanking[]> {
  let q = supabase.from('v_ranking').select('*').eq('season_id', seasonId).order('rank')
  if (limit) q = q.limit(limit)
  return unwrap(q)
}

/** Pendentes e inativos nunca entram em picker nenhum (lançar pontos, fila, missão, desafio). */
export async function getActiveProfiles(): Promise<ActiveProfile[]> {
  return unwrap(
    supabase
      .from('profiles')
      .select('id, full_name, avatar_path, color, job_title, team, role')
      .eq('status', 'active')
      .order('full_name'),
  )
}

/** admin: cadastros aguardando aprovação (Equipe › Pendentes) — funciona sem temporada ativa. */
export async function getPendingMembers(): Promise<PendingMember[]> {
  const rows = await unwrap(
    supabase
      .from('profiles')
      .select('id, full_name, avatar_path, color, created_at, profile_private(email)')
      .eq('status', 'pending')
      .order('created_at'),
  )
  return rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    avatar_path: r.avatar_path,
    color: r.color,
    created_at: r.created_at,
    profile_private: r.profile_private ? { email: r.profile_private.email } : null,
  }))
}

/** RLS: dono ou admin. */
export async function getProfilePrivate(profileId: string): Promise<ProfilePrivateRow | null> {
  return unwrap(supabase.from('profile_private').select('*').eq('profile_id', profileId).maybeSingle())
}

/** Promovido para cá porque Perfil e Conquistas consomem (regra §2.3). */
export async function getAchievementBoard(profileId: string): Promise<VAchievementBoard[]> {
  return unwrap(
    supabase.from('v_achievement_board').select('*').eq('profile_id', profileId).order('sort_order'),
  )
}
