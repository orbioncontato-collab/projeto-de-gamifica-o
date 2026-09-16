import { useState } from 'react'
import { ClipboardList, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/shared/badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ListSkeleton } from '@/components/shared/skeletons'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { SectionHeader } from '@/components/shared/section-header'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { METRIC_LABELS, MISSION_KIND_LABELS } from '@/lib/labels'
import { useMe } from '@/features/auth/hooks'
import type { MissionAdminRow } from '../api'
import { useDeleteMission, useMissionsAdmin } from '../hooks'
import { missionRewardLabel } from '../mission-copy'

interface MissionsAdminListProps {
  onEdit: (mission: MissionAdminRow) => void
  onCreate: () => void
}

/** Lista administrativa da temporada (todas as missões, inclusive futuras/passadas) com editar e excluir. */
export function MissionsAdminList({ onEdit, onCreate }: MissionsAdminListProps) {
  const { seasonId, settings } = useMe()
  const query = useMissionsAdmin(seasonId)
  const remove = useDeleteMission()
  const [pendingDelete, setPendingDelete] = useState<MissionAdminRow | null>(null)
  const tz = settings.timezone
  const now = Date.now()

  return (
    <section aria-labelledby="missions-admin-title" className="flex flex-col gap-4">
      <SectionHeader eyebrow="Gestão" title="Missões da temporada" />
      <QueryBoundary
        query={query}
        skeleton={<ListSkeleton rows={3} />}
        empty={{
          when: (rows) => rows.length === 0,
          render: (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma missão criada"
              description="Crie missões diárias, semanais, especiais ou relâmpago para o time."
              action={{ label: 'Nova missão', onClick: onCreate }}
              compact
            />
          ),
        }}
      >
        {(rows) => (
          <ul className="flex flex-col gap-2">
            {rows.map((m) => {
              const ended = new Date(m.ends_at).getTime() <= now
              const upcoming = new Date(m.starts_at).getTime() > now
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-text">{m.title}</span>
                      <Badge tone="dark">{MISSION_KIND_LABELS[m.kind]}</Badge>
                      {!m.is_active ? (
                        <Badge tone="red">Inativa</Badge>
                      ) : ended ? (
                        <Badge tone="dark">Encerrada</Badge>
                      ) : upcoming ? (
                        <Badge tone="blue">Agendada</Badge>
                      ) : (
                        <Badge tone="green">Em andamento</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {METRIC_LABELS[m.metric]} · {missionRewardLabel(m)} ·{' '}
                      {m.audience === 'all' ? 'todos' : `${m.participant_ids.length} participante(s)`}
                    </p>
                    <p className="text-xs text-muted-2">
                      {formatDateTime(m.starts_at, tz)} até {formatDateTime(m.ends_at, tz)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(m)}>
                      <Pencil aria-hidden="true" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setPendingDelete(m)}
                      disabled={remove.isPending}
                    >
                      <Trash2 aria-hidden="true" />
                      Excluir
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </QueryBoundary>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title="Excluir missão?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" some das telas do time. O progresso já registrado fica no histórico.`
            : ''
        }
        confirmLabel="Excluir"
        tone="danger"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await remove.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </section>
  )
}
