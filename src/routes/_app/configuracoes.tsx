import { createFileRoute } from '@tanstack/react-router'
import { PreferencesPage } from '@/features/settings/components/preferences-page'

/** /configuracoes — `PreferencesPage` (preferências pessoais, todos) (WP7). */
export const Route = createFileRoute('/_app/configuracoes')({
  component: PreferencesPage,
})
