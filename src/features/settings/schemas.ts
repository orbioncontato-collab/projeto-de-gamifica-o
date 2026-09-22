import { z } from 'zod'
import { zInt, zLocalDate, zLocalDateTime, zMoney, zText, zTextOptional } from '@/lib/forms'
import type { BrandPreset } from '@/lib/database.types'
import { BRAND_PRESET_IDS, PLATFORM_NAME_MAX } from '@/features/branding/presets'

/** Schemas de formulário de Configurações (WP7). Limites espelham DATA-MODEL §4.1/§4.3/§4.13. */

export const COMPANY_NAME_MAX = 80
export const XP_PER_LEVEL_MIN = 50
export const XP_PER_LEVEL_MAX = 100_000
export const SEASON_NAME_MAX = 60
export const EVENT_NAME_MAX = 60
export const EVENT_MULTIPLIER_MIN = 1.1
export const EVENT_MULTIPLIER_MAX = 10

const zPct = z.coerce.number({ error: 'Informe um número.' }).min(0, 'Mínimo 0%.').max(100, 'Máximo 100%.')

export const companyFormSchema = z.object({
  companyName: zText(COMPANY_NAME_MAX),
  xpPerLevel: zInt(XP_PER_LEVEL_MIN, XP_PER_LEVEL_MAX),
  timezone: zText(64),
  targetConversionPct: zPct,
  targetAttendancePct: zPct,
  targetCrmPct: zPct,
  targetActivitiesCount: zInt(0, 1_000_000),
  rankAdmins: z.boolean(),
})
export type CompanyFormInput = z.input<typeof companyFormSchema>
export type CompanyFormValues = z.output<typeof companyFormSchema>

/** Aba "Marca" (migration 14). A logo fica fora do form (estado próprio, ver BrandingForm). */
export const brandingFormSchema = z.object({
  platformName: zText(PLATFORM_NAME_MAX),
  brandPreset: z.enum(BRAND_PRESET_IDS as [BrandPreset, ...BrandPreset[]]),
  defaultTheme: z.enum(['dark', 'light']),
})
export type BrandingFormInput = z.input<typeof brandingFormSchema>
export type BrandingFormValues = z.output<typeof brandingFormSchema>

export const seasonFormSchema = z
  .object({
    name: zText(SEASON_NAME_MAX),
    startsOn: zLocalDate,
    endsOn: zLocalDate,
    teamGoalAmount: zMoney,
    activate: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.endsOn < v.startsOn) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsOn'],
        message: 'O fim precisa ser igual ou depois do início.',
      })
    }
  })
export type SeasonFormInput = z.input<typeof seasonFormSchema>
export type SeasonFormValues = z.output<typeof seasonFormSchema>

export const eventFormSchema = z
  .object({
    name: zText(EVENT_NAME_MAX),
    description: zTextOptional(300),
    multiplier: z.coerce
      .number({ error: 'Informe o multiplicador.' })
      .min(EVENT_MULTIPLIER_MIN, `Mínimo ${EVENT_MULTIPLIER_MIN}x.`)
      .max(EVENT_MULTIPLIER_MAX, `Máximo ${EVENT_MULTIPLIER_MAX}x.`),
    startsAt: zLocalDateTime,
    endsAt: zLocalDateTime,
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.endsAt <= v.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'O fim precisa ser depois do início.' })
    }
  })
export type EventFormInput = z.input<typeof eventFormSchema>
export type EventFormValues = z.output<typeof eventFormSchema>

/** Fusos oferecidos no select (IANA). O banco valida qualquer nome válido; o app oferece os do Brasil. */
export const TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'America/Sao_Paulo', label: 'Brasília (America/Sao_Paulo)' },
  { value: 'America/Manaus', label: 'Manaus (America/Manaus)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (America/Cuiaba)' },
  { value: 'America/Campo_Grande', label: 'Campo Grande (America/Campo_Grande)' },
  { value: 'America/Belem', label: 'Belém (America/Belem)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (America/Fortaleza)' },
  { value: 'America/Recife', label: 'Recife (America/Recife)' },
  { value: 'America/Bahia', label: 'Salvador (America/Bahia)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (America/Rio_Branco)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (America/Noronha)' },
]
