import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bell, Settings2, Zap } from 'lucide-react'
import { PageFrame } from '@/components/shared/page-frame'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { IconTile } from '@/components/shared/icon-tile'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ThemeSwitch } from '@/features/theme/theme-switch'
import { useMe } from '@/features/auth/bootstrap-query'
import { useUpdateMyPreferences } from '@/features/auth/hooks'
import type { LucideIcon } from 'lucide-react'

interface PrefRowProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled: boolean
}

function PrefRow({ id, icon, title, description, checked, onChange, disabled }: PrefRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={id} className="flex min-w-0 items-center gap-3">
        <IconTile icon={icon} tone="green" size="sm" />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-text">{title}</span>
          <span className="block text-xs text-muted">{description}</span>
        </span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

/** /configuracoes — preferências pessoais (todos): notificações, alertas de evento, tema (FEATURE §13). */
export function PreferencesPage() {
  const { me, isAdmin } = useMe()
  const update = useUpdateMyPreferences()
  const [notifications, setNotifications] = useState(me.preferences.notifications)
  const [eventAlerts, setEventAlerts] = useState(me.preferences.event_alerts)
  const dirty = notifications !== me.preferences.notifications || eventAlerts !== me.preferences.event_alerts
  const busy = update.isPending

  const save = () => {
    update.mutate({ notifications, event_alerts: eventAlerts })
  }

  return (
    <PageFrame
      eyebrow="Conta"
      title="Configurações"
      subtitle="Escolha como quer ser avisado e a aparência do app."
      action={
        isAdmin ? (
          <Button asChild variant="secondary" size="sm">
            <Link to="/admin/configuracoes" search={{ aba: 'geral' }}>
              <Settings2 aria-hidden="true" /> Plataforma
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <PremiumCard as="section" padding="lg">
          <SectionHeader eyebrow="Avisos" title="Notificações" />
          <div className="mt-2 divide-y divide-line">
            <PrefRow
              id="pref-notifications"
              icon={Bell}
              title="Notificações no app"
              description="Ranking, missões, recompensas e roleta."
              checked={notifications}
              onChange={setNotifications}
              disabled={busy}
            />
            <PrefRow
              id="pref-event-alerts"
              icon={Zap}
              title="Alertas de evento especial"
              description="Aviso quando um multiplicador de pontos começar."
              checked={eventAlerts}
              onChange={setEventAlerts}
              disabled={busy}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} loading={busy} disabled={!dirty}>
              Salvar preferências
            </Button>
          </div>
        </PremiumCard>

        <PremiumCard as="section" padding="lg">
          <SectionHeader eyebrow="Aparência" title="Tema" />
          <p className="mt-2 text-sm text-muted">
            Escolha entre o modo escuro e o claro. A preferência fica salva neste dispositivo.
          </p>
          <div className="mt-4">
            <ThemeSwitch />
          </div>
        </PremiumCard>
      </div>
    </PageFrame>
  )
}
