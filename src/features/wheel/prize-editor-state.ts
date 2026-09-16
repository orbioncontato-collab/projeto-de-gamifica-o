import type { z } from 'zod'
import type { WheelKind, WheelPrizeRow } from '@/lib/database.types'
import type { PrizeDraft, PrizeRowErrors } from './components/prize-editor-row'
import { prizeListSchema, VALUE_REQUIRED_KINDS, type PrizeRowValues } from './schemas'
import { sectorColor, suggestColor } from './wheel-palette'

/** Helpers puros do editor de prêmios (testados em `prize-editor-state.test.ts`). */

let seq = 0
const nextKey = (): string => `d${Date.now().toString(36)}${(seq += 1)}`

export function draftsFromRows(kind: WheelKind, rows: readonly WheelPrizeRow[]): PrizeDraft[] {
  return rows.map((row, index) => ({
    key: row.id,
    id: row.id,
    label: row.label,
    kind: row.kind,
    value: row.value === null ? '' : String(row.value),
    weight: String(row.weight),
    color: sectorColor(kind, index, row.color).toUpperCase(),
    is_active: row.is_active,
  }))
}

export function newDraft(kind: WheelKind, index: number): PrizeDraft {
  return {
    key: nextKey(),
    label: '',
    kind: 'points',
    value: '',
    weight: '1',
    color: suggestColor(kind, index).toUpperCase(),
    is_active: true,
  }
}

const parseNumber = (s: string): number | null => {
  const trimmed = s.trim().replace(',', '.')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** Rascunhos → valores brutos para o schema (os erros voltam por índice). */
export function draftsToRaw(drafts: readonly PrizeDraft[]): unknown[] {
  return drafts.map((d) => ({
    ...(d.id ? { id: d.id } : {}),
    label: d.label,
    kind: d.kind,
    value: VALUE_REQUIRED_KINDS.includes(d.kind) ? parseNumber(d.value) : null,
    weight: d.weight,
    color: d.color || null,
    is_active: d.is_active,
  }))
}

export interface ValidationResult {
  values: PrizeRowValues[] | null
  rowErrors: Record<number, PrizeRowErrors>
  listErrors: string[]
}

export function validateDrafts(drafts: readonly PrizeDraft[]): ValidationResult {
  const parsed = prizeListSchema.safeParse(draftsToRaw(drafts))
  if (parsed.success) return { values: parsed.data, rowErrors: {}, listErrors: [] }
  const rowErrors: Record<number, PrizeRowErrors> = {}
  const listErrors: string[] = []
  for (const issue of parsed.error.issues as z.core.$ZodIssue[]) {
    const [index, field] = issue.path
    if (typeof index === 'number' && typeof field === 'string') {
      const current = rowErrors[index] ?? {}
      rowErrors[index] = { ...current, [field]: issue.message }
    } else {
      listErrors.push(issue.message)
    }
  }
  return { values: null, rowErrors, listErrors: [...new Set(listErrors)] }
}

export function moveDraft(drafts: readonly PrizeDraft[], index: number, dir: -1 | 1): PrizeDraft[] {
  const target = index + dir
  if (target < 0 || target >= drafts.length) return drafts.slice()
  const next = drafts.slice()
  const [item] = next.splice(index, 1)
  if (!item) return drafts.slice()
  next.splice(target, 0, item)
  return next
}

export function isDirty(original: readonly PrizeDraft[], current: readonly PrizeDraft[]): boolean {
  if (original.length !== current.length) return true
  return original.some((o, i) => {
    const c = current[i]
    if (!c) return true
    return (
      o.id !== c.id ||
      o.label !== c.label ||
      o.kind !== c.kind ||
      o.value !== c.value ||
      o.weight !== c.weight ||
      o.color !== c.color ||
      o.is_active !== c.is_active
    )
  })
}
