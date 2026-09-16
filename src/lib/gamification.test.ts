import { describe, expect, test } from 'vitest'
import type {
  ActiveEvent,
  DashboardData,
  DashboardPayload,
  FeedPayload,
  VActivityFeed,
  VWheelQueue,
} from './database.types'
import {
  conversionOf,
  eventState,
  feedSentence,
  goalProjection,
  greeting,
  isMissionFilter,
  levelFromPoints,
  medalFor,
  missionFilterKinds,
  nextRewardCopy,
  spinButtonLabel,
  wheelStatusLine,
  xpProgress,
  type WheelState,
} from './gamification'

const TZ = 'America/Sao_Paulo'

describe('level and XP', () => {
  test('levelFromPoints floors points / xpPerLevel', () => {
    expect(levelFromPoints(0, 1000)).toBe(0)
    expect(levelFromPoints(999, 1000)).toBe(0)
    expect(levelFromPoints(1000, 1000)).toBe(1)
    expect(levelFromPoints(2500, 1000)).toBe(2)
  })
  test('levelFromPoints guards negative points and invalid xpPerLevel', () => {
    expect(levelFromPoints(-50, 1000)).toBe(0)
    expect(levelFromPoints(7, 0)).toBe(7)
  })
  test('xpProgress splits points inside the current level', () => {
    expect(xpProgress(2350, 1000)).toEqual({ level: 2, xpInLevel: 350, xpToNext: 650, pct: 35 })
  })
  test('xpProgress rounds pct to one decimal', () => {
    expect(xpProgress(333, 1000).pct).toBe(33.3)
    expect(xpProgress(0, 1000)).toEqual({ level: 0, xpInLevel: 0, xpToNext: 1000, pct: 0 })
  })
})

describe('greeting and medals', () => {
  const at = (hourUtc: number) => new Date(Date.UTC(2026, 8, 15, hourUtc, 0, 0)) // São Paulo = UTC-3
  test('greeting follows the app time zone', () => {
    expect(greeting(at(11), TZ)).toBe('Bom dia') // 08:00 local
    expect(greeting(at(17), TZ)).toBe('Boa tarde') // 14:00 local
    expect(greeting(at(23), TZ)).toBe('Boa noite') // 20:00 local
    expect(greeting(at(6), TZ)).toBe('Boa noite') // 03:00 local
  })
  test('medalFor only for the podium', () => {
    expect(medalFor(1)).toBe('🥇')
    expect(medalFor(2)).toBe('🥈')
    expect(medalFor(3)).toBe('🥉')
    expect(medalFor(4)).toBeNull()
    expect(medalFor(null)).toBeNull()
  })
})

describe('goalProjection (projected date)', () => {
  const season_ends_at = '2026-10-01T03:00:00.000Z' // 2026-09-30 23:59 local → last day 2026-09-30
  test('reached when sales cover the goal', () => {
    expect(
      goalProjection({ goal_amount: 10000, sales_amount: 10000, projected_goal_date: null, season_ends_at }),
    ).toEqual({ kind: 'reached' })
  })
  test('no_pace without projection or without goal', () => {
    expect(
      goalProjection({ goal_amount: 10000, sales_amount: 100, projected_goal_date: null, season_ends_at }),
    ).toEqual({ kind: 'no_pace' })
    expect(
      goalProjection({ goal_amount: 0, sales_amount: 0, projected_goal_date: '2026-09-20', season_ends_at }),
    ).toEqual({ kind: 'no_pace' })
  })
  test('on_track when the projected date is inside the season', () => {
    expect(
      goalProjection({
        goal_amount: 10000,
        sales_amount: 4000,
        projected_goal_date: '2026-09-25',
        season_ends_at,
      }),
    ).toEqual({ kind: 'on_track', date: '2026-09-25' })
  })
  test('late when the projected date is after the last day', () => {
    expect(
      goalProjection({
        goal_amount: 10000,
        sales_amount: 4000,
        projected_goal_date: '2026-10-03T00:00:00Z',
        season_ends_at,
      }),
    ).toEqual({ kind: 'late', date: '2026-10-03' })
  })
})

describe('mission filters', () => {
  test('isMissionFilter accepts only the three filters', () => {
    expect(isMissionFilter('hoje')).toBe(true)
    expect(isMissionFilter('semana')).toBe(true)
    expect(isMissionFilter('especiais')).toBe(true)
    expect(isMissionFilter('ontem')).toBe(false)
    expect(isMissionFilter(undefined)).toBe(false)
  })
  test('missionFilterKinds maps filters to mission kinds', () => {
    expect(missionFilterKinds.hoje).toEqual(['daily', 'lightning'])
    expect(missionFilterKinds.semana).toEqual(['weekly'])
    expect(missionFilterKinds.especiais).toEqual(['special'])
  })
})

describe('eventState and conversion', () => {
  const ev: ActiveEvent = {
    id: 'e',
    name: 'Evento',
    multiplier: 2,
    starts_at: '2026-09-15T12:00:00Z',
    ends_at: '2026-09-15T14:00:00Z',
    state: 'upcoming',
  }
  test('none without event or after the end', () => {
    expect(eventState(null, 0)).toEqual({ kind: 'none' })
    expect(eventState(ev, Date.parse('2026-09-15T14:00:00Z'))).toEqual({ kind: 'none' })
  })
  test('upcoming and live with rounded-up seconds', () => {
    expect(eventState(ev, Date.parse('2026-09-15T11:59:59.500Z'))).toEqual({
      kind: 'upcoming',
      secondsToStart: 1,
    })
    expect(eventState(ev, Date.parse('2026-09-15T13:00:00Z'))).toEqual({ kind: 'live', secondsToEnd: 3600 })
  })
  test('conversionOf is null without meetings and capped at 999.99', () => {
    expect(conversionOf(3, 0)).toBeNull()
    expect(conversionOf(1, 3)).toBe(33.33)
    expect(conversionOf(5000, 1)).toBe(999.99)
  })
})

describe('nextRewardCopy (B.6 priority)', () => {
  const base: DashboardData = {
    season: { id: 's' } as DashboardData['season'],
    stats: null,
    ranking_top: [],
    missions_today: [],
    next_reward: null,
    pending_earned_spins: 0,
    active_event: null,
    feed: [],
  }
  test('earned spins come first', () => {
    expect(nextRewardCopy({ ...base, pending_earned_spins: 1 }).title).toBe('Você tem 1 giro para usar')
    expect(nextRewardCopy({ ...base, pending_earned_spins: 3 }).cta.to).toBe('/roleta')
  })
  test('then the cheapest reward', () => {
    const copy = nextRewardCopy({
      ...base,
      next_reward: { id: 'r', name: 'Vale-café', icon: '☕', cost_coins: 100, missing_coins: 40 },
    })
    expect(copy.title).toBe('☕ Vale-café')
    expect(copy.body).toBe('Faltam 40 moedas para resgatar.')
    expect(copy.cta.to).toBe('/recompensas')
  })
  test('fallback invites to missions (also without season)', () => {
    const noSeason: DashboardPayload = { season: null }
    expect(nextRewardCopy(noSeason).cta.to).toBe('/missoes')
    expect(nextRewardCopy(base).title).toBe('Ganhe moedas')
  })
})

describe('wheel labels', () => {
  const active = { person_name: 'Convidado', attempts_used: 1, attempts_allowed: 3 } as VWheelQueue
  const free: WheelState = {
    mode: 'free',
    active: null,
    pendingSpinId: null,
    pendingLabel: null,
    myTurn: false,
    wheelKind: 'classic',
  }
  const turn: WheelState = { ...free, mode: 'turn', active }
  const pending: WheelState = { ...turn, mode: 'pending', pendingSpinId: 'spin', pendingLabel: '50 moedas' }
  test('wheelStatusLine', () => {
    expect(wheelStatusLine(free)).toBe('GIRO LIVRE')
    expect(wheelStatusLine(turn)).toBe('VEZ DE CONVIDADO • Tentativa 2 de 3')
    expect(wheelStatusLine(pending)).toBe('AGUARDANDO APROVAÇÃO • 50 moedas')
  })
  test('spinButtonLabel', () => {
    expect(spinButtonLabel(free, false)).toBe('GIRAR ROLETA')
    expect(spinButtonLabel(turn, false)).toBe('GIRAR ROLETA • Convidado')
    expect(spinButtonLabel(pending, false)).toBe('VER PRÊMIO • Convidado')
    expect(spinButtonLabel(turn, true)).toBe('GIRANDO…')
  })
})

describe('feedSentence', () => {
  // Sem pessoas fictícias: o nome é o papel genérico "Colaborador" e o sistema assina como "Orbion".
  const row = (
    kind: VActivityFeed['kind'],
    payload: FeedPayload,
    full_name: string | null = 'Colaborador Exemplo',
  ): VActivityFeed => ({
    id: 'f',
    kind,
    profile_id: full_name ? 'p' : null,
    full_name,
    avatar_path: null,
    color: null,
    job_title: null,
    season_id: null,
    payload,
    occurred_at: '2026-09-15T12:00:00Z',
  })

  test('uses only the first name of the actor', () => {
    expect(feedSentence(row('sale', { amount: 8500 })).name).toBe('Colaborador')
  })
  test('sale formats the amount in BRL', () => {
    expect(feedSentence(row('sale', { amount: 8500 })).text).toBe('realizou uma venda de R$ 8.500')
  })
  test('achievement and mission quote the title with fallbacks', () => {
    expect(feedSentence(row('achievement', { title: 'Primeira venda' })).text).toBe(
      'desbloqueou "Primeira venda"',
    )
    expect(feedSentence(row('achievement', {})).text).toBe('desbloqueou "uma conquista"')
    expect(feedSentence(row('mission_completed', { title: 'Ligar para 5 leads' })).text).toBe(
      'concluiu a missão "Ligar para 5 leads"',
    )
  })
  test('wheel_prize resolves the wheel label', () => {
    expect(feedSentence(row('wheel_prize', { label: '50 moedas', wheel_kind: 'premium' })).text).toBe(
      'ganhou 50 moedas na Roleta Premium',
    )
    expect(feedSentence(row('wheel_prize', { label: '50 moedas' })).text).toBe('ganhou 50 moedas na Roleta')
  })
  test('level_up and challenge_finished', () => {
    expect(feedSentence(row('level_up', { to_level: 4 })).text).toBe('subiu para o nível 4')
    expect(feedSentence(row('challenge_finished', { name: 'Semana turbo', is_winner: true })).text).toBe(
      'venceu o desafio "Semana turbo"',
    )
    expect(feedSentence(row('challenge_finished', { name: 'Semana turbo' })).text).toBe(
      'encerrou o desafio "Semana turbo"',
    )
  })
  test('season_closed is signed by Orbion and handles a missing champion', () => {
    const closed = feedSentence(
      row('season_closed', { season_name: 'Setembro', champion_name: 'Colaborador' }, null),
    )
    expect(closed.name).toBe('Orbion')
    expect(closed.text).toBe('Temporada Setembro encerrada — campeão: Colaborador')
    expect(feedSentence(row('season_closed', { season_name: 'Setembro' }, null)).text).toBe(
      'Temporada Setembro encerrada — sem campeão',
    )
  })
})
