import { useState } from 'react'
import { PageFrame } from '@/components/shared/page-frame'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { ErrorState } from '@/components/shared/error-state'
import { CardSkeleton } from '@/components/shared/skeletons'
import { AchievementsMiniGrid } from '@/components/shared/achievements-mini-grid'
import { useMe } from '@/features/auth/bootstrap-query'
import { useProfileStat } from '@/features/profiles/hooks'
import { NoSeasonState } from '@/components/shared/no-season-state'
import { profileNumbers } from '../profile-utils'
import { ProfileHeader } from './profile-header'
import { ProfileStats } from './profile-stats'
import { EditProfileDialog } from './edit-profile-dialog'

/**
 * /perfil (FEATURE §9): cabeçalho, 4 stats, mini-grid de conquistas (`AchievementsMiniGrid` de components/shared),
 * "Editar perfil". Sem temporada os números vêm do bootstrap e a seção de stats mostra "Sem temporada ativa".
 */
export function ProfilePage() {
  const { me, settings, seasonId } = useMe()
  const statQuery = useProfileStat(me.id, seasonId)
  const [editing, setEditing] = useState(false)
  const numbers = profileNumbers(statQuery.data, me)

  return (
    <PageFrame eyebrow="Conta" title="Perfil" subtitle="Seus dados e sua trajetória na temporada">
      <div className="flex flex-col gap-4 sm:gap-6">
        <ProfileHeader
          me={me}
          numbers={numbers}
          companyName={settings.company_name}
          onEdit={() => setEditing(true)}
        />
        {!seasonId ? (
          <NoSeasonState compact />
        ) : statQuery.isPending ? (
          <CardSkeleton lines={2} />
        ) : statQuery.isError ? (
          <ErrorState error={statQuery.error} onRetry={() => void statQuery.refetch()} compact />
        ) : (
          <ProfileStats numbers={numbers} />
        )}
        <PremiumCard as="section" aria-label="Conquistas">
          <SectionHeader eyebrow="Trajetória" title="Conquistas" />
          <div className="mt-4">
            <AchievementsMiniGrid profileId={me.id} />
          </div>
        </PremiumCard>
      </div>
      <EditProfileDialog open={editing} onOpenChange={setEditing} />
    </PageFrame>
  )
}
