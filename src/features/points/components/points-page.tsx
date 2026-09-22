import { useNavigate } from '@tanstack/react-router'
import { PageFrame } from '@/components/shared/page-frame'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RulesList } from './rules-list'
import { RecordEntryForm } from './record-entry-form'
import { ManualEntryForm } from './manual-entry-form'
import { EntriesHistoryTable } from './entries-history-table'

export type PointsTab = 'regras' | 'lancar' | 'historico'

export interface PointsPageProps {
  tab: PointsTab
  /** `?perfil=` — pré-seleciona o colaborador no lançamento e no filtro do histórico */
  profileId?: string | undefined
}

const TABS: readonly PointsTab[] = ['regras', 'lancar', 'historico']

/** /admin/pontuacao — abas Lançar / Regras / Histórico. */
export function PointsPage({ tab, profileId }: PointsPageProps) {
  const navigate = useNavigate()
  const setTab = (value: string) => {
    const aba = TABS.includes(value as PointsTab) ? (value as PointsTab) : 'lancar'
    void navigate({ to: '/admin/pontuacao', search: { aba, ...(profileId ? { perfil: profileId } : {}) } })
  }

  return (
    <PageFrame
      eyebrow="Administração"
      title="Pontuação"
      subtitle="Lance atividades por regra, faça ajustes manuais e acompanhe o histórico do time."
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Seções de pontuação">
          <TabsTrigger value="lancar">Lançar</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="lancar">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <RecordEntryForm initialProfileId={profileId} />
            <ManualEntryForm initialProfileId={profileId} />
          </div>
        </TabsContent>
        <TabsContent value="regras">
          <RulesList />
        </TabsContent>
        <TabsContent value="historico">
          <EntriesHistoryTable initialProfileId={profileId} />
        </TabsContent>
      </Tabs>
    </PageFrame>
  )
}
