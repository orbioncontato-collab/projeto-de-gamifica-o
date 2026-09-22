import { createFileRoute } from '@tanstack/react-router'
import { AchievementsPage } from '@/features/achievements/components/achievements-page'

/** /conquistas — `AchievementsPage`. */
export const Route = createFileRoute('/_app/conquistas')({
  component: AchievementsPage,
})
