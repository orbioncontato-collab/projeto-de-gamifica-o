import type {
  ChallengeKind,
  ChallengeMetric,
  ChallengeStatus,
  EntrySource,
  JobTitle,
  MetricType,
  MissionKind,
  NotificationKind,
  PrizeKind,
  ProfileStatus,
  QueueSource,
  QueueStatus,
  RedemptionStatus,
  SpinStatus,
  UserRole,
  WheelKind,
} from './database.types'

/** Rótulos pt-BR dos enums — única fonte (FRONTEND-ARCH §4.8). */
export const JOB_TITLE_LABELS: Record<JobTitle, string> = {
  sdr: 'SDR',
  closer: 'Closer',
  social_seller: 'Social Seller',
  supervisor: 'Supervisor Comercial',
  manager: 'Gestor',
}
export const USER_ROLE_LABELS: Record<UserRole, string> = { admin: 'Gestor', collaborator: 'Colaborador' }
export const METRIC_LABELS: Record<MetricType, string> = {
  sale: 'Venda realizada',
  meeting_scheduled: 'Reunião agendada',
  meeting_held: 'Reunião realizada',
  call: 'Ligação',
  crm_update: 'CRM atualizado',
  lead_recovery: 'Recuperação de lead',
  upsell: 'Upsell',
  amount_step: 'Bloco de faturamento',
  weekly_goal: 'Meta semanal',
  monthly_goal: 'Meta mensal',
  activity: 'Atividade',
  custom: 'Personalizada',
}
export const MISSION_KIND_LABELS: Record<MissionKind, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  special: 'Especial',
  lightning: 'Relâmpago',
}
export const CHALLENGE_KIND_LABELS: Record<ChallengeKind, string> = { duel: 'Duelo', team: 'Coletivo' }
export const CHALLENGE_METRIC_LABELS: Record<ChallengeMetric, string> = {
  meetings_held: 'Reuniões',
  sales_count: 'Vendas',
  revenue: 'Faturamento',
  points: 'Pontos',
  activities: 'Atividades',
}
export const CHALLENGE_STATUS_LABELS: Record<ChallengeStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
}
export const PRIZE_KIND_LABELS: Record<PrizeKind, string> = {
  points: 'Pontos',
  coins: 'Moedas',
  cash: 'PIX',
  voucher: 'Voucher',
  extra_spin: 'Giro extra',
  multiplier: 'Multiplicador',
  mystery: 'Mystery Box',
  custom: 'Outro',
}
export const WHEEL_KIND_LABELS: Record<WheelKind, string> = { classic: 'Roleta Clássica', premium: 'Roleta Premium' }
export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  requested: 'Solicitado',
  approved: 'Aprovado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}
/** StatusPill da Equipe: active=success, pending=warning, inactive=muted */
export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  inactive: 'Inativo',
}
export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: 'Na fila',
  active: 'Liberado',
  done: 'Concluído',
  removed: 'Removido',
}
export const QUEUE_SOURCE_LABELS: Record<QueueSource, string> = {
  manual: 'Adicionado pelo gestor',
  earned: 'Giro conquistado',
}
export const SPIN_STATUS_LABELS: Record<SpinStatus, string> = {
  pending: 'Aguardando aprovação',
  approved: 'Aprovado',
  rejected: 'Recusado',
}
export const ENTRY_SOURCE_LABELS: Record<EntrySource, string> = {
  rule: 'Regra',
  manual: 'Manual',
  system: 'Automático',
  mission: 'Missão',
  challenge: 'Desafio',
  wheel: 'Roleta',
  reward: 'Resgate',
  achievement: 'Conquista',
}
export const NOTIFICATION_KIND_ICONS: Record<NotificationKind, string> = {
  ranking: '🔥',
  mission: '🎯',
  reward: '🎁',
  wheel: '🎰',
  challenge: '⚔️',
  achievement: '🏆',
  level: '🚀',
  event: '⚡',
  season: '📅',
  system: 'ℹ️',
}
