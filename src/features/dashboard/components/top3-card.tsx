import { Medal } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { formatPoints } from '@/lib/format'
import { medalFor } from '@/lib/gamification'
import type { VRanking } from '@/lib/database.types'

/** "Top 3 do mês" (FEATURE §2b); pódio só quando o 1º tem pontos (DATA-MODEL §5.2) — senão "Aguardando os primeiros pontos". */
export function Top3Card({ rows }: { rows: VRanking[] }) {
  const top = rows.filter((r) => r.has_points).slice(0, 3)
  return (
    <PremiumCard as="section" tone="gold" aria-labelledby="top3-title">
      <SectionHeader eyebrow="Destaques" title="Top 3 do mês" />
      <span id="top3-title" className="sr-only">
        Top 3 do mês
      </span>
      {top.length === 0 ? (
        <EmptyState
          compact
          className="mt-4"
          icon={Medal}
          title="Aguardando os primeiros pontos"
          description="O pódio aparece assim que alguém pontuar."
          adminHint="Lance a primeira venda em Pontuação › Lançar."
        />
      ) : (
        <ol className="mt-4 flex flex-col gap-3" aria-label="Top 3">
          {top.map((row) => (
            <li key={row.profile_id} className="flex items-center gap-3">
              <span className="w-7 shrink-0 text-center text-xl" aria-label={`${row.rank}º lugar`}>
                {medalFor(row.rank) ?? row.rank}
              </span>
              <Avatar
                name={row.full_name}
                color={row.color}
                avatarPath={row.avatar_path}
                size="sm"
                ring={row.rank === 1}
              />
              <span className="break-safe min-w-0 flex-1 truncate text-sm font-bold text-text">
                {row.full_name}
              </span>
              <span className="nums shrink-0 text-sm font-black text-gold">{formatPoints(row.points)}</span>
            </li>
          ))}
        </ol>
      )}
    </PremiumCard>
  )
}
