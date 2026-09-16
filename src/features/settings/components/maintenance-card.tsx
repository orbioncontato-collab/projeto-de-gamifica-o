import { useState } from 'react'
import { Wrench } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { Button } from '@/components/ui/button'
import { PersonPicker } from '@/features/profiles/components/person-picker'
import { formatNumber } from '@/lib/format'
import type { RecomputeStatsPayload } from '@/lib/database.types'
import { useRecomputeStats } from '../hooks'

/** Manutenção: `recompute_stats` (todos ou um perfil) — reconstrói stats a partir do ledger (DATA-MODEL §7.2). */
export function MaintenanceCard() {
  const recompute = useRecomputeStats()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [last, setLast] = useState<RecomputeStatsPayload | null>(null)

  return (
    <PremiumCard as="section" padding="lg">
      <SectionHeader eyebrow="Manutenção" title="Recalcular estatísticas" />
      <div className="mt-3 flex items-start gap-3">
        <IconTile icon={Wrench} tone="blue" size="sm" />
        <p className="text-sm text-muted">
          Reconstrói pontos, ranking, streak e progresso de desafios a partir do histórico de lançamentos. Não
          altera conquistas, missões concluídas nem o feed. Use se algum número parecer fora do lugar.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="recompute-profile" className="field-label">
            Colaborador (opcional)
          </label>
          <PersonPicker
            id="recompute-profile"
            value={profileId}
            onChange={setProfileId}
            placeholder="Todos os colaboradores"
            disabled={recompute.isPending}
          />
        </div>
        <Button variant="secondary" onClick={() => setConfirming(true)} loading={recompute.isPending}>
          Recalcular {profileId ? 'este colaborador' : 'todos'}
        </Button>
      </div>
      {last ? (
        <p className="mt-3 text-xs text-muted-2" aria-live="polite">
          Último recálculo: {formatNumber(last.profiles)} perfis · {formatNumber(last.seasons)} temporadas.
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Recalcular estatísticas?"
        description={
          profileId
            ? 'Os totais deste colaborador serão reconstruídos a partir do histórico.'
            : 'Os totais de todos os colaboradores serão reconstruídos a partir do histórico. Pode levar alguns segundos.'
        }
        confirmLabel="Recalcular"
        tone="primary"
        loading={recompute.isPending}
        onConfirm={async () => {
          setLast(await recompute.mutateAsync(profileId))
        }}
      />
    </PremiumCard>
  )
}
