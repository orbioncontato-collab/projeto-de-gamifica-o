import { X } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { PersonPicker } from '@/features/profiles/components/person-picker'
import { useActiveProfiles } from '@/features/profiles/hooks'

export interface ParticipantsPickerProps {
  value: string[]
  onChange: (ids: string[]) => void
  /** limite de participantes (ex.: duelo = 2) */
  max?: number
  id?: string
  disabled?: boolean
}

/** `PersonPicker` múltiplo (compartilhado por Missões e Desafios — promovido de `features/missions`, handoff WP3): adiciona um colaborador por vez e lista os escolhidos como chips removíveis. */
export function ParticipantsPicker({ value, onChange, max, id, disabled }: ParticipantsPickerProps) {
  const profiles = useActiveProfiles()
  const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]))
  const isFull = max !== undefined && value.length >= max

  return (
    <div className="flex flex-col gap-2">
      <PersonPicker
        {...(id ? { id } : {})}
        value={null}
        onChange={(pid) => {
          if (pid && !value.includes(pid)) onChange([...value, pid])
        }}
        excludeIds={value}
        placeholder={isFull ? 'Limite de participantes atingido' : 'Adicionar colaborador'}
        disabled={disabled === true || isFull}
        aria-label="Adicionar participante"
      />
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Participantes selecionados">
          {value.map((pid) => {
            const p = byId.get(pid)
            const name = p?.full_name ?? 'Colaborador'
            return (
              <li
                key={pid}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1 pl-1 pr-1 text-xs font-semibold text-text-2"
              >
                <Avatar name={name} color={p?.color ?? ''} avatarPath={p?.avatar_path ?? null} size="xs" />
                <span className="max-w-[10rem] truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== pid))}
                  disabled={disabled}
                  aria-label={`Remover ${name}`}
                  className="grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-surface-hover hover:text-text"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
