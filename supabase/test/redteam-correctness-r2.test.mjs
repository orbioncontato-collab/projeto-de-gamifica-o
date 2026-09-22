// RED TEAM round 2 — CORRETUDE. Casos de borda NÃO cobertos pela rodada 1 (DATA-MODEL §4.8/§4.9,
// §5.1/§5.3/§5.4, §6.2, §6.6, §6.7, §6.8, §6.9, §7.4, §7.5, §7.6, Apêndice B e D):
// desempate por vendas e por occurred_at (retroativa), pontos negativos no ranking, streak "envelhecido",
// ajuste manual negativo × streak, retroativa que fecha um buraco do streak, Meta semanal deduplicada por
// semana ISO (inclusive cruzando temporada), contadores coins_earned/coins_spent com estornos, feed de
// level_up com dedupe ao cruzar 2 níveis de uma vez, missão concluída + estorno, desafio por pontos
// (recálculo na ativação, estorno, fato fora da janela), marco de meta por redução da meta (§6.9) e
// conquista META BATIDA contada 1× em achievements_unlocked, blocos de amount_step em lote, roleta
// inativa (WHEEL_INACTIVE/WHEEL_IN_USE), extra_spin na última tentativa, regra inativa, evento inativo
// sobreposto, preferências de notificação, v_team_stats com inativo, v_admin_kpis, temporada fechada ×
// meta, recompute_stats ao final. Um único banco PGlite; ordem dos testes importa. Contas são rótulos.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectError, num } from './pglite-harness.mjs'

let t
let teamCode, admin, mA, mB, mC, mD, mE, mF, mG, activeSeason, prevSeason
let revOfRuleA, lastEntryBefore, lastEntryAfter
let ruleSale, ruleCall, ruleMeetingHeld, ruleMeetingScheduled, ruleWeekly, ruleCrm, xp

const one = async (text, params = []) => (await t.sql(text, params)).rows[0]
const rows = async (text, params = []) => (await t.sql(text, params)).rows
const countRows = async (text, params = []) =>
  Number((await t.sql(`select count(*)::int as n from (${text}) x`, params)).rows[0].n)
const seasonStats = (profileId, seasonId = activeSeason.id) =>
  one('select * from public.profile_season_stats where profile_id = $1 and season_id = $2', [profileId, seasonId])
const lifetime = (profileId) =>
  one('select *, streak_last_day::text as last_day from public.profile_lifetime_stats where profile_id = $1', [profileId])
const profileStats = (profileId, seasonId = activeSeason.id) =>
  one('select * from public.v_profile_stats where profile_id = $1 and season_id = $2', [profileId, seasonId])
const ranking = (seasonId = activeSeason.id) =>
  rows('select * from public.v_ranking where season_id = $1 order by rank', [seasonId])
const iso = (d) => new Date(d).toISOString()
const hoursFromNow = (h) => iso(Date.now() + h * 3600 * 1000)
const daysFromNow = (d) => iso(Date.now() + d * 86400 * 1000)
const manual = (profileId, points, reason, coins = null) =>
  t.rpcRow(admin, 'record_manual_entry', { p_profile_id: profileId, p_points: points, p_reason: reason, p_coins: coins })
const ruleEntry = (profileId, rule, extra = {}) =>
  t.rpcRow(admin, 'record_rule_entry', { p_profile_id: profileId, p_rule_id: rule.id, p_quantity: 1, ...extra })
const sale = (profileId, amount, extra = {}) => ruleEntry(profileId, ruleSale, { p_amount: amount, ...extra })
const reverse = (entryId, reason = 'estorno') => t.rpcRow(admin, 'reverse_entry', { p_entry_id: entryId, p_reason: reason })
const setPrizes = (wheelKind, prizes) =>
  t.rpcRow(admin, 'save_wheel_prizes', {
    p_wheel_kind: wheelKind,
    p_prizes: prizes.map((p, i) => ({ weight: 1, sort_order: i, ...p })),
  })
const pair = (label, kind, value) => [{ label, kind, value }, { label, kind, value }]
const fullSpin = async ({ profileId = null, personName = null, wheelKind = 'classic', attempts = 1 }) => {
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', {
    p_profile_id: profileId, p_person_name: personName, p_wheel_kind: wheelKind, p_attempts: attempts,
  })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const spin = await t.rpc(admin, 'spin_wheel', { p_queue_id: q.id })
  const approved = await t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id })
  return { queue: q, spin, approved }
}
// occurred_at local: dia local D (offset em dias a partir de hoje) às hh:mm, no fuso do app
const localAt = async (dayOffset, hhmm) =>
  (await one(`select ((public.local_today() + $1::int)::text || ' ' || $2)::timestamp at time zone
    (select timezone from public.app_settings where id = 1) as ts`, [dayOffset, hhmm])).ts

before(async () => {
  t = await createTestDb()
  teamCode = (await one('select team_code from public.app_secrets where id = 1')).team_code
  activeSeason = await one('select * from public.seasons where is_active')
  xp = num(activeSeason.xp_per_level)
  const rule = (name) => one('select * from public.point_rules where name = $1 and deleted_at is null', [name])
  ruleSale = await rule('Venda realizada')
  ruleCall = await rule('Ligação realizada')
  ruleMeetingHeld = await rule('Reunião realizada')
  ruleMeetingScheduled = await rule('Reunião agendada')
  ruleWeekly = await rule('Meta semanal')
  ruleCrm = await rule('CRM atualizado')
  assert.ok(activeSeason && ruleSale && ruleCall && ruleMeetingHeld && ruleMeetingScheduled && ruleWeekly && ruleCrm)

  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  await t.rpcRow(admin, 'update_app_settings', { p_patch: { auto_approve_members: true } })
  const member = (label) =>
    t.createAuthUser({ email: `membro-${label}@teste.local`, metadata: { team_code: teamCode, full_name: `Membro ${label.toUpperCase()}` } })
  mA = await member('a'); mB = await member('b'); mC = await member('c'); mD = await member('d')
  mE = await member('e'); mF = await member('f'); mG = await member('g')
  assert.equal(await countRows("select 1 from public.profiles where status = 'active'"), 8)

  const prev = await one(`
    select (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date as starts_on,
           (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 day')::date as ends_on`)
  ;[prevSeason] = await t.rpcRow(admin, 'create_season', { p_name: 'Temporada anterior', p_starts_on: prev.starts_on, p_ends_on: prev.ends_on })
  assert.equal(prevSeason.is_active, false)
})
after(async () => t?.close())

// =============================================================================
// 1. Ranking: desempate por sales_amount e por points_updated_at (retroativa usa occurred_at);
//    pontos negativos ficam abaixo de zero; estorno não mexe no desempate (§4.8, §5.1)
// =============================================================================
test('desempate: mesmos pontos → mais vendas na frente; mesmas vendas → occurred_at mais antigo (retroativa) na frente; negativo fica último', async () => {
  // A: venda 1000 agora; B: venda 500 agora; C: venda 500 ontem (retroativa). Todos: 100 (regra) + 50 (PRIMEIRA VENDA) = 150
  const [eA] = await sale(mA, 1000)
  const [eB] = await sale(mB, 500)
  const [eC] = await sale(mC, 500, { p_occurred_at: hoursFromNow(-30) })
  for (const id of [mA, mB, mC]) assert.equal(num((await seasonStats(id)).points), 150)
  const sC = await seasonStats(mC)
  assert.equal(new Date(sC.points_updated_at).toISOString(), new Date(eC.occurred_at).toISOString(), 'retroativa: points_updated_at = occurred_at, não now()')
  assert.ok(new Date(sC.points_updated_at) < new Date((await seasonStats(mB)).points_updated_at))

  // D: ajuste manual negativo → pontos -50 (abaixo dos zerados)
  await manual(mD, -50, 'penalidade teste')
  const r = await ranking()
  assert.equal(r.length, 8)
  assert.deepEqual(r.slice(0, 3).map((x) => x.profile_id), [mA, mC, mB], 'A (1000 em vendas) > C (500, ontem) > B (500, agora)')
  assert.equal(num(r[1].gap_to_above), 0); assert.equal(r[1].is_tied_with_above, true)
  assert.equal(num(r[2].gap_to_above), 0); assert.equal(r[2].is_tied_with_above, true)
  const last = r[r.length - 1]
  assert.equal(last.profile_id, mD)
  assert.equal(num(last.points), -50)
  assert.equal(num(last.gap_to_above), 50, 'gap contra o 0 acima = 50')
  assert.equal(last.has_points, false)
  assert.equal(num(last.level), 0)
  const dStats = await profileStats(mD)
  assert.equal(num(dStats.xp_in_level), 0, 'greatest(points,0) → xp_in_level 0')
  assert.equal(num(dStats.xp_to_next), xp)
  assert.equal(dStats.points_updated_at ?? null, null, 'ajuste negativo não grava points_updated_at')

  // estorno da venda de A: cai para 50 (conquista PRIMEIRA VENDA não é estornada), points_updated_at intacto
  const before = await seasonStats(mA)
  const [rev] = await reverse(eA.id)
  assert.equal(rev.reverses_entry_id, eA.id)
  revOfRuleA = rev
  const afterA = await seasonStats(mA)
  assert.equal(num(afterA.points), 50)
  assert.equal(num(afterA.points_earned), 50, 'points_earned líquido de estorno')
  assert.equal(num(afterA.sales_amount), 0)
  assert.equal(num(afterA.sales_count), 0)
  assert.equal(new Date(afterA.points_updated_at).toISOString(), new Date(before.points_updated_at).toISOString())
  const r2 = await ranking()
  assert.deepEqual(r2.slice(0, 3).map((x) => x.profile_id), [mC, mB, mA])
  assert.equal(num(r2[2].gap_to_above), 100)
  assert.equal(r2[2].is_tied_with_above, false)
  // B e C ainda empatados; o feed de venda de A permanece (fato histórico), o estorno não cria feed
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'sale' and profile_id = $1", [mA]), 1)
  assert.equal(eB.season_id, activeSeason.id)
})

// =============================================================================
// 2. Streak: pontos iniciais (system) e ajuste negativo não contam; streak "envelhecido" mostra 0 na
//    view mas fica na tabela; buraco zera para 1; retroativa que fecha o buraco recalcula; estorno recalcula (§4.9, §6.2)
// =============================================================================
test('streak: system/negativo não contam; view zera quando streak_last_day < hoje-1; retroativa fecha buraco (ilhas); estorno recalcula best', async () => {
  await t.rpcRow(admin, 'record_initial_points', { p_profile_id: mD, p_points: 100 })
  let ls = await lifetime(mD)
  assert.equal(num(ls.streak_days), 0); assert.equal(ls.last_day, null)
  assert.equal((await seasonStats(mD)).last_entry_at, null, 'system não é entrada de atividade')

  // ligação há 3 dias → streak 1, mas a view mostra 0 (envelhecido)
  const d3 = await localAt(-3, '10:00')
  await ruleEntry(mD, ruleCall, { p_occurred_at: d3 })
  ls = await lifetime(mD)
  assert.equal(num(ls.streak_days), 1)
  assert.equal(ls.last_day, (await one('select (public.local_today() - 3)::text as d')).d)
  assert.equal(num((await profileStats(mD)).streak_days), 0, 'view: streak_last_day < hoje-1 → 0')
  assert.equal(num((await profileStats(mD)).best_streak_days), 1)

  // ontem → buraco (d > last+1) → volta a 1; hoje → 2
  await ruleEntry(mD, ruleCall, { p_occurred_at: await localAt(-1, '10:00') })
  assert.equal(num((await lifetime(mD)).streak_days), 1)
  assert.equal(num((await profileStats(mD)).streak_days), 1, 'ontem ainda conta como streak vivo')
  await ruleEntry(mD, ruleCall)
  assert.equal(num((await lifetime(mD)).streak_days), 2)

  // ajuste negativo hoje e ajuste positivo hoje: nada muda (negativo não conta; positivo no mesmo dia = nada)
  await manual(mD, -10, 'ajuste negativo teste')
  await manual(mD, 10, 'ajuste positivo teste')
  ls = await lifetime(mD)
  assert.equal(num(ls.streak_days), 2)

  // retroativa em hoje-2 fecha o buraco: ilha hoje-3..hoje = 4 dias
  const [gapFill] = await ruleEntry(mD, ruleCall, { p_occurred_at: await localAt(-2, '23:30') })
  ls = await lifetime(mD)
  assert.equal(num(ls.streak_days), 4, 'recompute por ilhas após retroativa')
  assert.equal(num(ls.best_streak_days), 4)
  assert.equal(ls.last_day, (await one('select public.local_today()::text as d')).d)

  // estorno da entry que fechava o buraco → ilhas {1, 2} → streak 2, best = max(ilhas) = 2 (§6.2)
  await reverse(gapFill.id)
  ls = await lifetime(mD)
  assert.equal(num(ls.streak_days), 2)
  assert.equal(num(ls.best_streak_days), 2)
  // last_entry_at da temporada = maior occurred_at das entradas de atividade (hoje)
  const ss = await seasonStats(mD)
  assert.equal((await one('select public.local_day($1::timestamptz)::text as d', [ss.last_entry_at])).d, ls.last_day)
})

test('§7.4: estorno de entry rule/manual/system nasce com source = system (não herda a source da original); v_admin_kpis.entries_count não conta estornos', async () => {
  assert.equal(revOfRuleA.source, 'system', "reverse_entry: source = case when orig.source in ('rule','manual','system') then 'system' else orig.source end")
  // consequência: entries_count (§5.4) = count(source in ('rule','manual')) não deve contar a linha de estorno
  // Nota de implementação: §5.4 filtra `where (select public.is_admin())` dentro da view — sem sessão de
  // gestor (t.sql roda como postgres, auth.uid() nulo) a view devolve zero linhas; consultar como admin.
  const kpi = await t.asUser(admin, async (tx) => (await tx.query('select * from public.v_admin_kpis where season_id = $1', [activeSeason.id])).rows[0])
  const expected = await countRows("select 1 from public.point_entries where season_id = $1 and source in ('rule','manual') and reverses_entry_id is null", [activeSeason.id])
  assert.equal(num(kpi.entries_count), expected)
})

// =============================================================================
// 3. Meta semanal: deduplicada por semana ISO em milestone_awards sem season_id; quantity forçada a 1;
//    semana que cruza a virada de temporada bloqueia (§4.12, §7.4, §13.4)
// =============================================================================
test('weekly_goal: quantity forçada a 1; 2ª vez na mesma semana ISO → MILESTONE_ALREADY_AWARDED; outra semana passa; semana cruzando temporada bloqueia', async () => {
  const [w1] = await ruleEntry(mE, ruleWeekly, { p_quantity: 3 })
  assert.equal(num(w1.quantity), 1, 'p_quantity forçado a 1')
  assert.equal(num(w1.points), 200)
  const week = (await one('select public.iso_week_key(public.local_today()) as w')).w
  const ms = await one("select * from public.milestone_awards where profile_id = $1 and metric = 'weekly_goal'", [mE])
  assert.equal(ms.period_key, week)
  assert.equal(ms.entry_id, w1.id)
  await expectError(ruleEntry(mE, ruleWeekly), 'MILESTONE_ALREADY_AWARDED')
  // outro perfil na mesma semana passa (dedupe é por perfil)
  await ruleEntry(mF, ruleWeekly)
  // semana anterior (7 dias atrás) passa
  const [w2] = await ruleEntry(mE, ruleWeekly, { p_occurred_at: daysFromNow(-7) })
  assert.notEqual((await one('select period_key from public.milestone_awards where entry_id = $1', [w2.id])).period_key, week)
  // estornar a entry não libera a semana (o marco persiste; spec não prevê liberação)
  await reverse(w1.id)
  await expectError(ruleEntry(mE, ruleWeekly), 'MILESTONE_ALREADY_AWARDED')

  // virada de temporada: segunda-feira da semana que contém o dia 1 (se cair no mês anterior) e o dia 1
  const b = await one(`
    select date_trunc('week', d1)::date as monday, d1
    from (select date_trunc('month', public.local_today())::date as d1) x`)
  if (b.monday < b.d1) {
    const inPrev = await one(`select ($1::date::text || ' 12:00')::timestamp at time zone (select timezone from public.app_settings where id = 1) as ts`, [b.monday])
    const inCur = await one(`select ($1::date::text || ' 12:00')::timestamp at time zone (select timezone from public.app_settings where id = 1) as ts`, [b.d1])
    const [wp] = await ruleEntry(mG, ruleWeekly, { p_occurred_at: inPrev.ts })
    assert.equal(wp.season_id, prevSeason.id, 'entry na temporada anterior')
    await expectError(ruleEntry(mG, ruleWeekly, { p_occurred_at: inCur.ts }), 'MILESTONE_ALREADY_AWARDED')
    const key = (await one('select public.iso_week_key($1::date) as w', [b.monday])).w
    assert.equal((await one('select period_key from public.milestone_awards where entry_id = $1', [wp.id])).period_key, key)
    assert.equal(num((await seasonStats(mG, prevSeason.id)).points), 200, 'stats da temporada anterior recebem o marco')
    assert.equal((await seasonStats(mG)) ?? null, null, 'temporada ativa intocada')
  }
})

// =============================================================================
// 4. Contadores de moedas com estorno: coins_earned/coins_spent líquidos (§6.7 A), defaults de
//    record_manual_entry (§7.4, B.3), carteira em v_wallet
// =============================================================================
test('coins: manual + default coins=points; manual − default coins=0; estorno do débito devolve coins_spent; estorno do crédito devolve coins_earned', async () => {
  const [plus] = await manual(mE, 300, 'crédito teste')
  assert.equal(num(plus.coins), 300, 'coins default = points quando positivo')
  const [minusNoCoins] = await manual(mE, -20, 'sem confisco')
  assert.equal(num(minusNoCoins.coins), 0, 'ajuste negativo não confisca moedas por padrão (B.3)')
  const [debit] = await manual(mE, -10, 'débito explícito', -100)
  assert.equal(num(debit.coins), -100)
  let ss = await seasonStats(mE)
  let ls = await lifetime(mE)
  // 200 + 200 (metas semanais) - 200 (estorno) = 200 ganhas antes; +300 agora
  assert.equal(num(ss.coins_earned), 500); assert.equal(num(ss.coins_spent), 100)
  assert.equal(num(ls.coins_earned), 500); assert.equal(num(ls.coins_spent), 100); assert.equal(num(ls.coins_balance), 400)
  assert.equal(num(ss.points_earned), 200 + 300, 'points_earned líquido: 200 (semana passada) + 300; o 200 estornado saiu')

  const [revDebit] = await reverse(debit.id)
  assert.equal(num(revDebit.coins), 100); assert.equal(num(revDebit.points), 10)
  ss = await seasonStats(mE); ls = await lifetime(mE)
  assert.equal(num(ss.coins_spent), 0, 'estorno de débito desfaz coins_spent (não soma em coins_earned)')
  assert.equal(num(ss.coins_earned), 500)
  assert.equal(num(ls.coins_balance), 500)

  const [revPlus] = await reverse(plus.id)
  assert.equal(num(revPlus.coins), -300)
  ss = await seasonStats(mE); ls = await lifetime(mE)
  assert.equal(num(ss.coins_earned), 200, 'estorno de crédito desfaz coins_earned (não soma em coins_spent)')
  assert.equal(num(ss.coins_spent), 0)
  assert.equal(num(ls.coins_balance), 200)
  const wallet = await one('select * from public.v_wallet where profile_id = $1', [mE])
  assert.equal(num(wallet.coins_balance), 200)
  assert.equal(num(wallet.coins_spent), 0)
  assert.equal(num((await one("select coalesce(sum(coins),0)::int as c from public.point_entries where profile_id = $1", [mE])).c), 200, 'ledger = carteira')
  // estornar um estorno e estornar de novo a mesma entry
  await expectError(reverse(revPlus.id), 'CANNOT_REVERSE_REVERSAL')
  await expectError(reverse(plus.id), 'ALREADY_REVERSED')
})

// =============================================================================
// 5. Level-up: cruzar 2 níveis numa entry gera 2 feed_events e 1 notificação; estorno + novo cruzamento
//    não duplica o feed (dedupe_key); pontos abaixo de zero não geram nível (§6.7 D)
// =============================================================================
test('level_up: +2 níveis numa entry → 2 eventos (1→2 em ordem) e 1 notificação "Nível 2"; recruzar após estorno não duplica; negativo não gera', async () => {
  const startPts = num((await seasonStats(mF))?.points ?? 0) // 200 (meta semanal)
  const target = 2 * xp + 50 - startPts // termina em nível 2
  const [big] = await manual(mF, target, 'salto de 2 níveis')
  const ev = await rows("select payload from public.feed_events where kind = 'level_up' and profile_id = $1 and season_id = $2 order by created_at, (payload->>'to_level')::int", [mF, activeSeason.id])
  assert.deepEqual(ev.map((e) => [num(e.payload.from_level), num(e.payload.to_level)]), [[0, 1], [1, 2]])
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and kind = 'level' and message = 'Nível 2'", [mF]), 1)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and kind = 'level'", [mF]), 1, 'uma notificação por entry')
  assert.equal(num((await profileStats(mF)).level), 2)
  // estorno → nível 0; nova entry recruza 1 e 2 → feed continua com 2 linhas (dedupe), notificação nova
  await reverse(big.id)
  assert.equal(num((await profileStats(mF)).level), 0)
  await manual(mF, target, 'recruza')
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'level_up' and profile_id = $1 and season_id = $2", [mF, activeSeason.id]), 2)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and kind = 'level'", [mF]), 2)
  // D está negativo: +xp-1 a partir de negativo não cruza nível (greatest(points_after - NEW.points, 0))
  const dNow = num((await seasonStats(mD)).points)
  if (dNow + 50 > 0) await manual(mD, -(dNow + 50), 'leva D para -50')
  const dPts = num((await seasonStats(mD)).points)
  assert.equal(dPts, -50)
  await manual(mD, xp - 1 - dPts - 1, 'sobe até xp-2') // termina em xp-2 → nível 0
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'level_up' and profile_id = $1", [mD]), 0)
  await manual(mD, 2, 'cruza para nível 1') // xp → nível 1
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'level_up' and profile_id = $1", [mD]), 1)
})

// =============================================================================
// 6. Missão concluída + estorno: value cai, completed_at fica, recompensa não é estornada, missions_completed
//    não decrementa; nova entry não conclui de novo; estorno de fato anterior à janela não mexe (§6.7 B2)
// =============================================================================
let missionCalls
test('missão: estorno após conclusão reduz value mas mantém completed_at/recompensa; entry seguinte não reconclui; retroativa fora da janela não progride', async () => {
  const win = { starts_at: hoursFromNow(-2), ends_at: hoursFromNow(6) }
  ;[missionCalls] = await t.rpcRow(admin, 'save_mission', {
    p: { title: 'Duas ligações', kind: 'special', metric: 'call', target_kind: 'count', target_value: 2, reward_points: 40, reward_coins: 40, ...win },
  })
  const [c1] = await ruleEntry(mE, ruleCall)
  await ruleEntry(mE, ruleCall)
  let mp = await one('select * from public.mission_progress where mission_id = $1 and profile_id = $2', [missionCalls.id, mE])
  assert.equal(num(mp.value), 2); assert.ok(mp.completed_at)
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'mission' and reason = 'Duas ligações'", [mE]), 1)
  assert.equal(num((await seasonStats(mE)).missions_completed), 1)

  await reverse(c1.id)
  mp = await one('select * from public.mission_progress where mission_id = $1 and profile_id = $2', [missionCalls.id, mE])
  assert.equal(num(mp.value), 1, 'estorno reduz o progresso no mesmo período')
  assert.ok(mp.completed_at, 'conclusão não é desfeita')
  assert.equal(num((await seasonStats(mE)).missions_completed), 1)
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'mission'", [mE]), 1, 'recompensa da missão não é estornada')

  await ruleEntry(mE, ruleCall)
  mp = await one('select * from public.mission_progress where mission_id = $1 and profile_id = $2', [missionCalls.id, mE])
  assert.equal(num(mp.value), 2)
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'mission'", [mE]), 1, 'não credita de novo (completed_at not null)')
  // retroativa de antes da janela: não progride
  await ruleEntry(mE, ruleCall, { p_occurred_at: hoursFromNow(-3) })
  mp = await one('select * from public.mission_progress where mission_id = $1 and profile_id = $2', [missionCalls.id, mE])
  assert.equal(num(mp.value), 2)
  // mudar target com progresso existente → MISSION_HAS_PROGRESS; mudar só o título passa
  await expectError(t.rpcRow(admin, 'save_mission', { p: { id: missionCalls.id, title: 'Duas ligações', kind: 'special', metric: 'call', target_kind: 'count', target_value: 3, ...win } }), 'MISSION_HAS_PROGRESS')
  const [renamed] = await t.rpcRow(admin, 'save_mission', { p: { id: missionCalls.id, title: 'Duas ligações (v2)', kind: 'special', metric: 'call', target_kind: 'count', target_value: 2, ...win } })
  assert.equal(renamed.title, 'Duas ligações (v2)')
})

// =============================================================================
// 7. Desafio por pontos: activate_challenge recalcula a partir do ledger; entries de missão/manual contam;
//    estorno subtrai; fato anterior à janela não conta; finish grava challenge_results (§6.7 C, §7.5)
// =============================================================================
test('desafio points: recálculo na ativação, manual e mission contam, estorno subtrai, retroativa fora da janela não conta, finish_challenge idempotente', async () => {
  const starts = hoursFromNow(-1)
  // E já tem entries na última hora (ligações, missão, ajustes); esperado = soma de points em [starts, now)
  const [duel] = await t.rpcRow(admin, 'save_challenge', {
    p: { name: 'Duelo de pontos', kind: 'duel', metric: 'points', target_value: 1, reward_points: 30, reward_coins: 0, starts_at: starts, ends_at: hoursFromNow(3), participant_ids: [mE, mG] },
  })
  assert.equal(num((await one('select current_value from public.challenge_participants where challenge_id = $1 and profile_id = $2', [duel.id, mE])).current_value), 0)
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: duel.id })
  const expectedE = num((await one("select coalesce(sum(points),0)::int as p from public.point_entries where profile_id = $1 and source <> 'reward' and occurred_at >= $2 and occurred_at < now()", [mE, starts])).p)
  const cv = async (pid) => num((await one('select current_value from public.challenge_participants where challenge_id = $1 and profile_id = $2', [duel.id, pid])).current_value)
  assert.equal(await cv(mE), expectedE, 'ativação recalcula a partir do ledger')
  assert.equal(await cv(mG), 0)

  const [m1] = await manual(mG, 70, 'manual conta em points')
  assert.equal(await cv(mG), 70)
  await manual(mG, -20, 'negativo também')
  assert.equal(await cv(mG), 50)
  await reverse(m1.id)
  assert.equal(await cv(mG), -20, 'estorno subtrai o valor original')
  await ruleEntry(mG, ruleCall, { p_occurred_at: hoursFromNow(-2) }) // antes da janela
  assert.equal(await cv(mG), -20)
  const [inWin] = await ruleEntry(mG, ruleCall) // +5 e conclui a missão "Duas ligações" (2ª ligação dentro da janela dela) → +40 mission
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'mission'", [mG]), 1)
  assert.equal(await cv(mG), 25, '-20 + 5 (regra) + 40 (missão conta em metric points)')
  assert.equal(inWin.season_id, activeSeason.id)

  const result = await t.rpc(admin, 'finish_challenge', { p_challenge_id: duel.id })
  assert.deepEqual(result.winner_ids, [mE], 'E > G')
  const rE = result.results.find((r) => r.profile_id === mE)
  const rG = result.results.find((r) => r.profile_id === mG)
  assert.equal(num(rE.final_value), await cv(mE)); assert.equal(rE.is_winner, true); assert.ok(rE.entry_id)
  assert.equal(num(rG.final_value), 25); assert.equal(rG.is_winner, false); assert.equal(rG.entry_id, null)
  assert.equal(await countRows('select 1 from public.challenge_results where challenge_id = $1', [duel.id]), 2)
  const prize = await one('select * from public.point_entries where id = $1', [rE.entry_id])
  assert.equal(prize.source, 'challenge'); assert.equal(num(prize.points), 30)
  assert.ok(new Date(prize.occurred_at) <= new Date(), 'occurred_at = least(now, ends_at-1s)')
  await expectError(t.rpc(admin, 'finish_challenge', { p_challenge_id: duel.id }), 'CHALLENGE_NOT_ACTIVE')
  // entry após finished não altera final_value
  await manual(mG, 100, 'depois do fim')
  assert.equal(num((await one('select final_value from public.challenge_results where challenge_id = $1 and profile_id = $2', [duel.id, mG])).final_value), 25)
})

// =============================================================================
// 8. Marco "Meta mensal" + META BATIDA (§6.9): ao vivo, por redução da meta (trigger em season_goals /
//    admin_update_profile), idempotente; conquista de temporada em 2 temporadas conta 1 em achievements_unlocked (§5.1)
// =============================================================================
test('meta: bater ao vivo → marco +500/+500 e META BATIDA +200/+200 uma vez; reduzir a meta abaixo das vendas concede; 2 temporadas = 1 em achievements_unlocked', async () => {
  const goalEntries = (pid, sid = activeSeason.id) =>
    countRows("select 1 from public.point_entries where profile_id = $1 and season_id = $2 and source = 'system' and metric = 'monthly_goal'", [pid, sid])
  const goalAch = (pid) =>
    countRows("select 1 from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id where pa.profile_id = $1 and a.criteria = 'monthly_goal'", [pid])
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: mF, p_patch: { goal_amount: 5000 } })
  assert.equal(await goalEntries(mF), 0)
  const [s1] = await sale(mF, 6000, { p_occurred_at: hoursFromNow(-1) })
  assert.equal(await goalEntries(mF), 1)
  const ms = await one("select * from public.milestone_awards where profile_id = $1 and metric = 'monthly_goal' and season_id = $2", [mF, activeSeason.id])
  assert.equal(ms.period_key, 'season')
  const me = await one('select * from public.point_entries where id = $1', [ms.entry_id])
  assert.equal(num(me.points), 500); assert.equal(num(me.coins), 500)
  assert.equal(new Date(me.occurred_at).toISOString(), new Date(s1.occurred_at).toISOString(), 'marco herda occurred_at da venda')
  assert.equal(await goalAch(mF), 1)
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'achievement' and reason = 'META BATIDA'", [mF]), 1)
  // meta sobe acima das vendas → nada é removido; nova venda → sem 2º marco; meta cai de novo → idem
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: mF, p_patch: { goal_amount: 20000 } })
  await sale(mF, 1000)
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: mF, p_patch: { goal_amount: 100 } })
  assert.equal(await goalEntries(mF), 1); assert.equal(await goalAch(mF), 1)
  const ps = await profileStats(mF)
  assert.equal(num(ps.goal_amount), 100)
  assert.equal(num(ps.goal_pct), 999.99, 'teto')
  assert.equal(num(ps.goal_missing_amount), 0)
  assert.equal(ps.projected_goal_date, null, 'meta já batida → NULL')

  // por redução: E vende 2000 com meta 0 (nada); meta 1500 → marco via admin_update_profile/trigger
  assert.equal(num((await profileStats(mE)).goal_amount), 0)
  await sale(mE, 2000)
  assert.equal(await goalEntries(mE), 0)
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: mE, p_patch: { goal_amount: 1500 } })
  assert.equal(await goalEntries(mE), 1); assert.equal(await goalAch(mE), 1)
  // meta igual às vendas (>=) também conta; meta 0 nunca
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: mB, p_patch: { goal_amount: 500 } })
  assert.equal(await goalEntries(mB), 1, 'sales 500 >= goal 500')
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: mC, p_patch: { goal_amount: 0 } })
  assert.equal(await goalEntries(mC), 0)

  // temporada anterior: venda retroativa de F + meta editada direto em season_goals → marco na temporada anterior
  const prevMid = await one('select starts_at + interval \'2 days\' as ts from public.seasons where id = $1', [prevSeason.id])
  await sale(mF, 3000, { p_occurred_at: prevMid.ts })
  await t.sql('update public.season_goals set goal_amount = 2500 where season_id = $1 and profile_id = $2', [prevSeason.id, mF])
  assert.equal(await goalEntries(mF, prevSeason.id), 1)
  const pm = await one("select e.* from public.milestone_awards m join public.point_entries e on e.id = m.entry_id where m.profile_id = $1 and m.metric = 'monthly_goal' and m.season_id = $2", [mF, prevSeason.id])
  assert.equal(pm.season_id, prevSeason.id)
  assert.ok(new Date(pm.occurred_at) < new Date(prevSeason.ends_at), 'occurred_at = least(now, ends_at-1s) cai dentro da temporada anterior')
  assert.equal(await goalAch(mF), 2, 'META BATIDA é por temporada')
  const distinct = num((await one(`select count(distinct pa.achievement_id)::int as n from public.profile_achievements pa
    join public.achievements a on a.id = pa.achievement_id and a.is_active and a.deleted_at is null where pa.profile_id = $1`, [mF])).n)
  assert.equal(num((await profileStats(mF)).achievements_unlocked), distinct)
  assert.equal(num((await profileStats(mF, prevSeason.id)).achievements_unlocked), distinct, 'contagem é global, igual em qualquer temporada')
  assert.ok(distinct < num((await one("select count(*)::int as n from public.profile_achievements where profile_id = $1", [mF])).n))
})

// =============================================================================
// 9. amount_step em lote: venda que cruza 2 blocos gera 2 marcos com occurred_at da venda; estorno não remove;
//    venda seguinte só concede o bloco novo (§6.7 B1)
// =============================================================================
test('amount_step: R$ 25.000 → blocos 1 e 2 de uma vez (occurred_at da venda); estorno mantém marcos; 31.000 acumulados → só bloco 3', async () => {
  const blocks = () => rows("select m.period_key, e.occurred_at, e.points, e.coins from public.milestone_awards m join public.point_entries e on e.id = m.entry_id where m.profile_id = $1 and m.metric = 'amount_step' order by m.period_key", [mG])
  const [big] = await sale(mG, 25000, { p_occurred_at: hoursFromNow(-1) })
  let b = await blocks()
  assert.deepEqual(b.map((x) => x.period_key), ['block:1', 'block:2'])
  assert.ok(b.every((x) => new Date(x.occurred_at).toISOString() === new Date(big.occurred_at).toISOString() && num(x.points) === 150 && num(x.coins) === 150))
  await reverse(big.id)
  assert.equal(num((await seasonStats(mG)).sales_amount), 0)
  assert.equal((await blocks()).length, 2, 'estorno da venda não remove marcos já concedidos')
  await sale(mG, 1000)
  assert.equal((await blocks()).length, 2)
  await sale(mG, 30000)
  b = await blocks()
  assert.deepEqual(b.map((x) => x.period_key), ['block:1', 'block:2', 'block:3'], '31.000 → 3 blocos; 1 e 2 já existiam')
  // conquista 50K CLUB não (vitalício 31.000 líquido... o estorno tirou 25.000: 6.000 + 25.000 = 31.000)
  assert.equal(num((await lifetime(mG)).sales_amount), 31000)
  assert.equal(await countRows("select 1 from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id where pa.profile_id = $1 and a.code = 'club_50k'", [mG]), 0)
})

// =============================================================================
// 10. Roleta: extra_spin na ÚLTIMA tentativa mantém a vez ativa (não vira done); WHEEL_IN_USE com fila /
//     missão vigente; roleta inativa → WHEEL_INACTIVE em enqueue, giro livre, missão; reativar exige prêmios (§4.21, §6.8, §7.6)
// =============================================================================
const spinUntil = async (queueId, wantKind) => {
  for (let i = 0; i < 40; i++) {
    const spin = await t.rpc(admin, 'spin_wheel', { p_queue_id: queueId })
    if (!wantKind || spin.resolved_prize.kind === wantKind) return spin
    await t.rpc(admin, 'reject_spin', { p_spin_id: spin.spin_id })
  }
  throw new Error('não saiu ' + wantKind + ' em 40 giros')
}
test('roleta: extra_spin na última tentativa → attempts 2, usada 1, vez continua active; WHEEL_IN_USE (fila, missão vigente); WHEEL_INACTIVE; reativação', async () => {
  await setPrizes('classic', [{ label: 'Giro extra', kind: 'extra_spin', value: null, weight: 5 }, { label: '10 pontos', kind: 'points', value: 10, weight: 1 }])
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: mA, p_wheel_kind: 'classic', p_attempts: 1 })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const spin = await spinUntil(q.id, 'extra_spin')
  const ap = await t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id })
  assert.equal(ap.spin.credited, true)
  assert.equal(num(ap.queue.attempts_allowed), 2); assert.equal(num(ap.queue.attempts_used), 1)
  assert.equal(ap.queue.status, 'active', 'attempts_used (1) < attempts_allowed (2) → não encerra')
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'wheel'", [mA]), 0, 'extra_spin não gera entry')
  // 2ª tentativa: pontos → done
  const spin2 = await spinUntil(q.id, 'points')
  const ap2 = await t.rpc(admin, 'approve_spin', { p_spin_id: spin2.spin_id })
  assert.equal(ap2.queue.status, 'done')
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'wheel' and points = 10", [mA]), 1)
  await expectError(t.rpc(admin, 'spin_wheel', { p_queue_id: q.id }), 'NO_ACTIVE_TURN')

  // WHEEL_IN_USE: fila waiting
  const [q2] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: mB, p_wheel_kind: 'classic', p_attempts: 1 })
  await expectError(t.sql("update public.wheels set is_active = false where kind = 'classic'"), 'WHEEL_IN_USE')
  await t.rpcRow(admin, 'remove_from_queue', { p_queue_id: q2.id })
  // WHEEL_IN_USE: missão vigente com reward_spin classic
  const [mSpin] = await t.rpcRow(admin, 'save_mission', {
    p: { title: 'Giro por CRM', kind: 'daily', metric: 'crm_update', target_kind: 'count', target_value: 1, reward_spin: 'classic', starts_at: hoursFromNow(-1), ends_at: hoursFromNow(2) },
  })
  await expectError(t.sql("update public.wheels set is_active = false where kind = 'classic'"), 'WHEEL_IN_USE')
  await t.rpcRow(admin, 'delete_mission', { p_mission_id: mSpin.id })
  await t.sql("update public.wheels set is_active = false where kind = 'classic'")
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: mB, p_wheel_kind: 'classic', p_attempts: 1 }), 'WHEEL_INACTIVE')
  await expectError(t.rpc(mB, 'spin_wheel_free', { p_wheel_kind: 'classic' }), 'WHEEL_INACTIVE')
  await expectError(t.rpcRow(admin, 'save_mission', {
    p: { title: 'Giro inativo', kind: 'daily', metric: 'crm_update', target_kind: 'count', target_value: 1, reward_spin: 'classic', starts_at: hoursFromNow(-1), ends_at: hoursFromNow(2) },
  }), 'WHEEL_INACTIVE')
  await expectError(t.rpcRow(admin, 'save_challenge', {
    p: { name: 'Duelo giro', kind: 'duel', metric: 'sales_count', target_value: 1, reward_spin: 'classic', starts_at: hoursFromNow(-1), ends_at: hoursFromNow(2), participant_ids: [mA, mB] },
  }), 'WHEEL_INACTIVE')
  // fila premium existente + update_queue_entry para roleta inativa → WHEEL_INACTIVE
  const [qp] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: mB, p_wheel_kind: 'premium', p_attempts: 1 })
  await expectError(t.rpcRow(admin, 'update_queue_entry', { p_queue_id: qp.id, p_wheel_kind: 'classic' }), 'WHEEL_INACTIVE')
  await t.rpcRow(admin, 'remove_from_queue', { p_queue_id: qp.id })
  // reativar: roleta inativa aceita ficar sem prêmios (assert só quando is_active); reativar sem prêmios → MIN_PRIZES
  const classic = await one("select id from public.wheels where kind = 'classic'")
  await t.sql('update public.wheel_prizes set deleted_at = now(), is_active = false where wheel_id = $1', [classic.id])
  await expectError(t.sql("update public.wheels set is_active = true where kind = 'classic'"), 'MIN_PRIZES')
  await t.sql("update public.wheels set is_active = true where kind = 'classic'").catch(() => {})
  assert.equal((await one("select is_active from public.wheels where kind = 'classic'")).is_active, false)
  // save_wheel_prizes com a roleta inativa e depois reativar
  await setPrizes('classic', pair('50 pontos', 'points', 50))
  await t.sql("update public.wheels set is_active = true where kind = 'classic'")
  assert.equal((await one("select is_active from public.wheels where kind = 'classic'")).is_active, true)
  assert.equal(await countRows('select 1 from public.wheel_prizes where wheel_id = $1 and deleted_at is null and is_active', [classic.id]), 2)
})

// =============================================================================
// 11. Regra inativa / deletada, evento inativo sobreposto, preferências de notificação (§6.6, §6.2 notify)
// =============================================================================
test('RULE_INACTIVE e RULE_NOT_FOUND (soft delete); evento inativo pode sobrepor e é ignorado; notifications=false silencia; event_alerts=false silencia só evento', async () => {
  await t.sql('update public.point_rules set is_active = false where id = $1', [ruleCrm.id])
  await expectError(ruleEntry(mA, ruleCrm), 'RULE_INACTIVE')
  await t.sql('update public.point_rules set is_active = true, deleted_at = now() where id = $1', [ruleCrm.id])
  await expectError(ruleEntry(mA, ruleCrm), 'RULE_NOT_FOUND')
  await t.sql('update public.point_rules set deleted_at = null where id = $1', [ruleCrm.id])

  // evento ativo 2x e evento inativo 5x na mesma janela: sem EVENT_OVERLAP; multiplicador = 2
  const [evOn] = await t.rpcRow(admin, 'save_special_event', { p: { name: 'Ativo 2x', multiplier: 2, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1) } })
  const [evOff] = await t.rpcRow(admin, 'save_special_event', { p: { name: 'Inativo 5x', multiplier: 5, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1), is_active: false } })
  const [e] = await ruleEntry(mA, ruleCrm)
  assert.equal(num(e.multiplier), 2); assert.equal(e.special_event_id, evOn.id)
  // ativar o inativo por cima do ativo → EVENT_OVERLAP
  await expectError(t.rpcRow(admin, 'save_special_event', { p: { id: evOff.id, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1), is_active: true } }), 'EVENT_OVERLAP')
  // notificação de evento: só is_active e ends_at > now; evento inativo não notifica ninguém
  assert.equal(await countRows("select 1 from public.notifications where kind = 'event' and title = 'Inativo 5x'"), 0)
  assert.ok(await countRows("select 1 from public.notifications where kind = 'event' and title = 'Ativo 2x'") >= 7)
  await t.rpcRow(admin, 'save_special_event', { p: { id: evOn.id, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1), is_active: false } })

  // preferências: C sem notificações → nada; D sem event_alerts → recebe 'system' mas não 'event'
  await t.sql(`update public.profiles set preferences = '{"notifications": false, "event_alerts": true}' where id = $1`, [mC])
  await t.sql(`update public.profiles set preferences = '{"notifications": true, "event_alerts": false}' where id = $1`, [mD])
  const beforeC = await countRows('select 1 from public.notifications where profile_id = $1', [mC])
  const beforeD = await countRows('select 1 from public.notifications where profile_id = $1', [mD])
  await manual(mC, -5, 'ajuste silencioso')
  await manual(mD, -5, 'ajuste com aviso')
  await t.rpcRow(admin, 'save_special_event', { p: { name: 'Só alerta', multiplier: 2, starts_at: hoursFromNow(2), ends_at: hoursFromNow(3) } })
  assert.equal(await countRows('select 1 from public.notifications where profile_id = $1', [mC]), beforeC, 'notifications=false: nada')
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and kind = 'system' and title = 'Ajuste de pontos'", [mD]) > 0, true)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and kind = 'event' and title = 'Só alerta'", [mD]), 0, 'event_alerts=false')
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and kind = 'event' and title = 'Só alerta'", [mA]), 1)
  assert.equal(await countRows('select 1 from public.notifications where profile_id = $1', [mD]), beforeD + 1)
  await t.sql(`update public.profiles set preferences = '{"notifications": true, "event_alerts": true}' where id = any($1::uuid[])`, [[mC, mD]])
})

// =============================================================================
// 12. Conversão com reunião e zero vendas = 0 (não NULL); comparecimento > 100%; v_team_stats: vendas de
//     inativo continuam na soma, médias/percentuais só sobre ativos (§5.1, §5.3)
// =============================================================================
test('conversion_pct 0.00 com reunião sem venda (volta a NULL após estorno); attendance 200%; v_team_stats com inativo: soma mantém, active_count/avg/crm só ativos', async () => {
  const [held] = await ruleEntry(mD, ruleMeetingHeld)
  let ps = await profileStats(mD)
  assert.equal(num(ps.conversion_pct), 0, 'meetings_held > 0 e sales_count 0 → 0.00')
  assert.equal(ps.attendance_pct, null, 'sem agendadas → NULL')
  await ruleEntry(mD, ruleMeetingScheduled)
  await ruleEntry(mD, ruleMeetingHeld)
  ps = await profileStats(mD)
  assert.equal(num(ps.attendance_pct), 200, '2 realizadas / 1 agendada')
  await reverse(held.id)
  ps = await profileStats(mD)
  assert.equal(num(ps.meetings_held), 1); assert.equal(num(ps.attendance_pct), 100)
  const [held2] = await ruleEntry(mD, ruleMeetingHeld)
  await reverse(held2.id)
  await reverse((await one("select id from public.point_entries where profile_id = $1 and metric = 'meeting_held' and reverses_entry_id is null and not exists (select 1 from public.point_entries r where r.reverses_entry_id = point_entries.id)", [mD])).id)
  ps = await profileStats(mD)
  assert.equal(num(ps.meetings_held), 0)
  assert.equal(ps.conversion_pct, null, 'sem reuniões → NULL de novo')

  // time: inativar F (vendas 7.000 na ativa, com reunião? não) — soma continua, active_count cai
  const before = await one('select * from public.v_team_stats where season_id = $1', [activeSeason.id])
  const fSales = num((await seasonStats(mF)).sales_amount)
  assert.ok(fSales > 0)
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: mF, p_patch: { status: 'inactive' } })
  const after = await one('select * from public.v_team_stats where season_id = $1', [activeSeason.id])
  assert.equal(num(after.sales_amount), num(before.sales_amount), 'venda de inativo continua na soma')
  assert.equal(num(after.active_count), num(before.active_count) - 1)
  assert.equal(num(after.total_count), num(before.total_count))
  assert.equal(num(after.points_total), num(before.points_total), 'pontos de inativo continuam na soma')
  // crm_pct = ativos com crm_updates > 0 / ativos
  const crm = await one(`select count(distinct ss.profile_id)::int as n from public.profile_season_stats ss join public.profiles p on p.id = ss.profile_id
    where ss.season_id = $1 and ss.crm_updates > 0 and p.status = 'active'`, [activeSeason.id])
  assert.equal(num(after.crm_pct), Number((num(crm.n) / num(after.active_count) * 100).toFixed(2)))
  // avg_conversion_pct só ativos com meetings_held > 0: ninguém → NULL (D zerou, F inativo sem reunião)
  const conv = await one(`select round(avg(ss.sales_count::numeric / nullif(ss.meetings_held, 0)) * 100, 2) as v from public.profile_season_stats ss
    join public.profiles p on p.id = ss.profile_id where ss.season_id = $1 and ss.meetings_held > 0 and p.status = 'active'`, [activeSeason.id])
  assert.equal(after.avg_conversion_pct === null ? null : num(after.avg_conversion_pct), conv.v === null ? null : num(conv.v))
  // F inativo some do ranking; lançar para F → PROFILE_INACTIVE; enfileirar → PROFILE_INACTIVE
  assert.equal(await countRows('select 1 from public.v_ranking where profile_id = $1', [mF]), 0)
  assert.equal((await profileStats(mF)).rank, null)
  await expectError(sale(mF, 100), 'PROFILE_INACTIVE')
  await expectError(t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: mF, p_wheel_kind: 'premium', p_attempts: 1 }), 'PROFILE_INACTIVE')
  await expectError(t.rpcRow(admin, 'record_initial_points', { p_profile_id: mF, p_points: 10 }), 'PROFILE_INACTIVE')
  // estorno de entry de inativo continua permitido (correção histórica)
  const fEntry = await one("select id from public.point_entries where profile_id = $1 and source = 'rule' and reverses_entry_id is null and season_id = $2 order by created_at desc limit 1", [mF, activeSeason.id])
  await reverse(fEntry.id)
})

// =============================================================================
// 13. update_season: encolher deixando entries/janelas fora, sobreposição via update; fechamento e meta
//     em temporada fechada (§6.9 passo 1), retroativa em temporada fechada (§6.6)
// =============================================================================
test('update_season: SEASON_HAS_ENTRIES_OUTSIDE, SEASON_HAS_WINDOWS_OUTSIDE, SEASON_OVERLAP; após close: meta reduzida não gera marco, retroativa → SEASON_CLOSED', async () => {
  const today = (await one('select public.local_today()::text as d')).d
  await expectError(t.rpcRow(admin, 'update_season', { p_season_id: activeSeason.id, p_patch: { starts_on: today } }), 'SEASON_HAS_ENTRIES_OUTSIDE')
  const [longMission] = await t.rpcRow(admin, 'save_mission', {
    p: { title: 'Longa', kind: 'special', metric: 'call', target_kind: 'count', target_value: 99, reward_points: 1, starts_at: hoursFromNow(1), ends_at: daysFromNow(3) },
  })
  const dayAfter = (await one('select (public.local_today() + 1)::text as d')).d
  await expectError(t.rpcRow(admin, 'update_season', { p_season_id: activeSeason.id, p_patch: { ends_on: dayAfter } }), 'SEASON_HAS_WINDOWS_OUTSIDE')
  await t.rpcRow(admin, 'delete_mission', { p_mission_id: longMission.id })
  // estender a anterior por cima da ativa → SEASON_OVERLAP
  await expectError(t.rpcRow(admin, 'update_season', { p_season_id: prevSeason.id, p_patch: { ends_on: today } }), 'SEASON_OVERLAP')
  const prevStart = (await one('select public.local_day(starts_at)::text as d from public.seasons where id = $1', [prevSeason.id])).d
  await expectError(t.rpcRow(admin, 'update_season', { p_season_id: prevSeason.id, p_patch: { ends_on: prevStart } }), 'SEASON_HAS_ENTRIES_OUTSIDE')

  // A vende 1000 na temporada anterior (meta 0) e a temporada fecha
  const prevMid = await one("select starts_at + interval '3 days' as ts from public.seasons where id = $1", [prevSeason.id])
  await sale(mA, 1000, { p_occurred_at: prevMid.ts })
  const closed = await t.rpc(admin, 'close_season', { p_season_id: prevSeason.id })
  assert.equal(closed.season_id, prevSeason.id)
  const resA = closed.results.find((r) => r.profile_id === mA)
  assert.equal(num(resA.sales_amount), 1000); assert.equal(resA.goal_reached, false)
  const resF = closed.results.find((r) => r.profile_id === mF)
  assert.ok(resF, 'inativo com stats entra no snapshot')
  assert.equal(resF.final_rank, null)
  assert.equal(resF.goal_reached, true, '3000 >= 2500')
  // meta reduzida numa temporada fechada não gera marco nem conquista (§6.9 passo 1)
  const goalEntries = (pid) => countRows("select 1 from public.point_entries where profile_id = $1 and season_id = $2 and metric = 'monthly_goal'", [pid, prevSeason.id])
  assert.equal(await goalEntries(mA), 0)
  await t.sql('update public.season_goals set goal_amount = 500 where season_id = $1 and profile_id = $2', [prevSeason.id, mA])
  assert.equal(await goalEntries(mA), 0, 'temporada fechada → return')
  assert.equal(await countRows("select 1 from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id where pa.profile_id = $1 and a.criteria = 'monthly_goal' and pa.season_id = $2", [mA, prevSeason.id]), 0)
  // retroativa dentro da temporada fechada → SEASON_CLOSED (data válida, < 90 dias)
  await expectError(sale(mA, 100, { p_occurred_at: prevMid.ts }), 'SEASON_CLOSED')
  await expectError(t.rpcRow(admin, 'update_season', { p_season_id: prevSeason.id, p_patch: { ends_on: prevStart } }), 'SEASON_ALREADY_CLOSED')
  const [renamed] = await t.rpcRow(admin, 'update_season', { p_season_id: prevSeason.id, p_patch: { name: 'Anterior (fechada)' } })
  assert.equal(renamed.name, 'Anterior (fechada)')
})

// =============================================================================
// 14. Mystery que resolve para multiplier cria profile_boosts; boost 3x × evento 2x → 3 (máximo); boost vencido
//     não se aplica; o mesmo boost vale para várias entries (não é "usos") (§4.14, §6.6, §7.6)
// =============================================================================
test('mystery → multiplier 3x cria boost (spin_id, 24h); vale para várias entries; evento 2x simultâneo não multiplica em cadeia; após expirar, 1', async () => {
  await setPrizes('premium', [{ label: 'Mystery', kind: 'mystery', value: null, weight: 1000 }, { label: '3x pontos', kind: 'multiplier', value: 3, weight: 1 }])
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: mB, p_wheel_kind: 'premium', p_attempts: 1 })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const spin = await spinUntil(q.id, 'multiplier')
  assert.equal(spin.prize.kind === 'mystery' || spin.prize.kind === 'multiplier', true)
  assert.equal(spin.resolved_prize.kind, 'multiplier')
  const ap = await t.rpc(admin, 'approve_spin', { p_spin_id: spin.spin_id })
  assert.ok(ap.spin.boost_id)
  const boost = await one('select * from public.profile_boosts where id = $1', [ap.spin.boost_id])
  assert.equal(num(boost.multiplier), 3); assert.equal(boost.spin_id, spin.spin_id); assert.equal(boost.profile_id, mB)
  const row = await one('select resolved_kind, prize_kind from public.wheel_spins where id = $1', [spin.spin_id])
  assert.equal(row.resolved_kind, 'multiplier')
  // duas entries com o mesmo boost
  const [e1] = await ruleEntry(mB, ruleCall)
  const [e2] = await ruleEntry(mB, ruleCall)
  assert.equal(num(e1.multiplier), 3); assert.equal(e1.boost_id, boost.id)
  assert.equal(num(e2.multiplier), 3); assert.equal(e2.boost_id, boost.id, 'boost não é consumido por uso')
  assert.equal(num(e1.points), 15); assert.equal(num(e1.coins), 5)
  // evento 2x simultâneo → 3 (boost) e não 6
  const [ev] = await t.rpcRow(admin, 'save_special_event', { p: { name: 'Evento 2x r2', multiplier: 2, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1) } })
  const [e3] = await ruleEntry(mB, ruleCall)
  assert.equal(num(e3.multiplier), 3); assert.equal(e3.boost_id, boost.id); assert.equal(e3.special_event_id, null)
  // fora do boost (expirado por edição direta): evento 2x vale
  await t.sql("update public.profile_boosts set expires_at = greatest(now(), starts_at + interval '1 millisecond') where id = $1", [boost.id])
  const [e4] = await ruleEntry(mB, ruleCall)
  assert.equal(num(e4.multiplier), 2); assert.equal(e4.boost_id, null); assert.equal(e4.special_event_id, ev.id)
  await t.rpcRow(admin, 'save_special_event', { p: { id: ev.id, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1), is_active: false } })
  const [e5] = await ruleEntry(mB, ruleCall)
  assert.equal(num(e5.multiplier), 1)
  // manual nunca multiplica
  const [m] = await manual(mB, 10, 'manual sem multiplicador')
  assert.equal(num(m.multiplier), 1); assert.equal(m.boost_id, null)
})

// =============================================================================
// 15. recompute_stats(all) reproduz exatamente o incremental depois de todo o cenário (§7.2)
// =============================================================================
test('recompute_stats reproduz profile_season_stats e profile_lifetime_stats do cenário completo (inclui inativo, temporada fechada, estornos, marcos, boosts)', async () => {
  const snap = async () => ({
    season: await rows('select * from public.profile_season_stats order by profile_id, season_id'),
    life: await rows('select * from public.profile_lifetime_stats order by profile_id'),
  })
  // last_entry_at é comparado no teste seguinte (divergência conhecida após estorno da última atividade)
  const strip = (r) => { const { updated_at, last_entry_at, ...rest } = r; return rest }
  const before = await snap()
  assert.ok(before.season.length >= 10 && before.life.length === 8)
  await t.rpc(admin, 'recompute_stats')
  const after = await snap()
  assert.deepEqual(after.season.map(strip), before.season.map(strip))
  assert.deepEqual(after.life.map(strip), before.life.map(strip))
  lastEntryBefore = before.season.map((r) => [r.profile_id, r.season_id, r.last_entry_at?.toISOString() ?? null])
  lastEntryAfter = after.season.map((r) => [r.profile_id, r.season_id, r.last_entry_at?.toISOString() ?? null])
  // e o ledger confirma: points/coins por (perfil, temporada) e saldo vitalício
  const mism = await rows(`
    select ss.profile_id, ss.season_id from public.profile_season_stats ss
    where ss.points <> (select coalesce(sum(e.points), 0) from public.point_entries e where e.profile_id = ss.profile_id and e.season_id = ss.season_id)`)
  assert.deepEqual(mism, [])
  const walletMism = await rows(`
    select ls.profile_id from public.profile_lifetime_stats ls
    where ls.coins_balance <> (select coalesce(sum(e.coins), 0) from public.point_entries e where e.profile_id = ls.profile_id)`)
  assert.deepEqual(walletMism, [])
  // v_profile_stats × ranking coerentes: rank só para ativos (F inativo sem rank), gap do líder NULL
  const r = await ranking()
  assert.equal(r[0].gap_to_above, null)
  assert.ok(r.every((x) => x.profile_id !== mF))
  assert.ok(r.every((x, i) => i === 0 || num(x.points) <= num(r[i - 1].points)))
})

test('§4.8/§7.2: last_entry_at incremental = recompute após estorno da última entrada de atividade (F: venda estornada; D: reunião estornada)', async () => {
  // §4.8 define last_entry_at como o último occurred_at de entry que satisfaz counts_for_streak; após estornar a
  // entrada mais recente, o valor incremental (§6.7 A: greatest(...)) fica preso no occurred_at estornado e só o
  // recompute_stats o rebaixa — o incremental não reproduz o ledger (§7.2).
  const names = Object.fromEntries((await rows('select id, full_name from public.profiles')).map((p) => [p.id, p.full_name]))
  const mism = lastEntryBefore
    .map((b, i) => ({ who: names[b[0]], season: b[1] === activeSeason.id ? 'ativa' : 'anterior', incremental: b[2], recompute: lastEntryAfter[i][2] }))
    .filter((x) => x.incremental !== x.recompute)
  assert.deepEqual(mism, [], JSON.stringify(mism))
})

// =============================================================================
// 16. v_sales_timeline: estorno herda occurred_at → o dia do fato é abatido (não o dia do estorno); série
//     zero-filled do início da temporada até hoje; acumulados batem com o ledger (§5.5, §1.12)
// =============================================================================
test('v_sales_timeline: estorno abate no dia do fato, dias sem venda aparecem com 0, sales_cum/points_cum batem com o ledger por dia local', async () => {
  const tl = await rows('select * from public.v_sales_timeline where season_id = $1 order by day', [activeSeason.id])
  const span = await one('select (public.local_today() - public.local_day(starts_at) + 1)::int as n from public.seasons where id = $1', [activeSeason.id])
  assert.equal(tl.length, num(span.n), 'uma linha por dia do início até hoje')
  const ledger = await rows(`
    select public.local_day(e.occurred_at)::text as day,
           coalesce(sum(case when e.metric in ('sale','upsell') and e.source in ('rule','manual','system') then e.amount end), 0) as sales_amount,
           coalesce(sum(e.points), 0) as points
    from public.point_entries e where e.season_id = $1 group by 1 order by 1`, [activeSeason.id])
  const byDay = Object.fromEntries(ledger.map((l) => [l.day, l]))
  let cumSales = 0, cumPoints = 0
  for (const r of tl) {
    const day = typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10)
    const l = byDay[day]
    const s = l ? num(l.sales_amount) : 0
    const p = l ? num(l.points) : 0
    assert.equal(num(r.sales_amount), s, `vendas líquidas do dia ${day}`)
    assert.equal(num(r.points), p, `pontos líquidos do dia ${day}`)
    cumSales += s; cumPoints += p
    assert.equal(num(r.sales_cum), cumSales); assert.equal(num(r.points_cum), cumPoints)
  }
  // o dia do estorno (hoje) não mostra "-25.000": a venda estornada de G (há 1h) e o estorno caem no mesmo dia
  const gDay = (await one("select public.local_day(e.occurred_at)::text as d from public.point_entries e where e.profile_id = $1 and e.amount = 25000", [mG])).d
  const gRow = tl.find((r) => (typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10)) === gDay)
  assert.ok(gRow && num(gRow.sales_amount) >= 0, 'nenhum dia negativo por estorno de venda do próprio dia')
  // temporada fechada: série vai até o fim da temporada, não até hoje
  const prevTl = await rows('select * from public.v_sales_timeline where season_id = $1 order by day', [prevSeason.id])
  const prevSpan = await one("select (public.local_day(ends_at - interval '1 second') - public.local_day(starts_at) + 1)::int as n from public.seasons where id = $1", [prevSeason.id])
  assert.equal(prevTl.length, num(prevSpan.n))
  assert.equal(num(prevTl[prevTl.length - 1].sales_cum), num((await one("select coalesce(sum(amount),0) as s from public.point_entries where season_id = $1 and metric in ('sale','upsell') and source in ('rule','manual','system')", [prevSeason.id])).s))
})
