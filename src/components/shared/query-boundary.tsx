import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { ErrorState } from './error-state'

export interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>
  skeleton: ReactNode
  empty?: { when: (data: T) => boolean; render: ReactNode }
  children: (data: T) => ReactNode
  compact?: boolean
}

/** Padroniza carregando / erro / vazio / dados em uma chamada (Definition of Done §7.2). */
export function QueryBoundary<T>({ query, skeleton, empty, children, compact }: QueryBoundaryProps<T>) {
  if (query.isPending) return <>{skeleton}</>
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} compact={compact ?? false} />
  const data = query.data as T
  if (empty && empty.when(data)) return <>{empty.render}</>
  return <>{children(data)}</>
}
