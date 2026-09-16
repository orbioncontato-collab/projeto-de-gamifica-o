import { describe, expect, test } from 'vitest'
import type { VActivityFeed, VTeamStats } from '@/lib/database.types'
import {
  healthItems,
  levelCopy,
  managerMetrics,
  mergeFeedPages,
  rankLine,
  salesTargetCopy,
} from './dashboard-utils'

const TZ = 'America/Sao_Paulo'

const teamZero: VTeamStats = {
  season_id: 's1',
  season_name: 'Setembro',
  starts_at: '2026-09-01T03:00:00Z',
  ends_at: '2026-10-01T03:00:00Z',
  is_active: true,
  team_goal_amount: 0,
  xp_per_level: 400,
  sales_amount: 0,
  attainment_pct: null,
  sales_missing_amount: 0,
  points_total: 0,
  points_distributed: 0,
  active_count: 1,
  pending_count: 0,
  total_count: 1,
  sales_count: 0,
  meetings_scheduled: 0,
  meetings_held: 0,
  calls: 0,
  crm_updates: 0,
  activities_count: 0,
  missions_completed: 0,
  avg_conversion_pct: null,
  attendance_pct: null,
  crm_pct: null,
  queue_count: 0,
  target_conversion_pct: 25,
  target_attendance_pct: 80,
  target_crm_pct: 90,
  target_activities_count: 20,
}

describe('levelCopy', () => {
  test('banco recém-instalado: nível 0, 0 pontos, faltam 400 para o nível 1', () => {
    const copy = levelCopy({ level: 0, points: 0, xp_in_level: 0, xp_to_next: 400, xp_per_level: 400 })
    expect(copy.level).toBe('Nível 0')
    expect(copy.points).toBe('0 pts')
    expect(copy.progressPct).toBe(0)
    expect(copy.remaining).toBe('faltam 400 pts para o nível 1')
  })
  test('percentual dentro do nível e xp_per_level 0 não divide por zero', () => {
    expect(
      levelCopy({ level: 2, points: 900, xp_in_level: 100, xp_to_next: 300, xp_per_level: 400 }).progressPct,
    ).toBe(25)
    expect(
      Number.isFinite(
        levelCopy({ level: 0, points: 0, xp_in_level: 0, xp_to_next: 0, xp_per_level: 0 }).progressPct,
      ),
    ).toBe(true)
  })
})

describe('rankLine', () => {
  test('sem posição / líder / empate / gap', () => {
    expect(rankLine({ rank: null, gap_to_above: null, is_tied_with_above: false })).toBe(
      'Sem posição no ranking ainda',
    )
    expect(rankLine({ rank: 1, gap_to_above: null, is_tied_with_above: false })).toBe('Você lidera o ranking')
    expect(rankLine({ rank: 3, gap_to_above: 0, is_tied_with_above: true })).toBe('Empatado com o 2º')
    expect(rankLine({ rank: 2, gap_to_above: 120, is_tied_with_above: false })).toBe('120 pts para o 1º')
  })
})

describe('salesTargetCopy', () => {
  const base = {
    goal_amount: 0,
    sales_amount: 0,
    goal_pct: null,
    goal_missing_amount: 0,
    projected_goal_date: null,
    season_ends_at: '2026-10-01T03:00:00Z',
  }
  test('meta 0: "Sua meta ainda não foi definida" e sem NaN', () => {
    const copy = salesTargetCopy(base, TZ)
    expect(copy.hasGoal).toBe(false)
    expect(copy.missing).toBe('Sua meta ainda não foi definida')
    expect(copy.pctLabel).toBe('—')
    expect(copy.headline).not.toMatch(/NaN/)
  })
  test('meta definida sem vendas: sem projeção', () => {
    const copy = salesTargetCopy({ ...base, goal_amount: 10000, goal_pct: 0, goal_missing_amount: 10000 }, TZ)
    expect(copy.headline).toBe('R$ 0 de R$ 10.000')
    expect(copy.projection).toMatch(/sem projeção/)
  })
  test('projeção dentro da temporada usa goalProjection (on_track)', () => {
    const copy = salesTargetCopy(
      {
        ...base,
        goal_amount: 10000,
        sales_amount: 2500,
        goal_pct: 25,
        goal_missing_amount: 7500,
        projected_goal_date: '2026-09-20',
      },
      TZ,
    )
    expect(copy.pct).toBe(25)
    expect(copy.projection).toBe('Ritmo atual: meta projetada para 20/09')
  })
  test('projeção depois do fim = atrasado; meta batida', () => {
    expect(
      salesTargetCopy(
        {
          ...base,
          goal_amount: 100,
          sales_amount: 10,
          goal_pct: 10,
          goal_missing_amount: 90,
          projected_goal_date: '2026-11-02',
        },
        TZ,
      ).projection,
    ).toMatch(/depois do fim/)
    expect(
      salesTargetCopy(
        { ...base, goal_amount: 100, sales_amount: 100, goal_pct: 100, goal_missing_amount: 0 },
        TZ,
      ).projection,
    ).toMatch(/Meta batida/)
  })
})

describe('managerMetrics / healthItems', () => {
  test('sem time_stats (null) devolve 4 métricas zeradas com "meta não definida"', () => {
    const m = managerMetrics(null)
    expect(m).toHaveLength(4)
    expect(m[0]?.hint).toBe('meta não definida')
    expect(m.every((x) => !x.value.includes('NaN'))).toBe(true)
  })
  test('só o gestor: "1 ativo", conversão "— (sem reuniões registradas)"', () => {
    expect(managerMetrics(teamZero)[2]?.hint).toBe('1 ativo')
    const h = healthItems(teamZero)
    expect(h[0]?.value).toBe('— (sem reuniões registradas)')
    expect(h[1]?.value).toBe('1 de 1')
    expect(h[2]?.value).toBe('meta não definida')
  })
  test('com meta e conversão acima da meta: tons verdes', () => {
    const h = healthItems({
      ...teamZero,
      team_goal_amount: 50000,
      sales_amount: 50000,
      attainment_pct: 100,
      avg_conversion_pct: 30,
    })
    expect(h[0]?.tone).toBe('green')
    expect(h[2]?.tone).toBe('green')
  })
})

describe('mergeFeedPages', () => {
  const row = (id: string): VActivityFeed => ({
    id,
    kind: 'sale',
    profile_id: null,
    full_name: null,
    avatar_path: null,
    color: null,
    job_title: null,
    season_id: null,
    payload: {},
    occurred_at: '2026-09-15T12:00:00Z',
  })
  test('junta páginas e ignora ids repetidos', () => {
    const out = mergeFeedPages([
      { rows: [row('a'), row('b')], nextCursor: 'x' },
      { rows: [row('b'), row('c')], nextCursor: null },
    ])
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(mergeFeedPages(undefined)).toEqual([])
  })
})
