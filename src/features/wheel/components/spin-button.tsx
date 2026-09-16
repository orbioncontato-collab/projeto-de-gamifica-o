import { Sparkles } from 'lucide-react'
import type { WheelState } from '@/lib/gamification'
import { spinButtonLabel } from '@/lib/gamification'
import { Button } from '@/components/ui/button'
import { canSpin } from '../wheel-logic'

interface SpinButtonProps {
  state: WheelState
  spinning: boolean
  loading: boolean
  isAdmin: boolean
  disabledReason?: string | null
  onSpin: () => void
  onViewPrize: () => void
}

export function SpinButton({
  state,
  spinning,
  loading,
  isAdmin,
  disabledReason,
  onSpin,
  onViewPrize,
}: SpinButtonProps) {
  if (state.mode === 'pending') {
    return (
      <Button type="button" variant="gold" size="lg" className="w-full max-w-sm" onClick={onViewPrize}>
        <Sparkles aria-hidden="true" />
        {spinButtonLabel(state, false)}
      </Button>
    )
  }
  const allowed = canSpin(state, isAdmin) && !disabledReason
  if (!allowed) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-1">
        <Button type="button" variant="secondary" size="lg" className="w-full" disabled>
          {disabledReason ?? 'Aguardando liberação'}
        </Button>
        {!disabledReason ? (
          <p className="text-center text-xs text-muted">Somente o gestor ou a pessoa da vez pode girar.</p>
        ) : null}
      </div>
    )
  }
  return (
    <Button
      type="button"
      size="lg"
      className="w-full max-w-sm"
      loading={loading}
      disabled={spinning}
      onClick={onSpin}
      aria-live="polite"
    >
      {!loading ? <Sparkles aria-hidden="true" /> : null}
      {spinButtonLabel(state, spinning || loading)}
    </Button>
  )
}
