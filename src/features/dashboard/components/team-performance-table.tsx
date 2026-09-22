import { Link } from '@tanstack/react-router'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { formatBRL, formatOrdinal, formatPct, formatPoints } from '@/lib/format'
import { JOB_TITLE_LABELS } from '@/lib/labels'
import type { VProfileStats } from '@/lib/database.types'

type Row = Pick<
  VProfileStats,
  | 'profile_id'
  | 'full_name'
  | 'avatar_path'
  | 'color'
  | 'job_title'
  | 'team'
  | 'points'
  | 'sales_amount'
  | 'sales_count'
  | 'conversion_pct'
  | 'rank'
>

const viewLink = (row: Row) => (
  <Button asChild variant="secondary" size="sm">
    <Link to="/admin/equipe" search={{ perfil: row.profile_id }}>
      Ver desempenho
    </Link>
  </Button>
)

const person = (row: Row) => (
  <div className="flex items-center gap-3">
    <Avatar name={row.full_name} color={row.color} avatarPath={row.avatar_path} size="sm" />
    <div className="min-w-0">
      <div className="break-safe text-sm font-bold text-text">{row.full_name}</div>
      <div className="text-[11px] font-semibold text-muted">
        {JOB_TITLE_LABELS[row.job_title]}
        {row.team ? ` · ${row.team}` : ''}
      </div>
    </div>
  </div>
)

const columns: Column<Row>[] = [
  { key: 'person', header: 'Colaborador', cell: person },
  { key: 'points', header: 'Pontos', align: 'right', className: 'nums', cell: (r) => formatPoints(r.points) },
  {
    key: 'sales',
    header: 'Vendas',
    align: 'right',
    className: 'nums',
    cell: (r) => formatBRL(r.sales_amount, { compact: true }),
  },
  {
    key: 'conversion',
    header: 'Conversão',
    align: 'right',
    className: 'nums',
    cell: (r) => formatPct(r.conversion_pct),
  },
  { key: 'rank', header: 'Posição', align: 'right', className: 'nums', cell: (r) => formatOrdinal(r.rank) },
  { key: 'action', header: <span className="sr-only">Ações</span>, align: 'right', cell: viewLink },
]

/** Tabela "Desempenho do time" (FEATURE §2b); "Ver desempenho" navega para `/admin/equipe?perfil=<id>`. */
export function TeamPerformanceTable({ rows }: { rows: Row[] }) {
  return (
    <PremiumCard as="section" aria-labelledby="team-performance-title">
      <SectionHeader eyebrow="Equipe" title="Desempenho do time" />
      <span id="team-performance-title" className="sr-only">
        Desempenho do time
      </span>
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.profile_id}
          caption="Desempenho por colaborador na temporada"
          empty={
            <EmptyState
              compact
              icon={Users}
              title="Nenhum colaborador ainda"
              description="Quem se cadastrar com o código da equipe aparece aqui depois de aprovado."
              adminHint="Compartilhe o código da equipe em Configurações › Código."
            />
          }
          mobileCard={(row) => (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
              {person(row)}
              <dl className="nums grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="font-semibold text-muted">Pontos</dt>
                  <dd className="font-black text-text">{formatPoints(row.points)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted">Vendas</dt>
                  <dd className="font-black text-text">{formatBRL(row.sales_amount, { compact: true })}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted">Conversão</dt>
                  <dd className="font-black text-text">{formatPct(row.conversion_pct)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted">Posição</dt>
                  <dd className="font-black text-text">{formatOrdinal(row.rank)}</dd>
                </div>
              </dl>
              {viewLink(row)}
            </div>
          )}
        />
      </div>
    </PremiumCard>
  )
}
