import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

/**
 * Formulários (FRONTEND-ARCH §4.10): RHF + zod 4, validação `onBlur`, mensagens pt-BR.
 * `installZodPtBr()` é chamado uma vez em main.tsx.
 */

export function installZodPtBr(): void {
  z.config(z.locales.ptBR())
}

export function useZodForm<TSchema extends z.ZodType<FieldValues>>(
  schema: TSchema,
  defaultValues: DefaultValues<z.input<TSchema>>,
): UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>> {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
  })
}

/** "8.500,00" | "8500" | 8500 → 8500 (pt-BR: ponto = milhar, vírgula = decimal) */
export function parseMoneyInput(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const raw = value.replace(/\s|R\$/g, '').trim()
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/\.(?=\d{3}(\D|$))/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

const MONEY_INVALID = 'Informe um valor em reais válido.'

/** Aceita "8.500,00" e números; >= 0 */
export const zMoney = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : (parseMoneyInput(v) ?? v)),
  z.number({ error: MONEY_INVALID }).min(0, 'O valor não pode ser negativo.'),
)
export const zMoneyOptional = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : (parseMoneyInput(v) ?? v)),
  z.number({ error: MONEY_INVALID }).min(0, 'O valor não pode ser negativo.').nullable(),
)
export const zUuid = z.uuid('Identificador inválido.')
/** string de `datetime-local` ("YYYY-MM-DDTHH:mm") */
export const zLocalDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Informe data e hora.')
/** string de `<input type="date">` ("YYYY-MM-DD") */
export const zLocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.')
/** 12 caracteres A-Z0-9 após normalizar (maiúsculas, sem espaços/hífens) */
export const zTeamCode = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase().replace(/[\s-]/g, '') : v),
  z.string().regex(/^[A-Z0-9]{12}$/, 'Código da equipe inválido.'),
)
export const zPassword = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.')
export const zEmail = z.email('Informe um e-mail válido.')
export const zHexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.')
export const zText = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? 'Campo obrigatório.' : `Mínimo de ${min} caracteres.`)
    .max(max, `Máximo de ${max} caracteres.`)
export const zTextOptional = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable())
export const zInt = (min: number, max: number) =>
  z.coerce.number({ error: 'Informe um número.' }).int('Informe um número inteiro.').min(min).max(max)
