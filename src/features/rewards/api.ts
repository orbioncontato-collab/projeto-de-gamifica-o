import { callRpc, supabase, unwrap } from '@/lib/supabase'
import type {
  PointEntryRow,
  RedeemPayload,
  RedemptionStatus,
  RewardInsert,
  RewardRedemptionRow,
  RewardRow,
  VRedemption,
  VWallet,
} from '@/lib/database.types'

/** Funções puras async de Recompensas (FRONTEND-ARCH §4.5 features/rewards — WP5). */

export type RecentCredit = Pick<
  PointEntryRow,
  'id' | 'coins' | 'reason' | 'source' | 'metric' | 'occurred_at'
> & {
  rule: { name: string } | null
}

export type CatalogScope = 'store' | 'admin'
export type RedemptionAction = 'approve' | 'deliver' | 'cancel'
export const RECENT_CREDITS_LIMIT = 3

/** `v_wallet` própria (ou de terceiro, quando admin). `null` quando ainda não há linha. */
export async function getWallet(profileId: string): Promise<VWallet | null> {
  return unwrap(supabase.from('v_wallet').select('*').eq('profile_id', profileId).maybeSingle())
}

/** Últimos créditos de moedas; embed `rule:point_rules(name)` pela FK `point_entries.rule_id`. */
export async function getRecentCredits(
  profileId: string,
  limit = RECENT_CREDITS_LIMIT,
): Promise<RecentCredit[]> {
  const rows = await unwrap(
    supabase
      .from('point_entries')
      .select('id, coins, reason, source, metric, occurred_at, rule:point_rules(name)')
      .eq('profile_id', profileId)
      .gt('coins', 0)
      .order('occurred_at', { ascending: false })
      .limit(limit),
  )
  return rows.map((r) => ({
    id: r.id,
    coins: r.coins,
    reason: r.reason,
    source: r.source,
    metric: r.metric,
    occurred_at: r.occurred_at,
    rule: r.rule ? { name: r.rule.name } : null,
  }))
}

/** Loja (`store`) só ativas; `admin` traz inativas também. Nunca as excluídas (soft delete). */
export async function getRewardsCatalog(scope: CatalogScope): Promise<RewardRow[]> {
  let q = supabase.from('rewards').select('*').is('deleted_at', null)
  if (scope === 'store') q = q.eq('is_active', true)
  return unwrap(q.order('sort_order').order('cost_coins'))
}

/** RLS já filtra os próprios pedidos do colaborador. */
export async function getMyRedemptions(): Promise<VRedemption[]> {
  return unwrap(supabase.from('v_redemptions').select('*').order('requested_at', { ascending: false }))
}

export async function getRedemptionsAdmin(status: RedemptionStatus | null): Promise<VRedemption[]> {
  let q = supabase.from('v_redemptions').select('*')
  if (status) q = q.eq('status', status)
  return unwrap(q.order('requested_at', { ascending: false }))
}

export async function redeemReward(rewardId: string): Promise<RedeemPayload> {
  const data = await callRpc('redeem_reward', { p_reward_id: rewardId })
  return data as unknown as RedeemPayload
}

export async function handleRedemption(input: {
  id: string
  action: RedemptionAction
  notes?: string | null
}): Promise<RewardRedemptionRow> {
  return callRpc('handle_redemption', {
    p_redemption_id: input.id,
    p_action: input.action,
    p_notes: input.notes ?? null,
  })
}

/** Upsert direto (policy admin). Sem `id` cria; com `id` atualiza. */
export async function saveReward(input: RewardInsert & { id?: string }): Promise<RewardRow> {
  return unwrap(supabase.from('rewards').upsert(input).select().single())
}

/** Soft delete: nunca DELETE (DATA-MODEL §2.2). */
export async function deleteReward(id: string): Promise<void> {
  await unwrap(
    supabase.from('rewards').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id),
  )
}
