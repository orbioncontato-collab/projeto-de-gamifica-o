import { useState } from 'react'
import { Lock, LockOpen, Play, Trash2 } from 'lucide-react'
import type { VWheelQueue, WheelKind } from '@/lib/database.types'
import { QUEUE_SOURCE_LABELS, WHEEL_KIND_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WHEEL_KINDS } from '../api'
import { MAX_ATTEMPTS } from '../schemas'

export interface QueueRowProps {
  row: VWheelQueue
  /** Alguma vez está com spin pendente: liberar/editar/remover ficam bloqueados (`SPIN_PENDING`). */
  spinPending: boolean
  busy: boolean
  onRelease: (queueId: string) => void
  onRemove: (row: VWheelQueue) => void
  onChangeWheel: (queueId: string, kind: WheelKind) => void
  onChangeAttempts: (queueId: string, attempts: number) => void
}

/** Linha da fila: posição, avatar, nome, origem, x/y giros, roleta, tentativas com cadeado, liberar/liberado, remover. */
export function QueueRow({
  row,
  spinPending,
  busy,
  onRelease,
  onRemove,
  onChangeWheel,
  onChangeAttempts,
}: QueueRowProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [draft, setDraft] = useState(String(row.attempts_allowed))
  const isActive = row.status === 'active'
  const locked = spinPending || busy
  const minAttempts = Math.max(row.attempts_used + 1, 1)

  const commitAttempts = () => {
    const n = Number.parseInt(draft, 10)
    if (!Number.isFinite(n) || n === row.attempts_allowed) {
      setDraft(String(row.attempts_allowed))
      return
    }
    const clamped = Math.min(Math.max(n, minAttempts), MAX_ATTEMPTS)
    setDraft(String(clamped))
    onChangeAttempts(row.queue_id, clamped)
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-2xl border px-3 py-3 md:flex-row md:items-center',
        isActive ? 'border-gold/30 bg-gold/5' : 'border-line bg-surface',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-deep text-xs font-black text-muted-2">
          {row.position}
        </span>
        <Avatar name={row.person_name} color={row.color ?? ''} avatarPath={row.avatar_path} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text">{row.person_name}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>{row.profile_id ? 'Colaborador' : 'Convidado'}</span>
            <span aria-hidden="true">•</span>
            <span>{QUEUE_SOURCE_LABELS[row.source]}</span>
            <span aria-hidden="true">•</span>
            <span>
              {row.attempts_used}/{row.attempts_allowed} giros
            </span>
            <Badge tone={row.attempts_remaining > 0 ? 'green' : 'dark'}>
              {row.attempts_remaining} restantes
            </Badge>
            {row.pending_spin_id ? <Badge tone="purple">Aguardando aprovação</Badge> : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={row.wheel_kind}
          onValueChange={(v) => onChangeWheel(row.queue_id, v as WheelKind)}
          disabled={locked}
        >
          <SelectTrigger className="h-11 w-[9.5rem]" aria-label={`Roleta de ${row.person_name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WHEEL_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {WHEEL_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Input
            type="number"
            inputMode="numeric"
            min={minAttempts}
            max={MAX_ATTEMPTS}
            value={draft}
            disabled={!unlocked || locked}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitAttempts}
            onKeyDown={(e) => e.key === 'Enter' && commitAttempts()}
            className="h-11 w-16 text-center"
            aria-label={`Tentativas de ${row.person_name} (até ${MAX_ATTEMPTS})`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={unlocked}
            aria-label={unlocked ? 'Travar tentativas' : 'Destravar tentativas'}
            disabled={locked}
            onClick={() => setUnlocked((v) => !v)}
          >
            {unlocked ? <LockOpen /> : <Lock />}
          </Button>
        </div>

        {isActive ? (
          <Button type="button" variant="gold" size="md" disabled>
            <Play aria-hidden="true" /> Liberado
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={locked || row.attempts_remaining <= 0}
            onClick={() => onRelease(row.queue_id)}
          >
            <Play aria-hidden="true" /> Liberar giro
          </Button>
        )}
        <Button
          type="button"
          variant="danger"
          size="icon"
          aria-label={`Remover ${row.person_name} da fila`}
          disabled={locked}
          onClick={() => onRemove(row)}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
