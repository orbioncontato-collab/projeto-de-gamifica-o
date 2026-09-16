import { Link } from '@tanstack/react-router'
import { UserCheck } from 'lucide-react'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { Switch } from '@/components/ui/switch'
import type { AppSettingsRow } from '@/lib/database.types'
import { useUpdateAppSettings } from '../hooks'

export interface MemberApprovalCardProps {
  settings: AppSettingsRow
}

/**
 * Toggle "Aprovar novos membros automaticamente" = `app_settings.auto_approve_members` (DATA-MODEL Apêndice B.21).
 * Vale só para cadastros futuros: quem já está pendente continua em Equipe › Pendentes.
 */
export function MemberApprovalCard({ settings }: MemberApprovalCardProps) {
  const update = useUpdateAppSettings()
  const busy = update.isPending
  const enabled = settings.auto_approve_members

  return (
    <PremiumCard as="section" padding="lg">
      <SectionHeader eyebrow="Entrada" title="Aprovação de membros" />
      <div className="mt-4 flex items-start justify-between gap-4">
        <label htmlFor="auto-approve-members" className="flex min-w-0 items-start gap-3">
          <IconTile icon={UserCheck} tone={enabled ? 'gold' : 'green'} size="sm" />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-text">Aprovar novos membros automaticamente</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              <strong className="text-text-2">Desligado (recomendado):</strong> cada cadastro com o código
              fica em{' '}
              <Link
                to="/admin/equipe"
                search={{ pendentes: true }}
                className="font-bold text-accent underline-offset-2 hover:underline"
              >
                Equipe › Pendentes
              </Link>{' '}
              até um gestor aprovar. <strong className="text-text-2">Ligado:</strong> quem tiver o código
              entra na hora — use só com confirmação de e-mail ativa.
            </span>
          </span>
        </label>
        <Switch
          id="auto-approve-members"
          checked={enabled}
          disabled={busy}
          aria-busy={busy || undefined}
          onCheckedChange={(v) => update.mutate({ auto_approve_members: v })}
        />
      </div>
      <p className="mt-3 text-xs text-muted-2">
        A mudança vale só para cadastros futuros; quem já está pendente continua aguardando aprovação.
      </p>
    </PremiumCard>
  )
}
