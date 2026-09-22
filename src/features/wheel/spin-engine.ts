import type { WheelPrizeRow } from '@/lib/database.types'

/**
 * Motor puro da roleta (FRONTEND-ARCH §4.5, ). Convenção: o ponteiro é fixo no topo (0°),
 * o setor `i` cobre `[i*seg, (i+1)*seg)` graus a partir do topo no sentido horário, e a roda gira no
 * sentido horário (rotação CSS positiva). O `conic-gradient` e os rótulos usam a mesma convenção.
 */

export const SPIN_DURATION_MS = 8200
export const SPIN_EASING = 'cubic-bezier(0.04, 0.82, 0.12, 1)'
export const EXTRA_TURNS = 10
export const FULL_TURN = 360

/** Ângulo (graus) de cada setor para `count` prêmios; 0 quando não há prêmios. */
export const sectorAngle = (count: number): number => (count > 0 ? FULL_TURN / count : 0)

/** Centro (graus a partir do topo, horário) do setor `index` entre `count` setores. */
export const sectorCenterDeg = (index: number, count: number): number => {
  if (count <= 0) return 0
  const seg = sectorAngle(count)
  return index * seg + seg / 2
}

const mod = (n: number, m: number): number => ((n % m) + m) % m

/**
 * Rotação alvo (graus, sempre ≥ `current`) para que o centro do setor `index` fique sob o ponteiro no topo
 * após `EXTRA_TURNS` voltas completas. Fórmula do contrato §4.5.
 */
export const targetRotation = (current: number, index: number, count: number): number => {
  if (count <= 0) return current
  const center = sectorCenterDeg(index, count)
  const delta = mod(mod(FULL_TURN - center, FULL_TURN) - mod(current, FULL_TURN), FULL_TURN)
  return current + FULL_TURN * EXTRA_TURNS + delta
}

/** Setor que está sob o ponteiro (topo) para uma rotação dada — inverso de `targetRotation`. */
export const sectorAtRotation = (rotation: number, count: number): number => {
  if (count <= 0) return -1
  const seg = sectorAngle(count)
  const pointerAngle = mod(FULL_TURN - mod(rotation, FULL_TURN), FULL_TURN)
  return Math.floor(pointerAngle / seg) % count
}

/** Índice do prêmio na lista ordenada (por `sort_order`) ou `null` se não estiver presente. */
export const resolveSectorIndex = (prizes: readonly { id: string }[], prizeId: string): number | null => {
  const idx = prizes.findIndex((p) => p.id === prizeId)
  return idx >= 0 ? idx : null
}

/** Prêmios ativos, não apagados, ordenados por `sort_order` (ordem usada pela roda e pelo banco). */
export const activePrizes = (prizes: readonly WheelPrizeRow[]): WheelPrizeRow[] =>
  prizes
    .filter((p) => p.is_active && p.deleted_at === null)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))

/** Ângulo de rotação (graus) do rótulo do setor `index` — aponta o texto para o centro do setor. */
export const labelAngleDeg = (index: number, count: number): number => sectorCenterDeg(index, count)
