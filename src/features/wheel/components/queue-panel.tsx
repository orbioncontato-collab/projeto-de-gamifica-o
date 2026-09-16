import { useState } from 'react'
import { Search } from 'lucide-react'
import type { WheelKind } from '@/lib/database.types'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { Input } from '@/components/ui/input'
import { QueueAddForm } from './queue-add-form'
import { QueueList } from './queue-list'

/** Painel completo abaixo da roda (só admin): busca, adicionar, lista com edição, liberar, remover. */
export function QueuePanel({ wheelKind, queueCount }: { wheelKind: WheelKind; queueCount: number }) {
  const [search, setSearch] = useState('')
  return (
    <PremiumCard as="section" aria-label="Fila da roleta">
      <SectionHeader
        eyebrow="Fila do gestor"
        title="Fila da roleta"
        action={
          <div className="relative w-full md:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={16}
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar na fila"
              aria-label="Buscar na fila"
              className="pl-9"
              disabled={queueCount === 0}
            />
          </div>
        }
      />
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-line bg-surface-deep p-3 md:p-4">
          <QueueAddForm defaultWheelKind={wheelKind} />
        </div>
        <QueueList search={search} />
      </div>
    </PremiumCard>
  )
}
