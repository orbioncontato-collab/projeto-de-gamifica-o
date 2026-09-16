import { useNavigate } from '@tanstack/react-router'
import type { RedemptionStatus } from '@/lib/database.types'
import { PageFrame } from '@/components/shared/page-frame'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RedemptionsQueue } from './redemptions-queue'
import { CatalogTable } from './catalog-table'

export type RewardsAdminTab = 'pedidos' | 'catalogo'

export interface RewardsAdminPageProps {
  tab: RewardsAdminTab
  status: RedemptionStatus | null
  /** `?novo=true` abre o editor de recompensa */
  openNew?: boolean
}

/** /admin/recompensas?aba=pedidos|catalogo&status — fila de pedidos + catálogo CRUD (WP5). */
export function RewardsAdminPage({ tab, status, openNew = false }: RewardsAdminPageProps) {
  const navigate = useNavigate()
  const go = (next: { aba: RewardsAdminTab; status?: RedemptionStatus }) => {
    void navigate({ to: '/admin/recompensas', search: next })
  }
  return (
    <PageFrame
      eyebrow="Administração"
      title="Recompensas"
      subtitle="Aprove e entregue os pedidos do time e mantenha o catálogo da loja."
    >
      <Tabs value={tab} onValueChange={(v) => go({ aba: v === 'catalogo' ? 'catalogo' : 'pedidos' })}>
        <TabsList aria-label="Seções de recompensas">
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos">
          <RedemptionsQueue
            status={status}
            onStatusChange={(s) => go(s ? { aba: 'pedidos', status: s } : { aba: 'pedidos' })}
          />
        </TabsContent>
        <TabsContent value="catalogo">
          <CatalogTable openNew={openNew} />
        </TabsContent>
      </Tabs>
    </PageFrame>
  )
}
