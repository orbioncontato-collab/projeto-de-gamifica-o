import { useState } from 'react'
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/shared/badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { SectionHeader } from '@/components/shared/section-header'
import { TableSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { formatCoins, formatPoints } from '@/lib/format'
import { METRIC_LABELS } from '@/lib/labels'
import type { PointRuleRow } from '@/lib/database.types'
import { useDeletePointRule, usePointRules } from '../hooks'
import { RuleEditorDialog } from './rule-editor-dialog'

const TRIGGER_LABELS: Record<PointRuleRow['trigger_kind'], string> = {
  manual: 'Manual',
  auto_amount_step: 'Automática (faturamento)',
  auto_goal: 'Automática (meta)',
}

/** Aba "Regras": lista com ativa/inativa, pontos, moedas, métrica e tipo; editor; nova; excluir (soft). */
export function RulesList() {
  const rules = usePointRules({ includeInactive: true })
  const remove = useDeletePointRule()
  const [editing, setEditing] = useState<PointRuleRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<PointRuleRow | null>(null)

  const columns: Column<PointRuleRow>[] = [
    {
      key: 'name',
      header: 'Regra',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-bold text-text">{r.name}</span>
          <span className="text-xs text-muted">{METRIC_LABELS[r.metric]}</span>
        </div>
      ),
    },
    {
      key: 'points',
      header: 'Pontos',
      align: 'right',
      cell: (r) => <span className="font-black text-accent">{formatPoints(r.points)}</span>,
    },
    {
      key: 'coins',
      header: 'Moedas',
      align: 'right',
      cell: (r) => <span className="text-gold">{formatCoins(r.coins)}</span>,
    },
    {
      key: 'trigger',
      header: 'Tipo',
      cell: (r) => <span className="text-xs text-text-2">{TRIGGER_LABELS[r.trigger_kind]}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge tone={r.is_active ? 'green' : 'dark'}>{r.is_active ? 'Ativa' : 'Inativa'}</Badge>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      cell: (r) => <RowActions rule={r} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />,
    },
  ]

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Catálogo"
        title="Regras de pontuação"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> Nova regra
          </Button>
        }
      />
      <QueryBoundary
        query={rules}
        skeleton={<TableSkeleton rows={6} cols={5} />}
        empty={{
          when: (d) => d.length === 0,
          render: (
            <EmptyState
              icon={ListChecks}
              title="Nenhuma regra cadastrada"
              description="As regras definem quantos pontos e moedas cada atividade vale."
              action={{ label: 'Criar primeira regra', onClick: () => setCreating(true) }}
            />
          ),
        }}
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data}
            rowKey={(r) => r.id}
            caption="Regras de pontuação"
            empty={null}
            mobileCard={(r) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-text">{r.name}</p>
                    <p className="text-xs text-muted">
                      {METRIC_LABELS[r.metric]} · {TRIGGER_LABELS[r.trigger_kind]}
                    </p>
                  </div>
                  <Badge tone={r.is_active ? 'green' : 'dark'}>{r.is_active ? 'Ativa' : 'Inativa'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    <span className="font-black text-accent">{formatPoints(r.points)}</span>
                    <span className="mx-2 text-muted-2">·</span>
                    <span className="text-gold">{formatCoins(r.coins)}</span>
                  </span>
                  <RowActions rule={r} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
                </div>
              </div>
            )}
          />
        )}
      </QueryBoundary>

      <RuleEditorDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false)
            setEditing(null)
          }
        }}
        rule={editing}
        existingRules={rules.data ?? []}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir regra?"
        description={
          deleting
            ? `"${deleting.name}" deixa de aparecer no lançamento. Lançamentos já feitos com ela continuam no histórico.`
            : ''
        }
        confirmLabel="Excluir"
        loading={remove.isPending}
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id)
        }}
      />
    </section>
  )
}

function RowActions({
  rule,
  onEdit,
  onDelete,
}: {
  rule: PointRuleRow
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${rule.name}`} onClick={onEdit}>
        <Pencil aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${rule.name}`} onClick={onDelete}>
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  )
}
