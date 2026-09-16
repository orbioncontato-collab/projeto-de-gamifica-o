import { Link, useNavigate } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'
import { PageFrame } from '@/components/shared/page-frame'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMe } from '@/features/auth/bootstrap-query'
import { WalletCard } from './wallet-card'
import { RecentCredits } from './recent-credits'
import { StoreGrid } from './store-grid'
import { MyRedemptions } from './my-redemptions'

export type RewardsTab = 'loja' | 'pedidos'

export interface RewardsPageProps {
  tab: RewardsTab
}

/** /recompensas — carteira + últimos créditos em cima; abas Loja / Meus pedidos embaixo (FEATURE §7). */
export function RewardsPage({ tab }: RewardsPageProps) {
  const { isAdmin } = useMe()
  const navigate = useNavigate()
  const setTab = (value: string) => {
    void navigate({ to: '/recompensas', search: { aba: value === 'pedidos' ? 'pedidos' : 'loja' } })
  }
  return (
    <PageFrame
      eyebrow="Prêmios"
      title="Recompensas"
      subtitle="Troque suas Orb Coins por vouchers, PIX e benefícios."
      action={
        isAdmin ? (
          <Button asChild variant="secondary" size="sm">
            <Link to="/admin/recompensas" search={{ aba: 'catalogo' }}>
              <Settings2 aria-hidden="true" /> Gerenciar catálogo
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <WalletCard />
        <RecentCredits />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList aria-label="Seções de recompensas">
          <TabsTrigger value="loja">Loja</TabsTrigger>
          <TabsTrigger value="pedidos">Meus pedidos</TabsTrigger>
        </TabsList>
        <TabsContent value="loja">
          <StoreGrid />
        </TabsContent>
        <TabsContent value="pedidos">
          <MyRedemptions />
        </TabsContent>
      </Tabs>
    </PageFrame>
  )
}
