import { History } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { PRIZE_KIND_LABELS, WHEEL_KIND_LABELS } from '@/lib/labels'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { SectionHeader } from '@/components/shared/section-header'
import { ListSkeleton } from '@/components/shared/skeletons'
import { useWheelHistory } from '../hooks'

const HISTORY_ROWS = 10

/** "Últimas aprovações": nome, prêmio, tipo, roleta e hora. */
export function WheelHistory({ timezone }: { timezone: string }) {
  const query = useWheelHistory(HISTORY_ROWS)
  return (
    <PremiumCard as="section" aria-labelledby="wheel-history-title">
      <SectionHeader eyebrow="Histórico" title="Últimas aprovações" />
      <div id="wheel-history-title" className="sr-only">
        Últimas aprovações
      </div>
      <QueryBoundary
        query={query}
        compact
        skeleton={<ListSkeleton rows={4} />}
        empty={{
          when: (rows) => rows.length === 0,
          render: (
            <EmptyState
              compact
              icon={History}
              title="Nenhuma aprovação ainda"
              description="Os prêmios aprovados pelo gestor aparecem aqui."
              adminHint="Libere um giro pela fila e aprove o prêmio para registrar a primeira entrega."
            />
          ),
        }}
      >
        {(rows) => (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.spin_id} className="flex items-center gap-3 py-3">
                <Avatar
                  name={row.person_name}
                  color={row.color ?? ''}
                  avatarPath={row.avatar_path}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text">
                    {row.person_name} <span className="font-normal text-muted">ganhou</span>{' '}
                    {row.resolved_label}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {WHEEL_KIND_LABELS[row.wheel_kind]} • {formatDateTime(row.approved_at, timezone)}
                    {row.approved_by_name ? ` • por ${row.approved_by_name}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={row.wheel_kind === 'premium' ? 'gold' : 'blue'}>
                    {PRIZE_KIND_LABELS[row.resolved_kind]}
                  </Badge>
                  {!row.credited ? <Badge tone="dark">Sem crédito</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </PremiumCard>
  )
}
