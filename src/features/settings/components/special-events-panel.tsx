import { useState } from 'react'
import { Pencil, Plus, Power, Zap } from 'lucide-react'
import { Badge } from '@/components/shared/badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { SectionHeader } from '@/components/shared/section-header'
import { ListSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/bootstrap-query'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { SpecialEventState, VSpecialEvent } from '@/lib/database.types'
import { useDeleteSpecialEvent, useSpecialEvents } from '../hooks'
import { SpecialEventEditorDialog } from './special-event-editor-dialog'

const STATE_BADGE: Record<
  SpecialEventState,
  { label: string; tone: 'green' | 'gold' | 'red' | 'blue' | 'dark' }
> = {
  live: { label: 'Ao vivo', tone: 'red' },
  upcoming: { label: 'Agendado', tone: 'blue' },
  ended: { label: 'Encerrado', tone: 'dark' },
  inactive: { label: 'Inativo', tone: 'dark' },
}

/** Aba "Eventos": multiplicadores de pontos com janela; criar/editar via RPC, desativar via soft delete. */
export function SpecialEventsPanel() {
  const { settings } = useMe()
  const tz = settings.timezone
  const events = useSpecialEvents()
  const remove = useDeleteSpecialEvent()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<VSpecialEvent | null>(null)
  const [removing, setRemoving] = useState<VSpecialEvent | null>(null)

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Multiplicadores"
        title="Eventos especiais"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> Novo evento
          </Button>
        }
      />
      <QueryBoundary
        query={events}
        skeleton={<ListSkeleton rows={3} />}
        empty={{
          when: (d) => d.length === 0,
          render: (
            <EmptyState
              icon={Zap}
              title="Nenhum evento"
              description="Crie um evento para multiplicar os pontos do time em uma janela de tempo."
              action={{ label: 'Criar evento', onClick: () => setCreating(true) }}
            />
          ),
        }}
      >
        {(data) => (
          <div className="space-y-3">
            {data.map((ev) => {
              const badge = STATE_BADGE[ev.state]
              return (
                <PremiumCard key={ev.id} as="div" padding="md" tone={ev.state === 'live' ? 'red' : 'default'}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-text">{ev.name}</h3>
                        <Badge tone="gold">{formatNumber(ev.multiplier, 1)}x pontos</Badge>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {formatDateTime(ev.starts_at, tz)} até {formatDateTime(ev.ends_at, tz)}
                      </p>
                      {ev.description ? <p className="mt-1 text-sm text-text-2">{ev.description}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(ev)}>
                        <Pencil aria-hidden="true" /> Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setRemoving(ev)}>
                        <Power aria-hidden="true" /> Desativar
                      </Button>
                    </div>
                  </div>
                </PremiumCard>
              )
            })}
          </div>
        )}
      </QueryBoundary>

      <SpecialEventEditorDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false)
            setEditing(null)
          }
        }}
        event={editing}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Desativar evento?"
        description={
          removing
            ? `"${removing.name}" sai da lista e deixa de multiplicar pontos. Lançamentos já feitos mantêm o multiplicador.`
            : ''
        }
        confirmLabel="Desativar"
        loading={remove.isPending}
        onConfirm={async () => {
          if (removing) await remove.mutateAsync(removing.id)
        }}
      />
    </section>
  )
}
