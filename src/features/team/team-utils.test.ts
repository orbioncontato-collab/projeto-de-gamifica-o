import { describe, expect, test } from 'vitest'
import type { VProfileStats } from '@/lib/database.types'
import { canReceivePoints, filterRoster, signupUrl, toggledStatus } from './team-utils'
import { formToPatch, initialPointsSchema, isEmptyPatch, profileToForm } from './schemas'
import { assertAdminAvatarFile, sumPoints } from './api'
import { makeProfileStats } from './test-fixtures'

describe('team-utils › filterRoster', () => {
  const rows: VProfileStats[] = [
    makeProfileStats({
      profile_id: 'p1',
      full_name: 'Usuário de Teste',
      email: 'teste@exemplo.com',
      job_title: 'sdr',
      team: 'Alfa',
    }),
    makeProfileStats({
      profile_id: 'p2',
      full_name: 'Outro Usuário',
      email: 'outro@exemplo.com',
      job_title: 'closer',
      team: null,
    }),
  ]

  test('empty search returns a copy of all rows', () => {
    const out = filterRoster(rows, '  ')
    expect(out).toEqual(rows)
    expect(out).not.toBe(rows)
  })

  test('matches name ignoring accents/case, email, job label and team', () => {
    expect(filterRoster(rows, 'usuario de').map((r) => r.profile_id)).toEqual(['p1'])
    expect(filterRoster(rows, 'OUTRO@').map((r) => r.profile_id)).toEqual(['p2'])
    expect(filterRoster(rows, 'closer').map((r) => r.profile_id)).toEqual(['p2'])
    expect(filterRoster(rows, 'alfa').map((r) => r.profile_id)).toEqual(['p1'])
    expect(filterRoster(rows, 'zzz')).toEqual([])
  })
})

describe('team-utils › status helpers', () => {
  test('only active profiles can receive initial points', () => {
    expect(canReceivePoints('active')).toBe(true)
    expect(canReceivePoints('pending')).toBe(false)
    expect(canReceivePoints('inactive')).toBe(false)
  })
  test('toggledStatus flips active/inactive', () => {
    expect(toggledStatus('active')).toBe('inactive')
    expect(toggledStatus('inactive')).toBe('active')
  })
  test('signupUrl strips trailing slash', () => {
    expect(signupUrl('https://app.exemplo.com/')).toBe('https://app.exemplo.com/signup')
  })
})

describe('schemas › formToPatch', () => {
  const current = makeProfileStats({ email: 'a@exemplo.com', goal_amount: 1000, team: null, phone: null })

  test('unchanged form yields an empty patch (no-op, never sends points)', () => {
    const values = { ...profileToForm(current), team: null, phone: null, notes: null, goal_amount: 1000 }
    const patch = formToPatch(values, current)
    expect(isEmptyPatch(patch)).toBe(true)
    expect(JSON.stringify(patch)).not.toContain('base_points')
  })

  test('changed fields are included; goal writes goal_amount and default_goal_amount', () => {
    const values = {
      ...profileToForm(current),
      team: 'Beta',
      phone: null,
      notes: null,
      goal_amount: 2500,
      role: 'collaborator' as const,
    }
    expect(formToPatch(values, current)).toEqual({
      team: 'Beta',
      goal_amount: 2500,
      default_goal_amount: 2500,
      role: 'collaborator',
    })
  })

  test('pending profile never gets status in the patch', () => {
    const pending = makeProfileStats({ status: 'pending' })
    const values = {
      ...profileToForm(pending),
      team: null,
      phone: null,
      notes: null,
      goal_amount: pending.goal_amount,
      status: 'active' as const,
    }
    expect(formToPatch(values, pending)).toEqual({})
  })

  test('initialPointsSchema accepts 1..100000 integers only', () => {
    expect(initialPointsSchema.safeParse({ points: '150' }).success).toBe(true)
    expect(initialPointsSchema.safeParse({ points: 0 }).success).toBe(false)
    expect(initialPointsSchema.safeParse({ points: 1.5 }).success).toBe(false)
    expect(initialPointsSchema.safeParse({ points: 100_001 }).success).toBe(false)
  })

  test('sumPoints ignores non-finite values', () => {
    expect(sumPoints([{ points: 100 }, { points: 50 }, { points: Number.NaN }])).toBe(150)
    expect(sumPoints([])).toBe(0)
  })
})

describe('api › assertAdminAvatarFile (antes de qualquer rede)', () => {
  const file = (type: string, size: number): File => {
    const f = new File([new Uint8Array(1)], 'foto', { type })
    Object.defineProperty(f, 'size', { value: size })
    return f
  }
  test('rejects SVG and files over 1,5 MB; accepts a small PNG', () => {
    expect(() => assertAdminAvatarFile(file('image/svg+xml', 10))).toThrow('JPG, PNG ou WebP')
    expect(() => assertAdminAvatarFile(file('image/png', 1_572_865))).toThrow('1,5 MB')
    expect(() => assertAdminAvatarFile(file('image/png', 1_000))).not.toThrow()
  })
})
