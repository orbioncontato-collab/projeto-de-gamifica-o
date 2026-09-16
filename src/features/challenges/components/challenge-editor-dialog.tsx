import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useZodForm } from '@/lib/forms'
import { getErrorMessage, isCode } from '@/lib/rpc-errors'
import type { VChallengeBoard } from '@/lib/database.types'
import { useMe } from '@/features/auth/hooks'
import { challengeFormDefaults, checkChallengeWindow, toSaveChallengeInput } from '../challenge-logic'
import { useSaveChallenge } from '../hooks'
import { challengeFormSchema, type ChallengeFormInput, type ChallengeFormValues } from '../schemas'
import { ChallengeIdentityFields, ChallengeRewardFields } from './challenge-form-fields'

export interface ChallengeEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = novo desafio; só rascunhos podem ser editados (`CHALLENGE_NOT_DRAFT`) */
  challenge: VChallengeBoard | null
}

/** Editor de desafio (admin): duelo exige 2 participantes; coletivo sem participantes = todos; janela validada no cliente. */
export function ChallengeEditorDialog({ open, onOpenChange, challenge }: ChallengeEditorDialogProps) {
  const { season, settings } = useMe()
  const tz = settings.timezone
  const save = useSaveChallenge()
  const form = useZodForm<ChallengeFormInput, ChallengeFormValues>(
    challengeFormSchema,
    challengeFormDefaults(challenge, tz),
  )
  const { reset, setError, handleSubmit } = form

  useEffect(() => {
    if (open) reset(challengeFormDefaults(challenge, tz))
  }, [open, challenge, tz, reset])

  const busy = save.isPending

  const onSubmit = handleSubmit(async (values) => {
    const window = checkChallengeWindow(values, season, tz)
    if (!window.ok) {
      setError(window.field, { message: window.message })
      return
    }
    try {
      await save.mutateAsync(toSaveChallengeInput(values, window, challenge?.challenge_id))
      onOpenChange(false)
    } catch (error) {
      if (
        isCode(error, 'DUEL_NEEDS_TWO') ||
        isCode(error, 'TEAM_NEEDS_TWO') ||
        isCode(error, 'PARTICIPANT_INACTIVE')
      )
        setError('participantIds', { message: getErrorMessage(error) })
      else if (isCode(error, 'CHALLENGE_WINDOW_INVALID'))
        setError('endsAt', { message: getErrorMessage(error) })
      else if (isCode(error, 'CHALLENGE_NOT_DRAFT')) setError('name', { message: getErrorMessage(error) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent aria-describedby="challenge-editor-description">
        <DialogHeader>
          <DialogTitle>{challenge ? 'Editar desafio' : 'Novo desafio'}</DialogTitle>
          <DialogDescription id="challenge-editor-description">
            {season
              ? `Nasce como rascunho; ative quando estiver pronto. O período precisa caber na temporada "${season.name}".`
              : 'Sem temporada ativa: ative uma temporada antes de criar desafios.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <ChallengeIdentityFields form={form} disabled={busy} />
          <ChallengeRewardFields form={form} disabled={busy} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={busy || !season}>
              {challenge ? 'Salvar rascunho' : 'Criar rascunho'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
