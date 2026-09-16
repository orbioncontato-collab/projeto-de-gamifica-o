import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme, type Theme } from './use-theme'

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
]

/** Dois botões Escuro/Claro com `aria-pressed` (topbar e /login). */
export function ThemeSwitch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-[3px]',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={`Tema ${label.toLowerCase()}`}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex min-h-[34px] items-center gap-1.5 rounded-[9px] px-2.5 text-[10px] font-black uppercase tracking-wide transition',
              active
                ? 'bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_14%,transparent)]'
                : 'text-muted-2 hover:text-text-2',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {!compact ? <span className="hidden sm:inline">{label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
