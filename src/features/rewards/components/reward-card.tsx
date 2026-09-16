import { Gift, Lock, PackageX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL, formatCoins, formatNumber } from '@/lib/format'
import type { RewardRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/shared/badge'
import { affordability, stockLabel } from '../rewards-utils'

export interface RewardCardProps {
  reward: RewardRow
  balance: number
  onRedeem: (reward: RewardRow) => void
  busy?: boolean
}

/** Card da loja: ícone, custo, nome, categoria, estoque e "Resgatar" | "Faltam N moedas" | "Esgotado". */
export function RewardCard({ reward, balance, onRedeem, busy = false }: RewardCardProps) {
  const state = affordability(reward, balance)
  const canRedeem = state.kind === 'ok'
  return (
    <article
      className={cn(
        'premium-card flex h-full flex-col p-4 transition duration-300',
        canRedeem && 'hover:-translate-y-1 motion-reduce:hover:translate-y-0',
        !canRedeem && 'opacity-90',
      )}
      aria-labelledby={`reward-${reward.id}-name`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/18 text-2xl leading-none"
          aria-hidden="true"
        >
          {reward.icon ?? <Gift className="h-5 w-5 text-gold" />}
        </span>
        <div className="flex flex-col items-end gap-1">
          <Badge tone="gold">
            <span className="nums">{formatNumber(reward.cost_coins)}</span>&nbsp;moedas
          </Badge>
          {reward.category ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-2">
              {reward.category}
            </span>
          ) : null}
        </div>
      </div>
      <h3 id={`reward-${reward.id}-name`} className="mt-3 text-base font-black tracking-tight text-text">
        {reward.name}
      </h3>
      <p className="mt-1 text-xs text-muted">
        {reward.value_amount !== null ? `Vale ${formatBRL(reward.value_amount)}` : 'Benefício'}
        {reward.stock !== null ? ` · ${stockLabel(reward.stock)}` : ''}
      </p>
      <div className="mt-4 flex-1" />
      {state.kind === 'ok' ? (
        <Button type="button" onClick={() => onRedeem(reward)} loading={busy} className="w-full">
          Resgatar
        </Button>
      ) : state.kind === 'out_of_stock' ? (
        <Button type="button" variant="secondary" disabled className="w-full">
          <PackageX aria-hidden="true" /> Esgotado
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled
          className="w-full"
          title={state.kind === 'debt' ? 'Saldo devedor' : undefined}
        >
          <Lock aria-hidden="true" /> Faltam {formatCoins(state.missing)}
        </Button>
      )}
    </article>
  )
}
