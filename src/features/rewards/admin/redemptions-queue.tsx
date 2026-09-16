import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { formatCoins, formatDateTime } from '@/lib/format'
import { REDEMPTION_STATUS_LABELS } from '@/lib/labels'
import type { RedemptionStatus, VRedemption } from '@/lib/database.types'
import { useMe } from '@/features/auth/bootstrap-query'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'
import { StatusPill } from '@/components/shared/status-pill'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { ListSkeleton } from '@/components/shared/skeletons'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'
import type { RedemptionAction } from '../api'
import { useRedemptionsAdmin } from '../hooks'
import {
  allowedActions,
  REDEMPTION_ACTION_LABELS,
  REDEMPTION_STATUS_MAP,
  REDEMPTION_STATUSES,
} from '../rewards-utils'
import { HandleRedemptionDialog } from './handle-redemption-dialog'

export interface RedemptionsQueueProps {
  status: RedemptionStatus | null
  onStatusChange: (status: RedemptionStatus | null) => void
}

const AVATAR_FALLBACK_COLOR = 'var(--avatar-fallback)'

/** Fila de pedidos (admin): filtro por status + ações aprovar/entregar/cancelar com notas. */
export function RedemptionsQueue({ status, onStatusChange }: RedemptionsQueueProps) {
  const { settings } = useMe()
  const query = useRedemptionsAdmin(status)
  const [target, setTarget] = useState<{ row: VRedemption; action: RedemptionAction } | null>(null)

  return (
    <section aria-label="Pedidos de resgate">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
        <FilterChip active={status === null} onClick={() => onStatusChange(null)} label="Todos" />
        {REDEMPTION_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={status === s}
            onClick={() => onStatusChange(s)}
            label={REDEMPTION_STATUS_LABELS[s]}
          />
        ))}
      </div>
      <QueryBoundary
        query={query}
        skeleton={<ListSkeleton rows={4} />}
        empty={{
          when: (rows) => rows.length === 0,
          render: (
            <EmptyState
              icon={Inbox}
              title={
                status === 'requested' || status === null
                  ? 'Nenhum pedido pendente'
                  : `Nenhum pedido ${REDEMPTION_STATUS_LABELS[status].toLowerCase()}`
              }
              description="Quando alguém resgatar uma recompensa na loja, o pedido aparece aqui para aprovação e entrega."
            />
          ),
        }}
      >
        {(rows) => (
          <ul className="space-y-3" aria-label="Lista de pedidos">
            {rows.map((r) => (
              <li
                key={r.redemption_id}
                className="premium-card flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={r.person_name}
                    color={AVATAR_FALLBACK_COLOR}
                    avatarPath={r.avatar_path}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-text">
                      <span aria-hidden="true">{r.reward_icon ?? '🎁'} </span>
                      {r.title}
                    </div>
                    <div className="text-[11px] text-muted">
                      {r.person_name} · {formatDateTime(r.requested_at, settings.timezone)}
                      {r.cost_coins > 0 ? ` · ${formatCoins(r.cost_coins)}` : ' · prêmio da roleta'}
                    </div>
                    {r.notes ? <p className="mt-1 text-xs text-text-2">{r.notes}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <StatusPill status={r.status} map={REDEMPTION_STATUS_MAP} />
                  {allowedActions(r.status).map((action) => (
                    <Button
                      key={action}
                      type="button"
                      size="sm"
                      variant={action === 'cancel' ? 'danger' : action === 'deliver' ? 'primary' : 'blue'}
                      onClick={() => setTarget({ row: r, action })}
                    >
                      {REDEMPTION_ACTION_LABELS[action]}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
      <HandleRedemptionDialog target={target} onClose={() => setTarget(null)} />
    </section>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-[44px] rounded-full border px-4 text-xs font-black uppercase tracking-wide transition',
        active
          ? 'border-accent/30 bg-accent/12 text-accent'
          : 'border-line bg-surface text-muted hover:text-text',
      )}
    >
      {label}
    </button>
  )
}
