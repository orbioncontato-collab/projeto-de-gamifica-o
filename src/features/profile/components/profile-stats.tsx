import { CalendarCheck, Percent, Trophy, TrendingUp } from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import { profileStatItems, type ProfileNumbers } from '../profile-utils'

const ICONS = [TrendingUp, CalendarCheck, Percent, Trophy] as const
const TONES = ['green', 'blue', 'purple', 'gold'] as const

/** 4 stats do Perfil: Vendas R$, Reuniões, Conversão %, Posição (FEATURE §9). */
export function ProfileStats({ numbers }: { numbers: ProfileNumbers }) {
  const items = profileStatItems(numbers)
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {items.map((item, i) => (
        <StatCard
          key={item.label}
          label={item.label}
          value={item.value}
          icon={ICONS[i] ?? Trophy}
          tone={TONES[i] ?? 'green'}
          hint="na temporada"
        />
      ))}
    </div>
  )
}
