import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  isTheme,
  readDocumentTheme,
  readStoredTheme,
  systemTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  type Theme,
} from './use-theme'

/** `<meta theme-color>` segue o `--bg` do tema aplicado (tokens.css é a única fonte de cores). */
const themeColorFor = (): string => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()

/** Único lugar do app que escreve em `html[data-theme]` e `localStorage['orbion-theme']` (FRONTEND-ARCH §5.5). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  const bg = themeColorFor()
  if (meta && bg) meta.setAttribute('content', bg)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readDocumentTheme())

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    applyTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* armazenamento indisponível: o tema vale só nesta aba */
    }
  }, [])

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [setTheme, theme])

  // Mantém o DOM coerente com o estado (ex.: hidratação após o script inline).
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Sincroniza abas: outra aba mudou o tema.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return
      if (isTheme(e.newValue)) {
        setThemeState(e.newValue)
      } else if (e.newValue === null) {
        setThemeState(systemTheme())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Sem preferência salva, segue o sistema quando ele muda.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      if (readStoredTheme() === null) setThemeState(mq.matches ? 'light' : 'dark')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
