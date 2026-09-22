import { useEffect, useState } from 'react'
import { useTheme, type Theme } from '@/features/theme/use-theme'

/**
 * Tema dos gráficos recharts (FRONTEND-ARCH §5): as cores vêm dos tokens de `styles/tokens.css`
 * resolvidos em tempo de execução (nenhum hex aqui). Recalcula quando `useTheme().theme` muda,
 * então os gráficos são recoloridos ao trocar o tema.
 */

/** Tokens consumidos pelos gráficos — um `--nome` por chave. */
export const CHART_TOKENS = {
  accent: '--accent',
  gold: '--gold',
  blue: '--blue',
  blueSoft: '--blue-soft',
  purple: '--purple',
  red: '--red',
  cyan: '--cyan',
  text: '--text-2',
  muted: '--muted-2',
  line: '--line-strong',
  surface: '--bg-elevated',
} as const

export type ChartTokenKey = keyof typeof CHART_TOKENS
export type ChartPalette = Record<ChartTokenKey, string>

/** Lê `--token` do `<html>`; fora do DOM (testes/SSR) devolve `var(--token)` para manter a referência ao tema. */
export function resolveToken(token: string, root?: Element | null): string {
  const el = root ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!el || typeof getComputedStyle !== 'function') return `var(${token})`
  const value = getComputedStyle(el).getPropertyValue(token).trim()
  return value.length > 0 ? value : `var(${token})`
}

export function buildChartPalette(root?: Element | null): ChartPalette {
  const entries = (Object.keys(CHART_TOKENS) as ChartTokenKey[]).map((key) => [
    key,
    resolveToken(CHART_TOKENS[key], root),
  ])
  return Object.fromEntries(entries) as ChartPalette
}

export interface ChartTheme {
  theme: Theme
  palette: ChartPalette
  /** props comuns de eixos/grade */
  axis: { stroke: string; fontSize: number; fontFamily: string }
  grid: { stroke: string; strokeDasharray: string }
  tooltip: { background: string; border: string; color: string }
}

const AXIS_FONT_SIZE = 11
const AXIS_FONT_FAMILY = 'inherit'
const GRID_DASH = '3 3'

export function buildChartTheme(theme: Theme, root?: Element | null): ChartTheme {
  const palette = buildChartPalette(root)
  return {
    theme,
    palette,
    axis: { stroke: palette.muted, fontSize: AXIS_FONT_SIZE, fontFamily: AXIS_FONT_FAMILY },
    grid: { stroke: palette.line, strokeDasharray: GRID_DASH },
    tooltip: { background: palette.surface, border: palette.line, color: palette.text },
  }
}

/** Hook: paleta resolvida do tema atual; muda junto com `data-theme`. */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme()
  const [chartTheme, setChartTheme] = useState<ChartTheme>(() => buildChartTheme(theme))
  // Relê os tokens depois que o provider aplicou `data-theme` no <html> (efeito roda após o commit).
  useEffect(() => {
    setChartTheme(buildChartTheme(theme))
  }, [theme])
  return chartTheme
}

/** Altura padrão dos gráficos (também usada pelo skeleton — mesma altura do conteúdo). */
export const CHART_HEIGHT = 260
