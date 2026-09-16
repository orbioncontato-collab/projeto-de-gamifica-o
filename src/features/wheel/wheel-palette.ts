import type { WheelKind } from '@/lib/database.types'

/**
 * Paleta de fallback dos setores (FRONTEND-ARCH §5.1 e Apêndice A). Única exceção à regra "sem hex" fora de
 * tokens: as cores de setor são dado (`wheel_prizes.color`) e este arquivo é o fallback quando o dado é nulo.
 */
export const WHEEL_PALETTE: Record<WheelKind, readonly string[]> = {
  premium: ['#FFC83D', '#855CFF', '#14293B', '#00E887', '#FFC83D', '#4776FF', '#192A39', '#FF5252'],
  classic: ['#4776FF', '#14293B', '#00E887', '#203650', '#855CFF', '#162A3D'],
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

/** Cor do setor `index`: `color` do prêmio se válida, senão a paleta da roleta em ciclo. */
export function sectorColor(kind: WheelKind, index: number, color: string | null | undefined): string {
  if (color && HEX_RE.test(color)) return color
  const palette = WHEEL_PALETTE[kind]
  return palette[index % palette.length] ?? palette[0] ?? '#14293B'
}

/** `conic-gradient(...)` com um setor por prêmio, a partir do topo, no sentido horário. */
export function conicGradient(kind: WheelKind, colors: readonly (string | null | undefined)[]): string {
  const count = colors.length
  if (count === 0) return 'conic-gradient(var(--wheel-dark-1) 0deg 360deg)'
  const seg = 360 / count
  const stops = colors.map((c, i) => `${sectorColor(kind, i, c)} ${i * seg}deg ${(i + 1) * seg}deg`)
  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

/** Sugestão de cor para um prêmio novo no editor (próxima da paleta). */
export function suggestColor(kind: WheelKind, index: number): string {
  const palette = WHEEL_PALETTE[kind]
  return palette[index % palette.length] ?? '#14293B'
}
