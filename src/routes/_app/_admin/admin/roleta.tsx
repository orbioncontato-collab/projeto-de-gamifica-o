import { createFileRoute } from '@tanstack/react-router'
import { PrizeEditor } from '@/features/wheel/components/prize-editor'

/** /admin/roleta — `PrizeEditor` (WP4). */
export const Route = createFileRoute('/_app/_admin/admin/roleta')({
  component: PrizeEditor,
})
