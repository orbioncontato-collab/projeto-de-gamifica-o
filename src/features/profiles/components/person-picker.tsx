import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar } from '@/components/shared/avatar'
import { JOB_TITLE_LABELS } from '@/lib/labels'
import { useActiveProfiles } from '../hooks'

export interface PersonPickerProps {
  value: string | null
  onChange: (profileId: string | null) => void
  excludeIds?: readonly string[]
  placeholder?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
}

/** Select de colaborador ativo com avatar + nome (só `status = 'active'`, FRONTEND-ARCH §4.5). */
export function PersonPicker({
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Selecione um colaborador',
  disabled,
  id,
  'aria-label': ariaLabel,
}: PersonPickerProps) {
  const profiles = useActiveProfiles()
  const options = (profiles.data ?? []).filter((p) => !excludeIds.includes(p.id))
  const isEmpty = profiles.isSuccess && options.length === 0

  return (
    <Select
      value={value ?? ''}
      onValueChange={(v) => onChange(v || null)}
      disabled={disabled || profiles.isPending || isEmpty}
    >
      <SelectTrigger id={id} aria-label={ariaLabel ?? 'Colaborador'}>
        <SelectValue
          placeholder={
            profiles.isPending ? 'Carregando…' : isEmpty ? 'Nenhum colaborador ativo' : placeholder
          }
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="flex items-center gap-2">
              <Avatar name={p.full_name} color={p.color} avatarPath={p.avatar_path} size="xs" />
              <span className="flex flex-col leading-tight">
                <span>{p.full_name}</span>
                <span className="text-[10px] font-semibold text-muted-2">
                  {JOB_TITLE_LABELS[p.job_title]}
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
