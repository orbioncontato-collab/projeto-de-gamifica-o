import { z } from 'zod'
import { zInt, zMoneyOptional, zText, zTextOptional } from '@/lib/forms'
import type { RewardInsert, RewardRow } from '@/lib/database.types'

/** Formulário do catálogo (admin): limites iguais aos CKs de `rewards` (DATA-MODEL §4.25). */
export const REWARD_NAME_MAX = 60
export const REWARD_CATEGORY_MAX = 40
export const REWARD_ICON_MAX = 40
export const REWARD_COST_MIN = 1
export const REWARD_COST_MAX = 1_000_000
export const REWARD_STOCK_MAX = 1_000_000

/** `<input type="number">` vazio = ilimitado (NULL). */
const zStockOptional = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  zInt(0, REWARD_STOCK_MAX).nullable(),
)

export const rewardSchema = z.object({
  name: zText(REWARD_NAME_MAX),
  category: zTextOptional(REWARD_CATEGORY_MAX),
  value_amount: zMoneyOptional,
  cost_coins: zInt(REWARD_COST_MIN, REWARD_COST_MAX),
  stock: zStockOptional,
  icon: zTextOptional(REWARD_ICON_MAX),
  is_active: z.boolean(),
  sort_order: zInt(0, 100_000),
})

export type RewardFormInput = z.input<typeof rewardSchema>
export type RewardFormOutput = z.output<typeof rewardSchema>

export const REWARD_FORM_DEFAULTS: RewardFormInput = {
  name: '',
  category: '',
  value_amount: '',
  cost_coins: 500,
  stock: '',
  icon: '🎁',
  is_active: true,
  sort_order: 0,
}

export function rewardToForm(reward: RewardRow): RewardFormInput {
  return {
    name: reward.name,
    category: reward.category ?? '',
    value_amount: reward.value_amount ?? '',
    cost_coins: reward.cost_coins,
    stock: reward.stock ?? '',
    icon: reward.icon ?? '',
    is_active: reward.is_active,
    sort_order: reward.sort_order,
  }
}

/** Saída validada → payload do upsert (`id` só na edição). */
export function formToRewardInsert(values: RewardFormOutput, id?: string): RewardInsert & { id?: string } {
  return {
    ...(id ? { id } : {}),
    name: values.name,
    category: values.category,
    value_amount: values.value_amount,
    cost_coins: values.cost_coins,
    stock: values.stock,
    icon: values.icon,
    is_active: values.is_active,
    sort_order: values.sort_order,
  }
}
