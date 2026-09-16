import { useState } from 'react'
import { Ban, Flag, Pencil, Play } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { VChallengeBoard } from '@/lib/database.types'
import { useActivateChallenge, useCancelChallenge, useFinishChallenge } from '../hooks'

type PendingAction = 'activate' | 'finish' | 'cancel' | null

interface ChallengeActionsProps {
  challenge: VChallengeBoard
  onEdit: (challenge: VChallengeBoard) => void
}

/** Ações por status: draft → Editar/Ativar/Cancelar; active → Finalizar/Cancelar; finished/cancelled → nenhuma. */
export function ChallengeActions({ challenge, onEdit }: ChallengeActionsProps) {
  const activate = useActivateChallenge()
  const finish = useFinishChallenge()
  const cancel = useCancelChallenge()
  const [pending, setPending] = useState<PendingAction>(null)
  const busy = activate.isPending || finish.isPending || cancel.isPending
  const { status } = challenge

  if (status === 'finished' || status === 'cancelled') return null

  const confirm = async () => {
    if (pending === 'activate') await activate.mutateAsync(challenge.challenge_id)
    else if (pending === 'finish') await finish.mutateAsync(challenge.challenge_id)
    else if (pending === 'cancel') await cancel.mutateAsync({ id: challenge.challenge_id })
    setPending(null)
  }

  const copy = {
    activate: {
      title: 'Ativar desafio?',
      description: `"${challenge.name}" passa a contar os lançamentos do período e os participantes são avisados. Depois de ativo não dá mais para editar.`,
      confirmLabel: 'Ativar',
      tone: 'primary' as const,
    },
    finish: {
      title: 'Finalizar desafio?',
      description: `Encerra "${challenge.name}" agora e credita o prêmio a quem venceu. Não dá para desfazer.`,
      confirmLabel: 'Finalizar',
      tone: 'primary' as const,
    },
    cancel: {
      title: 'Cancelar desafio?',
      description: `"${challenge.name}" é cancelado sem creditar nada. Os participantes são avisados.`,
      confirmLabel: 'Cancelar desafio',
      tone: 'danger' as const,
    },
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'draft' ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onEdit(challenge)}
            disabled={busy}
          >
            <Pencil aria-hidden="true" />
            Editar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setPending('activate')}
            disabled={busy}
            loading={activate.isPending}
          >
            <Play aria-hidden="true" />
            Ativar
          </Button>
        </>
      ) : null}
      {status === 'active' ? (
        <Button
          type="button"
          variant="gold"
          size="sm"
          onClick={() => setPending('finish')}
          disabled={busy}
          loading={finish.isPending}
        >
          <Flag aria-hidden="true" />
          Finalizar
        </Button>
      ) : null}
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => setPending('cancel')}
        disabled={busy}
        loading={cancel.isPending}
      >
        <Ban aria-hidden="true" />
        Cancelar
      </Button>
      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setPending(null))}
          title={copy[pending].title}
          description={copy[pending].description}
          confirmLabel={copy[pending].confirmLabel}
          cancelLabel="Voltar"
          tone={copy[pending].tone}
          loading={busy}
          onConfirm={confirm}
        />
      ) : null}
    </div>
  )
}
