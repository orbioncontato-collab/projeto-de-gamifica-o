import type { AchievementCriteria, AchievementScope, VAchievementBoard } from '@/lib/database.types'
import { formatBRL, formatNumber } from '@/lib/format'

/** Funções puras de Conquistas (testadas em achievements-utils.test.ts). */

export interface AchievementCounter {
  unlocked: number
  total: number
  /** "desbloqueada" | "desbloqueadas" */
  noun: string
  /** "N de M desbloqueadas" */
  label: string
}

export function achievementCounter(
  rows: readonly Pick<VAchievementBoard, 'is_unlocked'>[],
): AchievementCounter {
  const total = rows.length
  const unlocked = rows.filter((r) => r.is_unlocked).length
  const noun = unlocked === 1 ? 'desbloqueada' : 'desbloqueadas'
  return { unlocked, total, noun, label: `${unlocked} de ${total} ${noun}` }
}

export const SCOPE_LABELS: Record<AchievementScope, string> = {
  lifetime: 'Vitalícia',
  season: 'Por temporada',
}

/** Como desbloquear, a partir do critério (DATA-MODEL §4.27). Complementa a `description` do catálogo. */
export function criteriaHint(
  criteria: AchievementCriteria,
  value: number | null,
  scope: AchievementScope,
): string {
  const where = scope === 'season' ? 'na temporada' : 'no total'
  switch (criteria) {
    case 'first_sale':
      return 'Registre sua primeira venda'
    case 'streak_days':
      return `${formatNumber(value ?? 0)} dias seguidos com atividade`
    case 'sales_total':
      return `${formatBRL(value ?? 0)} em vendas ${where}`
    case 'points_total':
      return `${formatNumber(value ?? 0)} pontos ${where}`
    case 'missions_completed':
      return `${formatNumber(value ?? 0)} missões concluídas ${where}`
    case 'monthly_goal':
      return 'Bata sua meta mensal'
    case 'rank_first':
      return 'Termine a temporada em 1º lugar'
  }
}

/** Texto curto da recompensa: "+50 pts · +50 moedas" (omite zeros; vazio quando nada). */
export function rewardSummary(points: number, coins: number): string {
  const parts: string[] = []
  if (points > 0) parts.push(`+${formatNumber(points)} pts`)
  if (coins > 0) parts.push(`+${formatNumber(coins)} moedas`)
  return parts.join(' · ')
}
