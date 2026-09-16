import { CalendarOff, Pencil } from 'lucide-react'
import { hasDashboard, type VProfileStats } from '@/lib/database.types'
import { JOB_TITLE_LABELS, USER_ROLE_LABELS } from '@/lib/labels'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'
import { StatusPill } from '@/components/shared/status-pill'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { CardSkeleton } from '@/components/shared/skeletons'
import { useCollaboratorDashboard } from '../hooks'
import { PROFILE_STATUS_PILL } from '../team-utils'
import { DetailMissions, DetailNextReward, DetailStatsGrid } from './collaborator-detail-sections'

export interface CollaboratorDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: VProfileStats | null
  onEdit: (profile: VProfileStats) => void
}

/** Visão individual do colaborador (`?perfil=`, FEATURE §2b/§11): stats da temporada + missões/próxima recompensa. */
export function CollaboratorDetailDialog({
  open,
  onOpenChange,
  profile,
  onEdit,
}: CollaboratorDetailDialogProps) {
  const dash = useCollaboratorDashboard(open && profile ? profile.profile_id : null)
  if (!profile) return null
  const isActive = profile.status === 'active'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar
              name={profile.full_name}
              color={profile.color}
              avatarPath={profile.avatar_path}
              size="lg"
              ring
            />
            <div className="min-w-0">
              <DialogTitle className="truncate">{profile.full_name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <span>
                  {JOB_TITLE_LABELS[profile.job_title]} · {USER_ROLE_LABELS[profile.role]}
                  {profile.team ? ` · ${profile.team}` : ''}
                </span>
                <StatusPill status={profile.status} map={PROFILE_STATUS_PILL} />
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DetailStatsGrid p={profile} />
        {!isActive ? (
          <EmptyState
            icon={CalendarOff}
            compact
            title={profile.status === 'pending' ? 'Cadastro aguardando aprovação' : 'Perfil inativo'}
            description={
              profile.status === 'pending'
                ? 'Aprove ou recuse na seção Pendentes; missões e recompensas aparecem depois.'
                : 'Sem acesso à plataforma. Reative pelo editor para voltar à temporada.'
            }
          />
        ) : dash.isPending ? (
          <CardSkeleton lines={3} />
        ) : dash.isError ? (
          <ErrorState error={dash.error} compact onRetry={() => void dash.refetch()} />
        ) : dash.data && hasDashboard(dash.data) ? (
          <div className="space-y-3">
            <DetailNextReward dash={dash.data} />
            <DetailMissions dash={dash.data} />
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" variant="primary" onClick={() => onEdit(profile)}>
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
