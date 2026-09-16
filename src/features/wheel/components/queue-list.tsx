import { useState } from 'react'
import { ListOrdered } from 'lucide-react'
import type { VWheelQueue, WheelKind } from '@/lib/database.types'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ListSkeleton } from '@/components/shared/skeletons'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { useReleaseTurn, useRemoveFromQueue, useUpdateQueueEntry, useWheelQueue } from '../hooks'
import { filterQueue } from '../wheel-logic'
import { QueueRow } from './queue-row'

interface QueueListProps {
  search?: string
  /** Limita as linhas (painel rápido). */
  limit?: number
}

export function QueueList({ search = '', limit }: QueueListProps) {
  const query = useWheelQueue()
  const release = useReleaseTurn()
  const remove = useRemoveFromQueue()
  const update = useUpdateQueueEntry()
  const [toRemove, setToRemove] = useState<VWheelQueue | null>(null)
  const busy = release.isPending || remove.isPending || update.isPending

  return (
    <>
      <QueryBoundary
        query={query}
        compact
        skeleton={<ListSkeleton rows={limit ?? 3} />}
        empty={{
          when: (rows) => rows.length === 0,
          render: (
            <EmptyState
              compact
              icon={ListOrdered}
              title="Ninguém na fila"
              description="Adicione um colaborador ou convidado para liberar um giro que vale prêmio."
              adminHint="Giros ganhos em missões e desafios entram na fila automaticamente como 'Ganho'."
            />
          ),
        }}
      >
        {(rows) => {
          const spinPending = rows.some((r) => r.pending_spin_id)
          const filtered = filterQueue(rows, search)
          const shown = limit ? filtered.slice(0, limit) : filtered
          if (filtered.length === 0) {
            return <p className="py-3 text-center text-sm text-muted">Nenhum nome corresponde à busca.</p>
          }
          return (
            <ul className="flex flex-col gap-2">
              {shown.map((row) => (
                <QueueRow
                  key={row.queue_id}
                  row={row}
                  spinPending={spinPending}
                  busy={busy}
                  onRelease={(id) => release.mutate(id)}
                  onRemove={setToRemove}
                  onChangeWheel={(id, kind: WheelKind) => update.mutate({ queueId: id, wheelKind: kind })}
                  onChangeAttempts={(id, attempts) => update.mutate({ queueId: id, attempts })}
                />
              ))}
              {limit && filtered.length > limit ? (
                <li className="text-center text-xs text-muted">
                  + {filtered.length - limit} na fila completa abaixo
                </li>
              ) : null}
            </ul>
          )
        }}
      </QueryBoundary>
      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="Remover da fila?"
        description={
          toRemove
            ? `${toRemove.person_name} sai da fila sem girar. Esta ação não apaga giros já aprovados.`
            : ''
        }
        confirmLabel="Remover"
        tone="danger"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!toRemove) return
          try {
            await remove.mutateAsync(toRemove.queue_id)
          } catch {
            return // toast global já exibiu o erro (ex.: SPIN_PENDING); o diálogo continua aberto
          }
          setToRemove(null)
        }}
      />
    </>
  )
}
