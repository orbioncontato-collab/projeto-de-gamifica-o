import { createFileRoute } from '@tanstack/react-router'
import { GuidePage } from '@/features/guide/components/guide-page'

/** /admin/guia — `GuidePage`. */
export const Route = createFileRoute('/_app/_admin/admin/guia')({
  component: GuidePage,
})
