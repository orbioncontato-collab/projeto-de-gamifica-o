import { cn } from '@/lib/utils'
import { useBranding } from '@/features/branding/hooks'
import { BrandMark } from './brand-mark'

/**
 * Logo da instalação: tile com o símbolo (ou a logo enviada em
 * Configurações → Marca) + nome da empresa + nome da plataforma. Tudo vem de `get_branding`.
 */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  const b = useBranding()
  const label = `${b.company_name} ${b.platform_name}`.trim()
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {b.logo_data_url ? (
        <img
          src={b.logo_data_url}
          alt=""
          data-testid="brand-logo"
          className="h-10 w-10 shrink-0 rounded-2xl object-contain"
        />
      ) : (
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg shadow-[var(--glow-accent)]"
          aria-hidden="true"
        >
          <BrandMark className="h-6 w-6" />
        </div>
      )}
      {!compact ? (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-black tracking-tight text-text">{b.company_name}</div>
          <div className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-accent">
            {b.platform_name}
          </div>
        </div>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  )
}
