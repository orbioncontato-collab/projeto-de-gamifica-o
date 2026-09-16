import { Link } from '@tanstack/react-router'
import { History, ListPlus, UserPlus } from 'lucide-react'
import type { VAdminKpis, VTeamStats } from '@/lib/database.types'
import { pluralize } from '@/lib/format'
import { PremiumCard } from '@/components/shared/premium-card'
import { Button } from '@/components/ui/button'

export interface OperationsBarProps {
  stats: VTeamStats | null
  kpis: VAdminKpis | null
}

/**
 * Barra "Administração operacional" (FEATURE §10): Cadastrar colaborador (`/admin/equipe?convidar=true`),
 * Lançar pontos (`/admin/pontuacao?aba=lancar`), Histórico (`?aba=historico`) + contadores.
 */
export function OperationsBar({ stats, kpis }: OperationsBarProps) {
  const people = stats?.active_count ?? 0
  const points = stats?.points_total ?? 0
  const entries = kpis?.entries_count ?? 0
  const counters = [
    pluralize(people, 'colaborador', 'colaboradores'),
    pluralize(points, 'ponto', 'pontos'),
    pluralize(entries, 'lançamento', 'lançamentos'),
  ].join(' · ')
  return (
    <PremiumCard as="section" padding="md" aria-label="Administração operacional">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-2">
            Administração operacional
          </p>
          <p className="mt-1 text-sm font-semibold text-text-2">{counters}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button asChild variant="primary" size="sm">
            <Link to="/admin/equipe" search={{ convidar: true }}>
              <UserPlus aria-hidden="true" />
              Cadastrar colaborador
            </Link>
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link to="/admin/pontuacao" search={{ aba: 'lancar' }}>
              <ListPlus aria-hidden="true" />
              Lançar pontos
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/admin/pontuacao" search={{ aba: 'historico' }}>
              <History aria-hidden="true" />
              Histórico
            </Link>
          </Button>
        </div>
      </div>
    </PremiumCard>
  )
}
