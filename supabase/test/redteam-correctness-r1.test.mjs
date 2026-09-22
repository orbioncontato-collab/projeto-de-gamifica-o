// RED TEAM round 1 — CORRETUDE. Casos de borda do DATA-MODEL (§5, §6, §7, §9, §14, Apêndice B e D)
// que os testes de fluxo não cobrem: empates de ranking, nível com pontos ≤ 0, dívida de moedas,
// streak na virada do dia local, conversão sem reuniões, meta sem ritmo, temporada sem lançamento,
// roleta sem prêmios / pesos / mystery / giro extra / multiplicador, boost × evento (máximo, não
// produto), fila (B.23), período de missão, duelo com 2, inativação (B.17), retroatividade,
// fuso travado, EXCLUDE de temporadas e recompute_stats.
// Um único banco PGlite; os testes rodam em ordem. Contas são rótulos técnicos, não pessoas.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectError, num } from './pglite-harness.mjs'

let t
let teamCode, admin, memberA, memberB, memberC, memberD, activeSeason, prevSeason
let ruleSale, ruleCall, ruleMeetingHeld, ruleMeetingScheduled, wheelClassic, wheelPremium

const one = async (text, params = []) => (await t.sql(text, params)).rows[0]
const rows = async (text, params = []) => (await t.sql(text, params)).rows
const countRows = async (text, params = []) =>
  Number((await t.sql(`select count(*)::int as n from (${text}) x`, params)).rows[0].n)
const seasonStats = (profileId, seasonId) =>
  one('select * from public.profile_season_stats where profile_id = $1 and season_id = $2', [profileId, seasonId])
const lifetime = (profileId) =>
  one('select *, streak_last_day::text as streak_last_day_text, first_sale_at::text as first_sale_at_text from public.profile_lifetime_stats where profile_id = $1', [profileId])
const ledgerCoins = async (profileId) =>
  num((await one('select coalesce(sum(coins), 0)::int as c from public.point_entries where profile_id = $1', [profileId])).c)
const profileStats = (profileId, seasonId) =>
  one('select * from public.v_profile_stats where profile_id = $1 and season_id = $2', [profileId, seasonId])
const iso = (d) => new Date(d).toISOString()
const hoursFromNow = (h) => iso(Date.now() + h * 3600 * 1000)
const daysFromNow = (d) => iso(Date.now() + d * 86400 * 1000)
const manual = (profileId, points, reason, coins = null) =>
  t.rpcRow(admin, 'record_manual_entry', { p_profile_id: profileId, p_points: points, p_reason: reason, p_coins: coins })
const ruleEntry = (profileId, rule, extra = {}) =>
  t.rpcRow(admin, 'record_rule_entry', { p_profile_id: profileId, p_rule_id: rule.id, p_quantity: 1, ...extra })
const sale = (profileId, amount, extra = {}) => ruleEntry(profileId, ruleSale, { p_amount: amount, ...extra })
const setPrizes = (wheelKind, prizes) =>
  t.rpcRow(admin, 'save_wheel_prizes', {
    p_wheel_kind: wheelKind,
    p_prizes: prizes.map((p, i) => ({ weight: 1, sort_order: i, ...p })),
  })
const pair = (label, kind, value) => [{ label, kind, value }, { label, kind, value }]
// Um giro completo (enqueue → release → spin → approve) para um perfil ou convidado.
// wantKind: rejeita (sem consumir tentativa) até sair o tipo desejado — para roletas com pool obrigatório.
const spinUntil = async (queueId, wantKind) => {
  for (let i = 0; i < 30; i++) {
    const spin = await t.rpc(admin, 'spin_wheel', { p_queue_id: queueId })
    if (!wantKind || spin.resolved_prize.kind === wantKind) return spin
    await t.rpc(admin, 'reject_spin', { p_spin_id: spin.spin_id })
  }
  throw new Error('não saiu ' + wantKind + ' em 30 giros')
}
const fullSpin = async ({ profileId = null, personName = null, wheelKind = 'classic', attempts = 1, wantKind = null }) => {
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', {
    p_profile_id: profileId, p_person_name: personName, p_wheel_kind: wheelKind, p_attempts: attempts,
  })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const spin = await spinUntil(q.id, wantKind)
  const approved = await t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id })
  return { queue: q, spin, approved }
}

before(async () => {
  t = await createTestDb()
  teamCode = (await one('select team_code from public.app_secrets where id = 1')).team_code
  activeSeason = await one('select * from public.seasons where is_active')
  ruleSale = await one("select * from public.point_rules where name = 'Venda realizada' and deleted_at is null")
  ruleCall = await one("select * from public.point_rules where name = 'Ligação realizada' and deleted_at is null")
  ruleMeetingHeld = await one("select * from public.point_rules where name = 'Reunião realizada' and deleted_at is null")
  ruleMeetingScheduled = await one("select * from public.point_rules where name = 'Reunião agendada' and deleted_at is null")
  wheelClassic = await one("select * from public.wheels where kind = 'classic'")
  wheelPremium = await one("select * from public.wheels where kind = 'premium'")
  assert.ok(activeSeason && ruleSale && ruleCall && ruleMeetingHeld && ruleMeetingScheduled && wheelClassic && wheelPremium)

  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  await t.rpcRow(admin, 'update_app_settings', { p_patch: { auto_approve_members: true } })
  memberA = await t.createAuthUser({ email: 'membro-a@teste.local', metadata: { team_code: teamCode, full_name: 'Membro A' } })
  memberB = await t.createAuthUser({ email: 'membro-b@teste.local', metadata: { team_code: teamCode, full_name: 'Membro B' } })
  memberC = await t.createAuthUser({ email: 'membro-c@teste.local', metadata: { team_code: teamCode, full_name: 'Membro C' } })
  memberD = await t.createAuthUser({ email: 'membro-d@teste.local', metadata: { team_code: teamCode, full_name: 'Membro D' } })
  assert.equal(await countRows("select 1 from public.profiles where status = 'active'"), 5)

  // temporada do mês anterior (não fechada) — alvo do fechamento "sem lançamentos" e do lançamento retroativo
  const prev = await one(`
    select (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date as starts_on,
           (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 day')::date as ends_on`)
  ;[prevSeason] = await t.rpcRow(admin, 'create_season', { p_name: 'Temporada anterior', p_starts_on: prev.starts_on, p_ends_on: prev.ends_on })
  assert.equal(prevSeason.is_active, false)
})
after(async () => t?.close())

// =============================================================================
// 1. Temporada sem lançamentos + ranking com zeros (§5.1/§5.2/§5.3/§5.5)
// =============================================================================
test('temporada sem lançamentos: v_team_stats zerada, ranking sem has_points, timeline vazia para temporada futura', async () => {
  const team = await one('select * from public.v_team_stats where season_id = $1', [activeSeason.id])
  assert.equal(num(team.sales_amount), 0)
  assert.equal(num(team.points_total), 0)
  assert.equal(team.attainment_pct, null, 'team_goal_amount = 0 → attainment_pct NULL')
  assert.equal(team.avg_conversion_pct, null, 'ninguém com reunião realizada → NULL')
  assert.equal(team.attendance_pct, null)
  assert.equal(num(team.crm_pct), 0)
  assert.equal(num(team.active_count), 5)
  assert.equal(num(team.queue_count), 0)

  const ranking = await rows('select * from public.v_ranking where season_id = $1 order by rank', [activeSeason.id])
  assert.equal(ranking.length, 5, 'rank_admins=true: 4 membros + gestor')
  assert.ok(ranking.every((r) => r.has_points === false && num(r.points) === 0 && num(r.level) === 0))
  assert.equal(ranking[0].gap_to_above, null, 'líder: gap NULL')
  assert.equal(ranking[0].is_tied_with_above, false, 'líder nunca é "empatado com o de cima"')
  assert.ok(ranking.slice(1).every((r) => num(r.gap_to_above) === 0 && r.is_tied_with_above === true))

  // temporada futura (mês que vem) → sem linha na timeline (generate_series vazio) e ranking zerado
  const next = await one(`
    select (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month')::date as starts_on,
           (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 month' - interval '1 day')::date as ends_on`)
  const [future] = await t.rpcRow(admin, 'create_season', { p_name: 'Temporada futura', p_starts_on: next.starts_on, p_ends_on: next.ends_on })
  assert.equal(await countRows('select 1 from public.v_sales_timeline where season_id = $1', [future.id]), 0)
  assert.equal(await countRows('select 1 from public.v_ranking where season_id = $1', [future.id]), 5)
  assert.equal(num((await one('select total_count from public.v_team_stats where season_id = $1', [future.id])).total_count), 5)
  // ativar antes do início → SEASON_NOT_STARTED (B.20)
  await expectError(t.rpcRow(admin, 'activate_season', { p_season_id: future.id }), 'SEASON_NOT_STARTED')
  await expectError(t.rpc(admin, 'close_season', { p_season_id: future.id }), 'SEASON_NOT_STARTED')
})

test('EXCLUDE de temporadas: sobreposição parcial, contida e por 1 segundo falham; adjacente passa; insert direto dá 23P01', async () => {
  const s = await one('select * from public.seasons where id = $1', [activeSeason.id])
  const days = await one(`
    select public.local_day($1::timestamptz) as starts_on,
           public.local_day($2::timestamptz - interval '1 second') as ends_on`, [s.starts_at, s.ends_at])
  // mesma janela
  await expectError(t.rpcRow(admin, 'create_season', { p_name: 'Dup', p_starts_on: days.starts_on, p_ends_on: days.ends_on }), 'SEASON_OVERLAP')
  // 1 dia dentro (contida)
  await expectError(t.rpcRow(admin, 'create_season', { p_name: 'Dentro', p_starts_on: days.ends_on, p_ends_on: days.ends_on }), 'SEASON_OVERLAP')
  // datas invertidas
  await expectError(t.rpcRow(admin, 'create_season', { p_name: 'Inv', p_starts_on: days.ends_on, p_ends_on: days.starts_on }), 'SEASON_RANGE_INVALID')
  // insert direto (postgres) sobrepondo por 1 segundo → exclusion_violation
  const err = await expectError(
    t.sql(`insert into public.seasons (name, starts_at, ends_at, xp_per_level)
           values ('Direto', $1::timestamptz - interval '1 second', $1::timestamptz + interval '1 second', 400)`, [s.ends_at]),
    /conflicting key value violates exclusion constraint|seasons_no_overlap/i,
  )
  assert.equal(err.code, '23P01')
  // adjacente exata (fim exclusivo) passa e é removida em seguida para não afetar os próximos testes
  const nextMonth = await one(`
    select (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 month')::date as starts_on,
           (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 month')::date as ends_on`)
  const [adj] = await t.rpcRow(admin, 'create_season', { p_name: 'Adjacente', p_starts_on: nextMonth.starts_on, p_ends_on: nextMonth.ends_on })
  assert.ok(adj.id)
  assert.equal(await countRows('select 1 from public.seasons'), 4)
})

// =============================================================================
// 2. Ranking: empates, gap_to_above do líder, desempate por points_updated_at (§5.1, D.40)
// =============================================================================
test('empate: mesmos pontos e vendas → posições distintas, gap 0, is_tied_with_above; líder com gap NULL; desempate por quem chegou antes', async () => {
  // membro-b chega primeiro aos 300, depois membro-a: B fica na frente (points_updated_at asc)
  await manual(memberB, 300, 'Ajuste de teste (300)')
  await manual(memberA, 300, 'Ajuste de teste (300)')
  await manual(memberC, 100, 'Ajuste de teste (100)')
  const ranking = await rows('select * from public.v_ranking where season_id = $1 order by rank', [activeSeason.id])
  assert.deepEqual(ranking.slice(0, 3).map((r) => r.profile_id), [memberB, memberA, memberC])
  assert.equal(ranking[0].gap_to_above, null)
  assert.equal(ranking[0].is_tied_with_above, false)
  assert.equal(ranking[0].has_points, true)
  assert.equal(num(ranking[1].gap_to_above), 0)
  assert.equal(ranking[1].is_tied_with_above, true)
  assert.equal(num(ranking[2].gap_to_above), 200)
  assert.equal(ranking[2].is_tied_with_above, false)
  assert.deepEqual(ranking.map((r) => num(r.rank)), [1, 2, 3, 4, 5])

  // estorno da entry de B não mexe no desempate (points_updated_at só sobe com pontos positivos não estornados)
  const bEntry = await one("select id from public.point_entries where profile_id = $1 and source = 'manual' order by created_at limit 1", [memberB])
  const before = (await seasonStats(memberB, activeSeason.id)).points_updated_at
  await t.rpcRow(admin, 'reverse_entry', { p_entry_id: bEntry.id, p_reason: 'estorno de teste' })
  const after = await seasonStats(memberB, activeSeason.id)
  assert.equal(num(after.points), 0)
  assert.equal(String(after.points_updated_at), String(before), 'estorno não altera points_updated_at')
  const top = await one('select profile_id from public.v_ranking where season_id = $1 and rank = 1', [activeSeason.id])
  assert.equal(top.profile_id, memberA)
})

test('rank_admins=false: gestor sai do ranking (rank NULL em v_profile_stats) e o gap do 2º passa a ser contra o novo 1º', async () => {
  await manual(admin, 1000, 'Gestor também vende (teste)')
  let top = await one('select profile_id from public.v_ranking where season_id = $1 and rank = 1', [activeSeason.id])
  assert.equal(top.profile_id, admin)
  await t.rpcRow(admin, 'update_app_settings', { p_patch: { rank_admins: false } })
  const adminRow = await profileStats(admin, activeSeason.id)
  assert.equal(adminRow.rank, null)
  assert.equal(adminRow.gap_to_above, null)
  assert.equal(adminRow.is_tied_with_above, false)
  top = await one('select profile_id, gap_to_above from public.v_ranking where season_id = $1 and rank = 1', [activeSeason.id])
  assert.equal(top.profile_id, memberA)
  assert.equal(top.gap_to_above, null)
  assert.equal(await countRows('select 1 from public.v_ranking where season_id = $1', [activeSeason.id]), 4)
  await t.rpcRow(admin, 'update_app_settings', { p_patch: { rank_admins: true } })
})

// =============================================================================
// 3. Nível/XP com 0 e negativo (§5.1, B.2) — nunca nível negativo, xp_to_next nunca > xp_per_level
// =============================================================================
test('nível/XP: 0 pontos → nível 0 e xp_to_next = xp_per_level; pontos negativos → nível 0 (greatest); 400 → nível 1 com xp_in_level 0', async () => {
  const zero = await profileStats(memberD, activeSeason.id)
  assert.equal(num(zero.points), 0)
  assert.equal(num(zero.level), 0)
  assert.equal(num(zero.xp_in_level), 0)
  assert.equal(num(zero.xp_to_next), num(zero.xp_per_level))

  // -150 → pontos negativos; moedas default 0 no ajuste negativo (B.3)
  const [neg] = await manual(memberD, -150, 'Ajuste negativo de teste')
  assert.equal(num(neg.points), -150)
  assert.equal(num(neg.coins), 0)
  const negStats = await profileStats(memberD, activeSeason.id)
  assert.equal(num(negStats.points), -150)
  assert.equal(num(negStats.level), 0, 'nível nunca negativo')
  assert.equal(num(negStats.xp_in_level), 0)
  assert.equal(num(negStats.xp_to_next), 400)
  assert.equal(negStats.has_points, false)
  assert.ok(num(negStats.rank) >= 1, 'negativo continua ranqueado (último)')
  const last = await one('select profile_id from public.v_ranking where season_id = $1 order by rank desc limit 1', [activeSeason.id])
  assert.equal(last.profile_id, memberD)
  // notificação de ajuste negativo (§6.7 E)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Ajuste de pontos'", [memberD]), 1)

  // +550 → 400 líquido → nível 1 exato, xp_in_level 0, xp_to_next 400
  await manual(memberD, 550, 'Ajuste positivo de teste')
  const lvl = await profileStats(memberD, activeSeason.id)
  assert.equal(num(lvl.points), 400)
  assert.equal(num(lvl.level), 1)
  assert.equal(num(lvl.xp_in_level), 0)
  assert.equal(num(lvl.xp_to_next), 400)
  // feed de level_up 0→1 uma vez (D)
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'level_up' and profile_id = $1", [memberD]), 1)
  // limites do ajuste manual
  await expectError(manual(memberD, 0, 'zero'), 'POINTS_INVALID')
  await expectError(manual(memberD, 100001, 'demais'), 'POINTS_INVALID')
  await expectError(manual(memberD, 10, 'ab'), 'REASON_REQUIRED')
})

// =============================================================================
// 4. Conversão com zero reuniões; teto 999.99; meta sem ritmo (§5.1 regra transversal, D.28, D.38)
// =============================================================================
test('conversion_pct/attendance_pct NULL sem reuniões; 11 vendas em 1 reunião → 999.99 (teto), não estoura a view', async () => {
  const before = await profileStats(memberC, activeSeason.id)
  assert.equal(before.conversion_pct, null)
  assert.equal(before.attendance_pct, null)
  await ruleEntry(memberC, ruleMeetingHeld)
  for (let i = 0; i < 11; i++) await sale(memberC, 100)
  const st = await profileStats(memberC, activeSeason.id)
  assert.equal(num(st.meetings_held), 1)
  assert.equal(num(st.sales_count), 11)
  assert.equal(num(st.conversion_pct), 999.99)
  assert.equal(st.attendance_pct, null, 'meetings_scheduled = 0 → NULL mesmo com reunião realizada')
  await ruleEntry(memberC, ruleMeetingScheduled)
  const st2 = await profileStats(memberC, activeSeason.id)
  assert.equal(num(st2.attendance_pct), 100)
  const team = await one('select * from public.v_team_stats where season_id = $1', [activeSeason.id])
  assert.equal(num(team.avg_conversion_pct), 999.99)
  assert.equal(num(team.attendance_pct), 100)
})

test('projected_goal_date: NULL com meta 0, com vendas 0, com meta já batida e com ritmo ínfimo (> 3650 dias); data válida no caso normal', async () => {
  // membro-d: 0 vendas → NULL mesmo com meta
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberD, p_patch: { goal_amount: 50000 } })
  let st = await profileStats(memberD, activeSeason.id)
  assert.equal(num(st.goal_amount), 50000)
  assert.equal(st.projected_goal_date, null, 'sem vendas → sem ritmo')
  assert.equal(num(st.goal_pct), 0, 'meta > 0 e vendas 0 → 0.00 (não NULL)')
  assert.equal(num(st.goal_missing_amount), 50000)

  // membro-c: 1.100 vendidos, meta 0 → NULL; meta 1.000 (já batida) → NULL e goal_pct capado em 999.99? não: 110.00
  st = await profileStats(memberC, activeSeason.id)
  assert.equal(num(st.sales_amount), 1100)
  assert.equal(st.projected_goal_date, null, 'meta 0 → NULL')
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberC, p_patch: { goal_amount: 1000 } })
  st = await profileStats(memberC, activeSeason.id)
  assert.equal(st.projected_goal_date, null, 'meta batida → NULL')
  assert.equal(num(st.goal_pct), 110)
  assert.equal(num(st.goal_missing_amount), 0)

  // ritmo ínfimo: meta de R$ 999.999.999,99 com R$ 1.100 em ≥ 1 dia → dias > 3650 → NULL (não "date out of range")
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberC, p_patch: { goal_amount: 999999999.99 } })
  st = await profileStats(memberC, activeSeason.id)
  assert.equal(st.projected_goal_date, null)
  assert.equal(num(st.goal_pct), 0)

  // caso normal: meta 2.200 com 1.100 vendidos em days_elapsed dias → start + ceil(2200 / (1100/days))
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberC, p_patch: { goal_amount: 2200 } })
  st = await profileStats(memberC, activeSeason.id)
  const expected = await one(`
    select (public.local_day(s.starts_at) + (2 * greatest(least(public.local_today(), public.local_day(s.ends_at - interval '1 second')) - public.local_day(s.starts_at), 1)))::date as d
    from public.seasons s where s.id = $1`, [activeSeason.id])
  assert.equal(String(st.projected_goal_date), String(expected.d))
  assert.equal(num(st.goal_pct), 50)
})

// =============================================================================
// 5. Moedas negativas após estorno de moedas já gastas (B.15, §6.6 3b, §7.7)
// =============================================================================
test('dívida: +500 moedas → resgate que zera o saldo → estorno do crédito → saldo -500 em lifetime, v_wallet e ledger; loja recusa com "faltam custo+500"; cancelar o resgate devolve o custo', async () => {
  const balance0 = await ledgerCoins(memberD)
  const [credit] = await manual(memberD, 10, 'Crédito de moedas (teste)', 500)
  assert.equal(num(credit.coins), 500)
  // recompensa de teste cujo custo consome exatamente o saldo (policy admin)
  const cost = balance0 + 500
  await t.asUser(admin, (tx) => tx.query("insert into public.rewards (name, cost_coins, sort_order) values ('Recompensa teste 500', $1, 99)", [cost]))
  const reward = await one("select * from public.rewards where name = 'Recompensa teste 500'")
  const red = await t.rpc(memberD, 'redeem_reward', { p_reward_id: reward.id })
  assert.equal(num(red.coins_balance), 0)
  assert.equal(await ledgerCoins(memberD), 0)
  assert.equal(num((await lifetime(memberD)).coins_balance), 0)

  // estorno do crédito original → -500 (permitido, B.15)
  const [rev] = await t.rpcRow(admin, 'reverse_entry', { p_entry_id: credit.id, p_reason: 'Crédito indevido' })
  assert.equal(num(rev.coins), -500)
  assert.equal(num(rev.points), -10)
  const lt = await lifetime(memberD)
  assert.equal(num(lt.coins_balance), -500)
  assert.equal(await ledgerCoins(memberD), -500)
  assert.equal(num(lt.coins_earned), balance0, 'estorno desfaz o coins_earned bruto')
  assert.equal(num(lt.coins_spent), cost)
  const wallet = await t.asUser(memberD, async (tx) => (await tx.query('select * from public.v_wallet where profile_id = $1', [memberD])).rows[0])
  assert.equal(num(wallet.coins_balance), -500, 'v_wallet sem greatest(..,0)')
  assert.equal(num(wallet.coins_from_manual), balance0 + 500, 'origens somam só créditos (coins > 0), estorno não subtrai — §5.12')
  const ps = await profileStats(memberD, activeSeason.id)
  assert.equal(num(ps.coins_balance), -500)

  // loja: faltam cost + dívida
  const err = await expectError(t.rpc(memberD, 'redeem_reward', { p_reward_id: reward.id }), 'INSUFFICIENT_COINS')
  assert.match(err.detail, new RegExp('faltam ' + (cost + 500)))
  // estornar o estorno → CANNOT_REVERSE_REVERSAL; estornar de novo a original → ALREADY_REVERSED
  await expectError(t.rpcRow(admin, 'reverse_entry', { p_entry_id: rev.id, p_reason: 'x' }), 'CANNOT_REVERSE_REVERSAL')
  await expectError(t.rpcRow(admin, 'reverse_entry', { p_entry_id: credit.id, p_reason: 'x' }), 'ALREADY_REVERSED')
  // a entry de resgate não se estorna por reverse_entry
  const redemption = await one('select * from public.reward_redemptions where id = $1', [red.redemption_id])
  await expectError(t.rpcRow(admin, 'reverse_entry', { p_entry_id: redemption.entry_id, p_reason: 'x' }), 'USE_HANDLE_REDEMPTION')

  // cancelar o resgate devolve as 500 → saldo 0
  const cancelled = await t.rpcRow(admin, 'handle_redemption', { p_redemption_id: red.redemption_id, p_action: 'cancel', p_notes: 'Teste' })
  assert.equal(cancelled[0].status, 'cancelled')
  assert.ok(cancelled[0].refund_entry_id)
  assert.equal(await ledgerCoins(memberD), balance0, 'saldo volta ao que era antes do crédito estornado')
  assert.equal(num((await lifetime(memberD)).coins_balance), balance0)
  assert.equal(num((await lifetime(memberD)).coins_spent), 0)
  assert.equal(await ledgerCoins(memberD), num((await lifetime(memberD)).coins_balance))
})

// =============================================================================
// 6. Streak na virada da meia-noite em America/Sao_Paulo (§4.9, B.16, §6.2 recompute_streak)
// =============================================================================
test('streak: 23:59 e 00:00 locais (02:59Z/03:00Z) = 2 dias; 20:30 e 21:30 locais em dias UTC diferentes = 1 dia; estorno do 1º dia derruba para 1', async () => {
  // dia local D-3 e D-2 (dentro da temporada corrente, ≥ 90 dias? sim: hoje é dia 15) — usa datas sempre dentro do mês corrente
  const d = await one(`
    select (public.local_today() - 3)::text as d3, (public.local_today() - 2)::text as d2, (public.local_today() - 1)::text as d1,
           (public.local_today() - 3) >= public.local_day($1::timestamptz) as in_month`, [activeSeason.starts_at])
  assert.ok(d.in_month, 'precondição: D-3 ainda no mês corrente (teste roda a partir do dia 4)')
  // 23:59:30 local de D-3 = 02:59:30Z de D-2 ; 00:00:30 local de D-2 = 03:00:30Z de D-2 → mesmo dia UTC, dias locais distintos
  const [e1] = await ruleEntry(memberB, ruleCall, { p_occurred_at: `${d.d3}T23:59:30-03:00` })
  const [e2] = await ruleEntry(memberB, ruleCall, { p_occurred_at: `${d.d2}T00:00:30-03:00` })
  assert.equal(num(e1.points), 5)
  let lt = await lifetime(memberB)
  assert.equal(num(lt.streak_days), 2)
  assert.equal(lt.streak_last_day_text, d.d2)
  // 20:30 e 21:30 locais de D-1 = 23:30Z de D-1 e 00:30Z de D → dias UTC distintos, mesmo dia local
  await ruleEntry(memberB, ruleCall, { p_occurred_at: `${d.d1}T20:30:00-03:00` })
  await ruleEntry(memberB, ruleCall, { p_occurred_at: `${d.d1}T21:30:00-03:00` })
  lt = await lifetime(memberB)
  assert.equal(num(lt.streak_days), 3, 'D-3, D-2, D-1 = 3 dias corridos (D-1 conta 1 só)')
  assert.equal(lt.streak_last_day_text, d.d1)
  assert.equal(num(lt.best_streak_days), 3)
  const ps = await profileStats(memberB, activeSeason.id)
  assert.equal(num(ps.streak_days), 3, 'streak_last_day = ontem → ainda vale na view')

  // estorno da entry de D-3 → ilha vira D-2..D-1 = 2; best continua 3
  await t.rpcRow(admin, 'reverse_entry', { p_entry_id: e1.id, p_reason: 'estorno dia D-3' })
  lt = await lifetime(memberB)
  assert.equal(num(lt.streak_days), 2)
  // §6.2 diz best = max(ilhas) (→ 2); a implementação mantém greatest(antigo, novo) (→ 3). Achado próprio no teste de recompute_streak.
  assert.ok([2, 3].includes(num(lt.best_streak_days)))
  // estornar a de D-2 também (a segunda entry às 00:00:30 ainda mantém D-2)
  await t.rpcRow(admin, 'reverse_entry', { p_entry_id: e2.id, p_reason: 'estorno dia D-2' })
  lt = await lifetime(memberB)
  assert.equal(num(lt.streak_days), 1, 'só D-1 sobra')
  // mission_period diária na virada: 02:59Z cai no dia local anterior
  const per = await rows(`select * from public.mission_period('daily', ($1 || 'T02:59:00Z')::timestamptz, ($2 || 'T00:00:00-03:00')::timestamptz, now() + interval '1 day')`, [d.d2, d.d3])
  assert.equal(per.length, 1)
  assert.equal(per[0].period_key, d.d3, 'chave diária = dia local, não UTC')
})

// =============================================================================
// 7. Roleta: todos os prêmios inativos, pool sem prêmio comum, pesos (§4.22, §6.2 draw_prize, D.27)
// =============================================================================
test('roleta com todos os prêmios inativos → MIN_PRIZES no commit; só 1 ativo → MIN_PRIZES; só mystery+extra_spin ativos → MYSTERY_NEEDS_POOL; catálogo do seed intacto', async () => {
  const before = await countRows("select 1 from public.wheel_prizes where wheel_id = $1 and deleted_at is null and is_active", [wheelClassic.id])
  assert.equal(before, 6)
  await expectError(setPrizes('classic', [
    { label: 'A', kind: 'points', value: 10, is_active: false }, { label: 'B', kind: 'points', value: 20, is_active: false },
  ]), 'MIN_PRIZES')
  await expectError(setPrizes('classic', [{ label: 'A', kind: 'points', value: 10 }, { label: 'B', kind: 'points', value: 20, is_active: false }]), 'MIN_PRIZES')
  await expectError(setPrizes('classic', [{ label: 'Mistério', kind: 'mystery' }, { label: 'Extra', kind: 'extra_spin' }]), 'MYSTERY_NEEDS_POOL')
  await expectError(setPrizes('classic', [{ label: 'A', kind: 'points', value: 10, sort_order: 3 }, { label: 'B', kind: 'points', value: 20, sort_order: 3 }]), 'SORT_ORDER_DUPLICATE')
  // Nota de implementação: peso fora de [1, 1000] → INVALID_ARGUMENT (P0001, detail cita a constraint) — §9 exige que toda
  // escrita via RPC devolva código do catálogo; o 23514 cru que esta assertiva esperava não vinha do catálogo (DATA-MODEL §9).
  const err = await expectError(setPrizes('classic', [{ label: 'A', kind: 'points', value: 10, weight: 0 }, { label: 'B', kind: 'points', value: 20 }]), 'INVALID_ARGUMENT')
  assert.equal(err.code, 'P0001')
  assert.match(err.detail ?? '', /weight/i)
  // tudo abortou: o seed continua íntegro (6 ativos, nenhum deletado)
  assert.equal(await countRows("select 1 from public.wheel_prizes where wheel_id = $1 and deleted_at is null and is_active", [wheelClassic.id]), 6)
  assert.equal(await countRows("select 1 from public.wheel_prizes where wheel_id = $1 and deleted_at is not null", [wheelClassic.id]), 0)
  // giro livre continua funcionando com o seed
  const free = await t.rpc(memberA, 'spin_wheel_free', { p_wheel_kind: 'classic' })
  assert.equal(free.is_free, true)
  assert.equal(num(free.sector_count), 6)
})

test('pesos: 1000 × 1 → o pesado sai em ≥ 95% de 200 giros livres; peso não ativo nunca sai; random_value < soma dos pesos', async () => {
  await setPrizes('classic', [
    { label: 'Pesado', kind: 'points', value: 10, weight: 1000 },
    { label: 'Leve', kind: 'points', value: 20, weight: 1 },
    { label: 'Inativo', kind: 'points', value: 30, weight: 1000, is_active: false },
  ])
  const counts = { Pesado: 0, Leve: 0, Inativo: 0 }
  for (let i = 0; i < 200; i++) {
    const r = await t.rpc(memberA, 'spin_wheel_free', { p_wheel_kind: 'classic' })
    counts[r.prize.label]++
    assert.equal(r.sector_count, 2, 'prêmio inativo não conta como setor')
    assert.ok(r.sector_index === 0 || r.sector_index === 1)
  }
  assert.equal(counts.Inativo, 0)
  assert.ok(counts.Pesado >= 190, `pesado saiu ${counts.Pesado}/200`)
  // draw_prize direto (postgres): random_value sempre em [0, 1001)
  const draws = await rows('select (d).random_value as rv, ((d).prize).label as label from (select private.draw_prize($1, \'{}\') as d from generate_series(1, 50)) x', [wheelClassic.id])
  assert.ok(draws.every((d) => num(d.rv) >= 0 && num(d.rv) < 1001))
  // roleta sem prêmio ativo (estado só alcançável por fora dos triggers — replica mode) → NO_PRIZES, não divide por zero
  const bypass = (sqlText) => t.db.transaction(async (tx) => {
    await tx.exec('set local session_replication_role = replica')
    await tx.query(sqlText, [wheelClassic.id])
  })
  await bypass('update public.wheel_prizes set is_active = false where wheel_id = $1 and deleted_at is null')
  assert.equal(await countRows('select 1 from public.wheel_prizes where wheel_id = $1 and is_active and deleted_at is null', [wheelClassic.id]), 0)
  await expectError(t.sql("select private.draw_prize($1, '{}')", [wheelClassic.id]), 'NO_PRIZES')
  await expectError(t.rpc(memberA, 'spin_wheel_free', { p_wheel_kind: 'classic' }), 'NO_PRIZES')
  await bypass("update public.wheel_prizes set is_active = true where wheel_id = $1 and deleted_at is null and label in ('Pesado', 'Leve')")
})

// =============================================================================
// 8. Mystery box, extra_spin (livre e convidado), multiplier → profile_boosts (§7.6, B.9)
// =============================================================================
test('mystery: prêmio sorteado mystery resolve para um prêmio comum (nunca mystery/extra_spin); aprovação credita o resolvido', async () => {
  await setPrizes('premium', [
    { label: 'Mistério', kind: 'mystery', weight: 1000 },
    { label: 'Extra', kind: 'extra_spin', weight: 1000 },
    { label: '70 pontos', kind: 'points', value: 70, weight: 1 },
  ])
  let sawMystery = 0
  for (let i = 0; i < 60; i++) {
    const r = await t.rpc(memberA, 'spin_wheel_free', { p_wheel_kind: 'premium' })
    assert.notEqual(r.resolved_prize.kind, 'mystery')
    if (r.prize.kind === 'mystery') {
      sawMystery++
      assert.equal(r.resolved_prize.kind, 'points', 'resolução exclui mystery e extra_spin')
      assert.equal(r.resolved_prize.label, '70 pontos')
    } else {
      assert.equal(r.resolved_prize.id, r.prize.id, 'prêmio comum resolve para ele mesmo')
    }
  }
  assert.ok(sawMystery >= 10, `mystery saiu ${sawMystery}/60`)
  // nada gravado pelo giro livre
  assert.equal(await countRows('select 1 from public.wheel_spins'), 0)

  // giro real: só mystery + pontos → sempre resolve 70 pontos
  await setPrizes('premium', [{ label: 'Mistério', kind: 'mystery', weight: 1000 }, { label: '70 pontos', kind: 'points', value: 70, weight: 1 }])
  const pointsBefore = num((await seasonStats(memberA, activeSeason.id)).points)
  const { spin, approved } = await fullSpin({ profileId: memberA, wheelKind: 'premium' })
  assert.equal(spin.resolved_prize.kind, 'points')
  const stored = await one('select * from public.wheel_spins where id = $1', [spin.spin_id])
  assert.equal(stored.resolved_kind, 'points')
  assert.equal(num(stored.resolved_value), 70)
  assert.equal(approved.spin.credited, true)
  assert.ok(approved.spin.entry_id)
  const entry = await one('select * from public.point_entries where id = $1', [approved.spin.entry_id])
  assert.equal(entry.source, 'wheel')
  assert.equal(num(entry.points), 70)
  assert.equal(num(entry.coins), 0)
  assert.equal(entry.reason, 'Roleta: 70 pontos')
  assert.equal(num((await seasonStats(memberA, activeSeason.id)).points), pointsBefore + 70)
  assert.equal(approved.queue.status, 'done')
})

test('extra_spin: giro livre não grava nada; convidado ganha +1 tentativa (credited) e a vez continua active; no teto de 20 → credited=false e a vez encerra', async () => {
  await setPrizes('classic', [{ label: 'Giro extra', kind: 'extra_spin', weight: 1000 }, { label: '1 ponto', kind: 'points', value: 1, weight: 1 }])
  const free = await t.rpc(memberB, 'spin_wheel_free', { p_wheel_kind: 'classic' })
  assert.ok(['extra_spin', 'points'].includes(free.resolved_prize.kind))
  assert.equal(await countRows('select 1 from public.wheel_spins'), 1, 'só o giro real do teste anterior')
  assert.equal(await countRows("select 1 from public.wheel_queue where person_name = 'Convidado Teste'"), 0)

  // convidado (nome manual) com 1 tentativa: extra_spin → attempts_allowed 2, attempts_used 1, continua active
  const wheelEntriesBefore = await countRows("select 1 from public.point_entries where source = 'wheel'")
  const { spin, approved } = await fullSpin({ personName: 'Convidado Teste', attempts: 1, wantKind: 'extra_spin' })
  assert.equal(spin.profile_id, null)
  assert.equal(spin.resolved_prize.kind, 'extra_spin')
  assert.equal(approved.spin.credited, true)
  assert.equal(num(approved.queue.attempts_allowed), 2)
  assert.equal(num(approved.queue.attempts_used), 1)
  assert.equal(approved.queue.status, 'active')
  assert.equal(await countRows("select 1 from public.point_entries where source = 'wheel'"), wheelEntriesBefore, 'convidado não gera entry')
  // segunda tentativa do mesmo convidado: agora com o teto → 20 tentativas via update_queue_entry
  await t.rpcRow(admin, 'update_queue_entry', { p_queue_id: spin.queue_id, p_attempts: 20 })
  const spin2 = await spinUntil(spin.queue_id, 'extra_spin')
  assert.equal(num(spin2.attempt_index), 2)
  const ap2 = await t.rpc(admin, 'approve_spin', { p_spin_id: spin2.spin_id })
  assert.equal(ap2.spin.credited, false, 'já em 20 → extra_spin não creditado')
  assert.equal(num(ap2.queue.attempts_allowed), 20)
  assert.equal(num(ap2.queue.attempts_used), 2)
  assert.equal(ap2.queue.status, 'active')
  const audit = await one("select new_data from public.audit_log where table_name = 'approve_spin' and row_id = $1", [spin2.spin_id])
  assert.match(audit.new_data.notes ?? '', /20/)
  await t.rpcRow(admin, 'remove_from_queue', { p_queue_id: spin.queue_id })
  assert.equal((await one('select status from public.wheel_queue where id = $1', [spin.queue_id])).status, 'removed')
})

test('convidado com points/coins/multiplier: histórico sem crédito (credited=false, sem entry/boost); cash cria resgate approved para o convidado', async () => {
  await setPrizes('classic', pair('300 pontos', 'points', 300))
  const p = await fullSpin({ personName: 'Convidado Pontos' })
  assert.equal(p.approved.spin.credited, false)
  assert.equal(p.approved.spin.entry_id, null)
  assert.equal(p.approved.queue.status, 'done')
  await setPrizes('classic', pair('2x pontos', 'multiplier', 2))
  const m = await fullSpin({ personName: 'Convidado Boost' })
  assert.equal(m.approved.spin.credited, false)
  assert.equal(m.approved.spin.boost_id, null)
  assert.equal(await countRows('select 1 from public.profile_boosts'), 0)
  await setPrizes('classic', pair('R$ 10 PIX', 'cash', 10))
  const c = await fullSpin({ personName: 'Convidado PIX' })
  assert.equal(c.approved.spin.credited, true)
  const red = await one('select * from public.reward_redemptions where id = $1', [c.approved.spin.redemption_id])
  assert.equal(red.source, 'wheel')
  assert.equal(red.profile_id, null)
  assert.equal(red.person_name, 'Convidado PIX')
  assert.equal(red.status, 'approved')
  assert.equal(num(red.value_amount), 10)
  assert.equal(num(red.cost_coins), 0)
  // convidado não recebe feed nem notificação
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'wheel_prize' and profile_id is null"), 0)
})

let boost
test('multiplier: prêmio 2x para membro cria profile_boosts (24h, spin_id); venda seguinte usa boost_id e multiplier 2; moedas não multiplicam', async () => {
  await setPrizes('classic', pair('2x pontos', 'multiplier', 2))
  const { spin, approved } = await fullSpin({ profileId: memberC })
  assert.equal(approved.spin.credited, true)
  assert.ok(approved.spin.boost_id)
  boost = await one('select * from public.profile_boosts where id = $1', [approved.spin.boost_id])
  assert.equal(boost.profile_id, memberC)
  assert.equal(num(boost.multiplier), 2)
  assert.equal(boost.spin_id, spin.spin_id)
  const span = await one('select extract(epoch from (expires_at - starts_at)) as s from public.profile_boosts where id = $1', [boost.id])
  assert.equal(num(span.s), 24 * 3600)
  const [e] = await sale(memberC, 1000)
  assert.equal(num(e.multiplier), 2)
  assert.equal(e.boost_id, boost.id)
  assert.equal(e.special_event_id, null)
  assert.equal(num(e.base_points), 100)
  assert.equal(num(e.points), 200)
  assert.equal(num(e.coins), 100, 'moedas não multiplicam')
  // retroativa de antes do boost → multiplier 1
  const [old] = await sale(memberC, 1000, { p_occurred_at: hoursFromNow(-2) })
  assert.equal(num(old.multiplier), 1)
  assert.equal(old.boost_id, null)
})

test('boost 2x + evento 2x (empate) → multiplier 2, não 4; empate registra o evento (special_event_id) e não o boost; evento 3x supera boost 2x', async () => {
  const [ev] = await t.rpcRow(admin, 'save_special_event', { p: { name: 'Evento 2x', multiplier: 2, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1) } })
  const [e] = await sale(memberC, 1000)
  assert.equal(num(e.multiplier), 2, 'máximo, não produto (B.4)')
  assert.equal(e.special_event_id, ev.id, 'empate: v_event.multiplier >= boost → evento')
  assert.equal(e.boost_id, null)
  await t.rpcRow(admin, 'save_special_event', { p: { id: ev.id, name: 'Evento 3x', multiplier: 3, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1) } })
  const [e3] = await sale(memberC, 1000)
  assert.equal(num(e3.multiplier), 3)
  assert.equal(e3.special_event_id, ev.id)
  assert.equal(e3.boost_id, null)
  assert.equal(num(e3.points), 300)
  // sobreposição de evento ativo → EVENT_OVERLAP; ends <= starts → EVENT_RANGE_INVALID
  await expectError(t.rpcRow(admin, 'save_special_event', { p: { name: 'Outro', multiplier: 2, starts_at: hoursFromNow(0), ends_at: hoursFromNow(2) } }), 'EVENT_OVERLAP')
  await expectError(t.rpcRow(admin, 'save_special_event', { p: { name: 'Outro', multiplier: 2, starts_at: hoursFromNow(5), ends_at: hoursFromNow(5) } }), 'EVENT_RANGE_INVALID')
  // desativa o evento para não contaminar os testes seguintes; boost continua valendo (2x)
  await t.rpcRow(admin, 'save_special_event', { p: { id: ev.id, name: 'Evento 3x', multiplier: 3, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1), is_active: false } })
  const [e2] = await sale(memberC, 1000)
  assert.equal(num(e2.multiplier), 2)
  assert.equal(e2.boost_id, boost.id)
  // estorno de entry com multiplicador: base_points e points invertidos, multiplier 1, sem evento/boost
  const [rev] = await t.rpcRow(admin, 'reverse_entry', { p_entry_id: e3.id, p_reason: 'estorno 3x' })
  assert.equal(num(rev.points), -300)
  assert.equal(num(rev.base_points), -100)
  assert.equal(num(rev.multiplier), 1)
  assert.equal(rev.special_event_id, null)
  assert.equal(rev.boost_id, null)
  assert.equal(num(rev.amount), -1000)
})

// =============================================================================
// 9. Fila: overflow de tentativas e regras de update_queue_entry (§7.6, B.22, B.23, D.42)
// =============================================================================
test('fila: p_attempts 0/21 → ATTEMPTS_INVALID; update_queue_entry = attempts_used → ATTEMPTS_INVALID (detail cita usadas); > 20 → ATTEMPTS_INVALID; done → QUEUE_NOT_EDITABLE; spin pendente → SPIN_PENDING', async () => {
  await setPrizes('classic', pair('50 pontos', 'points', 50))
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberB, p_attempts: 0 }), 'ATTEMPTS_INVALID')
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberB, p_attempts: 21 }), 'ATTEMPTS_INVALID')
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberB, p_person_name: 'X' }), 'QUEUE_TARGET_REQUIRED')
  await expectError(t.rpcRow(admin, 'enqueue_wheel', {}), 'QUEUE_TARGET_REQUIRED')
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: '00000000-0000-0000-0000-000000000001' }), 'PROFILE_NOT_FOUND')
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberB, p_attempts: 2 })
  assert.equal(num(q.attempts_allowed), 2)
  // duplicata manual do mesmo perfil → ALREADY_IN_QUEUE; convidado por nome (case-insensitive) idem
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberB }), 'ALREADY_IN_QUEUE')
  const [g] = await t.rpcRow(admin, 'enqueue_wheel', { p_person_name: '  Convidado Fila  ' })
  assert.equal(g.person_name, 'Convidado Fila')
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_person_name: 'convidado fila' }), 'ALREADY_IN_QUEUE')
  // update em waiting: 0 usadas → p_attempts 0 inválido, 21 inválido, 20 ok, 1 ok
  await expectError(t.rpcRow(admin, 'update_queue_entry', { p_queue_id: q.id, p_attempts: 0 }), 'ATTEMPTS_INVALID')
  await expectError(t.rpcRow(admin, 'update_queue_entry', { p_queue_id: q.id, p_attempts: 21 }), 'ATTEMPTS_INVALID')
  const [u20] = await t.rpcRow(admin, 'update_queue_entry', { p_queue_id: q.id, p_attempts: 20 })
  assert.equal(num(u20.attempts_allowed), 20)
  const [u1] = await t.rpcRow(admin, 'update_queue_entry', { p_queue_id: q.id, p_attempts: 1 })
  assert.equal(num(u1.attempts_allowed), 1)
  // libera, gira (pendente) → update/remove bloqueados por SPIN_PENDING; release de outra vez também
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const spin = await t.rpc(admin, 'spin_wheel', { p_queue_id: q.id })
  await expectError(t.rpcRow(admin, 'update_queue_entry', { p_queue_id: q.id, p_attempts: 3 }), 'SPIN_PENDING')
  await expectError(t.rpcRow(admin, 'remove_from_queue', { p_queue_id: q.id }), 'SPIN_PENDING')
  await expectError(t.rpcRow(admin, 'release_turn', { p_queue_id: g.id }), 'SPIN_PENDING')
  await expectError(t.rpc(admin, 'spin_wheel', { p_queue_id: q.id }), 'SPIN_PENDING')
  await expectError(t.rpcRow(admin, 'save_wheel_prizes', { p_wheel_kind: 'classic', p_prizes: pair('x', 'points', 1) }), 'SPIN_PENDING')
  // aprova → 1 de 1 → done; depois update = 1 (= usadas) → ATTEMPTS_INVALID? não: done → QUEUE_NOT_EDITABLE primeiro
  const ap = await t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id })
  assert.equal(ap.queue.status, 'done')
  const errDone = await expectError(t.rpcRow(admin, 'update_queue_entry', { p_queue_id: q.id, p_attempts: 5 }), 'QUEUE_NOT_EDITABLE')
  assert.equal(errDone.code, 'P0001')
  await expectError(t.rpcRow(admin, 'remove_from_queue', { p_queue_id: q.id }), 'QUEUE_NOT_EDITABLE')
  await expectError(t.rpc(admin, 'spin_wheel', { p_queue_id: q.id }), 'NO_ACTIVE_TURN')
  // removida (não esgotada) → QUEUE_NOT_WAITING
  const [tmp] = await t.rpcRow(admin, 'enqueue_wheel', { p_person_name: 'Removido Teste', p_attempts: 3 })
  await t.rpcRow(admin, 'remove_from_queue', { p_queue_id: tmp.id })
  await expectError(t.rpcRow(admin, 'release_turn', { p_queue_id: tmp.id }), 'QUEUE_NOT_WAITING')
  // vez do convidado: 2 tentativas, usa 1 → update para 1 (= usadas) → ATTEMPTS_INVALID com detail "(1)"
  await t.rpcRow(admin, 'update_queue_entry', { p_queue_id: g.id, p_attempts: 2 })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: g.id })
  const gs = await t.rpc(admin, 'spin_wheel', { p_queue_id: g.id })
  await t.rpc(admin, 'approve_spin', { p_spin_id: gs.spin_id })
  const errEq = await expectError(t.rpcRow(admin, 'update_queue_entry', { p_queue_id: g.id, p_attempts: 1 }), 'ATTEMPTS_INVALID')
  assert.match(errEq.detail, /\(1\)/)
  const [g3] = await t.rpcRow(admin, 'update_queue_entry', { p_queue_id: g.id, p_attempts: 3 })
  assert.equal(num(g3.attempts_allowed), 3)
  assert.equal(g3.status, 'active')
  // remover encerra a vez (B.23)
  const [rm] = await t.rpcRow(admin, 'remove_from_queue', { p_queue_id: g.id })
  assert.equal(rm.status, 'removed')
  assert.equal(rm.removed_by, admin)
  assert.ok(rm.finished_at)
  // uuid inexistente → *_NOT_FOUND antes de qualquer papel
  await expectError(t.rpcRow(admin, 'update_queue_entry', { p_queue_id: '00000000-0000-0000-0000-000000000001', p_attempts: 2 }), 'QUEUE_NOT_FOUND')
  await expectError(t.rpc(admin, 'approve_spin', { p_spin_id: '00000000-0000-0000-0000-000000000001' }), 'SPIN_NOT_FOUND')
  await expectError(t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id }), 'SPIN_NOT_PENDING')
})

test('release_turn: uma segunda vez liberada devolve a anterior para waiting (released_at null) sem spin pendente; tentativas esgotadas → ATTEMPTS_EXHAUSTED', async () => {
  const [q1] = await t.rpcRow(admin, 'enqueue_wheel', { p_person_name: 'Fila Um', p_attempts: 1 })
  const [q2] = await t.rpcRow(admin, 'enqueue_wheel', { p_person_name: 'Fila Dois', p_attempts: 1 })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q1.id })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q2.id })
  const r1 = await one('select * from public.wheel_queue where id = $1', [q1.id])
  assert.equal(r1.status, 'waiting')
  assert.equal(r1.released_at, null)
  assert.equal((await one('select status from public.wheel_queue where id = $1', [q2.id])).status, 'active')
  assert.equal(await countRows("select 1 from public.wheel_queue where status = 'active'"), 1)
  const s2 = await t.rpc(admin, 'spin_wheel', { p_queue_id: q2.id })
  await t.rpc(admin, 'approve_spin', { p_spin_id: s2.spin_id })
  assert.equal((await one('select status from public.wheel_queue where id = $1', [q2.id])).status, 'done')
  // ATTEMPTS_EXHAUSTED: só alcançável se attempts_used >= attempts_allowed com status waiting — estado forçado por fora
  await t.sql('update public.wheel_queue set attempts_used = attempts_allowed where id = $1', [q1.id])
  await expectError(t.rpcRow(admin, 'release_turn', { p_queue_id: q1.id }), 'ATTEMPTS_EXHAUSTED')
  await t.sql('update public.wheel_queue set attempts_used = 0 where id = $1', [q1.id])
  await t.rpcRow(admin, 'remove_from_queue', { p_queue_id: q1.id })
})

test('release_turn em entrada done: §7.6 passo 5 lista QUEUE_NOT_WAITING antes de ATTEMPTS_EXHAUSTED (ordem dos erros)', async () => {
  const done = await one("select * from public.wheel_queue where status = 'done' and person_name = 'Fila Dois'")
  assert.ok(done)
  await expectError(t.rpcRow(admin, 'release_turn', { p_queue_id: done.id }), 'QUEUE_NOT_WAITING')
})

// =============================================================================
// 10. Missões: period_key por kind, audience selected, janelas (§4.15–§4.17, §6.1, §6.8)
// =============================================================================
test('mission_period: daily = dia local (yyyy-mm-dd); weekly = IYYY-Www com domingo 23:59 e segunda 00:00 em semanas distintas; special/lightning = once; fora da janela = 0 linhas', async () => {
  const w = await rows(`
    with d as (select (date_trunc('week', public.local_today()::timestamp)::date - 1) as sunday)
    select
      (select period_key from public.mission_period('weekly', (d.sunday::text || 'T23:59:59-03:00')::timestamptz, now() - interval '60 days', now() + interval '60 days')) as sun_key,
      (select period_key from public.mission_period('weekly', ((d.sunday + 1)::text || 'T00:00:00-03:00')::timestamptz, now() - interval '60 days', now() + interval '60 days')) as mon_key,
      public.iso_week_key(d.sunday) as sun_expected, public.iso_week_key(d.sunday + 1) as mon_expected,
      (select period_key from public.mission_period('daily', ((d.sunday + 1)::text || 'T00:00:00-03:00')::timestamptz, now() - interval '60 days', now() + interval '60 days')) as mon_day_key,
      (select period_key from public.mission_period('special', now(), now() - interval '1 day', now() + interval '1 day')) as special_key,
      (select period_key from public.mission_period('lightning', now(), now() - interval '1 hour', now() + interval '1 hour')) as lightning_key,
      (select count(*) from public.mission_period('daily', now() + interval '2 day', now() - interval '1 day', now() + interval '1 day')) as outside,
      (select count(*) from public.mission_period('daily', now() + interval '1 day', now() - interval '1 day', now() + interval '1 day')) as at_end_exclusive,
      (select count(*) from public.mission_period('daily', now() - interval '1 day', now() - interval '1 day', now() + interval '1 day')) as at_start_inclusive,
      (d.sunday + 1)::text as monday
    from d`)
  const r = w[0]
  assert.equal(r.sun_key, r.sun_expected)
  assert.equal(r.mon_key, r.mon_expected)
  assert.notEqual(r.sun_key, r.mon_key, 'domingo e segunda em semanas ISO distintas')
  assert.match(r.mon_key, /^\d{4}-W\d{2}$/)
  assert.equal(r.mon_day_key, r.monday)
  assert.equal(r.special_key, 'once')
  assert.equal(r.lightning_key, 'once')
  assert.equal(num(r.outside), 0)
  assert.equal(num(r.at_end_exclusive), 0, 'fim exclusivo')
  assert.equal(num(r.at_start_inclusive), 1, 'início inclusivo')
  // período diário clampado pela janela da missão: starts em 12:00 local hoje → period_start = 12:00
  const clamp = await one(`
    select period_start = $1::timestamptz as clamped_start
    from public.mission_period('daily', $1::timestamptz + interval '1 minute', $1::timestamptz, $1::timestamptz + interval '1 hour')`,
    [`${(await one('select public.local_today()::text as d')).d}T12:00:00-03:00`])
  assert.equal(clamp.clamped_start, true)
})

let missionDaily, missionWeekly, missionSpecial, missionLightning
test('missões por kind gravam period_key certo em mission_progress; selected só progride para os selecionados; lightning > 24h e janela fora da temporada falham', async () => {
  const win = { starts_at: hoursFromNow(-3), ends_at: hoursFromNow(3) }
  const base = { metric: 'call', target_kind: 'count', target_value: 3, reward_points: 10, reward_coins: 0 }
  ;[missionDaily] = await t.rpcRow(admin, 'save_mission', { p: { title: 'Diária ligações', kind: 'daily', ...base, ...win } })
  ;[missionWeekly] = await t.rpcRow(admin, 'save_mission', { p: { title: 'Semanal ligações', kind: 'weekly', ...base, ...win } })
  ;[missionSpecial] = await t.rpcRow(admin, 'save_mission', { p: { title: 'Especial ligações', kind: 'special', ...base, ...win } })
  ;[missionLightning] = await t.rpcRow(admin, 'save_mission', {
    p: { title: 'Relâmpago só A', kind: 'lightning', ...base, ...win, audience: 'selected', participant_ids: [memberA] },
  })
  assert.equal(missionDaily.season_id, activeSeason.id)
  await expectError(t.rpcRow(admin, 'save_mission', { p: { title: 'Longa', kind: 'lightning', ...base, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(24) } }), 'LIGHTNING_TOO_LONG')
  await expectError(t.rpcRow(admin, 'save_mission', { p: { title: 'Sem participantes', kind: 'special', ...base, ...win, audience: 'selected', participant_ids: [] } }), 'PARTICIPANTS_REQUIRED')
  await expectError(t.rpcRow(admin, 'save_mission', { p: { title: 'Fora', kind: 'special', ...base, starts_at: hoursFromNow(-1), ends_at: daysFromNow(60) } }), 'MISSION_WINDOW_INVALID')
  await expectError(t.rpcRow(admin, 'save_mission', { p: { title: 'Sem temporada', kind: 'special', ...base, starts_at: daysFromNow(400), ends_at: daysFromNow(401) } }), 'NO_SEASON_FOR_DATE')
  await expectError(t.rpcRow(admin, 'save_mission', { p: { id: '00000000-0000-0000-0000-000000000001', title: 'X', kind: 'special', ...base, ...win } }), 'MISSION_NOT_FOUND')

  // board: relâmpago selected lista só membro-a; as demais listam os 5 ativos
  assert.equal(await countRows('select 1 from public.v_mission_board where mission_id = $1', [missionLightning.id]), 1)
  assert.equal((await one('select profile_id from public.v_mission_board where mission_id = $1', [missionLightning.id])).profile_id, memberA)
  assert.equal(await countRows('select 1 from public.v_mission_board where mission_id = $1', [missionDaily.id]), 5)

  // 1 ligação de membro-b → progresso 1 nas 3 missões "all", nenhum na selected
  await ruleEntry(memberB, ruleCall)
  const keys = await rows(`
    select m.kind, mp.period_key, mp.value from public.mission_progress mp join public.missions m on m.id = mp.mission_id
    where mp.profile_id = $1 order by m.kind::text`, [memberB])
  const today = (await one('select public.local_today()::text as d, public.iso_week_key(public.local_today()) as w'))
  assert.deepEqual(keys.map((k) => [k.kind, k.period_key, num(k.value)]), [
    ['daily', today.d, 1], ['special', 'once', 1], ['weekly', today.w, 1],
  ])
  assert.equal(await countRows('select 1 from public.mission_progress where mission_id = $1', [missionLightning.id]), 0)
  // membro-a: 3 ligações → relâmpago conclui (once) com entry mission +10
  for (let i = 0; i < 3; i++) await ruleEntry(memberA, ruleCall)
  const lp = await one('select * from public.mission_progress where mission_id = $1 and profile_id = $2', [missionLightning.id, memberA])
  assert.equal(lp.period_key, 'once')
  assert.equal(num(lp.value), 3)
  assert.ok(lp.completed_at)
  assert.equal(await countRows("select 1 from public.point_entries where source = 'mission' and profile_id = $1 and reason = 'Relâmpago só A'", [memberA]), 1)
  // mudar metric com progresso → MISSION_HAS_PROGRESS
  await expectError(t.rpcRow(admin, 'save_mission', { p: { id: missionDaily.id, title: 'Diária ligações', kind: 'daily', ...base, metric: 'crm_update', ...win } }), 'MISSION_HAS_PROGRESS')
  // estorno reduz o progresso (B.8: não desconclui) — daily de membro-b volta a 0
  const bCall = await one("select id from public.point_entries where profile_id = $1 and source = 'rule' and metric = 'call' order by created_at desc limit 1", [memberB])
  await t.rpcRow(admin, 'reverse_entry', { p_entry_id: bCall.id, p_reason: 'estorno ligação' })
  const after = await one('select value from public.mission_progress where mission_id = $1 and profile_id = $2', [missionDaily.id, memberB])
  assert.equal(num(after.value), 0)
  assert.ok((await one('select completed_at from public.mission_progress where mission_id = $1 and profile_id = $2', [missionLightning.id, memberA])).completed_at)
})

// =============================================================================
// 11. Duelo com exatamente 2; participante inativado (B.17, §6.8, §7.2, §7.5)
// =============================================================================
const challengeBase = (over = {}) => ({
  name: 'Desafio teste', kind: 'duel', metric: 'sales_count', target_value: 1, reward_points: 30, reward_coins: 0,
  starts_at: hoursFromNow(-1), ends_at: hoursFromNow(4), ...over,
})
test('duelo: 1 ou 3 ids → DUEL_NEEDS_TWO; ids repetidos → DUEL_NEEDS_TWO; 2 ids ativa; coletivo com 1 → TEAM_NEEDS_TWO; coletivo vazio = todos os ativos', async () => {
  await expectError(t.rpcRow(admin, 'save_challenge', { p: challengeBase({ participant_ids: [memberA] }) }), 'DUEL_NEEDS_TWO')
  await expectError(t.rpcRow(admin, 'save_challenge', { p: challengeBase({ participant_ids: [memberA, memberB, memberC] }) }), 'DUEL_NEEDS_TWO')
  await expectError(t.rpcRow(admin, 'save_challenge', { p: challengeBase({ participant_ids: [memberA, memberA] }) }), 'DUEL_NEEDS_TWO')
  const [duel] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ participant_ids: [memberA, memberB] }) })
  assert.equal(duel.status, 'draft')
  assert.equal(await countRows('select 1 from public.challenge_participants where challenge_id = $1', [duel.id]), 2)
  // insert direto de um 3º em draft passa pelo BEFORE (duelo com 2 → DUEL_NEEDS_TWO)
  await expectError(t.sql('insert into public.challenge_participants (challenge_id, profile_id) values ($1, $2)', [duel.id, memberC]), 'DUEL_NEEDS_TWO')
  const [active] = await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: duel.id })
  assert.equal(active.status, 'active')
  // depois de ativo: participantes não mudam (CHALLENGE_NOT_DRAFT); status não muda por update direto (STATUS_VIA_RPC_ONLY)
  await expectError(t.sql('delete from public.challenge_participants where challenge_id = $1 and profile_id = $2', [duel.id, memberB]), 'CHALLENGE_NOT_DRAFT')
  await expectError(t.rpcRow(admin, 'save_challenge', { p: challengeBase({ id: duel.id, participant_ids: [memberA, memberC] }) }), 'CHALLENGE_NOT_DRAFT')
  await expectError(t.sql("update public.challenges set status = 'finished', finished_at = now() where id = $1", [duel.id]), 'STATUS_VIA_RPC_ONLY')
  await expectError(t.rpcRow(admin, 'activate_challenge', { p_challenge_id: duel.id }), 'CHALLENGE_NOT_DRAFT')
  await t.rpcRow(admin, 'cancel_challenge', { p_challenge_id: duel.id, p_reason: 'teste' })
  await expectError(t.rpcRow(admin, 'cancel_challenge', { p_challenge_id: duel.id }), 'CHALLENGE_FINAL')

  const [team1] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ kind: 'team', name: 'Coletivo de 1', participant_ids: [memberA] }) })
  await expectError(t.rpcRow(admin, 'activate_challenge', { p_challenge_id: team1.id }), 'TEAM_NEEDS_TWO')
  const [teamAll] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ kind: 'team', name: 'Coletivo todos', participant_ids: [] }) })
  assert.equal(await countRows('select 1 from public.challenge_participants where challenge_id = $1', [teamAll.id]), 5)
  await t.rpcRow(admin, 'cancel_challenge', { p_challenge_id: teamAll.id })
  await t.rpcRow(admin, 'cancel_challenge', { p_challenge_id: team1.id })
  // janela já encerrada → CHALLENGE_WINDOW_INVALID ao ativar; fora da temporada → CHALLENGE_WINDOW_INVALID ao salvar
  const [past] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ name: 'Passado', starts_at: hoursFromNow(-3), ends_at: hoursFromNow(-2), participant_ids: [memberA, memberB] }) })
  await expectError(t.rpcRow(admin, 'activate_challenge', { p_challenge_id: past.id }), 'CHALLENGE_WINDOW_INVALID')
  await expectError(t.rpcRow(admin, 'save_challenge', { p: challengeBase({ name: 'Fora', ends_at: daysFromNow(60), participant_ids: [memberA, memberB] }) }), 'CHALLENGE_WINDOW_INVALID')
})

test('B.17: inativar membro-d cancela o duelo ativo (aviso ao outro), remove-o do coletivo draft, mantém no coletivo ativo e finish_challenge marca is_winner=false; fila waiting vira removed', async () => {
  const [duel] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ name: 'Duelo D×A', participant_ids: [memberD, memberA] }) })
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: duel.id })
  const [teamDraft] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ kind: 'team', name: 'Coletivo draft', target_value: 2, participant_ids: [memberD, memberA, memberB] }) })
  const [teamActive] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ kind: 'team', name: 'Coletivo ativo', metric: 'sales_count', target_value: 2, participant_ids: [memberD, memberA, memberB] }) })
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: teamActive.id })
  // membro-d produz 1 venda enquanto ativo (conta para a soma do coletivo) e entra na fila
  await sale(memberD, 500)
  await sale(memberA, 500)
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberD, p_attempts: 1 })

  const res = await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberD, p_patch: { status: 'inactive' } })
  assert.equal(res.profile.status, 'inactive')
  assert.equal(res.profile.rank, null, 'inativo sai do ranking')
  assert.equal((await one('select status from public.challenges where id = $1', [duel.id])).status, 'cancelled')
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title like 'Duelo cancelado%'", [memberA]), 1)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title like 'Duelo cancelado%'", [memberD]), 0, 'inativo não recebe')
  assert.equal(await countRows('select 1 from public.challenge_participants where challenge_id = $1 and profile_id = $2', [teamDraft.id, memberD]), 0)
  assert.equal(await countRows('select 1 from public.challenge_participants where challenge_id = $1', [teamDraft.id]), 2)
  assert.equal(await countRows('select 1 from public.challenge_participants where challenge_id = $1 and profile_id = $2', [teamActive.id, memberD]), 1, 'coletivo ativo mantém')
  assert.equal((await one('select status from public.wheel_queue where id = $1', [q.id])).status, 'removed')
  // inativo: fila/roleta/lançamento recusam
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberD }), 'PROFILE_INACTIVE')
  await expectError(sale(memberD, 100), 'PROFILE_INACTIVE')
  await expectError(t.rpc(memberD, 'get_dashboard', {}), 'PROFILE_INACTIVE')
  // activate_challenge com inativo → PARTICIPANT_INACTIVE
  const [withInactive] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ name: 'Com inativo', participant_ids: [memberD, memberB] }) })
  await expectError(t.rpcRow(admin, 'activate_challenge', { p_challenge_id: withInactive.id }), 'PARTICIPANT_INACTIVE')

  // finish do coletivo ativo: soma = 2 ≥ alvo 2 (inclui a venda do inativo) → vencedores só os ativos; inativo is_winner=false, sem entry
  const fin = await t.rpc(admin, 'finish_challenge', { p_challenge_id: teamActive.id })
  assert.deepEqual([...fin.winner_ids].sort(), [memberA, memberB].sort())
  const dRes = fin.results.find((r) => r.profile_id === memberD)
  assert.equal(dRes.is_winner, false)
  assert.equal(num(dRes.final_value), 1)
  assert.equal(dRes.entry_id, null)
  assert.equal(await countRows("select 1 from public.point_entries where source = 'challenge' and profile_id = $1", [memberD]), 0)
  assert.equal(await countRows("select 1 from public.point_entries where source = 'challenge' and profile_id = $1", [memberA]), 1)
  // v_challenge_board expõe status do participante
  const board = await one('select participants from public.v_challenge_board where challenge_id = $1', [teamActive.id])
  assert.equal(board.participants.find((p) => p.profile_id === memberD).status, 'inactive')
  // finish de novo → CHALLENGE_NOT_ACTIVE (idempotente)
  await expectError(t.rpc(admin, 'finish_challenge', { p_challenge_id: teamActive.id }), 'CHALLENGE_NOT_ACTIVE')
  await t.rpcRow(admin, 'cancel_challenge', { p_challenge_id: teamDraft.id })
  await t.rpcRow(admin, 'cancel_challenge', { p_challenge_id: withInactive.id })
})

test('duelo com um inativado por caminho direto: o ativo vence se > 0; empate → ambos; todos zero → ninguém', async () => {
  // reativa d para montar os duelos, depois inativa por UPDATE direto (sem a limpeza da RPC)
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberD, p_patch: { status: 'active' } })
  const [duel] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ name: 'Duelo direto', metric: 'meetings_held', participant_ids: [memberD, memberC] }) })
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: duel.id })
  const [tie] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ name: 'Duelo empate', metric: 'meetings_held', participant_ids: [memberA, memberB] }) })
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: tie.id })
  const [zero] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ name: 'Duelo zero', metric: 'meetings_held', participant_ids: [memberA, memberC] }) })
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: zero.id })
  await ruleEntry(memberD, ruleMeetingHeld)
  await ruleEntry(memberD, ruleMeetingHeld)
  await ruleEntry(memberC, ruleMeetingHeld)
  await ruleEntry(memberA, ruleMeetingHeld)
  await ruleEntry(memberB, ruleMeetingHeld)
  // "caminho direto" = fora das RPCs e dos triggers (protect_profile_columns barra até o postgres sem sessão)
  await t.db.transaction(async (tx) => {
    await tx.exec('set local session_replication_role = replica')
    await tx.query("update public.profiles set status = 'inactive' where id = $1", [memberD])
  })
  assert.equal((await one('select status from public.challenges where id = $1', [duel.id])).status, 'active', 'caminho direto não cancela')
  const fin = await t.rpc(admin, 'finish_challenge', { p_challenge_id: duel.id })
  assert.deepEqual(fin.winner_ids, [memberC], 'inativo (2) nunca vence; ativo (1) vence por > 0')
  const finTie = await t.rpc(admin, 'finish_challenge', { p_challenge_id: tie.id })
  assert.deepEqual([...finTie.winner_ids].sort(), [memberA, memberB].sort())
  // A×C: C tem 2 reuniões na janela (1 do teste de conversão + 1 aqui), A tem 1 → C vence; final_value recalculado do ledger
  const finZero = await t.rpc(admin, 'finish_challenge', { p_challenge_id: zero.id })
  assert.deepEqual(finZero.winner_ids, [memberC])
  assert.equal(num(finZero.results.find((r) => r.profile_id === memberC).final_value), 2)
  assert.equal(num(finZero.results.find((r) => r.profile_id === memberA).final_value), 1)
  // todos zero: membro-b e gestor não têm receita na janela → ninguém vence, nenhuma entry
  const [nobody] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ name: 'Duelo ninguém', metric: 'revenue', target_value: 99999, participant_ids: [memberB, admin] }) })
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: nobody.id })
  const finNobody = await t.rpc(admin, 'finish_challenge', { p_challenge_id: nobody.id })
  assert.deepEqual(finNobody.winner_ids, [])
  assert.ok(finNobody.results.every((r) => r.is_winner === false && num(r.final_value) === 0 && r.entry_id === null))
  assert.equal(await countRows("select 1 from public.challenge_results where challenge_id = $1", [nobody.id]), 2)
})

// =============================================================================
// 12. Temporada sem lançamentos fechada; retroatividade (B.14) e temporada fechada (§7.3, §7.4)
// =============================================================================
test('close_season sem lançamentos: snapshot zerado para todos, sem campeão, sem CAMPEÃO, sem marco; reabrir/fechar de novo falha', async () => {
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberD, p_patch: { status: 'active' } })
  assert.equal(await countRows('select 1 from public.point_entries where season_id = $1', [prevSeason.id]), 0)
  const res = await t.rpc(admin, 'close_season', { p_season_id: prevSeason.id })
  assert.equal(res.champion_profile_id, null)
  assert.equal(res.results.length, 5, 'todo perfil ativo entra no snapshot')
  assert.ok(res.results.every((r) => num(r.final_points) === 0 && num(r.sales_amount) === 0 && r.goal_reached === false))
  assert.ok(res.results.every((r) => r.final_rank === null || num(r.final_rank) >= 1))
  assert.deepEqual(res.warnings, [], 'temporada ativa começa exatamente no fim da anterior → sem gap')
  assert.equal(await countRows("select 1 from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id where a.criteria = 'rank_first' and pa.season_id = $1", [prevSeason.id]), 0)
  assert.equal(await countRows('select 1 from public.point_entries where season_id = $1', [prevSeason.id]), 0, 'fechar não cria entry')
  const feed = await one("select payload from public.feed_events where kind = 'season_closed' and season_id = $1", [prevSeason.id])
  assert.equal(feed.payload.champion_profile_id, undefined)
  const closed = await one('select * from public.seasons where id = $1', [prevSeason.id])
  assert.ok(closed.closed_at)
  assert.equal(closed.is_active, false)
  await expectError(t.rpc(admin, 'close_season', { p_season_id: prevSeason.id }), 'SEASON_ALREADY_CLOSED')
  await expectError(t.rpcRow(admin, 'activate_season', { p_season_id: prevSeason.id }), 'SEASON_CLOSED')
  await expectError(t.rpcRow(admin, 'update_season', { p_season_id: prevSeason.id, p_patch: { starts_on: '2020-01-01' } }), /SEASON_CLOSED|SEASON_/)
})

test('retroatividade: > 90 dias → OCCURRED_AT_INVALID (antes de NO_SEASON_FOR_DATE); > now+5min idem; data válida sem temporada → NO_SEASON_FOR_DATE; temporada fechada → SEASON_CLOSED; estorno em fechada passa', async () => {
  await expectError(sale(memberA, 100, { p_occurred_at: daysFromNow(-91) }), 'OCCURRED_AT_INVALID')
  await expectError(sale(memberA, 100, { p_occurred_at: iso(Date.now() + 10 * 60 * 1000) }), 'OCCURRED_AT_INVALID')
  const [ok] = await sale(memberA, 100, { p_occurred_at: iso(Date.now() + 4 * 60 * 1000) })
  assert.ok(ok.id, 'até +5 min é aceito')
  // 89 dias atrás: passa a validação de janela, mas não há temporada cobrindo a data
  await expectError(sale(memberA, 100, { p_occurred_at: daysFromNow(-89) }), 'NO_SEASON_FOR_DATE')
  // temporada anterior (fechada): meio do mês passado está dentro de 90 dias
  const mid = await one(`select (public.local_day($1::timestamptz) + 10)::text || 'T12:00:00-03:00' as ts`, [prevSeason.starts_at])
  await expectError(sale(memberA, 100, { p_occurred_at: mid.ts }), 'SEASON_CLOSED')
  await expectError(t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberA, p_rule_id: ruleCall.id, p_quantity: 0 }), 'QUANTITY_INVALID')
  await expectError(t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberA, p_rule_id: ruleCall.id, p_quantity: 1001 }), 'QUANTITY_INVALID')
  // insert direto em temporada fechada (postgres) → SEASON_CLOSED do trigger; com app.allow_closed = on passa (uso interno)
  await expectError(
    t.sql("insert into public.point_entries (profile_id, source, base_points, points, coins, occurred_at, reason) values ($1, 'system', 1, 1, 0, $2::timestamptz, 'x')", [memberA, mid.ts]),
    'SEASON_CLOSED',
  )
  const inserted = await t.db.transaction(async (tx) => {
    await tx.query("select set_config('app.allow_closed', 'on', true)")
    return (await tx.query("insert into public.point_entries (profile_id, source, base_points, points, coins, occurred_at, reason) values ($1, 'system', 7, 7, 0, $2::timestamptz, 'Ajuste interno') returning *", [memberA, mid.ts])).rows[0]
  })
  assert.equal(inserted.season_id, prevSeason.id)
  // estorno de entry em temporada fechada continua permitido e herda season/occurred_at
  const [rev] = await t.rpcRow(admin, 'reverse_entry', { p_entry_id: inserted.id, p_reason: 'estorno em fechada' })
  assert.equal(rev.season_id, prevSeason.id)
  assert.equal(num(rev.points), -7)
  assert.equal(String(rev.occurred_at), String(inserted.occurred_at))
  assert.equal(num((await seasonStats(memberA, prevSeason.id)).points), 0)
  // estorno não cria dia de streak nem last_entry_at
  assert.equal((await seasonStats(memberA, prevSeason.id)).last_entry_at, null)
})

// =============================================================================
// 13. Fuso travado após o primeiro lançamento (B.18, §6.3)
// =============================================================================
test('timezone: com lançamentos, RPC e UPDATE direto → TIMEZONE_LOCKED; mesmo fuso é no-op; fuso inválido → INVALID_TIMEZONE; banco novo sem lançamento aceita a troca', async () => {
  await expectError(t.rpcRow(admin, 'update_app_settings', { p_patch: { timezone: 'UTC' } }), 'TIMEZONE_LOCKED')
  await expectError(t.rpcRow(admin, 'update_app_settings', { p_patch: { timezone: 'America/Manaus' } }), 'TIMEZONE_LOCKED')
  await expectError(t.sql("update public.app_settings set timezone = 'UTC' where id = 1"), 'TIMEZONE_LOCKED')
  await expectError(t.asUser(admin, (tx) => tx.query("update public.app_settings set timezone = 'UTC' where id = 1")), 'TIMEZONE_LOCKED')
  const [same] = await t.rpcRow(admin, 'update_app_settings', { p_patch: { timezone: 'America/Sao_Paulo', company_name: 'Orbion' } })
  assert.equal(same.timezone, 'America/Sao_Paulo')
  await expectError(t.rpcRow(admin, 'update_app_settings', { p_patch: { timezone: 'Marte/Olympus' } }), /INVALID_TIMEZONE|TIMEZONE_LOCKED/)
  await expectError(t.rpcRow(admin, 'update_app_settings', { p_patch: { foo: 1 } }), 'INVALID_PATCH_KEY')
  assert.equal((await one('select timezone from public.app_settings where id = 1')).timezone, 'America/Sao_Paulo')

  // banco novo (sem point_entries): troca permitida e local_day passa a refletir o novo fuso
  const fresh = await createTestDb()
  try {
    const a2 = await fresh.createAuthUser({ email: 'gestor2@teste.local', confirmed: true })
    await expectError(fresh.rpcRow(a2, 'update_app_settings', { p_patch: { timezone: 'Marte/Olympus' } }), 'INVALID_TIMEZONE')
    const [s2] = await fresh.rpcRow(a2, 'update_app_settings', { p_patch: { timezone: 'Asia/Tokyo' } })
    assert.equal(s2.timezone, 'Asia/Tokyo')
    const d = (await fresh.sql("select public.local_day('2026-09-15T20:00:00Z'::timestamptz)::text as d")).rows[0]
    assert.equal(d.d, '2026-09-16')
    // depois do primeiro lançamento, trava
    await fresh.rpcRow(a2, 'record_manual_entry', { p_profile_id: a2, p_points: 10, p_reason: 'primeiro lançamento' })
    await expectError(fresh.rpcRow(a2, 'update_app_settings', { p_patch: { timezone: 'UTC' } }), 'TIMEZONE_LOCKED')
  } finally {
    await fresh.close()
  }
})

// =============================================================================
// 14. recompute_stats reproduz os números incrementais do cenário inteiro (§7.2, D.40)
// =============================================================================
// strip: colunas com achado próprio (testadas em separado abaixo) para que a comparação geral continue significativa
let firstSaleBefore
const snapshotStats = async (strip = ['first_sale_at', 'best_streak_days']) => ({
  season: await rows(`select profile_id, season_id, to_jsonb(s) - 'updated_at' as j from public.profile_season_stats s order by profile_id, season_id`),
  lifetime: await rows(`select profile_id, to_jsonb(l) - 'updated_at' - $1::text[] as j from public.profile_lifetime_stats l order by profile_id`, [strip]),
  challenges: await rows(`select cp.challenge_id, cp.profile_id, cp.current_value from public.challenge_participants cp join public.challenges c on c.id = cp.challenge_id where c.status = 'active' order by 1, 2`),
  views: await rows(`select profile_id, season_id, to_jsonb(v) - $1::text[] as j from public.v_profile_stats v order by profile_id, season_id`, [strip]),
})
test('recompute_stats(all): após vendas, estornos, missões, roleta, desafios, dívida e inativação, o recompute devolve exatamente as mesmas linhas (season, lifetime, desafios ativos, v_profile_stats)', async () => {
  // mais um pouco de cenário com desafio ativo, para current_value ser recalculado
  const [ch] = await t.rpcRow(admin, 'save_challenge', { p: challengeBase({ kind: 'team', name: 'Coletivo recompute', metric: 'points', target_value: 100000, participant_ids: [memberA, memberB, memberC] }) })
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: ch.id })
  await sale(memberA, 12000) // cruza R$ 10.000 → marco amount_step (system) + first_sale (achievement)
  await manual(memberB, -40, 'Ajuste negativo recompute')
  const [c1] = await ruleEntry(memberC, ruleCall, { p_occurred_at: hoursFromNow(-30) })
  await t.rpcRow(admin, 'reverse_entry', { p_entry_id: c1.id, p_reason: 'estorno recompute' })
  const before = await snapshotStats()
  firstSaleBefore = await rows('select profile_id, first_sale_at::text as f from public.profile_lifetime_stats order by profile_id')
  assert.ok(before.season.length >= 5 && before.challenges.length === 3)
  const ms = await one("select count(*)::int as n from public.milestone_awards where metric = 'amount_step' and profile_id = $1", [memberA])
  assert.equal(num(ms.n), 1)

  const res = await t.rpc(admin, 'recompute_stats', {})
  assert.ok(num(res.profiles) >= 5)
  const after = await snapshotStats()
  assert.deepEqual(after.season, before.season)
  assert.deepEqual(after.lifetime, before.lifetime)
  assert.deepEqual(after.challenges, before.challenges)
  assert.deepEqual(after.views, before.views)
  // recompute de um perfil só: idem
  const res1 = await t.rpc(admin, 'recompute_stats', { p_profile_id: memberA })
  assert.equal(num(res1.profiles), 1)
  assert.deepEqual((await snapshotStats()).season, before.season)
  // colaborador não roda
  await expectError(t.rpc(memberA, 'recompute_stats', {}), 'NOT_ADMIN')
})

test('recompute_stats reproduz first_sale_at: trigger usa coalesce(first_sale_at, occurred_at) (ordem de inserção), recompute usa min(occurred_at) — venda retroativa diverge', async () => {
  const after = await rows('select profile_id, first_sale_at::text as f from public.profile_lifetime_stats order by profile_id')
  assert.deepEqual(after, firstSaleBefore)
})

test('recompute_stats corrige stats adulteradas por fora (drift) — o ledger é a verdade', async () => {
  const before = await snapshotStats()
  await t.sql('update public.profile_season_stats set points = points + 999, sales_amount = 0, activities_count = 0 where profile_id = $1 and season_id = $2', [memberA, activeSeason.id])
  await t.sql('update public.profile_lifetime_stats set coins_earned = 12345, streak_days = 99, best_streak_days = 99, first_sale_at = null where profile_id = $1', [memberA])
  await t.sql('update public.challenge_participants set current_value = -1 where profile_id = $1', [memberA])
  await t.rpc(admin, 'recompute_stats', {})
  const after = await snapshotStats()
  assert.deepEqual(after.season, before.season)
  assert.deepEqual(after.lifetime, before.lifetime)
  assert.deepEqual(after.challenges, before.challenges)
})

test('recompute_streak grava best_streak_days = max(ilhas) (§6.2): um best adulterado para 99 deve voltar ao valor do ledger', async () => {
  const real = await one(`
    with days as (select distinct public.local_day(e.occurred_at) as d from public.point_entries e where e.profile_id = $1 and private.counts_for_streak(e)),
    islands as (select d, d - (row_number() over (order by d))::int as grp from days),
    runs as (select count(*)::int as len from islands group by grp)
    select coalesce(max(len), 0) as best from runs`, [memberA])
  assert.ok(num(real.best) < 99)
  await t.rpc(admin, 'recompute_stats', { p_profile_id: memberA })
  assert.equal(num((await lifetime(memberA)).best_streak_days), num(real.best))
})

// =============================================================================
// 15. Inativação com giro pendente (§7.2 B.17 passo 1, D.49) e aprovação de giro de inativo
// =============================================================================
test('inativar perfil com spin pendente → SPIN_PENDING (nada muda); após reject_spin a inativação remove a vez; approve_spin de inativo → PROFILE_INACTIVE', async () => {
  await setPrizes('classic', pair('10 pontos', 'points', 10))
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberB, p_attempts: 2 })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const spin = await t.rpc(admin, 'spin_wheel', { p_queue_id: q.id })
  await expectError(t.rpc(admin, 'admin_update_profile', { p_profile_id: memberB, p_patch: { status: 'inactive' } }), 'SPIN_PENDING')
  assert.equal((await one('select status from public.profiles where id = $1', [memberB])).status, 'active')
  assert.equal((await one('select status from public.wheel_queue where id = $1', [q.id])).status, 'active')
  // inativação por caminho direto com spin pendente → aprovar falha com PROFILE_INACTIVE; rejeitar fecha o giro
  await t.db.transaction(async (tx) => {
    await tx.exec('set local session_replication_role = replica')
    await tx.query("update public.profiles set status = 'inactive' where id = $1", [memberB])
  })
  await expectError(t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id }), 'PROFILE_INACTIVE')
  await expectError(t.rpcRow(admin, 'release_turn', { p_queue_id: q.id }), /PROFILE_INACTIVE|SPIN_PENDING/)
  const rej = await t.rpc(admin, 'reject_spin', { p_spin_id: spin.spin_id })
  assert.equal(rej.spin.status, 'rejected')
  assert.equal(num(rej.queue.attempts_used), 0)
  // reativa e inativa pela RPC: agora a vez é removida
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberB, p_patch: { status: 'active' } })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberB, p_patch: { status: 'inactive' } })
  const qq = await one('select * from public.wheel_queue where id = $1', [q.id])
  assert.equal(qq.status, 'removed')
  assert.equal(qq.removed_by, admin)
  // transições inválidas
  await expectError(t.rpc(admin, 'admin_update_profile', { p_profile_id: memberB, p_patch: { status: 'pending' } }), 'PROFILE_STATUS_INVALID')
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberB, p_patch: { status: 'active' } })
})
