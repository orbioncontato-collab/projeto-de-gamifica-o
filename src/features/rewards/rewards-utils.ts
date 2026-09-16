import type { RedemptionStatus, RewardRow, VWallet } from '@/lib/database.types'
import { ENTRY_SOURCE_LABELS, REDEMPTION_STATUS_LABELS } from '@/lib/labels'
import type { Tone } from '@/components/shared/types'
import type { RecentCredit, RedemptionAction } from './api'

/** Funções puras de Recompensas (testadas em rewards-utils.test.ts). */

/** Título do crédito: `reason ?? rule.name ?? rótulo do source` (FRONTEND-ARCH §4.5). */
export function creditTitle(credit: Pick<RecentCredit, 'reason' | 'rule' | 'source'>): string {
  const reason = credit.reason?.trim()
  if (reason) return reason
  const ruleName = credit.rule?.name?.trim()
  if (ruleName) return ruleName
  return ENTRY_SOURCE_LABELS[credit.source]
}

export const EMPTY_WALLET: VWallet = {
  profile_id: '',
  coins_balance: 0,
  coins_earned: 0,
  coins_spent: 0,
  coins_from_sales: 0,
  coins_from_missions: 0,
  coins_from_goals: 0,
  coins_from_wheel: 0,
  coins_from_challenges: 0,
  coins_from_achievements: 0,
  coins_from_manual: 0,
}

/** Carteira sem linha (perfil recém-criado) vira zeros — nunca `undefined`/`NaN` na tela. */
export function walletOrEmpty(wallet: VWallet | null | undefined, profileId: string): VWallet {
  return wallet ?? { ...EMPTY_WALLET, profile_id: profileId }
}

/** As 3 origens fixas do original: +Venda, +Missão, +Meta. */
export const PRIMARY_ORIGINS = [
  { key: 'coins_from_sales', label: 'Venda' },
  { key: 'coins_from_missions', label: 'Missão' },
  { key: 'coins_from_goals', label: 'Meta' },
] as const satisfies readonly { key: keyof VWallet; label: string }[]

/** Demais origens ("Outras origens") — tooltip/lista secundária. */
export const OTHER_ORIGINS = [
  { key: 'coins_from_wheel', label: 'Roleta' },
  { key: 'coins_from_challenges', label: 'Desafios' },
  { key: 'coins_from_achievements', label: 'Conquistas' },
  { key: 'coins_from_manual', label: 'Manual' },
] as const satisfies readonly { key: keyof VWallet; label: string }[]

export function otherOriginsTotal(wallet: VWallet): number {
  return OTHER_ORIGINS.reduce((sum, o) => sum + (wallet[o.key] || 0), 0)
}

export type Affordability =
  | { kind: 'ok' }
  | { kind: 'missing'; missing: number }
  | { kind: 'out_of_stock' }
  | { kind: 'debt'; missing: number }

/**
 * Regra do card: "Resgatar" se `cost <= balance` e estoque > 0 (ou ilimitado); senão "Faltam N moedas".
 * Saldo devedor (B.15) desabilita a loja até cobrir o custo (faltam custo − saldo, maior que o custo).
 */
export function affordability(
  reward: Pick<RewardRow, 'cost_coins' | 'stock'>,
  balance: number,
): Affordability {
  if (reward.stock !== null && reward.stock <= 0) return { kind: 'out_of_stock' }
  const missing = reward.cost_coins - balance
  if (missing <= 0) return { kind: 'ok' }
  if (balance < 0) return { kind: 'debt', missing }
  return { kind: 'missing', missing }
}

export function isDebt(balance: number): boolean {
  return balance < 0
}

export const REDEMPTION_STATUS_MAP: Record<RedemptionStatus, { label: string; tone: Tone }> = {
  requested: { label: REDEMPTION_STATUS_LABELS.requested, tone: 'warning' },
  approved: { label: REDEMPTION_STATUS_LABELS.approved, tone: 'info' },
  delivered: { label: REDEMPTION_STATUS_LABELS.delivered, tone: 'success' },
  cancelled: { label: REDEMPTION_STATUS_LABELS.cancelled, tone: 'muted' },
}

export const REDEMPTION_ACTION_LABELS: Record<RedemptionAction, string> = {
  approve: 'Aprovar',
  deliver: 'Entregar',
  cancel: 'Cancelar',
}

/** Toast de sucesso após `handle_redemption`. */
export const REDEMPTION_ACTION_DONE: Record<RedemptionAction, string> = {
  approve: 'Pedido aprovado',
  deliver: 'Pedido entregue',
  cancel: 'Pedido cancelado — moedas devolvidas ao colaborador',
}

/** Transições permitidas (DATA-MODEL §7.7): requested→approved; requested|approved→delivered|cancelled. */
export function allowedActions(status: RedemptionStatus): RedemptionAction[] {
  switch (status) {
    case 'requested':
      return ['approve', 'deliver', 'cancel']
    case 'approved':
      return ['deliver', 'cancel']
    default:
      return []
  }
}

export const REDEMPTION_STATUSES: readonly RedemptionStatus[] = [
  'requested',
  'approved',
  'delivered',
  'cancelled',
]

/** Contagens por status para os chips de filtro da fila (só quando a lista está sem filtro). */
export function countByStatus(
  rows: readonly { status: RedemptionStatus }[],
): Record<RedemptionStatus, number> {
  const base: Record<RedemptionStatus, number> = { requested: 0, approved: 0, delivered: 0, cancelled: 0 }
  return rows.reduce((acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }), base)
}

/** Texto do estoque no card/tabela. */
export function stockLabel(stock: number | null): string {
  if (stock === null) return 'Ilimitado'
  if (stock <= 0) return 'Esgotado'
  return stock === 1 ? '1 unidade' : `${stock} unidades`
}
