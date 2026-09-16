import { Trophy } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import type { VRanking } from '@/lib/database.types'
import { RankingRow } from './ranking-row'

/** Classificação completa com "Você" destacado (FEATURE §3). */
export function RankingList({ rows, meId }: { rows: VRanking[]; meId: string }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Ninguém no ranking ainda"
        description="A classificação aparece quando houver colaboradores ativos na temporada."
        adminHint="Convide o time com o código da equipe em Configurações › Código."
      />
    )
  }
  return (
    <ol className="flex flex-col gap-2" aria-label="Classificação completa">
      {rows.map((row) => (
        <RankingRow key={row.profile_id} row={row} isMe={row.profile_id === meId} />
      ))}
    </ol>
  )
}
