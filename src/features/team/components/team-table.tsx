import { Eye, Pencil } from 'lucide-react'
import type { VProfileStats } from '@/lib/database.types'
import { JOB_TITLE_LABELS } from '@/lib/labels'
import { formatBRL, formatOrdinal, formatPoints } from '@/lib/format'
import { Avatar } from '@/components/shared/avatar'
import { StatusPill } from '@/components/shared/status-pill'
import { DataTable, type Column } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { PROFILE_STATUS_PILL } from '../team-utils'
import { TeamMemberCard } from './team-cards'

export interface TeamTableProps {
  rows: VProfileStats[]
  empty: React.ReactNode
  onView: (row: VProfileStats) => void
  onEdit: (row: VProfileStats) => void
}

/** Tabela da Equipe (FEATURE §11): nome, cargo, pontos, nível, ranking, vendas, status, ações. */
export function TeamTable({ rows, empty, onView, onEdit }: TeamTableProps) {
  const columns: Column<VProfileStats>[] = [
    {
      key: 'name',
      header: 'Colaborador',
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={r.full_name} color={r.color} avatarPath={r.avatar_path} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-text">{r.full_name}</p>
            <p className="truncate text-xs text-muted">{r.email ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Cargo',
      cell: (r) => (
        <span className="text-sm text-text-2">
          {JOB_TITLE_LABELS[r.job_title]}
          {r.team ? <span className="block text-xs text-muted">{r.team}</span> : null}
        </span>
      ),
    },
    {
      key: 'points',
      header: 'Pontos',
      align: 'right',
      cell: (r) => <span className="nums font-black">{formatPoints(r.points)}</span>,
    },
    { key: 'level', header: 'Nível', align: 'right', cell: (r) => <span className="nums">{r.level}</span> },
    {
      key: 'rank',
      header: 'Ranking',
      align: 'right',
      cell: (r) => <span className="nums">{formatOrdinal(r.rank)}</span>,
    },
    {
      key: 'sales',
      header: 'Vendas',
      align: 'right',
      cell: (r) => <span className="nums">{formatBRL(r.sales_amount, { compact: true })}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusPill status={r.status} map={PROFILE_STATUS_PILL} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Ver perfil de ${r.full_name}`}
            onClick={(e) => {
              e.stopPropagation()
              onView(r)
            }}
          >
            <Eye aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${r.full_name}`}
            onClick={(e) => {
              e.stopPropagation()
              onEdit(r)
            }}
          >
            <Pencil aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.profile_id}
      empty={empty}
      mobileCard={(r) => <TeamMemberCard row={r} />}
      onRowClick={onView}
      caption="Colaboradores da temporada"
    />
  )
}
