import { Coins } from 'lucide-react'
import type { VProfileStats } from '@/lib/database.types'
import { useZodForm } from '@/lib/forms'
import { formatPoints } from '@/lib/format'
import { isCode, RPC_MESSAGES } from '@/lib/rpc-errors'
import { useMe } from '@/features/auth/bootstrap-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/shared/form-field'
import { useInitialPointsSum, useRecordInitialPoints } from '../hooks'
import { initialPointsSchema, type InitialPointsInput, type InitialPointsOutput } from '../schemas'
import { canReceivePoints } from '../team-utils'

/**
 * "Pontos iniciais" — ação separada do formulário (DATA-MODEL §4.6/§7.4): mostra "Pontos iniciais lançados: N"
 * e um botão próprio; `INITIAL_POINTS_EXISTS` desabilita com a mensagem do catálogo; `NO_SEASON_FOR_DATE` orienta.
 */
export function InitialPointsCard({ profile }: { profile: VProfileStats }) {
  const { seasonId } = useMe()
  const { query, sum } = useInitialPointsSum(profile.profile_id)
  const record = useRecordInitialPoints()
  const form = useZodForm<InitialPointsInput, InitialPointsOutput>(initialPointsSchema, { points: '' })
  const { errors } = form.formState

  const isActive = canReceivePoints(profile.status)
  const alreadyRecorded = sum > 0 || isCode(record.error, 'INITIAL_POINTS_EXISTS')
  const noSeason = !seasonId || isCode(record.error, 'NO_SEASON_FOR_DATE')
  const disabled = !isActive || alreadyRecorded || noSeason

  const hint = !isActive
    ? 'Só perfis ativos recebem pontos.'
    : noSeason
      ? 'Ative uma temporada em Configurações › Temporadas para lançar.'
      : alreadyRecorded
        ? RPC_MESSAGES['INITIAL_POINTS_EXISTS']
        : 'Uma vez por perfil e temporada. Não conta como atividade nem streak.'

  const onSubmit = form.handleSubmit(async (values) => {
    // erro → toast do MutationCache; o campo permanece para corrigir
    await record.mutateAsync({ profileId: profile.profile_id, points: values.points }).then(
      () => form.reset({ points: '' }),
      () => undefined,
    )
  })

  return (
    <section
      className="rounded-2xl border border-gold/20 bg-gold/5 p-4"
      aria-labelledby="initial-points-title"
    >
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-gold" aria-hidden="true" />
        <h3 id="initial-points-title" className="text-sm font-black text-text">
          Pontos iniciais
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted">
        Pontos iniciais lançados:{' '}
        {query.isPending && seasonId ? (
          <Skeleton className="inline-block h-3 w-10 align-middle" />
        ) : (
          <span className="nums font-black text-text">{formatPoints(sum)}</span>
        )}
      </p>
      <form
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <FormField label="Pontos" htmlFor="initial-points" error={errors.points?.message} className="flex-1">
          <Input
            id="initial-points"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            disabled={disabled || record.isPending}
            {...form.register('points')}
          />
        </FormField>
        <Button type="submit" variant="gold" loading={record.isPending} disabled={disabled}>
          Lançar pontos iniciais
        </Button>
      </form>
      <p className="mt-2 text-[11px] font-semibold text-muted">{hint}</p>
    </section>
  )
}
