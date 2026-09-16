import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { cn } from '@/lib/utils'
import { formatBRL, formatNumber, formatOrdinal, formatPoints } from '@/lib/format'
import { medalFor } from '@/lib/gamification'
import { JOB_TITLE_LABELS } from '@/lib/labels'
import type { VRanking } from '@/lib/database.types'
import { gapLabel } from '../ranking-utils'

export interface RankingRowProps {
  row: VRanking
  isMe: boolean
}

/** Linha da classificação: posição/medalha, avatar, nome (+ "Você"), cargo · nível, pontos, R$ vendas, gap (FEATURE §3). */
export function RankingRow({ row, isMe }: RankingRowProps) {
  const medal = medalFor(row.rank)
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-3 py-3 transition',
        isMe ? 'border-accent/30 bg-accent/10' : 'border-line bg-surface',
      )}
      aria-current={isMe ? 'true' : undefined}
    >
      <span
        className="nums w-9 shrink-0 text-center text-base font-black text-muted"
        aria-label={formatOrdinal(row.rank)}
      >
        {medal ?? formatOrdinal(row.rank)}
      </span>
      <Avatar name={row.full_name} color={row.color} avatarPath={row.avatar_path} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-safe truncate text-sm font-black text-text">{row.full_name}</span>
          {isMe ? <Badge tone="green">Você</Badge> : null}
        </div>
        <div className="mt-0.5 text-[11px] font-semibold text-muted">
          {JOB_TITLE_LABELS[row.job_title]} · Nível {formatNumber(row.level)}
        </div>
        <div className="nums mt-0.5 text-[11px] font-semibold text-muted-2">{gapLabel(row)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="nums text-sm font-black text-text">{formatPoints(row.points)}</div>
        <div className="nums text-[11px] font-semibold text-muted">
          {formatBRL(row.sales_amount, { compact: true })}
        </div>
      </div>
    </li>
  )
}
