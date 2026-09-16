import { callRpc, supabase, unwrap } from '@/lib/supabase'
import type { DashboardPayload, VActivityFeed, VTeamStats } from '@/lib/database.types'

export const FEED_PAGE_SIZE = 20

/** rpc `get_dashboard(p_profile_id?, p_season_id?)` — DATA-MODEL §7.1; devolve `{ season: null }` sem temporada. */
export async function getDashboard(
  profileId?: string | null,
  seasonId?: string | null,
): Promise<DashboardPayload> {
  const args: { p_profile_id?: string | null; p_season_id?: string | null } = {}
  if (profileId) args.p_profile_id = profileId
  if (seasonId) args.p_season_id = seasonId
  const result = await callRpc('get_dashboard', args)
  return result as DashboardPayload
}

export interface FeedPage {
  rows: VActivityFeed[]
  /** `occurred_at` da última linha; `null` quando não há mais páginas */
  nextCursor: string | null
}

/** `v_activity_feed` paginado por cursor `occurred_at` (DATA-MODEL §5.14). */
export async function getActivityFeedPage(cursor: string | null, limit = FEED_PAGE_SIZE): Promise<FeedPage> {
  let query = supabase
    .from('v_activity_feed')
    .select('*')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (cursor) query = query.lt('occurred_at', cursor)
  const rows = ((await unwrap(query)) ?? []) as VActivityFeed[]
  const last = rows[rows.length - 1]
  return { rows, nextCursor: rows.length === limit && last ? last.occurred_at : null }
}

/** `v_team_stats` da temporada (visão do gestor). */
export async function getTeamOverview(seasonId: string): Promise<VTeamStats | null> {
  const row = await unwrap(supabase.from('v_team_stats').select('*').eq('season_id', seasonId).maybeSingle())
  return (row ?? null) as VTeamStats | null
}
