import { useCallback, useEffect, useRef, useState } from 'react'
import type { PrizeKind, SpinResultPayload, VWheelQueue, WheelKind, WheelSpinRow } from '@/lib/database.types'
import { SPIN_DURATION_MS, targetRotation } from './spin-engine'

/** Resultado normalizado para o `SpinResultDialog` (vem da RPC, do INSERT realtime ou da fila pendente). */
export interface SpinResultView {
  spinId: string | null
  isFree: boolean
  wheelKind: WheelKind
  personName: string | null
  prizeLabel: string
  prizeKind: PrizeKind
  prizeValue: number | null
  resolvedLabel: string
  resolvedKind: PrizeKind
  resolvedValue: number | null
  attemptIndex: number | null
  attemptsAllowed: number | null
}

export function viewFromPayload(p: SpinResultPayload): SpinResultView {
  return {
    spinId: p.spin_id,
    isFree: p.is_free === true || p.spin_id === null,
    wheelKind: p.wheel_kind,
    personName: p.person_name,
    prizeLabel: p.prize.label,
    prizeKind: p.prize.kind,
    prizeValue: p.prize.value,
    resolvedLabel: p.resolved_prize.label,
    resolvedKind: p.resolved_prize.kind,
    resolvedValue: p.resolved_prize.value,
    attemptIndex: p.attempt_index,
    attemptsAllowed: p.attempts_allowed,
  }
}

export function viewFromSpinRow(
  spin: WheelSpinRow,
  wheelKind: WheelKind,
  attemptsAllowed: number | null,
): SpinResultView {
  return {
    spinId: spin.id,
    isFree: false,
    wheelKind,
    personName: spin.person_name,
    prizeLabel: spin.prize_label,
    prizeKind: spin.prize_kind,
    prizeValue: spin.prize_value,
    resolvedLabel: spin.resolved_label,
    resolvedKind: spin.resolved_kind,
    resolvedValue: spin.resolved_value,
    attemptIndex: spin.attempt_index,
    attemptsAllowed,
  }
}

/** Vez ativa com spin pendente (botão "VER PRÊMIO") — a view só tem rótulos, sem valores. */
export function viewFromPendingQueue(row: VWheelQueue): SpinResultView | null {
  if (!row.pending_spin_id || !row.pending_prize_label || !row.pending_prize_kind) return null
  return {
    spinId: row.pending_spin_id,
    isFree: false,
    wheelKind: row.wheel_kind,
    personName: row.person_name,
    prizeLabel: row.pending_prize_label,
    prizeKind: row.pending_prize_kind,
    prizeValue: null,
    resolvedLabel: row.pending_resolved_label ?? row.pending_prize_label,
    resolvedKind: row.pending_prize_kind === 'mystery' ? 'custom' : row.pending_prize_kind,
    resolvedValue: null,
    attemptIndex: row.attempts_used + 1,
    attemptsAllowed: row.attempts_allowed,
  }
}

export interface SpinController {
  rotation: number
  spinning: boolean
  winnerIndex: number | null
  /** Anima até o setor e chama `onLanded` ao parar (8,2 s). Ignorado se já está girando. */
  spinTo: (sectorIndex: number, sectorCount: number, onLanded: () => void) => boolean
  reset: () => void
}

/** Controla rotação/estado da roda; o `setTimeout` garante o pouso mesmo sem `transitionend` (aba oculta). */
export function useSpinController(): SpinController {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null)
  const rotationRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinningRef = useRef(false)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const spinTo = useCallback((sectorIndex: number, sectorCount: number, onLanded: () => void): boolean => {
    if (spinningRef.current || sectorCount <= 0) return false
    const next = targetRotation(rotationRef.current, sectorIndex, sectorCount)
    rotationRef.current = next
    spinningRef.current = true
    setWinnerIndex(null)
    setSpinning(true)
    setRotation(next)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      spinningRef.current = false
      setSpinning(false)
      setWinnerIndex(sectorIndex)
      onLanded()
    }, SPIN_DURATION_MS)
    return true
  }, [])

  const reset = useCallback(() => setWinnerIndex(null), [])

  return { rotation, spinning, winnerIndex, spinTo, reset }
}
