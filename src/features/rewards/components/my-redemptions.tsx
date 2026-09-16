import { ClipboardList } from 'lucide-react'
import { formatCoins, formatDateTime } from '@/lib/format'
import type { VRedemption } from '@/lib/database.types'
import { useMe } from '@/features/auth/bootstrap-query'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { ListSkeleton } from '@/components/shared/skeletons'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusPill } from '@/components/shared/status-pill'
import { useMyRedemptions } from '../hooks'
import { REDEMPTION_STATUS_MAP } from '../rewards-utils'

/** "Meus pedidos": status, notas do gestor e datas. RLS já filtra os próprios. */
export function MyRedemptions() {
  const { settings } = useMe()
  const query = useMyRedemptions()
  return (
    <QueryBoundary
      query={query}
      skeleton={<ListSkeleton rows={4} />}
      empty={{
        when: (rows) => rows.length === 0,
        render: (
          <EmptyState
            icon={ClipboardList}
            title="Você ainda não resgatou nada"
            description="Seus pedidos de resgate e o status de entrega aparecem aqui."
            action={{ label: 'Ver loja', to: '/recompensas' }}
          />
        ),
      }}
    >
      {(rows) => (
        <ul className="space-y-3" aria-label="Meus pedidos">
          {rows.map((r) => (
            <RedemptionItem key={r.redemption_id} row={r} tz={settings.timezone} />
          ))}
        </ul>
      )}
    </QueryBoundary>
  )
}

function RedemptionItem({ row, tz }: { row: VRedemption; tz: string }) {
  return (
    <li className="premium-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/18 text-xl leading-none"
          aria-hidden="true"
        >
          {row.reward_icon ?? '🎁'}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-text">{row.title}</div>
          <div className="text-[11px] text-muted">
            Pedido em {formatDateTime(row.requested_at, tz)}
            {row.cost_coins > 0 ? ` · ${formatCoins(row.cost_coins)}` : ' · prêmio da roleta'}
          </div>
          {row.notes ? (
            <p className="mt-1 text-xs text-text-2">
              <span className="font-semibold text-muted">Nota do gestor:</span> {row.notes}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <StatusPill status={row.status} map={REDEMPTION_STATUS_MAP} />
        {row.handled_at ? (
          <span className="text-[11px] text-muted">
            {formatDateTime(row.handled_at, tz)}
            {row.handled_by_name ? ` · ${row.handled_by_name}` : ''}
          </span>
        ) : null}
      </div>
    </li>
  )
}
