import type { QueryClient } from '@tanstack/react-query'

/** Fábrica de chaves do React Query (FRONTEND-ARCH §4.4). Toda feature usa só estas chaves. */
export const qk = {
  bootstrap: () => ['bootstrap'] as const,
  signupMode: () => ['signup-mode'] as const,
  branding: () => ['branding'] as const,
  dashboard: {
    all: () => ['dashboard'] as const,
    one: (profileId: string | null, seasonId: string | null) =>
      ['dashboard', 'one', profileId, seasonId] as const,
  },
  feed: () => ['feed'] as const,
  notifications: {
    all: () => ['notifications'] as const,
    /** `limit` opcional: o sino consulta 8, a página completa 20 (ambas invalidadas por `all`) */
    list: (limit?: number) =>
      limit === undefined
        ? (['notifications', 'list'] as const)
        : (['notifications', 'list', limit] as const),
  },
  profiles: {
    all: () => ['profiles'] as const,
    active: () => ['profiles', 'active'] as const,
    /** admin: cadastros aguardando aprovação (Equipe › Pendentes) */
    pending: () => ['profiles', 'pending'] as const,
    stats: (seasonId: string | null) => ['profiles', 'stats', seasonId] as const,
    one: (profileId: string, seasonId: string | null) => ['profiles', 'one', profileId, seasonId] as const,
    private: (profileId: string) => ['profiles', 'private', profileId] as const,
    ranking: (seasonId: string | null) => ['profiles', 'ranking', seasonId] as const,
  },
  missions: {
    all: () => ['missions'] as const,
    board: (profileId: string, filter: string) => ['missions', 'board', profileId, filter] as const,
    admin: (seasonId: string | null) => ['missions', 'admin', seasonId] as const,
  },
  challenges: {
    all: () => ['challenges'] as const,
    /** `statuses` opcional: o board público (active+finished) e o do gestor (todos) usam caches distintos */
    board: (seasonId: string | null, statuses?: string) =>
      statuses === undefined
        ? (['challenges', 'board', seasonId] as const)
        : (['challenges', 'board', seasonId, statuses] as const),
  },
  wheel: {
    all: () => ['wheel'] as const,
    config: () => ['wheel', 'config'] as const,
    queue: () => ['wheel', 'queue'] as const,
    history: (limit?: number) =>
      limit === undefined ? (['wheel', 'history'] as const) : (['wheel', 'history', limit] as const),
  },
  rewards: {
    all: () => ['rewards'] as const,
    catalog: (scope: 'store' | 'admin') => ['rewards', 'catalog', scope] as const,
    wallet: (profileId: string) => ['rewards', 'wallet', profileId] as const,
    credits: (profileId: string) => ['rewards', 'credits', profileId] as const,
    redemptions: (scope: 'mine' | 'admin', status: string | null) =>
      ['rewards', 'redemptions', scope, status] as const,
  },
  achievements: {
    all: () => ['achievements'] as const,
    one: (profileId: string) => ['achievements', 'one', profileId] as const,
  },
  ledger: {
    all: () => ['ledger'] as const,
    rules: () => ['ledger', 'rules'] as const,
    /** existe algum lançamento em qualquer temporada? (trava do fuso, DATA-MODEL §7.2) */
    hasEntries: () => ['ledger', 'has-entries'] as const,
    history: (p: { profileId: string | null; page: number; pageSize: number }) =>
      ['ledger', 'history', p] as const,
    initialPoints: (profileId: string, seasonId: string | null) =>
      ['ledger', 'initial-points', profileId, seasonId] as const,
  },
  admin: {
    all: () => ['admin'] as const,
    teamStats: (seasonId: string | null) => ['admin', 'team-stats', seasonId] as const,
    kpis: (seasonId: string | null) => ['admin', 'kpis', seasonId] as const,
    timeline: (seasonId: string | null) => ['admin', 'timeline', seasonId] as const,
  },
  settings: {
    app: () => ['settings', 'app'] as const,
    secrets: () => ['settings', 'secrets'] as const,
    seasons: () => ['settings', 'seasons'] as const,
    events: () => ['settings', 'events'] as const,
  },
}

/** Após qualquer mutation que toca o ledger (lançar, estornar, aprovar giro, resgatar, finalizar desafio, fechar temporada). */
export async function invalidateAfterLedgerChange(qc: QueryClient): Promise<void> {
  const keys: readonly (readonly unknown[])[] = [
    qk.bootstrap(),
    qk.feed(),
    qk.dashboard.all(),
    qk.profiles.all(),
    qk.missions.all(),
    qk.challenges.all(),
    qk.achievements.all(),
    qk.ledger.all(),
    qk.admin.all(),
    qk.rewards.all(),
    qk.wheel.all(),
  ]
  await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })))
}
