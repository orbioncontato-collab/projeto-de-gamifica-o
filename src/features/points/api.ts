import { callRpc, supabase, unwrap } from '@/lib/supabase'
import { RpcError } from '@/lib/rpc-errors'
import type {
  PointEntryRow,
  PointRuleInsert,
  PointRuleRow,
  RpcArgs,
  VPointEntryHistory,
} from '@/lib/database.types'

/** Funções puras async de Pontuação (FRONTEND-ARCH §4.5 features/points — WP7). */

export const HISTORY_PAGE_SIZE = 25

export interface EntriesHistoryParams {
  profileId: string | null
  page: number
  pageSize?: number
}

export interface EntriesHistoryPage {
  rows: VPointEntryHistory[]
  total: number
}

/** Regras não excluídas (soft delete), na ordem do catálogo. `includeInactive: false` esconde as inativas. */
export async function getPointRules(opts?: { includeInactive?: boolean }): Promise<PointRuleRow[]> {
  let q = supabase.from('point_rules').select('*').is('deleted_at', null)
  if (opts?.includeInactive === false) q = q.eq('is_active', true)
  return unwrap(q.order('sort_order').order('name'))
}

/** Upsert direto (policy admin). Sem `id` cria; com `id` atualiza. */
export async function savePointRule(input: PointRuleInsert & { id?: string }): Promise<PointRuleRow> {
  return unwrap(supabase.from('point_rules').upsert(input).select().single())
}

/** Soft delete: nunca DELETE (DATA-MODEL §4.10). */
export async function deletePointRule(id: string): Promise<void> {
  await unwrap(
    supabase
      .from('point_rules')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id),
  )
}

/** Histórico paginado (`count: 'exact'`), do fato mais recente para o mais antigo (DATA-MODEL §5.13). */
export async function getEntriesHistory({
  profileId,
  page,
  pageSize = HISTORY_PAGE_SIZE,
}: EntriesHistoryParams): Promise<EntriesHistoryPage> {
  const from = page * pageSize
  const to = from + pageSize - 1
  let q = supabase.from('v_point_entries_history').select('*', { count: 'exact' })
  if (profileId) q = q.eq('profile_id', profileId)
  const { data, error, count } = await q
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw RpcError.fromPostgrest(error)
  return { rows: data ?? [], total: count ?? 0 }
}

export async function recordRuleEntry(args: RpcArgs<'record_rule_entry'>): Promise<PointEntryRow> {
  return callRpc('record_rule_entry', args)
}

export async function recordManualEntry(args: RpcArgs<'record_manual_entry'>): Promise<PointEntryRow> {
  return callRpc('record_manual_entry', args)
}

export async function reverseEntry(input: { entryId: string; reason: string }): Promise<PointEntryRow> {
  return callRpc('reverse_entry', { p_entry_id: input.entryId, p_reason: input.reason })
}
