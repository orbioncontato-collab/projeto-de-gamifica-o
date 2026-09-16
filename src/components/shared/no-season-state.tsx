import { CalendarOff } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { useMeOptional } from '@/features/auth/bootstrap-query'

/** Estado "Sem temporada ativa" (FRONTEND-ARCH §9) — reutilizado por dashboard, ranking e perfil. */
export function NoSeasonState({ compact = false }: { compact?: boolean }) {
  const me = useMeOptional()
  return (
    <EmptyState
      compact={compact}
      icon={CalendarOff}
      title="Sem temporada ativa"
      description="A próxima temporada ainda não começou. Pontos, ranking e metas voltam assim que o gestor ativar uma temporada."
      adminHint="Crie ou ative uma temporada em Configurações › Temporadas para liberar lançamentos e o ranking."
      {...(me?.isAdmin
        ? {
            action: {
              label: 'Criar/ativar temporada',
              to: '/admin/configuracoes',
              search: { aba: 'temporadas' },
            },
          }
        : {})}
    />
  )
}
