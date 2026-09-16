import { describe, expect, test } from 'vitest'
import {
  firstName,
  formatBRL,
  formatCoins,
  formatCountdown,
  formatDaysLeft,
  formatNumber,
  formatOrdinal,
  formatPct,
  formatPoints,
  formatRelative,
  initials,
  maskTeamCode,
  pluralize,
} from './format'

describe('formatBRL', () => {
  test('formats whole reais without cents by default', () => {
    expect(formatBRL(8500)).toBe('R$ 8.500')
  })
  test('formats cents when requested', () => {
    expect(formatBRL(1234.5, { cents: true })).toBe('R$ 1.234,50')
  })
  test('uses compact notation above one thousand', () => {
    expect(formatBRL(48000, { compact: true })).toBe('R$ 48 mil')
  })
  test('keeps compact off below one thousand', () => {
    expect(formatBRL(950, { compact: true })).toBe('R$ 950')
  })
  test('treats NaN and Infinity as zero', () => {
    expect(formatBRL(Number.NaN)).toBe('R$ 0')
    expect(formatBRL(Number.POSITIVE_INFINITY)).toBe('R$ 0')
  })
  test('never contains a non-breaking space', () => {
    expect(formatBRL(10)).not.toMatch(/\u00A0/)
  })
})

describe('pt-BR numbers', () => {
  test('formatNumber uses dot as thousands separator', () => {
    expect(formatNumber(1850)).toBe('1.850')
    expect(formatNumber(92.456, 1)).toBe('92,5')
  })
  test('formatPoints adds unit and typographic minus', () => {
    expect(formatPoints(1850)).toBe('1.850 pts')
    expect(formatPoints(-200)).toBe('−200 pts')
  })
  test('formatCoins pluralizes', () => {
    expect(formatCoins(1)).toBe('1 moeda')
    expect(formatCoins(740)).toBe('740 moedas')
    expect(formatCoins(0)).toBe('0 moedas')
  })
  test('formatPct renders dash for null', () => {
    expect(formatPct(null)).toBe('—')
    expect(formatPct(92.5, 1)).toBe('92,5%')
  })
  test('formatOrdinal', () => {
    expect(formatOrdinal(3)).toBe('3º')
    expect(formatOrdinal(null)).toBe('—')
  })
  test('pluralize', () => {
    expect(pluralize(1, 'dia', 'dias')).toBe('1 dia')
    expect(pluralize(12, 'dia', 'dias')).toBe('12 dias')
  })
})

describe('formatRelative', () => {
  const now = Date.UTC(2026, 8, 15, 15, 0, 0)
  const at = (msAgo: number) => new Date(now - msAgo).toISOString()
  test('returns Agora under one minute', () => {
    expect(formatRelative(at(30_000), now)).toBe('Agora')
  })
  test('returns minutes under one hour', () => {
    expect(formatRelative(at(12 * 60_000), now)).toBe('12 min')
  })
  test('returns hours under one day', () => {
    expect(formatRelative(at(5 * 3_600_000), now)).toBe('5 h')
  })
  test('returns Ontem between one and two days', () => {
    expect(formatRelative(at(30 * 3_600_000), now)).toBe('Ontem')
  })
  test('returns days under one week', () => {
    expect(formatRelative(at(3 * 86_400_000), now)).toBe('3 d')
  })
  test('falls back to short date after a week', () => {
    expect(formatRelative(at(10 * 86_400_000), now)).toMatch(/^\d{2}\/\d{2}$/)
  })
  test('future timestamps count as Agora', () => {
    expect(formatRelative(new Date(now + 60_000).toISOString(), now)).toBe('Agora')
  })
  test('invalid dates render dash', () => {
    expect(formatRelative('não-é-data', now)).toBe('—')
  })
})

describe('countdown and days left', () => {
  test('formatCountdown HH:MM:SS', () => {
    expect(formatCountdown(2 * 3600 + 14 * 60 + 30)).toBe('02:14:30')
    expect(formatCountdown(-5)).toBe('00:00:00')
  })
  test('formatCountdown switches to days above 99 hours', () => {
    expect(formatCountdown(100 * 3600 + 14 * 60)).toBe('4d 04:14')
  })
  test('formatDaysLeft', () => {
    expect(formatDaysLeft(2)).toBe('finaliza em 2 dias')
    expect(formatDaysLeft(1)).toBe('finaliza em 1 dia')
    expect(formatDaysLeft(0)).toBe('finaliza hoje')
    expect(formatDaysLeft(-1)).toBe('encerrado')
  })
})

describe('names and codes', () => {
  test('initials takes first and last word', () => {
    expect(initials('Regra Exemplo Teste')).toBe('RT')
    expect(initials('Solo')).toBe('SO')
    expect(initials('   ')).toBe('?')
  })
  test('firstName', () => {
    expect(firstName('  Regra Exemplo ')).toBe('Regra')
  })
  test('maskTeamCode groups 4-4-4', () => {
    expect(maskTeamCode('a3f9c21b7e04')).toBe('A3F9-C21B-7E04')
    expect(maskTeamCode('A3F9-C21B-7E04')).toBe('A3F9-C21B-7E04')
  })
})
