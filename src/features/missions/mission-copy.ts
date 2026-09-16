import { formatBRL, formatCoins, formatNumber, formatPoints } from '@/lib/format'
import { WHEEL_KIND_LABELS } from '@/lib/labels'
import type { VMissionBoard } from '@/lib/database.types'

/** Textos puros dos cards de missão (testáveis). */

export type MissionRewardParts = Pick<VMissionBoard, 'reward_points' | 'reward_coins' | 'reward_spin'>

/** "+50 pts · 50 moedas · 1 giro na Roleta Premium" — só as partes > 0 / presentes. */
export function missionRewardLabel(m: MissionRewardParts): string {
  const parts: string[] = []
  if (m.reward_points > 0) parts.push(`+${formatPoints(m.reward_points)}`)
  if (m.reward_coins > 0) parts.push(formatCoins(m.reward_coins))
  if (m.reward_spin) parts.push(`1 giro na ${WHEEL_KIND_LABELS[m.reward_spin]}`)
  return parts.join(' · ')
}

/** "3/5" (contagem) ou "R$ 8.500 / R$ 20.000" (valor). */
export function missionProgressLabel(
  m: Pick<VMissionBoard, 'target_kind' | 'target_value' | 'progress_value'>,
): string {
  if (m.target_kind === 'amount') return `${formatBRL(m.progress_value)} / ${formatBRL(m.target_value)}`
  return `${formatNumber(m.progress_value)}/${formatNumber(m.target_value)}`
}

/** Alvo do contador: `seconds_remaining` da view (relógio do banco), ancorado no instante da leitura. */
export function countdownTarget(secondsRemaining: number | null, readAt: number): number | null {
  if (secondsRemaining === null || !Number.isFinite(secondsRemaining)) return null
  return readAt + Math.max(secondsRemaining, 0) * 1000
}
