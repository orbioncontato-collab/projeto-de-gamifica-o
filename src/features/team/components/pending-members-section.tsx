import { forwardRef, useState } from 'react'
import { Check, UserCheck, X } from 'lucide-react'
import type { PendingMember } from '@/lib/database.types'
import { formatRelative } from '@/lib/format'
import { usePendingMembers } from '@/features/profiles/hooks'
import { PremiumCard } from '@/components/shared/premium-card'
import { Avatar } from '@/components/shared/avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ListSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { useApproveMember, useRejectMember } from '../hooks'

export interface PendingMembersSectionProps {
  /** `?pendentes=true` — mostra a seção mesmo vazia (EmptyState "Nenhum cadastro aguardando") */
  forceVisible: boolean
}

/**
 * Seção "Pendentes" (FRONTEND-ARCH §6 WP6, DATA-MODEL §7.2): acima da tabela, visível só com ≥ 1 pedido
 * ou `?pendentes=true`. Funciona sem temporada ativa (`usePendingMembers` não depende de `season_id`).
 */
export const PendingMembersSection = forwardRef<HTMLElement, PendingMembersSectionProps>(
  function PendingMembersSection({ forceVisible }, ref) {
    const pending = usePendingMembers()
    const approve = useApproveMember()
    const reject = useRejectMember()
    const [rejecting, setRejecting] = useState<PendingMember | null>(null)

    const rows = pending.data ?? []
    const visible = forceVisible || rows.length > 0 || pending.isError
    if (!visible) return null

    const busyId = approve.isPending
      ? approve.variables?.profileId
      : reject.isPending
        ? reject.variables?.profileId
        : null

    return (
      <PremiumCard
        as="section"
        ref={ref}
        tone="gold"
        padding="md"
        aria-labelledby="pending-title"
        id="pendentes"
      >
        <div className="mb-3 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-gold" aria-hidden="true" />
          <h2 id="pending-title" className="text-base font-black tracking-tight text-text">
            Cadastros aguardando aprovação ({rows.length})
          </h2>
        </div>
        {pending.isPending ? (
          <ListSkeleton rows={2} />
        ) : pending.isError ? (
          <ErrorState error={pending.error} compact onRetry={() => void pending.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            compact
            title="Nenhum cadastro aguardando"
            description="Quando alguém se cadastrar com o código da equipe, o pedido aparece aqui."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={m.full_name} color={m.color} avatarPath={m.avatar_path} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-text">{m.full_name}</p>
                    <p className="truncate text-xs text-muted">
                      {m.profile_private?.email ?? 'e-mail indisponível'} · pediu{' '}
                      {formatRelative(m.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={approve.isPending && busyId === m.id}
                    disabled={busyId !== null && busyId !== undefined}
                    onClick={() => approve.mutate({ profileId: m.id, name: m.full_name })}
                  >
                    <Check aria-hidden="true" />
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={busyId !== null && busyId !== undefined}
                    onClick={() => setRejecting(m)}
                  >
                    <X aria-hidden="true" />
                    Recusar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ConfirmDialog
          open={rejecting !== null}
          onOpenChange={(o) => !o && !reject.isPending && setRejecting(null)}
          title="Recusar cadastro"
          description={`Recusar cadastro de ${rejecting?.full_name ?? ''}? Ele poderá ser aprovado depois na lista de inativos.`}
          confirmLabel="Recusar"
          tone="danger"
          loading={reject.isPending}
          onConfirm={async () => {
            if (!rejecting) return
            // erro → toast do MutationCache; o diálogo fecha em ambos os casos
            await reject.mutateAsync({ profileId: rejecting.id }).catch(() => undefined)
          }}
        />
      </PremiumCard>
    )
  },
)
