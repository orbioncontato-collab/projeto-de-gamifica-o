import { Link } from '@tanstack/react-router'
import { MailCheck, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTile } from '@/components/shared/icon-tile'

export interface SignupSuccessProps {
  /** `true` quando *Confirm email* está ligado (sem sessão após o signUp) */
  needsEmailConfirmation: boolean
  /** `true` no modo `team_code` — texto fixo sobre a aprovação do gestor */
  awaitsApproval: boolean
}

/** "Cadastro enviado" (FRONTEND-ARCH §2.1/§3.3): variante e-mail explica a confirmação e, se for o caso, a aprovação. */
export function SignupSuccess({ needsEmailConfirmation, awaitsApproval }: SignupSuccessProps) {
  const title = needsEmailConfirmation ? 'Confirme seu e-mail' : 'Cadastro enviado'
  return (
    <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
      <IconTile icon={needsEmailConfirmation ? MailCheck : UserCheck} tone="success" size="lg" />
      <h2 className="mt-4 text-xl font-black tracking-tight">{title}</h2>
      {needsEmailConfirmation ? (
        <p className="mt-2 text-sm text-muted">
          Enviamos um link de confirmação para o seu e-mail. Abra-o para ativar a conta.
        </p>
      ) : null}
      {awaitsApproval ? (
        <p className="mt-2 text-sm text-muted">
          {needsEmailConfirmation ? 'Depois de confirmar, seu' : 'Seu'} cadastro ainda passa pela aprovação de
          um gestor — você será avisado quando o acesso for liberado.
        </p>
      ) : null}
      <Button asChild className="mt-6 w-full" size="lg">
        <Link to="/login">Voltar ao login</Link>
      </Button>
    </div>
  )
}
