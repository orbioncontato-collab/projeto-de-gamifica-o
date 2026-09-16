import { Link } from '@tanstack/react-router'
import { Coins } from 'lucide-react'
import { useMe } from '@/features/auth/hooks'
import { formatCoins, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Saldo de moedas (`me.coins_balance`); clique abre a carteira. */
export function CoinsChip({ className }: { className?: string }) {
  const { me } = useMe()
  const balance = Number.isFinite(me.coins_balance) ? me.coins_balance : 0
  return (
    <Link
      to="/recompensas"
      search={{ aba: 'loja' }}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border border-gold/20 bg-gold/10 px-3 text-[12px] font-black tabular-nums text-gold transition hover:bg-gold/15',
        className,
      )}
      aria-label={`${formatCoins(balance)} — abrir carteira`}
      title="Carteira de moedas"
    >
      <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{formatNumber(balance)}</span>
    </Link>
  )
}
