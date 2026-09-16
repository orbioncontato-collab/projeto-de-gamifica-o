import { useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { useZodForm } from '@/lib/forms'
import type { RewardRow } from '@/lib/database.types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormField } from '@/components/shared/form-field'
import { MoneyInput } from '@/components/shared/money-input'
import { useSaveReward } from '../hooks'
import {
  formToRewardInsert,
  rewardSchema,
  rewardToForm,
  REWARD_FORM_DEFAULTS,
  type RewardFormInput,
  type RewardFormOutput,
} from '../schemas'

export interface RewardEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = cadastrar nova */
  reward: RewardRow | null
}

/** "Cadastrar recompensa" (FEATURE §7): nome, categoria, valor, custo, estoque, ícone, ativo, ordem. */
export function RewardEditorDialog({ open, onOpenChange, reward }: RewardEditorDialogProps) {
  const save = useSaveReward()
  const form = useZodForm<RewardFormInput, RewardFormOutput>(
    rewardSchema,
    reward ? rewardToForm(reward) : REWARD_FORM_DEFAULTS,
  )
  const { errors } = form.formState

  useEffect(() => {
    if (open) form.reset(reward ? rewardToForm(reward) : REWARD_FORM_DEFAULTS)
  }, [open, reward, form])

  const onSubmit = form.handleSubmit(async (values) => {
    // erro → toast do MutationCache; o diálogo continua aberto para corrigir
    const saved = await save.mutateAsync(formToRewardInsert(values, reward?.id)).then(
      () => true,
      () => false,
    )
    if (saved) onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !save.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reward ? 'Editar recompensa' : 'Cadastrar recompensa'}</DialogTitle>
          <DialogDescription>
            O custo em moedas é descontado no resgate; o estoque vazio significa ilimitado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
            <FormField label="Ícone" htmlFor="reward-icon" error={errors.icon?.message} hint="Emoji">
              <Input
                id="reward-icon"
                maxLength={40}
                className="text-center text-xl"
                {...form.register('icon')}
              />
            </FormField>
            <FormField label="Nome" htmlFor="reward-name" error={errors.name?.message} required>
              <Input id="reward-name" maxLength={60} autoFocus {...form.register('name')} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Categoria"
              htmlFor="reward-category"
              error={errors.category?.message}
              hint="Voucher, PIX, Benefício…"
            >
              <Input id="reward-category" maxLength={40} {...form.register('category')} />
            </FormField>
            <FormField
              label="Valor equivalente (R$)"
              htmlFor="reward-value"
              error={errors.value_amount?.message}
              hint="Opcional — entra em “Recompensas entregues”"
            >
              <Controller
                control={form.control}
                name="value_amount"
                render={({ field }) => (
                  <MoneyInput
                    id="reward-value"
                    value={typeof field.value === 'number' ? field.value : null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputMode="decimal"
                  />
                )}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              label="Custo em moedas"
              htmlFor="reward-cost"
              error={errors.cost_coins?.message}
              required
            >
              <Input
                id="reward-cost"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                {...form.register('cost_coins')}
              />
            </FormField>
            <FormField
              label="Quantidade disponível"
              htmlFor="reward-stock"
              error={errors.stock?.message}
              hint="Vazio = ilimitado"
            >
              <Input
                id="reward-stock"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                {...form.register('stock')}
              />
            </FormField>
            <FormField label="Ordem" htmlFor="reward-order" error={errors.sort_order?.message}>
              <Input
                id="reward-order"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                {...form.register('sort_order')}
              />
            </FormField>
          </div>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2">
                <span className="text-sm font-semibold text-text">
                  Ativa na loja
                  <span className="block text-xs font-normal text-muted">
                    Inativa fica só no catálogo do gestor.
                  </span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Ativa na loja" />
              </label>
            )}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {reward ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
