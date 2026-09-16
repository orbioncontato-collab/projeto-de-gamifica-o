import { ChevronRight } from 'lucide-react'
import type { VProfileStats } from '@/lib/database.types'
import { JOB_TITLE_LABELS } from '@/lib/labels'
import { formatBRL, formatOrdinal, formatPoints } from '@/lib/format'
import { Avatar } from '@/components/shared/avatar'
import { StatusPill } from '@/components/shared/status-pill'
import { PROFILE_STATUS_PILL } from '../team-utils'

/** Card de colaborador abaixo de `md` (FEATURE §11 "Cards em mobile") — `mobileCard` do `DataTable`. */
export function TeamMemberCard({ row }: { row: VProfileStats }) {
  return (
    <article className="premium-card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={row.full_name} color={row.color} avatarPath={row.avatar_path} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-text">{row.full_name}</p>
          <p className="truncate text-xs text-muted">
            {JOB_TITLE_LABELS[row.job_title]}
            {row.team ? ` · ${row.team}` : ''}
          </p>
        </div>
        <StatusPill status={row.status} map={PROFILE_STATUS_PILL} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-3" aria-hidden="true" />
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">Pontos</dt>
          <dd className="nums text-sm font-black text-text">{formatPoints(row.points)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">Nível</dt>
          <dd className="nums text-sm font-black text-text">{row.level}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">Posição</dt>
          <dd className="nums text-sm font-black text-text">{formatOrdinal(row.rank)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">Vendas</dt>
          <dd className="nums text-sm font-black text-text">
            {formatBRL(row.sales_amount, { compact: true })}
          </dd>
        </div>
      </dl>
    </article>
  )
}
