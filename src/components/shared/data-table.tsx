import type { KeyboardEvent, ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty: ReactNode
  /** cards abaixo de `md` (padrão Equipe/Histórico); sem ele a tabela rola horizontalmente */
  mobileCard?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
  caption?: string
  className?: string
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

/** Enter/Espaço ativam a linha (tabela e card) como um botão. */
function activateOnKey<T>(row: T, onRowClick: (row: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onRowClick(row)
  }
}

/** Tabela em `md+`, cards abaixo (quando `mobileCard`); vazio delegado a `empty`. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  mobileCard,
  onRowClick,
  caption,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0) return <>{empty}</>
  return (
    <div className={className}>
      {mobileCard ? (
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <div
              key={rowKey(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? activateOnKey(row, onRowClick) : undefined}
              className={cn('rounded-[var(--radius-card)]', onRowClick && 'cursor-pointer')}
            >
              {mobileCard(row)}
            </div>
          ))}
        </div>
      ) : null}
      <div className={cn('premium-card overflow-x-auto p-0', mobileCard && 'hidden md:block')}>
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.key} className={cn(ALIGN[c.align ?? 'left'], c.className)}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer focus-visible:bg-surface-hover')}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? activateOnKey(row, onRowClick) : undefined}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(ALIGN[c.align ?? 'left'], c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
