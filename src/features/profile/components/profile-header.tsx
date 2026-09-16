import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { PremiumCard } from '@/components/shared/premium-card'
import { formatNumber } from '@/lib/format'
import { JOB_TITLE_LABELS } from '@/lib/labels'
import type { BootstrapMe } from '@/lib/database.types'
import { profileHeadline, type ProfileNumbers } from '../profile-utils'

export interface ProfileHeaderProps {
  me: BootstrapMe
  numbers: ProfileNumbers
  companyName: string
  onEdit: () => void
}

/** Avatar, nome, badge nível, cargo · empresa, pontos, posição + botão "Editar perfil" (FEATURE §9). */
export function ProfileHeader({ me, numbers, companyName, onEdit }: ProfileHeaderProps) {
  return (
    <PremiumCard as="section" tone="green" glow padding="lg" aria-labelledby="profile-name">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={me.full_name} color={me.color} avatarPath={me.avatar_path} size="xl" ring />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="profile-name" className="break-safe text-2xl font-black tracking-tight text-text">
                {me.full_name}
              </h2>
              <Badge tone="green">Nível {formatNumber(numbers.level)}</Badge>
            </div>
            <p className="mt-1 text-sm font-semibold text-muted">
              {JOB_TITLE_LABELS[me.job_title]}
              {me.team ? ` · ${me.team}` : ''} · {companyName}
            </p>
            <p className="nums mt-1 text-sm font-black text-text-2">{profileHeadline(numbers)}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onEdit}
          className="self-start sm:self-center"
        >
          <Pencil aria-hidden="true" />
          Editar perfil
        </Button>
      </div>
    </PremiumCard>
  )
}
