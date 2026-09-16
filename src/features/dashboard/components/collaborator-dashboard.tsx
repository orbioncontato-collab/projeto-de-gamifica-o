import type { ReactNode } from 'react'
import { PageFrame } from '@/components/shared/page-frame'
import { ErrorState } from '@/components/shared/error-state'
import { PageSkeleton } from '@/components/shared/skeletons'
import { Badge } from '@/components/shared/badge'
import { useMe } from '@/features/auth/bootstrap-query'
import { hasDashboard, type DashboardData, type VProfileStats } from '@/lib/database.types'
import { formatDaysLeft } from '@/lib/format'
import { useDashboard } from '../hooks'
import { NoSeasonState } from '@/components/shared/no-season-state'
import { LevelHero } from './level-hero'
import { StatCards } from './stat-cards'
import { SalesTarget } from './sales-target'
import { NextReward } from './next-reward'
import { RankingPreview } from './ranking-preview'
import { EventBanner } from './event-banner'
import { MissionPreview } from './mission-preview'
import { ActivityFeed } from './activity-feed'

/** `stats` pode vir null (perfil sem linha em v_profile_stats); cai para os números do bootstrap, zero em tudo. */
function fallbackStats(me: ReturnType<typeof useMe>['me'], data: DashboardData): VProfileStats {
  return {
    profile_id: me.id,
    season_id: data.season.id,
    full_name: me.full_name,
    avatar_path: me.avatar_path,
    color: me.color,
    job_title: me.job_title,
    team: me.team,
    role: me.role,
    status: me.status,
    email: me.email,
    phone: me.phone,
    season_name: data.season.name,
    season_starts_at: data.season.starts_at,
    season_ends_at: data.season.ends_at,
    season_is_active: data.season.is_active,
    points: me.points,
    points_earned: me.points_earned,
    sales_amount: me.sales_amount,
    sales_count: me.sales_count,
    meetings_scheduled: 0,
    meetings_held: me.meetings_held,
    calls: 0,
    crm_updates: 0,
    lead_recoveries: 0,
    upsells: 0,
    activities_count: 0,
    missions_completed: me.missions_completed,
    conversion_pct: me.conversion_pct,
    attendance_pct: null,
    goal_amount: me.goal_amount,
    goal_pct: null,
    goal_missing_amount: Math.max(me.goal_amount - me.sales_amount, 0),
    projected_goal_date: null,
    xp_per_level: me.xp_per_level,
    level: me.level,
    xp_in_level: me.xp_in_level,
    xp_to_next: me.xp_to_next,
    coins_balance: me.coins_balance,
    coins_earned_lifetime: 0,
    coins_spent_lifetime: 0,
    streak_days: me.streak_days,
    best_streak_days: 0,
    sales_amount_lifetime: 0,
    sales_count_lifetime: 0,
    rank: me.rank,
    gap_to_above: me.gap_to_above,
    is_tied_with_above: false,
    has_points: me.points > 0,
    achievements_unlocked: me.achievements_unlocked,
    achievements_total: 0,
    pending_earned_spins: me.pending_earned_spins,
    last_entry_at: null,
  }
}

/** Visão geral do colaborador (FEATURE §2). Sem temporada: `useDashboard` não consulta → `NoSeasonState`. */
export function CollaboratorDashboard() {
  const { me, season, settings } = useMe()
  const query = useDashboard()
  const tz = settings.timezone

  const seasonBadge = season ? (
    <Badge tone="green">{`${season.name} · ${formatDaysLeft(season.days_left)}`}</Badge>
  ) : null

  let body: ReactNode
  if (!season) body = <NoSeasonState />
  else if (query.isPending) body = <PageSkeleton />
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  else if (!hasDashboard(query.data)) body = <NoSeasonState />
  else {
    const data = query.data
    const stats = data.stats ?? fallbackStats(me, data)
    body = (
      <div className="flex flex-col gap-4 sm:gap-6">
        <LevelHero stats={stats} tz={tz} />
        <StatCards stats={stats} />
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <SalesTarget stats={stats} tz={tz} />
          <NextReward dashboard={data} />
        </div>
        <EventBanner event={data.active_event} tz={tz} />
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <RankingPreview rows={data.ranking_top} meId={me.id} />
          <MissionPreview missions={data.missions_today} />
        </div>
        <ActivityFeed tz={tz} />
      </div>
    )
  }

  return (
    <PageFrame
      eyebrow="Início"
      title="Visão geral"
      subtitle="Seu progresso na temporada"
      action={seasonBadge}
    >
      {body}
    </PageFrame>
  )
}
