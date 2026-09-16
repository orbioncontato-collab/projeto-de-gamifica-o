import { Sparkles } from 'lucide-react'
import { formatCoins, formatRelative } from '@/lib/format'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { ListSkeleton } from '@/components/shared/skeletons'
import { EmptyState } from '@/components/shared/empty-state'
import { useRecentCredits } from '../hooks'
import { creditTitle } from '../rewards-utils'

/** "Últimos créditos": valor, título (`reason ?? rule.name ?? source`) e data relativa. */
export function RecentCredits({ profileId }: { profileId?: string }) {
  const query = useRecentCredits(profileId)
  return (
    <PremiumCard as="section" padding="md">
      <SectionHeader eyebrow="Histórico" title="Últimos créditos" />
      <div className="mt-4">
        <QueryBoundary
          query={query}
          skeleton={<ListSkeleton rows={3} />}
          compact
          empty={{
            when: (rows) => rows.length === 0,
            render: (
              <EmptyState
                compact
                icon={Sparkles}
                title="Nenhum crédito ainda"
                description="Suas moedas de vendas, missões e metas aparecem aqui."
                adminHint="Lance a primeira venda em Administração › Pontuação para gerar moedas."
              />
            ),
          }}
        >
          {(rows) => (
            <ul className="divide-y divide-line" aria-label="Últimos créditos">
              {rows.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-text">{creditTitle(c)}</div>
                    <div className="text-[11px] text-muted">{formatRelative(c.occurred_at)}</div>
                  </div>
                  <span className="nums shrink-0 text-sm font-black text-accent">
                    +{formatCoins(c.coins)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </div>
    </PremiumCard>
  )
}
