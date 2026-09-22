import { createFileRoute } from '@tanstack/react-router'
import {
  PlatformSettingsPage,
  type PlatformSettingsTab,
} from '@/features/settings/components/platform-settings-page'

export type { PlatformSettingsTab }
const TABS: readonly PlatformSettingsTab[] = ['geral', 'marca', 'temporadas', 'eventos', 'codigo']

/** /admin/configuracoes?aba=geral|marca|temporadas|eventos|codigo — `PlatformSettingsPage`. */
export const Route = createFileRoute('/_app/_admin/admin/configuracoes')({
  validateSearch: (s: Record<string, unknown>): { aba: PlatformSettingsTab } => ({
    aba: TABS.includes(s['aba'] as PlatformSettingsTab) ? (s['aba'] as PlatformSettingsTab) : 'geral',
  }),
  component: PlatformSettingsRoute,
})

function PlatformSettingsRoute() {
  const { aba } = Route.useSearch()
  return <PlatformSettingsPage tab={aba} />
}
