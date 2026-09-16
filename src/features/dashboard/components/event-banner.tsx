import { useState } from 'react'
import { Flame, Sparkles } from 'lucide-react'
import { Countdown } from '@/components/shared/countdown'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import { eventState } from '@/lib/gamification'
import { formatNumber, formatTimeRange } from '@/lib/format'
import type { ActiveEvent } from '@/lib/database.types'

export interface EventBannerProps {
  event: ActiveEvent | null
  tz: string
}

const multiplierLabel = (m: number): string =>
  m === 2 ? 'TODOS OS PONTOS EM DOBRO' : `PONTOS ×${formatNumber(m, m % 1 === 0 ? 0 : 1)}`

/**
 * Evento especial com contador (FEATURE §2): "começa em HH:MM:SS" → "termina em" → some quando zera.
 * Sem evento: "Nenhum evento especial agendado" (§9).
 */
export function EventBanner({ event, tz }: EventBannerProps) {
  const [tick, setTick] = useState(0)
  const state = eventState(event, Date.now())
  if (state.kind === 'none') {
    return (
      <PremiumCard as="section" padding="sm" aria-label="Evento especial">
        <div className="flex items-center gap-3">
          <IconTile icon={Sparkles} tone="muted" size="sm" />
          <div className="min-w-0">
            <div className="eyebrow" data-tone="muted">
              Evento especial
            </div>
            <p className="mt-0.5 text-sm font-semibold text-muted">Nenhum evento especial agendado</p>
          </div>
        </div>
      </PremiumCard>
    )
  }
  if (!event) return null
  const target = state.kind === 'upcoming' ? event.starts_at : event.ends_at
  return (
    <PremiumCard as="section" tone="red" glow aria-labelledby="event-banner-title" data-tick={tick}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={Flame} tone="red" size="md" />
          <div className="min-w-0">
            <div className="eyebrow" data-tone="muted">
              {state.kind === 'live' ? 'Acontecendo agora' : 'Evento especial'}
            </div>
            <h3
              id="event-banner-title"
              className="break-safe mt-0.5 text-lg font-black uppercase tracking-tight text-text"
            >
              {event.name}
            </h3>
            <p className="nums mt-1 text-xs font-bold text-red-soft">
              {formatTimeRange(event.starts_at, event.ends_at, tz)} — {multiplierLabel(event.multiplier)}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
            {state.kind === 'live' ? 'termina em' : 'começa em'}
          </div>
          <Countdown
            to={target}
            className="nums font-mono text-2xl font-black text-text"
            onZero={() => setTick((t) => t + 1)}
          />
        </div>
      </div>
    </PremiumCard>
  )
}
