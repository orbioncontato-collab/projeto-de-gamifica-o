import { useNavigate } from '@tanstack/react-router'
import { KeyRound, Rocket, Target, TrendingUp } from 'lucide-react'
import { IconTile } from '@/components/shared/icon-tile'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'

/** Card de onboarding do gestor com 4 passos e links (FRONTEND-ARCH §9 — Visão do gestor, banco sem dados). */
export function OnboardingCard() {
  const navigate = useNavigate()
  const steps = [
    {
      icon: Target,
      title: 'Defina a meta do time',
      body: 'A temporada do mês nasce com meta R$ 0.',
      go: () => void navigate({ to: '/admin/configuracoes', search: { aba: 'temporadas' } }),
    },
    {
      icon: KeyRound,
      title: 'Compartilhe o código da equipe',
      body: 'Cada colaborador se cadastra com o código e você aprova em Pendentes.',
      go: () => void navigate({ to: '/admin/configuracoes', search: { aba: 'codigo' } }),
    },
    {
      icon: TrendingUp,
      title: 'Lance a primeira venda',
      body: 'Pontos, moedas e o feed começam no primeiro lançamento.',
      go: () => void navigate({ to: '/admin/pontuacao', search: { aba: 'lancar' } }),
    },
    {
      icon: Rocket,
      title: 'Crie a primeira missão',
      body: 'Missões diárias mantêm o time engajado todo dia.',
      go: () => void navigate({ to: '/missoes', search: { filtro: 'hoje', novo: true } }),
    },
  ]
  return (
    <PremiumCard as="section" tone="green" aria-labelledby="onboarding-title">
      <SectionHeader eyebrow="Primeiros passos" title="Coloque a operação para rodar" />
      <span id="onboarding-title" className="sr-only">
        Primeiros passos
      </span>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.title}>
            <button
              type="button"
              onClick={step.go}
              className="flex min-h-11 w-full items-start gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:bg-surface-hover"
            >
              <IconTile icon={step.icon} tone="green" size="sm" />
              <span className="min-w-0">
                <span className="block text-sm font-black text-text">
                  {i + 1}. {step.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{step.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </PremiumCard>
  )
}
