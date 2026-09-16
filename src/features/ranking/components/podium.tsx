import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { cn } from '@/lib/utils'
import { formatPoints } from '@/lib/format'
import { medalFor } from '@/lib/gamification'
import type { PodiumSlot } from '../ranking-utils'

const PLACE_STYLE = {
  1: { height: 'h-32', bar: 'border-gold/40 bg-gold/15 text-gold', avatar: 'xl' as const, label: '1º' },
  2: { height: 'h-24', bar: 'border-silver/40 bg-silver/15 text-silver', avatar: 'lg' as const, label: '2º' },
  3: { height: 'h-20', bar: 'border-bronze/40 bg-bronze/15 text-bronze', avatar: 'lg' as const, label: '3º' },
} as const

/** Pódio 2º · 1º · 3º com alturas, medalhas e glow no 1º (Apêndice A); vagas sem gente = "vaga em aberto" (§9). */
export function Podium({ slots, meId }: { slots: PodiumSlot[]; meId: string }) {
  return (
    <ol className="grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Pódio">
      {slots.map(({ place, row }) => {
        const style = PLACE_STYLE[place]
        const isMe = row?.profile_id === meId
        return (
          <li
            key={place}
            className="flex min-w-0 flex-col items-center gap-2 text-center"
            aria-label={`${style.label} lugar`}
          >
            {row ? (
              <>
                <div className="relative">
                  <Avatar
                    name={row.full_name}
                    color={row.color}
                    avatarPath={row.avatar_path}
                    size={style.avatar}
                    ring={place === 1}
                    className={place === 1 ? 'podium-glow' : ''}
                  />
                  <span className="absolute -right-2 -top-2 text-xl" aria-hidden="true">
                    {medalFor(place)}
                  </span>
                </div>
                <div className="min-w-0 max-w-full">
                  <div className="break-safe truncate text-xs font-black text-text sm:text-sm">
                    {row.full_name}
                  </div>
                  <div className="nums text-[11px] font-bold text-muted">{formatPoints(row.points)}</div>
                  {isMe ? (
                    <div className="mt-1">
                      <Badge tone="green">Você</Badge>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div
                  className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-line-strong bg-surface text-muted-3"
                  aria-hidden="true"
                >
                  {medalFor(place)}
                </div>
                <div className="text-[11px] font-bold text-muted">vaga em aberto</div>
                <div className="text-[10px] font-semibold text-muted-3">aguardando</div>
              </>
            )}
            <div
              className={cn(
                'flex w-full items-start justify-center rounded-t-2xl border border-b-0 pt-3 text-2xl font-black',
                style.height,
                style.bar,
              )}
            >
              {style.label}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
