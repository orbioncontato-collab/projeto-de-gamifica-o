import { Construction } from 'lucide-react'
import { PageFrame } from './page-frame'
import { EmptyState } from './empty-state'

export interface UnderConstructionProps {
  eyebrow: string
  title: string
  subtitle?: string
  /** dono do pacote que entrega a tela (só informativo) */
  owner?: string
}

/** Stub de rota (WP0): PageFrame + EmptyState "Em construção". Cada pacote substitui pela tela real. */
export function UnderConstruction({ eyebrow, title, subtitle, owner }: UnderConstructionProps) {
  return (
    <PageFrame eyebrow={eyebrow} title={title} {...(subtitle ? { subtitle } : {})}>
      <EmptyState
        icon={Construction}
        title="Em construção"
        description={owner ? `Esta tela será entregue pelo pacote ${owner}.` : 'Esta tela ainda não foi implementada.'}
      />
    </PageFrame>
  )
}
