import { useId, useRef, useState } from 'react'
import { Camera, Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'
import { useMe } from '@/features/auth/bootstrap-query'
import { useUploadMyAvatar } from '@/features/auth/hooks'
import { cleanupAvatarFolder } from '@/features/auth/api'
import { AVATAR_MIME } from '@/lib/supabase'
import { isCode, RPC_MESSAGES } from '@/lib/rpc-errors'
import { notify } from '@/lib/notify'

/**
 * Foto do perfil (FEATURE §9, DoD WP2): `useUploadMyAvatar` limpa `avatars/<me.id>` antes de subir;
 * 403 (`AVATAR_QUOTA`) mostra "Limpe fotos antigas e tente de novo" + botão que limpa e repete o upload.
 */
export function AvatarUpload() {
  const { me } = useMe()
  const upload = useUploadMyAvatar()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [quotaHit, setQuotaHit] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  const send = (file: File) => {
    setPendingFile(file)
    upload.mutate(file, {
      onSuccess: () => {
        setQuotaHit(false)
        setPendingFile(null)
      },
      onError: (error) => {
        if (isCode(error, 'AVATAR_QUOTA')) setQuotaHit(true)
        notify.error(error, 'Não foi possível enviar a foto')
      },
    })
  }

  const cleanAndRetry = async () => {
    setCleaning(true)
    try {
      const removed = await cleanupAvatarFolder(me.id, me.avatar_path)
      notify.info(
        removed > 0 ? `${removed} foto(s) antiga(s) removida(s)` : 'Nenhuma foto antiga para remover',
      )
      if (pendingFile) send(pendingFile)
      else setQuotaHit(false)
    } finally {
      setCleaning(false)
    }
  }

  const busy = upload.isPending || cleaning
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <Avatar name={me.full_name} color={me.color} avatarPath={me.avatar_path} size="xl" ring />
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={AVATAR_MIME.join(',')}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) send(file)
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={upload.isPending}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera aria-hidden="true" />
          Trocar foto
        </Button>
        <p className="text-[11px] font-semibold text-muted">JPG, PNG ou WebP até 1,5 MB</p>
        {quotaHit ? (
          <div
            className="rounded-xl border border-red/25 bg-red/10 px-3 py-2 text-xs font-semibold text-red-soft"
            role="alert"
          >
            <p>{RPC_MESSAGES['AVATAR_QUOTA']}</p>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="mt-2"
              loading={cleaning}
              disabled={busy}
              onClick={() => void cleanAndRetry()}
            >
              <Eraser aria-hidden="true" />
              Limpar fotos antigas
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
