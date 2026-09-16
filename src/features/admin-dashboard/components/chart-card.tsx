import type { ReactNode } from 'react'
import { BarChart3 } from 'lucide-react'
import { PremiumCard } from '@/components/shared/premium-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { CHART_HEIGHT } from '../chart-theme'

export interface ChartCardProps {
  eyebrow: string
  title: string
  /** `false` → EmptyState no lugar do gráfico (nunca gráfico em branco) */
  hasData: boolean
  emptyTitle?: string
  children: ReactNode
}

const EMPTY_DESCRIPTION = 'Sem lançamentos na temporada — lance a primeira venda.'

/** Moldura padrão dos 3 gráficos: cabeçalho + área de altura fixa (mesma do skeleton). */
export function ChartCard({
  eyebrow,
  title,
  hasData,
  emptyTitle = 'Nada para mostrar ainda',
  children,
}: ChartCardProps) {
  return (
    <PremiumCard as="section" padding="md" aria-label={title}>
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-2">{eyebrow}</p>
        <h3 className="text-base font-black tracking-tight text-text">{title}</h3>
      </div>
      <div style={{ minHeight: CHART_HEIGHT }} className="flex flex-col justify-center">
        {hasData ? (
          children
        ) : (
          <EmptyState
            icon={BarChart3}
            compact
            title={emptyTitle}
            description={EMPTY_DESCRIPTION}
            adminHint="Lance pontos em Administração › Pontuação para alimentar os gráficos."
          />
        )}
      </div>
    </PremiumCard>
  )
}

export function ChartCardSkeleton({ title }: { title: string }) {
  return (
    <PremiumCard as="section" padding="md" aria-label={`${title} — carregando`}>
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-4 h-5 w-48" />
      <Skeleton style={{ height: CHART_HEIGHT }} className="w-full rounded-2xl" />
    </PremiumCard>
  )
}
