import { Link } from '@tanstack/react-router'
import { ArrowRight, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import type { DashboardPayload } from '@/lib/database.types'
import { nextRewardCopy } from '@/lib/gamification'

/** Próxima recompensa (Apêndice B.6): giros ganhos > recompensa mais barata > missões. Card dourado. */
export function NextReward({ dashboard }: { dashboard: DashboardPayload }) {
  const copy = nextRewardCopy(dashboard)
  return (
    <PremiumCard as="section" tone="gold" aria-labelledby="next-reward-title">
      <div className="flex items-start gap-3">
        <IconTile icon={Gift} tone="gold" size="sm" />
        <div className="min-w-0 flex-1">
          <div className="eyebrow" data-tone="muted">
            Próxima recompensa
          </div>
          <h3
            id="next-reward-title"
            className="break-safe mt-0.5 text-base font-black tracking-tight text-text"
          >
            {copy.title}
          </h3>
          <p className="mt-1 text-sm text-muted">{copy.body}</p>
        </div>
      </div>
      <div className="mt-4">
        {copy.cta.to === '/missoes' ? (
          <Button asChild variant="gold" size="sm">
            <Link to="/missoes" search={{ filtro: 'hoje' }}>
              {copy.cta.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : copy.cta.to === '/recompensas' ? (
          <Button asChild variant="gold" size="sm">
            <Link to="/recompensas" search={{ aba: 'loja' }}>
              {copy.cta.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="gold" size="sm">
            <Link to="/roleta">
              {copy.cta.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </PremiumCard>
  )
}
