// Fluxos de negócio ponta a ponta (DATA-MODEL §14.1–§14.4), só via RPCs, cada passo
// executado com o papel certo (anon / authenticated com claims / postgres só para asserts).
// Um único banco PGlite para o arquivo; os testes rodam em ordem (node:test é sequencial)
// porque cada fluxo depende do estado deixado pelo anterior — exatamente como em produção.
// Contas de teste são rótulos técnicos (gestor / membro-a / membro-b), não pessoas.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectError, num } from './pglite-harness.mjs'

let t
let teamCode, admin, memberA, memberB, activeSeason, ruleSale

// atalhos de leitura "de fora" (postgres, ignora RLS) para asserts de estado
const one = async (text, params = []) => (await t.sql(text, params)).rows[0]
const countRows = async (text, params = []) => Number((await t.sql(`select count(*)::int as n from (${text}) x`, params)).rows[0].n)
const seasonStats = (profileId, seasonId) =>
  one('select * from public.profile_season_stats where profile_id = $1 and season_id = $2', [profileId, seasonId])
const iso = (d) => new Date(d).toISOString()
const hoursFromNow = (h) => iso(Date.now() + h * 3600 * 1000)

before(async () => {
  t = await createTestDb()
  teamCode = (await one('select team_code from public.app_secrets where id = 1')).team_code
  activeSeason = await one('select * from public.seasons where is_active')
  ruleSale = await one("select * from public.point_rules where name = 'Venda realizada' and deleted_at is null")
  assert.ok(activeSeason, 'seed deve criar a temporada ativa')
  assert.equal(ruleSale.requires_amount, true, 'regra "Venda realizada" exige valor')
})
after(async () => t?.close())

// =============================================================================
// 14.1 Cadastro — bootstrap do admin e entrada por team_code
// =============================================================================
test('14.1.1 antes do bootstrap signup_mode() é first_admin (anon) e o insert de painel cria o admin', async () => {
  const mode = await t.rpc(null, 'signup_mode', {}, 'anon')
  assert.equal(mode, 'first_admin')

  // painel do Supabase: e-mail confirmado, sem metadata → handle_new_user faz o admin
  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  const p = await one('select * from public.profiles where id = $1', [admin])
  assert.equal(p.role, 'admin')
  assert.equal(p.status, 'active')
  assert.equal((await one('select bootstrap_done from public.app_secrets where id = 1')).bootstrap_done, true)
  assert.equal(await countRows('select 1 from public.profile_private where profile_id = $1', [admin]), 1)
  assert.equal(await countRows('select 1 from public.profile_lifetime_stats where profile_id = $1', [admin]), 1)
  assert.equal(await countRows('select 1 from public.season_goals where profile_id = $1 and season_id = $2', [admin, activeSeason.id]), 1)

  // a partir daqui nenhum cadastro público vira admin
  assert.equal(await t.rpc(null, 'signup_mode', {}, 'anon'), 'team_code')
})

test('14.1.2 validate_team_code é só UX: true para o código do seed, false para outro', async () => {
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: teamCode.toLowerCase() }, 'anon'), true)
  assert.equal(await t.rpc(null, 'validate_team_code', { p_code: 'ZZZZZZZZZZZZ' }, 'anon'), false)
})

test('14.1.3 team_code inválido (ou ausente) aborta o signup com INVALID_TEAM_CODE e nada fica no banco', async () => {
  const err = await expectError(
    t.createAuthUser({ email: 'intruso@teste.local', metadata: { team_code: 'ZZZZZZZZZZZZ', full_name: 'Intruso' } }),
    'INVALID_TEAM_CODE',
  )
  assert.equal(err.detail, 'Código da equipe inválido.')
  // sem código (usuário criado pelo painel depois do bootstrap) também cai
  await expectError(t.createAuthUser({ email: 'sem-codigo@teste.local', confirmed: true }), 'INVALID_TEAM_CODE')
  assert.equal(await countRows("select 1 from auth.users where email in ('intruso@teste.local','sem-codigo@teste.local')"), 0)
  assert.equal(await countRows("select 1 from public.profiles where role = 'collaborator'"), 0)
})

test('14.1.4 colaborador com código certo entra como pending, gestores são notificados e o banco só devolve {me:{status:pending}}', async () => {
  memberA = await t.createAuthUser({ email: 'membro-a@teste.local', metadata: { team_code: teamCode, full_name: 'Membro A' } })
  const p = await one('select * from public.profiles where id = $1', [memberA])
  assert.equal(p.role, 'collaborator')
  assert.equal(p.status, 'pending')
  assert.equal(p.full_name, 'Membro A')
  assert.equal(num((await one('select goal_amount from public.season_goals where profile_id = $1 and season_id = $2', [memberA, activeSeason.id])).goal_amount), 0)

  const notif = await one("select * from public.notifications where profile_id = $1 and kind = 'system' order by created_at desc limit 1", [admin])
  assert.equal(notif.title, 'Novo membro aguardando aprovação')

  const boot = await t.rpc(memberA, 'get_bootstrap')
  assert.deepEqual(Object.keys(boot), ['me'])
  assert.equal(boot.me.status, 'pending')

  const adminBoot = await t.rpc(admin, 'get_bootstrap')
  assert.equal(adminBoot.pending_members, 1)
  // pendente não recebe pontos iniciais
  await expectError(t.rpc(admin, 'record_initial_points', { p_profile_id: memberA, p_points: 100 }), 'PROFILE_INACTIVE')
})

test('14.1.5 aprovação: admin_update_profile(status=active) audita, garante season_goals e notifica membro e time', async () => {
  const res = await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberA, p_patch: { status: 'active' } })
  assert.equal(res.profile.status, 'active')
  assert.deepEqual(res.warnings, [])
  assert.equal((await one('select status from public.profiles where id = $1', [memberA])).status, 'active')
  assert.equal(await countRows('select 1 from public.season_goals where profile_id = $1 and season_id = $2', [memberA, activeSeason.id]), 1)
  assert.ok(await countRows("select 1 from public.audit_log where action = 'rpc' and table_name = 'admin_update_profile' and row_id = $1", [memberA]) >= 1)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Cadastro aprovado'", [memberA]), 1)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Novo membro'", [admin]), 1)

  const boot = await t.rpc(memberA, 'get_bootstrap')
  assert.equal(boot.me.status, 'active')
  assert.equal((await t.rpc(admin, 'get_bootstrap')).pending_members, 0)
})

test('14.1.6 auto_approve_members=true: o próximo cadastro já nasce active; depois volta ao default', async () => {
  const [s] = await t.rpcRow(admin, 'update_app_settings', { p_patch: { auto_approve_members: true } })
  assert.equal(s.auto_approve_members, true)
  memberB = await t.createAuthUser({ email: 'membro-b@teste.local', metadata: { team_code: teamCode, full_name: 'Membro B' } })
  const p = await one('select * from public.profiles where id = $1', [memberB])
  assert.equal(p.status, 'active')
  assert.equal(p.role, 'collaborator')
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Novo membro'", [admin]), 2)
  assert.equal(await countRows('select 1 from public.season_goals where profile_id = $1 and season_id = $2', [memberB, activeSeason.id]), 1)
  await t.rpc(admin, 'update_app_settings', { p_patch: { auto_approve_members: false } })
  assert.equal((await one('select auto_approve_members from public.app_settings where id = 1')).auto_approve_members, false)
})

// =============================================================================
// 14.2 Admin registra uma venda
// =============================================================================
let saleEntry, specialEvent
test('14.2.1 venda dentro do evento especial 2x: pontos dobram, moedas não, evento e temporada gravados', async () => {
  const [ev] = await t.rpcRow(admin, 'save_special_event', {
    p: { name: 'Happy hour 2x', multiplier: 2, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1) },
  })
  specialEvent = ev
  assert.equal(num(ev.multiplier), 2)
  assert.equal(ev.is_active, true)

  // regra exige valor → sem valor falha antes de gravar
  await expectError(t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberA, p_rule_id: ruleSale.id, p_quantity: 1 }), 'AMOUNT_REQUIRED')
  // colaborador não lança (NOT_ADMIN)
  await expectError(
    t.rpcRow(memberA, 'record_rule_entry', { p_profile_id: memberA, p_rule_id: ruleSale.id, p_quantity: 1, p_amount: 8500 }),
    'NOT_ADMIN',
  )

  const [e] = await t.rpcRow(admin, 'record_rule_entry', {
    p_profile_id: memberA, p_rule_id: ruleSale.id, p_quantity: 1, p_amount: 8500, p_occurred_at: iso(Date.now()), p_reason: null,
  })
  saleEntry = e
  assert.equal(e.source, 'rule')
  assert.equal(e.metric, 'sale')
  assert.equal(num(e.base_points), 100)
  assert.equal(num(e.multiplier), 2)
  assert.equal(num(e.points), 200, 'pontos dobrados pelo evento')
  assert.equal(num(e.coins), 100, 'moedas NÃO dobram')
  assert.equal(num(e.amount), 8500)
  assert.equal(e.special_event_id, ev.id)
  assert.equal(e.season_id, activeSeason.id)
  assert.equal(e.created_by, admin)
})

test('14.2.2 stats da temporada, lifetime, v_profile_stats e v_ranking refletem a venda', async () => {
  // a 1ª venda também desbloqueia PRIMEIRA VENDA (+50/+50, entry source=achievement) — §14.2.3
  const ach = await one("select * from public.point_entries where profile_id = $1 and source = 'achievement'", [memberA])
  assert.equal(num(ach.points), 50)
  assert.equal(num(ach.coins), 50)
  assert.equal(await countRows("select 1 from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id where pa.profile_id = $1 and a.code = 'first_sale'", [memberA]), 1)
  const ss = await seasonStats(memberA, activeSeason.id)
  assert.equal(num(ss.points), 250, '200 da venda + 50 da conquista')
  assert.equal(num(ss.sales_amount), 8500)
  assert.equal(num(ss.sales_count), 1)
  assert.equal(num(ss.activities_count), 1)
  const ls = await one('select * from public.profile_lifetime_stats where profile_id = $1', [memberA])
  assert.equal(num(ls.sales_amount), 8500)
  assert.ok(ls.first_sale_at, 'first_sale_at preenchido na primeira venda')

  // o próprio colaborador vê suas stats e o ranking (security invoker + RLS de membro ativo)
  const me = await t.asUser(memberA, async (tx) =>
    (await tx.query('select * from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberA, activeSeason.id])).rows[0])
  assert.equal(num(me.points), 250)
  assert.equal(num(me.sales_amount), 8500)
  assert.equal(num(me.sales_count), 1)
  assert.equal(num(me.coins_balance), 150)
  assert.equal(num(me.level), 0, '200 < xp_per_level 400')

  const ranking = await t.asUser(memberA, async (tx) =>
    (await tx.query('select * from public.v_ranking where season_id = $1 order by rank', [activeSeason.id])).rows)
  assert.equal(ranking[0].profile_id, memberA)
  assert.equal(num(ranking[0].rank), 1)
  assert.equal(num(ranking[0].points), 250)
  // feed de venda
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'sale' and profile_id = $1", [memberA]), 1)
})

test('14.2.3 fora da janela do evento o multiplicador é 1; temporada resolvida por occurred_at (mês anterior)', async () => {
  // entrada 3h atrás: antes do evento (que começou há 1h) → sem multiplicador
  const [e1] = await t.rpcRow(admin, 'record_rule_entry', {
    p_profile_id: memberA, p_rule_id: ruleSale.id, p_quantity: 1, p_amount: 1000, p_occurred_at: hoursFromNow(-3),
  })
  assert.equal(num(e1.multiplier), 1)
  assert.equal(num(e1.points), 100)
  assert.equal(e1.special_event_id, null)
  assert.equal(num((await seasonStats(memberA, activeSeason.id)).points), 350)

  // temporada do mês anterior (não ativa) recebe a entry cuja occurred_at cai nela
  const prev = await one(`
    select (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date as starts_on,
           (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 day')::date as ends_on,
           ((date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month' + interval '10 days 12 hours')::timestamp
              at time zone 'America/Sao_Paulo') as occurred_at`)
  const [prevSeason] = await t.rpcRow(admin, 'create_season', { p_name: 'Temporada anterior', p_starts_on: prev.starts_on, p_ends_on: prev.ends_on })
  assert.equal(prevSeason.is_active, false)
  const [e2] = await t.rpcRow(admin, 'record_rule_entry', {
    p_profile_id: memberA, p_rule_id: ruleSale.id, p_quantity: 1, p_amount: 2000, p_occurred_at: iso(prev.occurred_at),
  })
  assert.equal(e2.season_id, prevSeason.id, 'season_id vem de occurred_at, não de now()')
  assert.equal(num((await seasonStats(memberA, prevSeason.id)).points), 100)
  assert.equal(num((await seasonStats(memberA, activeSeason.id)).points), 350, 'temporada ativa intacta')
  assert.equal(num((await seasonStats(memberA, activeSeason.id)).sales_amount), 9500)
  // fora dos 90 dias → recusado
  await expectError(
    t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberA, p_rule_id: ruleSale.id, p_amount: 10, p_occurred_at: hoursFromNow(-24 * 120) }),
    'OCCURRED_AT_INVALID',
  )
})

// =============================================================================
// 14.3 Missão conclui automaticamente e alimenta a fila da roleta
// =============================================================================
let mission, earnedQueueId
test('14.3.1 save_mission (diária, metric sale, alvo 1, prêmio 50/50 + giro premium) aparece em v_mission_board com progresso 0', async () => {
  const [m] = await t.rpcRow(admin, 'save_mission', {
    p: {
      title: 'Realize uma venda hoje', kind: 'daily', metric: 'sale', target_kind: 'count', target_value: 1,
      reward_points: 50, reward_coins: 50, reward_spin: 'premium',
      starts_at: iso(activeSeason.starts_at), ends_at: iso(activeSeason.ends_at), audience: 'all',
    },
  })
  mission = m
  assert.equal(m.kind, 'daily')
  assert.equal(m.reward_spin, 'premium')
  assert.equal(m.season_id, activeSeason.id)

  const board = await t.asUser(memberB, async (tx) =>
    (await tx.query('select * from public.v_mission_board where mission_id = $1 and profile_id = $2', [m.id, memberB])).rows[0])
  assert.ok(board, 'colaborador vê a missão')
  assert.equal(board.is_current, true)
  assert.equal(num(board.progress_value), 0)
  assert.equal(board.is_completed, false)
})

test('14.3.2 a venda conclui a missão: progresso, entry mission +50/+50, fila da roleta earned, stats e feed', async () => {
  const [e] = await t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberB, p_rule_id: ruleSale.id, p_quantity: 1, p_amount: 3000 })
  assert.equal(e.metric, 'sale')

  const mp = await one('select * from public.mission_progress where mission_id = $1 and profile_id = $2', [mission.id, memberB])
  assert.ok(mp, 'progresso criado')
  assert.equal(num(mp.value), 1)
  assert.ok(mp.completed_at, 'missão concluída na entry')
  assert.ok(mp.queue_id, 'queue_id ligado à fila da roleta')
  earnedQueueId = mp.queue_id

  const reward = await one("select * from public.point_entries where profile_id = $1 and source = 'mission'", [memberB])
  assert.equal(num(reward.points), 50)
  assert.equal(num(reward.coins), 50)
  assert.equal(reward.reason, 'Realize uma venda hoje')

  const q = await one('select * from public.wheel_queue where id = $1', [earnedQueueId])
  assert.equal(q.profile_id, memberB)
  assert.equal(q.source, 'earned')
  assert.equal(q.status, 'waiting')
  assert.equal(q.reference_kind, 'mission_progress')
  assert.equal(q.reference_id, `${mission.id}:${memberB}:${mp.period_key}`)
  assert.equal(num(q.attempts_allowed), 1)
  assert.equal((await one('select kind from public.wheels where id = $1', [q.wheel_id])).kind, 'premium')

  assert.equal(num((await seasonStats(memberB, activeSeason.id)).missions_completed), 1)
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'mission_completed' and profile_id = $1", [memberB]), 1)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Missão concluída'", [memberB]), 1)

  const board = await t.asUser(memberB, async (tx) =>
    (await tx.query('select * from public.v_mission_board where mission_id = $1 and profile_id = $2', [mission.id, memberB])).rows[0])
  assert.equal(board.is_completed, true)
  assert.equal(num(board.progress_value), 1)
  const me = await t.asUser(memberB, async (tx) =>
    (await tx.query('select pending_earned_spins from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberB, activeSeason.id])).rows[0])
  assert.equal(num(me.pending_earned_spins), 1)
  const vq = await t.asUser(memberB, async (tx) => (await tx.query('select * from public.v_wheel_queue where queue_id = $1', [earnedQueueId])).rows[0])
  assert.equal(vq.source, 'earned')
  assert.equal(vq.wheel_kind, 'premium')
})

test('14.3.3 segunda venda no mesmo período não credita a recompensa de novo nem duplica a fila', async () => {
  await t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberB, p_rule_id: ruleSale.id, p_quantity: 1, p_amount: 500 })
  const mp = await one('select * from public.mission_progress where mission_id = $1 and profile_id = $2', [mission.id, memberB])
  assert.equal(num(mp.value), 2, 'progresso continua contando')
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'mission'", [memberB]), 1, 'recompensa só uma vez')
  assert.equal(await countRows("select 1 from public.wheel_queue where profile_id = $1 and source = 'earned'", [memberB]), 1, 'uma entrada earned')
  assert.equal(num((await seasonStats(memberB, activeSeason.id)).missions_completed), 1)
  // ledger fecha com as stats: venda 1 (200, evento 2x) + conquista 1ª venda (50) + missão (50) + venda 2 (200)
  const sum = await one("select sum(points)::int as points, sum(coins)::int as coins from public.point_entries where profile_id = $1 and season_id = $2", [memberB, activeSeason.id])
  assert.equal(num(sum.points), 500)
  assert.equal(num(sum.coins), 300)
  assert.equal(num((await seasonStats(memberB, activeSeason.id)).points), 500)
})

// =============================================================================
// 14.4 Gestor libera a vez e aprova o giro
// =============================================================================
let manualQueueId, spinId
// Roleta ativa exige ≥ 2 prêmios ativos (MIN_PRIZES, §4.22): dois setores com o MESMO
// prêmio deixam o sorteio (CSPRNG) determinístico em kind/valor e ainda exercitam sector_index.
const setPrizePair = (label, kind, value) =>
  t.rpcRow(admin, 'save_wheel_prizes', {
    p_wheel_kind: 'classic',
    p_prizes: [{ label, kind, value, weight: 1, sort_order: 0 }, { label, kind, value, weight: 1, sort_order: 1 }],
  })

test('14.4.1 enqueue_wheel manual (classic, 2 tentativas); duplicata recusada; girar sem vez liberada falha', async () => {
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberA, p_wheel_kind: 'classic', p_attempts: 2 })
  manualQueueId = q.id
  assert.equal(q.status, 'waiting')
  assert.equal(q.source, 'manual')
  assert.equal(num(q.attempts_allowed), 2)
  assert.equal(q.person_name, 'Membro A')
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberA, p_wheel_kind: 'classic', p_attempts: 1 }), 'ALREADY_IN_QUEUE')
  await expectError(t.rpcRow(memberA, 'enqueue_wheel', { p_profile_id: memberA }), 'NOT_ADMIN')
  await expectError(t.rpc(memberA, 'spin_wheel', { p_queue_id: manualQueueId }), 'NO_ACTIVE_TURN')

  // prêmio único e determinístico para o teste: o servidor "sorteia" 100 pontos
  await expectError(
    t.rpcRow(admin, 'save_wheel_prizes', { p_wheel_kind: 'classic', p_prizes: [{ label: 'só um', kind: 'points', value: 1, sort_order: 0 }] }),
    'MIN_PRIZES',
  )
  const prizes = await setPrizePair('100 pontos', 'points', 100)
  assert.equal(prizes.length, 2)
})

test('14.4.2 release_turn: só uma vez ativa por vez, released_at e notificação "Sua vez na roleta!"', async () => {
  const [q] = await t.rpcRow(admin, 'release_turn', { p_queue_id: manualQueueId })
  assert.equal(q.status, 'active')
  assert.ok(q.released_at)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Sua vez na roleta!'", [memberA]), 1)
  await expectError(t.rpcRow(admin, 'release_turn', { p_queue_id: manualQueueId }), 'QUEUE_NOT_WAITING')
  await expectError(t.rpcRow(memberA, 'release_turn', { p_queue_id: manualQueueId }), 'NOT_ADMIN')

  // liberar outra entrada devolve a anterior para waiting
  await t.rpcRow(admin, 'release_turn', { p_queue_id: earnedQueueId })
  assert.equal((await one('select status from public.wheel_queue where id = $1', [manualQueueId])).status, 'waiting')
  assert.equal((await one('select status from public.wheel_queue where id = $1', [earnedQueueId])).status, 'active')
  await t.rpcRow(admin, 'release_turn', { p_queue_id: manualQueueId })
  assert.equal((await one('select status, released_at from public.wheel_queue where id = $1', [earnedQueueId])).status, 'waiting')
  assert.equal((await one('select status from public.wheel_queue where id = $1', [manualQueueId])).status, 'active')
})

test('14.4.3 spin_wheel: outro membro é barrado (NOT_ALLOWED); o dono da vez gira e recebe prize + sector_index; 2º giro espera aprovação', async () => {
  await expectError(t.rpc(memberB, 'spin_wheel', { p_queue_id: manualQueueId }), 'NOT_ALLOWED')
  assert.equal(await countRows('select 1 from public.wheel_spins'), 0)

  const r = await t.rpc(memberA, 'spin_wheel', { p_queue_id: manualQueueId })
  spinId = r.spin_id
  assert.ok(spinId)
  assert.equal(r.queue_id, manualQueueId)
  assert.equal(r.wheel_kind, 'classic')
  assert.equal(r.prize.kind, 'points')
  assert.equal(num(r.prize.value), 100)
  assert.equal(r.resolved_prize.id, r.prize.id)
  assert.equal(num(r.sector_count), 2)
  const order = (await t.sql("select p.id from public.wheel_prizes p join public.wheels w on w.id = p.wheel_id where w.kind = 'classic' and p.is_active and p.deleted_at is null order by p.sort_order, p.id")).rows.map((x) => x.id)
  assert.equal(num(r.sector_index), order.indexOf(r.prize.id), 'sector_index = posição do prêmio na lista ordenada')
  assert.ok(r.prizes_hash)
  assert.equal(num(r.attempt_index), 1)
  assert.equal(num(r.attempts_allowed), 2)

  const s = await one('select * from public.wheel_spins where id = $1', [spinId])
  assert.equal(s.status, 'pending')
  assert.equal(s.spun_by, memberA)
  assert.equal(s.prize_kind, 'points')
  assert.equal(s.prizes_hash, r.prizes_hash)
  assert.ok(s.random_value !== null)
  await expectError(t.rpc(memberA, 'spin_wheel', { p_queue_id: manualQueueId }), 'SPIN_PENDING')
  await expectError(t.rpcRow(admin, 'release_turn', { p_queue_id: earnedQueueId }), 'SPIN_PENDING')
  await expectError(t.rpc(memberA, 'approve_spin', { p_spin_id: spinId }), 'NOT_ADMIN')
  // v_wheel_queue mostra o giro pendente
  const vq = await t.asUser(admin, async (tx) => (await tx.query('select * from public.v_wheel_queue where queue_id = $1', [manualQueueId])).rows[0])
  assert.equal(vq.pending_spin_id, spinId)
  assert.equal(vq.pending_prize_kind, 'points')
})

test('14.4.4 reject_spin: giro rejected, tentativa não consumida, vez continua active; nada creditado', async () => {
  const before = await countRows('select 1 from public.point_entries where profile_id = $1', [memberA])
  const r = await t.rpc(admin, 'reject_spin', { p_spin_id: spinId })
  assert.equal(r.spin.status, 'rejected')
  assert.equal(r.spin.credited, false)
  assert.equal(num(r.queue.attempts_used), 0)
  assert.equal(r.queue.status, 'active')
  assert.equal(await countRows('select 1 from public.point_entries where profile_id = $1', [memberA]), before)
  await expectError(t.rpc(admin, 'reject_spin', { p_spin_id: spinId }), 'SPIN_NOT_PENDING')
  await expectError(t.rpc(admin, 'approve_spin', { p_spin_id: spinId }), 'SPIN_NOT_PENDING')
})

test('14.4.5 approve_spin (prêmio points): entry source=wheel +100/0, credited, tentativa consumida, vez continua (1 de 2)', async () => {
  const r = await t.rpc(memberA, 'spin_wheel', { p_queue_id: manualQueueId })
  spinId = r.spin_id
  assert.equal(num(r.attempt_index), 1, 'giro rejeitado não consumiu tentativa')
  const statsBefore = await seasonStats(memberA, activeSeason.id)

  const a = await t.rpc(admin, 'approve_spin', { p_spin_id: spinId })
  assert.equal(a.spin.status, 'approved')
  assert.equal(a.spin.credited, true)
  assert.ok(a.spin.entry_id)
  assert.equal(a.spin.redemption_id, null)
  assert.equal(num(a.queue.attempts_used), 1)
  assert.equal(num(a.queue.attempts_allowed), 2)
  assert.equal(a.queue.status, 'active')

  const e = await one('select * from public.point_entries where id = $1', [a.spin.entry_id])
  assert.equal(e.source, 'wheel')
  assert.equal(e.profile_id, memberA)
  assert.equal(num(e.points), 100)
  assert.equal(num(e.coins), 0)
  assert.equal(e.reason, 'Roleta: 100 pontos')
  assert.equal(e.season_id, activeSeason.id)
  assert.equal(e.created_by, admin)
  const statsAfter = await seasonStats(memberA, activeSeason.id)
  assert.equal(num(statsAfter.points) - num(statsBefore.points), 100)

  assert.equal(await countRows("select 1 from public.feed_events where kind = 'wheel_prize' and profile_id = $1", [memberA]), 1)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Prêmio aprovado'", [memberA]), 1)
  assert.equal(await countRows("select 1 from public.audit_log where action = 'rpc' and table_name = 'approve_spin' and row_id = $1", [spinId]), 1)
  await expectError(t.rpc(admin, 'approve_spin', { p_spin_id: spinId }), 'SPIN_NOT_PENDING')
})

test('14.4.6 approve_spin (prêmio coins): entry 0/+50, última tentativa esgota → fila done com finished_at', async () => {
  // sem spin pendente o gestor pode trocar os prêmios; com pendente seria SPIN_PENDING
  await setPrizePair('50 moedas', 'coins', 50)
  const coinsBefore = num((await one('select coins_balance from public.profile_lifetime_stats where profile_id = $1', [memberA])).coins_balance)

  // o gestor também pode girar pela pessoa (TV)
  const r = await t.rpc(admin, 'spin_wheel', { p_queue_id: manualQueueId })
  assert.equal(num(r.attempt_index), 2)
  assert.equal(r.prize.kind, 'coins')
  await expectError(setPrizePair('x', 'points', 1), 'SPIN_PENDING')

  const a = await t.rpc(admin, 'approve_spin', { p_spin_id: r.spin_id })
  assert.equal(a.spin.credited, true)
  assert.equal(num(a.queue.attempts_used), 2)
  assert.equal(a.queue.status, 'done')
  const e = await one('select * from public.point_entries where id = $1', [a.spin.entry_id])
  assert.equal(e.source, 'wheel')
  assert.equal(num(e.points), 0)
  assert.equal(num(e.coins), 50)
  const q = await one('select * from public.wheel_queue where id = $1', [manualQueueId])
  assert.equal(q.status, 'done')
  assert.ok(q.finished_at)
  const coinsAfter = num((await one('select coins_balance from public.profile_lifetime_stats where profile_id = $1', [memberA])).coins_balance)
  assert.equal(coinsAfter - coinsBefore, 50)
  const me = await t.asUser(memberA, async (tx) =>
    (await tx.query('select coins_balance from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberA, activeSeason.id])).rows[0])
  assert.equal(num(me.coins_balance), coinsAfter)

  // fila encerrada: não gira mais nem volta a ser liberada
  await expectError(t.rpc(memberA, 'spin_wheel', { p_queue_id: manualQueueId }), 'NO_ACTIVE_TURN')
  // SQL fixer r1: entrada já `done` → QUEUE_NOT_WAITING (§7.6 passo 5 lista o status antes das tentativas;
  // ATTEMPTS_EXHAUSTED só vale para entrada ainda `waiting` com tentativas esgotadas — coberto em views.test "release_turn").
  await expectError(t.rpcRow(admin, 'release_turn', { p_queue_id: manualQueueId }), 'QUEUE_NOT_WAITING')
  // histórico: 1 rejeitado + 2 aprovados
  const hist = await t.asUser(admin, async (tx) =>
    (await tx.query("select status, count(*)::int as n from public.wheel_spins where queue_id = $1 group by status order by status", [manualQueueId])).rows)
  assert.deepEqual(hist.map((h) => [h.status, num(h.n)]), [['approved', 2], ['rejected', 1]])
})

test('14.4.7 spin_wheel_free: sorteia sem gravar nem creditar; pendente/anon não giram', async () => {
  const spinsBefore = await countRows('select 1 from public.wheel_spins')
  const entriesBefore = await countRows('select 1 from public.point_entries')
  const r = await t.rpc(memberB, 'spin_wheel_free', { p_wheel_kind: 'classic' })
  assert.equal(r.is_free, true)
  assert.equal(r.prize.kind, 'coins')
  assert.equal(num(r.sector_count), 2)
  assert.equal(r.spin_id, undefined)
  assert.equal(await countRows('select 1 from public.wheel_spins'), spinsBefore)
  assert.equal(await countRows('select 1 from public.point_entries'), entriesBefore)
  assert.equal(await countRows("select 1 from public.point_entries where source = 'wheel' and profile_id = $1", [memberB]), 0)

  // roleta premium (seed completo) também sorteia; Mystery Box resolve para um prêmio comum
  const p = await t.rpc(memberB, 'spin_wheel_free', { p_wheel_kind: 'premium' })
  assert.equal(num(p.sector_count), 8)
  assert.ok(!['mystery', 'extra_spin'].includes(p.resolved_prize.kind) || p.prize.kind === 'extra_spin')
  await expectError(t.rpc(null, 'spin_wheel_free', { p_wheel_kind: 'classic' }, 'anon'), /permission denied|NOT_ACTIVE_MEMBER|PROFILE_INACTIVE/)
})

test('14.4.8 giro ganho pela missão (premium, seed completo): aprovação credita conforme resolved_kind e zera pending_earned_spins', async () => {
  await t.rpcRow(admin, 'release_turn', { p_queue_id: earnedQueueId })
  const r = await t.rpc(memberB, 'spin_wheel', { p_queue_id: earnedQueueId })
  assert.equal(r.wheel_kind, 'premium')
  assert.equal(num(r.sector_count), 8)
  const a = await t.rpc(admin, 'approve_spin', { p_spin_id: r.spin_id })
  const s = await one('select * from public.wheel_spins where id = $1', [r.spin_id])
  assert.equal(s.status, 'approved')
  const kind = s.resolved_kind
  assert.ok(!['mystery'].includes(kind), 'Mystery Box sempre resolvida')
  if (kind === 'points' || kind === 'coins') {
    const e = await one('select * from public.point_entries where id = $1', [a.spin.entry_id])
    assert.equal(e.source, 'wheel')
    assert.equal(num(kind === 'points' ? e.points : e.coins), num(s.resolved_value))
    assert.equal(num(kind === 'points' ? e.coins : e.points), 0)
  } else if (kind === 'cash' || kind === 'voucher') {
    const rd = await one('select * from public.reward_redemptions where id = $1', [a.spin.redemption_id])
    assert.equal(rd.source, 'wheel')
    assert.equal(rd.status, 'approved')
    assert.equal(rd.profile_id, memberB)
    assert.equal(num(rd.value_amount), num(s.resolved_value))
    assert.equal(num(rd.cost_coins), 0)
  } else if (kind === 'multiplier') {
    const b = await one('select * from public.profile_boosts where id = $1', [a.spin.boost_id])
    assert.equal(b.profile_id, memberB)
    assert.equal(num(b.multiplier), num(s.resolved_value))
  } else if (kind === 'extra_spin') {
    assert.equal(num(a.queue.attempts_allowed), 2)
    assert.equal(a.queue.status, 'active', 'giro extra mantém a vez')
  }
  assert.equal(a.spin.credited, true)
  if (kind !== 'extra_spin') {
    assert.equal(a.queue.status, 'done')
    assert.equal(num(a.queue.attempts_used), 1)
  }
  const me = await t.asUser(memberB, async (tx) =>
    (await tx.query('select pending_earned_spins from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberB, activeSeason.id])).rows[0])
  assert.equal(num(me.pending_earned_spins), 0)
})
