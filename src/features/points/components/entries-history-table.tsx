import { useState } from 'react'
import { ChevronLeft, ChevronRight, History, Undo2 } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { TableSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { PersonPicker } from '@/features/profiles/components/person-picker'
import { useMe } from '@/features/auth/bootstrap-query'
import { formatBRL, formatCoins, formatDateTime, formatNumber, formatPoints } from '@/lib/format'
import { ENTRY_SOURCE_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { VPointEntryHistory } from '@/lib/database.types'
import { HISTORY_PAGE_SIZE } from '../api'
import { useEntriesHistory } from '../hooks'
import { pageCount } from '../entry-logic'
import { ReverseEntryDialog } from './reverse-entry-dialog'

export interface EntriesHistoryTableProps {
  initialProfileId?: string | undefined
}

/** Histórico paginado (25 por página) com filtro por colaborador e estorno por linha. */
export function EntriesHistoryTable({ initialProfileId }: EntriesHistoryTableProps) {
  const { settings } = useMe()
  const tz = settings.timezone
  const [profileId, setProfileId] = useState<string | null>(initialProfileId ?? null)
  const [page, setPage] = useState(0)
  const [reversing, setReversing] = useState<VPointEntryHistory | null>(null)
  const history = useEntriesHistory({ profileId, page, pageSize: HISTORY_PAGE_SIZE })

  const changeProfile = (id: string | null) => {
    setProfileId(id)
    setPage(0)
  }

  const canReverse = (e: VPointEntryHistory) =>
    !e.is_reversed && !e.reverses_entry_id && e.source !== 'reward'

  const columns: Column<VPointEntryHistory>[] = [
    {
      key: 'person',
      header: 'Colaborador',
      cell: (e) => (
        <span className="flex items-center gap-2">
          <Avatar name={e.full_name} color={e.color} avatarPath={e.avatar_path} size="xs" />
          <span className="font-bold text-text">{e.full_name}</span>
        </span>
      ),
    },
    { key: 'what', header: 'Lançamento', cell: (e) => <EntryTitle entry={e} tz={tz} /> },
    {
      key: 'when',
      header: 'Data',
      cell: (e) => <span className="text-xs text-muted">{formatDateTime(e.occurred_at, tz)}</span>,
    },
    { key: 'points', header: 'Pontos', align: 'right', cell: (e) => <PointsCell entry={e} /> },
    {
      key: 'coins',
      header: 'Moedas',
      align: 'right',
      cell: (e) => (
        <span className={cn('text-xs', e.coins < 0 ? 'text-red-soft' : 'text-gold')}>
          {formatCoins(e.coins)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      cell: (e) =>
        canReverse(e) ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Estornar lançamento de ${e.full_name}`}
            onClick={() => setReversing(e)}
          >
            <Undo2 aria-hidden="true" />
          </Button>
        ) : null,
    },
  ]

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="history-profile" className="field-label">
            Filtrar por colaborador
          </label>
          <PersonPicker
            id="history-profile"
            value={profileId}
            onChange={changeProfile}
            placeholder="Todos os colaboradores"
          />
        </div>
        {profileId ? (
          <Button variant="ghost" size="sm" onClick={() => changeProfile(null)}>
            Limpar filtro
          </Button>
        ) : null}
      </div>

      <QueryBoundary
        query={history}
        skeleton={<TableSkeleton rows={8} cols={5} />}
        empty={{
          when: (d) => d.total === 0,
          render: (
            <EmptyState
              icon={History}
              title="Nenhum lançamento ainda"
              description={
                profileId
                  ? 'Este colaborador ainda não tem lançamentos.'
                  : 'Os lançamentos por regra e manuais aparecem aqui.'
              }
              adminHint="Lance a primeira venda na aba Lançar."
            />
          ),
        }}
      >
        {(data) => (
          <>
            <DataTable
              columns={columns}
              rows={data.rows}
              rowKey={(e) => e.entry_id}
              caption="Histórico de lançamentos"
              empty={null}
              mobileCard={(e) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Avatar name={e.full_name} color={e.color} avatarPath={e.avatar_path} size="xs" />
                      <span className="font-bold text-text">{e.full_name}</span>
                    </span>
                    <PointsCell entry={e} />
                  </div>
                  <EntryTitle entry={e} tz={tz} />
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{formatDateTime(e.occurred_at, tz)}</span>
                    <span className={e.coins < 0 ? 'text-red-soft' : 'text-gold'}>
                      {formatCoins(e.coins)}
                    </span>
                  </div>
                  {canReverse(e) ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="self-end"
                      onClick={() => setReversing(e)}
                    >
                      <Undo2 aria-hidden="true" /> Estornar
                    </Button>
                  ) : null}
                </div>
              )}
            />
            <Pager page={page} total={data.total} onChange={setPage} disabled={history.isFetching} />
          </>
        )}
      </QueryBoundary>

      <ReverseEntryDialog entry={reversing} onOpenChange={(open) => !open && setReversing(null)} />
    </section>
  )
}

function EntryTitle({ entry: e, tz }: { entry: VPointEntryHistory; tz: string }) {
  const title = e.reason ?? e.rule_name ?? ENTRY_SOURCE_LABELS[e.source]
  const isReversal = e.reverses_entry_id !== null
  return (
    <div className="flex flex-col gap-1">
      <span className={cn('text-sm', isReversal ? 'text-muted italic' : 'text-text-2')}>{title}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-2">
        <Badge tone={isReversal ? 'red' : e.source === 'manual' ? 'blue' : 'dark'}>
          {isReversal ? 'Estorno' : ENTRY_SOURCE_LABELS[e.source]}
        </Badge>
        {e.quantity > 1 ? <span>×{formatNumber(e.quantity)}</span> : null}
        {e.amount !== null && e.amount > 0 ? <span>{formatBRL(e.amount)}</span> : null}
        {e.multiplier !== 1 ? (
          <span className="text-purple-soft">
            {e.special_event_name ? `${e.special_event_name} ` : ''}×{formatNumber(e.multiplier, 1)}
          </span>
        ) : null}
        {e.is_reversed ? <Badge tone="red">Estornado</Badge> : null}
        {isReversal ? <span>estornado em {formatDateTime(e.created_at, tz)}</span> : null}
      </span>
    </div>
  )
}

function PointsCell({ entry: e }: { entry: VPointEntryHistory }) {
  return (
    <span
      className={cn(
        'font-black tabular-nums',
        e.points < 0 ? 'text-red-soft' : 'text-accent',
        e.is_reversed && 'line-through opacity-60',
      )}
    >
      {formatPoints(e.points)}
    </span>
  )
}

function Pager({
  page,
  total,
  onChange,
  disabled,
}: {
  page: number
  total: number
  onChange: (p: number) => void
  disabled: boolean
}) {
  const pages = pageCount(total, HISTORY_PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <nav aria-label="Paginação do histórico" className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted">
        Página {formatNumber(page + 1)} de {formatNumber(pages)} · {formatNumber(total)} lançamentos
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={disabled || page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Próxima página"
          disabled={disabled || page >= pages - 1}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
