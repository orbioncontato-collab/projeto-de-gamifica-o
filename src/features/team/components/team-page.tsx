import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CalendarOff, Search, UserPlus, Users } from 'lucide-react'
import type { VProfileStats } from '@/lib/database.types'
import { useMe } from '@/features/auth/bootstrap-query'
import { PageFrame } from '@/components/shared/page-frame'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { TableSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTeamRoster } from '../hooks'
import { TeamTable } from './team-table'
import { PendingMembersSection } from './pending-members-section'
import { InviteDialog } from './invite-dialog'
import { CollaboratorDetailDialog } from './collaborator-detail-dialog'
import { CollaboratorEditorDialog } from './collaborator-editor-dialog'

export interface TeamPageSearch {
  perfil?: string
  busca?: string
  editar?: string
  convidar?: boolean
  pendentes?: boolean
}

export interface TeamPageProps {
  search: TeamPageSearch
}

const SEARCH_DEBOUNCE_MS = 250

/** /admin/equipe (FEATURE §11): Pendentes acima da tabela, busca, `?perfil=`, `?editar=`, `?convidar=true`, `?pendentes=true`. */
export function TeamPage({ search }: TeamPageProps) {
  const { seasonId } = useMe()
  const navigate = useNavigate()
  const [term, setTerm] = useState(search.busca ?? '')
  const pendingRef = useRef<HTMLElement>(null)
  const { query, rows } = useTeamRoster(seasonId, search.busca ?? '')

  const go = (next: TeamPageSearch) => {
    void navigate({ to: '/admin/equipe', search: next, replace: true })
  }
  const keepSearch = (extra: TeamPageSearch): TeamPageSearch => ({
    ...(search.busca ? { busca: search.busca } : {}),
    ...extra,
  })

  // Busca com debounce → URL (`?busca=`), para compartilhar/voltar mantendo o filtro.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = term.trim()
      if ((search.busca ?? '') !== next) {
        const { busca: _drop, ...rest } = search
        go(next ? { ...rest, busca: next } : rest)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o termo digitado dispara
  }, [term])

  // `?pendentes=true` rola até a seção.
  useEffect(() => {
    const el = pendingRef.current
    if (search.pendentes && el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [search.pendentes])

  const all = query.data
  const selected = useMemo(
    () => all?.find((r) => r.profile_id === search.perfil) ?? null,
    [all, search.perfil],
  )
  const editing = useMemo(
    () => all?.find((r) => r.profile_id === search.editar) ?? null,
    [all, search.editar],
  )

  const openDetail = (r: VProfileStats) => go(keepSearch({ perfil: r.profile_id }))
  const openEditor = (r: VProfileStats) => go(keepSearch({ editar: r.profile_id }))
  const closeDialogs = () => go(keepSearch({}))

  const inviteButton = (
    <Button type="button" variant="primary" size="sm" onClick={() => go(keepSearch({ convidar: true }))}>
      <UserPlus aria-hidden="true" />
      Cadastrar colaborador
    </Button>
  )

  return (
    <PageFrame
      eyebrow="Administração"
      title="Equipe"
      subtitle="Aprove cadastros, edite perfis e acompanhe o time."
      action={inviteButton}
    >
      <div className="space-y-6">
        <PendingMembersSection ref={pendingRef} forceVisible={search.pendentes === true} />
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail, cargo ou equipe"
            aria-label="Buscar colaborador"
            className="pl-9"
          />
        </div>
        {!seasonId ? (
          <EmptyState
            icon={CalendarOff}
            title="Sem temporada ativa"
            description="A tabela da equipe mostra os números da temporada. Cadastros pendentes continuam disponíveis acima."
            adminHint="Crie ou ative a temporada em Administração › Configurações › Temporadas."
            action={{
              label: 'Criar/ativar temporada',
              to: '/admin/configuracoes',
              search: { aba: 'temporadas' },
            }}
          />
        ) : query.isPending ? (
          <TableSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <TeamTable
            rows={rows}
            onView={openDetail}
            onEdit={openEditor}
            empty={
              search.busca ? (
                <EmptyState
                  icon={Search}
                  compact
                  title="Ninguém encontrado"
                  description={`Nenhum colaborador corresponde a “${search.busca}”.`}
                />
              ) : (
                <EmptyState
                  icon={Users}
                  title="Ainda só você aqui"
                  description="Convide o time com o código da equipe; cada cadastro aparece em Pendentes para aprovação."
                  adminHint="Clique em “Cadastrar colaborador” para ver o código e o link de cadastro."
                  action={{
                    label: 'Cadastrar colaborador',
                    onClick: () => go(keepSearch({ convidar: true })),
                  }}
                />
              )
            }
          />
        )}
      </div>
      <InviteDialog open={search.convidar === true} onOpenChange={(o) => !o && closeDialogs()} />
      <CollaboratorDetailDialog
        open={selected !== null}
        profile={selected}
        onOpenChange={(o) => !o && closeDialogs()}
        onEdit={openEditor}
      />
      <CollaboratorEditorDialog
        open={editing !== null}
        profile={editing}
        onOpenChange={(o) => !o && closeDialogs()}
      />
    </PageFrame>
  )
}
