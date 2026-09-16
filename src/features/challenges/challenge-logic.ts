import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/dates'
import { formatBRL, formatCoins, formatDateTime, formatNumber, formatPoints } from '@/lib/format'
import { WHEEL_KIND_LABELS } from '@/lib/labels'
import type {
  BootstrapSeason,
  ChallengeMetric,
  SaveChallengeInput,
  VChallengeBoard,
} from '@/lib/database.types'
import type { ChallengeFormInput, ChallengeFormValues } from './schemas'

/** Regras puras de Desafios (testadas): janela, conversão do formulário, rótulos de valor/prêmio, barra do duelo. */

export type SeasonWindow = Pick<BootstrapSeason, 'starts_at' | 'ends_at'>

export type WindowCheck =
  | { ok: true; startsAt: string; endsAt: string }
  | { ok: false; field: 'startsAt' | 'endsAt'; message: string }

/** Espelha `validate_challenge_window` + regra de `activate_challenge` (fim no futuro). */
export function checkChallengeWindow(
  values: Pick<ChallengeFormValues, 'startsAt' | 'endsAt'>,
  season: SeasonWindow | null,
  tz: string,
  now: number = Date.now(),
): WindowCheck {
  const startsAt = fromDateTimeLocalValue(values.startsAt, tz)
  const endsAt = fromDateTimeLocalValue(values.endsAt, tz)
  if (!startsAt) return { ok: false, field: 'startsAt', message: 'Informe data e hora de início.' }
  if (!endsAt) return { ok: false, field: 'endsAt', message: 'Informe data e hora de fim.' }
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (end <= start) return { ok: false, field: 'endsAt', message: 'O fim precisa ser depois do início.' }
  if (end <= now) return { ok: false, field: 'endsAt', message: 'O fim precisa estar no futuro.' }
  if (!season)
    return { ok: false, field: 'startsAt', message: 'Sem temporada ativa: ative uma temporada antes.' }
  if (start < new Date(season.starts_at).getTime()) {
    return {
      ok: false,
      field: 'startsAt',
      message: `O início precisa ser a partir de ${formatDateTime(season.starts_at, tz)} (início da temporada).`,
    }
  }
  if (end > new Date(season.ends_at).getTime()) {
    return {
      ok: false,
      field: 'endsAt',
      message: `O fim precisa ser até ${formatDateTime(season.ends_at, tz)} (fim da temporada).`,
    }
  }
  return { ok: true, startsAt, endsAt }
}

/** Formulário validado → payload de `save_challenge`. Coletivo sem participantes = todos os ativos (o banco resolve). */
export function toSaveChallengeInput(
  values: ChallengeFormValues,
  window: { startsAt: string; endsAt: string },
  id?: string,
): SaveChallengeInput {
  const input: SaveChallengeInput = {
    name: values.name,
    description: values.description ?? null,
    kind: values.kind,
    metric: values.metric,
    target_value: values.targetValue,
    reward_points: values.rewardPoints,
    reward_coins: values.rewardCoins,
    reward_spin: values.rewardSpin === 'none' ? null : values.rewardSpin,
    reward_description: values.rewardDescription ?? null,
    starts_at: window.startsAt,
    ends_at: window.endsAt,
    participant_ids: values.participantIds,
  }
  if (id) input.id = id
  return input
}

/** Valores iniciais: novo (hoje 00:00 até +7 dias 23:59, fuso do app) ou edição de rascunho. */
export function challengeFormDefaults(
  challenge: VChallengeBoard | null,
  tz: string,
  now: Date = new Date(),
): ChallengeFormInput {
  if (challenge) {
    return {
      name: challenge.name,
      description: challenge.description ?? '',
      kind: challenge.kind,
      metric: challenge.metric,
      targetValue: challenge.target_value,
      rewardPoints: challenge.reward_points,
      rewardCoins: challenge.reward_coins,
      rewardSpin: challenge.reward_spin ?? 'none',
      rewardDescription: challenge.reward_description ?? '',
      startsAt: toDateTimeLocalValue(challenge.starts_at, tz),
      endsAt: toDateTimeLocalValue(challenge.ends_at, tz),
      participantIds: challenge.participants.map((p) => p.profile_id),
    }
  }
  const day = toDateTimeLocalValue(now.toISOString(), tz).slice(0, 10)
  const endDay = toDateTimeLocalValue(new Date(now.getTime() + 7 * 86_400_000).toISOString(), tz).slice(0, 10)
  return {
    name: '',
    description: '',
    kind: 'duel',
    metric: 'sales_count',
    targetValue: 1,
    rewardPoints: 0,
    rewardCoins: 0,
    rewardSpin: 'none',
    rewardDescription: '',
    startsAt: `${day}T00:00`,
    endsAt: `${endDay}T23:59`,
    participantIds: [],
  }
}

/** Valor da métrica formatado: R$ para faturamento, pontos, senão número inteiro. */
export function formatMetricValue(metric: ChallengeMetric, value: number): string {
  const n = Number.isFinite(value) ? value : 0
  if (metric === 'revenue') return formatBRL(n)
  if (metric === 'points') return formatPoints(n)
  return formatNumber(n)
}

/** "+300 pts · 100 moedas · Roleta Premium" ou o texto livre do prêmio. */
export function challengeRewardLabel(
  c: Pick<VChallengeBoard, 'reward_points' | 'reward_coins' | 'reward_spin' | 'reward_description'>,
): string {
  if (c.reward_description) return c.reward_description
  const parts: string[] = []
  if (c.reward_points > 0) parts.push(`+${formatPoints(c.reward_points)}`)
  if (c.reward_coins > 0) parts.push(formatCoins(c.reward_coins))
  if (c.reward_spin) parts.push(WHEEL_KIND_LABELS[c.reward_spin])
  return parts.length > 0 ? parts.join(' · ') : 'Sem prêmio definido'
}

/** Barra proporcional do duelo: fatia do lado esquerdo em % (50/50 quando ambos zerados). */
export function duelShare(left: number, right: number): number {
  const a = Math.max(left, 0)
  const b = Math.max(right, 0)
  const total = a + b
  if (total <= 0) return 50
  return Math.round((a / total) * 100)
}
