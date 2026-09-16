import { useState } from 'react'
import { Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatBRL, formatNumber } from '@/lib/format'
import type { RewardRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/shared/badge'
import { DataTable, type Column } from '@/components/shared/data-table'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { TableSkeleton } from '@/components/shared/skeletons'
import { EmptyState } from '@/components/shared/empty-state'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useDeleteReward, useRewardsCatalog } from '../hooks'
import { stockLabel } from '../rewards-utils'
import { RewardEditorDialog } from './reward-editor-dialog'

/** Catálogo (admin): tabela/cards com editar e excluir (soft delete) + "Cadastrar recompensa". */
export function CatalogTable({ openNew = false }: { openNew?: boolean }) {
  const query = useRewardsCatalog('admin')
  const remove = useDeleteReward()
  const [editor, setEditor] = useState<{ open: boolean; reward: RewardRow | null }>({
    open: openNew,
    reward: null,
  })
  const [toDelete, setToDelete] = useState<RewardRow | null>(null)

  const openEditor = (reward: RewardRow | null) => setEditor({ open: true, reward })
  const columns: Column<RewardRow>[] = [
    {
      key: 'name',
      header: 'Recompensa',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none" aria-hidden="true">
            {r.icon ?? '🎁'}
          </span>
          <div className="min-w-0">
            <div className="truncate font-black text-text">{r.name}</div>
            <div className="text-[11px] text-muted">{r.category ?? 'Sem categoria'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Valor',
      cell: (r) => (r.value_amount !== null ? formatBRL(r.value_amount) : '—'),
      align: 'right',
    },
    {
      key: 'cost',
      header: 'Custo',
      cell: (r) => <span className="nums font-bold text-gold">{formatNumber(r.cost_coins)}</span>,
      align: 'right',
    },
    { key: 'stock', header: 'Estoque', cell: (r) => stockLabel(r.stock), align: 'right' },
    {
      key: 'active',
      header: 'Status',
      cell: (r) => <Badge tone={r.is_active ? 'green' : 'dark'}>{r.is_active ? 'Ativa' : 'Inativa'}</Badge>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      cell: (r) => <RowActions reward={r} onEdit={openEditor} onDelete={setToDelete} />,
      align: 'right',
    },
  ]

  return (
    <section aria-label="Catálogo de recompensas">
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => openEditor(null)}>
          <Plus aria-hidden="true" /> Cadastrar recompensa
        </Button>
      </div>
      <QueryBoundary
        query={query}
        skeleton={<TableSkeleton rows={5} cols={5} />}
        empty={{
          when: (rows) => rows.length === 0,
          render: (
            <EmptyState
              icon={ShoppingBag}
              title="Nenhuma recompensa cadastrada"
              description="Cadastre vouchers, PIX e benefícios para o time resgatar com Orb Coins."
              action={{ label: 'Cadastrar recompensa', onClick: () => openEditor(null) }}
            />
          ),
        }}
      >
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={null}
            mobileCard={(r) => (
              <div className="premium-card flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {r.icon ?? '🎁'}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-black text-text">{r.name}</div>
                    <div className="text-[11px] text-muted">
                      <span className="nums font-bold text-gold">{formatNumber(r.cost_coins)} moedas</span> ·{' '}
                      {stockLabel(r.stock)} · {r.is_active ? 'Ativa' : 'Inativa'}
                    </div>
                  </div>
                </div>
                <RowActions reward={r} onEdit={openEditor} onDelete={setToDelete} />
              </div>
            )}
          />
        )}
      </QueryBoundary>

      <RewardEditorDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        reward={editor.reward}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete ? `Excluir ${toDelete.name}?` : 'Excluir'}
        description="A recompensa some da loja e do catálogo. Pedidos já feitos continuam no histórico."
        confirmLabel="Excluir"
        loading={remove.isPending}
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id).catch(() => undefined)
        }}
      />
    </section>
  )
}

function RowActions({
  reward,
  onEdit,
  onDelete,
}: {
  reward: RewardRow
  onEdit: (r: RewardRow) => void
  onDelete: (r: RewardRow) => void
}) {
  return (
    <div className="flex shrink-0 justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar ${reward.name}`}
        onClick={() => onEdit(reward)}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Excluir ${reward.name}`}
        onClick={() => onDelete(reward)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  )
}
