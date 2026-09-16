import { useState } from 'react'
import { AlertTriangle, CalendarDays, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/shared/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { PremiumCard } from '@/components/shared/premium-card'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { SectionHeader } from '@/components/shared/section-header'
import { ListSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useMe } from '@/features/auth/bootstrap-query'
import { formatBRL, formatDate, formatDaysLeft } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VSeason } from '@/lib/database.types'
import { useActivateSeason, useSeasons } from '../hooks'
import {
  activeSeasonEnded,
  canActivateSeason,
  formatLocalDay,
  seasonEndsOn,
  seasonState,
  type SeasonState,
} from '../season-logic'
import { SeasonEditorDialog } from './season-editor-dialog'
import { CloseSeasonDialog } from './close-season-dialog'

const STATE_BADGE: Record<SeasonState, { label: string; tone: 'green' | 'gold' | 'red' | 'blue' | 'dark' }> =
  {
    active: { label: 'Ativa', tone: 'green' },
    ended: { label: 'Terminou', tone: 'red' },
    upcoming: { label: 'Futura', tone: 'blue' },
    idle: { label: 'Inativa', tone: 'dark' },
    closed: { label: 'Encerrada', tone: 'dark' },
  }

/** Aba "Temporadas": lista, criar, editar, ativar (com tooltip "Começa em DD/MM"), encerrar. */
export function SeasonPanel() {
  const { settings } = useMe()
  const tz = settings.timezone
  const seasons = useSeasons()
  const activate = useActivateSeason()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<VSeason | null>(null)
  const [closing, setClosing] = useState<VSeason | null>(null)

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Ciclos"
        title="Temporadas"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> Nova temporada
          </Button>
        }
      />
      <QueryBoundary
        query={seasons}
        skeleton={<ListSkeleton rows={3} />}
        empty={{
          when: (d) => d.length === 0,
          render: (
            <EmptyState
              icon={CalendarDays}
              title="Nenhuma temporada"
              description="Sem temporada ativa não há ranking nem lançamentos."
              action={{ label: 'Criar temporada', onClick: () => setCreating(true) }}
            />
          ),
        }}
      >
        {(data) => {
          const ended = activeSeasonEnded(data)
          return (
            <div className="space-y-3">
              {ended ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-[var(--radius-ctl)] border border-red/25 bg-red/10 px-3 py-2 text-sm text-red-soft"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    A temporada "{ended.name}" terminou em {formatDate(ended.ends_at, tz)}. Encerre-a e
                    crie/ative a próxima para continuar lançando.
                  </span>
                </p>
              ) : null}
              <TooltipProvider>
                {data.map((s) => (
                  <SeasonRow
                    key={s.id}
                    season={s}
                    tz={tz}
                    activating={activate.isPending && activate.variables === s.id}
                    onActivate={() => activate.mutate(s.id)}
                    onEdit={() => setEditing(s)}
                    onClose={() => setClosing(s)}
                  />
                ))}
              </TooltipProvider>
            </div>
          )
        }}
      </QueryBoundary>

      <SeasonEditorDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false)
            setEditing(null)
          }
        }}
        season={editing}
      />
      <CloseSeasonDialog season={closing} onOpenChange={(open) => !open && setClosing(null)} />
    </section>
  )
}

interface SeasonRowProps {
  season: VSeason
  tz: string
  activating: boolean
  onActivate: () => void
  onEdit: () => void
  onClose: () => void
}

function SeasonRow({ season: s, tz, activating, onActivate, onEdit, onClose }: SeasonRowProps) {
  const state = seasonState(s)
  const badge = STATE_BADGE[state]
  const check = canActivateSeason(s, tz)
  const goalMissing =
    s.team_goal_amount <= 0 && (state === 'active' || state === 'upcoming' || state === 'idle')
  const activateButton = (
    <Button
      variant="secondary"
      size="sm"
      disabled={!check.allowed || activating}
      loading={activating}
      onClick={onActivate}
    >
      Ativar
    </Button>
  )
  return (
    <PremiumCard
      as="div"
      padding="md"
      tone={state === 'active' ? 'green' : 'default'}
      className={cn(state === 'closed' && 'opacity-80')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-text">{s.name}</h3>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {formatDate(s.starts_at, tz)} a {formatLocalDay(seasonEndsOn(s.ends_at, tz))}
            {state === 'active' ? ` · ${formatDaysLeft(s.days_left)}` : ''}
          </p>
          <p className={cn('mt-1 text-sm', goalMissing ? 'font-bold text-gold' : 'text-text-2')}>
            Meta do time: {s.team_goal_amount > 0 ? formatBRL(s.team_goal_amount) : 'defina a meta'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state !== 'closed' && !s.is_active ? (
            check.allowed ? (
              activateButton
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex" aria-label={check.reason}>
                    {activateButton}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{check.reason}</TooltipContent>
              </Tooltip>
            )
          ) : null}
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil aria-hidden="true" /> Editar
          </Button>
          {s.is_active ? (
            <Button variant="danger" size="sm" onClick={onClose}>
              Encerrar
            </Button>
          ) : null}
        </div>
      </div>
    </PremiumCard>
  )
}
