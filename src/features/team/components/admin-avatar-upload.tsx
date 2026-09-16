import { useRef, useState } from 'react'
import { Camera, Eraser } from 'lucide-react'
import type { VProfileStats } from '@/lib/database.types'
import { AVATAR_MIME } from '@/lib/supabase'
import { isCode, RPC_MESSAGES } from '@/lib/rpc-errors'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'
import { useAdminUploadAvatar } from '../hooks'
import { cleanupAvatarFolder } from '../api'

/**
 * Foto do colaborador pelo gestor (DoD WP6): valida ≤ 1,5 MB / MIME antes do envio, limpa `avatars/<profileId>`
 * antes de subir, remove a anterior após gravar; 403 (`AVATAR_QUOTA`) mostra o aviso + "Limpar fotos antigas".
 */
export function AdminAvatarUpload({ profile }: { profile: VProfileStats }) {
  const upload = useAdminUploadAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [quotaHit, setQuotaHit] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  const send = (file: File) => {
    setPendingFile(file)
    upload.mutate(
      { profileId: profile.profile_id, currentAvatarPath: profile.avatar_path, file },
      {
        onSuccess: () => {
          setQuotaHit(false)
          setPendingFile(null)
        },
        onError: (error) => {
          if (isCode(error, 'AVATAR_QUOTA')) setQuotaHit(true)
        },
      },
    )
  }

  const cleanAndRetry = async () => {
    setCleaning(true)
    try {
      const removed = await cleanupAvatarFolder(profile.profile_id, profile.avatar_path)
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
    <div className="flex items-center gap-4">
      <Avatar
        name={profile.full_name}
        color={profile.color}
        avatarPath={profile.avatar_path}
        size="lg"
        ring
      />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_MIME.join(',')}
          className="sr-only"
          aria-label="Escolher foto do colaborador"
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
