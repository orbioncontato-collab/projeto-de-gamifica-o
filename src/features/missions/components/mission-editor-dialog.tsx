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
import { isCode, getErrorMessage } from '@/lib/rpc-errors'
import { useMe } from '@/features/auth/hooks'
import type { MissionAdminRow } from '../api'
import { useSaveMission } from '../hooks'
import { checkMissionWindow, missionFormDefaults, toSaveMissionInput } from '../mission-window'
import { missionFormSchema, type MissionFormInput, type MissionFormValues } from '../schemas'
import { MissionIdentityFields, MissionRewardFields } from './mission-form-fields'

export interface MissionEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = nova missão */
  mission: MissionAdminRow | null
}

/**
 * Editor de missão (admin). Janela validada contra a temporada no cliente antes de enviar;
 * `MISSION_HAS_PROGRESS` vira erro de campo com a mensagem do catálogo.
 */
export function MissionEditorDialog({ open, onOpenChange, mission }: MissionEditorDialogProps) {
  const { season, settings } = useMe()
  const tz = settings.timezone
  const save = useSaveMission()
  const form = useZodForm<MissionFormInput, MissionFormValues>(
    missionFormSchema,
    missionFormDefaults(mission, tz),
  )
  const { reset, setError, handleSubmit } = form

  useEffect(() => {
    if (open) reset(missionFormDefaults(mission, tz))
  }, [open, mission, tz, reset])

  const busy = save.isPending

  const onSubmit = handleSubmit(async (values) => {
    const window = checkMissionWindow(values, season, tz)
    if (!window.ok) {
      setError(window.field, { message: window.message })
      return
    }
    try {
      await save.mutateAsync(toSaveMissionInput(values, window, mission?.id))
      onOpenChange(false)
    } catch (error) {
      // toast já veio do MutationCache; aqui só o erro de campo mais útil
      if (isCode(error, 'MISSION_HAS_PROGRESS')) setError('kind', { message: getErrorMessage(error) })
      else if (isCode(error, 'MISSION_WINDOW_INVALID') || isCode(error, 'LIGHTNING_TOO_LONG'))
        setError('endsAt', { message: getErrorMessage(error) })
      else if (isCode(error, 'PARTICIPANTS_REQUIRED'))
        setError('participantIds', { message: getErrorMessage(error) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent aria-describedby="mission-editor-description">
        <DialogHeader>
          <DialogTitle>{mission ? 'Editar missão' : 'Nova missão'}</DialogTitle>
          <DialogDescription id="mission-editor-description">
            {season
              ? `A janela precisa caber na temporada "${season.name}". O progresso vem dos lançamentos reais.`
              : 'Sem temporada ativa: ative uma temporada antes de criar missões.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <MissionIdentityFields form={form} disabled={busy} lockTarget={false} />
          <MissionRewardFields form={form} disabled={busy} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={busy || !season}>
              {mission ? 'Salvar alterações' : 'Criar missão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
