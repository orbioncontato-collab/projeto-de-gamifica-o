import type { VActivityFeed, VProfileStats, VTeamStats } from '@/lib/database.types'
import {
  formatBRL,
  formatDateShort,
  formatNumber,
  formatOrdinal,
  formatPct,
  formatPoints,
} from '@/lib/format'
import { goalProjection } from '@/lib/gamification'
import type { FeedPage } from './api'

/** Funções puras da Visão geral (testadas em `dashboard-utils.test.ts`). Nenhuma toca rede. */

export interface LevelCopy {
  level: string
  points: string
  progressPct: number
  remaining: string
}

/** "Nível 0 · 0 pontos · faltam 400 para o nível 1" (§9). Zero em tudo com o banco recém-instalado. */
export function levelCopy(input: {
  level: number
  points: number
  xp_in_level: number
  xp_to_next: number
  xp_per_level: number
}): LevelCopy {
  const xpPerLevel = input.xp_per_level > 0 ? input.xp_per_level : 1
  const pct = Math.round((Math.max(input.xp_in_level, 0) / xpPerLevel) * 1000) / 10
  return {
    level: `Nível ${formatNumber(input.level)}`,
    points: formatPoints(input.points),
    progressPct: Math.max(0, Math.min(100, pct)),
    remaining: `faltam ${formatPoints(input.xp_to_next)} para o nível ${formatNumber(input.level + 1)}`,
  }
}

/** Linha de posição sob a saudação: líder / empate / gap para a posição acima / sem posição. */
export function rankLine(input: {
  rank: number | null
  gap_to_above: number | null
  is_tied_with_above: boolean
}): string {
  if (input.rank === null) return 'Sem posição no ranking ainda'
  if (input.rank === 1 || input.gap_to_above === null) return 'Você lidera o ranking'
  if (input.is_tied_with_above || input.gap_to_above === 0)
    return `Empatado com o ${formatOrdinal(input.rank - 1)}`
  return `${formatPoints(input.gap_to_above)} para o ${formatOrdinal(input.rank - 1)}`
}

export interface SalesTargetCopy {
  hasGoal: boolean
  headline: string
  pct: number
  pctLabel: string
  missing: string
  projection: string
}

/** Vendas vs meta individual (FEATURE §2 `SalesTarget`) com projeção de `goalProjection` (§4.9). */
export function salesTargetCopy(
  stats: Pick<
    VProfileStats,
    | 'goal_amount'
    | 'sales_amount'
    | 'goal_pct'
    | 'goal_missing_amount'
    | 'projected_goal_date'
    | 'season_ends_at'
  >,
  tz: string,
): SalesTargetCopy {
  const hasGoal = stats.goal_amount > 0
  const pct = hasGoal ? Math.max(0, Math.min(100, stats.goal_pct ?? 0)) : 0
  const headline = hasGoal
    ? `${formatBRL(stats.sales_amount)} de ${formatBRL(stats.goal_amount)}`
    : `${formatBRL(stats.sales_amount)} em vendas`
  const projection = projectionLine(goalProjection(stats, tz), tz)
  return {
    hasGoal,
    headline,
    pct,
    pctLabel: hasGoal ? formatPct(stats.goal_pct) : '—',
    missing: hasGoal ? `faltam ${formatBRL(stats.goal_missing_amount)}` : 'Sua meta ainda não foi definida',
    projection: hasGoal ? projection : 'Peça ao gestor para definir sua meta individual',
  }
}

const projectionLine = (p: ReturnType<typeof goalProjection>, tz: string): string => {
  switch (p.kind) {
    case 'reached':
      return 'Meta batida! 🎉'
    case 'no_pace':
      return 'Ritmo atual: ainda sem projeção — registre a primeira venda'
    case 'on_track':
      return `Ritmo atual: meta projetada para ${formatDateShort(`${p.date}T12:00:00`, tz)}`
    case 'late':
      return `Ritmo atual: meta só em ${formatDateShort(`${p.date}T12:00:00`, tz)} — depois do fim da temporada`
  }
}

export interface ManagerMetric {
  label: string
  value: string
  hint: string
}

/** 4 métricas do gestor (FEATURE §2b) — "meta não definida" quando `team_goal_amount = 0` (§9). */
export function managerMetrics(team: VTeamStats | null): ManagerMetric[] {
  const t = team
  const hasGoal = (t?.team_goal_amount ?? 0) > 0
  return [
    {
      label: 'Meta do time',
      value: hasGoal ? formatBRL(t?.team_goal_amount ?? 0, { compact: true }) : formatBRL(0),
      hint: hasGoal ? `${formatPct(t?.attainment_pct ?? null)} atingido` : 'meta não definida',
    },
    {
      label: 'Vendas realizadas',
      value: formatBRL(t?.sales_amount ?? 0, { compact: true }),
      hint: hasGoal
        ? `faltam ${formatBRL(t?.sales_missing_amount ?? 0, { compact: true })}`
        : `${formatNumber(t?.sales_count ?? 0)} vendas`,
    },
    {
      label: 'Pontos do time',
      value: formatPoints(t?.points_total ?? 0),
      hint: `${formatNumber(t?.active_count ?? 0)} ${(t?.active_count ?? 0) === 1 ? 'ativo' : 'ativos'}`,
    },
    {
      label: 'Fila da roleta',
      value: formatNumber(t?.queue_count ?? 0),
      hint: (t?.queue_count ?? 0) === 1 ? 'pessoa' : 'pessoas',
    },
  ]
}

export interface HealthItem {
  label: string
  value: string
  target: string
  pct: number
  tone: 'green' | 'gold' | 'red'
}

const toneFor = (value: number | null, target: number): HealthItem['tone'] => {
  if (value === null) return 'red'
  if (value >= target) return 'green'
  return value >= target * 0.7 ? 'gold' : 'red'
}

/** Saúde comercial: conversão média vs meta, time ativo, atingimento da meta (FEATURE §2b). */
export function healthItems(team: VTeamStats | null): HealthItem[] {
  const conv = team?.avg_conversion_pct ?? null
  const convTarget = team?.target_conversion_pct ?? 0
  const activeCount = team?.active_count ?? 0
  const totalCount = team?.total_count ?? 0
  const activePct = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0
  const attainment = team?.attainment_pct ?? null
  const hasGoal = (team?.team_goal_amount ?? 0) > 0
  return [
    {
      label: 'Conversão média',
      value: conv === null ? '— (sem reuniões registradas)' : formatPct(conv),
      target: `meta ${formatPct(convTarget)}`,
      pct: conv ?? 0,
      tone: toneFor(conv, convTarget),
    },
    {
      label: 'Time ativo',
      value: `${formatNumber(activeCount)} de ${formatNumber(totalCount)}`,
      target: `${formatPct(activePct)} do cadastro`,
      pct: activePct,
      tone: activePct >= 80 ? 'green' : activePct >= 50 ? 'gold' : 'red',
    },
    {
      label: 'Atingimento da meta',
      value: hasGoal ? formatPct(attainment) : 'meta não definida',
      target: hasGoal
        ? `de ${formatBRL(team?.team_goal_amount ?? 0, { compact: true })}`
        : 'defina em Configurações',
      pct: hasGoal ? Math.min(attainment ?? 0, 100) : 0,
      tone: hasGoal ? toneFor(attainment, 100) : 'red',
    },
  ]
}

/** Junta as páginas do feed sem duplicar ids (realtime pode reinserir a primeira página). */
export function mergeFeedPages(pages: readonly FeedPage[] | undefined): VActivityFeed[] {
  if (!pages) return []
  const seen = new Set<string>()
  const out: VActivityFeed[] = []
  for (const page of pages) {
    for (const row of page.rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
  }
  return out
}
