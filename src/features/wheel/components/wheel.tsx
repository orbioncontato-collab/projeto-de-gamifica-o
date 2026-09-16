import type { CSSProperties } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import type { WheelKind, WheelPrizeRow } from '@/lib/database.types'
import { WHEEL_KIND_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { conicGradient } from '../wheel-palette'
import { sectorAngle, SPIN_DURATION_MS, SPIN_EASING } from '../spin-engine'
import { WheelSectorLabels } from './wheel-sector-labels'

/** O editor pré-visualiza rascunhos sem id do banco: só o necessário para desenhar. */
export type WheelPrizeLike = Pick<WheelPrizeRow, 'id' | 'label' | 'color'>

export interface WheelProps {
  kind: WheelKind
  prizes: readonly WheelPrizeLike[]
  rotation: number
  spinning: boolean
  winnerIndex: number | null
  className?: string
}

/** Roda: ponteiro fixo no topo, `conic-gradient` gerado dos prêmios, rótulos por setor, centro com ícone. */
export function Wheel({ kind, prizes, rotation, spinning, winnerIndex, className }: WheelProps) {
  const count = prizes.length
  const style: CSSProperties & Record<string, string> = {
    '--wheel-gradient': conicGradient(
      kind,
      prizes.map((p) => p.color),
    ),
    '--wheel-sector-angle': `${sectorAngle(count) || 360}deg`,
    transform: `rotate(${rotation}deg)`,
    transitionDuration: spinning ? `${SPIN_DURATION_MS}ms` : '0ms',
    transitionTimingFunction: SPIN_EASING,
  }
  const Icon = kind === 'premium' ? Crown : Sparkles
  const winner = winnerIndex !== null ? prizes[winnerIndex] : undefined

  return (
    <div className={cn('wheel-stage', className)}>
      <div
        className={cn('wheel', spinning && 'is-spinning')}
        style={style}
        role="img"
        aria-label={
          spinning
            ? `${WHEEL_KIND_LABELS[kind]} girando`
            : winner
              ? `${WHEEL_KIND_LABELS[kind]} parada em ${winner.label}`
              : `${WHEEL_KIND_LABELS[kind]} com ${count} prêmios`
        }
      >
        <div className="wheel-ticks" aria-hidden="true" />
        <WheelSectorLabels prizes={prizes} winnerIndex={winnerIndex} />
      </div>
      <div className="wheel-center" data-kind={kind} aria-hidden="true">
        <Icon size={28} strokeWidth={2.4} />
        <span className="wheel-center-caption">GIRE</span>
      </div>
      <div className="wheel-pointer" aria-hidden="true" />
    </div>
  )
}
