// RED TEAM r2 — SEGURANÇA (DATA-MODEL §2, §7, §10, §11, §12, Apêndice D). Complementa redteam-security-r1.
// Atacantes: colaborador ativo malicioso ("attacker"), usuário pendente, usuário inativo e anon.
// Vetores NOVOS nesta rodada: varredura INSERT/UPDATE/DELETE em todas as tabelas (com app.rpc/app.allow_closed ligados);
// escalada via set role / CREATE em public / default privileges; rotação do team_code revogando o código antigo;
// checagem de papel como PRIMEIRA linha em toda RPC admin (sem oráculo de existência); temporada fechada;
// duplo crédito na roleta (approve×2, reject→approve); duplo estorno de resgate; resgate duplo numa só instrução;
// notificações alheias por RPC; args hostis por tipo (jsonb array/escalar, enum inválido, datas quebradas);
// realtime (publication só com as 5 tabelas públicas); bucket/policies do storage; triggers não desativados.
// Contas são rótulos técnicos (gestor/membro/atacante), não pessoas — nada vai para o seed.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectError, expectRlsDenied } from './pglite-harness.mjs'

let t
let admin, member, attacker, pending, inactive, teamCode
let seasonId, saleRuleId, memberEntryId, queueId, cheapRewardId, exactRewardId, memberBalance, activeStartsOn
const NIL = '00000000-0000-0000-0000-000000000000'
const CODE_RE = /^[A-Z][A-Z0-9_]+$/
const DENIED_RE = /row-level security|permission denied|violates|not-null|null value|[A-Z][A-Z0-9_]{3,}/

const TABLES = [
  'app_settings', 'app_secrets', 'seasons', 'season_goals', 'season_results', 'profiles', 'profile_private', 'profile_season_stats',
  'profile_lifetime_stats', 'point_rules', 'point_entries', 'milestone_awards', 'special_events', 'profile_boosts', 'missions',
  'mission_participants', 'mission_progress', 'challenges', 'challenge_participants', 'challenge_results', 'wheels', 'wheel_prizes',
  'wheel_queue', 'wheel_spins', 'rewards', 'reward_redemptions', 'achievements', 'profile_achievements', 'feed_events', 'notifications', 'audit_log',
]
const VIEWS = [
  'v_profile_stats', 'v_ranking', 'v_team_stats', 'v_admin_kpis', 'v_sales_timeline', 'v_mission_board', 'v_challenge_board',
  'v_achievement_board', 'v_wheel_queue', 'v_wheel_history', 'v_redemptions', 'v_wallet', 'v_point_entries_history', 'v_activity_feed',
  'v_seasons', 'v_special_events',
]
const REALTIME_TABLES = ['wheel_queue', 'wheel_spins', 'wheel_prizes', 'notifications', 'feed_events']
// coluna usada no UPDATE de sondagem (tabelas com grant por coluna usam a coluna concedida)
const UPDATE_COL = { profiles: 'full_name', notifications: 'is_read' }

const count = (rel, where = '', params = []) =>
  t.sql(`select count(*)::int as n from public.${rel} ${where}`, params).then((r) => Number(r.rows[0].n))
const countAs = (tx, rel) => tx.query(`select count(*)::int as n from public.${rel}`).then((r) => Number(r.rows[0].n))
const balance = async (uid) => Number((await t.sql('select coalesce(sum(coins),0)::int as b from public.point_entries where profile_id = $1', [uid])).rows[0].b)
const snapshotCounts = async () => Object.fromEntries(await Promise.all(TABLES.map(async (x) => [x, await count(x)])))
const dateStr = (d) => new Date(d).toISOString().slice(0, 10)
const addDays = (isoDate, n) => dateStr(new Date(isoDate + 'T12:00:00Z').getTime() + n * 86400000)
/** Erro cujo message é um código do catálogo (§9), nunca um erro cru do Postgres. */
async function expectCatalog(promise, code) {
  const e = await expectError(promise, code ?? CODE_RE)
  assert.match(e.message, CODE_RE, `erro cru vazou: ${e.message}`)
  assert.ok(!(e.message + (e.detail ?? '') + (e.hint ?? '')).includes(teamCode), `team_code vazou em: ${e.message}`)
  return e
}
/** jsonb escalar como o PostgREST manda (literal JSON); objetos/arrays o harness já serializa; null vira SQL NULL. */
const jsonArg = (v) => (v === null || typeof v === 'object' ? v : JSON.stringify(v))
/** Qualquer erro serve (permission denied, RLS, trigger, constraint) — o que importa é não escrever nada. */
async function expectAnyError(promise) {
  try { await promise } catch (e) { return e }
  throw new Error('esperado erro, mas a instrução foi executada com sucesso')
}
// Roleta exige ≥ 2 prêmios ativos (MIN_PRIZES): dois setores iguais tornam o sorteio determinístico.
const setPrizePair = (wheelKind, label, kind, value) =>
  t.rpcRow(admin, 'save_wheel_prizes', {
    p_wheel_kind: wheelKind,
    p_prizes: [{ label, kind, value, weight: 1, sort_order: 0 }, { label, kind, value, weight: 1, sort_order: 1 }],
  })

before(async () => {
  t = await createTestDb()
  teamCode = (await t.sql('select team_code from public.app_secrets where id = 1')).rows[0].team_code
  const season = (await t.sql(`select id, (starts_at at time zone public.app_timezone())::date::text as starts_on from public.seasons where is_active`)).rows[0]
  seasonId = season.id
  activeStartsOn = season.starts_on
  saleRuleId = (await t.sql(`select id from public.point_rules where metric = 'sale' and deleted_at is null`)).rows[0].id

  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  attacker = await t.createAuthUser({ email: 'atacante@teste.local', metadata: { team_code: teamCode, full_name: 'Atacante' } })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: attacker, p_patch: { status: 'active' } })
  member = await t.createAuthUser({ email: 'membro-b@teste.local', metadata: { team_code: teamCode, full_name: 'Membro B' } })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: { status: 'active' } }) // notifica o atacante ("Novo membro")
  pending = await t.createAuthUser({ email: 'pendente@teste.local', metadata: { team_code: teamCode, full_name: 'Pendente' } })
  inactive = await t.createAuthUser({ email: 'inativo@teste.local', metadata: { team_code: teamCode, full_name: 'Inativo' } })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: inactive, p_patch: { status: 'active' } })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: inactive, p_patch: { status: 'inactive' } })

  memberEntryId = (await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: member, p_points: 1000, p_reason: 'crédito de teste' }))[0].id
  await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: attacker, p_points: 10, p_reason: 'crédito de teste' })
  memberBalance = await balance(member)

  // roleta clássica só com moedas (determinístico); membro na fila com 2 tentativas e a vez liberada
  await setPrizePair('classic', '500 moedas', 'coins', 500)
  queueId = (await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: member, p_wheel_kind: 'classic', p_attempts: 2 }))[0].id
  await t.rpcRow(admin, 'release_turn', { p_queue_id: queueId })

  cheapRewardId = (await t.sql(`insert into public.rewards (name, category, cost_coins, stock, sort_order) values ('Item de teste 10', 'Teste', 10, 1, 91) returning id`)).rows[0].id
  exactRewardId = (await t.sql(`insert into public.rewards (name, category, cost_coins, stock, sort_order) values ('Item de teste saldo', 'Teste', $1, null, 92) returning id`, [memberBalance])).rows[0].id
})
after(async () => t?.close())

test('cenário: papéis/status esperados e saldo do membro', async () => {
  const r = await t.sql('select id, role, status from public.profiles')
  const byId = Object.fromEntries(r.rows.map((x) => [x.id, x.role + ':' + x.status]))
  assert.equal(byId[admin], 'admin:active')
  assert.equal(byId[attacker], 'collaborator:active')
  assert.equal(byId[member], 'collaborator:active')
  assert.equal(byId[pending], 'collaborator:pending')
  assert.equal(byId[inactive], 'collaborator:inactive')
  assert.equal(memberBalance, 1000)
  assert.ok(await count('notifications', 'where profile_id = $1', [attacker]) >= 1, 'atacante precisa ter ao menos 1 notificação própria')
})

// =============================================================================
// 1. Varredura de escrita: attacker/pending/inactive não inserem, atualizam nem apagam nada
//    (mesmo com app.rpc / app.allow_closed ligados na própria transação)
// =============================================================================
test('escrita: INSERT em todas as 31 tabelas falha para attacker/pending/inactive e nada é gravado', async () => {
  const before = await snapshotCounts()
  for (const who of [attacker, pending, inactive]) {
    for (const tbl of TABLES) {
      await expectAnyError(t.asUser(who, async (tx) => {
        await tx.query(`select set_config('app.rpc', 'on', true), set_config('app.allow_closed', 'on', true)`)
        await tx.query(`insert into public.${tbl} default values`)
      }))
    }
  }
  assert.deepEqual(await snapshotCounts(), before, 'alguma tabela ganhou linha')
})

test('escrita: UPDATE em todas as tabelas afeta 0 linhas (ou permission denied) para attacker, exceto a própria linha de profiles/notifications', async () => {
  const cols = await t.sql(`select distinct on (table_name) table_name, column_name from information_schema.columns
    where table_schema = 'public' and is_identity = 'NO' and is_generated = 'NEVER' order by table_name, ordinal_position`)
  const firstCol = Object.fromEntries(cols.rows.map((r) => [r.table_name, r.column_name]))
  const auditBefore = await count('audit_log')
  for (const tbl of TABLES) {
    const col = UPDATE_COL[tbl] ?? firstCol[tbl]
    let affected = 0
    try {
      affected = await t.asUser(attacker, async (tx) => {
        await tx.query(`select set_config('app.rpc', 'on', true), set_config('app.allow_closed', 'on', true)`)
        const r = await tx.query(`update public.${tbl} set ${col} = ${col}`)
        return r.affectedRows ?? 0
      })
    } catch (e) {
      assert.match(e.message, /permission denied/, `${tbl}: erro inesperado ${e.message}`)
      continue
    }
    if (tbl === 'profiles') assert.equal(affected, 1, 'profiles: só a própria linha')
    else if (tbl === 'notifications') assert.equal(affected, await count('notifications', 'where profile_id = $1', [attacker]), 'notifications: só as próprias')
    else assert.equal(affected, 0, `${tbl}: attacker atualizou ${affected} linhas`)
  }
  for (const who of [pending, inactive]) {
    const r = await t.asUser(who, (tx) => tx.query(`update public.profiles set full_name = full_name`))
    assert.equal(r.affectedRows ?? 0, 0, 'pendente/inativo não editam nem a própria linha')
  }
  assert.equal(await count('audit_log'), auditBefore, 'update de sondagem não pode gerar auditoria (0 linhas)')
})

test('escrita: DELETE em todas as tabelas → permission denied (ou 0 linhas nas 2 exceções) para attacker/pending/inactive', async () => {
  const before = await snapshotCounts()
  for (const who of [attacker, pending, inactive]) {
    for (const tbl of TABLES) {
      try {
        const r = await t.asUser(who, (tx) => tx.query(`delete from public.${tbl}`))
        assert.ok(['mission_participants', 'challenge_participants'].includes(tbl), `${tbl}: delete não deveria ter grant`)
        assert.equal(r.affectedRows ?? 0, 0)
      } catch (e) {
        assert.match(e.message, /permission denied/, `${tbl}: ${e.message}`)
      }
    }
  }
  assert.deepEqual(await snapshotCounts(), before)
})

test('escrita: anon não lê nem escreve em nenhuma tabela ou view (probe real, 47 objetos)', async () => {
  for (const rel of [...TABLES, ...VIEWS]) {
    await expectRlsDenied(t.asAnon((tx) => tx.query(`select * from public.${rel} limit 1`)))
  }
  for (const tbl of ['profiles', 'point_entries', 'app_secrets', 'notifications', 'rewards']) {
    await expectRlsDenied(t.asAnon((tx) => tx.query(`insert into public.${tbl} default values`)))
    await expectRlsDenied(t.asAnon((tx) => tx.query(`delete from public.${tbl}`)))
  }
})

// =============================================================================
// 2. Escalada de papel por caminhos de sistema
// =============================================================================
test('escalada: anon/authenticated não são superuser, não fazem bypass de RLS, não criam roles e não são membros de postgres/service_role/supabase_auth_admin', async () => {
  // No PGlite a sessão é do superuser postgres, então `set role` não é uma fronteira real aqui; o que importa é o catálogo.
  const r = await t.sql(`select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit,
      pg_has_role(rolname, 'postgres', 'MEMBER') as m_pg, pg_has_role(rolname, 'service_role', 'MEMBER') as m_sr,
      pg_has_role(rolname, 'supabase_auth_admin', 'MEMBER') as m_aa
    from pg_roles where rolname in ('anon', 'authenticated') order by rolname`)
  assert.equal(r.rows.length, 2)
  for (const row of r.rows) {
    assert.deepEqual({ ...row, rolname: undefined }, { rolname: undefined, rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false, rolinherit: false, m_pg: false, m_sr: false, m_aa: false }, row.rolname)
  }
  // mesmo dentro de uma tx que já pôs app.rpc=on, o papel continua authenticated e is_admin() é false
  const q = await t.asUser(attacker, async (tx) => {
    await tx.query(`select set_config('app.rpc', 'on', true)`)
    return tx.query(`select current_user as u, (select public.is_admin()) as adm`)
  })
  assert.equal(q.rows[0].u, 'authenticated')
  assert.equal(q.rows[0].adm, false)
})

test('escalada: anon/authenticated não têm CREATE em public nem USAGE em private; probe real de create function/table falha', async () => {
  const r = await t.sql(`select
    has_schema_privilege('authenticated', 'public', 'CREATE') as a_create,
    has_schema_privilege('anon', 'public', 'CREATE') as n_create,
    has_schema_privilege('authenticated', 'private', 'USAGE') as a_priv,
    has_schema_privilege('anon', 'private', 'USAGE') as n_priv,
    has_schema_privilege('authenticated', 'private', 'CREATE') as a_priv_c`)
  assert.deepEqual(r.rows[0], { a_create: false, n_create: false, a_priv: false, n_priv: false, a_priv_c: false })
  await expectError(t.asUser(attacker, (tx) => tx.query(`create function public.zz_evil() returns boolean language sql as 'select true'`)), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`create table public.zz_evil (id int)`)), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`create or replace function public.is_admin() returns boolean language sql as 'select true'`)), /must be owner|permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`alter function public.is_admin() owner to authenticated`)), /must be owner|permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`alter table public.profiles disable row level security`)), /must be owner|permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`create policy zz on public.app_secrets for select to authenticated using (true)`)), /must be owner|permission denied/)
})

test('escalada: default privileges revogados — tabela/função/view/sequence novas em public não ganham grant automático (§2.2)', async (tc) => {
  await t.db.exec(`create table public.zz_probe (id serial primary key, v text); create view public.v_zz_probe as select * from public.zz_probe;
    create function public.zz_probe_fn() returns int language sql as 'select 1'`)
  try {
    const r = await t.sql(`select
      has_table_privilege('authenticated', 'public.zz_probe', 'SELECT') as t_sel,
      has_table_privilege('authenticated', 'public.zz_probe', 'INSERT') as t_ins,
      has_table_privilege('anon', 'public.zz_probe', 'SELECT') as t_anon,
      has_table_privilege('authenticated', 'public.v_zz_probe', 'SELECT') as v_sel,
      has_sequence_privilege('authenticated', 'public.zz_probe_id_seq', 'USAGE') as s_auth`)
    assert.deepEqual(r.rows[0], { t_sel: false, t_ins: false, t_anon: false, v_sel: false, s_auth: false })
    // Funções: o default nativo do Postgres dá EXECUTE a PUBLIC; só o `alter default privileges ... revoke ... from public`
    // de 0001 desfaz isso. O PGlite não materializa pg_default_acl (a instrução vira no-op), então aqui a checagem
    // só vale quando o catálogo tem a entrada — caso contrário fica registrada como incerteza do harness.
    const dacl = await t.sql(`select count(*)::int as n from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' and d.defaclobjtype = 'f'`)
    if (Number(dacl.rows[0].n) === 0) {
      tc.diagnostic('PGlite não materializa ALTER DEFAULT PRIVILEGES (pg_default_acl vazio): EXECUTE de função nova não é verificável aqui')
    } else {
      const f = await t.sql(`select has_function_privilege('authenticated', 'public.zz_probe_fn()', 'EXECUTE') as f_auth, has_function_privilege('anon', 'public.zz_probe_fn()', 'EXECUTE') as f_anon`)
      assert.deepEqual(f.rows[0], { f_auth: false, f_anon: false }, 'função nova em public nasceu executável (default privileges não revogados)')
    }
  } finally {
    await t.db.exec(`drop view public.v_zz_probe; drop table public.zz_probe; drop function public.zz_probe_fn()`)
  }
})

test('escalada: colunas protegidas de profiles (role/status/job_title/team) → permission denied por coluna, para attacker e para o próprio pendente', async () => {
  for (const [who, col, val] of [[attacker, 'role', `'admin'`], [attacker, 'status', `'inactive'`], [attacker, 'job_title', `'manager'`], [attacker, 'team', `'x'`],
                                  [pending, 'status', `'active'`], [inactive, 'status', `'active'`], [pending, 'role', `'admin'`]]) {
    await expectError(t.asUser(who, (tx) => tx.query(`update public.profiles set ${col} = ${val} where id = $1`, [who])), /permission denied/)
  }
  const r = await t.sql('select id, role, status from public.profiles where id = any($1)', [[attacker, pending, inactive]])
  assert.deepEqual(r.rows.map((x) => x.role + ':' + x.status).sort(), ['collaborator:active', 'collaborator:inactive', 'collaborator:pending'])
})

test('team_code: rotação revoga o código antigo (validate=false e cadastro INVALID_TEAM_CODE); attacker não rotaciona; nenhum erro carrega o código', async () => {
  await expectCatalog(t.rpc(attacker, 'rotate_team_code'), 'NOT_ADMIN')
  await expectCatalog(t.rpc(pending, 'rotate_team_code'), 'NOT_ADMIN')
  assert.equal((await t.sql('select team_code from public.app_secrets where id = 1')).rows[0].team_code, teamCode, 'código mudou sem rotação')
  const oldCode = teamCode
  const newCode = await t.rpc(admin, 'rotate_team_code')
  assert.notEqual(newCode, oldCode)
  assert.match(newCode, /^[0-9A-F]{12}$/)
  teamCode = newCode
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: oldCode }, 'anon'), false)
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: newCode.toLowerCase() + '  ' }, 'anon'), true)
  const e = await expectCatalog(t.createAuthUser({ email: 'tardio@teste.local', metadata: { team_code: oldCode, full_name: 'Tardio' } }), 'INVALID_TEAM_CODE')
  assert.ok(!(e.detail ?? '').includes(oldCode) && !(e.detail ?? '').includes(newCode))
  assert.equal(await count('profiles', `where full_name = 'Tardio'`), 0)
  const late = await t.createAuthUser({ email: 'tardio2@teste.local', metadata: { team_code: newCode, full_name: 'Tardio 2' } })
  assert.equal((await t.sql('select status from public.profiles where id = $1', [late])).rows[0].status, 'pending')
  // auditoria/notificações nunca carregam o código para quem não é admin (attacker lê 0 linhas de audit_log de qualquer jeito)
  const n = await t.sql(`select count(*)::int as n from public.notifications where message like '%' || $1 || '%' or title like '%' || $1 || '%' or payload::text like '%' || $1 || '%'`, [newCode])
  assert.equal(Number(n.rows[0].n), 0)
  const f = await t.sql(`select count(*)::int as n from public.feed_events where payload::text like '%' || $1 || '%'`, [newCode])
  assert.equal(Number(f.rows[0].n), 0)
})

// =============================================================================
// 3. Toda RPC admin recusa attacker/pending/inactive com NOT_ADMIN na PRIMEIRA linha (mesmo com args válidos
//    ou com ids inexistentes — sem oráculo de existência) e sem efeito colateral; anon → permission denied
// =============================================================================
const adminCalls = () => {
  const far = addDays(activeStartsOn, 400)
  return [
    ['admin_update_profile', { p_profile_id: member, p_patch: { full_name: 'x' } }],
    ['admin_update_profile', { p_profile_id: NIL, p_patch: { full_name: 'x' } }],
    ['rotate_team_code', {}],
    ['update_app_settings', { p_patch: { company_name: 'x' } }],
    ['save_special_event', { p: { name: 'x', multiplier: 2, starts_at: far + 'T00:00:00Z', ends_at: far + 'T12:00:00Z' } }],
    ['recompute_stats', {}],
    ['recompute_stats', { p_profile_id: member }],
    ['create_season', { p_name: 'x', p_starts_on: far, p_ends_on: addDays(far, 10) }],
    ['update_season', { p_season_id: seasonId, p_patch: { name: 'x' } }],
    ['update_season', { p_season_id: NIL, p_patch: { name: 'x' } }],
    ['activate_season', { p_season_id: seasonId }],
    ['activate_season', { p_season_id: NIL }],
    ['close_season', { p_season_id: seasonId }],
    ['close_season', { p_season_id: NIL }],
    ['record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_quantity: 1, p_amount: 100 }],
    ['record_manual_entry', { p_profile_id: member, p_points: 10, p_reason: 'motivo válido' }],
    ['record_initial_points', { p_profile_id: member, p_points: 10 }],
    ['reverse_entry', { p_entry_id: memberEntryId, p_reason: 'motivo' }],
    ['reverse_entry', { p_entry_id: NIL, p_reason: 'motivo' }],
    ['save_mission', { p: { title: 'x', kind: 'daily', metric: 'sale', target_value: 1, reward_points: 10, starts_at: far + 'T00:00:00Z', ends_at: addDays(far, 5) + 'T00:00:00Z' } }],
    ['delete_mission', { p_mission_id: NIL }],
    ['save_challenge', { p: { name: 'x', kind: 'duel', metric: 'sales_count', target_value: 1, reward_points: 10, starts_at: far + 'T00:00:00Z', ends_at: addDays(far, 5) + 'T00:00:00Z', participant_ids: [member, attacker] } }],
    ['activate_challenge', { p_challenge_id: NIL }],
    ['finish_challenge', { p_challenge_id: NIL }],
    ['cancel_challenge', { p_challenge_id: NIL }],
    ['enqueue_wheel', { p_profile_id: member }],
    ['enqueue_wheel', { p_person_name: 'Convidado' }],
    ['update_queue_entry', { p_queue_id: queueId, p_attempts: 3 }],
    ['update_queue_entry', { p_queue_id: NIL, p_attempts: 3 }],
    ['remove_from_queue', { p_queue_id: queueId }],
    ['remove_from_queue', { p_queue_id: NIL }],
    ['release_turn', { p_queue_id: queueId }],
    ['release_turn', { p_queue_id: NIL }],
    ['approve_spin', { p_spin_id: NIL }],
    ['reject_spin', { p_spin_id: NIL }],
    ['save_wheel_prizes', { p_wheel_kind: 'premium', p_prizes: [{ label: 'a', kind: 'points', value: 1, sort_order: 0 }, { label: 'b', kind: 'points', value: 1, sort_order: 1 }] }],
    ['handle_redemption', { p_redemption_id: NIL, p_action: 'approve' }],
  ]
}

test('RPCs admin: attacker/pending/inactive recebem exatamente NOT_ADMIN (errcode 42501) em todas as 37 chamadas, sem efeito colateral', async () => {
  const before = await snapshotCounts()
  const leaks = []
  for (const who of [attacker, pending, inactive]) {
    for (const [name, args] of adminCalls()) {
      const e = await expectAnyError(t.rpc(who, name, args))
      if (e.message !== 'NOT_ADMIN' || e.code !== '42501') leaks.push(`${name}(${JSON.stringify(args)}) por ${who === attacker ? 'attacker' : who === pending ? 'pending' : 'inactive'} → ${e.message} [${e.code}]`)
    }
  }
  assert.deepEqual(leaks, [], 'checagem de papel não é a primeira linha (oráculo de existência/validação)')
  assert.deepEqual(await snapshotCounts(), before, 'chamada recusada deixou rastro')
})

test('RPCs admin: anon recebe permission denied em todas (nunca chega ao corpo da função)', async () => {
  for (const [name, args] of adminCalls()) {
    const e = await expectAnyError(t.rpc(null, name, args, 'anon'))
    assert.match(e.message, /permission denied for function/, `${name}: ${e.message}`)
  }
})

// =============================================================================
// 4. RPCs de membro: pendente/inativo recebem o código certo (PROFILE_PENDING / PROFILE_INACTIVE, 42501) e nada é gravado
// =============================================================================
test('RPCs de membro: pending → PROFILE_PENDING, inactive → PROFILE_INACTIVE (42501) em get_dashboard/spin_wheel_free/redeem_reward/mark_notifications_read; spin_wheel → NOT_ALLOWED', async () => {
  const before = await snapshotCounts()
  const calls = [
    ['get_dashboard', {}],
    ['spin_wheel_free', { p_wheel_kind: 'classic' }],
    ['redeem_reward', { p_reward_id: cheapRewardId }],
    ['mark_notifications_read', {}],
  ]
  for (const [who, code] of [[pending, 'PROFILE_PENDING'], [inactive, 'PROFILE_INACTIVE']]) {
    for (const [name, args] of calls) {
      const e = await expectCatalog(t.rpc(who, name, args), code)
      assert.equal(e.code, '42501', `${name}: errcode ${e.code}`)
    }
    // fila do membro: existe, mas não é dele → NOT_ALLOWED (não NO_ACTIVE_TURN); inexistente → QUEUE_NOT_FOUND
    await expectCatalog(t.rpc(who, 'spin_wheel', { p_queue_id: queueId }), 'NOT_ALLOWED')
    await expectCatalog(t.rpc(who, 'spin_wheel', { p_queue_id: NIL }), 'QUEUE_NOT_FOUND')
    const boot = await t.rpc(who, 'get_bootstrap')
    assert.deepEqual(Object.keys(boot), ['me'], 'bootstrap de não-ativo devolve só {me}')
    assert.deepEqual(Object.keys(boot.me).sort(), ['full_name', 'id', 'status'])
  }
  assert.deepEqual(await snapshotCounts(), before)
})

test('notificações: mark_notifications_read(ids do gestor) pelo attacker devolve 0 e não toca nas linhas alheias; ids inexistentes → 0', async () => {
  const adminIds = (await t.sql('select id from public.notifications where profile_id = $1 and not is_read', [admin])).rows.map((r) => r.id)
  assert.ok(adminIds.length > 0, 'gestor precisa ter notificações não lidas (pendentes/resgates)')
  assert.equal(await t.rpc(attacker, 'mark_notifications_read', { p_ids: adminIds }), 0)
  assert.equal(await t.rpc(attacker, 'mark_notifications_read', { p_ids: [NIL] }), 0)
  assert.equal(await count('notifications', 'where profile_id = $1 and not is_read', [admin]), adminIds.length)
  // UPDATE direto com id alheio: 0 linhas; coluna diferente de is_read: permission denied
  const r = await t.asUser(attacker, (tx) => tx.query('update public.notifications set is_read = true where id = any($1)', [adminIds]))
  assert.equal(r.affectedRows ?? 0, 0)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.notifications set title = 'x' where profile_id = $1`, [attacker])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.notifications set profile_id = $1 where profile_id = $2`, [admin, attacker])), /permission denied/)
})

// =============================================================================
// 5. Roleta: duplo crédito (approve×2, reject→approve), giro fora da vez, escrita direta em wheel_spins
// =============================================================================
test('roleta: approve_spin duas vezes credita UMA entry; reject→approve não credita; attacker não aprova/rejeita nem edita wheel_spins; spin_wheel_free não grava', async () => {
  const entriesBefore = await count('point_entries')
  const spinsBefore = await count('wheel_spins')
  // spin_wheel_free: 20 chamadas do attacker não gravam nada em lugar nenhum
  for (let i = 0; i < 20; i++) {
    const free = await t.rpc(attacker, 'spin_wheel_free', { p_wheel_kind: 'classic' })
    assert.equal(free.is_free, true)
    assert.equal(free.spin_id, undefined)
  }
  assert.equal(await count('wheel_spins'), spinsBefore)
  assert.equal(await count('point_entries'), entriesBefore)

  // 1º giro do membro → pending; attacker não aprova/rejeita; UPDATE direto em wheel_spins → permission denied
  const spin1 = await t.rpc(member, 'spin_wheel', { p_queue_id: queueId })
  assert.equal(spin1.resolved_prize.kind, 'coins')
  await expectCatalog(t.rpc(attacker, 'approve_spin', { p_spin_id: spin1.spin_id }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'reject_spin', { p_spin_id: spin1.spin_id }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(member, 'approve_spin', { p_spin_id: spin1.spin_id }), 'NOT_ADMIN')
  await expectError(t.asUser(member, (tx) => tx.query(`update public.wheel_spins set status = 'approved' where id = $1`, [spin1.spin_id])), /permission denied/)
  await expectError(t.asUser(member, (tx) => tx.query(`update public.wheel_queue set attempts_allowed = 20 where id = $1`, [queueId])), /permission denied/)
  await expectCatalog(t.rpc(member, 'spin_wheel', { p_queue_id: queueId }), 'SPIN_PENDING')

  // gestor aprova 2× → 1 entry só
  const balBefore = await balance(member)
  const ok = await t.rpc(admin, 'approve_spin', { p_spin_id: spin1.spin_id })
  assert.equal(ok.spin.credited, true)
  await expectCatalog(t.rpc(admin, 'approve_spin', { p_spin_id: spin1.spin_id }), 'SPIN_NOT_PENDING')
  await expectCatalog(t.rpc(admin, 'reject_spin', { p_spin_id: spin1.spin_id }), 'SPIN_NOT_PENDING')
  assert.equal(await balance(member), balBefore + 500)
  assert.equal(await count('point_entries', `where source = 'wheel' and profile_id = $1`, [member]), 1)
  assert.equal(await count('feed_events', `where dedupe_key = $1`, ['wheel:' + spin1.spin_id]), 1)

  // 2º giro → rejeitado → aprovar depois não credita; tentativa não é consumida
  const spin2 = await t.rpc(member, 'spin_wheel', { p_queue_id: queueId })
  await t.rpc(admin, 'reject_spin', { p_spin_id: spin2.spin_id })
  await expectCatalog(t.rpc(admin, 'approve_spin', { p_spin_id: spin2.spin_id }), 'SPIN_NOT_PENDING')
  assert.equal(await balance(member), balBefore + 500)
  const q = (await t.sql('select attempts_used, attempts_allowed, status from public.wheel_queue where id = $1', [queueId])).rows[0]
  assert.deepEqual([q.attempts_used, q.attempts_allowed, q.status], [1, 2, 'active'])

  // 3º giro (2ª tentativa válida) → aprovado → fila done → 4º giro NO_ACTIVE_TURN; attacker continua NOT_ALLOWED
  const spin3 = await t.rpc(member, 'spin_wheel', { p_queue_id: queueId })
  const done = await t.rpc(admin, 'approve_spin', { p_spin_id: spin3.spin_id })
  assert.equal(done.queue.status, 'done')
  await expectCatalog(t.rpc(member, 'spin_wheel', { p_queue_id: queueId }), 'NO_ACTIVE_TURN')
  await expectCatalog(t.rpc(attacker, 'spin_wheel', { p_queue_id: queueId }), 'NOT_ALLOWED')
  assert.equal(await balance(member), balBefore + 1000)
  assert.equal(await count('wheel_spins', 'where queue_id = $1', [queueId]), 3)
  memberBalance = await balance(member)
})

// =============================================================================
// 6. Resgate: duplo estorno, resgate duplo numa só instrução, saldo devedor
// =============================================================================
test('resgate: redeem_reward duas vezes na MESMA instrução (um snapshot) não gasta duas vezes com estoque 1', async () => {
  const bal = await balance(member)
  const e = await expectCatalog(
    t.asUser(member, (tx) => tx.query('select public.redeem_reward($1) as a, public.redeem_reward($1) as b', [cheapRewardId])),
    /OUT_OF_STOCK|INSUFFICIENT_COINS/,
  )
  assert.ok(['OUT_OF_STOCK', 'INSUFFICIENT_COINS'].includes(e.message))
  assert.equal(await balance(member), bal, 'transação abortada não pode debitar')
  assert.equal(await count('reward_redemptions', 'where reward_id = $1', [cheapRewardId]), 0)
  assert.equal((await t.sql('select stock from public.rewards where id = $1', [cheapRewardId])).rows[0].stock, 1)
})

test('resgate: cancelar duas vezes gera UM estorno; deliver/approve depois de cancelado → REDEMPTION_TRANSITION_INVALID; estoque volta uma vez só', async () => {
  const bal = await balance(member)
  const red = await t.rpc(member, 'redeem_reward', { p_reward_id: cheapRewardId })
  assert.equal(red.coins_balance, bal - 10)
  assert.equal((await t.sql('select stock from public.rewards where id = $1', [cheapRewardId])).rows[0].stock, 0)
  await expectCatalog(t.rpc(attacker, 'handle_redemption', { p_redemption_id: red.redemption_id, p_action: 'cancel' }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(member, 'handle_redemption', { p_redemption_id: red.redemption_id, p_action: 'deliver' }), 'NOT_ADMIN')
  const c1 = await t.rpcRow(admin, 'handle_redemption', { p_redemption_id: red.redemption_id, p_action: 'cancel', p_notes: 'teste' })
  assert.equal(c1[0].status, 'cancelled')
  assert.ok(c1[0].refund_entry_id)
  await expectCatalog(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: red.redemption_id, p_action: 'cancel' }), 'REDEMPTION_TRANSITION_INVALID')
  await expectCatalog(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: red.redemption_id, p_action: 'deliver' }), 'REDEMPTION_TRANSITION_INVALID')
  await expectCatalog(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: red.redemption_id, p_action: 'approve' }), 'REDEMPTION_TRANSITION_INVALID')
  assert.equal(await balance(member), bal, 'saldo restaurado exatamente uma vez')
  assert.equal(await count('point_entries', `where source = 'reward' and profile_id = $1 and reverses_entry_id is not null`, [member]), 1)
  assert.equal((await t.sql('select stock from public.rewards where id = $1', [cheapRewardId])).rows[0].stock, 1)
  // o estorno não pode ser estornado e o resgate original só via handle_redemption
  await expectCatalog(t.rpcRow(admin, 'reverse_entry', { p_entry_id: c1[0].refund_entry_id, p_reason: 'x' }), 'CANNOT_REVERSE_REVERSAL')
  await expectCatalog(t.rpcRow(admin, 'reverse_entry', { p_entry_id: c1[0].entry_id, p_reason: 'x' }), /USE_HANDLE_REDEMPTION|ALREADY_REVERSED/)
})

test('resgate: resgate com saldo exato + estorno do crédito original → saldo devedor; novo resgate → INSUFFICIENT_COINS com "faltam" > custo', async () => {
  const bal = await balance(member)
  await t.sql('update public.rewards set cost_coins = $1 where id = $2', [bal, exactRewardId])
  const red = await t.rpc(member, 'redeem_reward', { p_reward_id: exactRewardId })
  assert.equal(red.coins_balance, 0)
  await t.rpcRow(admin, 'reverse_entry', { p_entry_id: memberEntryId, p_reason: 'estorno do crédito' })
  assert.equal(await balance(member), -1000)
  const e = await expectCatalog(t.rpc(member, 'redeem_reward', { p_reward_id: cheapRewardId }), 'INSUFFICIENT_COINS')
  assert.match(e.detail ?? '', /faltam 1010/)
  const wallet = await t.asUser(member, (tx) => tx.query('select * from public.v_wallet where profile_id = $1', [member]))
  assert.equal(Number(wallet.rows[0].coins_balance), -1000)
  // o membro não "resolve" a dívida escrevendo em point_entries nem cancelando o próprio pedido
  await expectAnyError(t.asUser(member, (tx) => tx.query(`insert into public.point_entries (profile_id, source, base_points, coins, reason, occurred_at) values ($1, 'manual', 0, 1000, 'x', now())`, [member])))
  await expectCatalog(t.rpc(member, 'handle_redemption', { p_redemption_id: red.redemption_id, p_action: 'cancel' }), 'NOT_ADMIN')
  assert.equal(await balance(member), -1000)
})

// =============================================================================
// 7. Temporada fechada: lançamentos, ativação, reabertura e estorno
// =============================================================================
test('temporada fechada: record_* com occurred_at na temporada fechada → SEASON_CLOSED; activate → SEASON_CLOSED; close de novo → SEASON_ALREADY_CLOSED; estorno continua permitido e cai na temporada fechada', async () => {
  const startsOn = addDays(activeStartsOn, -60)
  const endsOn = addDays(activeStartsOn, -31)
  const inside = addDays(activeStartsOn, -45) + 'T15:00:00Z'
  const past = (await t.rpcRow(admin, 'create_season', { p_name: 'Temporada passada (teste)', p_starts_on: startsOn, p_ends_on: endsOn }))[0]
  assert.equal(past.is_active, false)
  const entry = (await t.rpcRow(admin, 'record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_quantity: 1, p_amount: 300, p_occurred_at: inside }))[0]
  assert.equal(entry.season_id, past.id)
  const closed = await t.rpc(admin, 'close_season', { p_season_id: past.id })
  assert.equal(closed.season_id, past.id)
  assert.equal((await t.sql('select id from public.seasons where is_active')).rows[0].id, seasonId, 'a temporada ativa não pode mudar ao fechar a passada')

  await expectCatalog(t.rpcRow(admin, 'record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_quantity: 1, p_amount: 300, p_occurred_at: inside }), 'SEASON_CLOSED')
  await expectCatalog(t.rpcRow(admin, 'record_rule_entry', { p_profile_id: pending, p_rule_id: saleRuleId, p_quantity: 1, p_amount: 300, p_occurred_at: inside }), 'PROFILE_INACTIVE')
  await expectCatalog(t.rpcRow(admin, 'activate_season', { p_season_id: past.id }), 'SEASON_CLOSED')
  await expectCatalog(t.rpc(admin, 'close_season', { p_season_id: past.id }), 'SEASON_ALREADY_CLOSED')
  await expectCatalog(t.rpcRow(admin, 'update_season', { p_season_id: past.id, p_patch: { starts_on: addDays(startsOn, -5) } }), CODE_RE)
  await expectCatalog(t.rpcRow(admin, 'update_season', { p_season_id: past.id, p_patch: { closed_at: null } }), 'INVALID_PATCH_KEY')
  await expectCatalog(t.rpcRow(admin, 'update_season', { p_season_id: past.id, p_patch: { is_active: true } }), 'INVALID_PATCH_KEY')
  // insert direto do gestor com app.allow_closed ligado à mão não reabre a temporada
  await expectCatalog(t.asUser(admin, async (tx) => {
    await tx.query(`select set_config('app.rpc', 'on', true)`)
    return tx.query(`insert into public.point_entries (profile_id, source, base_points, coins, reason, occurred_at) values ($1, 'manual', 5, 0, 'forjado', $2)`, [member, inside])
  }), 'SEASON_CLOSED')
  const closedRow = (await t.sql('select closed_at, is_active from public.seasons where id = $1', [past.id])).rows[0]
  assert.ok(closedRow.closed_at && !closedRow.is_active)
  // estorno permitido: herda occurred_at/season da original e inverte sinais
  const rev = (await t.rpcRow(admin, 'reverse_entry', { p_entry_id: entry.id, p_reason: 'estorno em temporada fechada' }))[0]
  assert.equal(rev.season_id, past.id)
  assert.equal(Number(rev.points), -Number(entry.points))
  assert.equal(Number(rev.coins), -Number(entry.coins))
  assert.equal(new Date(rev.occurred_at).getTime(), new Date(entry.occurred_at).getTime())
  await expectCatalog(t.rpcRow(admin, 'reverse_entry', { p_entry_id: entry.id, p_reason: 'de novo' }), 'ALREADY_REVERSED')
  // colaborador não vê season_results alheio da temporada fechada
  const sr = await t.asUser(attacker, (tx) => tx.query('select profile_id from public.season_results where season_id = $1', [past.id]))
  assert.ok(sr.rows.every((r) => r.profile_id === attacker), 'season_results alheio vazou')
})

// =============================================================================
// 8. Args hostis por TIPO (jsonb array/escalar/null, enum inválido, datas quebradas, tamanhos) → sempre código do catálogo
// =============================================================================
test('args hostis (tipo): admin_update_profile com patch array/escalar/null, role/status inválidos, tipos errados → código do catálogo, perfil intacto', async () => {
  const before = (await t.sql('select p.*, pp.email, pp.phone from public.profiles p join public.profile_private pp on pp.profile_id = p.id where p.id = $1', [member])).rows[0]
  const patches = [
    [], 'texto', 42, null, true,
    { role: 'superadmin' }, { role: null }, { status: null }, { status: 'deleted' }, { status: 'pending' },
    { full_name: null }, { full_name: 123 }, { full_name: 'x'.repeat(5000) }, { full_name: '' },
    { email: 'sem-arroba' }, { email: null }, { email: 'GESTOR@teste.local' },
    { color: '<script>' }, { color: null }, { job_title: 'CEO' }, { team: 'x'.repeat(1000) },
    { goal_amount: 'abc' }, { goal_amount: -1 }, { goal_amount: 1e30 }, { default_goal_amount: 'abc' },
    { avatar_path: '../../etc/passwd' }, { avatar_path: admin + '/avatar-1700000000000.jpg' }, { preferences: { theme: 'dark' } },
    { id: NIL }, { created_at: '2020-01-01' }, { '__proto__': 1 }, { "full_name'; drop table public.profiles; --": 'x' },
  ]
  const raw = []
  for (const p of patches) {
    try {
      await t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: jsonArg(p) })
      // patches no-op/aceitos não podem alterar role/status
      const now = (await t.sql('select role, status from public.profiles where id = $1', [member])).rows[0]
      assert.deepEqual(now, { role: 'collaborator', status: 'active' }, `patch ${JSON.stringify(p)} mudou papel/status`)
    } catch (e) {
      if (!CODE_RE.test(e.message)) raw.push(`${JSON.stringify(p).slice(0, 60)} → ${e.message.slice(0, 90)} [${e.code}]`)
    }
  }
  const after = (await t.sql('select p.*, pp.email, pp.phone from public.profiles p join public.profile_private pp on pp.profile_id = p.id where p.id = $1', [member])).rows[0]
  assert.deepEqual({ role: after.role, status: after.status, id: after.id }, { role: before.role, status: before.status, id: before.id })
  assert.equal(await count('profiles'), 6)
  // colisão de e-mail é case-insensitive (lower(email) UQ) e o e-mail de login do gestor não é tomado
  await expectCatalog(t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: { email: 'GESTOR@teste.local' } }), 'EMAIL_TAKEN')
  await expectCatalog(t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: { email: ' gestor@teste.local ' } }), /EMAIL_TAKEN|EMAIL_INVALID/)
  assert.equal((await t.sql('select email from public.profile_private where profile_id = $1', [admin])).rows[0].email, 'gestor@teste.local')
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: { email: before.email } })
  assert.deepEqual(raw, [], 'erro cru vazou')
})

test('args hostis (tipo): update_app_settings / save_special_event / create_season / enqueue_wheel / handle_redemption → código do catálogo; singleton e fila intactos', async () => {
  const settingsBefore = (await t.sql('select * from public.app_settings where id = 1')).rows[0]
  const raw = []
  const probe = async (name, args) => {
    const a = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, k === 'p_patch' || k === 'p' ? jsonArg(v) : v]))
    try { await t.rpc(admin, name, a) } catch (e) { if (!CODE_RE.test(e.message)) raw.push(`${name}(${JSON.stringify(args).slice(0, 70)}) → ${e.message.slice(0, 90)} [${e.code}]`) }
  }
  for (const p of [[], 'x', null, { xp_per_level: 'abc' }, { xp_per_level: null }, { xp_per_level: -5 }, { xp_per_level: 1e12 }, { rank_admins: 'sim' },
                   { timezone: 'Mars/Base' }, { timezone: null }, { timezone: "'; select 1; --" }, { currency: null }, { currency: 'x'.repeat(50) },
                   { company_name: 'x'.repeat(5000) }, { company_name: null }, { auto_approve_members: 'yes' }, { target_conversion_pct: 500 },
                   { id: 2 }, { team_code: 'HACK' }, { bootstrap_done: false }]) {
    await probe('update_app_settings', { p_patch: p })
  }
  const far = addDays(activeStartsOn, 300)
  for (const p of [[], 'x', null, {}, { name: null, multiplier: 2, starts_at: far, ends_at: far }, { name: 'x', multiplier: 'dois', starts_at: far, ends_at: far },
                   { name: 'x', multiplier: 2, starts_at: 'ontem', ends_at: far }, { name: 'x', multiplier: 2, starts_at: far + 'T10:00:00Z', ends_at: far + 'T09:00:00Z' },
                   { name: 'x', multiplier: 0, starts_at: far + 'T00:00:00Z', ends_at: far + 'T10:00:00Z' }, { name: 'x', multiplier: 999, starts_at: far + 'T00:00:00Z', ends_at: far + 'T10:00:00Z' },
                   { id: NIL, name: 'x', multiplier: 2, starts_at: far + 'T00:00:00Z', ends_at: far + 'T10:00:00Z' }, { id: 'não-uuid', name: 'x', multiplier: 2, starts_at: far + 'T00:00:00Z', ends_at: far + 'T10:00:00Z' }]) {
    await probe('save_special_event', { p })
  }
  await probe('create_season', { p_name: null, p_starts_on: far, p_ends_on: far })
  await probe('create_season', { p_name: '', p_starts_on: far, p_ends_on: far })
  await probe('create_season', { p_name: 'x'.repeat(5000), p_starts_on: far, p_ends_on: far })
  await probe('create_season', { p_name: 'x', p_starts_on: null, p_ends_on: far })
  await probe('create_season', { p_name: 'x', p_starts_on: far, p_ends_on: far, p_team_goal_amount: -1 })
  await probe('create_season', { p_name: 'x', p_starts_on: far, p_ends_on: far, p_team_goal_amount: 1e30 })
  await probe('create_season', { p_name: 'x', p_starts_on: '0001-01-01', p_ends_on: '9999-12-31' })
  await probe('enqueue_wheel', { p_person_name: '' })
  await probe('enqueue_wheel', { p_person_name: '   ' })
  await probe('enqueue_wheel', { p_person_name: 'x'.repeat(10000) })
  await probe('enqueue_wheel', { p_profile_id: member, p_wheel_kind: null })
  await probe('enqueue_wheel', { p_profile_id: member, p_attempts: null })
  await probe('handle_redemption', { p_redemption_id: NIL, p_action: 'APPROVE' })
  await probe('handle_redemption', { p_redemption_id: NIL, p_action: null })
  await probe('handle_redemption', { p_redemption_id: null, p_action: 'approve' })
  await probe('record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_quantity: null })
  await probe('record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_occurred_at: null })
  await probe('record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_amount: -1 })
  await probe('record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_amount: 1e30 })
  await probe('record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_amount: 100, p_reason: 'x'.repeat(10000) })
  await probe('record_manual_entry', { p_profile_id: member, p_points: 10, p_reason: null })
  await probe('record_manual_entry', { p_profile_id: member, p_points: null, p_reason: 'motivo' })
  await probe('record_initial_points', { p_profile_id: member, p_points: null })
  // 'yes'/'sim' etc.: 'yes' é literal boolean válido no Postgres, então só as colunas numéricas/texto/id precisam estar intactas
  const settingsAfter = (await t.sql('select * from public.app_settings where id = 1')).rows[0]
  for (const k of ['id', 'company_name', 'xp_per_level', 'currency', 'timezone', 'target_conversion_pct']) assert.equal(settingsAfter[k], settingsBefore[k], `app_settings.${k} alterado por patch hostil`)
  assert.equal(await count('app_settings'), 1)
  assert.equal((await t.sql('select team_code, bootstrap_done from public.app_secrets where id = 1')).rows[0].team_code, teamCode)
  await t.rpc(admin, 'update_app_settings', { p_patch: { auto_approve_members: settingsBefore.auto_approve_members, rank_admins: settingsBefore.rank_admins } })
  assert.deepEqual(raw, [], 'erro cru vazou')
})

test('args hostis (tipo): save_mission / save_challenge / save_wheel_prizes com enum inválido, ids não-uuid, listas quebradas → código do catálogo; nada gravado', async () => {
  const before = await snapshotCounts()
  const far = addDays(activeStartsOn, 5)
  const win = { starts_at: far + 'T00:00:00Z', ends_at: addDays(far, 3) + 'T00:00:00Z' }
  const raw = []
  const probe = async (name, p) => {
    try { await t.rpc(admin, name, { p: jsonArg(p) }) } catch (e) { if (!CODE_RE.test(e.message)) raw.push(`${name}(${JSON.stringify(p).slice(0, 80)}) → ${e.message.slice(0, 90)} [${e.code}]`) }
  }
  const base = { title: 'x', kind: 'daily', metric: 'sale', target_value: 1, reward_points: 10, ...win }
  for (const p of [[], 'x', null, {}, { ...base, kind: 'bogus' }, { ...base, metric: 'bogus' }, { ...base, target_value: 'um' }, { ...base, target_value: -1 },
                   { ...base, reward_points: 1e12 }, { ...base, reward_points: -1 }, { ...base, reward_coins: 'x' }, { ...base, starts_at: 'ontem' },
                   { ...base, id: 'não-uuid' }, { ...base, id: NIL }, { ...base, reward_spin: 'bogus' }, { ...base, audience: 'selected', participant_ids: ['não-uuid'] },
                   { ...base, audience: 'selected', participant_ids: [NIL] }, { ...base, audience: 'bogus' }, { ...base, title: 'x'.repeat(5000) }, { ...base, title: null },
                   { ...base, icon: 'x'.repeat(500) }, { ...base, description: 'x'.repeat(50000) }]) {
    await probe('save_mission', p)
  }
  const cb = { name: 'x', kind: 'duel', metric: 'sales_count', target_value: 1, reward_points: 10, ...win, participant_ids: [member, attacker] }
  for (const p of [[], 'x', null, {}, { ...cb, kind: 'bogus' }, { ...cb, participant_ids: 'x' }, { ...cb, participant_ids: ['não-uuid', member] },
                   { ...cb, participant_ids: [NIL, member] }, { ...cb, participant_ids: [member, member] }, { ...cb, participant_ids: [member] },
                   { ...cb, participant_ids: null }, { ...cb, target_value: 'um' }, { ...cb, reward_points: 1e12 }, { ...cb, id: 'não-uuid' }, { ...cb, id: NIL },
                   { ...cb, reward_description: 'x'.repeat(5000) }, { ...cb, ends_at: 'amanhã' }]) {
    await probe('save_challenge', p)
  }
  const pr = (extra) => [{ label: 'a', kind: 'points', value: 1, sort_order: 0, ...extra }, { label: 'b', kind: 'points', value: 1, sort_order: 1 }]
  for (const [kind, prizes] of [['premium', {}], ['premium', 'x'], ['premium', []], ['premium', [{}]], ['premium', pr({ kind: 'bogus' })], ['premium', pr({ value: 'um' })],
                                ['premium', pr({ value: -1 })], ['premium', pr({ weight: 0 })], ['premium', pr({ weight: -1 })], ['premium', pr({ weight: 1e12 })],
                                ['premium', pr({ sort_order: -1 })], ['premium', pr({ sort_order: 'x' })], ['premium', pr({ id: 'não-uuid' })],
                                ['premium', pr({ label: 'x'.repeat(500) })], ['premium', pr({ label: null })], ['premium', pr({ color: 'red' })], [null, pr({})],
                                ['premium', [{ label: 'm', kind: 'mystery', sort_order: 0 }, { label: 'm2', kind: 'mystery', sort_order: 1 }]]]) {
    try { await t.rpcRow(admin, 'save_wheel_prizes', { p_wheel_kind: kind, p_prizes: jsonArg(prizes) }) } catch (e) {
      if (!CODE_RE.test(e.message)) raw.push(`save_wheel_prizes(${kind}, ${JSON.stringify(prizes).slice(0, 60)}) → ${e.message.slice(0, 90)} [${e.code}]`)
    }
  }
  // Nota de implementação: p_wheel_kind é `public.wheel_kind` na assinatura de §7.6 — 'bogus' é rejeitado
  // pelo cast do argumento (22P02) ANTES de a função executar, fora do alcance de qualquer handler em SQL. O front
  // só envia valores do enum. O que a spec exige (§9) é que nada seja gravado — verificado pelo snapshot abaixo.
  const enumErr = await expectAnyError(t.rpcRow(admin, 'save_wheel_prizes', { p_wheel_kind: 'bogus', p_prizes: pr({}) }))
  assert.equal(enumErr.code, '22P02')
  assert.deepEqual(await snapshotCounts(), before, 'arg hostil deixou rastro')
  assert.deepEqual(raw, [], 'erro cru vazou')
})

// =============================================================================
// 9. Catálogo: realtime, storage, triggers, views
// =============================================================================
test('realtime: a publication supabase_realtime só carrega as 5 tabelas públicas (§12) — nunca point_entries/app_secrets/profile_private/audit_log', async () => {
  const r = await t.sql(`select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 2`)
  const tables = r.rows.map((x) => x.tablename)
  assert.deepEqual(tables, [...REALTIME_TABLES].sort())
  assert.ok(r.rows.every((x) => x.schemaname === 'public'))
  const ri = await t.sql(`select relname, relreplident from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relname = any($1)`, [['wheel_queue', 'wheel_spins', 'wheel_prizes', 'notifications']])
  assert.ok(ri.rows.every((x) => x.relreplident === 'f'), 'replica identity full nas 4 tabelas com update')
  // point_entries não tem replica identity full (não está na publication) — nada mais em public com identity full sem estar publicado
  const extra = await t.sql(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and relreplident = 'f' and relname <> all($1)`, [REALTIME_TABLES])
  assert.deepEqual(extra.rows, [])
})

test('storage: bucket avatars público, 1,5 MB, só jpeg/png/webp (sem svg/gif); 4 policies, todas "to authenticated", nenhuma para anon/public', async () => {
  const b = (await t.sql(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'`)).rows[0]
  assert.ok(b, 'bucket avatars ausente')
  assert.equal(b.public, true)
  assert.ok(Number(b.file_size_limit) <= 1572864)
  assert.deepEqual([...b.allowed_mime_types].sort(), ['image/jpeg', 'image/png', 'image/webp'])
  assert.equal((await t.sql(`select count(*)::int as n from storage.buckets where id <> 'avatars'`)).rows[0].n, 0, 'bucket extra')
  const pol = await t.sql(`select policyname, cmd, roles::text as roles, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects' order by 1`)
  assert.equal(pol.rows.length, 4)
  for (const p of pol.rows) {
    assert.equal(p.roles, '{authenticated}', `${p.policyname} não é só para authenticated`)
    assert.match(p.qual ?? p.with_check ?? '', /is_active_member|is_admin/, `${p.policyname} não exige membro ativo`)
  }
  assert.deepEqual(pol.rows.map((p) => p.cmd).sort(), ['DELETE', 'INSERT', 'SELECT', 'UPDATE'])
  assert.equal((await t.sql(`select count(*)::int as n from pg_policies where schemaname = 'storage' and (roles::text like '%anon%' or roles::text like '%public%')`)).rows[0].n, 0)
})

test('storage: extensão maiúscula, epoch curto, .jpg.svg, pasta do pendente/inativo e bucket estranho são barrados; attacker não move objeto para pasta alheia', async () => {
  const ok = `${attacker}/avatar-1700000000000.jpg`
  await t.asUser(attacker, (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [ok, attacker]))
  for (const name of [`${attacker}/avatar-1700000000000.JPG`, `${attacker}/avatar-1.jpg`, `${attacker}/avatar-1700000000000.jpg.svg`, `${attacker}/avatar-1700000000000.jpg/`,
                      `${attacker}/x/avatar-1700000000000.jpg`, `${attacker}avatar-1700000000000.jpg`, ` ${attacker}/avatar-1700000000000.jpg`, `${attacker}/AVATAR-1700000000000.jpg`,
                      `${attacker}/avatar-1700000000000.jpg\n${admin}/avatar-1700000000000.jpg`]) {
    await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [name, attacker])))
  }
  for (const who of [pending, inactive]) {
    await expectRlsDenied(t.asUser(who, (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [`${who}/avatar-1700000000000.jpg`, who])))
  }
  await expectRlsDenied(t.asAnon((tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${NIL}/avatar-1700000000000.jpg`])))
  // mover para pasta alheia / bucket inexistente
  const moved = await expectAnyError(t.asUser(attacker, (tx) => tx.query(`update storage.objects set name = $1 where name = $2`, [`${admin}/avatar-1700000000001.jpg`, ok])))
  assert.match(moved.message, /row-level security|permission denied/)
  await expectAnyError(t.asUser(attacker, (tx) => tx.query(`update storage.objects set bucket_id = 'outro' where name = $1`, [ok])))
  assert.equal((await t.sql(`select count(*)::int as n from storage.objects where name = $1`, [ok])).rows[0].n, 1)
  // profiles.avatar_path com a mesma regra: attacker só aponta para a própria pasta e formato fechado
  for (const path of [`${admin}/avatar-1700000000000.jpg`, `${attacker}/avatar-1700000000000.svg`, `${attacker}/../${admin}/avatar-1700000000000.jpg`, 'http://x/a.jpg']) {
    await expectAnyError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set avatar_path = $1 where id = $2`, [path, attacker])))
  }
  await t.asUser(attacker, (tx) => tx.query(`update public.profiles set avatar_path = $1 where id = $2`, [ok, attacker]))
  assert.equal((await t.sql('select avatar_path from public.profiles where id = $1', [attacker])).rows[0].avatar_path, ok)
  await t.sql(`delete from storage.objects where name = $1`, [ok])
})

test('catálogo: nenhum trigger de public/auth desativado; toda função de trigger é definer com search_path fixo e mora em private; views não citam app_secrets', async () => {
  const trg = await t.sql(`select c.relname, t.tgname, t.tgenabled, p.proname, n2.nspname as fn_schema, p.prosecdef, p.proconfig::text as cfg
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid join pg_namespace n2 on n2.oid = p.pronamespace
    where not t.tgisinternal and n.nspname in ('public', 'auth')`)
  assert.ok(trg.rows.length >= 40, `poucos triggers: ${trg.rows.length}`)
  const bad = trg.rows.filter((r) => r.tgenabled === 'D' || r.fn_schema !== 'private' || !r.prosecdef || !(r.cfg ?? '').includes('search_path'))
  assert.deepEqual(bad.map((r) => `${r.relname}.${r.tgname} → ${r.fn_schema}.${r.proname} enabled=${r.tgenabled} definer=${r.prosecdef} cfg=${r.cfg}`), [])
  assert.ok(trg.rows.some((r) => r.relname === 'users' && r.proname === 'handle_new_user'), 'trigger de auth.users ausente')
  const views = await t.sql(`select viewname, pg_get_viewdef(('public.' || viewname)::regclass, true) as def from pg_views where schemaname = 'public'`)
  assert.equal(views.rows.length, VIEWS.length)
  for (const v of views.rows) {
    assert.ok(!/app_secrets|team_code|bootstrap_email/i.test(v.def), `${v.viewname} referencia app_secrets`)
    assert.ok(!/audit_log/i.test(v.def), `${v.viewname} referencia audit_log`)
  }
  // nenhuma função de public é chamável por PUBLIC (proacl com =X/)
  const pub = await t.sql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.proacl::text ~ '(\\{|,)=X/'`)
  assert.deepEqual(pub.rows, [], 'função com EXECUTE para PUBLIC')
  // owner de todas as funções definer = superuser (postgres); nenhuma pertence a anon/authenticated/service_role
  const own = await t.sql(`select p.proname, r.rolname from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid = p.proowner
    where n.nspname in ('public', 'private') and r.rolname in ('anon', 'authenticated', 'service_role', 'supabase_auth_admin')`)
  assert.deepEqual(own.rows, [])
})
