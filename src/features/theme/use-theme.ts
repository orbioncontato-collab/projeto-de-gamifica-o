import { createContext, useContext } from 'react'

export type Theme = 'dark' | 'light'
export const THEME_STORAGE_KEY = 'orbion-theme'

export interface ThemeContextValue {
  theme: Theme
  /** `persist: false` aplica sem gravar preferência (tema padrão da marca — o usuário ainda "segue o padrão"). */
  setTheme: (theme: Theme, options?: { persist?: boolean }) => void
  toggle: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Lê o tema atual. Fora do ThemeProvider (testes isolados) cai para 'dark' sem lançar. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx) return ctx
  return { theme: 'dark', setTheme: () => undefined, toggle: () => undefined }
}

export const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light'

/** Tema aplicado no <html> (o script inline do index.html já rodou antes do React). */
export function readDocumentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  const t = document.documentElement.dataset['theme']
  return isTheme(t) ? t : 'dark'
}

export function readStoredTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(t) ? t : null
  } catch {
    return null
  }
}

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
