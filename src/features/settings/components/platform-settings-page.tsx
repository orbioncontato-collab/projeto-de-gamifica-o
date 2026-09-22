import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { PageFrame } from '@/components/shared/page-frame'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { CardSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppSettings } from '../hooks'
import { CompanyForm } from './company-form'
import { BrandingForm } from './branding-form'
import { SeasonPanel } from './season-panel'
import { SpecialEventsPanel } from './special-events-panel'
import { TeamCodeCard } from './team-code-card'
import { MemberApprovalCard } from './member-approval-card'
import { MaintenanceCard } from './maintenance-card'
import { SetupChecklist } from './setup-checklist'

export type PlatformSettingsTab = 'geral' | 'marca' | 'temporadas' | 'eventos' | 'codigo'

export interface PlatformSettingsPageProps {
  tab: PlatformSettingsTab
}

const TABS: readonly PlatformSettingsTab[] = ['geral', 'marca', 'temporadas', 'eventos', 'codigo']

/** /admin/configuracoes — abas Geral / Marca / Temporadas / Eventos / Código (FEATURE-INVENTORY §13). */
export function PlatformSettingsPage({ tab }: PlatformSettingsPageProps) {
  const navigate = useNavigate()
  const settings = useAppSettings()
  const setTab = (value: string) => {
    const aba = TABS.includes(value as PlatformSettingsTab) ? (value as PlatformSettingsTab) : 'geral'
    void navigate({ to: '/admin/configuracoes', search: { aba } })
  }

  return (
    <PageFrame
      eyebrow="Administração"
      title="Configurações da plataforma"
      subtitle="Empresa, marca, temporadas, eventos especiais e entrada de novos membros."
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/guia">
            <BookOpen aria-hidden="true" /> Guia de uso
          </Link>
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Seções das configurações">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="marca">Marca</TabsTrigger>
          <TabsTrigger value="temporadas">Temporadas</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="codigo">Código</TabsTrigger>
        </TabsList>
        <TabsContent value="geral">
          <div className="space-y-4">
            <QueryBoundary query={settings} skeleton={<CardSkeleton lines={8} />}>
              {(data) => <CompanyForm settings={data} />}
            </QueryBoundary>
            <MaintenanceCard />
            <SetupChecklist />
          </div>
        </TabsContent>
        <TabsContent value="marca">
          <QueryBoundary query={settings} skeleton={<CardSkeleton lines={8} />}>
            {(data) => <BrandingForm settings={data} />}
          </QueryBoundary>
        </TabsContent>
        <TabsContent value="temporadas">
          <SeasonPanel />
        </TabsContent>
        <TabsContent value="eventos">
          <SpecialEventsPanel />
        </TabsContent>
        <TabsContent value="codigo">
          <div className="space-y-4">
            <TeamCodeCard />
            <QueryBoundary query={settings} skeleton={<CardSkeleton lines={4} />}>
              {(data) => <MemberApprovalCard settings={data} />}
            </QueryBoundary>
          </div>
        </TabsContent>
      </Tabs>
    </PageFrame>
  )
}
