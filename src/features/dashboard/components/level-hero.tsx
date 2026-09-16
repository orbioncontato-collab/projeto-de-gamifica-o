import { Rocket } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { PremiumCard } from '@/components/shared/premium-card'
import { Progress } from '@/components/shared/progress'
import { greeting } from '@/lib/gamification'
import { firstName } from '@/lib/format'
import type { VProfileStats } from '@/lib/database.types'
import { levelCopy, rankLine } from '../dashboard-utils'

export interface LevelHeroProps {
  stats: Pick<
    VProfileStats,
    | 'full_name'
    | 'color'
    | 'avatar_path'
    | 'level'
    | 'points'
    | 'xp_in_level'
    | 'xp_to_next'
    | 'xp_per_level'
    | 'rank'
    | 'gap_to_above'
    | 'is_tied_with_above'
  >
  tz: string
  now?: Date
}

/** Saudação + nível + barra XP (FEATURE §2 `LevelHero`); card verde com glow (Apêndice A). */
export function LevelHero({ stats, tz, now = new Date() }: LevelHeroProps) {
  const copy = levelCopy(stats)
  return (
    <PremiumCard as="section" tone="green" glow padding="lg" aria-labelledby="level-hero-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={stats.full_name} color={stats.color} avatarPath={stats.avatar_path} size="lg" ring />
          <div className="min-w-0">
            <div className="eyebrow">{greeting(now, tz)}</div>
            <h2
              id="level-hero-title"
              className="break-safe mt-1 text-2xl font-black tracking-tight text-text sm:text-3xl"
            >
              {firstName(stats.full_name)}
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted">{rankLine(stats)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <Badge tone="green">{copy.level}</Badge>
          <div className="nums text-3xl font-black tracking-tight text-text sm:text-4xl">{copy.points}</div>
        </div>
      </div>
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Progresso de XP
          </span>
          <span className="nums">{copy.remaining}</span>
        </div>
        <Progress
          value={copy.progressPct}
          tone="green"
          size="md"
          glow
          label="Progresso para o próximo nível"
        />
      </div>
    </PremiumCard>
  )
}
