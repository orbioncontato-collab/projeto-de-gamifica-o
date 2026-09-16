// Testes de RLS e de papéis (DATA-MODEL §10, §15 testes (a), (b), (j), (l), (y)).
// Cenário: um gestor criado pelo caminho do painel (auth.users com e-mail confirmado e
// sem metadata → handle_new_user faz admin), dois colaboradores via metadata com o
// team_code do seed; um é aprovado (admin_update_profile status=active), o outro fica
// pendente. Cada bloco executa como o papel indicado (set local role + claims do JWT).
// Contas de teste são rótulos técnicos (gestor/membro), não pessoas — nada vai para o seed.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectError, expectRlsDenied } from './pglite-harness.mjs'

let t
let admin, member, pending, teamCode
let queueId, spinId, memberEntryId, adminEntryId

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
// RPCs de gestor (§7.9 "todas as demais"): chamadas com argumentos mínimos válidos para
// que a única razão de falha seja NOT_ADMIN.
const ADMIN_RPCS = (targetId) => [
  ['admin_update_profile', { p_profile_id: targetId, p_patch: { full_name: 'x' } }],
  ['rotate_team_code', {}],
  ['update_app_settings', { p_patch: { company_name: 'x' } }],
  ['save_special_event', { p: {} }],
  ['recompute_stats', {}],
  ['create_season', { p_name: 'x', p_starts_on: '2099-01-01', p_ends_on: '2099-02-01' }],
  ['update_season', { p_season_id: targetId, p_patch: {} }],
  ['activate_season', { p_season_id: targetId }],
  ['close_season', { p_season_id: targetId }],
  ['record_rule_entry', { p_profile_id: targetId, p_rule_id: targetId }],
  ['record_manual_entry', { p_profile_id: targetId, p_points: 1, p_reason: 'x' }],
  ['record_initial_points', { p_profile_id: targetId, p_points: 1 }],
  ['reverse_entry', { p_entry_id: targetId, p_reason: 'x' }],
  ['save_mission', { p: {} }],
  ['delete_mission', { p_mission_id: targetId }],
  ['save_challenge', { p: {} }],
  ['activate_challenge', { p_challenge_id: targetId }],
  ['finish_challenge', { p_challenge_id: targetId }],
  ['cancel_challenge', { p_challenge_id: targetId }],
  ['enqueue_wheel', { p_profile_id: targetId }],
  ['update_queue_entry', { p_queue_id: targetId }],
  ['remove_from_queue', { p_queue_id: targetId }],
  ['release_turn', { p_queue_id: targetId }],
  ['approve_spin', { p_spin_id: targetId }],
  ['reject_spin', { p_spin_id: targetId }],
  ['save_wheel_prizes', { p_wheel_kind: 'classic', p_prizes: '[]' }],
  ['handle_redemption', { p_redemption_id: targetId, p_action: 'approve' }],
]

const count = (tx, rel) => tx.query(`select count(*)::int as n from public.${rel}`).then((r) => Number(r.rows[0].n))

before(async () => {
  t = await createTestDb()
  teamCode = (await t.sql('select team_code from public.app_secrets where id = 1')).rows[0].team_code

  // gestor: caminho do painel (e-mail confirmado, sem metadata) → primeiro admin
  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  // colaboradores: signup com team_code (auto_approve_members = false → pending)
  member = await t.createAuthUser({ email: 'membro-a@teste.local', metadata: { team_code: teamCode, full_name: 'Membro A' } })
  pending = await t.createAuthUser({ email: 'membro-b@teste.local', metadata: { team_code: teamCode, full_name: 'Membro B' } })
  // aprova só o primeiro
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: { status: 'active' } })

  // lançamentos: um do colaborador ativo, um do gestor (para o teste de "alheio")
  memberEntryId = (await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: member, p_points: 50, p_reason: 'lançamento de teste' }))[0].id
  adminEntryId = (await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: admin, p_points: 30, p_reason: 'lançamento de teste' }))[0].id

  // roleta: colaborador na fila, ainda sem vez liberada
  queueId = (await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: member, p_wheel_kind: 'classic', p_attempts: 1 }))[0].id
})
after(async () => t?.close())

test('cenário: papéis e status criados pelo trigger handle_new_user', async () => {
  const r = await t.sql('select id, role, status from public.profiles order by created_at')
  const byId = Object.fromEntries(r.rows.map((x) => [x.id, [x.role, x.status]]))
  assert.deepEqual(byId[admin], ['admin', 'active'])
  assert.deepEqual(byId[member], ['collaborator', 'active'])
  assert.deepEqual(byId[pending], ['collaborator', 'pending'])
  assert.equal((await t.sql('select bootstrap_done from public.app_secrets where id = 1')).rows[0].bootstrap_done, true)
})

// -----------------------------------------------------------------------------
// Colaborador ativo
// -----------------------------------------------------------------------------
test('colaborador: app_secrets devolve 0 linhas (policy admin) e audit_log também', async () => {
  await t.asUser(member, async (tx) => {
    assert.equal(await count(tx, 'app_secrets'), 0)
    assert.equal(await count(tx, 'audit_log'), 0)
    assert.equal(await count(tx, 'profile_private'), 1, 'só a própria linha de PII')
  })
})

test('colaborador: lê só as próprias point_entries; a do gestor não aparece (teste a)', async () => {
  await t.asUser(member, async (tx) => {
    const r = await tx.query('select id, profile_id from public.point_entries')
    assert.equal(r.rows.length, 1)
    assert.equal(r.rows[0].id, memberEntryId)
    assert.equal(r.rows[0].profile_id, member)
    const other = await tx.query('select id from public.point_entries where id = $1', [adminEntryId])
    assert.equal(other.rows.length, 0)
    const hist = await tx.query('select profile_id from public.v_point_entries_history')
    assert.ok(hist.rows.every((x) => x.profile_id === member))
    const wallet = await tx.query('select profile_id from public.v_wallet')
    assert.ok(wallet.rows.every((x) => x.profile_id === member))
  })
})

test('colaborador: não altera role/status próprios nem de terceiros (teste b)', async () => {
  await expectError(
    t.asUser(member, (tx) => tx.query(`update public.profiles set role = 'admin' where id = $1`, [member])),
    /permission denied|FORBIDDEN_COLUMN/,
  )
  await expectError(
    t.asUser(member, (tx) => tx.query(`update public.profiles set status = 'inactive' where id = $1`, [member])),
    /permission denied|FORBIDDEN_COLUMN/,
  )
  await expectError(
    t.asUser(member, (tx) => tx.query(`update public.profiles set job_title = 'sdr' where id = $1`, [member])),
    /permission denied|FORBIDDEN_COLUMN/,
  )
  const r = await t.sql('select role, status from public.profiles where id = $1', [member])
  assert.deepEqual(r.rows[0], { role: 'collaborator', status: 'active' })
})

test('colaborador: pode alterar o próprio nome, mas nenhuma linha alheia é afetada', async () => {
  await t.asUser(member, async (tx) => {
    const own = await tx.query(`update public.profiles set full_name = 'Membro A2' where id = $1 returning id`, [member])
    assert.equal(own.rows.length, 1)
    const other = await tx.query(`update public.profiles set full_name = 'x' where id = $1 returning id`, [admin])
    assert.equal(other.rows.length, 0, 'update em linha alheia: 0 linhas (policy id = me)')
  })
  assert.equal((await t.sql('select full_name from public.profiles where id = $1', [admin])).rows[0].full_name, 'gestor')
})

test('colaborador: não altera pontos (profile_season_stats/lifetime sem grant de update)', async () => {
  await expectRlsDenied(t.asUser(member, (tx) => tx.query(`update public.profile_season_stats set points = 9999 where profile_id = $1`, [member])))
  await expectRlsDenied(t.asUser(member, (tx) => tx.query(`update public.profile_lifetime_stats set coins_earned = 9999 where profile_id = $1`, [member])))
  // season_goals tem grant de update, mas a policy é admin: o update do colaborador atinge 0 linhas
  const touched = await t.asUser(member, (tx) => tx.query(`update public.season_goals set goal_amount = 1 where profile_id = $1 returning profile_id`, [member]))
  assert.equal(touched.rows.length, 0)
  const goal = (await t.sql('select goal_amount::text as g from public.season_goals where profile_id = $1', [member])).rows[0].g
  assert.equal(goal, '0.00')
  // app_settings idem (policy admin): 0 linhas e valor intacto
  const settings = await t.asUser(member, (tx) => tx.query(`update public.app_settings set company_name = 'x' where id = 1 returning id`))
  assert.equal(settings.rows.length, 0)
})

test('colaborador: insert direto em point_entries é barrado pela policy (admin)', async () => {
  const rule = (await t.sql(`select id from public.point_rules where metric = 'meeting_scheduled'`)).rows[0]
  await expectRlsDenied(
    t.asUser(member, (tx) =>
      tx.query(`insert into public.point_entries (profile_id, season_id, rule_id, metric, base_points, points, coins, source, reason)
        values ($1, public.active_season_id(), $2, 'meeting_scheduled', 10, 10, 10, 'rule', 'x')`, [member, rule.id]),
    ),
  )
  await expectRlsDenied(t.asUser(member, (tx) => tx.query(`delete from public.point_entries where id = $1`, [memberEntryId])))
  assert.equal(Number((await t.sql('select count(*)::int as n from public.point_entries')).rows[0].n), 2)
})

test('colaborador: spin_wheel fora da vez → NO_ACTIVE_TURN; fila alheia → NOT_ALLOWED; approve_spin → NOT_ADMIN', async () => {
  await expectError(t.rpc(member, 'spin_wheel', { p_queue_id: queueId }), 'NO_ACTIVE_TURN')
  const adminQueue = (await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: admin, p_wheel_kind: 'classic', p_attempts: 1 }))[0].id
  await expectError(t.rpc(member, 'spin_wheel', { p_queue_id: adminQueue }), 'NOT_ALLOWED')
  await expectError(t.rpc(member, 'release_turn', { p_queue_id: queueId }), 'NOT_ADMIN')
  await t.rpc(admin, 'remove_from_queue', { p_queue_id: adminQueue })

  // gestor libera a vez → colaborador gira; o giro fica pendente e só o gestor aprova
  await t.rpc(admin, 'release_turn', { p_queue_id: queueId })
  const spin = await t.rpc(member, 'spin_wheel', { p_queue_id: queueId })
  spinId = spin.spin_id
  assert.ok(spinId)
  await expectError(t.rpc(member, 'approve_spin', { p_spin_id: spinId }), 'NOT_ADMIN')
  await expectError(t.rpc(member, 'reject_spin', { p_spin_id: spinId }), 'NOT_ADMIN')
  await expectError(t.rpc(member, 'spin_wheel', { p_queue_id: queueId }), 'SPIN_PENDING')
  const status = (await t.sql('select status from public.wheel_spins where id = $1', [spinId])).rows[0].status
  assert.equal(status, 'pending')
})

test('colaborador: toda RPC de gestor devolve NOT_ADMIN antes de qualquer outra validação', async () => {
  for (const [name, args] of ADMIN_RPCS(member)) {
    await expectError(t.rpc(member, name, args), 'NOT_ADMIN').catch((e) => {
      throw new Error(`${name}: ${e.message}`)
    })
  }
})

test('colaborador: consegue ler as views de membro (teste l) e vê o pendente em lugar nenhum', async () => {
  await t.asUser(member, async (tx) => {
    for (const v of ['v_mission_board', 'v_profile_stats', 'v_sales_timeline', 'v_seasons', 'v_ranking', 'v_team_stats', 'v_achievement_board', 'v_wheel_queue', 'v_activity_feed']) {
      await tx.query(`select * from public.${v}`)
    }
    const ranking = await tx.query('select profile_id from public.v_ranking')
    assert.ok(!ranking.rows.some((x) => x.profile_id === pending))
    for (const v of ['v_mission_board', 'v_achievement_board', 'v_profile_stats']) {
      const r = await tx.query(`select * from public.${v}`)
      const col = r.rows.length ? Object.keys(r.rows[0]).find((k) => k === 'profile_id' || k === 'id') : null
      if (v !== 'v_profile_stats') assert.ok(!r.rows.some((x) => x[col] === pending), `${v} não lista pendentes (teste j)`)
      else assert.ok(r.rows.filter((x) => x.profile_id === pending).every((x) => x.rank === null), 'pendente em v_profile_stats com rank NULL (§5.1)')
    }
    assert.equal(await count(tx, 'v_admin_kpis'), 0, 'v_admin_kpis só admin')
  })
})

// -----------------------------------------------------------------------------
// Pendente (status = 'pending'): is_active_member() = false
// -----------------------------------------------------------------------------
test('pendente: is_active_member/is_admin false; get_bootstrap devolve só {me:{status:pending}} (teste j)', async () => {
  await t.asUser(pending, async (tx) => {
    const r = await tx.query('select public.is_active_member() as m, public.is_admin() as a')
    assert.deepEqual(r.rows[0], { m: false, a: false })
  })
  const boot = await t.rpc(pending, 'get_bootstrap')
  assert.deepEqual(Object.keys(boot), ['me'])
  assert.equal(boot.me.status, 'pending')
  assert.equal(boot.me.id, pending)
  assert.ok(!('season' in boot) && !('settings' in boot) && !('pending_members' in boot))
})

test('pendente: toda view devolve 0 linhas', async () => {
  await t.asUser(pending, async (tx) => {
    for (const v of VIEWS) assert.equal(await count(tx, v), 0, `${v} deveria estar vazia para pendente`)
  })
})

test('pendente: toda tabela devolve 0 linhas, exceto a própria linha em profiles', async () => {
  await t.asUser(pending, async (tx) => {
    for (const tbl of TABLES) {
      const n = await count(tx, tbl)
      if (tbl === 'profiles') {
        assert.equal(n, 1)
        const r = await tx.query('select id, status from public.profiles')
        assert.deepEqual(r.rows[0], { id: pending, status: 'pending' })
      } else {
        assert.equal(n, 0, `${tbl} deveria estar vazia para pendente`)
      }
    }
  })
})

test('pendente: RPCs de membro → PROFILE_PENDING; RPCs de gestor → NOT_ADMIN', async () => {
  const reward = (await t.sql('select id from public.rewards where deleted_at is null limit 1')).rows[0].id
  await expectError(t.rpc(pending, 'redeem_reward', { p_reward_id: reward }), 'PROFILE_PENDING')
  await expectError(t.rpc(pending, 'spin_wheel_free', { p_wheel_kind: 'classic' }), 'PROFILE_PENDING')
  await expectError(t.rpc(pending, 'mark_notifications_read', {}), 'PROFILE_PENDING')
  await expectError(t.rpc(pending, 'get_dashboard', {}), 'PROFILE_PENDING')
  await expectError(t.rpc(pending, 'spin_wheel', { p_queue_id: queueId }), 'NOT_ALLOWED')
  for (const [name, args] of ADMIN_RPCS(pending)) {
    await expectError(t.rpc(pending, name, args), 'NOT_ADMIN').catch((e) => {
      throw new Error(`${name}: ${e.message}`)
    })
  }
})

test('pendente: não edita nem o próprio nome (policy member and id = me) e não insere nada', async () => {
  const r = await t.asUser(pending, (tx) => tx.query(`update public.profiles set full_name = 'x' where id = $1 returning id`, [pending]))
  assert.equal(r.rows.length, 0)
  await expectRlsDenied(t.asUser(pending, (tx) => tx.query(`insert into public.rewards (name, cost_coins) values ('x', 1)`)))
  await expectError(t.asUser(pending, (tx) => tx.query(`update public.profiles set status = 'active' where id = $1`, [pending])), /permission denied|FORBIDDEN_COLUMN/)
  assert.equal((await t.sql('select status from public.profiles where id = $1', [pending])).rows[0].status, 'pending')
})

// -----------------------------------------------------------------------------
// Anon: nada além de signup_mode / validate_team_code
// -----------------------------------------------------------------------------
test('anon: permission denied em toda tabela e view de public', async () => {
  for (const rel of [...TABLES, ...VIEWS]) {
    await expectRlsDenied(t.asAnon((tx) => tx.query(`select * from public.${rel} limit 1`))).catch((e) => {
      throw new Error(`${rel}: ${e.message}`)
    })
  }
})

test('anon: não executa RPCs de membro nem de gestor; só signup_mode e validate_team_code', async () => {
  await expectRlsDenied(t.rpc(null, 'get_bootstrap', {}, 'anon'))
  await expectRlsDenied(t.rpc(null, 'get_dashboard', {}, 'anon'))
  await expectRlsDenied(t.rpc(null, 'is_admin', {}, 'anon'))
  await expectRlsDenied(t.rpc(null, 'redeem_reward', { p_reward_id: admin }, 'anon'))
  await expectRlsDenied(t.rpc(null, 'admin_update_profile', { p_profile_id: admin, p_patch: { full_name: 'x' } }, 'anon'))
  await expectRlsDenied(t.rpc(null, 'rotate_team_code', {}, 'anon'))
  assert.equal(await t.rpc(null, 'signup_mode', {}, 'anon'), 'team_code', 'após o primeiro admin o modo é team_code')
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: teamCode }, 'anon'), true)
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: 'NOPE' }, 'anon'), false)
})

test('anon: não insere, não atualiza e não chama helpers de private', async () => {
  await expectRlsDenied(t.asAnon((tx) => tx.query(`insert into public.rewards (name, cost_coins) values ('x', 1)`)))
  await expectRlsDenied(t.asAnon((tx) => tx.query(`update public.app_settings set company_name = 'x' where id = 1`)))
  await expectRlsDenied(t.asAnon((tx) => tx.query(`select private.assert_admin()`)))
  await expectRlsDenied(t.asUser(member, (tx) => tx.query(`select private.assert_admin()`)))
})

// -----------------------------------------------------------------------------
// Gestor: lê tudo
// -----------------------------------------------------------------------------
test('gestor: lê app_secrets, audit_log, todas as point_entries, PII e os pendentes', async () => {
  await t.asUser(admin, async (tx) => {
    const r = await tx.query('select public.is_active_member() as m, public.is_admin() as a')
    assert.deepEqual(r.rows[0], { m: true, a: true })
    assert.equal(await count(tx, 'app_secrets'), 1)
    assert.equal((await tx.query('select team_code from public.app_secrets where id = 1')).rows[0].team_code, teamCode)
    assert.ok((await count(tx, 'audit_log')) >= 1, 'aprovação do membro gravou audit_log (teste y)')
    assert.equal(await count(tx, 'point_entries'), 2)
    assert.equal(await count(tx, 'profiles'), 3)
    assert.equal(await count(tx, 'profile_private'), 3)
    const pend = await tx.query(`select id from public.profiles where status = 'pending'`)
    assert.deepEqual(pend.rows.map((x) => x.id), [pending])
    assert.equal(await count(tx, 'v_admin_kpis'), 1)
    assert.ok((await count(tx, 'v_profile_stats')) >= 3)
    for (const v of VIEWS) await tx.query(`select * from public.${v}`)
    for (const tbl of TABLES) await tx.query(`select * from public.${tbl}`)
  })
})

test('gestor: get_bootstrap completo com pending_members = 1; colaborador vê 0', async () => {
  const boot = await t.rpc(admin, 'get_bootstrap')
  assert.equal(boot.me.role, 'admin')
  assert.equal(Number(boot.pending_members), 1)
  assert.ok(boot.season && boot.settings)
  const member_boot = await t.rpc(member, 'get_bootstrap')
  assert.equal(Number(member_boot.pending_members ?? 0), 0)
})

test('gestor: aprova o giro pendente; colaborador vê o giro aprovado e os pontos caem na carteira certa', async () => {
  const result = await t.rpc(admin, 'approve_spin', { p_spin_id: spinId })
  assert.ok(result)
  await expectError(t.rpc(admin, 'approve_spin', { p_spin_id: spinId }), 'SPIN_NOT_PENDING')
  await t.asUser(member, async (tx) => {
    const spins = await tx.query('select status from public.wheel_spins where id = $1', [spinId])
    assert.equal(spins.rows[0]?.status, 'approved')
    const entries = await tx.query('select profile_id from public.point_entries')
    assert.ok(entries.rows.every((x) => x.profile_id === member))
  })
})

test('gestor: rejeita status pendente via patch e não pode ser rebaixado sendo o último admin', async () => {
  await expectError(t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: { status: 'pending' } }), 'PROFILE_STATUS_INVALID')
  await expectError(t.rpc(admin, 'admin_update_profile', { p_profile_id: admin, p_patch: { role: 'collaborator' } }), 'LAST_ADMIN')
  await expectError(t.rpc(admin, 'admin_update_profile', { p_profile_id: admin, p_patch: { status: 'inactive' } }), 'LAST_ADMIN')
})
