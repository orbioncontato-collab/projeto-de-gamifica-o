import type { VSalesTimeline, VRanking, VTeamStats } from '@/lib/database.types'
import { formatNumber, formatPct } from '@/lib/format'

/** Funções puras do Dashboard administrativo (testadas em `admin-utils.test.ts`). */

export interface SalesPoint {
  day: string
  salesCum: number
  salesAmount: number
}
export interface PointsPoint {
  day: string
  points: number
  pointsCum: number
}
export interface PersonPoints {
  profileId: string
  name: string
  points: number
  color: string
}

/** Série da área acumulada — `day` é ISO `YYYY-MM-DD` (rótulo formatado no gráfico). */
export const toSalesSeries = (rows: VSalesTimeline[]): SalesPoint[] =>
  rows.map((r) => ({ day: r.day, salesCum: r.sales_cum, salesAmount: r.sales_amount }))

export const toPointsSeries = (rows: VSalesTimeline[]): PointsPoint[] =>
  rows.map((r) => ({ day: r.day, points: r.points, pointsCum: r.points_cum }))

/** Barras por colaborador: só quem tem pontos > 0, ordem do ranking; `limit` corta a cauda. */
export const toPersonPoints = (rows: VRanking[], limit = 12): PersonPoints[] =>
  rows
    .filter((r) => r.points > 0)
    .slice(0, limit)
    .map((r) => ({ profileId: r.profile_id, name: r.full_name, points: r.points, color: r.color }))

/** "Gráficos com 0 pontos mostram estado vazio": vazio quando nenhuma venda nem ponto acumulado. */
export const hasTimelineData = (rows: VSalesTimeline[]): boolean =>
  rows.some((r) => r.sales_cum > 0 || r.points_cum > 0 || r.entries_count > 0)

export type IndicatorTone = 'success' | 'warning' | 'danger' | 'muted'

export interface Indicator {
  key: 'conversion' | 'attendance' | 'crm' | 'activities'
  label: string
  /** valor formatado ou "—" */
  value: string
  target: string
  /** 0..100 para a barra (null → 0) */
  progress: number
  tone: IndicatorTone
}

const WARNING_RATIO = 0.7

/** Tom pelo atingimento da meta: ≥ meta verde, ≥ 70 % dourado, abaixo vermelho; sem dado cinza. */
export const indicatorTone = (value: number | null, target: number): IndicatorTone => {
  if (value === null || !Number.isFinite(value)) return 'muted'
  if (target <= 0) return value > 0 ? 'success' : 'muted'
  if (value >= target) return 'success'
  if (value >= target * WARNING_RATIO) return 'warning'
  return 'danger'
}

export const progressOf = (value: number | null, target: number): number => {
  if (value === null || !Number.isFinite(value) || target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)))
}

/** Média de atividades por colaborador ativo (0 quando não há ativos — sem divisão por zero). */
export const activitiesPerPerson = (stats: Pick<VTeamStats, 'activities_count' | 'active_count'>): number =>
  stats.active_count > 0 ? Math.round(stats.activities_count / stats.active_count) : 0

/** `YYYY-MM-DD` (data local da view, já no fuso da empresa) → `DD/MM` sem passar por `Date`. */
export const dayLabel = (day: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  return m ? `${m[3]}/${m[2]}` : day
}

/** Indicadores vs metas de `app_settings` (via `v_team_stats.target_*`): conversão, comparecimento, CRM, atividades. */
export function buildIndicators(stats: VTeamStats): Indicator[] {
  const activities = activitiesPerPerson(stats)
  const hasActivities = stats.activities_count > 0
  return [
    {
      key: 'conversion',
      label: 'Conversão',
      value: formatPct(stats.avg_conversion_pct),
      target: `meta ${formatPct(stats.target_conversion_pct)}`,
      progress: progressOf(stats.avg_conversion_pct, stats.target_conversion_pct),
      tone: indicatorTone(stats.avg_conversion_pct, stats.target_conversion_pct),
    },
    {
      key: 'attendance',
      label: 'Comparecimento',
      value: formatPct(stats.attendance_pct),
      target: `meta ${formatPct(stats.target_attendance_pct)}`,
      progress: progressOf(stats.attendance_pct, stats.target_attendance_pct),
      tone: indicatorTone(stats.attendance_pct, stats.target_attendance_pct),
    },
    {
      key: 'crm',
      label: 'CRM atualizado',
      value: formatPct(stats.crm_pct),
      target: `meta ${formatPct(stats.target_crm_pct)}`,
      progress: progressOf(stats.crm_pct, stats.target_crm_pct),
      tone: indicatorTone(stats.crm_pct, stats.target_crm_pct),
    },
    {
      key: 'activities',
      label: 'Atividades por pessoa',
      value: hasActivities ? formatNumber(activities) : '—',
      target: `meta ${formatNumber(stats.target_activities_count)}`,
      progress: progressOf(hasActivities ? activities : null, stats.target_activities_count),
      tone: indicatorTone(hasActivities ? activities : null, stats.target_activities_count),
    },
  ]
}
