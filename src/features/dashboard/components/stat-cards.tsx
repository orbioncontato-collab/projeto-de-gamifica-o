import { Coins, Flame, Trophy, Zap } from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import { formatNumber, formatOrdinal, formatPoints } from '@/lib/format'
import type { VProfileStats } from '@/lib/database.types'

export interface StatCardsProps {
  stats: Pick<VProfileStats, 'points' | 'rank' | 'gap_to_above' | 'streak_days' | 'coins_balance'>
}

/** 4 StatCards: Pontuação, Ranking ("—" sem posição), Sequência 🔥, Moedas (FEATURE §2, §9). */
export function StatCards({ stats }: StatCardsProps) {
  const days = stats.streak_days
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        label="Pontuação"
        value={formatPoints(stats.points)}
        icon={Zap}
        tone="green"
        hint="na temporada"
      />
      <StatCard
        label="Ranking"
        value={formatOrdinal(stats.rank)}
        icon={Trophy}
        tone="gold"
        hint={
          stats.rank === null
            ? 'sem posição ainda'
            : stats.gap_to_above === null
              ? 'você lidera'
              : `${formatPoints(stats.gap_to_above)} para subir`
        }
        to="/ranking"
      />
      <StatCard
        label="Sequência"
        value={`🔥 ${formatNumber(days)} ${days === 1 ? 'dia' : 'dias'}`}
        icon={Flame}
        tone="red"
        hint="dias seguidos com lançamentos"
      />
      <StatCard
        label="Moedas"
        value={`🪙 ${formatNumber(stats.coins_balance)}`}
        icon={Coins}
        tone="blue"
        hint="saldo disponível"
        to="/recompensas"
      />
    </div>
  )
}
