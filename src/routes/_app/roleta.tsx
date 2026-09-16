import { createFileRoute } from '@tanstack/react-router'
import { WheelPage } from '@/features/wheel/components/wheel-page'

/** /roleta — `WheelPage` (+ painéis da fila para admin) (WP4). */
export const Route = createFileRoute('/_app/roleta')({
  component: WheelPage,
})
