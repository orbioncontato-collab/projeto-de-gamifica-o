import type { VRanking } from '@/lib/database.types'
import { formatOrdinal, formatPoints } from '@/lib/format'

/** Funções puras do Ranking (testadas em `ranking-utils.test.ts`). */

export type PodiumPlace = 1 | 2 | 3

export interface PodiumSlot {
  place: PodiumPlace
  row: VRanking | null
}

/**
 * Pódio na ordem visual 2º · 1º · 3º (Apêndice A). Só desenhado quando o 1º tem `has_points`
 * (DATA-MODEL §5.1); vagas sem gente ficam `row: null` ("vaga em aberto").
 */
export function podiumSlots(rows: readonly VRanking[]): PodiumSlot[] | null {
  const first = rows.find((r) => r.rank === 1)
  if (!first || !first.has_points) return null
  const byRank = (rank: PodiumPlace): VRanking | null =>
    rows.find((r) => r.rank === rank && r.has_points) ?? null
  return [
    { place: 2, row: byRank(2) },
    { place: 1, row: first },
    { place: 3, row: byRank(3) },
  ]
}

/** Gap para a posição acima: líder / empate / "N pts para o Xº" (DATA-MODEL §5.1 `gap_to_above`). */
export function gapLabel(row: Pick<VRanking, 'rank' | 'gap_to_above' | 'is_tied_with_above'>): string {
  if (row.rank === 1 || row.gap_to_above === null) return 'Líder'
  if (row.is_tied_with_above || row.gap_to_above === 0) return `Empatado com o ${formatOrdinal(row.rank - 1)}`
  return `${formatPoints(row.gap_to_above)} para o ${formatOrdinal(row.rank - 1)}`
}

/** Linha do próprio usuário fora do top N (para mostrar "Você" sempre). */
export function findMe(rows: readonly VRanking[], meId: string): VRanking | null {
  return rows.find((r) => r.profile_id === meId) ?? null
}
