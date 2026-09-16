import type {
  ActiveEvent,
  DashboardPayload,
  MissionKind,
  VActivityFeed,
  VProfileStats,
  VWheelQueue,
  WheelKind,
} from './database.types'
import { hasDashboard } from './database.types'
import { firstName, formatBRL, formatCoins } from './format'
import { localDay } from './dates'
import { WHEEL_KIND_LABELS } from './labels'

/** Regras puras de gamificação (FRONTEND-ARCH §4.9) — 100 % testadas, sem React e sem supabase. */

export const levelFromPoints = (points: number, xpPerLevel: number): number => {
  const per = xpPerLevel > 0 ? xpPerLevel : 1
  return Math.floor(Math.max(points, 0) / per)
}

export interface XpProgress {
  level: number
  xpInLevel: number
  xpToNext: number
  /** 0–100 com 1 casa */
  pct: number
}
export const xpProgress = (points: number, xpPerLevel: number): XpProgress => {
  const per = xpPerLevel > 0 ? xpPerLevel : 1
  const safePoints = Math.max(points, 0)
  const level = Math.floor(safePoints / per)
  const xpInLevel = safePoints - level * per
  const xpToNext = per - xpInLevel
  const pct = Math.round((xpInLevel / per) * 1000) / 10
  return { level, xpInLevel, xpToNext, pct }
}

export type Greeting = 'Bom dia' | 'Boa tarde' | 'Boa noite'
/** 5–11 Bom dia · 12–17 Boa tarde · resto Boa noite (hora no fuso do app) */
export const greeting = (date: Date, tz: string): Greeting => {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(date),
  )
  if (hour >= 5 && hour <= 11) return 'Bom dia'
  if (hour >= 12 && hour <= 17) return 'Boa tarde'
  return 'Boa noite'
}

export type Medal = '🥇' | '🥈' | '🥉'
export const medalFor = (rank: number | null): Medal | null => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

export type GoalProjection =
  | { kind: 'reached' }
  | { kind: 'no_pace' }
  | { kind: 'on_track'; date: string }
  | { kind: 'late'; date: string }

/**
 * Projeção da meta a partir de `v_profile_stats` (DATA-MODEL §5.1): `projected_goal_date` NULL = sem ritmo;
 * data além do último dia da temporada = atrasado. `date` é "YYYY-MM-DD".
 */
export const goalProjection = (
  row: Pick<VProfileStats, 'projected_goal_date' | 'season_ends_at' | 'goal_amount' | 'sales_amount'>,
  tz = 'America/Sao_Paulo',
): GoalProjection => {
  if (row.goal_amount > 0 && row.sales_amount >= row.goal_amount) return { kind: 'reached' }
  if (!row.projected_goal_date || row.goal_amount <= 0) return { kind: 'no_pace' }
  const lastDay = localDay(new Date(new Date(row.season_ends_at).getTime() - 1), tz)
  const date = row.projected_goal_date.slice(0, 10)
  if (lastDay && date > lastDay) return { kind: 'late', date }
  return { kind: 'on_track', date }
}

export interface FeedSentence {
  icon: string
  name: string
  text: string
}
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Frase pt-BR do feed a partir de `kind` + `payload` (DATA-MODEL §4.29). */
export const feedSentence = (row: VActivityFeed): FeedSentence => {
  const p = row.payload ?? {}
  const name = row.full_name ? firstName(row.full_name) : 'Orbion'
  switch (row.kind) {
    case 'sale':
      return { icon: '🔥', name, text: `realizou uma venda de ${formatBRL(num(p['amount']))}` }
    case 'achievement':
      return { icon: '🏆', name, text: `desbloqueou "${str(p['title'], 'uma conquista')}"` }
    case 'wheel_prize': {
      const wheelKind = str(p['wheel_kind']) as WheelKind
      const wheelLabel = WHEEL_KIND_LABELS[wheelKind] ?? 'Roleta'
      return { icon: '🎰', name, text: `ganhou ${str(p['label'], 'um prêmio')} na ${wheelLabel}` }
    }
    case 'level_up':
      return { icon: '🚀', name, text: `subiu para o nível ${num(p['to_level'])}` }
    case 'mission_completed':
      return { icon: '🎯', name, text: `concluiu a missão "${str(p['title'], 'missão')}"` }
    case 'challenge_finished': {
      const challenge = str(p['name'], 'desafio')
      return {
        icon: '⚔️',
        name,
        text:
          p['is_winner'] === true ? `venceu o desafio "${challenge}"` : `encerrou o desafio "${challenge}"`,
      }
    }
    case 'season_closed': {
      const season = str(p['season_name'], 'Temporada')
      const champion = str(p['champion_name'])
      return {
        icon: '📅',
        name: 'Orbion',
        text: champion
          ? `Temporada ${season} encerrada — campeão: ${champion}`
          : `Temporada ${season} encerrada — sem campeão`,
      }
    }
  }
}

export type MissionFilter = 'hoje' | 'semana' | 'especiais'
export const MISSION_FILTERS: readonly MissionFilter[] = ['hoje', 'semana', 'especiais']
export const isMissionFilter = (v: unknown): v is MissionFilter =>
  v === 'hoje' || v === 'semana' || v === 'especiais'
export const missionFilterKinds: Record<MissionFilter, MissionKind[]> = {
  hoje: ['daily', 'lightning'],
  semana: ['weekly'],
  especiais: ['special'],
}

export interface NextRewardCopy {
  title: string
  body: string
  cta: { label: string; to: '/roleta' | '/recompensas' | '/missoes' }
}
/** B.6: giros ganhos > recompensa mais barata > "complete missões para ganhar moedas" */
export const nextRewardCopy = (dash: DashboardPayload): NextRewardCopy => {
  if (hasDashboard(dash)) {
    if (dash.pending_earned_spins > 0) {
      const n = dash.pending_earned_spins
      return {
        title: n === 1 ? 'Você tem 1 giro para usar' : `Você tem ${n} giros para usar`,
        body: 'Peça ao gestor para liberar sua vez na roleta.',
        cta: { label: 'Ir para a roleta', to: '/roleta' },
      }
    }
    if (dash.next_reward) {
      const r = dash.next_reward
      return {
        title: `${r.icon ? `${r.icon} ` : ''}${r.name}`,
        body: `Faltam ${formatCoins(r.missing_coins)} para resgatar.`,
        cta: { label: 'Ver recompensas', to: '/recompensas' },
      }
    }
  }
  return {
    title: 'Ganhe moedas',
    body: 'Complete missões para ganhar moedas e desbloquear recompensas.',
    cta: { label: 'Ver missões', to: '/missoes' },
  }
}

export type EventState =
  { kind: 'none' } | { kind: 'upcoming'; secondsToStart: number } | { kind: 'live'; secondsToEnd: number }
export const eventState = (ev: ActiveEvent | null, now: number): EventState => {
  if (!ev) return { kind: 'none' }
  const starts = new Date(ev.starts_at).getTime()
  const ends = new Date(ev.ends_at).getTime()
  if (Number.isNaN(starts) || Number.isNaN(ends) || now >= ends) return { kind: 'none' }
  if (now < starts) return { kind: 'upcoming', secondsToStart: Math.ceil((starts - now) / 1000) }
  return { kind: 'live', secondsToEnd: Math.ceil((ends - now) / 1000) }
}

/** % de conversão (vendas / reuniões realizadas), 2 casas, teto 999,99 como a view; null sem reuniões */
export const conversionOf = (sales: number, meetings: number): number | null => {
  if (!(meetings > 0)) return null
  return Math.min(Math.round((sales / meetings) * 10000) / 100, 999.99)
}

/** Estado derivado da fila (assinatura de `useWheelState`, features/wheel — WP4) */
export interface WheelState {
  mode: 'free' | 'turn' | 'pending'
  active: VWheelQueue | null
  pendingSpinId: string | null
  pendingLabel: string | null
  myTurn: boolean
  wheelKind: WheelKind
}

const upperName = (state: WheelState): string => (state.active?.person_name ?? '').toUpperCase()

/** "GIRO LIVRE" | "VEZ DE {NOME} • Tentativa i de n" | "AGUARDANDO APROVAÇÃO • {prêmio}" */
export const wheelStatusLine = (state: WheelState): string => {
  if (state.mode === 'pending') return `AGUARDANDO APROVAÇÃO • ${state.pendingLabel ?? 'prêmio'}`
  if (state.mode === 'turn' && state.active) {
    const attempt = state.active.attempts_used + 1
    return `VEZ DE ${upperName(state)} • Tentativa ${attempt} de ${state.active.attempts_allowed}`
  }
  return 'GIRO LIVRE'
}

/** "GIRAR ROLETA" | "GIRAR ROLETA • {nome}" | "VER PRÊMIO • {nome}" | "GIRANDO…" */
export const spinButtonLabel = (state: WheelState, spinning: boolean): string => {
  if (spinning) return 'GIRANDO…'
  const name = state.active?.person_name ?? ''
  if (state.mode === 'pending') return `VER PRÊMIO • ${name}`
  if (state.mode === 'turn') return `GIRAR ROLETA • ${name}`
  return 'GIRAR ROLETA'
}
