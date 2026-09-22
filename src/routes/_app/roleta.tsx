import { createFileRoute } from '@tanstack/react-router'
import { WheelPage } from '@/features/wheel/components/wheel-page'

/** /roleta — `WheelPage` (+ painéis da fila para admin). */
export const Route = createFileRoute('/_app/roleta')({
  component: WheelPage,
})
