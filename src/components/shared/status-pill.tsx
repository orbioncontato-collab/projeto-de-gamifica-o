import { Badge } from './badge'
import type { Tone } from './types'

export interface StatusPillProps {
  status: string
  map: Record<string, { label: string; tone: Tone }>
  className?: string
}

/** Status de resgate/desafio/fila/perfil a partir de um mapa rótulo+tom. Status desconhecido cai em cinza. */
export function StatusPill({ status, map, className }: StatusPillProps) {
  const entry = map[status] ?? { label: status, tone: 'dark' as const }
  return (
    <Badge tone={entry.tone} className={className}>
      {entry.label}
    </Badge>
  )
}
