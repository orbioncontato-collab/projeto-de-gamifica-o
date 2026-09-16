import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-hover', className)} aria-hidden="true" {...props} />
}

export { Skeleton }
