import { useState } from 'react'
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { CardSkeleton } from '@/components/shared/skeletons'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/bootstrap-query'
import { formatDateTime, maskTeamCode } from '@/lib/format'
import { notify } from '@/lib/notify'
import { useAppSecrets, useRotateTeamCode } from '../hooks'
import { hideTeamCode } from '../team-code'

const COPIED_RESET_MS = 2000

/** Código da equipe: mascarado por padrão, mostrar/copiar/gerar novo (DATA-MODEL §4.2, §14.1 passo 7). */
export function TeamCodeCard() {
  const { settings } = useMe()
  const secrets = useAppSecrets()
  const rotate = useRotateTeamCode()
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      notify.success('Código copiado')
      window.setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch (error) {
      notify.error(error, 'Não foi possível copiar')
    }
  }

  if (secrets.isPending) return <CardSkeleton lines={4} />
  if (secrets.isError) return <ErrorState error={secrets.error} onRetry={() => void secrets.refetch()} />
  const code = secrets.data?.team_code ?? ''
  const masked = maskTeamCode(code)
  const shown = revealed ? masked : hideTeamCode(masked)

  return (
    <PremiumCard as="section" padding="lg" tone="green">
      <SectionHeader eyebrow="Convites" title="Código da equipe" />
      <p className="mt-2 text-sm text-muted">
        Quem se cadastra com este código entra na equipe. Compartilhe só com quem deve ter acesso.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface-deep px-4 py-3">
          <IconTile icon={KeyRound} tone="green" size="sm" />
          <code
            className="flex-1 font-mono text-lg font-black tracking-[0.2em] text-text"
            aria-label={revealed ? `Código ${masked}` : 'Código da equipe oculto'}
          >
            {shown}
          </code>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={revealed ? 'Ocultar código' : 'Mostrar código'}
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void copy(code)} disabled={!code}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{' '}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(true)} loading={rotate.isPending}>
            <RefreshCw aria-hidden="true" /> Gerar novo
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-2">
        Todos já entraram? Gere um novo código para invalidar o anterior.
        {secrets.data
          ? ` Último código gerado em ${formatDateTime(secrets.data.team_code_rotated_at, settings.timezone)}.`
          : ''}
      </p>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Gerar novo código?"
        description="O código atual deixa de valer na hora. Quem ainda não se cadastrou vai precisar do novo."
        confirmLabel="Gerar novo código"
        tone="primary"
        loading={rotate.isPending}
        onConfirm={async () => {
          await rotate.mutateAsync()
          setRevealed(true)
        }}
      />
    </PremiumCard>
  )
}
