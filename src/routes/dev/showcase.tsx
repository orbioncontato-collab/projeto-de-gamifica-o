import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { ThemeSwitch } from '@/features/theme/theme-switch'
import { useTheme } from '@/features/theme/use-theme'
import { readAvatarPresets } from '@/features/profile/schemas'
import { SharedDemos } from '@/components/shared/__demo__/demo-shared'
import { UiDemos } from '@/components/shared/__demo__/demo-ui'

/**
 * /dev/showcase — todos os componentes de `components/shared` e `components/ui` nos dois temas, lado a lado.
 * Sem dados de pessoas: só catálogo (DATA-MODEL §13) e valores numéricos.
 * O seletor de largura simula 320/375/768/1024 px por coluna para conferir overflow horizontal.
 */
export const Route = createFileRoute('/dev/showcase')({
  component: ShowcasePage,
})

const WIDTHS = [
  { label: 'Auto', value: 0 },
  { label: '320', value: 320 },
  { label: '375', value: 375 },
  { label: '768', value: 768 },
  { label: '1024', value: 1024 },
] as const

const SECTIONS = [
  { key: 'shared', label: 'Compartilhados' },
  { key: 'ui', label: 'Primitivos (ui)' },
] as const
type SectionKey = (typeof SECTIONS)[number]['key']

/** Cores de exemplo para `profiles.color` (hex de 6 dígitos, DATA-MODEL §4.6) lidas dos tokens do tema em runtime. */
const FALLBACK_AVATAR_COLORS: readonly string[] = ['var(--avatar-fallback)']

function ShowcasePage() {
  const [width, setWidth] = useState<number>(0)
  const [section, setSection] = useState<SectionKey>('shared')
  const { theme } = useTheme()
  const avatarColors = useMemo(() => {
    const presets = readAvatarPresets()
    return presets.length > 0 ? presets : FALLBACK_AVATAR_COLORS
    // recalcula quando o tema muda (os tokens mudam de valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Desenvolvimento</div>
            <h1 className="text-2xl font-black tracking-tight">Vitrine de componentes</h1>
            <p className="text-sm text-muted">
              Cada coluna força um tema via <code>data-theme</code>; o seletor troca o tema global.
            </p>
          </div>
          <ThemeSwitch />
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Seção"
            className="inline-flex gap-1 rounded-xl border border-line bg-surface p-[3px]"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={section === s.key}
                onClick={() => setSection(s.key)}
                className={cn(
                  'min-h-9 rounded-[9px] px-3 text-[11px] font-black uppercase tracking-wide transition',
                  section === s.key ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label="Largura simulada"
            className="inline-flex gap-1 rounded-xl border border-line bg-surface p-[3px]"
          >
            {WIDTHS.map((w) => (
              <button
                key={w.value}
                type="button"
                aria-pressed={width === w.value}
                onClick={() => setWidth(w.value)}
                className={cn(
                  'nums min-h-9 rounded-[9px] px-3 text-[11px] font-black uppercase tracking-wide transition',
                  width === w.value ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className={cn('grid gap-6', width === 0 && 'xl:grid-cols-2')}>
          {(['dark', 'light'] as const).map((theme) => (
            <section
              key={theme}
              data-theme={theme}
              aria-label={`Tema ${theme === 'dark' ? 'escuro' : 'claro'}`}
              style={width ? { width: `${width}px`, maxWidth: '100%' } : undefined}
              className="overflow-x-auto rounded-2xl border border-line bg-bg p-4 text-text md:p-6"
            >
              <div className="mb-4 text-xs font-black uppercase tracking-wide text-muted">
                Tema {theme === 'dark' ? 'escuro' : 'claro'}
                {width ? <span className="nums ml-2 text-muted-2">· {width}px</span> : null}
              </div>
              {section === 'shared' ? <SharedDemos avatarColors={avatarColors} /> : <UiDemos />}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
