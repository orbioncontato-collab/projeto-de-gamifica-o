import type {
  AppSettingsPatch,
  AppSettingsRow,
  SaveSpecialEventInput,
  SeasonPatch,
  VSeason,
  VSpecialEvent,
} from '@/lib/database.types'
import { addDaysLocal, fromDateTimeLocalValue, localDay, toDateTimeLocalValue, todayLocal } from '@/lib/dates'
import { formatDateShort, formatLocalDay } from '@/lib/format'
import type { CreateSeasonInput } from './api'
import type {
  CompanyFormInput,
  CompanyFormValues,
  EventFormInput,
  EventFormValues,
  SeasonFormInput,
  SeasonFormValues,
} from './schemas'

/** Lógica pura de Configurações (testada em season-logic.test.ts). */

export type SeasonState = 'active' | 'closed' | 'upcoming' | 'ended' | 'idle'

/** Estado exibido na lista de temporadas. `ended` = ativa mas `ends_at < now` (alerta "crie/ative a próxima"). */
export function seasonState(
  season: Pick<VSeason, 'is_active' | 'closed_at' | 'starts_at' | 'ends_at'>,
  now: number = Date.now(),
): SeasonState {
  if (season.closed_at) return 'closed'
  const starts = new Date(season.starts_at).getTime()
  const ends = new Date(season.ends_at).getTime()
  if (season.is_active) return ends < now ? 'ended' : 'active'
  if (starts > now) return 'upcoming'
  return 'idle'
}

export type ActivateCheck = { allowed: true } | { allowed: false; reason: string }

/** "Ativar" fica desabilitado enquanto `starts_at > now` com tooltip "Começa em DD/MM" (DATA-MODEL Apêndice B.20). */
export function canActivateSeason(
  season: Pick<VSeason, 'is_active' | 'closed_at' | 'starts_at' | 'ends_at'>,
  tz: string,
  now: number = Date.now(),
): ActivateCheck {
  if (season.closed_at) return { allowed: false, reason: 'Temporada encerrada' }
  if (season.is_active) return { allowed: false, reason: 'Já é a temporada ativa' }
  if (new Date(season.starts_at).getTime() > now)
    return { allowed: false, reason: `Começa em ${formatDateShort(season.starts_at, tz)}` }
  return { allowed: true }
}

/** Há temporada ativa cujo fim já passou? (banner "temporada terminou — crie/ative a próxima"). */
export function activeSeasonEnded(seasons: readonly VSeason[], now: number = Date.now()): VSeason | null {
  return seasons.find((s) => seasonState(s, now) === 'ended') ?? null
}

/** Promovido para `@/lib/format` (integração onda 3). */
export { formatLocalDay }

/** `ends_at` é exclusivo (meia-noite do dia seguinte): o último dia é `ends_at − 1 dia` no fuso. */
export function seasonEndsOn(endsAtIso: string, tz: string): string {
  return addDaysLocal(localDay(endsAtIso, tz), -1)
}

export function seasonFormDefaults(
  season: VSeason | null,
  tz: string,
  now: Date = new Date(),
): SeasonFormInput {
  if (!season) {
    const today = todayLocal(tz, now)
    return { name: '', startsOn: today, endsOn: addDaysLocal(today, 29), teamGoalAmount: 0, activate: false }
  }
  return {
    name: season.name,
    startsOn: localDay(season.starts_at, tz),
    endsOn: seasonEndsOn(season.ends_at, tz),
    teamGoalAmount: season.team_goal_amount,
    activate: false,
  }
}

export function toCreateSeasonInput(values: SeasonFormValues): CreateSeasonInput {
  return {
    name: values.name,
    startsOn: values.startsOn,
    endsOn: values.endsOn,
    teamGoalAmount: values.teamGoalAmount,
    activate: values.activate,
  }
}

/** Só envia o que mudou; datas ficam de fora quando a temporada está encerrada (DATA-MODEL §7.3). */
export function toSeasonPatch(values: SeasonFormValues, season: VSeason, tz: string): SeasonPatch {
  const patch: SeasonPatch = {}
  if (values.name !== season.name) patch.name = values.name
  if (values.teamGoalAmount !== season.team_goal_amount) patch.team_goal_amount = values.teamGoalAmount
  if (!season.closed_at) {
    if (values.startsOn !== localDay(season.starts_at, tz)) patch.starts_on = values.startsOn
    if (values.endsOn !== seasonEndsOn(season.ends_at, tz)) patch.ends_on = values.endsOn
  }
  return patch
}

/** Oferta "Antecipar início da próxima para {hoje+1}" após `gap_until_next_season` (DATA-MODEL §7.3 passo 9). */
export function nextSeasonStartPatch(tz: string, now: Date = new Date()): SeasonPatch {
  return { starts_on: addDaysLocal(todayLocal(tz, now), 1) }
}

export function companyFormDefaults(s: AppSettingsRow): CompanyFormInput {
  return {
    companyName: s.company_name,
    xpPerLevel: s.xp_per_level,
    timezone: s.timezone,
    targetConversionPct: s.target_conversion_pct,
    targetAttendancePct: s.target_attendance_pct,
    targetCrmPct: s.target_crm_pct,
    targetActivitiesCount: s.target_activities_count,
    rankAdmins: s.rank_admins,
  }
}

/** Só as chaves que mudaram — evita `TIMEZONE_LOCKED` quando o fuso não foi tocado. */
export function toAppSettingsPatch(values: CompanyFormValues, current: AppSettingsRow): AppSettingsPatch {
  const patch: AppSettingsPatch = {}
  if (values.companyName !== current.company_name) patch.company_name = values.companyName
  if (values.xpPerLevel !== current.xp_per_level) patch.xp_per_level = values.xpPerLevel
  if (values.timezone !== current.timezone) patch.timezone = values.timezone
  if (values.targetConversionPct !== current.target_conversion_pct)
    patch.target_conversion_pct = values.targetConversionPct
  if (values.targetAttendancePct !== current.target_attendance_pct)
    patch.target_attendance_pct = values.targetAttendancePct
  if (values.targetCrmPct !== current.target_crm_pct) patch.target_crm_pct = values.targetCrmPct
  if (values.targetActivitiesCount !== current.target_activities_count)
    patch.target_activities_count = values.targetActivitiesCount
  if (values.rankAdmins !== current.rank_admins) patch.rank_admins = values.rankAdmins
  return patch
}

export function eventFormDefaults(
  event: VSpecialEvent | null,
  tz: string,
  now: Date = new Date(),
): EventFormInput {
  if (!event) {
    const start = toDateTimeLocalValue(now.toISOString(), tz)
    const end = toDateTimeLocalValue(new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), tz)
    return { name: '', description: null, multiplier: 2, startsAt: start, endsAt: end, isActive: true }
  }
  return {
    name: event.name,
    description: event.description,
    multiplier: event.multiplier,
    startsAt: toDateTimeLocalValue(event.starts_at, tz),
    endsAt: toDateTimeLocalValue(event.ends_at, tz),
    isActive: event.is_active,
  }
}

export type EventInputCheck =
  { ok: true; input: SaveSpecialEventInput } | { ok: false; field: 'startsAt' | 'endsAt'; message: string }

/** Converte o formulário para `save_special_event`; fim ≤ início vira erro de campo antes do envio. */
export function toSaveSpecialEventInput(values: EventFormValues, tz: string, id?: string): EventInputCheck {
  const startsAt = fromDateTimeLocalValue(values.startsAt, tz)
  const endsAt = fromDateTimeLocalValue(values.endsAt, tz)
  if (!startsAt) return { ok: false, field: 'startsAt', message: 'Informe data e hora válidas.' }
  if (!endsAt) return { ok: false, field: 'endsAt', message: 'Informe data e hora válidas.' }
  if (endsAt <= startsAt)
    return { ok: false, field: 'endsAt', message: 'O fim precisa ser depois do início.' }
  return {
    ok: true,
    input: {
      ...(id ? { id } : {}),
      name: values.name,
      description: values.description,
      multiplier: values.multiplier,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: values.isActive,
    },
  }
}
