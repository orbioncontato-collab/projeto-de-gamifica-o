import { Clock, Hourglass, Sparkles } from 'lucide-react'
import type { WheelState } from '@/lib/gamification'
import { formatRelative } from '@/lib/format'
import { WHEEL_KIND_LABELS } from '@/lib/labels'
import { Avatar } from '@/components/shared/avatar'

interface WheelContextBannerProps {
  state: WheelState
  isAdmin: boolean
  timezone: string
}

/** Contexto sob a roda: quem é a vez (avatar, roleta, tentativas), giro pendente ou modo livre. */
export function WheelContextBanner({ state, isAdmin, timezone }: WheelContextBannerProps) {
  const { active } = state
  if (state.mode === 'free' || !active) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        <Sparkles className="shrink-0 text-accent" size={18} aria-hidden="true" />
        <p>
          Giro livre: qualquer pessoa pode girar para testar, sem crédito.
          {isAdmin
            ? ' Para valer, adicione alguém à fila e libere o giro.'
            : ' Quando o gestor liberar sua vez, o giro vale.'}
        </p>
      </div>
    )
  }
  const pending = state.mode === 'pending'
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <Avatar
        name={active.person_name}
        color={active.color ?? ''}
        avatarPath={active.avatar_path}
        size="md"
        ring
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-text">{active.person_name}</p>
        <p className="truncate text-xs text-muted">
          {WHEEL_KIND_LABELS[active.wheel_kind]} • {active.attempts_used}/{active.attempts_allowed} giros
          usados
          {active.released_at
            ? ` • liberado ${formatRelative(active.released_at, Date.now(), timezone)}`
            : ''}
        </p>
      </div>
      {pending ? (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-soft">
          <Hourglass size={14} aria-hidden="true" /> Pendente
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-gold">
          <Clock size={14} aria-hidden="true" /> {state.myTurn ? 'Sua vez' : 'Vez ativa'}
        </span>
      )}
    </div>
  )
}
