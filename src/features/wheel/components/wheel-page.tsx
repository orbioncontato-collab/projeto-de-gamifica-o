import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import type { WheelKind, WheelSpinRow } from '@/lib/database.types'
import { qk } from '@/lib/query-keys'
import { notify } from '@/lib/notify'
import { useMe } from '@/features/auth/bootstrap-query'
import { PageFrame } from '@/components/shared/page-frame'
import { PremiumCard } from '@/components/shared/premium-card'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { WheelSkeleton } from '@/components/shared/skeletons'
import { getWheelConfig, type WheelConfig } from '../api'
import {
  useApproveSpin,
  useRejectSpin,
  useSpinWheel,
  useSpinWheelFree,
  useWheelConfig,
  useWheelRealtime,
  useWheelState,
} from '../hooks'
import { resolveSectorIndex } from '../spin-engine'
import {
  useSpinController,
  viewFromPayload,
  viewFromPendingQueue,
  viewFromSpinRow,
  type SpinResultView,
} from '../spin-controller'
import { MIN_PRIZES } from '../schemas'
import { maskWhileSpinning } from '../wheel-logic'
import { Confetti } from './confetti'
import { QueuePanel } from './queue-panel'
import { QueueQuickPanel } from './queue-quick-panel'
import { SpinButton } from './spin-button'
import { SpinResultDialog } from './spin-result-dialog'
import { Wheel } from './wheel'
import { WheelContextBanner } from './wheel-context-banner'
import { WheelHistory } from './wheel-history'
import { WheelSelector } from './wheel-selector'
import { WheelStatusPill } from './wheel-status-pill'
import '../wheel.css'

/** Erros de mutation já viram toast no MutationCache global; aqui só evitamos unhandled rejection. */
const swallow = (): undefined => undefined

const kindOfWheelId = (config: WheelConfig | undefined, wheelId: string): WheelKind | null => {
  if (!config) return null
  if (config.classic.wheel.id === wheelId) return 'classic'
  if (config.premium.wheel.id === wheelId) return 'premium'
  return null
}

export function WheelPage() {
  const { isAdmin, settings } = useMe()
  const qc = useQueryClient()
  const config = useWheelConfig()
  const [selectedKind, setSelectedKind] = useState<WheelKind>('classic')
  const { queueQuery, ...rawState } = useWheelState(selectedKind)
  const controller = useSpinController()
  const state = maskWhileSpinning(rawState, controller.spinning)
  const locked = state.mode !== 'free'
  const kind: WheelKind = locked ? state.wheelKind : selectedKind
  const prizes = config.data?.[kind].prizes ?? []
  const queueCount = queueQuery.data?.length ?? 0

  const spin = useSpinWheel()
  const spinFree = useSpinWheelFree()
  const approve = useApproveSpin()
  const reject = useRejectSpin()
  const [result, setResult] = useState<SpinResultView | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [burst, setBurst] = useState<number | null>(null)

  const landed = useCallback(
    (view: SpinResultView) => {
      setResult(view)
      setDialogOpen(true)
      setBurst(Date.now())
      if (!view.isFree) {
        void qc.invalidateQueries({ queryKey: qk.wheel.queue() })
        void qc.invalidateQueries({ queryKey: qk.bootstrap() })
      }
    },
    [qc],
  )

  /** Localiza o setor por `prize.id`; se não achar ou a contagem divergir, recarrega os prêmios antes de animar. */
  const animateTo = useCallback(
    async (wheelKind: WheelKind, prizeId: string, sectorCount: number, view: SpinResultView) => {
      let list = config.data?.[wheelKind].prizes ?? []
      let index = resolveSectorIndex(list, prizeId)
      if (index === null || sectorCount !== list.length) {
        const fresh = await qc.fetchQuery({
          queryKey: qk.wheel.config(),
          queryFn: getWheelConfig,
          staleTime: 0,
        })
        list = fresh[wheelKind].prizes
        index = resolveSectorIndex(list, prizeId)
      }
      if (index === null) {
        notify.warning('Os prêmios mudaram durante o sorteio.', 'O resultado vale; a roda não pôde animar.')
        landed(view)
        return
      }
      if (!controller.spinTo(index, list.length, () => landed(view))) landed(view)
    },
    [config.data, controller, qc, landed],
  )

  useWheelRealtime({
    onRemoteSpin: (row: WheelSpinRow) => {
      const remoteKind = kindOfWheelId(config.data, row.wheel_id)
      if (!remoteKind) return
      setSelectedKind(remoteKind)
      const attemptsAllowed =
        queueQuery.data?.find((q) => q.queue_id === row.queue_id)?.attempts_allowed ?? null
      const count = config.data?.[remoteKind].prizes.length ?? 0
      void animateTo(
        remoteKind,
        row.prize_id,
        count,
        viewFromSpinRow(row, remoteKind, attemptsAllowed),
      ).catch(swallow)
    },
  })

  const onSpin = async () => {
    if (controller.spinning) return
    controller.reset()
    if (state.mode === 'turn' && state.active) {
      const payload = await spin.mutateAsync(state.active.queue_id)
      await animateTo(payload.wheel_kind, payload.prize.id, payload.sector_count, viewFromPayload(payload))
      return
    }
    const payload = await spinFree.mutateAsync(kind)
    await animateTo(payload.wheel_kind, payload.prize.id, payload.sector_count, viewFromPayload(payload))
  }

  const onViewPrize = () => {
    if (!state.active) return
    const view = viewFromPendingQueue(state.active)
    if (!view) return
    setResult(view)
    setDialogOpen(true)
  }

  const closeDialog = (open: boolean) => {
    setDialogOpen(open)
    if (!open) controller.reset()
  }
  const onApprove = async (spinId: string) => {
    await approve.mutateAsync(spinId)
    closeDialog(false)
  }
  const onReject = async (spinId: string) => {
    await reject.mutateAsync(spinId)
    closeDialog(false)
  }

  const prizeCounts: Record<WheelKind, number> = {
    classic: config.data?.classic.prizes.length ?? 0,
    premium: config.data?.premium.prizes.length ?? 0,
  }
  const tooFewPrizes = config.isSuccess && prizes.length < MIN_PRIZES
  const disabledReason = config.isError
    ? 'Roleta indisponível'
    : tooFewPrizes
      ? 'Roleta sem prêmios suficientes'
      : null

  return (
    <PageFrame
      eyebrow="Prêmios"
      title="Roleta"
      subtitle={
        isAdmin ? 'Libere giros pela fila e aprove os prêmios.' : 'Gire quando o gestor liberar a sua vez.'
      }
    >
      <div className="flex flex-col gap-5">
        {isAdmin ? <QueueQuickPanel wheelKind={kind} queueCount={queueCount} /> : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <PremiumCard
            as="section"
            className="wheel-panel flex flex-col items-center gap-5"
            data-kind={kind}
            aria-label="Roleta"
          >
            <WheelSelector
              value={kind}
              onChange={setSelectedKind}
              locked={locked}
              prizeCounts={prizeCounts}
            />
            {config.isPending ? (
              <WheelSkeleton />
            ) : config.isError ? (
              <ErrorState error={config.error} onRetry={() => void config.refetch()} compact />
            ) : tooFewPrizes ? (
              <EmptyState
                compact
                icon={AlertTriangle}
                title="Roleta sem prêmios suficientes"
                description={`Esta roleta precisa de pelo menos ${MIN_PRIZES} prêmios ativos.`}
                adminHint="Cadastre os prêmios em Administração › Roleta."
                {...(isAdmin ? { action: { label: 'Editar prêmios', to: '/admin/roleta' as const } } : {})}
              />
            ) : (
              <Wheel
                kind={kind}
                prizes={prizes}
                rotation={controller.rotation}
                spinning={controller.spinning}
                winnerIndex={controller.winnerIndex}
              />
            )}
            <WheelStatusPill state={state} />
            <SpinButton
              state={state}
              spinning={controller.spinning}
              loading={spin.isPending || spinFree.isPending}
              isAdmin={isAdmin}
              disabledReason={disabledReason}
              onSpin={() => void onSpin().catch(swallow)}
              onViewPrize={onViewPrize}
            />
            <div className="w-full">
              {queueQuery.isError ? (
                <ErrorState error={queueQuery.error} onRetry={() => void queueQuery.refetch()} compact />
              ) : (
                <WheelContextBanner state={state} isAdmin={isAdmin} timezone={settings.timezone} />
              )}
            </div>
          </PremiumCard>
          <WheelHistory timezone={settings.timezone} />
        </div>

        {isAdmin ? <QueuePanel wheelKind={kind} queueCount={queueCount} /> : null}
      </div>

      <SpinResultDialog
        result={result}
        open={dialogOpen}
        onOpenChange={closeDialog}
        isAdmin={isAdmin}
        approving={approve.isPending}
        rejecting={reject.isPending}
        onApprove={(id) => void onApprove(id).catch(swallow)}
        onReject={(id) => void onReject(id).catch(swallow)}
      />
      <Confetti burstKey={burst} />
    </PageFrame>
  )
}
