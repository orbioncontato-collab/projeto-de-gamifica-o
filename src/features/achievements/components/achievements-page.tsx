import { Medal } from 'lucide-react'
import { PageFrame } from '@/components/shared/page-frame'
import { Progress } from '@/components/shared/progress'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { CardSkeleton } from '@/components/shared/skeletons'
import { EmptyState } from '@/components/shared/empty-state'
import { useMe } from '@/features/auth/bootstrap-query'
import { useAchievementBoard } from '@/features/profiles/hooks'
import { achievementCounter } from '../achievements-utils'
import { AchievementCard } from './achievement-card'

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <CardSkeleton key={i} lines={3} className="min-h-[170px]" />
      ))}
    </div>
  )
}

/** /conquistas — grade de conquistas + contador "N de M" (FEATURE §8), via `useAchievementBoard` de profiles. */
export function AchievementsPage() {
  const { settings } = useMe()
  const query = useAchievementBoard()
  return (
    <PageFrame
      eyebrow="Progresso"
      title="Conquistas"
      subtitle="Troféus desbloqueados automaticamente pelas suas vendas, missões e metas."
    >
      <QueryBoundary
        query={query}
        skeleton={<GridSkeleton />}
        empty={{
          when: (rows) => rows.length === 0,
          render: (
            <EmptyState
              icon={Medal}
              title="Nenhuma conquista cadastrada"
              description="As conquistas aparecem aqui quando o catálogo estiver ativo."
              adminHint="O catálogo padrão traz 6 conquistas — confira o seed em Administração › Guia."
            />
          ),
        }}
      >
        {(rows) => {
          const counter = achievementCounter(rows)
          const pct = counter.total > 0 ? (counter.unlocked / counter.total) * 100 : 0
          return (
            <>
              <section className="premium-card mb-5 p-5" aria-label="Resumo de conquistas">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="eyebrow" data-tone="muted">
                      Seu progresso
                    </div>
                    <div
                      className="mt-1 text-2xl font-black tracking-tight text-text"
                      data-testid="achievements-counter"
                    >
                      <span className="text-gold">{counter.unlocked}</span> de {counter.total}{' '}
                      <span className="text-base font-bold text-muted">{counter.noun}</span>
                    </div>
                  </div>
                  <Medal className="h-8 w-8 text-gold" aria-hidden="true" />
                </div>
                <Progress
                  value={pct}
                  tone="gold"
                  size="md"
                  glow
                  className="mt-4"
                  label="Conquistas desbloqueadas"
                />
              </section>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Conquistas">
                {rows.map((a) => (
                  <li key={a.achievement_id}>
                    <AchievementCard achievement={a} tz={settings.timezone} />
                  </li>
                ))}
              </ul>
            </>
          )
        }}
      </QueryBoundary>
    </PageFrame>
  )
}
