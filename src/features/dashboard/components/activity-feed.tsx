import type { ReactNode } from 'react'
import { Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { ListSkeleton } from '@/components/shared/skeletons'
import { formatRelative } from '@/lib/format'
import { feedSentence } from '@/lib/gamification'
import type { VActivityFeed } from '@/lib/database.types'
import { useActivityFeed, useFeedRealtime } from '../hooks'
import { mergeFeedPages } from '../dashboard-utils'

const AVATAR_FALLBACK = 'var(--avatar-fallback)'

function FeedItem({ row, tz }: { row: VActivityFeed; tz: string }) {
  const s = feedSentence(row)
  return (
    <li className="flex items-start gap-3">
      {row.full_name ? (
        <Avatar
          name={row.full_name}
          color={row.color ?? AVATAR_FALLBACK}
          avatarPath={row.avatar_path}
          size="sm"
        />
      ) : (
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface text-base"
          aria-hidden="true"
        >
          {s.icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="break-safe text-sm text-text-2">
          <span aria-hidden="true">{s.icon} </span>
          <span className="font-black text-text">{s.name}</span> {s.text}
        </p>
        <time dateTime={row.occurred_at} className="text-[11px] font-semibold text-muted">
          {formatRelative(row.occurred_at, Date.now(), tz)}
        </time>
      </div>
    </li>
  )
}

/** Feed do time com realtime (`feed_events`) e paginação por cursor (FEATURE §2 `ActivityFeed`). */
export function ActivityFeed({ tz }: { tz: string }) {
  useFeedRealtime()
  const query = useActivityFeed()
  const rows = mergeFeedPages(query.data?.pages)

  let body: ReactNode
  if (query.isPending) body = <ListSkeleton rows={5} />
  else if (query.isError)
    body = <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
  else if (rows.length === 0)
    body = (
      <EmptyState
        compact
        icon={Activity}
        title="Ainda não há atividade"
        description="As vendas e conquistas do time aparecem aqui."
        adminHint="Lance a primeira venda em Pontuação › Lançar."
      />
    )
  else
    body = (
      <>
        <ul className="flex flex-col gap-4" aria-label="Atividade do time">
          {rows.map((row) => (
            <FeedItem key={row.id} row={row} tz={tz} />
          ))}
        </ul>
        {query.hasNextPage ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4 w-full"
            loading={query.isFetchingNextPage}
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Carregar mais
          </Button>
        ) : null}
      </>
    )

  return (
    <PremiumCard as="section" aria-labelledby="activity-feed-title">
      <SectionHeader eyebrow="Time" title="Atividade recente" />
      <span id="activity-feed-title" className="sr-only">
        Atividade recente do time
      </span>
      <div className="mt-4">{body}</div>
    </PremiumCard>
  )
}
