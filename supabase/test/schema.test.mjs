// Varredura de segurança do schema (DATA-MODEL §2.2, §2.3, §2.4, §10, §15 teste (k)).
// Lê pg_catalog como superusuário e falha se qualquer objeto de public estiver fora do
// contrato: RLS em toda tabela, nenhum DELETE para authenticated fora das duas exceções,
// views só SELECT e security_invoker, anon sem nada além de signup_mode/validate_team_code,
// toda função de public com search_path fixo e executável só se estiver na lista.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb } from './pglite-harness.mjs'

let t

before(async () => {
  t = await createTestDb()
})
after(async () => t?.close())

const rows = async (text, params) => (await t.sql(text, params)).rows

const DELETE_EXCEPTIONS = ['mission_participants', 'challenge_participants']
const ANON_FUNCTIONS = ['signup_mode', 'validate_team_code']

// §6.1 + §7 (7.1–7.8): tudo o que authenticated pode executar em public.
const AUTHENTICATED_FUNCTIONS = [
  // §6.1 helpers
  'is_active_member', 'is_admin', 'active_season_id', 'app_timezone', 'local_day', 'local_today', 'iso_week_key', 'avatar_count', 'mission_period',
  // §7.1 cadastro e sessão
  'signup_mode', 'validate_team_code', 'get_bootstrap', 'get_dashboard',
  // §7.2 perfil e configuração
  'admin_update_profile', 'rotate_team_code', 'update_app_settings', 'save_special_event', 'recompute_stats',
  // §7.3 temporada
  'create_season', 'update_season', 'activate_season', 'close_season',
  // §7.4 ledger
  'record_rule_entry', 'record_manual_entry', 'record_initial_points', 'reverse_entry',
  // §7.5 missões e desafios
  'save_mission', 'delete_mission', 'save_challenge', 'activate_challenge', 'finish_challenge', 'cancel_challenge',
  // §7.6 roleta
  'enqueue_wheel', 'update_queue_entry', 'remove_from_queue', 'release_turn', 'spin_wheel', 'spin_wheel_free', 'approve_spin', 'reject_spin', 'save_wheel_prizes',
  // §7.7 recompensas
  'redeem_reward', 'handle_redemption',
  // §7.8 notificações
  'mark_notifications_read',
]

const publicTables = () => rows(`
  select c.relname as name, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') order by c.relname`)

const publicViews = () => rows(`
  select c.relname as name, c.reloptions as options
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v' order by c.relname`)

const publicFunctions = () => rows(`
  select p.proname as name, p.oid::regprocedure::text as signature, p.proconfig as config, p.prosecdef as definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' order by p.proname`)

test('todas as tabelas de public existem em número esperado e têm RLS ligado', async () => {
  const tables = await publicTables()
  assert.equal(tables.length, 31, 'DATA-MODEL §4 lista 31 tabelas (4.32 removida)')
  const without = tables.filter((x) => !x.rls).map((x) => x.name)
  assert.deepEqual(without, [], `tabelas sem row level security: ${without.join(', ')}`)
})

test('authenticated não tem DELETE em nenhuma tabela fora de mission_participants/challenge_participants', async () => {
  const tables = await publicTables()
  const offenders = []
  for (const { name } of tables) {
    const r = await rows(`select has_table_privilege('authenticated', $1, 'DELETE') as ok`, [`public.${name}`])
    if (r[0].ok && !DELETE_EXCEPTIONS.includes(name)) offenders.push(name)
  }
  assert.deepEqual(offenders, [])
  for (const name of DELETE_EXCEPTIONS) {
    const r = await rows(`select has_table_privilege('authenticated', $1, 'DELETE') as ok`, [`public.${name}`])
    assert.equal(r[0].ok, true, `${name} deveria ter grant delete (§10)`)
  }
})

test('authenticated nunca tem TRUNCATE, REFERENCES ou TRIGGER em tabela de public', async () => {
  const tables = await publicTables()
  const offenders = []
  for (const { name } of tables) {
    const r = await rows(`select has_table_privilege('authenticated', $1, 'TRUNCATE') as tr,
      has_table_privilege('authenticated', $1, 'REFERENCES') as rf, has_table_privilege('authenticated', $1, 'TRIGGER') as tg`, [`public.${name}`])
    if (r[0].tr || r[0].rf || r[0].tg) offenders.push(name)
  }
  assert.deepEqual(offenders, [])
})

test('views: 16 views, todas com security_invoker = true e security_barrier = true (§2.4, §5)', async () => {
  const views = await publicViews()
  assert.equal(views.length, 16, `views encontradas: ${views.map((v) => v.name).join(', ')}`)
  const bad = views.filter((v) => !(v.options ?? []).includes('security_invoker=true')).map((v) => v.name)
  assert.deepEqual(bad, [], `views sem security_invoker=true: ${bad.join(', ')}`)
  const noBarrier = views.filter((v) => !(v.options ?? []).includes('security_barrier=true')).map((v) => v.name)
  assert.deepEqual(noBarrier, [], `views sem security_barrier=true: ${noBarrier.join(', ')}`)
  assert.ok(views.every((v) => v.name.startsWith('v_')), 'toda view começa com v_')
})

test('views: authenticated tem SELECT e nada além de SELECT (mesmo nas auto-atualizáveis)', async () => {
  const views = await publicViews()
  const offenders = []
  const missing = []
  for (const { name } of views) {
    const r = await rows(`select has_table_privilege('authenticated', $1, 'SELECT') as s, has_table_privilege('authenticated', $1, 'INSERT') as i,
      has_table_privilege('authenticated', $1, 'UPDATE') as u, has_table_privilege('authenticated', $1, 'DELETE') as d,
      has_table_privilege('authenticated', $1, 'TRUNCATE') as t`, [`public.${name}`])
    if (!r[0].s) missing.push(name)
    if (r[0].i || r[0].u || r[0].d || r[0].t) offenders.push(name)
  }
  assert.deepEqual(missing, [], `views sem select para authenticated: ${missing.join(', ')}`)
  assert.deepEqual(offenders, [], `views com privilégio além de select: ${offenders.join(', ')}`)
})

test('anon: nenhum privilégio em tabela ou view de public', async () => {
  const objects = [...(await publicTables()), ...(await publicViews())]
  const offenders = []
  for (const { name } of objects) {
    const r = await rows(`select bool_or(has_table_privilege('anon', $1, p)) as any_priv
      from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as p`, [`public.${name}`])
    if (r[0].any_priv) offenders.push(name)
  }
  assert.deepEqual(offenders, [])
})

test('anon: EXECUTE apenas em signup_mode e validate_team_code', async () => {
  const fns = await publicFunctions()
  const executable = []
  for (const f of fns) {
    const r = await rows(`select has_function_privilege('anon', $1, 'EXECUTE') as ok`, [f.signature])
    if (r[0].ok) executable.push(f.name)
  }
  assert.deepEqual(executable.sort(), [...ANON_FUNCTIONS].sort())
})

test('anon e public: nenhum privilégio em sequences de public', async () => {
  const seqs = await rows(`select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'S'`)
  for (const { name } of seqs) {
    const r = await rows(`select has_sequence_privilege('anon', $1, 'USAGE') as a, has_sequence_privilege('authenticated', $1, 'USAGE') as b`, [`public.${name}`])
    assert.equal(r[0].a, false, `anon com usage em ${name}`)
    assert.equal(r[0].b, false, `authenticated com usage em ${name}`)
  }
})

test('authenticated: EXECUTE em exatamente a lista de §6.1/§7.9, nada a mais', async () => {
  const fns = await publicFunctions()
  const executable = []
  for (const f of fns) {
    const r = await rows(`select has_function_privilege('authenticated', $1, 'EXECUTE') as ok`, [f.signature])
    if (r[0].ok) executable.push(f.name)
  }
  const extra = executable.filter((n) => !AUTHENTICATED_FUNCTIONS.includes(n))
  assert.deepEqual(extra, [], `funções de public executáveis fora da lista: ${extra.join(', ')}`)
  const missing = AUTHENTICATED_FUNCTIONS.filter((n) => !executable.includes(n))
  assert.deepEqual(missing, [], `funções da lista sem execute para authenticated: ${missing.join(', ')}`)
  const notInPublic = fns.filter((f) => !executable.includes(f.name)).map((f) => f.name)
  assert.deepEqual(notInPublic, [], `função em public sem execute para authenticated (deveria morar em private): ${notInPublic.join(', ')}`)
})

test('toda função de public e de private tem search_path fixo em proconfig (§2.3)', async () => {
  const fns = await rows(`
    select n.nspname || '.' || p.proname as name, p.proconfig as config
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f' order by 1`)
  assert.ok(fns.length > 40)
  const bad = fns.filter((f) => !(f.config ?? []).some((c) => /^search_path=/.test(c))).map((f) => f.name)
  assert.deepEqual(bad, [], `funções sem set search_path: ${bad.join(', ')}`)
})

test('private: nenhuma função executável por anon, authenticated ou public; schema sem USAGE', async () => {
  const fns = await rows(`select p.oid::regprocedure::text as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private'`)
  assert.ok(fns.length > 20)
  for (const role of ['anon', 'authenticated']) {
    const u = await rows(`select has_schema_privilege($1, 'private', 'USAGE') as ok`, [role])
    assert.equal(u[0].ok, false, `${role} com usage em private`)
    for (const { signature } of fns) {
      const r = await rows(`select has_function_privilege($1, $2, 'EXECUTE') as ok`, [role, signature])
      assert.equal(r[0].ok, false, `${role} executa ${signature}`)
    }
  }
  const pub = await rows(`select has_schema_privilege('private', 'USAGE') as ok`)
  assert.equal(pub[0].ok, true, 'postgres (owner) mantém usage')
})

test('RPCs security definer são donas do postgres e as views/tabelas também', async () => {
  const owners = await rows(`
    select distinct pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v')`)
  assert.equal(owners.length, 1)
  const fnOwners = await rows(`select distinct pg_get_userbyid(p.proowner) as owner from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private')`)
  assert.equal(fnOwners.length, 1)
  assert.equal(fnOwners[0].owner, owners[0].owner)
})
