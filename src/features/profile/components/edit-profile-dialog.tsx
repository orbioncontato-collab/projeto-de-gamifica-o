import { useEffect, useMemo } from 'react'
import { Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/form-field'
import { useMe } from '@/features/auth/bootstrap-query'
import { useUpdateMyProfile } from '@/features/auth/hooks'
import { useZodForm } from '@/lib/forms'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  diffProfilePatch,
  editProfileSchema,
  isHexColor,
  readAvatarPresets,
  type EditProfileInput,
  type EditProfileOutput,
} from '../schemas'
import { AvatarUpload } from './avatar-upload'

export interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** "Editar perfil" (FEATURE §9): nome, cor do avatar e foto; usa `useUpdateMyProfile`/`useUploadMyAvatar`. */
export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const { me } = useMe()
  const update = useUpdateMyProfile()
  const form = useZodForm<EditProfileInput, EditProfileOutput>(editProfileSchema, {
    full_name: me.full_name,
    color: isHexColor(me.color) ? me.color : '',
  })
  const { reset } = form
  const presets = useMemo(() => readAvatarPresets(), [])

  useEffect(() => {
    if (open) reset({ full_name: me.full_name, color: isHexColor(me.color) ? me.color : '' })
  }, [open, me.full_name, me.color, reset])

  const onSubmit = form.handleSubmit((values) => {
    const patch = diffProfilePatch({ full_name: me.full_name, color: me.color }, values)
    if (!patch) {
      onOpenChange(false)
      return
    }
    update.mutate(patch, {
      onSuccess: () => onOpenChange(false),
      onError: (error) => notify.error(error, 'Não foi possível salvar o perfil'),
    })
  })

  const nameError = form.formState.errors.full_name?.message
  const colorError = form.formState.errors.color?.message

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>
            Nome, cor do avatar e foto. Cargo e equipe quem altera é o gestor.
          </DialogDescription>
        </DialogHeader>
        <AvatarUpload />
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <FormField
            label="Nome"
            htmlFor="edit-profile-name"
            required
            {...(nameError ? { error: nameError } : {})}
          >
            <Input
              id="edit-profile-name"
              autoComplete="name"
              maxLength={80}
              {...form.register('full_name')}
            />
          </FormField>
          <FormField
            label="Cor do avatar"
            htmlFor="edit-profile-color"
            hint="Usada nas iniciais quando não há foto"
            {...(colorError ? { error: colorError } : {})}
          >
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <div className="flex flex-wrap items-center gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-label={`Cor ${preset}`}
                      aria-pressed={field.value.toUpperCase() === preset.toUpperCase()}
                      onClick={() => field.onChange(preset)}
                      className={cn(
                        'h-11 w-11 rounded-xl border-2 transition',
                        field.value.toUpperCase() === preset.toUpperCase()
                          ? 'border-text scale-105'
                          : 'border-transparent',
                      )}
                      style={{ background: preset }}
                    />
                  ))}
                  <input
                    id="edit-profile-color"
                    type="color"
                    aria-label="Cor personalizada"
                    className="h-11 w-11 cursor-pointer rounded-xl border border-line bg-surface p-1"
                    value={isHexColor(field.value) ? field.value : (presets[0] ?? '')}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </div>
              )}
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={update.isPending} disabled={update.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
