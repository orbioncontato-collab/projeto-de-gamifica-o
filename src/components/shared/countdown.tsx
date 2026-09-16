import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCountdown, formatDaysLeft } from '@/lib/format'

export interface CountdownProps {
  /** ISO ou epoch ms do alvo */
  to: string | number
  mode?: 'hms' | 'days'
  onZero?: () => void
  className?: string
}

const secondsUntil = (to: string | number, now: number): number => {
  const target = typeof to === 'number' ? to : new Date(to).getTime()
  if (Number.isNaN(target)) return 0
  return Math.max(0, Math.floor((target - now) / 1000))
}

/** Contador com tick de 1 s (`setInterval`), para em 0 e chama `onZero` uma vez. */
export function Countdown({ to, mode = 'hms', onZero, className }: CountdownProps) {
  const [seconds, setSeconds] = useState(() => secondsUntil(to, Date.now()))
  const firedRef = useRef(false)
  const onZeroRef = useRef(onZero)
  onZeroRef.current = onZero

  useEffect(() => {
    firedRef.current = false
    const tick = () => {
      const s = secondsUntil(to, Date.now())
      setSeconds(s)
      if (s === 0 && !firedRef.current) {
        firedRef.current = true
        onZeroRef.current?.()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [to])

  const text = mode === 'days' ? formatDaysLeft(Math.ceil(seconds / 86400)) : formatCountdown(seconds)
  return (
    <span className={cn('font-mono tabular-nums', className)} aria-live="off">
      {text}
    </span>
  )
}
