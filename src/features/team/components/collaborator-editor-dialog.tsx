import { useEffect, useState } from 'react'
import { UserMinus, UserPlus } from 'lucide-react'
import type { VProfileStats } from '@/lib/database.types'
import { useZodForm } from '@/lib/forms'
import { notify } from '@/lib/notify'
import { isCode, RPC_MESSAGES } from '@/lib/rpc-errors'
import { useMe } from '@/features/auth/bootstrap-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useAdminUpdateProfile } from '../hooks'
import {
  collaboratorSchema,
  formToPatch,
  isEmptyPatch,
  profileToForm,
  type CollaboratorFormInput,
  type CollaboratorFormOutput,
} from '../schemas'
import { toggledStatus } from '../team-utils'
import { CollaboratorFormFields } from './collaborator-form-fields'
import { AdminAvatarUpload } from './admin-avatar-upload'
import { InitialPointsCard } from './initial-points-card'

export interface CollaboratorEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: VProfileStats | null
}

/**
 * Editor de colaborador (`?editar=`, FEATURE §11). O save do formulário NUNCA lança pontos: pontos iniciais
 * ficam no `InitialPointsCard`. Inativar/reativar é ação separada com `ConfirmDialog`; `LAST_ADMIN` tratado.
 */
export function CollaboratorEditorDialog({ open, onOpenChange, profile }: CollaboratorEditorDialogProps) {
  const { me } = useMe()
  const update = useAdminUpdateProfile()
  const [confirmStatus, setConfirmStatus] = useState(false)
  const form = useZodForm<CollaboratorFormInput, CollaboratorFormOutput>(
    collaboratorSchema,
    profile
      ? profileToForm(profile)
      : {
          full_name: '',
          email: '',
          job_title: 'closer',
          role: 'collaborator',
          status: 'active',
          team: '',
          phone: '',
          goal_amount: 0,
          notes: '',
        },
  )

  useEffect(() => {
    if (open && profile) form.reset(profileToForm(profile))
  }, [open, profile, form])

  if (!profile) return null

  const isSelf = profile.profile_id === me.id
  const isPending = profile.status === 'pending'
  const nextStatus = toggledStatus(profile.status)

  const onSubmit = form.handleSubmit(async (values) => {
    const patch = formToPatch(values, profile)
    if (isEmptyPatch(patch)) {
      notify.info('Nada para salvar')
      onOpenChange(false)
      return
    }
    // erro → toast do MutationCache (EMAIL_TAKEN, LAST_ADMIN…); o diálogo continua aberto para corrigir
    const saved = await update.mutateAsync({ profileId: profile.profile_id, patch }).then(
      () => true,
      (error: unknown) => {
        if (isCode(error, 'EMAIL_TAKEN'))
          form.setError('email', { message: RPC_MESSAGES['EMAIL_TAKEN'] ?? 'Este e-mail já está em uso.' })
        return false
      },
    )
    if (saved) {
      notify.success('Colaborador atualizado')
      onOpenChange(false)
    }
  })

  const changeStatus = async () => {
    await update.mutateAsync({ profileId: profile.profile_id, patch: { status: nextStatus } }).then(
      () => {
        notify.success(nextStatus === 'inactive' ? 'Colaborador inativado' : 'Colaborador reativado')
        onOpenChange(false)
      },
      () => undefined, // LAST_ADMIN / SPIN_PENDING → toast do MutationCache
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !update.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar colaborador</DialogTitle>
          <DialogDescription>
            Dados de cadastro de {profile.full_name}. Pontos são lançados separadamente, nunca por este
            formulário.
          </DialogDescription>
        </DialogHeader>
        <AdminAvatarUpload profile={profile} />
        <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4">
          <CollaboratorFormFields form={form} profile={profile} disabled={update.isPending} />
          <DialogFooter className="gap-2 sm:justify-between">
            {isPending ? (
              <span className="text-xs font-semibold text-muted">
                Aprove ou recuse este cadastro na seção Pendentes.
              </span>
            ) : (
              <Button
                type="button"
                variant={nextStatus === 'inactive' ? 'danger' : 'secondary'}
                disabled={update.isPending || (isSelf && nextStatus === 'inactive')}
                title={isSelf && nextStatus === 'inactive' ? 'Você não pode inativar a si mesmo' : undefined}
                onClick={() => setConfirmStatus(true)}
              >
                {nextStatus === 'inactive' ? (
                  <UserMinus aria-hidden="true" />
                ) : (
                  <UserPlus aria-hidden="true" />
                )}
                {nextStatus === 'inactive' ? 'Inativar' : 'Reativar'}
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={update.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={update.isPending}>
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </form>
        <InitialPointsCard profile={profile} />
        <ConfirmDialog
          open={confirmStatus}
          onOpenChange={setConfirmStatus}
          title={nextStatus === 'inactive' ? 'Inativar colaborador' : 'Reativar colaborador'}
          description={
            nextStatus === 'inactive'
              ? `${profile.full_name} perde o acesso, sai da fila da roleta e dos duelos ativos. O histórico é mantido.`
              : `${profile.full_name} volta a ter acesso e entra na temporada ativa com a meta padrão.`
          }
          confirmLabel={nextStatus === 'inactive' ? 'Inativar' : 'Reativar'}
          tone={nextStatus === 'inactive' ? 'danger' : 'primary'}
          loading={update.isPending}
          onConfirm={changeStatus}
        />
      </DialogContent>
    </Dialog>
  )
}
