import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/dates'
import { formatDateTime } from '@/lib/format'
import type { BootstrapSeason, SaveMissionInput } from '@/lib/database.types'
import type { MissionAdminRow } from './api'
import { LIGHTNING_MAX_HOURS, type MissionFormInput, type MissionFormValues } from './schemas'

/**
 * Regras puras do editor de missão (testadas): janela dentro da temporada, relâmpago ≤ 24 h,
 * conversão formulário ↔ `save_mission`. Espelha `private.validate_mission_window()` no cliente
 * para bloquear antes de enviar.
 */

const HOUR_MS = 3_600_000

export type SeasonWindow = Pick<BootstrapSeason, 'starts_at' | 'ends_at'>

export type WindowCheck =
  | { ok: true; startsAt: string; endsAt: string }
  | { ok: false; field: 'startsAt' | 'endsAt'; message: string }

/** Valida a janela (ISO) contra a temporada e o limite do relâmpago. */
export function checkMissionWindow(
  values: Pick<MissionFormValues, 'kind' | 'startsAt' | 'endsAt'>,
  season: SeasonWindow | null,
  tz: string,
): WindowCheck {
  const startsAt = fromDateTimeLocalValue(values.startsAt, tz)
  const endsAt = fromDateTimeLocalValue(values.endsAt, tz)
  if (!startsAt) return { ok: false, field: 'startsAt', message: 'Informe data e hora de início.' }
  if (!endsAt) return { ok: false, field: 'endsAt', message: 'Informe data e hora de fim.' }
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (end <= start) return { ok: false, field: 'endsAt', message: 'O fim precisa ser depois do início.' }
  if (!season)
    return { ok: false, field: 'startsAt', message: 'Sem temporada ativa: ative uma temporada antes.' }
  const seasonStart = new Date(season.starts_at).getTime()
  const seasonEnd = new Date(season.ends_at).getTime()
  if (start < seasonStart) {
    return {
      ok: false,
      field: 'startsAt',
      message: `O início precisa ser a partir de ${formatDateTime(season.starts_at, tz)} (início da temporada).`,
    }
  }
  if (end > seasonEnd) {
    return {
      ok: false,
      field: 'endsAt',
      message: `O fim precisa ser até ${formatDateTime(season.ends_at, tz)} (fim da temporada).`,
    }
  }
  if (values.kind === 'lightning' && end - start > LIGHTNING_MAX_HOURS * HOUR_MS) {
    return {
      ok: false,
      field: 'endsAt',
      message: `Missão relâmpago dura no máximo ${LIGHTNING_MAX_HOURS} horas.`,
    }
  }
  return { ok: true, startsAt, endsAt }
}

/** Formulário validado → payload de `save_mission`. `participant_ids` só quando `selected`. */
export function toSaveMissionInput(
  values: MissionFormValues,
  window: { startsAt: string; endsAt: string },
  id?: string,
): SaveMissionInput {
  const input: SaveMissionInput = {
    title: values.title,
    description: values.description ?? null,
    icon: values.icon ?? null,
    kind: values.kind,
    metric: values.metric,
    target_kind: values.targetKind,
    target_value: values.targetValue,
    reward_points: values.rewardPoints,
    reward_coins: values.rewardCoins,
    reward_spin: values.rewardSpin === 'none' ? null : values.rewardSpin,
    starts_at: window.startsAt,
    ends_at: window.endsAt,
    audience: values.audience,
    is_active: values.isActive,
  }
  if (values.audience === 'selected') input.participant_ids = values.participantIds
  if (id) input.id = id
  return input
}

/** Valores iniciais: nova missão (janela = hoje 09:00–18:00 no fuso do app) ou edição de uma existente. */
export function missionFormDefaults(
  mission: MissionAdminRow | null,
  tz: string,
  now: Date = new Date(),
): MissionFormInput {
  if (mission) {
    return {
      title: mission.title,
      description: mission.description ?? '',
      icon: mission.icon ?? '',
      kind: mission.kind,
      metric: mission.metric,
      targetKind: mission.target_kind,
      targetValue: mission.target_value,
      rewardPoints: mission.reward_points,
      rewardCoins: mission.reward_coins,
      rewardSpin: mission.reward_spin ?? 'none',
      startsAt: toDateTimeLocalValue(mission.starts_at, tz),
      endsAt: toDateTimeLocalValue(mission.ends_at, tz),
      audience: mission.audience,
      participantIds: mission.participant_ids,
      isActive: mission.is_active,
    }
  }
  const day = toDateTimeLocalValue(now.toISOString(), tz).slice(0, 10)
  return {
    title: '',
    description: '',
    icon: '',
    kind: 'daily',
    metric: 'call',
    targetKind: 'count',
    targetValue: 1,
    rewardPoints: 0,
    rewardCoins: 0,
    rewardSpin: 'none',
    startsAt: `${day}T09:00`,
    endsAt: `${day}T18:00`,
    audience: 'all',
    participantIds: [],
    isActive: true,
  }
}
