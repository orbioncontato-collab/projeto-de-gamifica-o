import { describe, expect, test } from 'vitest'
import type { AppSettingsRow, VSeason } from '@/lib/database.types'
import {
  activeSeasonEnded,
  formatLocalDay,
  canActivateSeason,
  nextSeasonStartPatch,
  seasonEndsOn,
  seasonFormDefaults,
  seasonState,
  toAppSettingsPatch,
  toSaveSpecialEventInput,
  toSeasonPatch,
} from './season-logic'
import { companyFormSchema, eventFormSchema, seasonFormSchema } from './schemas'
import { hideTeamCode } from './team-code'

const TZ = 'America/Sao_Paulo'
const NOW = new Date('2026-09-15T15:00:00Z') // 12:00 em São Paulo

const season = (over: Partial<VSeason>): VSeason => ({
  id: over.id ?? '22222222-2222-4222-8222-222222222222',
  name: 'Setembro',
  starts_at: '2026-09-01T03:00:00Z',
  ends_at: '2026-10-01T03:00:00Z',
  team_goal_amount: 0,
  xp_per_level: 400,
  is_active: true,
  closed_at: null,
  closed_by: null,
  created_by: null,
  created_at: '2026-08-31T00:00:00Z',
  updated_at: '2026-08-31T00:00:00Z',
  is_current: true,
  days_total: 30,
  days_elapsed: 15,
  days_left: 15,
  ...over,
})

const settings: AppSettingsRow = {
  id: 1,
  company_name: 'Orbion',
  xp_per_level: 400,
  currency: 'BRL',
  timezone: TZ,
  target_conversion_pct: 25,
  target_attendance_pct: 70,
  target_crm_pct: 95,
  target_activities_count: 1000,
  streak_business_days_only: false,
  rank_admins: true,
  auto_approve_members: false,
  platform_name: 'Sales League',
  brand_preset: 'esmeralda',
  logo_data_url: null,
  default_theme: 'dark',
  updated_at: '2026-09-01T00:00:00Z',
  updated_by: null,
}

describe('seasonState / canActivateSeason', () => {
  test('ativa dentro da janela', () => {
    expect(seasonState(season({}), NOW.getTime())).toBe('active')
  })
  test('ativa com fim no passado = ended', () => {
    const s = season({ ends_at: '2026-09-10T03:00:00Z' })
    expect(seasonState(s, NOW.getTime())).toBe('ended')
    expect(activeSeasonEnded([s], NOW.getTime())?.id).toBe(s.id)
  })
  test('encerrada tem prioridade', () => {
    expect(seasonState(season({ closed_at: '2026-09-14T00:00:00Z', is_active: false }), NOW.getTime())).toBe(
      'closed',
    )
  })
  test('futura não pode ativar e tooltip traz a data', () => {
    const s = season({ is_active: false, starts_at: '2026-10-01T03:00:00Z', ends_at: '2026-11-01T03:00:00Z' })
    expect(seasonState(s, NOW.getTime())).toBe('upcoming')
    expect(canActivateSeason(s, TZ, NOW.getTime())).toEqual({ allowed: false, reason: 'Começa em 01/10' })
  })
  test('inativa já iniciada pode ativar', () => {
    expect(canActivateSeason(season({ is_active: false }), TZ, NOW.getTime())).toEqual({ allowed: true })
  })
})

describe('temporada — formulário', () => {
  test('seasonEndsOn devolve o último dia (fim exclusivo)', () => {
    expect(seasonEndsOn('2026-10-01T03:00:00Z', TZ)).toBe('2026-09-30')
  })
  test('defaults de nova temporada: hoje + 30 dias', () => {
    const d = seasonFormDefaults(null, TZ, NOW)
    expect(d.startsOn).toBe('2026-09-15')
    expect(d.endsOn).toBe('2026-10-14')
  })
  test('toSeasonPatch envia só o que mudou e ignora datas se encerrada', () => {
    const s = season({})
    const values = seasonFormSchema.parse({
      name: 'Setembro',
      startsOn: '2026-09-02',
      endsOn: '2026-09-30',
      teamGoalAmount: '50.000,00',
      activate: false,
    })
    expect(toSeasonPatch(values, s, TZ)).toEqual({ team_goal_amount: 50000, starts_on: '2026-09-02' })
    expect(toSeasonPatch(values, { ...s, closed_at: '2026-09-14T00:00:00Z' }, TZ)).toEqual({
      team_goal_amount: 50000,
    })
  })
  test('schema recusa fim antes do início', () => {
    const r = seasonFormSchema.safeParse({
      name: 'X',
      startsOn: '2026-09-10',
      endsOn: '2026-09-01',
      teamGoalAmount: 0,
      activate: false,
    })
    expect(r.success).toBe(false)
  })
  test('hideTeamCode mantém só os 4 últimos', () => {
    expect(hideTeamCode('A3F9-C21B-7E04')).toBe('••••-••••-7E04')
    expect(hideTeamCode('7E04')).toBe('7E04')
  })
  test('formatLocalDay', () => {
    expect(formatLocalDay('2026-09-30')).toBe('30/09/2026')
    expect(formatLocalDay('x')).toBe('x')
  })
  test('nextSeasonStartPatch = amanhã no fuso', () => {
    expect(nextSeasonStartPatch(TZ, NOW)).toEqual({ starts_on: '2026-09-16' })
  })
})

describe('configurações da empresa', () => {
  test('toAppSettingsPatch envia só diferenças (fuso intocado não vai)', () => {
    const values = companyFormSchema.parse({
      companyName: 'Orbion',
      xpPerLevel: '500',
      timezone: TZ,
      targetConversionPct: 25,
      targetAttendancePct: 70,
      targetCrmPct: 95,
      targetActivitiesCount: 1000,
      rankAdmins: false,
    })
    expect(toAppSettingsPatch(values, settings)).toEqual({ xp_per_level: 500, rank_admins: false })
  })
})

describe('evento especial', () => {
  test('toSaveSpecialEventInput converte para ISO no fuso e recusa fim ≤ início', () => {
    const values = eventFormSchema.parse({
      name: 'Black Friday',
      description: '',
      multiplier: '2',
      startsAt: '2026-11-27T00:00',
      endsAt: '2026-11-27T23:59',
      isActive: true,
    })
    const r = toSaveSpecialEventInput(values, TZ, 'ev1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.input.id).toBe('ev1')
      expect(r.input.starts_at).toBe('2026-11-27T03:00:00.000Z')
      expect(r.input.description).toBeNull()
    }
    const bad = toSaveSpecialEventInput({ ...values, endsAt: values.startsAt }, TZ)
    expect(bad).toEqual({ ok: false, field: 'endsAt', message: 'O fim precisa ser depois do início.' })
  })
})
