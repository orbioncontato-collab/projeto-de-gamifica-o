import type { ReactNode } from 'react'
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

/** Tabela em `md+`, cards abaixo (quando `mobileCard`); vazio delegado a `empty`. */
export function DataTable<T>({ columns, rows, rowKey, empty, mobileCard, onRowClick, caption, className }: DataTableProps<T>) {
  if (rows.length === 0) return <>{empty}</>
  return (
    <div className={className}>
      {mobileCard ? (
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <div key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {mobileCard(row)}
            </div>
          ))}
        </div>
      ) : null}
      <div className={cn('premium-card overflow-hidden p-0', mobileCard && 'hidden md:block')}>
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
                className={cn(onRowClick && 'cursor-pointer')}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter') onRowClick(row)
                      }
                    : undefined
                }
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
