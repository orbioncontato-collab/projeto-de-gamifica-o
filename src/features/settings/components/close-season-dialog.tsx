import { useState } from 'react'
import { CalendarClock, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMe } from '@/features/auth/bootstrap-query'
import { formatBRL, formatDate, formatNumber, formatOrdinal, formatPoints } from '@/lib/format'
import type { CloseSeasonPayload, VSeason } from '@/lib/database.types'
import { useCloseSeason, useUpdateSeason } from '../hooks'
import { formatLocalDay, nextSeasonStartPatch } from '../season-logic'

export interface CloseSeasonDialogProps {
  season: VSeason | null
  onOpenChange: (open: boolean) => void
}

const GAP_WARNING = 'gap_until_next_season'

/**
 * Encerrar temporada: confirmação → resumo (`CloseSeasonPayload`) com campeão e, se `gap_until_next_season`,
 * oferta "Antecipar início da próxima para {hoje+1}" → `update_season(next, { starts_on })` (DATA-MODEL §7.3 passo 9).
 */
export function CloseSeasonDialog({ season, onOpenChange }: CloseSeasonDialogProps) {
  const { settings } = useMe()
  const tz = settings.timezone
  const close = useCloseSeason()
  const update = useUpdateSeason()
  const [result, setResult] = useState<CloseSeasonPayload | null>(null)
  const open = season !== null
  const busy = close.isPending || update.isPending

  const handleOpenChange = (next: boolean) => {
    if (busy) return
    if (!next) setResult(null)
    onOpenChange(next)
  }

  const confirm = async () => {
    if (!season) return
    try {
      setResult(await close.mutateAsync(season.id))
    } catch {
      // toast do MutationCache; o diálogo continua aberto para nova tentativa
    }
  }

  const anticipateNext = async () => {
    if (!result?.next_season_id) return
    try {
      await update.mutateAsync({ seasonId: result.next_season_id, patch: nextSeasonStartPatch(tz) })
      handleOpenChange(false)
    } catch {
      // toast do MutationCache
    }
  }

  const champion = result
    ? (result.results.find((r) => r.profile_id === result.champion_profile_id) ?? null)
    : null
  const hasGap = result?.warnings.includes(GAP_WARNING) === true && !!result?.next_season_id
  const nextStart = nextSeasonStartPatch(tz).starts_on ?? ''

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="close-season-description">
        <DialogHeader>
          <DialogTitle>{result ? 'Temporada encerrada' : 'Encerrar temporada?'}</DialogTitle>
          <DialogDescription id="close-season-description">
            {result
              ? 'Resultados congelados. Lançamentos nesta temporada não são mais aceitos (estornos continuam permitidos).'
              : season
                ? `"${season.name}" será fechada agora: o ranking vira resultado final, desafios ativos são finalizados e missões encerradas. Isso não pode ser desfeito.`
                : ''}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[var(--radius-ctl)] border border-gold/25 bg-gold/10 px-3 py-3">
              <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
              <div className="text-sm">
                {champion ? (
                  <>
                    <span className="block font-black text-text">Campeão definido</span>
                    <span className="block text-muted">
                      {formatOrdinal(champion.final_rank)} · {formatPoints(champion.final_points)} ·{' '}
                      {formatBRL(champion.sales_amount)}
                    </span>
                  </>
                ) : (
                  <span className="block font-bold text-text-2">
                    Sem campeão: ninguém pontuou nesta temporada.
                  </span>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-[var(--radius-ctl)] bg-surface px-3 py-2">
                <dt className="text-xs uppercase tracking-wider text-muted-2">Participantes</dt>
                <dd className="font-black text-text">{formatNumber(result.results.length)}</dd>
              </div>
              <div className="rounded-[var(--radius-ctl)] bg-surface px-3 py-2">
                <dt className="text-xs uppercase tracking-wider text-muted-2">Bateram a meta</dt>
                <dd className="font-black text-accent">
                  {formatNumber(result.results.filter((r) => r.goal_reached).length)}
                </dd>
              </div>
            </dl>
            {hasGap ? (
              <div className="flex flex-col gap-3 rounded-[var(--radius-ctl)] border border-blue/25 bg-blue/10 px-3 py-3 text-sm">
                <p className="flex items-start gap-2 text-text-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-blue-soft" aria-hidden="true" />
                  <span>
                    Existe um intervalo sem temporada até a próxima
                    {result.next_starts_at ? ` (${formatDate(result.next_starts_at, tz)})` : ''}. Lançamentos
                    nesse período seriam recusados.
                  </span>
                </p>
                <Button
                  variant="blue"
                  size="sm"
                  loading={update.isPending}
                  onClick={() => void anticipateNext()}
                  className="self-start"
                >
                  Antecipar início da próxima para {formatLocalDay(nextStart)}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => handleOpenChange(false)} disabled={busy}>
              Fechar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button type="button" variant="danger" loading={close.isPending} onClick={() => void confirm()}>
                Encerrar temporada
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
