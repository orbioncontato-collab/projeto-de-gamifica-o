import type { Session } from '@supabase/supabase-js'
import type {
  AppSecretsRow,
  AppSettingsRow,
  BootstrapPayload,
  PrizeKind,
  WheelKind,
  WheelPrizeRow,
  WheelRow,
} from '@/lib/database.types'
import { makeBootstrap, TEST_SETTINGS } from './render'

/**
 * Supabase falso para testes de rota: banco recém-instalado (nenhuma linha, nenhuma temporada).
 * Toda consulta devolve `[]`/`null`; `get_bootstrap` devolve o `me` pedido; nada faz rede.
 */

export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'

export const TEST_SESSION = {
  access_token: 'test',
  refresh_token: 'test',
  token_type: 'bearer',
  expires_in: 3600,
  user: {
    id: TEST_USER_ID,
    email: 'teste@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '',
  },
} as unknown as Session

const NOW = '2026-09-15T12:00:00.000Z'

export const EMPTY_APP_SETTINGS: AppSettingsRow = {
  id: 1,
  ...TEST_SETTINGS,
  streak_business_days_only: false,
  auto_approve_members: false,
  updated_at: NOW,
  updated_by: null,
}

export const EMPTY_APP_SECRETS: AppSecretsRow = {
  id: 1,
  team_code: 'AAAA0000BBBB',
  team_code_rotated_at: NOW,
  bootstrap_email: null,
  bootstrap_done: true,
  updated_at: NOW,
  updated_by: null,
}

type SeedPrize = readonly [label: string, kind: PrizeKind, value: number | null]
/** Catálogo da roleta (DATA-MODEL §13.4/§13.5 — sem cor: o front usa `WHEEL_PALETTE`). */
const CLASSIC_PRIZES: readonly SeedPrize[] = [
  ['R$ 10 PIX', 'cash', 10],
  ['100 pontos', 'points', 100],
  ['R$ 20 PIX', 'cash', 20],
  ['Giro extra', 'extra_spin', null],
  ['R$ 30 iFood', 'voucher', 30],
  ['200 pontos', 'points', 200],
]
const PREMIUM_PRIZES: readonly SeedPrize[] = [
  ['R$ 50 PIX', 'cash', 50],
  ['500 pontos', 'points', 500],
  ['R$ 100 PIX', 'cash', 100],
  ['Giro extra', 'extra_spin', null],
  ['R$ 50 iFood', 'voucher', 50],
  ['1.000 pontos', 'points', 1000],
  ['2x pontos', 'multiplier', 2],
  ['Mystery Box', 'mystery', null],
]

function seedWheel(
  kind: WheelKind,
  name: string,
  prizes: readonly SeedPrize[],
): WheelRow & { wheel_prizes: WheelPrizeRow[] } {
  const id = `wheel-${kind}`
  return {
    id,
    kind,
    name,
    is_active: true,
    updated_at: NOW,
    wheel_prizes: prizes.map(([label, prizeKind, value], sort_order) => ({
      id: `${id}-${sort_order}`,
      wheel_id: id,
      label,
      kind: prizeKind,
      value,
      weight: 1,
      color: null,
      sort_order,
      is_active: true,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      updated_by: null,
    })),
  }
}

/** Linhas por tabela/view — vazio por padrão; singletons e catálogo (§13) existem após o schema. */
const ROWS: Record<string, unknown[]> = {
  app_settings: [EMPTY_APP_SETTINGS],
  app_secrets: [EMPTY_APP_SECRETS],
  wheels: [
    seedWheel('classic', 'Roleta Clássica', CLASSIC_PRIZES),
    seedWheel('premium', 'Roleta Premium', PREMIUM_PRIZES),
  ],
}

type QueryResult = { data: unknown; error: null; count: number }

/** Builder encadeável: qualquer método devolve o próprio builder; `await` resolve `{ data, error: null }`. */
function makeBuilder(table: string): unknown {
  let single = false
  const rows = ROWS[table] ?? []
  const target = {
    then(onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) {
      const data = single ? (rows[0] ?? null) : rows
      return Promise.resolve({ data, error: null, count: rows.length }).then(onFulfilled, onRejected)
    },
  }
  const proxy: unknown = new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return t.then
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => {
          single = true
          return proxy
        }
      }
      return () => proxy
    },
  })
  return proxy
}

export interface FakeSupabaseOptions {
  bootstrap: BootstrapPayload
}

/** Cliente falso com a superfície usada pelo app (from/rpc/auth/channel/storage). */
export function makeFakeSupabase({ bootstrap }: FakeSupabaseOptions) {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
  }
  const rpc = async (name: string, _args?: unknown) => {
    if (name === 'get_bootstrap') return { data: bootstrap, error: null }
    if (name === 'get_dashboard') return { data: { season: null }, error: null }
    return { data: null, error: null }
  }
  return {
    from: (table: string) => makeBuilder(table),
    rpc,
    channel: () => channel,
    removeChannel: async () => 'ok',
    auth: {
      getSession: async () => ({ data: { session: TEST_SESSION }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      getUser: async () => ({ data: { user: TEST_SESSION.user }, error: null }),
      updateUser: async () => ({ data: { user: TEST_SESSION.user }, error: null }),
      signOut: async () => ({ error: null }),
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  }
}

export const emptyBootstrapFor = (role: 'admin' | 'collaborator'): BootstrapPayload =>
  makeBootstrap({ me: { ...makeBootstrap().me, role, id: TEST_USER_ID } })
