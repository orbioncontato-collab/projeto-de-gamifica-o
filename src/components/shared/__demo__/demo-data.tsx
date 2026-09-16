import { formatPoints } from '@/lib/format'
import type { Column } from '@/components/shared/data-table'
import { StatusPill } from '@/components/shared/status-pill'
import type { Tone } from '@/components/shared/types'

/**
 * Dados de exemplo da vitrine (/dev/showcase). Sem pessoas fictícias: só catálogo seed
 * (DATA-MODEL §13 point_rules) e valores numéricos.
 */

export const ALL_TONES: readonly Tone[] = [
  'green',
  'gold',
  'red',
  'blue',
  'purple',
  'cyan',
  'dark',
  'success',
  'warning',
  'danger',
  'info',
  'muted',
]

export interface CatalogRow {
  key: string
  label: string
  points: number
  status: 'active' | 'inactive'
}

/** Regras do catálogo seed — não são pessoas. */
export const CATALOG_ROWS: CatalogRow[] = [
  { key: 'meeting_held', label: 'Reunião realizada', points: 10, status: 'active' },
  { key: 'sale_closed', label: 'Venda fechada', points: 100, status: 'active' },
  { key: 'crm_updated', label: 'CRM atualizado', points: 5, status: 'inactive' },
]

export const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Ativa', tone: 'success' },
  inactive: { label: 'Inativa', tone: 'muted' },
}

export const CATALOG_COLUMNS: Column<CatalogRow>[] = [
  { key: 'label', header: 'Regra', cell: (r) => r.label },
  { key: 'points', header: 'Pontos', align: 'right', className: 'nums', cell: (r) => formatPoints(r.points) },
  { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status} map={STATUS_MAP} /> },
]
