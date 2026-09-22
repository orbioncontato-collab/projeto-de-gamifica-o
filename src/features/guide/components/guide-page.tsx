import { Link } from '@tanstack/react-router'
import { ArrowRight, Settings2 } from 'lucide-react'
import { IconTile } from '@/components/shared/icon-tile'
import { PageFrame } from '@/components/shared/page-frame'
import { PremiumCard } from '@/components/shared/premium-card'
import { SectionHeader } from '@/components/shared/section-header'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import {
  GUIDE_CHECKLIST,
  GUIDE_CHECKLIST_ICON,
  GUIDE_STEPS,
  type GuideLink,
  type GuideStep,
} from '../guide-steps'

/** /admin/guia — página estática: 9 passos de implantação + checklist (DATA-MODEL Apêndice C). */
export function GuidePage() {
  return (
    <PageFrame
      eyebrow="Administração"
      title="Guia de uso"
      subtitle="Como colocar a liga de vendas no ar em 9 passos, na ordem que evita retrabalho."
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/configuracoes" search={{ aba: 'geral' }}>
            <Settings2 aria-hidden="true" /> Configurações
          </Link>
        </Button>
      }
    >
      <ol className="space-y-3" aria-label="Passos de implantação">
        {GUIDE_STEPS.map((step, index) => (
          <li key={step.id}>
            <StepCard step={step} index={index + 1} />
          </li>
        ))}
      </ol>

      <PremiumCard as="section" padding="lg" tone="green" className="mt-6">
        <SectionHeader eyebrow="Antes de liberar para o time" title="Checklist de implantação" />
        <ul className="mt-3 divide-y divide-line">
          {GUIDE_CHECKLIST.map((item) => {
            const Icon = GUIDE_CHECKLIST_ICON
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="flex-1 text-text-2">{item.label}</span>
                <GuideLinkButton link={item.link} />
              </li>
            )
          })}
        </ul>
      </PremiumCard>
    </PageFrame>
  )
}

function StepCard({ step, index }: { step: GuideStep; index: number }) {
  const Icon = step.icon
  return (
    <PremiumCard as="article" padding="md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3 sm:w-14 sm:flex-col sm:items-center">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-2">
            Passo {formatNumber(index)}
          </span>
          <IconTile icon={Icon} tone={step.tone} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-text">{step.title}</h2>
          <p className="mt-1 text-sm text-text-2">{step.summary}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
            {step.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="sm:self-center">
          <GuideLinkButton link={step.link} primary />
        </div>
      </div>
    </PremiumCard>
  )
}

function GuideLinkButton({ link, primary = false }: { link: GuideLink; primary?: boolean }) {
  const { label, ...to } = link
  return (
    <Button asChild variant={primary ? 'secondary' : 'ghost'} size="sm">
      <Link {...to}>
        {label} <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  )
}
