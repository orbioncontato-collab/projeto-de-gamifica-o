import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { formatCoins, formatNumber } from '@/lib/format'
import type { RewardRow } from '@/lib/database.types'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { CardSkeleton } from '@/components/shared/skeletons'
import { EmptyState } from '@/components/shared/empty-state'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useMe } from '@/features/auth/bootstrap-query'
import { useRedeemReward, useRewardsCatalog } from '../hooks'
import { RewardCard } from './reward-card'

function StoreSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <CardSkeleton key={i} lines={3} className="min-h-[180px]" />
      ))}
    </div>
  )
}

/** Loja: grid de cards + confirmação de resgate. Saldo vem do bootstrap (chip) — atualizado no `onSuccess`. */
export function StoreGrid() {
  const { me, isAdmin } = useMe()
  const query = useRewardsCatalog('store')
  const redeem = useRedeemReward()
  const [selected, setSelected] = useState<RewardRow | null>(null)
  const balance = me.coins_balance

  const confirm = async () => {
    if (!selected) return
    // MutationCache já mostra o toast do catálogo (INSUFFICIENT_COINS / OUT_OF_STOCK); o diálogo fecha nos dois casos
    await redeem.mutateAsync(selected.id).catch(() => undefined)
  }

  return (
    <>
      <QueryBoundary
        query={query}
        skeleton={<StoreSkeleton />}
        empty={{
          when: (rows) => rows.length === 0,
          render: (
            <EmptyState
              icon={ShoppingBag}
              title="A loja ainda está vazia"
              description="As recompensas cadastradas pelo gestor aparecem aqui para resgate com Orb Coins."
              adminHint="Cadastre a primeira recompensa em Administração › Recompensas › Catálogo."
              {...(isAdmin
                ? {
                    action: {
                      label: 'Cadastrar recompensa',
                      to: '/admin/recompensas',
                      search: { aba: 'catalogo', novo: true },
                    },
                  }
                : {})}
            />
          ),
        }}
      >
        {(rows) => (
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Loja de recompensas"
          >
            {rows.map((r) => (
              <li key={r.id}>
                <RewardCard
                  reward={r}
                  balance={balance}
                  onRedeem={setSelected}
                  busy={redeem.isPending && selected?.id === r.id}
                />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      <ConfirmDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !redeem.isPending) setSelected(null)
        }}
        title={selected ? `Resgatar ${selected.name}?` : 'Resgatar'}
        description={
          selected
            ? `Serão debitadas ${formatCoins(selected.cost_coins)} do seu saldo (${formatNumber(balance)} disponíveis). O pedido fica aguardando aprovação do gestor.`
            : ''
        }
        confirmLabel="Confirmar resgate"
        tone="primary"
        loading={redeem.isPending}
        onConfirm={confirm}
      />
    </>
  )
}
