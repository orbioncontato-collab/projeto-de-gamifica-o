import { useState } from 'react'
import { Check, Copy, KeyRound, Link2 } from 'lucide-react'
import { maskTeamCode } from '@/lib/format'
import { notify } from '@/lib/notify'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { useTeamCode } from '../hooks'
import { SIGNUP_PATH, signupUrl } from '../team-utils'

export interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const COPIED_RESET_MS = 2000

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * "Como adicionar colaboradores" (`?convidar=true`): contas nascem só pelo cadastro com código.
 * Código lido por `useTeamCode()` (sem importar de `features/settings`), mascarado, com copiar e link `/signup`.
 */
export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const code = useTeamCode()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const link = signupUrl(typeof window !== 'undefined' ? window.location.origin : '')

  const copy = async (kind: 'code' | 'link', text: string) => {
    const ok = await copyText(text)
    if (!ok) {
      notify.error(new Error('Copie manualmente.'), 'Não foi possível copiar')
      return
    }
    setCopied(kind)
    notify.success(kind === 'code' ? 'Código copiado' : 'Link copiado')
    window.setTimeout(() => setCopied(null), COPIED_RESET_MS)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Como adicionar colaboradores</DialogTitle>
          <DialogDescription>
            Cada pessoa cria a própria conta em <span className="font-semibold text-text">{SIGNUP_PATH}</span>{' '}
            usando o código da equipe. Você aprova cada cadastro em Pendentes.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 text-sm text-text-2">
          <li className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-2">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              1. Compartilhe o código da equipe
            </p>
            {code.isPending ? (
              <Skeleton className="h-11 w-full" />
            ) : code.isError ? (
              <ErrorState error={code.error} compact onRetry={() => void code.refetch()} />
            ) : (
              <div className="flex items-center gap-2">
                <code className="nums flex-1 rounded-xl border border-line-strong bg-elevated px-3 py-2.5 text-base font-black tracking-[0.2em] text-text">
                  {maskTeamCode(code.data)}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Copiar código da equipe"
                  onClick={() => void copy('code', code.data)}
                >
                  {copied === 'code' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs text-muted">
              Mostrado mascarado por segurança; o botão copia o código completo.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-2">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              2. Envie o link de cadastro
            </p>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate rounded-xl border border-line-strong bg-elevated px-3 py-2.5 text-sm font-semibold text-text">
                {link}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Copiar link de cadastro"
                onClick={() => void copy('link', link)}
              >
                {copied === 'link' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </Button>
            </div>
          </li>
          <li className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-2">
              3. Aprove em Pendentes
            </p>
            <p className="mt-1 text-xs text-muted">
              O cadastro fica aguardando até você aprovar nesta tela. Todos já entraram? Gere um novo código
              em Configurações › Código da equipe.
            </p>
          </li>
        </ol>
        <Button type="button" variant="primary" className="w-full" onClick={() => onOpenChange(false)}>
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  )
}
