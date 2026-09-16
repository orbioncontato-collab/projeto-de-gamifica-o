import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DataTable, type Column } from './data-table'

interface Row {
  key: string
  label: string
}
const ROWS: Row[] = [
  { key: 'meeting_held', label: 'Reunião realizada' },
  { key: 'sale_closed', label: 'Venda fechada' },
]
const COLUMNS: Column<Row>[] = [{ key: 'label', header: 'Regra', cell: (r) => r.label }]

describe('DataTable', () => {
  test('renderiza `empty` quando não há linhas', () => {
    render(<DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.key} empty={<p>Nenhuma regra</p>} />)
    expect(screen.getByText('Nenhuma regra')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  test('linhas clicáveis são focáveis e respondem a Enter e Espaço', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.key}
        empty={null}
        onRowClick={onRowClick}
        caption="Regras"
      />,
    )
    const rows = screen.getAllByRole('row').slice(1) // pula o cabeçalho
    expect(rows[0]).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(rows[0] as HTMLElement, { key: 'Enter' })
    fireEvent.keyDown(rows[1] as HTMLElement, { key: ' ' })
    expect(onRowClick).toHaveBeenNthCalledWith(1, ROWS[0])
    expect(onRowClick).toHaveBeenNthCalledWith(2, ROWS[1])
  })

  test('cards mobile clicáveis viram botões acessíveis', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.key}
        empty={null}
        onRowClick={onRowClick}
        mobileCard={(r) => <span>{r.label}</span>}
      />,
    )
    const cards = screen.getAllByRole('button')
    expect(cards).toHaveLength(ROWS.length)
    fireEvent.keyDown(cards[0] as HTMLElement, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0])
  })

  test('sem onRowClick as linhas não entram na ordem de tabulação', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.key} empty={null} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).not.toHaveAttribute('tabindex')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
