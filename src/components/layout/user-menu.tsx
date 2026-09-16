import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, LogOut, Settings, User } from 'lucide-react'
import { useLogout, useMe } from '@/features/auth/hooks'
import { JOB_TITLE_LABELS } from '@/lib/labels'
import { Avatar } from '@/components/shared/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { userSubtitle } from './user-subtitle'

/** Avatar + nome + cargo/nível; itens: Perfil, Configurações, Sair. */
export function UserMenu() {
  const { me, isAdmin } = useMe()
  const navigate = useNavigate()
  const logout = useLogout()
  const subtitle = userSubtitle(isAdmin, JOB_TITLE_LABELS[me.job_title], me.level)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-11 max-w-[240px] items-center gap-2 rounded-2xl border border-transparent px-1.5 text-left transition hover:border-line hover:bg-surface-hover focus-visible:outline-none data-[state=open]:border-line data-[state=open]:bg-surface-hover"
        aria-label={`Menu do usuário: ${me.full_name}`}
      >
        <Avatar name={me.full_name} color={me.color} avatarPath={me.avatar_path} size="sm" />
        <span className="hidden min-w-0 leading-tight md:block">
          <span className="block truncate text-[13px] font-black text-text">{me.full_name}</span>
          <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            {subtitle}
          </span>
        </span>
        <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted md:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-sm font-black text-text">{me.full_name}</span>
          <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            {subtitle}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: '/perfil' })}>
          <User aria-hidden="true" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: '/configuracoes' })}>
          <Settings aria-hidden="true" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => logout.mutate()}
          disabled={logout.isPending}
          className="text-red-soft"
        >
          <LogOut aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
