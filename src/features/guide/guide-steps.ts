import type { LinkProps } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  ClipboardCheck,
  Gift,
  KeyRound,
  ListChecks,
  Rocket,
  Swords,
  Target,
  Users,
  Zap,
} from 'lucide-react'
import type { Tone } from '@/components/shared/types'

/**
 * Guia de uso — 9 passos de implantação (DATA-MODEL Apêndice C: configurações → código → perfis → regras →
 * missões → desafios → recompensas/prêmios → evento → teste) + checklist. Conteúdo estático, sem dados de pessoas.
 */

/** Destino tipado pelo router (`to` + `search` validados por rota). */
export type GuideLink = Pick<LinkProps, 'to' | 'search'> & { label: string }

export interface GuideStep {
  id: string
  icon: LucideIcon
  tone: Tone
  title: string
  summary: string
  details: readonly string[]
  link: GuideLink
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'settings',
    icon: Building2,
    tone: 'green',
    title: 'Configure a empresa e a temporada',
    summary: 'Nome, XP por nível, fuso horário e a temporada com a meta do time.',
    details: [
      'O fuso trava depois do primeiro lançamento: confira antes de lançar qualquer venda.',
      'A temporada define o período do ranking; sem uma ativa não há lançamentos.',
      'Defina a meta do time em R$ — ela aparece no painel e no fechamento.',
    ],
    link: { label: 'Abrir configurações', to: '/admin/configuracoes', search: { aba: 'temporadas' } },
  },
  {
    id: 'code',
    icon: KeyRound,
    tone: 'gold',
    title: 'Compartilhe o código da equipe',
    summary: 'Cada colaborador se cadastra com o código e aguarda sua aprovação.',
    details: [
      'Envie o código só para quem deve ter acesso; gere um novo quando todos entrarem.',
      'Com "Aprovar automaticamente" desligado (recomendado), cada cadastro cai em Equipe › Pendentes.',
      'Ligue a aprovação automática só com confirmação de e-mail ativa no Supabase.',
    ],
    link: { label: 'Ver código', to: '/admin/configuracoes', search: { aba: 'codigo' } },
  },
  {
    id: 'profiles',
    icon: Users,
    tone: 'blue',
    title: 'Aprove e complete os perfis',
    summary: 'Cargo, equipe, meta individual e pontos iniciais (se migrar de outro sistema).',
    details: [
      'Aprovar libera o acesso na hora; recusar mantém o cadastro inativo (pode aprovar depois).',
      'A meta individual entra no cálculo de "meta batida" e nas conquistas.',
      '"Lançar pontos iniciais" é uma ação separada do formulário e só pode ser feita uma vez por temporada.',
    ],
    link: { label: 'Abrir equipe', to: '/admin/equipe', search: { pendentes: true } },
  },
  {
    id: 'rules',
    icon: ListChecks,
    tone: 'purple',
    title: 'Revise as regras de pontuação',
    summary: 'Quantos pontos e moedas cada atividade vale. O catálogo já vem com 10 regras.',
    details: [
      'Regras manuais são lançadas por você; as automáticas (bloco de faturamento, meta mensal) disparam sozinhas.',
      '"Venda realizada" exige o valor em R$: ele alimenta faturamento, metas e conquistas.',
      'Moedas são definidas por regra — não existe coeficiente global.',
    ],
    link: { label: 'Abrir regras', to: '/admin/pontuacao', search: { aba: 'regras' } },
  },
  {
    id: 'missions',
    icon: Target,
    tone: 'green',
    title: 'Crie as primeiras missões',
    summary: 'Diárias, semanais, especiais ou relâmpago — com pontos, moedas ou giro de roleta.',
    details: [
      'Missões progridem sozinhas a partir dos lançamentos (ligações, reuniões, vendas).',
      'Relâmpago dura no máximo 24 h e mostra contador na tela do colaborador.',
      'Recompensa "giro" coloca o colaborador na fila da roleta ao concluir.',
    ],
    link: { label: 'Abrir missões', to: '/missoes', search: { filtro: 'hoje', novo: true } },
  },
  {
    id: 'challenges',
    icon: Swords,
    tone: 'red',
    title: 'Lance um desafio',
    summary: 'Duelo entre dois ou desafio coletivo com meta e prêmio.',
    details: [
      'Duelo exige exatamente 2 participantes; coletivo sem seleção vale para todos.',
      'Ative quando quiser começar; finalize para premiar (ou deixe o fechamento da temporada finalizar).',
    ],
    link: { label: 'Abrir desafios', to: '/desafios', search: { gerenciar: true } },
  },
  {
    id: 'rewards',
    icon: Gift,
    tone: 'gold',
    title: 'Ajuste recompensas e prêmios da roleta',
    summary: 'Loja de Orb Coins (7 itens de exemplo) e as duas roletas com seus prêmios.',
    details: [
      'Custo em moedas e estoque por recompensa; pedidos passam por aprovação e entrega.',
      'Cada roleta precisa de pelo menos 2 prêmios; o peso define a chance.',
    ],
    link: { label: 'Abrir catálogo', to: '/admin/recompensas', search: { aba: 'catalogo' } },
  },
  {
    id: 'event',
    icon: Zap,
    tone: 'red',
    title: 'Agende um evento especial (opcional)',
    summary: 'Multiplicador de pontos em uma janela de tempo — Black Friday, semana de fechamento.',
    details: [
      'Multiplica só pontos, nunca moedas.',
      'Eventos ativos não podem se sobrepor.',
      'O banner aparece para o time antes e durante.',
    ],
    link: { label: 'Abrir eventos', to: '/admin/configuracoes', search: { aba: 'eventos' } },
  },
  {
    id: 'test',
    icon: Rocket,
    tone: 'cyan',
    title: 'Faça um lançamento de teste',
    summary: 'Lance uma venda, confira ranking, feed e carteira; estorne se foi só teste.',
    details: [
      'O estorno cria um lançamento inverso e mantém o histórico íntegro.',
      'Se os números parecerem errados, use "Recalcular estatísticas" em Configurações › Geral.',
    ],
    link: { label: 'Lançar pontos', to: '/admin/pontuacao', search: { aba: 'lancar' } },
  },
]

export interface ChecklistItem {
  id: string
  label: string
  link: GuideLink
}

export const GUIDE_CHECKLIST_ICON: LucideIcon = ClipboardCheck

/** Checklist de implantação (a mesma referida em Configurações). */
export const GUIDE_CHECKLIST: readonly ChecklistItem[] = [
  {
    id: 'tz',
    label: 'Fuso horário conferido antes do primeiro lançamento',
    link: { label: 'Geral', to: '/admin/configuracoes', search: { aba: 'geral' } },
  },
  {
    id: 'season',
    label: 'Temporada ativa com meta do time definida',
    link: { label: 'Temporadas', to: '/admin/configuracoes', search: { aba: 'temporadas' } },
  },
  {
    id: 'code',
    label: 'Código da equipe enviado ao time',
    link: { label: 'Código', to: '/admin/configuracoes', search: { aba: 'codigo' } },
  },
  {
    id: 'pending',
    label: 'Cadastros pendentes aprovados',
    link: { label: 'Equipe', to: '/admin/equipe', search: { pendentes: true } },
  },
  { id: 'goals', label: 'Metas individuais preenchidas', link: { label: 'Equipe', to: '/admin/equipe' } },
  {
    id: 'rules',
    label: 'Regras de pontuação revisadas',
    link: { label: 'Regras', to: '/admin/pontuacao', search: { aba: 'regras' } },
  },
  {
    id: 'missions',
    label: 'Pelo menos uma missão criada',
    link: { label: 'Missões', to: '/missoes', search: { filtro: 'hoje' } },
  },
  {
    id: 'rewards',
    label: 'Recompensas e prêmios da roleta revisados',
    link: { label: 'Recompensas', to: '/admin/recompensas', search: { aba: 'catalogo' } },
  },
  {
    id: 'test',
    label: 'Lançamento de teste feito e estornado',
    link: { label: 'Pontuação', to: '/admin/pontuacao', search: { aba: 'lancar' } },
  },
]
