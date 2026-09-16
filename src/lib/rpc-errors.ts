/**
 * Erros das RPCs/PostgREST → código estável + mensagem pt-BR (DATA-MODEL §2.6 e §9).
 * O banco devolve `message = CODE` e `details = texto pt-BR`; o front mapeia o código e usa `details` como fallback.
 */

export class RpcError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail: string | null,
    public sqlstate: string | null,
  ) {
    super(message)
    this.name = 'RpcError'
  }

  static fromPostgrest(e: {
    message: string
    details?: string | null
    code?: string | null
    hint?: string | null
  }): RpcError {
    const isCatalogCode = /^[A-Z][A-Z0-9_]{2,}$/.test(e.message) // DATA-MODEL §2.6: message = CODE
    const sqlstate = e.code ?? null
    let code = isCatalogCode ? e.message : (sqlstate ?? 'UNKNOWN')
    // Códigos sintéticos do front para SQLSTATEs que vazam de escrita direta por policy (DATA-MODEL §9)
    if (!isCatalogCode && (sqlstate === '23514' || sqlstate === '23P01')) code = 'LEDGER_CONSTRAINT'
    if (!isCatalogCode && sqlstate === '23505') code = 'DUPLICATE'
    return new RpcError(code, e.message, e.details ?? null, sqlstate)
  }
}

/** Texto pt-BR por código — idêntico ao `detail` do catálogo (DATA-MODEL §9) + sintéticos do front. */
export const RPC_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Faça login para continuar.',
  NOT_ADMIN: 'Apenas gestores podem executar esta ação.',
  NOT_ALLOWED: 'Você não pode executar esta ação.',
  PROFILE_INACTIVE: 'Este perfil está inativo.',
  PROFILE_PENDING: 'Seu cadastro está aguardando aprovação do gestor.',
  PROFILE_STATUS_INVALID:
    'Transição de status não permitida (um perfil só pode ser aprovado, recusado, inativado ou reativado).',
  PROFILE_NOT_FOUND: 'Perfil não encontrado.',
  INVALID_TEAM_CODE: 'Código da equipe inválido.',
  BOOTSTRAP_EMAIL_MISMATCH: 'Este e-mail não está autorizado a criar a instalação.',
  BOOTSTRAP_REQUIRES_CONFIRMED_EMAIL:
    'O primeiro gestor precisa ser criado pelo painel do Supabase (usuário já confirmado).',
  BOOTSTRAP_NOT_CONFIGURED: 'Instalação incompleta: aplique o schema.sql por inteiro.',
  BOOTSTRAP_LOCKED: 'O bootstrap da instalação não pode ser reaberto.',
  TEAM_CODE_VIA_RPC_ONLY: 'Use "Gerar novo código" para trocar o código da equipe.',
  FORBIDDEN_COLUMN: 'Você só pode alterar nome, foto, cor e preferências.',
  INVALID_AVATAR_PATH: 'Caminho de foto inválido.',
  LAST_ADMIN: 'Não é possível rebaixar ou inativar o último gestor ativo.',
  INVALID_PATCH_KEY: 'Campo não permitido.',
  EMAIL_TAKEN: 'Este e-mail já está em uso.',
  INVALID_TIMEZONE: 'Fuso horário inválido.',
  TIMEZONE_LOCKED: 'O fuso só pode ser alterado antes do primeiro lançamento.',
  LEDGER_IMMUTABLE: 'Lançamentos não podem ser alterados nem apagados; use um estorno.',
  NO_SEASON_FOR_DATE: 'Não existe temporada cobrindo esta data.',
  NO_ACTIVE_SEASON: 'Não há temporada ativa.',
  SEASON_CLOSED: 'Esta temporada já foi encerrada.',
  SEASON_ALREADY_CLOSED: 'Temporada já encerrada.',
  SEASON_OVERLAP: 'O período conflita com outra temporada.',
  SEASON_RANGE_INVALID: 'A data final deve ser posterior à inicial.',
  SEASON_HAS_ENTRIES_OUTSIDE: 'Existem lançamentos fora do novo período.',
  SEASON_HAS_WINDOWS_OUTSIDE: 'Existem missões ou desafios com janela fora do novo período.',
  SEASON_NOT_STARTED: 'A temporada ainda não começou.',
  SEASON_NOT_FOUND: 'Temporada não encontrada.',
  EVENT_OVERLAP: 'O período conflita com outro evento ativo.',
  EVENT_RANGE_INVALID: 'A data final deve ser posterior à inicial.',
  RULE_NOT_FOUND: 'Regra de pontuação não encontrada.',
  RULE_INACTIVE: 'Esta regra está inativa.',
  AMOUNT_REQUIRED: 'Informe o valor em R$ da venda.',
  AMOUNT_INVALID: 'O valor em R$ deve ser no máximo 999.999.999.999.',
  NAME_REQUIRED: 'Informe o nome (1 a 60 caracteres).',
  GOAL_INVALID: 'A meta deve ser um valor entre 0 e 999.999.999.999.',
  QUANTITY_INVALID: 'Quantidade deve ser entre 1 e 1000.',
  POINTS_INVALID:
    'Pontos devem ser diferentes de zero e até 100.000 (com quantidade e multiplicador, até 1.000.000).',
  INITIAL_POINTS_EXISTS: 'Pontos iniciais já lançados para este perfil nesta temporada.',
  REASON_REQUIRED: 'Informe o motivo (3 a 500 caracteres).',
  OCCURRED_AT_INVALID: 'Data do lançamento inválida (até 90 dias atrás).',
  MILESTONE_ALREADY_AWARDED: 'Meta semanal já lançada para esta semana.',
  ENTRY_NOT_FOUND: 'Lançamento não encontrado.',
  ALREADY_REVERSED: 'Este lançamento já foi estornado.',
  CANNOT_REVERSE_REVERSAL: 'Não é possível estornar um estorno.',
  USE_HANDLE_REDEMPTION: 'Cancele o resgate pela tela de recompensas.',
  REVERSAL_MISMATCH: 'Estorno inconsistente com o lançamento original.',
  TRIGGER_DEPTH: 'Profundidade de triggers excedida.',
  MISSION_WINDOW_INVALID: 'A janela da missão precisa estar dentro da temporada.',
  LIGHTNING_TOO_LONG: 'Missão relâmpago dura no máximo 24 horas.',
  MISSION_HAS_PROGRESS: 'Missão já tem progresso; crie uma nova.',
  MISSION_NOT_FOUND: 'Missão não encontrada.',
  CHALLENGE_NOT_FOUND: 'Desafio não encontrado.',
  PARTICIPANTS_REQUIRED: 'Selecione ao menos um participante.',
  CHALLENGE_WINDOW_INVALID: 'O período do desafio precisa estar dentro da temporada e no futuro.',
  CHALLENGE_NOT_DRAFT: 'O desafio já foi ativado.',
  CHALLENGE_NOT_ACTIVE: 'O desafio não está ativo.',
  CHALLENGE_FINAL: 'Desafio finalizado/cancelado não pode mudar.',
  STATUS_VIA_RPC_ONLY: 'Use as ações de ativar/finalizar/cancelar.',
  DUEL_NEEDS_TWO: 'Um duelo precisa de exatamente 2 participantes.',
  TEAM_NEEDS_TWO: 'Um desafio coletivo precisa de ao menos 2 participantes.',
  PARTICIPANT_INACTIVE: 'Há participante inativo.',
  QUEUE_TARGET_REQUIRED: 'Informe um colaborador ou um nome.',
  ALREADY_IN_QUEUE: 'Esta pessoa já está na fila (entrada manual).',
  ATTEMPTS_INVALID: 'Tentativas devem ser entre 1 e 20 e maiores que as já usadas.',
  QUEUE_NOT_FOUND: 'Entrada da fila não encontrada.',
  SPIN_NOT_FOUND: 'Giro não encontrado.',
  WHEEL_INACTIVE: 'Esta roleta está desativada.',
  WHEEL_IN_USE: 'A roleta tem fila, missão ou desafio pendente; não pode ser desativada.',
  NO_PRIZES: 'A roleta está sem prêmios ativos.',
  SORT_ORDER_DUPLICATE: 'Há prêmios com a mesma posição.',
  QUEUE_NOT_EDITABLE: 'Esta entrada da fila não pode mais ser alterada.',
  QUEUE_NOT_WAITING: 'Só entradas em espera podem ser liberadas.',
  NO_ACTIVE_TURN: 'Não há vez liberada.',
  ATTEMPTS_EXHAUSTED: 'Tentativas esgotadas.',
  SPIN_PENDING: 'Há um prêmio aguardando aprovação.',
  SPIN_NOT_PENDING: 'Este giro já foi processado.',
  MIN_PRIZES: 'Cada roleta precisa de ao menos 2 prêmios ativos.',
  MYSTERY_NEEDS_POOL: 'A roleta precisa de um prêmio comum além de Mystery/Giro extra.',
  REWARD_UNAVAILABLE: 'Recompensa indisponível.',
  INSUFFICIENT_COINS: 'Moedas insuficientes.',
  OUT_OF_STOCK: 'Recompensa esgotada.',
  ACTION_INVALID: 'Ação inválida.',
  REDEMPTION_TRANSITION_INVALID: 'Transição de status não permitida.',
  REDEMPTION_NOT_FOUND: 'Pedido de resgate não encontrado.',
  // Sintéticos do front (não vêm do banco)
  LEDGER_CONSTRAINT: 'Conflito de regra no banco.',
  DUPLICATE: 'Registro duplicado.',
  AVATAR_QUOTA: 'Limpe fotos antigas e tente de novo.',
  UNKNOWN: 'Não foi possível concluir a ação.',
}

/** Códigos cujo `detail` do servidor já vem interpolado ({n}, {key}, {DD/MM}) — preferir o detail quando existir. */
const PREFER_DETAIL = new Set([
  'INSUFFICIENT_COINS',
  'INVALID_PATCH_KEY',
  'ATTEMPTS_INVALID',
  'SEASON_NOT_STARTED',
])

const FALLBACK = 'Não foi possível concluir a ação.'

export function getErrorMessage(error: unknown): string {
  if (error instanceof RpcError) {
    if (PREFER_DETAIL.has(error.code) && error.detail) return error.detail
    return RPC_MESSAGES[error.code] ?? error.detail ?? FALLBACK
  }
  if (error instanceof Error) return error.message || 'Erro inesperado.'
  return 'Erro inesperado.'
}

export function isAuthError(error: unknown): boolean {
  return (
    error instanceof RpcError &&
    (['NOT_AUTHENTICATED', 'PROFILE_INACTIVE', 'PROFILE_PENDING'].includes(error.code) ||
      error.sqlstate === '42501' ||
      error.sqlstate === 'PGRST301')
  )
}

/** handleGlobalError: navega para /aguardando sem signOut (FRONTEND-ARCH §3.4) */
export function isPendingError(error: unknown): boolean {
  return isCode(error, 'PROFILE_PENDING')
}

export function isCode(error: unknown, code: string): boolean {
  return error instanceof RpcError && error.code === code
}
