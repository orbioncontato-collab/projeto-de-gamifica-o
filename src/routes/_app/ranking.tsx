import { createFileRoute } from '@tanstack/react-router'
import { RankingPage } from '@/features/ranking/components/ranking-page'

/** /ranking — `RankingPage`. */
export const Route = createFileRoute('/_app/ranking')({ component: RankingPage })
