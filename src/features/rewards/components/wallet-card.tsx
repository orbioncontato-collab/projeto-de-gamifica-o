import { Coins, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCoins, formatNumber } from '@/lib/format'
import type { VWallet } from '@/lib/database.types'
import { PremiumCard } from '@/components/shared/premium-card'
import { Badge } from '@/components/shared/badge'
import { CardSkeleton } from '@/components/shared/skeletons'
import { ErrorState } from '@/components/shared/error-state'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useMe } from '@/features/auth/bootstrap-query'
import { useWallet } from '../hooks'
import { isDebt, otherOriginsTotal, OTHER_ORIGINS, PRIMARY_ORIGINS, walletOrEmpty } from '../rewards-utils'

/** Carteira verde do original: saldo, +Venda/+Missão/+Meta fixas e "Outras origens" em tooltip. */
export function WalletCard({ profileId }: { profileId?: string }) {
  const { me } = useMe()
  const id = profileId ?? me.id
  const query = useWallet(id)
  if (query.isPending) return <CardSkeleton lines={4} className="min-h-[220px]" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  return <WalletCardBody wallet={walletOrEmpty(query.data, id)} />
}

export function WalletCardBody({ wallet }: { wallet: VWallet }) {
  const debt = isDebt(wallet.coins_balance)
  const others = otherOriginsTotal(wallet)
  return (
    <PremiumCard as="section" tone="green" glow padding="lg" aria-labelledby="wallet-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow" id="wallet-title">
            Carteira
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <Coins className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
            <span
              className={cn(
                'nums text-4xl font-black tracking-tight sm:text-5xl',
                debt ? 'text-red-soft' : 'text-text',
              )}
              data-testid="wallet-balance"
            >
              {formatNumber(Math.abs(wallet.coins_balance))}
            </span>
            <span className="text-sm font-bold uppercase tracking-wide text-muted">Orb Coins</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            {debt
              ? `Saldo devedor de ${formatCoins(Math.abs(wallet.coins_balance))} — a loja libera quando o saldo cobrir o custo.`
              : wallet.coins_earned === 0
                ? 'Como ganhar moedas: vendas, missões e metas.'
                : `${formatCoins(wallet.coins_earned)} ganhas · ${formatCoins(wallet.coins_spent)} gastas`}
          </p>
        </div>
        {debt ? <Badge tone="red">Saldo devedor</Badge> : <Badge tone="green">Moedas</Badge>}
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3" aria-label="Origem das moedas">
        {PRIMARY_ORIGINS.map((o) => (
          <div key={o.key} className="rounded-2xl border border-line bg-surface/60 px-3 py-3 text-center">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-2">+{o.label}</dt>
            <dd className="nums mt-1 text-lg font-black text-accent">+{formatNumber(wallet[o.key])}</dd>
          </div>
        ))}
      </dl>

      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-muted underline-offset-4 hover:text-text hover:underline"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              Outras origens: +{formatNumber(others)}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <ul className="space-y-1 text-xs">
              {OTHER_ORIGINS.map((o) => (
                <li key={o.key} className="flex justify-between gap-4">
                  <span>{o.label}</span>
                  <span className="nums font-bold">+{formatNumber(wallet[o.key])}</span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </PremiumCard>
  )
}
