import { useEffect, useMemo, useState } from 'react'

const PIECES = 24
const LIFETIME_MS = 2800

interface ConfettiProps {
  /** Muda para disparar uma nova chuva (ex.: `spinId` ou um contador). */
  burstKey: string | number | null
}

/** Confete de 24 peças caindo 2,6 s (CSS em `styles/overlays.css`). Sem `burstKey` não renderiza nada. */
export function Confetti({ burstKey }: ConfettiProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (burstKey === null) return undefined
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [burstKey])

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        left: `${((i * 37) % 100).toFixed(0)}%`,
        delay: `${((i * 53) % 900) / 1000}s`,
      })),
    [],
  )

  if (!visible) return null
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: p.left, animationDelay: p.delay }} />
      ))}
    </div>
  )
}
