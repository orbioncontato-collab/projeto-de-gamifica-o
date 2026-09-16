import { afterEach, describe, expect, test, vi } from 'vitest'
import { isTheme, readDocumentTheme, readStoredTheme, systemTheme, THEME_STORAGE_KEY } from './use-theme'

describe('use-theme (lógica pura)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    delete document.documentElement.dataset['theme']
  })

  test('isTheme aceita só dark/light', () => {
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('light')).toBe(true)
    expect(isTheme('auto')).toBe(false)
    expect(isTheme(null)).toBe(false)
    expect(isTheme(undefined)).toBe(false)
  })

  test('readDocumentTheme cai em dark sem atributo ou com valor inválido', () => {
    expect(readDocumentTheme()).toBe('dark')
    document.documentElement.dataset['theme'] = 'weird'
    expect(readDocumentTheme()).toBe('dark')
    document.documentElement.dataset['theme'] = 'light'
    expect(readDocumentTheme()).toBe('light')
  })

  test('readStoredTheme devolve null sem preferência salva ou com valor inválido', () => {
    expect(readStoredTheme()).toBeNull()
    localStorage.setItem(THEME_STORAGE_KEY, 'blue')
    expect(readStoredTheme()).toBeNull()
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(readStoredTheme()).toBe('light')
  })

  test('readStoredTheme não lança quando o storage está indisponível', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(readStoredTheme()).toBeNull()
  })

  test('systemTheme segue prefers-color-scheme e cai em dark sem matchMedia', () => {
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: q.includes('light'),
    })) as unknown as typeof window.matchMedia
    expect(systemTheme()).toBe('light')
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia
    expect(systemTheme()).toBe('dark')
    window.matchMedia = undefined as unknown as typeof window.matchMedia
    expect(systemTheme()).toBe('dark')
    window.matchMedia = original
  })
})
