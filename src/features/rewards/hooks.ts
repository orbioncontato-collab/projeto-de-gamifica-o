import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { qk, invalidateAfterLedgerChange } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import type {
  BootstrapPayload,
  RedeemPayload,
  RedemptionStatus,
  RewardInsert,
  RewardRedemptionRow,
  RewardRow,
  VRedemption,
  VWallet,
} from '@/lib/database.types'
import { useMe } from '@/features/auth/bootstrap-query'
import {
  deleteReward,
  getMyRedemptions,
  getRecentCredits,
  getRedemptionsAdmin,
  getRewardsCatalog,
  getWallet,
  handleRedemption,
  redeemReward,
  saveReward,
  RECENT_CREDITS_LIMIT,
  type CatalogScope,
  type RecentCredit,
  type RedemptionAction,
} from './api'
import { REDEMPTION_ACTION_DONE } from './rewards-utils'

/** Hooks de Recompensas (FRONTEND-ARCH §4.5 features/rewards). Erros de mutation: MutationCache → notify.error. */

export function useWallet(profileId?: string): UseQueryResult<VWallet | null> {
  const { me } = useMe()
  const id = profileId ?? me.id
  return useQuery({ queryKey: qk.rewards.wallet(id), queryFn: () => getWallet(id), enabled: !!id })
}

export function useRecentCredits(
  profileId?: string,
  limit = RECENT_CREDITS_LIMIT,
): UseQueryResult<RecentCredit[]> {
  const { me } = useMe()
  const id = profileId ?? me.id
  return useQuery({
    queryKey: [...qk.rewards.credits(id), limit] as const,
    queryFn: () => getRecentCredits(id, limit),
    enabled: !!id,
  })
}

export function useRewardsCatalog(scope: CatalogScope): UseQueryResult<RewardRow[]> {
  return useQuery({ queryKey: qk.rewards.catalog(scope), queryFn: () => getRewardsCatalog(scope) })
}

export function useMyRedemptions(): UseQueryResult<VRedemption[]> {
  return useQuery({ queryKey: qk.rewards.redemptions('mine', null), queryFn: getMyRedemptions })
}

export function useRedemptionsAdmin(status: RedemptionStatus | null): UseQueryResult<VRedemption[]> {
  const { isAdmin } = useMe()
  return useQuery({
    queryKey: qk.rewards.redemptions('admin', status),
    queryFn: () => getRedemptionsAdmin(status),
    enabled: isAdmin,
  })
}

/** Resgate: atualiza o chip de moedas do bootstrap na hora e invalida rewards/bootstrap/ledger. */
export function useRedeemReward(): UseMutationResult<RedeemPayload, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: redeemReward,
    onSuccess: async (payload) => {
      qc.setQueryData<BootstrapPayload>(qk.bootstrap(), (prev) =>
        prev ? { ...prev, me: { ...prev.me, coins_balance: payload.coins_balance } } : prev,
      )
      notify.success('Pedido enviado', 'O gestor vai aprovar e entregar sua recompensa.')
      await invalidateAfterLedgerChange(qc)
    },
  })
}

export function useHandleRedemption(): UseMutationResult<
  RewardRedemptionRow,
  Error,
  { id: string; action: RedemptionAction; notes?: string | null }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handleRedemption,
    onSuccess: async (_row, vars) => {
      notify.success(REDEMPTION_ACTION_DONE[vars.action])
      await invalidateAfterLedgerChange(qc)
    },
  })
}

export function useSaveReward(): UseMutationResult<RewardRow, Error, RewardInsert & { id?: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveReward,
    onSuccess: async (_row, vars) => {
      notify.success(vars.id ? 'Recompensa atualizada' : 'Recompensa cadastrada')
      await qc.invalidateQueries({ queryKey: qk.rewards.all() })
    },
  })
}

export function useDeleteReward(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteReward,
    onSuccess: async () => {
      notify.success('Recompensa excluída')
      await qc.invalidateQueries({ queryKey: qk.rewards.all() })
    },
  })
}
