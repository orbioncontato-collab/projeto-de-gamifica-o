import { Link } from '@tanstack/react-router'
import { ChevronRight, Trophy } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { cn } from '@/lib/utils'
import { formatOrdinal, formatPoints } from '@/lib/format'
import { medalFor } from '@/lib/gamification'
import type { VRanking } from '@/lib/database.types'

export interface RankingPreviewProps {
  rows: VRanking[]
  meId: string
}

/** Top 5 com destaque "Você" (FEATURE §2 `RankingPreview`); §9: "Você é o único no ranking por enquanto". */
export function RankingPreview({ rows, meId }: RankingPreviewProps) {
  const isEmpty = rows.length === 0
  const onlyMe = rows.length === 1 && rows[0]?.profile_id === meId
  return (
    <PremiumCard as="section" aria-labelledby="ranking-preview-title">
      <SectionHeader
        eyebrow="Competição"
        title="Ranking"
        action={
          <Link
            to="/ranking"
            className="inline-flex min-h-11 items-center gap-1 text-xs font-black text-accent hover:underline"
          >
            Ver tudo
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />
      <span id="ranking-preview-title" className="sr-only">
        Ranking — top 5
      </span>
      {isEmpty || onlyMe ? (
        <EmptyState
          compact
          className="mt-4"
          icon={Trophy}
          title={onlyMe ? 'Você é o único no ranking por enquanto' : 'Ninguém no ranking por enquanto'}
          description="Quando o time entrar, as posições aparecem aqui."
          adminHint="Convide o time com o código da equipe em Configurações › Código."
        />
      ) : (
        <ol className="mt-4 flex flex-col gap-2" aria-label="Top 5 do ranking">
          {rows.slice(0, 5).map((row) => {
            const isMe = row.profile_id === meId
            return (
              <li
                key={row.profile_id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-3 py-2',
                  isMe ? 'border-accent/30 bg-accent/10' : 'border-transparent',
                )}
              >
                <span
                  className="nums w-8 shrink-0 text-center text-sm font-black text-muted"
                  aria-label={formatOrdinal(row.rank)}
                >
                  {medalFor(row.rank) ?? formatOrdinal(row.rank)}
                </span>
                <Avatar name={row.full_name} color={row.color} avatarPath={row.avatar_path} size="sm" />
                <span className="break-safe min-w-0 flex-1 truncate text-sm font-bold text-text">
                  {row.full_name}
                </span>
                {isMe ? <Badge tone="green">Você</Badge> : null}
                <span className="nums shrink-0 text-sm font-black text-text">{formatPoints(row.points)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </PremiumCard>
  )
}
