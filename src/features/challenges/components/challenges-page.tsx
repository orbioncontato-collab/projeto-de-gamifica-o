import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CalendarOff, Plus, Swords } from 'lucide-react'
import { PageFrame } from '@/components/shared/page-frame'
import { EmptyState } from '@/components/shared/empty-state'
import { QueryBoundary } from '@/components/shared/query-boundary'
import { SectionHeader } from '@/components/shared/section-header'
import { CardSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import type { VChallengeBoard } from '@/lib/database.types'
import { useMe } from '@/features/auth/hooks'
import { useChallengeBoard, useChallengesRealtime } from '../hooks'
import { ChallengeEditorDialog } from './challenge-editor-dialog'
import { ChallengesManager } from './challenges-manager'
import { DuelCard } from './duel-card'
import { TeamChallengeCard } from './team-challenge-card'

export interface ChallengesPageProps {
  /** `?novo=true` (admin): abre o editor ao entrar */
  openNew: boolean
  /** `?gerenciar=true` (admin): rola até a gestão */
  manage: boolean
}

const BOARD_STATUSES = ['active', 'finished'] as const

/** Desafios: duelos e coletivos em andamento, encerrados, e gestão para o admin. */
export function ChallengesPage({ openNew, manage }: ChallengesPageProps) {
  const { isAdmin, seasonId, season } = useMe()
  const navigate = useNavigate()
  const board = useChallengeBoard(seasonId, BOARD_STATUSES)
  useChallengesRealtime()

  const [editing, setEditing] = useState<VChallengeBoard | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const showEditor = isAdmin && (editorOpen || openNew)

  const closeEditor = useCallback(() => {
    setEditorOpen(false)
    setEditing(null)
    if (openNew) void navigate({ to: '/desafios', search: manage ? { gerenciar: true } : {}, replace: true })
  }, [openNew, manage, navigate])

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  useEffect(() => {
    if (!manage || !isAdmin) return
    const el = document.getElementById('gerenciar')
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' })
  }, [manage, isAdmin])

  const action = isAdmin ? (
    <Button type="button" onClick={openCreate} disabled={!season}>
      <Plus aria-hidden="true" />
      Novo desafio
    </Button>
  ) : undefined

  return (
    <PageFrame
      eyebrow="Competição"
      title="Desafios"
      subtitle="Duelos e metas coletivas com prêmio para quem vencer."
      {...(action ? { action } : {})}
    >
      <div className="flex flex-col gap-8">
        {!season ? (
          <EmptyState
            icon={CalendarOff}
            title="A próxima temporada ainda não começou"
            description="Os desafios pertencem a uma temporada. Assim que uma temporada estiver ativa, eles aparecem aqui."
            adminHint="Crie ou ative uma temporada em Configurações › Temporadas."
            {...(isAdmin ? { action: { label: 'Criar/ativar temporada', to: '/admin/configuracoes', search: { aba: 'temporadas' } } } : {})}
          />
        ) : (
          <QueryBoundary query={board} skeleton={<BoardSkeleton />}>
            {(rows) => <ChallengeBoard rows={rows} {...(isAdmin ? { onCreate: openCreate } : {})} />}
          </QueryBoundary>
        )}
        {isAdmin && season ? (
          <ChallengesManager
            onCreate={openCreate}
            onEdit={(c) => {
              setEditing(c)
              setEditorOpen(true)
            }}
          />
        ) : null}
      </div>
      {isAdmin ? (
        <ChallengeEditorDialog
          open={showEditor}
          onOpenChange={(o) => (o ? setEditorOpen(true) : closeEditor())}
          challenge={editing}
        />
      ) : null}
    </PageFrame>
  )
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CardSkeleton lines={4} />
      <CardSkeleton lines={4} />
    </div>
  )
}

function ChallengeCard({ challenge }: { challenge: VChallengeBoard }) {
  return challenge.kind === 'duel' ? (
    <DuelCard challenge={challenge} />
  ) : (
    <TeamChallengeCard challenge={challenge} />
  )
}

function ChallengeBoard({ rows, onCreate }: { rows: VChallengeBoard[]; onCreate?: () => void }) {
  const active = rows.filter((c) => c.status === 'active')
  const finished = rows.filter((c) => c.status === 'finished')
  return (
    <div className="flex flex-col gap-8">
      {active.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nenhum desafio em andamento"
          description="Quando o gestor ativar um duelo ou um desafio coletivo, ele aparece aqui com o placar ao vivo."
          adminHint="Crie um desafio, escolha os participantes e ative quando estiver pronto."
          {...(onCreate ? { action: { label: 'Novo desafio', onClick: onCreate } } : {})}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="Desafios em andamento">
          {active.map((c) => (
            <li key={c.challenge_id} className="min-w-0">
              <ChallengeCard challenge={c} />
            </li>
          ))}
        </ul>
      )}
      {finished.length > 0 ? (
        <section aria-labelledby="finished-challenges-title" className="flex flex-col gap-4">
          <SectionHeader eyebrow="Histórico" title="Encerrados nesta temporada" />
          <ul className="grid gap-4 md:grid-cols-2" aria-label="Desafios encerrados">
            {finished.map((c) => (
              <li key={c.challenge_id} className="min-w-0">
                <ChallengeCard challenge={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
