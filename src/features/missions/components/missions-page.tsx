import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarOff, Plus, Target } from 'lucide-react'
import { PageFrame } from '@/components/shared/page-frame'
import { EmptyState } from '@/components/shared/empty-state'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { CardSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { qk } from '@/lib/query-keys'
import type { MissionFilter } from '@/lib/gamification'
import type { VMissionBoard } from '@/lib/database.types'
import { useMe } from '@/features/auth/hooks'
import type { MissionAdminRow } from '../api'
import { useMissionBoard, useMissionsRealtime } from '../hooks'
import { LightningMission } from './lightning-mission'
import { MissionCard } from './mission-card'
import { MissionEditorDialog } from './mission-editor-dialog'
import { MissionFilters } from './mission-filters'
import { MissionsAdminList } from './missions-admin-list'

export interface MissionsPageProps {
  filter: MissionFilter
  /** `?novo=true` (admin): abre o editor ao entrar */
  openNew: boolean
}

const EMPTY_TITLE: Record<MissionFilter, string> = {
  hoje: 'Nenhuma missão para hoje',
  semana: 'Nenhuma missão para a semana',
  especiais: 'Nenhuma missão especial',
}

/** Missões: filtros por URL, relâmpago com contador, cards com progresso, gestão para admin. */
export function MissionsPage({ filter, openNew }: MissionsPageProps) {
  const { isAdmin, season } = useMe()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const board = useMissionBoard(filter)
  useMissionsRealtime()

  const [editing, setEditing] = useState<MissionAdminRow | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const showEditor = isAdmin && (editorOpen || openNew)

  const closeEditor = useCallback(() => {
    setEditorOpen(false)
    setEditing(null)
    if (openNew) void navigate({ to: '/missoes', search: { filtro: filter }, replace: true })
  }, [openNew, navigate, filter])

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }
  const onExpire = () => void qc.invalidateQueries({ queryKey: qk.missions.all() })

  const action = isAdmin ? (
    <Button type="button" onClick={openCreate} disabled={!season}>
      <Plus aria-hidden="true" />
      Nova missão
    </Button>
  ) : undefined

  return (
    <PageFrame
      eyebrow="Metas"
      title="Missões"
      subtitle="Conclua missões para ganhar pontos, moedas e giros na roleta."
      {...(action ? { action } : {})}
    >
      <div className="flex flex-col gap-6">
        <MissionFilters value={filter} />
        {!season ? (
          <EmptyState
            icon={CalendarOff}
            title="A próxima temporada ainda não começou"
            description="As missões pertencem a uma temporada. Assim que uma temporada estiver ativa, elas aparecem aqui."
            adminHint="Crie ou ative uma temporada em Configurações › Temporadas."
            {...(isAdmin ? { action: { label: 'Criar/ativar temporada', to: '/admin/configuracoes', search: { aba: 'temporadas' } } } : {})}
          />
        ) : (
          <QueryBoundary query={board} skeleton={<BoardSkeleton />}>
            {(rows) => (
              <MissionBoard
                filter={filter}
                rows={rows}
                readAt={board.dataUpdatedAt}
                onExpire={onExpire}
                {...(isAdmin ? { onCreate: openCreate } : {})}
              />
            )}
          </QueryBoundary>
        )}
        {isAdmin && season ? (
          <MissionsAdminList
            onCreate={openCreate}
            onEdit={(m) => {
              setEditing(m)
              setEditorOpen(true)
            }}
          />
        ) : null}
      </div>
      {isAdmin ? (
        <MissionEditorDialog
          open={showEditor}
          onOpenChange={(o) => (o ? setEditorOpen(true) : closeEditor())}
          mission={editing}
        />
      ) : null}
    </PageFrame>
  )
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CardSkeleton className="md:col-span-2" lines={2} />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}

interface MissionBoardProps {
  filter: MissionFilter
  rows: VMissionBoard[]
  readAt: number
  onExpire: () => void
  onCreate?: () => void
}

function MissionBoard({ filter, rows, readAt, onExpire, onCreate }: MissionBoardProps) {
  const lightning = filter === 'hoje' ? (rows.find((r) => r.kind === 'lightning') ?? null) : null
  const cards = rows.filter((r) => r.mission_id !== lightning?.mission_id)
  return (
    <div className="flex flex-col gap-4">
      {filter === 'hoje' ? (
        <LightningMission mission={lightning} readAt={readAt} onExpire={onExpire} />
      ) : null}
      {cards.length === 0 ? (
        <EmptyState
          icon={Target}
          title={EMPTY_TITLE[filter]}
          description="Quando o gestor criar missões para este período, elas aparecem aqui com o seu progresso."
          adminHint="Crie a primeira missão: o progresso vem dos lançamentos reais do time."
          {...(onCreate ? { action: { label: 'Nova missão', onClick: onCreate } } : {})}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="Missões">
          {cards.map((m) => (
            <li key={m.mission_id} className="min-w-0">
              <MissionCard mission={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
