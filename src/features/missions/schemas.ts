import { z } from 'zod'
import { zInt, zLocalDateTime, zMoney, zText, zTextOptional } from '@/lib/forms'
import type {
  MissionAudience,
  MissionKind,
  MissionTargetKind,
  MetricType,
  WheelKind,
} from '@/lib/database.types'

/** Esquema do editor de missão (DATA-MODEL §4.15 + `save_mission` §7.4). */

export const MISSION_TITLE_MAX = 80
export const MISSION_DESCRIPTION_MAX = 300
export const MISSION_ICON_MAX = 40
export const REWARD_MAX = 100_000
export const LIGHTNING_MAX_HOURS = 24

/** Métricas aceitas pela CK de `missions.metric` (exclui amount_step/weekly_goal/monthly_goal). */
export const MISSION_METRICS: readonly MetricType[] = [
  'sale',
  'meeting_scheduled',
  'meeting_held',
  'call',
  'crm_update',
  'lead_recovery',
  'upsell',
  'activity',
  'custom',
]
/** `target_kind = 'amount'` só com métricas monetárias. */
export const AMOUNT_METRICS: readonly MetricType[] = ['sale', 'upsell']

export const MISSION_KINDS: readonly MissionKind[] = ['daily', 'weekly', 'special', 'lightning']
const AUDIENCES: readonly MissionAudience[] = ['all', 'selected']
const TARGET_KINDS: readonly MissionTargetKind[] = ['count', 'amount']
const WHEEL_KINDS: readonly WheelKind[] = ['classic', 'premium']

const REWARD_REQUIRED = 'Informe pontos, moedas ou um giro na roleta.'
const TARGET_REQUIRED = 'A meta precisa ser maior que zero.'
const AMOUNT_METRIC_INVALID = 'Meta em R$ só vale para Venda ou Upsell.'
const PARTICIPANTS_REQUIRED = 'Selecione ao menos um participante.'
const END_AFTER_START = 'O fim precisa ser depois do início.'

export const missionFormSchema = z
  .object({
    title: zText(MISSION_TITLE_MAX),
    description: zTextOptional(MISSION_DESCRIPTION_MAX),
    icon: zTextOptional(MISSION_ICON_MAX),
    kind: z.enum(MISSION_KINDS as [MissionKind, ...MissionKind[]]),
    metric: z.enum(MISSION_METRICS as [MetricType, ...MetricType[]]),
    targetKind: z.enum(TARGET_KINDS as [MissionTargetKind, ...MissionTargetKind[]]),
    targetValue: zMoney,
    rewardPoints: zInt(0, REWARD_MAX),
    rewardCoins: zInt(0, REWARD_MAX),
    rewardSpin: z.enum(['none', ...WHEEL_KINDS] as ['none', WheelKind, ...WheelKind[]]),
    startsAt: zLocalDateTime,
    endsAt: zLocalDateTime,
    audience: z.enum(AUDIENCES as [MissionAudience, ...MissionAudience[]]),
    participantIds: z.array(z.string()),
    isActive: z.boolean(),
  })
  .refine((v) => v.targetValue > 0, { message: TARGET_REQUIRED, path: ['targetValue'] })
  .refine((v) => v.rewardPoints > 0 || v.rewardCoins > 0 || v.rewardSpin !== 'none', {
    message: REWARD_REQUIRED,
    path: ['rewardPoints'],
  })
  .refine((v) => v.targetKind === 'count' || AMOUNT_METRICS.includes(v.metric), {
    message: AMOUNT_METRIC_INVALID,
    path: ['targetKind'],
  })
  .refine((v) => v.audience === 'all' || v.participantIds.length > 0, {
    message: PARTICIPANTS_REQUIRED,
    path: ['participantIds'],
  })
  .refine((v) => v.endsAt > v.startsAt, { message: END_AFTER_START, path: ['endsAt'] })

export type MissionFormInput = z.input<typeof missionFormSchema>
export type MissionFormValues = z.output<typeof missionFormSchema>
