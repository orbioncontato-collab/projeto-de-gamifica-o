import { Link } from '@tanstack/react-router'
import { BookOpen, ClipboardCheck } from 'lucide-react'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/bootstrap-query'
import { useSeasons } from '../hooks'

/**
 * Checklist de implantação embutida na aba Geral (FRONTEND-ARCH §9). Estado derivado do que o app já sabe
 * (temporada ativa, meta, pendentes); o passo a passo completo fica em /admin/guia.
 */
export function SetupChecklist() {
  const { season, pendingMembers } = useMe()
  const seasons = useSeasons()
  const hasGoal = (season?.team_goal_amount ?? 0) > 0
  const items: readonly { id: string; label: string; done: boolean | null }[] = [
    { id: 'season', label: 'Temporada ativa', done: season !== null },
    { id: 'goal', label: 'Meta do time definida', done: hasGoal },
    { id: 'pending', label: 'Nenhum cadastro aguardando aprovação', done: pendingMembers === 0 },
    {
      id: 'next',
      label: 'Próxima temporada criada',
      done: seasons.data ? seasons.data.some((s) => !s.is_active && !s.closed_at) : null,
    },
  ]
  return (
    <PremiumCard as="section" padding="lg">
      <SectionHeader
        eyebrow="Implantação"
        title="Checklist rápido"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/guia">
              <BookOpen aria-hidden="true" /> Guia completo
            </Link>
          </Button>
        }
      />
      <ul className="mt-3 divide-y divide-line">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-2.5 text-sm">
            <IconTile
              icon={ClipboardCheck}
              tone={it.done === null ? 'muted' : it.done ? 'success' : 'warning'}
              size="sm"
            />
            <span className={it.done ? 'text-muted line-through' : 'font-semibold text-text-2'}>
              {it.label}
            </span>
            <span className="ml-auto text-xs text-muted-2">
              {it.done === null ? 'verificando…' : it.done ? 'ok' : 'pendente'}
            </span>
          </li>
        ))}
      </ul>
    </PremiumCard>
  )
}
