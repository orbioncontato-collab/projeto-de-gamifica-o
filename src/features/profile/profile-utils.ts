import type { BootstrapMe, VProfileStats } from '@/lib/database.types'
import { formatBRL, formatNumber, formatOrdinal, formatPct, formatPoints } from '@/lib/format'

/** Números do Perfil: `v_profile_stats` quando há temporada; senão os do bootstrap (zero em tudo no início). */
export interface ProfileNumbers {
  level: number
  points: number
  rank: number | null
  sales_amount: number
  meetings_held: number
  conversion_pct: number | null
  achievements_unlocked: number
}

export function profileNumbers(stats: VProfileStats | null | undefined, me: BootstrapMe): ProfileNumbers {
  const src = stats ?? me
  return {
    level: src.level,
    points: src.points,
    rank: src.rank,
    sales_amount: src.sales_amount,
    meetings_held: src.meetings_held,
    conversion_pct: src.conversion_pct,
    achievements_unlocked: src.achievements_unlocked,
  }
}

export interface ProfileStatItem {
  label: string
  value: string
}

/** 4 stats do Perfil (FEATURE §9): Vendas R$, Reuniões, Conversão %, Posição — "R$ 0 · 0 · — · —" no início (§9). */
export function profileStatItems(n: ProfileNumbers): ProfileStatItem[] {
  return [
    { label: 'Vendas', value: formatBRL(n.sales_amount, { compact: true }) },
    { label: 'Reuniões', value: formatNumber(n.meetings_held) },
    { label: 'Conversão', value: formatPct(n.conversion_pct) },
    { label: 'Posição', value: formatOrdinal(n.rank) },
  ]
}

export const profileHeadline = (n: ProfileNumbers): string =>
  `${formatPoints(n.points)} · ${n.rank === null ? 'sem posição' : `${formatOrdinal(n.rank)} no ranking`}`
