import { describe, expect, test } from 'vitest'
import type { VRanking } from '@/lib/database.types'
import { findMe, gapLabel, podiumSlots } from './ranking-utils'

const row = (rank: number, points: number, id = `p${rank}`): VRanking => ({
  season_id: 's1',
  rank,
  gap_to_above: rank === 1 ? null : 10,
  is_tied_with_above: false,
  has_points: points > 0,
  profile_id: id,
  full_name: `Pessoa ${rank}`,
  avatar_path: null,
  color: 'var(--avatar-fallback)',
  job_title: 'closer',
  team: null,
  points,
  level: 0,
  sales_amount: 0,
  sales_count: 0,
  conversion_pct: null,
  meetings_held: 0,
})

describe('podiumSlots', () => {
  test('sem ninguém com pontos: pódio não é desenhado', () => {
    expect(podiumSlots([])).toBeNull()
    expect(podiumSlots([row(1, 0)])).toBeNull()
  })
  test('1 pessoa com pontos: pódio parcial na ordem 2º · 1º · 3º com vagas em aberto', () => {
    const slots = podiumSlots([row(1, 50)])
    expect(slots?.map((s) => s.place)).toEqual([2, 1, 3])
    expect(slots?.[1]?.row?.profile_id).toBe('p1')
    expect(slots?.[0]?.row).toBeNull()
    expect(slots?.[2]?.row).toBeNull()
  })
  test('3 pessoas, a 3ª sem pontos fica como vaga em aberto', () => {
    const slots = podiumSlots([row(1, 50), row(2, 20), row(3, 0)])
    expect(slots?.[0]?.row?.profile_id).toBe('p2')
    expect(slots?.[2]?.row).toBeNull()
  })
})

describe('gapLabel', () => {
  test('líder / empate / gap', () => {
    expect(gapLabel({ rank: 1, gap_to_above: null, is_tied_with_above: false })).toBe('Líder')
    expect(gapLabel({ rank: 2, gap_to_above: 0, is_tied_with_above: true })).toBe('Empatado com o 1º')
    expect(gapLabel({ rank: 4, gap_to_above: 35, is_tied_with_above: false })).toBe('35 pts para o 3º')
  })
})

describe('findMe', () => {
  test('encontra a própria linha ou null', () => {
    expect(findMe([row(1, 1), row(2, 0, 'me')], 'me')?.rank).toBe(2)
    expect(findMe([row(1, 1)], 'me')).toBeNull()
  })
})
