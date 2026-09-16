import { useMe } from '@/features/auth/bootstrap-query'
import { useProfileStat } from '@/features/profiles/hooks'
import { formatCoins, formatPoints } from '@/lib/format'

/** Saldo atual do colaborador selecionado (pontos da temporada + moedas), sob o picker. */
export function BalanceHint({ profileId }: { profileId: string | null }) {
  const { seasonId } = useMe()
  const stat = useProfileStat(profileId ?? '', seasonId)
  if (!profileId || !seasonId) return null
  if (stat.isPending) return <p className="mt-1.5 text-xs text-muted-2">Carregando saldo…</p>
  if (stat.isError || !stat.data) return <p className="mt-1.5 text-xs text-muted-2">Saldo indisponível.</p>
  return (
    <p className="mt-1.5 text-xs text-muted" aria-live="polite">
      Saldo atual: <span className="font-bold text-text-2">{formatPoints(stat.data.points)}</span>
      <span className="mx-1.5 text-muted-2">·</span>
      <span className="text-gold">{formatCoins(stat.data.coins_balance)}</span>
    </p>
  )
}
