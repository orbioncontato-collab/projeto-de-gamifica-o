import type { VProfileStats } from '@/lib/database.types'
import { JOB_TITLE_LABELS } from '@/lib/labels'
import type { Tone } from '@/components/shared/types'

/** Funções puras da Equipe (testadas em `team-utils.test.ts`). */

const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Busca no cliente por nome, e-mail, cargo (rótulo pt-BR) e equipe — sem acento e sem caixa. */
export function filterRoster(rows: readonly VProfileStats[], search: string): VProfileStats[] {
  const q = normalize(search)
  if (!q) return [...rows]
  return rows.filter((r) =>
    [r.full_name, r.email ?? '', JOB_TITLE_LABELS[r.job_title], r.team ?? ''].some((v) =>
      normalize(v).includes(q),
    ),
  )
}

/** Mapa do `StatusPill` da Equipe: active=success, pending=warning, inactive=muted (lib/labels). */
export const PROFILE_STATUS_PILL: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Ativo', tone: 'success' },
  pending: { label: 'Pendente', tone: 'warning' },
  inactive: { label: 'Inativo', tone: 'muted' },
}

/** Pendente aparece na tabela "sem ações de pontos" (DoD WP6); só perfil ativo recebe pontos iniciais. */
export const canReceivePoints = (status: VProfileStats['status']): boolean => status === 'active'

/** Próximo status ao clicar em Inativar/Reativar (pendente não passa por aqui — usa Aprovar/Recusar). */
export const toggledStatus = (status: VProfileStats['status']): 'active' | 'inactive' =>
  status === 'active' ? 'inactive' : 'active'

export const SIGNUP_PATH = '/signup'

/** Link absoluto de cadastro (a origem vem do navegador; sem env). */
export const signupUrl = (origin: string): string => `${origin.replace(/\/$/, '')}${SIGNUP_PATH}`
