import type { WheelKind } from '@/lib/database.types'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { QueueAddForm } from './queue-add-form'
import { QueueList } from './queue-list'

const QUICK_ROWS = 3

/** Painel compacto acima da roda (só admin): adicionar rápido + primeiras posições. */
export function QueueQuickPanel({ wheelKind, queueCount }: { wheelKind: WheelKind; queueCount: number }) {
  return (
    <PremiumCard as="section" tone="gold" padding="sm" aria-label="Fila rápida">
      <SectionHeader
        eyebrow="Fila rápida"
        title={queueCount > 0 ? `${queueCount} na fila` : 'Adicionar à fila'}
      />
      <div className="flex flex-col gap-3">
        <QueueAddForm defaultWheelKind={wheelKind} compact />
        {queueCount > 0 ? <QueueList limit={QUICK_ROWS} /> : null}
      </div>
    </PremiumCard>
  )
}
