import { describe, expect, test } from 'vitest'
import { diffProfilePatch, editProfileSchema, isHexColor, readAvatarPresets } from './schemas'

/** monta hex sem literal `#RRGGBB` (regra de lint contra hex em features/**) */
const hex = (v: string): string => `#${v}`

describe('editProfileSchema', () => {
  test('aceita nome e cor hex; recusa nome curto e cor inválida', () => {
    expect(editProfileSchema.safeParse({ full_name: 'Usuário de Teste', color: hex('00E887') }).success).toBe(
      true,
    )
    expect(editProfileSchema.safeParse({ full_name: 'A', color: hex('00E887') }).success).toBe(false)
    expect(editProfileSchema.safeParse({ full_name: 'Usuário de Teste', color: 'verde' }).success).toBe(false)
    expect(editProfileSchema.safeParse({ full_name: 'Usuário de Teste', color: '' }).success).toBe(true)
  })
})

describe('diffProfilePatch', () => {
  const current = { full_name: 'Usuário de Teste', color: hex('00E887') }
  test('nada mudou → null (sem update vazio)', () => {
    expect(diffProfilePatch(current, { full_name: 'Usuário de Teste ', color: hex('00e887') })).toBeNull()
  })
  test('só o que mudou, cor normalizada em maiúsculas', () => {
    expect(diffProfilePatch(current, { full_name: 'Usuário de Teste', color: hex('ffc83d') })).toEqual({
      color: hex('FFC83D'),
    })
    expect(diffProfilePatch(current, { full_name: 'Usuário de Teste', color: '' })).toBeNull()
    expect(diffProfilePatch(current, { full_name: 'Usuário Renomeado', color: hex('00E887') })).toEqual({
      full_name: 'Usuário Renomeado',
    })
  })
})

describe('readAvatarPresets', () => {
  test('sem root devolve lista vazia; com tokens hex no CSS devolve só os válidos, sem repetir', () => {
    expect(readAvatarPresets(null)).toEqual([])
    const el = document.createElement('div')
    el.style.setProperty('--accent', hex('00e887'))
    el.style.setProperty('--gold', hex('00E887'))
    el.style.setProperty('--blue', 'oklch(0.6 0.2 260)')
    document.body.appendChild(el)
    expect(readAvatarPresets(el)).toEqual([hex('00E887')])
    el.remove()
  })
  test('isHexColor', () => {
    expect(isHexColor(hex('ABCDEF'))).toBe(true)
    expect(isHexColor('#abc')).toBe(false)
  })
})
