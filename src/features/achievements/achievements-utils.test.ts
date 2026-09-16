import { describe, expect, test } from 'vitest'
import { achievementCounter, criteriaHint, rewardSummary } from './achievements-utils'

describe('achievementCounter', () => {
  test('counts unlocked and builds "N de M" with singular/plural', () => {
    expect(achievementCounter([])).toEqual({
      unlocked: 0,
      total: 0,
      noun: 'desbloqueadas',
      label: '0 de 0 desbloqueadas',
    })
    expect(achievementCounter([{ is_unlocked: true }, { is_unlocked: false }])).toEqual({
      unlocked: 1,
      total: 2,
      noun: 'desbloqueada',
      label: '1 de 2 desbloqueada',
    })
    expect(
      achievementCounter([{ is_unlocked: true }, { is_unlocked: true }, { is_unlocked: false }]).label,
    ).toBe('2 de 3 desbloqueadas')
  })
})

describe('criteriaHint', () => {
  test('describes every criteria in pt-BR with formatted values', () => {
    expect(criteriaHint('first_sale', null, 'lifetime')).toBe('Registre sua primeira venda')
    expect(criteriaHint('streak_days', 7, 'lifetime')).toBe('7 dias seguidos com atividade')
    expect(criteriaHint('sales_total', 50000, 'lifetime')).toBe('R$ 50.000 em vendas no total')
    expect(criteriaHint('points_total', 1500, 'season')).toBe('1.500 pontos na temporada')
    expect(criteriaHint('missions_completed', 10, 'season')).toBe('10 missões concluídas na temporada')
    expect(criteriaHint('monthly_goal', null, 'season')).toBe('Bata sua meta mensal')
    expect(criteriaHint('rank_first', null, 'season')).toBe('Termine a temporada em 1º lugar')
  })
})

describe('rewardSummary', () => {
  test('joins points and coins, omitting zeros', () => {
    expect(rewardSummary(50, 50)).toBe('+50 pts · +50 moedas')
    expect(rewardSummary(0, 300)).toBe('+300 moedas')
    expect(rewardSummary(0, 0)).toBe('')
  })
})
