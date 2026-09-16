import type { WheelPrizeRow } from '@/lib/database.types'
import { cn } from '@/lib/utils'
import { labelAngleDeg } from '../spin-engine'

interface WheelSectorLabelsProps {
  prizes: readonly Pick<WheelPrizeRow, 'id' | 'label'>[]
  winnerIndex: number | null
}

/** Um rótulo por setor, girado até o centro do setor (mesma convenção do `conic-gradient`). */
export function WheelSectorLabels({ prizes, winnerIndex }: WheelSectorLabelsProps) {
  const count = prizes.length
  return (
    <div className="wheel-prize-layer" aria-hidden="true">
      {prizes.map((prize, index) => (
        <div
          key={prize.id}
          className={cn('wheel-prize-spoke', winnerIndex === index && 'is-winner')}
          style={{ ['--prize-angle' as string]: `${labelAngleDeg(index, count)}deg` }}
        >
          <span className="wheel-prize-label" title={prize.label}>
            {prize.label}
          </span>
        </div>
      ))}
    </div>
  )
}
