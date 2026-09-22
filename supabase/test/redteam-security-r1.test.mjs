// RED TEAM r1 — SEGURANÇA (DATA-MODEL §2, §7, §10, §11, Apêndice D).
// Atacantes: colaborador ativo malicioso ("attacker"), usuário pendente, usuário inativo e anon.
// Objetivos: ler app_secrets/team_code por qualquer caminho; escalar papel; forjar/editar o ledger;
// girar/aprovar/resgatar fora da vez; gastar moedas duas vezes; chamar toda RPC definer com args hostis;
// views security_invoker sem vazar colunas privadas; pg_proc com search_path e whitelist de EXECUTE.
// Contas são rótulos técnicos (gestor/membro/atacante), não pessoas — nada vai para o seed.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectError, expectRlsDenied } from './pglite-harness.mjs'

let t
let admin, member, attacker, pending, inactive, teamCode
let seasonId, saleRuleId, monthlyRuleId, memberEntryId, queueId, rewardId, cheapRewardId, memberBalance
const MEMBER_PHONE = '11999990000'
const MEMBER_EMAIL = 'membro-a@teste.local'
const NIL = '00000000-0000-0000-0000-000000000000'
const CODE_RE = /^[A-Z][A-Z0-9_]+$/

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
// §7.9 — únicas funções de public executáveis por authenticated
const AUTH_WHITELIST = [
  'signup_mode', 'validate_team_code', 'get_branding', 'get_bootstrap', 'get_dashboard', 'spin_wheel', 'spin_wheel_free', 'redeem_reward',
  'mark_notifications_read', 'is_active_member', 'is_admin', 'active_season_id', 'app_timezone', 'local_day', 'local_today',
  'iso_week_key', 'mission_period', 'avatar_count',
  'admin_update_profile', 'rotate_team_code', 'update_app_settings', 'save_special_event', 'recompute_stats', 'create_season',
  'update_season', 'activate_season', 'close_season', 'record_rule_entry', 'record_manual_entry', 'record_initial_points',
  'reverse_entry', 'save_mission', 'delete_mission', 'save_challenge', 'activate_challenge', 'finish_challenge', 'cancel_challenge',
  'enqueue_wheel', 'update_queue_entry', 'remove_from_queue', 'release_turn', 'approve_spin', 'reject_spin', 'save_wheel_prizes',
  'handle_redemption',
]
const ANON_WHITELIST = ['signup_mode', 'validate_team_code', 'get_branding']

const count = (tx, rel) => tx.query(`select count(*)::int as n from public.${rel}`).then((r) => Number(r.rows[0].n))
const balance = async (uid) => Number((await t.sql('select coalesce(sum(coins),0)::int as b from public.point_entries where profile_id = $1', [uid])).rows[0].b)
/** Espera erro cujo message é um código do catálogo (§9), nunca um erro cru do Postgres. */
async function expectCatalog(promise, code) {
  const e = await expectError(promise, code ?? CODE_RE)
  assert.match(e.message, CODE_RE, `erro cru vazou: ${e.message}`)
  return e
}

before(async () => {
  t = await createTestDb()
  teamCode = (await t.sql('select team_code from public.app_secrets where id = 1')).rows[0].team_code
  seasonId = (await t.sql('select id from public.seasons where is_active')).rows[0].id
  saleRuleId = (await t.sql(`select id from public.point_rules where metric = 'sale'`)).rows[0].id
  monthlyRuleId = (await t.sql(`select id from public.point_rules where metric = 'monthly_goal'`)).rows[0].id

  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  member = await t.createAuthUser({ email: MEMBER_EMAIL, metadata: { team_code: teamCode, full_name: 'Membro A' } })
  attacker = await t.createAuthUser({ email: 'atacante@teste.local', metadata: { team_code: teamCode, full_name: 'Atacante' } })
  pending = await t.createAuthUser({ email: 'pendente@teste.local', metadata: { team_code: teamCode, full_name: 'Pendente' } })
  inactive = await t.createAuthUser({ email: 'inativo@teste.local', metadata: { team_code: teamCode, full_name: 'Inativo' } })
  for (const id of [member, attacker, inactive]) {
    await t.rpc(admin, 'admin_update_profile', { p_profile_id: id, p_patch: { status: 'active' } })
  }
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: inactive, p_patch: { status: 'inactive' } })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: { phone: MEMBER_PHONE, notes: 'nota-privada-do-gestor' } })

  // ledger: membro com 1200 moedas (manual) + uma venda; atacante com 10
  memberEntryId = (await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: member, p_points: 1200, p_reason: 'crédito de teste' }))[0].id
  await t.rpcRow(admin, 'record_rule_entry', { p_profile_id: member, p_rule_id: saleRuleId, p_amount: 1500 })
  await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: attacker, p_points: 10, p_reason: 'crédito de teste' })

  // roleta: membro na fila com a vez liberada
  queueId = (await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: member, p_wheel_kind: 'classic', p_attempts: 2 }))[0].id
  await t.rpcRow(admin, 'release_turn', { p_queue_id: queueId })

  // loja: recompensa com estoque 1 custando exatamente 1200 e uma barata (10 moedas, estoque 1)
  memberBalance = await balance(member) // 1200 manual + 100 venda + 50 PRIMEIRA VENDA
  rewardId = (await t.sql(`insert into public.rewards (name, category, cost_coins, stock, sort_order) values ('Item de teste saldo', 'Teste', $1, 1, 90) returning id`, [memberBalance])).rows[0].id
  cheapRewardId = (await t.sql(`insert into public.rewards (name, category, cost_coins, stock, sort_order) values ('Item de teste 10', 'Teste', 10, 1, 91) returning id`)).rows[0].id
})
after(async () => t?.close())

test('cenário: papéis/status esperados', async () => {
  const r = await t.sql('select id, role, status from public.profiles')
  const byId = Object.fromEntries(r.rows.map((x) => [x.id, x.role + ':' + x.status]))
  assert.equal(byId[admin], 'admin:active')
  assert.equal(byId[attacker], 'collaborator:active')
  assert.equal(byId[pending], 'collaborator:pending')
  assert.equal(byId[inactive], 'collaborator:inactive')
  assert.equal(memberBalance, 1350)
})

// =============================================================================
// 1. team_code / app_secrets por qualquer caminho
// =============================================================================
test('secrets: attacker/pending/inactive leem 0 linhas de app_secrets; anon recebe permission denied', async () => {
  for (const who of [attacker, pending, inactive]) {
    await t.asUser(who, async (tx) => assert.equal(await count(tx, 'app_secrets'), 0))
  }
  await expectRlsDenied(t.asAnon((tx) => tx.query('select team_code from public.app_secrets')))
  await expectRlsDenied(t.asAnon((tx) => tx.query('select * from public.app_secrets where id = 1')))
})

test('secrets: nenhuma view/RPC de membro devolve o team_code, o bootstrap_email ou o nome de coluna team_code', async () => {
  const cols = await t.sql(`select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name like 'v\\_%' and column_name in ('team_code', 'bootstrap_email', 'bootstrap_done')`)
  assert.deepEqual(cols.rows, [], 'view expõe coluna de app_secrets')
  await t.asUser(attacker, async (tx) => {
    for (const v of VIEWS) {
      const r = await tx.query(`select * from public.${v}`)
      assert.ok(!JSON.stringify(r.rows).includes(teamCode), `${v} vazou team_code`)
    }
    const boot = await tx.query('select public.get_bootstrap() as j')
    assert.ok(!JSON.stringify(boot.rows[0].j).includes(teamCode), 'get_bootstrap vazou team_code')
    const dash = await tx.query('select public.get_dashboard() as j')
    assert.ok(!JSON.stringify(dash.rows[0].j).includes(teamCode), 'get_dashboard vazou team_code')
  })
})

test('secrets: mensagens de erro de RPC nunca carregam o team_code nem estrutura interna (anon e attacker)', async () => {
  const probes = [
    () => t.rpc(attacker, 'rotate_team_code'),
    () => t.rpc(attacker, 'update_app_settings', { p_patch: { team_code: 'X' } }),
    () => t.rpc(attacker, 'admin_update_profile', { p_profile_id: NIL, p_patch: { role: 'admin' } }),
    () => t.rpc(attacker, 'spin_wheel', { p_queue_id: NIL }),
    () => t.rpc(pending, 'get_dashboard'),
    () => t.rpc(inactive, 'redeem_reward', { p_reward_id: NIL }),
    () => t.rpc(null, 'rotate_team_code', {}, 'anon'),
    () => t.rpc(null, 'get_bootstrap', {}, 'anon'),
  ]
  for (const p of probes) {
    const e = await expectError(p(), /./)
    const text = `${e.message} ${e.detail ?? ''} ${e.hint ?? ''}`
    assert.ok(!text.includes(teamCode), `erro vazou team_code: ${text}`)
    assert.ok(!/private\./.test(text) || /permission denied/.test(text), `erro vazou estrutura interna: ${text}`)
  }
})

test('secrets: anon/attacker não descobrem o código por validate_team_code com entradas hostis; signup_mode só devolve o modo', async () => {
  for (const code of [null, '', ' ', teamCode.slice(0, 11), teamCode.toLowerCase() + 'x', "' or 1=1 --", 'x'.repeat(10000)]) {
    assert.equal(await t.rpc(null, 'validate_team_code', { p_code: code }, 'anon'), false, `validate_team_code(${JSON.stringify(code)})`)
  }
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: ' ' + teamCode.toLowerCase() + ' ' }, 'anon'), true, 'normaliza upper/trim')
  assert.equal(await t.rpc(null, 'signup_mode', {}, 'anon'), 'team_code')
})

// =============================================================================
// 2. PII e carteira alheia através de views security_invoker
// =============================================================================
test('views: attacker não vê e-mail/telefone/notas/carteira/streak do membro em nenhuma view (colunas NULL ou 0), mas vê os próprios', async () => {
  await t.asUser(attacker, async (tx) => {
    for (const v of VIEWS) {
      const r = await tx.query(`select * from public.${v}`)
      const text = JSON.stringify(r.rows)
      assert.ok(!text.includes(MEMBER_PHONE), `${v} vazou telefone alheio`)
      assert.ok(!text.includes(MEMBER_EMAIL), `${v} vazou e-mail alheio`)
      assert.ok(!text.includes('nota-privada-do-gestor'), `${v} vazou notes de profile_private`)
    }
    const other = (await tx.query('select email, phone, coins_balance, streak_days, goal_amount from public.v_profile_stats where profile_id = $1 and season_id = $2', [member, seasonId])).rows[0]
    assert.ok(other, 'linha do membro deve existir (ranking)')
    assert.equal(other.email, null)
    assert.equal(other.phone, null)
    assert.ok(other.coins_balance === null || Number(other.coins_balance) === 0, `coins_balance alheio: ${other.coins_balance}`)
    assert.ok(other.streak_days === null || Number(other.streak_days) === 0, `streak alheio: ${other.streak_days}`)
    assert.ok(other.goal_amount === null || Number(other.goal_amount) === 0, `goal alheio: ${other.goal_amount}`)
    const mine = (await tx.query('select email, coins_balance from public.v_profile_stats where profile_id = $1 and season_id = $2', [attacker, seasonId])).rows[0]
    assert.equal(mine.email, 'atacante@teste.local')
    assert.equal(Number(mine.coins_balance), 10)
  })
})

test('views: v_wallet, v_point_entries_history, v_redemptions e get_dashboard(p_profile_id alheio) fecham o ledger alheio', async () => {
  await t.asUser(attacker, async (tx) => {
    for (const v of ['v_wallet', 'v_point_entries_history', 'v_redemptions']) {
      const r = await tx.query(`select * from public.${v} where profile_id = $1`, [member])
      assert.equal(r.rows.length, 0, `${v} devolveu linhas do membro`)
    }
    assert.equal(await count(tx, 'v_admin_kpis'), 0, 'v_admin_kpis é só admin')
    // v_sales_timeline (§5.5): colaborador vê só os próprios números — a venda de R$ 1.500 do membro não pode aparecer
    const tl = (await tx.query('select sum(sales_amount)::numeric as amt, sum(sales_count)::int as cnt, max(points_cum)::int as pts from public.v_sales_timeline')).rows[0]
    assert.equal(Number(tl.amt), 0, 'v_sales_timeline vazou vendas alheias')
    assert.equal(Number(tl.cnt), 0)
    assert.equal(Number(tl.pts), 10, 'v_sales_timeline deve somar só os pontos do atacante')
    const pe = await tx.query('select id from public.point_entries where id = $1', [memberEntryId])
    assert.equal(pe.rows.length, 0)
  })
  await expectCatalog(t.rpc(attacker, 'get_dashboard', { p_profile_id: member }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'get_dashboard', { p_profile_id: NIL }), 'NOT_ADMIN')
})

// =============================================================================
// 3. Escalada de papel / status / configuração
// =============================================================================
test('escalada: attacker não vira admin nem muda status por UPDATE direto, RPC, app_secrets ou app_settings', async () => {
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set role = 'admin' where id = $1`, [attacker])), /permission denied|FORBIDDEN_COLUMN/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set status = 'active', role = 'admin' where id = $1`, [pending])), /permission denied|FORBIDDEN_COLUMN/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set job_title = 'manager' where id = $1`, [attacker])), /permission denied|FORBIDDEN_COLUMN/)
  await expectCatalog(t.rpc(attacker, 'admin_update_profile', { p_profile_id: attacker, p_patch: { role: 'admin' } }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'admin_update_profile', { p_profile_id: pending, p_patch: { status: 'active' } }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'update_app_settings', { p_patch: { auto_approve_members: true } }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'rotate_team_code'), 'NOT_ADMIN')
  // grants de UPDATE existem (policy admin) → 0 linhas afetadas, nunca erro cru nem escrita
  await t.asUser(attacker, async (tx) => {
    const a = await tx.query(`update public.app_secrets set team_code = 'HACKED' where id = 1`)
    assert.equal(a.affectedRows ?? 0, 0)
    const b = await tx.query(`update public.app_settings set auto_approve_members = true, rank_admins = false where id = 1`)
    assert.equal(b.affectedRows ?? 0, 0)
    const c = await tx.query(`update public.profile_private set email = 'gestor@teste.local' where profile_id = $1`, [attacker])
    assert.equal(c.affectedRows ?? 0, 0)
    const d = await tx.query(`update public.profile_private set notes = 'x' where profile_id = $1`, [member])
    assert.equal(d.affectedRows ?? 0, 0)
  })
  const s = await t.sql('select team_code from public.app_secrets where id = 1')
  assert.equal(s.rows[0].team_code, teamCode)
  const st = await t.sql('select auto_approve_members, rank_admins from public.app_settings where id = 1')
  assert.deepEqual(st.rows[0], { auto_approve_members: false, rank_admins: true })
  const r = await t.sql('select role, status from public.profiles where id = $1', [attacker])
  assert.deepEqual(r.rows[0], { role: 'collaborator', status: 'active' })
})

test('escalada: attacker não chama nada de private.* (sem USAGE no schema), mesmo com app.rpc=on', async () => {
  // (set role não é testável no PGlite: a sessão é postgres/superuser e pode voltar a qualquer role)
  await expectError(t.asUser(attacker, (tx) => tx.query('select private.assert_admin()')), /permission denied/i)
  await expectError(t.asUser(attacker, (tx) => tx.query(`select private.insert_entry($1, 'manual', null, 99999, 99999, 'x', now(), $1)`, [attacker])), /permission denied/i)
  await expectError(t.asUser(attacker, (tx) => tx.query(`select private.draw_prize((select id from public.wheels limit 1), '{}')`)), /permission denied/i)
  await expectError(t.asAnon((tx) => tx.query('select private.season_for(now())')), /permission denied/i)
  await expectError(t.asUser(attacker, (tx) => tx.query(`select set_config('app.rpc', 'on', true)`).then(() => tx.query(`update public.profiles set role = 'admin' where id = $1`, [attacker]))), /permission denied|FORBIDDEN_COLUMN/)
})

test('escalada: pending e inactive não editam nem a própria linha (0 linhas), nem inserem em nada, nem leem view alguma', async () => {
  for (const who of [pending, inactive]) {
    await t.asUser(who, async (tx) => {
      const u = await tx.query(`update public.profiles set full_name = 'hacked' where id = $1`, [who])
      assert.equal(u.affectedRows ?? 0, 0)
      const n = await tx.query(`update public.notifications set is_read = true where profile_id = $1`, [who])
      assert.equal(n.affectedRows ?? 0, 0)
      for (const v of VIEWS) assert.equal(await count(tx, v), 0, `${v} devolveu linhas para ${who === pending ? 'pending' : 'inactive'}`)
      for (const tbl of TABLES) {
        const n2 = await count(tx, tbl)
        assert.equal(n2, tbl === 'profiles' ? 1 : 0, `${tbl} devolveu ${n2} linhas`)
      }
    })
    await expectRlsDenied(t.asUser(who, (tx) => tx.query(`insert into public.rewards (name, category, cost_coins, sort_order) values ('x', 'x', 1, 99)`)))
    await expectRlsDenied(t.asUser(who, (tx) => tx.query(`insert into public.point_entries (profile_id, source, base_points, points, coins, reason) values ($1, 'manual', 1, 1, 1, 'x')`, [who])))
    await expectCatalog(t.rpc(who, 'redeem_reward', { p_reward_id: cheapRewardId }), who === pending ? 'PROFILE_PENDING' : 'PROFILE_INACTIVE')
    await expectCatalog(t.rpc(who, 'spin_wheel_free', { p_wheel_kind: 'classic' }), who === pending ? 'PROFILE_PENDING' : 'PROFILE_INACTIVE')
    await expectCatalog(t.rpc(who, 'mark_notifications_read'), who === pending ? 'PROFILE_PENDING' : 'PROFILE_INACTIVE')
    await expectCatalog(t.rpc(who, 'get_dashboard'), who === pending ? 'PROFILE_PENDING' : 'PROFILE_INACTIVE')
    await expectCatalog(t.rpc(who, 'spin_wheel', { p_queue_id: queueId }), 'NOT_ALLOWED')
    await expectCatalog(t.rpc(who, 'approve_spin', { p_spin_id: NIL }), 'NOT_ADMIN')
    const boot = await t.rpc(who, 'get_bootstrap')
    assert.deepEqual(Object.keys(boot), ['me'])
    assert.equal(boot.me.status, who === pending ? 'pending' : 'inactive')
  }
  const name = await t.sql('select full_name from public.profiles where id = any($1)', [[pending, inactive]])
  assert.ok(name.rows.every((x) => x.full_name !== 'hacked'))
})

test('escalada: attacker não altera avatar_path para pasta alheia, preferences > 2048 bytes nem notificações alheias/colunas protegidas', async () => {
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set avatar_path = $2 || '/avatar-1700000000000.png' where id = $1`, [attacker, member])), /INVALID_AVATAR_PATH|check constraint/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set avatar_path = $2 || '/../../etc/passwd' where id = $1`, [attacker, attacker])), /INVALID_AVATAR_PATH|check constraint/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set avatar_path = $2 || '/avatar-1700000000000.svg' where id = $1`, [attacker, attacker])), /INVALID_AVATAR_PATH|check constraint/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set preferences = jsonb_build_object('x', repeat('a', 4000)) where id = $1`, [attacker])), /check constraint|violates/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profiles set preferences = '[]'::jsonb where id = $1`, [attacker])), /check constraint|violates/)
  await t.asUser(attacker, async (tx) => {
    const u = await tx.query(`update public.profiles set full_name = 'hacked' where id = $1`, [member])
    assert.equal(u.affectedRows ?? 0, 0)
    const n = await tx.query(`update public.notifications set is_read = true where profile_id = $1`, [member])
    assert.equal(n.affectedRows ?? 0, 0)
  })
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.notifications set title = 'x' where profile_id = $1`, [attacker])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.notifications set profile_id = $2 where profile_id = $1`, [attacker, member])), /permission denied/)
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`insert into public.notifications (profile_id, kind, title, message) values ($1, 'system', 'x', 'x')`, [member])))
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`delete from public.notifications where profile_id = $1`, [attacker])))
  const n = await t.sql('select count(*)::int as n from public.notifications where profile_id = $1 and is_read', [member])
  assert.equal(n.rows[0].n, 0)
  assert.equal((await t.rpc(attacker, 'mark_notifications_read', { p_ids: (await t.sql('select array_agg(id) as ids from public.notifications where profile_id = $1', [member])).rows[0].ids })), 0)
})

// =============================================================================
// 4. Forjar / editar o ledger
// =============================================================================
test('ledger: attacker não insere (nem estorno forjado), não atualiza, não apaga point_entries nem stats; views não aceitam escrita', async () => {
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`insert into public.point_entries (profile_id, source, base_points, points, coins, reason) values ($1, 'manual', 99999, 99999, 99999, 'x')`, [attacker])))
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`insert into public.point_entries (profile_id, source, reverses_entry_id, reason, base_points, points, coins) values ($1, 'manual', $2, 'x', 0, 0, 0)`, [member, memberEntryId])))
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`insert into public.point_entries (profile_id, rule_id, source, base_points, points, coins, quantity, amount) values ($1, $2, 'rule', 0, 0, 0, 1000, 1)`, [attacker, saleRuleId])))
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.point_entries set coins = 100000 where profile_id = $1`, [attacker])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`delete from public.point_entries where profile_id = $1`, [attacker])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profile_lifetime_stats set streak_days = 100000 where profile_id = $1`, [attacker])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.profile_season_stats set points = 100000 where profile_id = $1`, [attacker])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`insert into public.profile_season_stats (profile_id, season_id, points) values ($1, $2, 100000)`, [attacker, seasonId])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`insert into public.milestone_awards (profile_id, season_id, metric, period_key) values ($1, $2, 'weekly_goal', 'x')`, [attacker, seasonId])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`insert into public.profile_boosts (profile_id, multiplier, starts_at, expires_at) values ($1, 10, now(), now() + interval '1 day')`, [attacker])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`insert into public.profile_achievements (profile_id, achievement_id, season_id) select $1, id, $2 from public.achievements limit 1`, [attacker, seasonId])), /permission denied/)
  for (const v of ['v_seasons', 'v_special_events', 'v_redemptions', 'v_wallet']) {
    await expectError(t.asUser(attacker, (tx) => tx.query(`delete from public.${v}`)), /permission denied|cannot delete/i)
    await expectError(t.asUser(attacker, (tx) => tx.query(`update public.${v} set season_id = season_id`).catch((e) => { if (/column/.test(e.message)) throw new Error('permission denied (coluna inexistente já é barreira)'); throw e })), /permission denied|cannot update/i)
  }
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`insert into public.rewards (name, category, cost_coins, sort_order) values ('grátis', 'x', 0, 99)`)))
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`insert into public.point_rules (name, metric, points, coins, sort_order) values ('x', 'call', 100000, 100000, 99)`)))
  await t.asUser(attacker, async (tx) => {
    const r = await tx.query(`update public.rewards set cost_coins = 0, stock = 1000 where id = $1`, [rewardId])
    assert.equal(r.affectedRows ?? 0, 0)
    const p = await tx.query(`update public.point_rules set points = 100000, coins = 100000 where id = $1`, [saleRuleId])
    assert.equal(p.affectedRows ?? 0, 0)
    const w = await tx.query(`update public.wheel_prizes set value = 1000000 where kind = 'points'`)
    assert.equal(w.affectedRows ?? 0, 0)
  })
  assert.equal(await balance(attacker), 10)
})

test('ledger: mesmo o gestor não edita/apaga entries (LEDGER_IMMUTABLE) e o insert direto não forja pontos, created_by, temporada nem estorno alheio', async () => {
  // gestor: sem grant de UPDATE/DELETE (permission denied) — e, por baixo, o trigger LEDGER_IMMUTABLE segura até o postgres
  await expectError(t.asUser(admin, (tx) => tx.query(`update public.point_entries set points = 999999 where id = $1`, [memberEntryId])), /LEDGER_IMMUTABLE|permission denied/)
  await expectError(t.asUser(admin, (tx) => tx.query(`delete from public.point_entries where id = $1`, [memberEntryId])), /LEDGER_IMMUTABLE|permission denied/)
  await expectError(t.sql(`update public.point_entries set points = 999999 where id = $1`, [memberEntryId]), 'LEDGER_IMMUTABLE')
  await expectError(t.sql(`delete from public.point_entries where id = $1`, [memberEntryId]), 'LEDGER_IMMUTABLE')
  // insert direto com source=rule: pontos/moedas vêm da regra, não do payload; created_by é o gestor, não o valor enviado
  const forged = await t.asUser(admin, (tx) => tx.query(
    `insert into public.point_entries (profile_id, rule_id, source, base_points, points, coins, quantity, amount, created_by, season_id, multiplier)
     values ($1, $2, 'rule', 999999, 999999, 999999, 1, 100, $3, $4, 50) returning points, coins, base_points, multiplier, created_by, season_id`,
    [attacker, saleRuleId, attacker, NIL]))
  assert.equal(Number(forged.rows[0].points), 100)
  assert.equal(Number(forged.rows[0].coins), 100)
  assert.equal(Number(forged.rows[0].multiplier), 1)
  assert.equal(forged.rows[0].created_by, admin)
  assert.equal(forged.rows[0].season_id, seasonId)
  // estorno apontando para entry de outro perfil → REVERSAL_MISMATCH; entry inexistente → ENTRY_NOT_FOUND
  await expectCatalog(t.asUser(admin, (tx) => tx.query(`insert into public.point_entries (profile_id, source, reverses_entry_id, reason, base_points, points, coins) values ($1, 'manual', $2, 'x', 0, 0, 0)`, [attacker, memberEntryId])), 'REVERSAL_MISMATCH')
  await expectCatalog(t.asUser(admin, (tx) => tx.query(`insert into public.point_entries (profile_id, source, reverses_entry_id, reason, base_points, points, coins) values ($1, 'manual', $2, 'x', 0, 0, 0)`, [attacker, NIL])), 'ENTRY_NOT_FOUND')
  // fora de toda temporada → NO_SEASON_FOR_DATE; pontos acima do CK → erro (nunca grava)
  await expectCatalog(t.asUser(admin, (tx) => tx.query(`insert into public.point_entries (profile_id, source, base_points, points, coins, reason, occurred_at) values ($1, 'manual', 1, 1, 0, 'x', '1999-01-01')`, [attacker])), 'NO_SEASON_FOR_DATE')
  await expectError(t.asUser(admin, (tx) => tx.query(`insert into public.point_entries (profile_id, source, base_points, points, coins, reason) values ($1, 'manual', 5000000, 5000000, 5000000, 'x')`, [attacker])), /check|POINTS_INVALID|violates/)
  assert.equal(await balance(attacker), 160, '10 + 100 da venda (valores da regra, não do payload) + 50 PRIMEIRA VENDA')
})

test('ledger: estorno duplo, estorno de estorno e estorno de resgate são recusados; reverse_entry(null) → ENTRY_NOT_FOUND', async () => {
  const base = await balance(attacker)
  const extra = (await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: attacker, p_points: 5, p_reason: 'para estornar' }))[0]
  const rev = (await t.rpcRow(admin, 'reverse_entry', { p_entry_id: extra.id, p_reason: 'estorno 1' }))[0]
  assert.equal(Number(rev.coins), -5)
  await expectCatalog(t.rpc(admin, 'reverse_entry', { p_entry_id: extra.id, p_reason: 'estorno 2' }), 'ALREADY_REVERSED')
  await expectCatalog(t.rpc(admin, 'reverse_entry', { p_entry_id: rev.id, p_reason: 'estorno do estorno' }), 'CANNOT_REVERSE_REVERSAL')
  await expectCatalog(t.rpc(admin, 'reverse_entry', { p_entry_id: null, p_reason: 'x' }), 'ENTRY_NOT_FOUND')
  await expectCatalog(t.rpc(admin, 'reverse_entry', { p_entry_id: NIL, p_reason: 'x' }), 'ENTRY_NOT_FOUND')
  assert.equal(await balance(attacker), base)
})

// =============================================================================
// 5. Roleta fora da vez
// =============================================================================
test('roleta: attacker não gira a vez do membro, não se enfileira, não libera, não aprova; membro não gira duas vezes', async () => {
  await expectCatalog(t.rpc(attacker, 'spin_wheel', { p_queue_id: queueId }), 'NOT_ALLOWED')
  await expectCatalog(t.rpc(attacker, 'spin_wheel', { p_queue_id: null }), 'QUEUE_NOT_FOUND')
  await expectCatalog(t.rpc(attacker, 'enqueue_wheel', { p_profile_id: attacker, p_wheel_kind: 'premium', p_attempts: 20 }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'release_turn', { p_queue_id: queueId }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'update_queue_entry', { p_queue_id: queueId, p_attempts: 20 }), 'NOT_ADMIN')
  await expectError(t.asUser(attacker, (tx) => tx.query(`insert into public.wheel_queue (profile_id, person_name, wheel_id, source, status) select $1, 'x', id, 'manual', 'active' from public.wheels limit 1`, [attacker])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.wheel_queue set profile_id = $1 where id = $2`, [attacker, queueId])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`insert into public.wheel_spins (queue_id, profile_id, person_name, wheel_id, attempt_index, prize_label, prize_kind, resolved_label, resolved_kind, random_value, prizes_hash, status)
    select $1, $2, 'x', wheel_id, 1, 'x', 'points', 'x', 'points', 0, 'x', 'approved' from public.wheel_queue where id = $1`, [queueId, attacker])), /permission denied/)
  // dono da vez gira; segundo giro com pendente → SPIN_PENDING; attacker não aprova nem rejeita
  const spin = await t.rpc(member, 'spin_wheel', { p_queue_id: queueId })
  assert.ok(spin.spin_id)
  await expectCatalog(t.rpc(member, 'spin_wheel', { p_queue_id: queueId }), 'SPIN_PENDING')
  await expectCatalog(t.rpc(attacker, 'approve_spin', { p_spin_id: spin.spin_id }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'reject_spin', { p_spin_id: spin.spin_id }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(member, 'approve_spin', { p_spin_id: spin.spin_id }), 'NOT_ADMIN')
  await expectError(t.asUser(member, (tx) => tx.query(`update public.wheel_spins set status = 'approved' where id = $1`, [spin.spin_id])), /permission denied/)
  // aprovação dupla: só a primeira credita
  const before = await balance(member)
  const ap = await t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id })
  assert.equal(ap.spin.status, 'approved')
  await expectCatalog(t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id }), 'SPIN_NOT_PENDING')
  await expectCatalog(t.rpc(admin, 'reject_spin', { p_spin_id: spin.spin_id }), 'SPIN_NOT_PENDING')
  const entries = await t.sql(`select count(*)::int as n from public.point_entries where source = 'wheel' and profile_id = $1`, [member])
  assert.ok(entries.rows[0].n <= 1)
  const after = await balance(member)
  assert.ok(after >= before, 'aprovação nunca debita')
  memberBalance = after
})

// =============================================================================
// 6. Gasto duplo de moedas
// =============================================================================
test('double-spend: com saldo exato, o 2º resgate na mesma transação (após 1 checagem de saldo) falha; estoque 1 nunca vai a -1; lock wallet é tomado', async () => {
  const bal = await balance(member)
  await t.sql('update public.rewards set cost_coins = $2 where id = $1', [rewardId, bal])
  const outcome = await t.asUser(member, async (tx) => {
    const seen = Number((await tx.query('select coins_balance from public.v_wallet where profile_id = $1', [member])).rows[0].coins_balance)
    assert.equal(seen, bal)
    const first = (await tx.query('select public.redeem_reward($1) as r', [rewardId])).rows[0].r
    const locks = Number((await tx.query(`select count(*)::int as n from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()`)).rows[0].n)
    let secondError = null
    try { await tx.query('select public.redeem_reward($1) as r', [rewardId]) } catch (e) { secondError = e.message }
    return { first, locks, secondError }
  }).catch((e) => ({ txError: e.message }))
  // o 2º redeem aborta a transação inteira no Postgres (erro dentro da tx) — o que importa é que NADA ficou gravado duas vezes
  const redemptions = await t.sql('select count(*)::int as n from public.reward_redemptions where profile_id = $1 and reward_id = $2', [member, rewardId])
  assert.ok(redemptions.rows[0].n <= 1, 'dois resgates gravados')
  assert.ok(await balance(member) >= 0, 'saldo negativo por gasto duplo')
  const stock = Number((await t.sql('select stock from public.rewards where id = $1', [rewardId])).rows[0].stock)
  assert.ok(stock >= 0, `estoque negativo: ${stock}`)
  if (!outcome.txError) {
    assert.ok(outcome.locks >= 1, 'redeem_reward deve segurar o advisory lock wallet:<uid> na transação')
    assert.match(outcome.secondError ?? '', /INSUFFICIENT_COINS|OUT_OF_STOCK|current transaction is aborted/)
  }
})

test('double-spend: resgates sequenciais — o 2º com estoque 0 → OUT_OF_STOCK; saldo devedor → INSUFFICIENT_COINS; attacker não cancela/entrega o próprio pedido', async () => {
  const bal = await balance(attacker)
  await t.sql('update public.rewards set cost_coins = $2, stock = 1 where id = $1', [cheapRewardId, Math.max(1, Math.floor(bal / 2))])
  const r1 = await t.rpc(attacker, 'redeem_reward', { p_reward_id: cheapRewardId })
  assert.ok(r1.redemption_id)
  await expectCatalog(t.rpc(attacker, 'redeem_reward', { p_reward_id: cheapRewardId }), 'OUT_OF_STOCK')
  await t.sql('update public.rewards set stock = null, cost_coins = 1000000 where id = $1', [cheapRewardId])
  await expectCatalog(t.rpc(attacker, 'redeem_reward', { p_reward_id: cheapRewardId }), 'INSUFFICIENT_COINS')
  await expectCatalog(t.rpc(attacker, 'redeem_reward', { p_reward_id: null }), 'REWARD_UNAVAILABLE')
  await expectCatalog(t.rpc(attacker, 'redeem_reward', { p_reward_id: NIL }), 'REWARD_UNAVAILABLE')
  await expectCatalog(t.rpc(attacker, 'handle_redemption', { p_redemption_id: r1.redemption_id, p_action: 'deliver' }), 'NOT_ADMIN')
  await expectCatalog(t.rpc(attacker, 'handle_redemption', { p_redemption_id: r1.redemption_id, p_action: 'cancel' }), 'NOT_ADMIN')
  await expectError(t.asUser(attacker, (tx) => tx.query(`update public.reward_redemptions set status = 'cancelled' where id = $1`, [r1.redemption_id])), /permission denied/)
  await expectError(t.asUser(attacker, (tx) => tx.query(`delete from public.reward_redemptions where id = $1`, [r1.redemption_id])), /permission denied/)
  // o entry de resgate não pode ser estornado por reverse_entry (só handle_redemption)
  const redeemEntry = (await t.sql('select entry_id from public.reward_redemptions where id = $1', [r1.redemption_id])).rows[0].entry_id
  await expectCatalog(t.rpc(admin, 'reverse_entry', { p_entry_id: redeemEntry, p_reason: 'x' }), 'USE_HANDLE_REDEMPTION')
  // cancelamento duplo pelo gestor devolve as moedas uma única vez
  const beforeCancel = await balance(attacker)
  await t.rpcRow(admin, 'handle_redemption', { p_redemption_id: r1.redemption_id, p_action: 'cancel', p_notes: 'teste' })
  await expectCatalog(t.rpc(admin, 'handle_redemption', { p_redemption_id: r1.redemption_id, p_action: 'cancel' }), 'REDEMPTION_TRANSITION_INVALID')
  await expectCatalog(t.rpc(admin, 'handle_redemption', { p_redemption_id: r1.redemption_id, p_action: 'approve' }), 'REDEMPTION_TRANSITION_INVALID')
  assert.equal(await balance(attacker), bal, 'saldo volta ao original após um único estorno')
  assert.ok(await balance(attacker) > beforeCancel)
  const refunds = await t.sql(`select count(*)::int as n from public.point_entries where profile_id = $1 and source = 'reward' and coins > 0`, [attacker])
  assert.equal(refunds.rows[0].n, 1)
  await expectCatalog(t.rpc(admin, 'reverse_entry', { p_entry_id: redeemEntry, p_reason: 'x' }), /USE_HANDLE_REDEMPTION|ALREADY_REVERSED/)
})

test('args hostis: record_manual_entry(p_coins = -2147483648) deve responder POINTS_INVALID, não "integer out of range" (abs() de INT_MIN)', async () => {
  await expectCatalog(t.rpc(admin, 'record_manual_entry', { p_profile_id: attacker, p_points: 1, p_reason: 'xxx', p_coins: -2147483648 }), 'POINTS_INVALID')
})

// =============================================================================
// 7. Args hostis em toda RPC definer (como gestor — o pior caso, pois passa da checagem de papel)
// =============================================================================
test('args hostis: ledger — NULLs, ids alheios/inexistentes, negativos, gigantes, datas absurdas → sempre código do catálogo', async () => {
  const cases = [
    ['record_manual_entry', { p_profile_id: null, p_points: 1, p_reason: 'xxx' }, 'PROFILE_NOT_FOUND'],
    ['record_manual_entry', { p_profile_id: NIL, p_points: 1, p_reason: 'xxx' }, 'PROFILE_NOT_FOUND'],
    ['record_manual_entry', { p_profile_id: pending, p_points: 1, p_reason: 'xxx' }, 'PROFILE_INACTIVE'],
    ['record_manual_entry', { p_profile_id: inactive, p_points: 1, p_reason: 'xxx' }, 'PROFILE_INACTIVE'],
    ['record_manual_entry', { p_profile_id: attacker, p_points: null, p_reason: 'xxx' }, 'POINTS_INVALID'],
    ['record_manual_entry', { p_profile_id: attacker, p_points: 0, p_reason: 'xxx' }, 'POINTS_INVALID'],
    ['record_manual_entry', { p_profile_id: attacker, p_points: 2147483647, p_reason: 'xxx' }, 'POINTS_INVALID'],
    ['record_manual_entry', { p_profile_id: attacker, p_points: -2147483648, p_reason: 'xxx' }, 'POINTS_INVALID'],
    ['record_manual_entry', { p_profile_id: attacker, p_points: 1, p_reason: 'xxx', p_coins: 2147483647 }, 'POINTS_INVALID'],
    ['record_manual_entry', { p_profile_id: attacker, p_points: 1, p_reason: null }, 'REASON_REQUIRED'],
    ['record_manual_entry', { p_profile_id: attacker, p_points: 1, p_reason: 'x'.repeat(501) }, 'REASON_REQUIRED'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: null }, 'RULE_NOT_FOUND'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: NIL }, 'RULE_NOT_FOUND'],
    ['record_rule_entry', { p_profile_id: null, p_rule_id: saleRuleId }, 'PROFILE_NOT_FOUND'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_quantity: 0, p_amount: 1 }, 'QUANTITY_INVALID'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_quantity: -5, p_amount: 1 }, 'QUANTITY_INVALID'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_quantity: 2147483647, p_amount: 1 }, 'QUANTITY_INVALID'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: monthlyRuleId, p_quantity: 1000 }, 'POINTS_INVALID'], // 500 × 1000 × 10 > 1e6
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_amount: -1 }, 'AMOUNT_REQUIRED'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_amount: 0 }, 'AMOUNT_REQUIRED'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_amount: 1, p_occurred_at: '1990-01-01T00:00:00Z' }, 'OCCURRED_AT_INVALID'],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_amount: 1, p_occurred_at: '2999-01-01T00:00:00Z' }, 'OCCURRED_AT_INVALID'],
    ['record_initial_points', { p_profile_id: attacker, p_points: 0 }, 'POINTS_INVALID'],
    ['record_initial_points', { p_profile_id: attacker, p_points: -1 }, 'POINTS_INVALID'],
    ['record_initial_points', { p_profile_id: attacker, p_points: 100001 }, 'POINTS_INVALID'],
    ['record_initial_points', { p_profile_id: NIL, p_points: 1 }, 'PROFILE_NOT_FOUND'],
    ['record_initial_points', { p_profile_id: pending, p_points: 1 }, 'PROFILE_INACTIVE'],
  ]
  for (const [fn, args, code] of cases) {
    await expectCatalog(t.rpc(admin, fn, args), code).catch((e) => { throw new Error(`${fn}(${JSON.stringify(args)}): ${e.message}`) })
  }
  // idempotência dos pontos iniciais
  await t.rpcRow(admin, 'record_initial_points', { p_profile_id: attacker, p_points: 1 })
  await expectCatalog(t.rpc(admin, 'record_initial_points', { p_profile_id: attacker, p_points: 1 }), 'INITIAL_POINTS_EXISTS')
})

test('args hostis: roleta/fila — NULLs, alvo pendente/inativo, tentativas 0/21/-1/INT_MAX, ambos os alvos, ids inexistentes', async () => {
  const cases = [
    ['enqueue_wheel', {}, 'QUEUE_TARGET_REQUIRED'],
    ['enqueue_wheel', { p_profile_id: attacker, p_person_name: 'x' }, 'QUEUE_TARGET_REQUIRED'],
    ['enqueue_wheel', { p_profile_id: NIL }, 'PROFILE_NOT_FOUND'],
    ['enqueue_wheel', { p_profile_id: pending }, 'PROFILE_INACTIVE'],
    ['enqueue_wheel', { p_profile_id: inactive }, 'PROFILE_INACTIVE'],
    ['enqueue_wheel', { p_profile_id: attacker, p_attempts: 0 }, 'ATTEMPTS_INVALID'],
    ['enqueue_wheel', { p_profile_id: attacker, p_attempts: -1 }, 'ATTEMPTS_INVALID'],
    ['enqueue_wheel', { p_profile_id: attacker, p_attempts: 21 }, 'ATTEMPTS_INVALID'],
    ['enqueue_wheel', { p_profile_id: attacker, p_attempts: 2147483647 }, 'ATTEMPTS_INVALID'],
    ['enqueue_wheel', { p_person_name: '   ' }, 'QUEUE_TARGET_REQUIRED'],
    ['update_queue_entry', { p_queue_id: null }, 'QUEUE_NOT_FOUND'],
    ['update_queue_entry', { p_queue_id: NIL }, 'QUEUE_NOT_FOUND'],
    ['update_queue_entry', { p_queue_id: queueId, p_attempts: 21 }, 'ATTEMPTS_INVALID'],
    ['update_queue_entry', { p_queue_id: queueId, p_attempts: 0 }, 'ATTEMPTS_INVALID'],
    ['update_queue_entry', { p_queue_id: queueId, p_attempts: 1 }, 'ATTEMPTS_INVALID'], // = attempts_used (1) → recusado (B.23)
    ['remove_from_queue', { p_queue_id: NIL }, 'QUEUE_NOT_FOUND'],
    ['release_turn', { p_queue_id: null }, 'QUEUE_NOT_FOUND'],
    ['release_turn', { p_queue_id: NIL }, 'QUEUE_NOT_FOUND'],
    ['release_turn', { p_queue_id: queueId }, 'QUEUE_NOT_WAITING'], // já active
    ['approve_spin', { p_spin_id: null }, 'SPIN_NOT_FOUND'],
    ['approve_spin', { p_spin_id: NIL }, 'SPIN_NOT_FOUND'],
    ['reject_spin', { p_spin_id: NIL }, 'SPIN_NOT_FOUND'],
    ['spin_wheel', { p_queue_id: NIL }, 'QUEUE_NOT_FOUND'],
    ['save_wheel_prizes', { p_wheel_kind: 'classic', p_prizes: [{ label: 'a', kind: 'points', value: 1, sort_order: 0 }, { label: 'b', kind: 'points', value: 1, sort_order: 0 }] }, 'SORT_ORDER_DUPLICATE'],
  ]
  for (const [fn, args, code] of cases) {
    await expectCatalog(t.rpc(admin, fn, args), code).catch((e) => { throw new Error(`${fn}(${JSON.stringify(args)}): ${e.message}`) })
  }
  // gestor gira a vez do membro (permitido) e o próprio membro/attacker não aprovam; nenhum giro ficou aprovado sem gestor
  const adminSpin = await t.rpc(admin, 'spin_wheel', { p_queue_id: queueId }).catch((e) => { assert.match(e.message, /ATTEMPTS_EXHAUSTED|SPIN_PENDING|NO_ACTIVE_TURN/); return null })
  if (adminSpin) await t.rpc(admin, 'reject_spin', { p_spin_id: adminSpin.spin_id }) // devolve a vez limpa para os testes seguintes
  const approvedBy = await t.sql(`select count(*)::int as n from public.wheel_spins where status = 'approved' and approved_by <> $1`, [admin])
  assert.equal(approvedBy.rows[0].n, 0)
})

test('args hostis: perfil/config/temporada/resgate — patch inválido, status ilegal, último admin, timezone, datas, ações', async () => {
  const cases = [
    ['admin_update_profile', { p_profile_id: attacker, p_patch: null }, 'INVALID_PATCH_KEY'],
    ['admin_update_profile', { p_profile_id: attacker, p_patch: [] }, 'INVALID_PATCH_KEY'],
    ['admin_update_profile', { p_profile_id: attacker, p_patch: { points: 99999 } }, 'INVALID_PATCH_KEY'],
    ['admin_update_profile', { p_profile_id: attacker, p_patch: { id: NIL } }, 'INVALID_PATCH_KEY'],
    ['admin_update_profile', { p_profile_id: attacker, p_patch: { team_code: 'X' } }, 'INVALID_PATCH_KEY'],
    ['admin_update_profile', { p_profile_id: null, p_patch: { full_name: 'x' } }, 'PROFILE_NOT_FOUND'],
    ['admin_update_profile', { p_profile_id: NIL, p_patch: { full_name: 'x' } }, 'PROFILE_NOT_FOUND'],
    ['admin_update_profile', { p_profile_id: attacker, p_patch: { status: 'pending' } }, 'PROFILE_STATUS_INVALID'],
    ['admin_update_profile', { p_profile_id: attacker, p_patch: { status: 'deleted' } }, 'PROFILE_STATUS_INVALID'],
    ['admin_update_profile', { p_profile_id: admin, p_patch: { status: 'inactive' } }, 'LAST_ADMIN'],
    ['admin_update_profile', { p_profile_id: admin, p_patch: { role: 'collaborator' } }, 'LAST_ADMIN'],
    ['admin_update_profile', { p_profile_id: attacker, p_patch: { email: 'gestor@teste.local' } }, 'EMAIL_TAKEN'],
    ['update_app_settings', { p_patch: null }, 'INVALID_PATCH_KEY'],
    ['update_app_settings', { p_patch: { team_code: 'X' } }, 'INVALID_PATCH_KEY'],
    ['update_app_settings', { p_patch: { id: 2 } }, 'INVALID_PATCH_KEY'],
    ['update_app_settings', { p_patch: { timezone: 'UTC' } }, 'TIMEZONE_LOCKED'],
    ['create_season', { p_name: 'x', p_starts_on: '2098-02-01', p_ends_on: '2098-01-01' }, 'SEASON_RANGE_INVALID'],
    ['create_season', { p_name: 'x', p_starts_on: null, p_ends_on: '2098-01-01' }, 'SEASON_RANGE_INVALID'],
    ['create_season', { p_name: 'x', p_starts_on: '2098-01-01', p_ends_on: null }, 'SEASON_RANGE_INVALID'],
    ['update_season', { p_season_id: NIL, p_patch: { name: 'x' } }, 'SEASON_NOT_FOUND'],
    ['update_season', { p_season_id: seasonId, p_patch: { is_active: false } }, 'INVALID_PATCH_KEY'],
    ['update_season', { p_season_id: seasonId, p_patch: { closed_at: '2000-01-01' } }, 'INVALID_PATCH_KEY'],
    ['activate_season', { p_season_id: null }, 'SEASON_NOT_FOUND'],
    ['activate_season', { p_season_id: NIL }, 'SEASON_NOT_FOUND'],
    ['close_season', { p_season_id: NIL }, 'SEASON_NOT_FOUND'],
    ['handle_redemption', { p_redemption_id: NIL, p_action: 'approve' }, /REDEMPTION_NOT_FOUND|ACTION_INVALID/],
    ['handle_redemption', { p_redemption_id: NIL, p_action: 'steal' }, /ACTION_INVALID|REDEMPTION_NOT_FOUND/],
    ['handle_redemption', { p_redemption_id: NIL, p_action: null }, /ACTION_INVALID|REDEMPTION_NOT_FOUND/],
    ['save_mission', { p: { id: NIL, title: 'x', kind: 'daily', metric: 'sale', target_value: 1, starts_at: '2098-01-01', ends_at: '2098-02-01' } }, 'MISSION_NOT_FOUND'],
    ['delete_mission', { p_mission_id: NIL }, 'MISSION_NOT_FOUND'],
    ['save_challenge', { p: { id: NIL, name: 'x', kind: 'duel', metric: 'sales_amount', target_value: 1, starts_at: '2098-01-01', ends_at: '2098-02-01', participant_ids: [attacker, member] } }, 'CHALLENGE_NOT_FOUND'],
    ['activate_challenge', { p_challenge_id: NIL }, 'CHALLENGE_NOT_FOUND'],
    ['finish_challenge', { p_challenge_id: NIL }, 'CHALLENGE_NOT_FOUND'],
    ['cancel_challenge', { p_challenge_id: NIL }, 'CHALLENGE_NOT_FOUND'],
  ]
  const rc = await t.rpc(admin, 'recompute_stats', { p_profile_id: NIL })
  assert.equal(Number(rc.profiles), 0, 'recompute_stats de perfil inexistente não pode tocar em ninguém')
  for (const [fn, args, code] of cases) {
    await expectCatalog(t.rpc(admin, fn, args), code).catch((e) => { throw new Error(`${fn}(${JSON.stringify(args)}): ${e.message}`) })
  }
  // temporada fechada: um lançamento com occurred_at dentro dela → SEASON_CLOSED; ativar/fechar de novo → código do catálogo
  const prev = (await t.sql(`select (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date::text as s,
    (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 day')::date::text as e,
    ((date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 day') + interval '12 hours')::text as occurred`)).rows[0]
  const past = (await t.rpcRow(admin, 'create_season', { p_name: 'Anterior', p_starts_on: prev.s, p_ends_on: prev.e }))[0]
  await t.sql('update public.seasons set closed_at = now() where id = $1', [past.id])
  const occurred = prev.occurred // último dia do mês anterior, meio-dia local
  await expectCatalog(t.rpc(admin, 'record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_amount: 1, p_occurred_at: occurred }), /SEASON_CLOSED|OCCURRED_AT_INVALID/)
  await expectCatalog(t.rpc(admin, 'activate_season', { p_season_id: past.id }), /SEASON_CLOSED|SEASON_ALREADY_CLOSED/)
  await expectCatalog(t.rpc(admin, 'close_season', { p_season_id: past.id }), /SEASON_CLOSED|SEASON_ALREADY_CLOSED/)
  await expectCatalog(t.rpc(admin, 'update_season', { p_season_id: past.id, p_patch: { starts_on: '2000-01-01' } }), /SEASON_CLOSED|SEASON_ALREADY_CLOSED/)
})

// =============================================================================
// 8. Catálogo: views security_invoker, pg_proc (search_path, whitelist de EXECUTE), privilégios de tabela, RLS
// =============================================================================
test('catálogo: toda view de public é security_invoker=true (+ security_barrier) e só tem SELECT para authenticated; anon nada', async () => {
  const views = await t.sql(`select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v'`)
  assert.ok(views.rows.length >= VIEWS.length)
  for (const v of views.rows) {
    const opts = (v.reloptions ?? []).join(',')
    assert.match(opts, /security_invoker=(true|on)/, `${v.relname} sem security_invoker`)
    assert.match(opts, /security_barrier=(true|on)/, `${v.relname} sem security_barrier`)
    const privs = await t.sql(`select
      has_table_privilege('authenticated', 'public.' || $1, 'INSERT') as i, has_table_privilege('authenticated', 'public.' || $1, 'UPDATE') as u,
      has_table_privilege('authenticated', 'public.' || $1, 'DELETE') as d, has_table_privilege('authenticated', 'public.' || $1, 'SELECT') as s,
      has_table_privilege('anon', 'public.' || $1, 'SELECT') as anon_s`, [v.relname])
    assert.deepEqual(privs.rows[0], { i: false, u: false, d: false, s: true, anon_s: false }, `privilégios de ${v.relname}`)
  }
})

test('catálogo: toda tabela de public tem RLS ligado (e forçado para o owner não é exigido), nenhuma policy "to public/anon", anon sem privilégio algum', async () => {
  const tables = await t.sql(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')`)
  assert.ok(tables.rows.length >= TABLES.length)
  for (const tb of tables.rows) {
    assert.equal(tb.relrowsecurity, true, `${tb.relname} sem RLS`)
    const p = await t.sql(`select bool_or(has_table_privilege('anon', 'public.' || $1, priv)) as any_anon
      from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as priv`, [tb.relname])
    assert.equal(p.rows[0].any_anon, false, `anon tem privilégio em ${tb.relname}`)
    const d = await t.sql(`select has_table_privilege('authenticated', 'public.' || $1, 'DELETE') as d, has_table_privilege('authenticated', 'public.' || $1, 'TRUNCATE') as tr`, [tb.relname])
    assert.equal(d.rows[0].tr, false, `authenticated pode TRUNCATE ${tb.relname}`)
    assert.equal(d.rows[0].d, ['mission_participants', 'challenge_participants'].includes(tb.relname), `DELETE em ${tb.relname}`)
  }
  const pol = await t.sql(`select schemaname, tablename, policyname, roles from pg_policies where schemaname in ('public', 'storage')`)
  assert.ok(pol.rows.length > 0)
  for (const p of pol.rows) {
    const roles = Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/[{}]/g, '').split(',')
    assert.ok(!roles.includes('public') && !roles.includes('anon'), `policy ${p.tablename}.${p.policyname} para ${roles}`)
  }
  const seqs = await t.sql(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'S'`)
  for (const sq of seqs.rows) {
    const r = await t.sql(`select has_sequence_privilege('authenticated', 'public.' || $1, 'USAGE') as u`, [sq.relname])
    assert.equal(r.rows[0].u, false, `sequence ${sq.relname} com USAGE para authenticated`)
  }
  const sch = await t.sql(`select has_schema_privilege('authenticated', 'private', 'USAGE') as a, has_schema_privilege('anon', 'private', 'USAGE') as b, has_schema_privilege('public', 'private', 'USAGE') as c`)
  assert.deepEqual(sch.rows[0], { a: false, b: false, c: false })
})

test('catálogo: toda função de public/private tem search_path fixo; só a whitelist §7.9 é executável por authenticated; anon só signup_mode/validate_team_code; private sem EXECUTE', async () => {
  const fns = await t.sql(`select n.nspname, p.proname, p.oid::regprocedure::text as sig, p.prosecdef, p.proconfig,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_x,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_x,
      has_function_privilege('public', p.oid, 'EXECUTE') as public_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind = 'f'`)
  assert.ok(fns.rows.length > 60)
  const problems = []
  for (const f of fns.rows) {
    const cfg = (f.proconfig ?? []).join(';')
    if (!/search_path=/.test(cfg)) problems.push(`${f.sig}: sem search_path`)
    else if (!/search_path=(""|''|)(;|$)/.test(cfg) && !/search_path=$/.test(cfg)) problems.push(`${f.sig}: search_path não vazio (${cfg})`)
    if (f.public_x) problems.push(`${f.sig}: EXECUTE para public`)
    if (f.nspname === 'private') {
      if (f.auth_x || f.anon_x) problems.push(`${f.sig}: private executável por anon/authenticated`)
      continue
    }
    const white = AUTH_WHITELIST.includes(f.proname)
    if (f.auth_x !== white) problems.push(`${f.sig}: authenticated EXECUTE=${f.auth_x}, esperado ${white}`)
    if (f.anon_x !== ANON_WHITELIST.includes(f.proname)) problems.push(`${f.sig}: anon EXECUTE=${f.anon_x}`)
    if (['get_bootstrap', 'get_dashboard'].includes(f.proname) && f.prosecdef) problems.push(`${f.sig}: deveria ser security invoker`)
    if (!['get_bootstrap', 'get_dashboard'].includes(f.proname) && !f.prosecdef) problems.push(`${f.sig}: deveria ser security definer`)
  }
  assert.deepEqual(problems, [])
  // funções de trigger: nenhuma em public
  const trg = await t.sql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype where n.nspname = 'public' and t.typname = 'trigger'`)
  assert.deepEqual(trg.rows, [], 'função de trigger em public')
})

test('catálogo: anon não executa nenhuma RPC além das duas públicas (probe real, não só pg_proc) e helpers de tempo/papel devolvem false/NULL para anon', async () => {
  const probes = [
    ['get_bootstrap', {}], ['get_dashboard', {}], ['spin_wheel_free', { p_wheel_kind: 'classic' }], ['redeem_reward', { p_reward_id: NIL }],
    ['mark_notifications_read', {}], ['spin_wheel', { p_queue_id: NIL }], ['rotate_team_code', {}], ['is_admin', {}], ['is_active_member', {}],
    ['active_season_id', {}], ['avatar_count', { p_uid: NIL }], ['local_today', {}], ['app_timezone', {}],
  ]
  for (const [fn, args] of probes) {
    await expectError(t.rpc(null, fn, args, 'anon'), /permission denied/i).catch((e) => { throw new Error(`anon ${fn}: ${e.message}`) })
  }
  await expectError(t.asAnon((tx) => tx.query(`select * from public.signup_mode(), public.profiles`)), /permission denied/i)
  await expectError(t.asAnon((tx) => tx.query(`insert into public.profiles (id, full_name, role, status) values (gen_random_uuid(), 'x', 'admin', 'active')`)), /permission denied/i)
  await expectError(t.asAnon((tx) => tx.query(`insert into auth.users (email) values ('anon@teste.local')`)), /permission denied/i).catch(() => { /* shim: grant all em auth.users não existe no Supabase real */ })
})

// =============================================================================
// 9. Storage (avatars): nome fechado, pasta própria, cota 3, sem listagem para anon/inativo/pendente
// =============================================================================
test('storage: attacker só grava <uid>/avatar-<epoch>.<ext> na própria pasta (máx. 3); pasta alheia, svg, path traversal e 4º objeto são barrados', async () => {
  const ins = (who, name) => t.asUser(who, (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [name, who]))
  await expectRlsDenied(ins(attacker, `${member}/avatar-1700000000000.png`))
  await expectRlsDenied(ins(attacker, `${attacker}/../${member}/avatar-1700000000000.png`))
  await expectRlsDenied(ins(attacker, `${attacker}/avatar-1700000000000.svg`))
  await expectRlsDenied(ins(attacker, `${attacker}/avatar-1700000000000.gif`))
  await expectRlsDenied(ins(attacker, `${attacker}/qualquer.png`))
  await expectRlsDenied(ins(attacker, `${attacker}/avatar-1.png`))
  await expectRlsDenied(ins(attacker, `${attacker}/sub/avatar-1700000000000.png`))
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner) values ('outro', $1, $2)`, [`${attacker}/avatar-1700000000000.png`, attacker])).catch((e) => { if (/foreign key/.test(e.message)) throw new Error('row-level security (bucket inexistente)'); throw e }))
  for (const i of [1, 2, 3]) await ins(attacker, `${attacker}/avatar-170000000000${i}.png`)
  await expectRlsDenied(ins(attacker, `${attacker}/avatar-1700000000009.webp`))
  await expectRlsDenied(ins(pending, `${pending}/avatar-1700000000001.png`))
  await expectRlsDenied(ins(inactive, `${inactive}/avatar-1700000000001.png`))
  await expectRlsDenied(t.asAnon((tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${NIL}/avatar-1700000000001.png`])))
  // gestor grava na pasta de qualquer uid, mas também com nome fechado
  await t.asUser(admin, (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [`${member}/avatar-1700000000001.png`, admin]))
  await expectRlsDenied(t.asUser(admin, (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [`${member}/foto.png`, admin])))
  const n = await t.sql(`select count(*)::int as n from storage.objects where bucket_id = 'avatars'`)
  assert.equal(n.rows[0].n, 4)
})

test('storage: listagem só para membro ativo; attacker não apaga/renomeia objeto alheio; inativo/pendente/anon não listam', async () => {
  await t.asUser(attacker, async (tx) => {
    assert.equal(Number((await tx.query(`select count(*)::int as n from storage.objects`)).rows[0].n), 4, 'membro ativo lista o bucket (policy select members)')
    const d = await tx.query(`delete from storage.objects where name like $1`, [`${member}/%`])
    assert.equal(d.affectedRows ?? 0, 0, 'apagou objeto alheio')
    const u = await tx.query(`update storage.objects set name = $2 where name like $1`, [`${member}/%`, `${attacker}/avatar-1700000000005.png`])
    assert.equal(u.affectedRows ?? 0, 0, 'renomeou objeto alheio')
    const own = await tx.query(`delete from storage.objects where name = $1`, [`${attacker}/avatar-1700000000003.png`])
    assert.equal(own.affectedRows ?? 0, 1, 'deve apagar o próprio')
  })
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query(`update storage.objects set name = $2 where name = $1`, [`${attacker}/avatar-1700000000001.png`, `${member}/avatar-1700000000007.png`])))
  for (const who of [pending, inactive]) {
    await t.asUser(who, async (tx) => assert.equal(Number((await tx.query(`select count(*)::int as n from storage.objects`)).rows[0].n), 0))
  }
  await t.asAnon(async (tx) => assert.equal(Number((await tx.query(`select count(*)::int as n from storage.objects`)).rows[0].n), 0))
  assert.equal(Number((await t.sql(`select count(*)::int as n from storage.objects where name like $1`, [`${member}/%`])).rows[0].n), 1)
})

// =============================================================================
// 10. Ordem das checagens: papel antes de estado (attacker não sonda a fila alheia / de convidado)
// =============================================================================
test('ordem: attacker recebe NOT_ALLOWED (não NO_ACTIVE_TURN/SPIN_PENDING) em fila de convidado e alheia — não descobre o estado', async () => {
  const guest = (await t.rpcRow(admin, 'enqueue_wheel', { p_person_name: 'Convidado teste', p_wheel_kind: 'classic', p_attempts: 1 }))[0]
  await expectCatalog(t.rpc(attacker, 'spin_wheel', { p_queue_id: guest.id }), 'NOT_ALLOWED')
  await expectCatalog(t.rpc(attacker, 'spin_wheel', { p_queue_id: queueId }), 'NOT_ALLOWED')
  await expectCatalog(t.rpc(pending, 'spin_wheel', { p_queue_id: guest.id }), 'NOT_ALLOWED')
  // uuid inexistente devolve *_NOT_FOUND antes da checagem de papel (§7 preâmbulo — decisão de projeto, D.8)
  await expectCatalog(t.rpc(attacker, 'spin_wheel', { p_queue_id: NIL }), 'QUEUE_NOT_FOUND')
  await t.rpcRow(admin, 'remove_from_queue', { p_queue_id: guest.id })
})

test('ordem: usuário inativado com sessão viva perde tudo imediatamente (policies member and ...), inclusive a própria fila e notificações', async () => {
  const victim = await t.createAuthUser({ email: 'vitima@teste.local', metadata: { team_code: teamCode, full_name: 'Vítima' } })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: victim, p_patch: { status: 'active' } })
  await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: victim, p_points: 100, p_reason: 'crédito de teste' })
  await t.asUser(victim, async (tx) => {
    assert.equal(await count(tx, 'point_entries'), 1)
    assert.ok((await count(tx, 'notifications')) >= 1)
  })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: victim, p_patch: { status: 'inactive' } })
  await t.asUser(victim, async (tx) => {
    assert.equal(await count(tx, 'point_entries'), 0)
    assert.equal(await count(tx, 'notifications'), 0)
    assert.equal(await count(tx, 'v_wallet'), 0)
    assert.equal(await count(tx, 'profile_private'), 0)
    const u = await tx.query(`update public.profiles set full_name = 'x' where id = $1`, [victim])
    assert.equal(u.affectedRows ?? 0, 0)
  })
  await expectCatalog(t.rpc(victim, 'redeem_reward', { p_reward_id: cheapRewardId }), 'PROFILE_INACTIVE')
  await expectCatalog(t.rpc(admin, 'record_manual_entry', { p_profile_id: victim, p_points: 1, p_reason: 'xxx' }), 'PROFILE_INACTIVE')
  await expectCatalog(t.rpc(admin, 'enqueue_wheel', { p_profile_id: victim }), 'PROFILE_INACTIVE')
  assert.equal((await t.rpc(victim, 'get_bootstrap')).me.status, 'inactive')
})

// =============================================================================
// 11. Cadastro hostil e bootstrap
// =============================================================================
test('cadastro: metadata com role/status/id não escala; nome gigante é cortado; confirmado sem team_code depois do bootstrap → INVALID_TEAM_CODE (nunca admin)', async () => {
  const sneaky = await t.createAuthUser({ email: 'sneaky@teste.local', metadata: { team_code: teamCode, full_name: 'x'.repeat(5000), role: 'admin', status: 'active', is_admin: true } })
  const p = (await t.sql('select role, status, length(full_name) as len from public.profiles where id = $1', [sneaky])).rows[0]
  assert.equal(p.role, 'collaborator')
  assert.equal(p.status, 'pending')
  assert.ok(Number(p.len) <= 80)
  await expectError(t.createAuthUser({ email: 'segundo-admin@teste.local', confirmed: true }), 'INVALID_TEAM_CODE')
  await expectError(t.createAuthUser({ email: 'segundo-admin2@teste.local', confirmed: true, metadata: { team_code: 'ERRADO' } }), 'INVALID_TEAM_CODE')
  const admins = await t.sql(`select count(*)::int as n from public.profiles where role = 'admin'`)
  assert.equal(admins.rows[0].n, 1)
  // reabrir o bootstrap é impossível até para o gestor; trocar team_code por UPDATE direto também
  await expectCatalog(t.asUser(admin, (tx) => tx.query('update public.app_secrets set bootstrap_done = false where id = 1')), 'BOOTSTRAP_LOCKED')
  await expectCatalog(t.asUser(admin, (tx) => tx.query(`update public.app_secrets set team_code = 'AAAAAAAAAAAA' where id = 1`)), 'TEAM_CODE_VIA_RPC_ONLY')
  await expectCatalog(t.sql('update public.app_secrets set bootstrap_done = false where id = 1'), 'BOOTSTRAP_LOCKED')
  // o gestor gira o código; o antigo deixa de valer
  const fresh = await t.rpc(admin, 'rotate_team_code')
  assert.notEqual(fresh, teamCode)
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: teamCode }, 'anon'), false)
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: fresh }, 'anon'), true)
  await expectError(t.createAuthUser({ email: 'velho-codigo@teste.local', metadata: { team_code: teamCode } }), 'INVALID_TEAM_CODE')
  teamCode = fresh
})

// =============================================================================
// 12. Restos: participantes/metas/giros rejeitados/bootstrap e dashboard sem PII alheia
// =============================================================================
test('restos: attacker não apaga participantes (grant delete + policy admin = 0 linhas), não edita metas, não vê meta/giro rejeitado alheio; get_bootstrap/get_dashboard sem PII alheia', async () => {
  const m = (await t.rpcRow(admin, 'save_mission', { p: { title: 'Missão teste', kind: 'daily', metric: 'call', target_value: 5, reward_points: 10, reward_coins: 10,
    starts_at: new Date(Date.now() - 3600e3).toISOString(), ends_at: new Date(Date.now() + 3600e3).toISOString(), audience: 'selected', participant_ids: [member, attacker] } }))[0]
  await t.asUser(attacker, async (tx) => {
    const d = await tx.query('delete from public.mission_participants where mission_id = $1', [m.id])
    assert.equal(d.affectedRows ?? 0, 0)
    const g = await tx.query('update public.season_goals set goal_amount = 1 where profile_id = $1', [attacker])
    assert.equal(g.affectedRows ?? 0, 0)
    const og = await tx.query('select * from public.season_goals where profile_id <> $1', [attacker])
    assert.equal(og.rows.length, 0, 'meta alheia visível')
    const sr = await tx.query('select * from public.season_results where profile_id <> $1', [attacker])
    assert.equal(sr.rows.length, 0)
    const boot = JSON.stringify((await tx.query('select public.get_bootstrap() as j')).rows[0].j)
    const dash = JSON.stringify((await tx.query('select public.get_dashboard() as j')).rows[0].j)
    for (const secret of [MEMBER_PHONE, MEMBER_EMAIL, 'nota-privada-do-gestor', 'gestor@teste.local']) {
      assert.ok(!boot.includes(secret), `get_bootstrap vazou ${secret}`)
      assert.ok(!dash.includes(secret), `get_dashboard vazou ${secret}`)
    }
  })
  assert.equal(Number((await t.sql('select count(*)::int as n from public.mission_participants where mission_id = $1', [m.id])).rows[0].n), 2)
  await expectRlsDenied(t.asUser(attacker, (tx) => tx.query('insert into public.mission_participants (mission_id, profile_id) values ($1, $2)', [m.id, pending])))
  // giro rejeitado do membro fica invisível para o attacker (policy status in approved/pending or own or admin)
  const spin = await t.rpc(member, 'spin_wheel', { p_queue_id: queueId })
  assert.ok(spin?.spin_id, 'membro deveria conseguir girar (1 de 2 tentativas usada)')
  {
    await t.rpc(admin, 'reject_spin', { p_spin_id: spin.spin_id })
    await t.asUser(attacker, async (tx) => {
      const r = await tx.query('select id from public.wheel_spins where id = $1', [spin.spin_id])
      assert.equal(r.rows.length, 0, 'giro rejeitado alheio visível')
      const h = await tx.query('select * from public.v_wheel_history where spin_id = $1', [spin.spin_id]).catch(() => ({ rows: [] }))
      assert.equal(h.rows.length, 0)
    })
    await t.asUser(member, async (tx) => assert.equal((await tx.query('select id from public.wheel_spins where id = $1', [spin.spin_id])).rows.length, 1))
  }
})

test('restos: update_app_settings com valores fora do CK não derruba nada (erro, singleton intacto); attacker não muda xp_per_level', async () => {
  for (const patch of [{ xp_per_level: 0 }, { xp_per_level: -1 }, { xp_per_level: 2147483647 }, { company_name: 'x'.repeat(10000) }, { currency: 'x'.repeat(50) }, { target_conversion_pct: -1 }]) {
    await expectError(t.rpc(admin, 'update_app_settings', { p_patch: patch }), /./).catch((e) => { throw new Error(`${JSON.stringify(patch)}: ${e.message}`) })
  }
  const s = (await t.sql('select xp_per_level, company_name, currency from public.app_settings where id = 1')).rows[0]
  assert.deepEqual(s, { xp_per_level: 400, company_name: 'Orbion', currency: 'BRL' })
  await t.asUser(attacker, async (tx) => assert.equal((await tx.query('update public.app_settings set xp_per_level = 50 where id = 1')).affectedRows ?? 0, 0))
  await expectCatalog(t.rpc(attacker, 'update_app_settings', { p_patch: { xp_per_level: 50 } }), 'NOT_ADMIN')
  // views continuam funcionando para o membro após os ataques
  await t.asUser(attacker, async (tx) => { for (const v of VIEWS) await tx.query(`select * from public.${v} limit 1`) })
})

// =============================================================================
// 13. §9 promete: "toda escrita do fluxo normal passa por RPC e devolve código do catálogo" — args hostis que hoje vazam SQLSTATE cru
// =============================================================================
test('args hostis: RPCs de escrita não devem vazar SQLSTATE cru (23502/22003/23514/22007) — p_name NULL, amount 1e30, goal negativa, data inválida', async () => {
  const cases = [
    ['create_season', { p_name: null, p_starts_on: '2098-01-01', p_ends_on: '2098-02-01' }],
    ['record_rule_entry', { p_profile_id: attacker, p_rule_id: saleRuleId, p_amount: 1e30 }],
    ['admin_update_profile', { p_profile_id: attacker, p_patch: { goal_amount: -5 } }],
    ['update_season', { p_season_id: seasonId, p_patch: { starts_on: 'abc' } }],
  ]
  const leaks = []
  for (const [fn, args] of cases) {
    const e = await expectError(t.rpc(admin, fn, args), /./)
    if (!CODE_RE.test(e.message)) leaks.push(`${fn}(${JSON.stringify(args).slice(0, 70)}) → ${e.message.slice(0, 90)}`)
  }
  assert.deepEqual(leaks, [])
})
