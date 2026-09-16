import type { PrizeKind, VWheelQueue } from '@/lib/database.types'
import type { WheelState } from '@/lib/gamification'
import { formatBRL, formatCoins, formatNumber, formatPoints } from '@/lib/format'

/** Funções puras da tela da roleta (testadas em `wheel-logic.test.ts`). */

/** Quem pode girar: admin ou dono da vez; no giro livre, qualquer membro; com spin pendente ninguém. */
export function canSpin(state: WheelState, isAdmin: boolean): boolean {
  if (state.mode === 'pending') return false
  if (state.mode === 'turn') return isAdmin || state.myTurn
  return true
}

/** Enquanto a roda gira, esconde o prêmio pendente (a fila já sabe o resultado antes do pouso). */
export function maskWhileSpinning(state: WheelState, spinning: boolean): WheelState {
  if (!spinning || state.mode !== 'pending') return state
  return { ...state, mode: 'turn', pendingSpinId: null, pendingLabel: null }
}

const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Filtra a fila por nome (sem acento/caixa). */
export function filterQueue(rows: readonly VWheelQueue[], search: string): VWheelQueue[] {
  const q = normalize(search)
  if (!q) return rows.slice()
  return rows.filter((r) => normalize(r.person_name).includes(q))
}

/** Texto do valor conforme o tipo (ex.: "500 pontos", "R$ 50", "2x pontos por 24 h"); null quando não se aplica. */
export function prizeValueText(kind: PrizeKind, value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null
  switch (kind) {
    case 'points':
      return formatPoints(value)
    case 'coins':
      return formatCoins(value)
    case 'cash':
    case 'voucher':
      return formatBRL(value)
    case 'multiplier':
      return `${formatNumber(value, 1)}x pontos por 24 h`
    default:
      return null
  }
}
