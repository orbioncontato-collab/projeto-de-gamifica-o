import { supabase, unwrap } from '@/lib/supabase'
import type { VAdminKpis, VSalesTimeline, VTeamStats } from '@/lib/database.types'

/** Leituras do Dashboard administrativo (FRONTEND-ARCH §4.5 features/admin-dashboard — WP6). Só leitura. */

export async function getTeamStats(seasonId: string): Promise<VTeamStats | null> {
  const row = await unwrap(supabase.from('v_team_stats').select('*').eq('season_id', seasonId).maybeSingle())
  return (row ?? null) as VTeamStats | null
}

export async function getAdminKpis(seasonId: string): Promise<VAdminKpis | null> {
  const row = await unwrap(supabase.from('v_admin_kpis').select('*').eq('season_id', seasonId).maybeSingle())
  return (row ?? null) as VAdminKpis | null
}

/** `v_sales_timeline` ordenada por dia (PostgREST não garante ordem sem `.order()`). */
export async function getSalesTimeline(seasonId: string): Promise<VSalesTimeline[]> {
  const rows = await unwrap(
    supabase.from('v_sales_timeline').select('*').eq('season_id', seasonId).order('day'),
  )
  return (rows ?? []) as VSalesTimeline[]
}
