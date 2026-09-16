import type { LinkProps } from '@tanstack/react-router'

/** Caminhos de rota válidos (união gerada pelo router; `RoutePaths` não é exportado pelo pacote). */
export type LinkTo = NonNullable<LinkProps['to']>

/** Tons semânticos + apelidos (success/warning/danger/info/muted) aceitos por Badge, StatCard, IconTile, StatusPill. */
export type BaseTone = 'green' | 'gold' | 'red' | 'blue' | 'purple' | 'cyan' | 'dark'
export type Tone = BaseTone | 'success' | 'warning' | 'danger' | 'info' | 'muted'

export function normalizeTone(tone: Tone): BaseTone {
  switch (tone) {
    case 'success':
      return 'green'
    case 'warning':
      return 'gold'
    case 'danger':
      return 'red'
    case 'info':
      return 'blue'
    case 'muted':
      return 'dark'
    default:
      return tone
  }
}

/** Classes por tom — strings completas para o scanner do Tailwind. */
export const TONE_TEXT: Record<BaseTone, string> = {
  green: 'text-accent',
  gold: 'text-gold',
  red: 'text-red-soft',
  blue: 'text-blue-soft',
  purple: 'text-purple-soft',
  cyan: 'text-cyan',
  dark: 'text-muted',
}
export const TONE_PILL: Record<BaseTone, string> = {
  green: 'border-accent/20 bg-accent/10 text-accent',
  gold: 'border-gold/20 bg-gold/10 text-gold',
  red: 'border-red/20 bg-red/10 text-red-soft',
  blue: 'border-blue/20 bg-blue/10 text-blue-soft',
  purple: 'border-purple/20 bg-purple/10 text-purple-soft',
  cyan: 'border-cyan/20 bg-cyan/10 text-cyan',
  dark: 'border-line-strong bg-surface text-muted',
}
export const TONE_TILE: Record<BaseTone, string> = {
  green: 'bg-accent/18 text-accent',
  gold: 'bg-gold/18 text-gold',
  red: 'bg-red/18 text-red-soft',
  blue: 'bg-blue/18 text-blue-soft',
  purple: 'bg-purple/18 text-purple-soft',
  cyan: 'bg-cyan/18 text-cyan',
  dark: 'bg-surface-hover text-muted',
}
