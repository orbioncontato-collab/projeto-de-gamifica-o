import { linkOptions, type LinkOptions, type RegisteredRouter } from '@tanstack/react-router'
import {
  BarChart3,
  BookOpen,
  Dices,
  Gift,
  Home,
  Medal,
  Settings,
  Sparkles,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Navegação por papel (FRONTEND-ARCH §3.6). `link` são opções tipadas do router (`linkOptions`);
 * `badge: 'pending_members'` renderiza a pílula com `bootstrap.pending_members` (só admin).
 */
export type AppLinkOptions = LinkOptions<RegisteredRouter, string, string>

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  link: AppLinkOptions
  badge?: 'pending_members'
  /** `exact` para "/" e "/admin" (evita acender em rotas filhas) e para os dois "Desafios" (busca exata) */
  exact?: boolean
  /** compara a busca (`?gerenciar=true`) ao decidir o item ativo; default: só o caminho */
  matchSearch?: boolean
}

export const MAIN_NAV: readonly NavItem[] = [
  { id: 'home', label: 'Visão Geral', icon: Home, link: linkOptions({ to: '/' }), exact: true },
  { id: 'ranking', label: 'Ranking', icon: Trophy, link: linkOptions({ to: '/ranking' }) },
  {
    id: 'missions',
    label: 'Missões',
    icon: Target,
    link: linkOptions({ to: '/missoes', search: { filtro: 'hoje' } }),
  },
  // `exact` também na busca: não acende junto com o item "Desafios" da administração (`?gerenciar=true`)
  {
    id: 'challenges',
    label: 'Desafios',
    icon: Swords,
    link: linkOptions({ to: '/desafios' }),
    exact: true,
    matchSearch: true,
  },
  { id: 'wheel', label: 'Roleta', icon: Sparkles, link: linkOptions({ to: '/roleta' }) },
  {
    id: 'rewards',
    label: 'Recompensas',
    icon: Gift,
    link: linkOptions({ to: '/recompensas', search: { aba: 'loja' } }),
  },
  { id: 'achievements', label: 'Conquistas', icon: Medal, link: linkOptions({ to: '/conquistas' }) },
  { id: 'profile', label: 'Perfil', icon: User, link: linkOptions({ to: '/perfil' }) },
]

/** 8 itens, como o original: Dashboard, Equipe, Pontuação, Desafios (gerenciar), Recompensas, Roleta, Configurações, Guia. */
export const ADMIN_NAV: readonly NavItem[] = [
  {
    id: 'admin-dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    link: linkOptions({ to: '/admin' }),
    exact: true,
  },
  {
    id: 'admin-team',
    label: 'Equipe',
    icon: Users,
    link: linkOptions({ to: '/admin/equipe', search: { pendentes: true } }),
    badge: 'pending_members',
  },
  {
    id: 'admin-points',
    label: 'Pontuação',
    icon: Zap,
    link: linkOptions({ to: '/admin/pontuacao', search: { aba: 'lancar' } }),
  },
  {
    id: 'admin-challenges',
    label: 'Desafios',
    icon: Swords,
    link: linkOptions({ to: '/desafios', search: { gerenciar: true } }),
    exact: true,
    matchSearch: true,
  },
  {
    id: 'admin-rewards',
    label: 'Recompensas',
    icon: Gift,
    link: linkOptions({ to: '/admin/recompensas', search: { aba: 'pedidos' } }),
  },
  { id: 'admin-wheel', label: 'Roleta', icon: Dices, link: linkOptions({ to: '/admin/roleta' }) },
  {
    id: 'admin-settings',
    label: 'Configurações',
    icon: Settings,
    link: linkOptions({ to: '/admin/configuracoes', search: { aba: 'geral' } }),
  },
  { id: 'admin-guide', label: 'Guia de uso', icon: BookOpen, link: linkOptions({ to: '/admin/guia' }) },
]

export const FOOTER_NAV: readonly NavItem[] = [
  { id: 'settings', label: 'Configurações', icon: Settings, link: linkOptions({ to: '/configuracoes' }) },
]

/** 5 atalhos do bottom nav mobile; "Início" para "/". */
export const BOTTOM_NAV: readonly NavItem[] = [
  { id: 'home', label: 'Início', icon: Home, link: linkOptions({ to: '/' }), exact: true },
  { id: 'ranking', label: 'Ranking', icon: Trophy, link: linkOptions({ to: '/ranking' }) },
  {
    id: 'missions',
    label: 'Missões',
    icon: Target,
    link: linkOptions({ to: '/missoes', search: { filtro: 'hoje' } }),
  },
  { id: 'wheel', label: 'Roleta', icon: Sparkles, link: linkOptions({ to: '/roleta' }) },
  { id: 'profile', label: 'Perfil', icon: User, link: linkOptions({ to: '/perfil' }) },
]

/** Item "Equipe" sem `?pendentes=true` quando não há cadastros aguardando (o badge decide). */
export const teamLinkFor = (pendingMembers: number): AppLinkOptions =>
  pendingMembers > 0
    ? linkOptions({ to: '/admin/equipe', search: { pendentes: true } })
    : linkOptions({ to: '/admin/equipe' })

export const pendingBadgeLabel = (n: number): string =>
  `${n} ${n === 1 ? 'cadastro aguardando aprovação' : 'cadastros aguardando aprovação'}`
