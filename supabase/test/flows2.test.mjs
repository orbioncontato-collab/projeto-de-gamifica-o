// Fluxos de negócio ponta a ponta (DATA-MODEL §14.5–§14.8 + Apêndice B.15/B.16), só via RPCs,
// cada passo com o papel certo (authenticated com claims / postgres só para asserts "de fora").
// Um único banco PGlite; os testes rodam em ordem porque cada fluxo herda o estado do anterior.
// Contas de teste são rótulos técnicos (gestor / membro-a / membro-b / membro-c), não pessoas.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectError, num } from './pglite-harness.mjs'

let t
let teamCode, admin, memberA, memberB, memberC, activeSeason, prevSeason, ruleSale, ruleCall

const one = async (text, params = []) => (await t.sql(text, params)).rows[0]
const rows = async (text, params = []) => (await t.sql(text, params)).rows
const countRows = async (text, params = []) => Number((await t.sql(`select count(*)::int as n from (${text}) x`, params)).rows[0].n)
const seasonStats = (profileId, seasonId) =>
  one('select * from public.profile_season_stats where profile_id = $1 and season_id = $2', [profileId, seasonId])
const lifetime = (profileId) => one('select * from public.profile_lifetime_stats where profile_id = $1', [profileId])
const coinsBalance = async (profileId) => num((await lifetime(profileId)).coins_balance)
const ledgerCoins = async (profileId) => num((await one('select coalesce(sum(coins), 0)::int as c from public.point_entries where profile_id = $1', [profileId])).c)
const iso = (d) => new Date(d).toISOString()
const hoursFromNow = (h) => iso(Date.now() + h * 3600 * 1000)
const sale = (profileId, amount, extra = {}) =>
  t.rpcRow(admin, 'record_rule_entry', { p_profile_id: profileId, p_rule_id: ruleSale.id, p_quantity: 1, p_amount: amount, ...extra })
const achievementCount = (profileId, code) =>
  countRows('select 1 from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id where pa.profile_id = $1 and a.code = $2', [profileId, code])
// Roleta exige ≥ 2 prêmios ativos (MIN_PRIZES): dois setores iguais tornam o sorteio determinístico.
const setPrizePair = (wheelKind, label, kind, value) =>
  t.rpcRow(admin, 'save_wheel_prizes', {
    p_wheel_kind: wheelKind,
    p_prizes: [{ label, kind, value, weight: 1, sort_order: 0 }, { label, kind, value, weight: 1, sort_order: 1 }],
  })

before(async () => {
  t = await createTestDb()
  teamCode = (await one('select team_code from public.app_secrets where id = 1')).team_code
  activeSeason = await one('select * from public.seasons where is_active')
  ruleSale = await one("select * from public.point_rules where name = 'Venda realizada' and deleted_at is null")
  ruleCall = await one("select * from public.point_rules where name = 'Ligação realizada' and deleted_at is null")
  assert.ok(activeSeason && ruleSale && ruleCall, 'seed deve criar temporada ativa e regras')

  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  await t.rpcRow(admin, 'update_app_settings', { p_patch: { auto_approve_members: true } })
  memberA = await t.createAuthUser({ email: 'membro-a@teste.local', metadata: { team_code: teamCode, full_name: 'Membro A' } })
  memberB = await t.createAuthUser({ email: 'membro-b@teste.local', metadata: { team_code: teamCode, full_name: 'Membro B' } })
  memberC = await t.createAuthUser({ email: 'membro-c@teste.local', metadata: { team_code: teamCode, full_name: 'Membro C' } })
  assert.equal(await countRows("select 1 from public.profiles where status = 'active'"), 4)

  // temporada do mês anterior (não fechada): garante cobertura para lançamentos retroativos
  // que caiam no mês passado (streak §B.16) e serve de alvo para activate_season no §14.8.
  const prev = await one(`
    select (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date as starts_on,
           (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 day')::date as ends_on`)
  ;[prevSeason] = await t.rpcRow(admin, 'create_season', { p_name: 'Temporada anterior', p_starts_on: prev.starts_on, p_ends_on: prev.ends_on })
  assert.equal(prevSeason.is_active, false)
})
after(async () => t?.close())

// =============================================================================
// 14.6 Desbloqueio de conquista (instantâneas) + estorno (§6.6 / B.15)
// =============================================================================
let firstSaleEntry, firstSaleAchEntry
test('14.6.1 primeira venda desbloqueia PRIMEIRA VENDA uma única vez, com entry achievement +50/+50 na mesma temporada', async () => {
  const [e] = await sale(memberA, 8500)
  firstSaleEntry = e
  assert.equal(await achievementCount(memberA, 'first_sale'), 1)
  const pa = await one("select pa.* from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id where pa.profile_id = $1 and a.code = 'first_sale'", [memberA])
  assert.equal(pa.trigger_entry_id, e.id)
  assert.equal(pa.season_id, null, 'conquista lifetime não grava season_id')
  firstSaleAchEntry = await one('select * from public.point_entries where id = $1', [pa.entry_id])
  assert.equal(firstSaleAchEntry.source, 'achievement')
  assert.equal(num(firstSaleAchEntry.points), 50)
  assert.equal(num(firstSaleAchEntry.coins), 50)
  assert.equal(firstSaleAchEntry.reason, 'PRIMEIRA VENDA')
  assert.equal(firstSaleAchEntry.season_id, e.season_id)
  assert.equal(iso(firstSaleAchEntry.occurred_at), iso(e.occurred_at))
  assert.equal(await countRows("select 1 from public.feed_events where kind = 'achievement' and profile_id = $1", [memberA]), 1)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Conquista desbloqueada' and message = 'PRIMEIRA VENDA'", [memberA]), 1)

  // segunda venda: nada de novo
  await sale(memberA, 500)
  assert.equal(await achievementCount(memberA, 'first_sale'), 1)
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'achievement'", [memberA]), 1)
  // venda sem valor não existe (AMOUNT_REQUIRED), então regra 0 R$ nunca desbloqueia; regra sem valor (ligação) também não
  await t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberB, p_rule_id: ruleCall.id, p_quantity: 1 })
  assert.equal(await achievementCount(memberB, 'first_sale'), 0)
})

test('14.6.2 sales_total: ao cruzar R$ 50.000 vitalícios desbloqueia 50K CLUB (+300/+300); 100K ainda não', async () => {
  const before = num((await lifetime(memberA)).sales_amount)
  assert.equal(before, 9000)
  await sale(memberA, 41000)
  assert.equal(num((await lifetime(memberA)).sales_amount), 50000)
  assert.equal(await achievementCount(memberA, 'club_50k'), 1)
  assert.equal(await achievementCount(memberA, 'club_100k'), 0)
  const e = await one("select * from public.point_entries where profile_id = $1 and source = 'achievement' and reason = '50K CLUB'", [memberA])
  assert.equal(num(e.points), 300)
  assert.equal(num(e.coins), 300)
  // bônus automático "R$ 10.000 vendidos": 5 blocos de 150/150 (metric amount_step, source system)
  assert.equal(await countRows("select 1 from public.point_entries where profile_id = $1 and source = 'system' and metric = 'amount_step'", [memberA]), 5)
  assert.equal(await countRows("select 1 from public.milestone_awards where profile_id = $1 and metric = 'amount_step'", [memberA]), 5)
  // stats fecham com o ledger
  const ss = await seasonStats(memberA, activeSeason.id)
  const sum = await one('select sum(points)::int as p, sum(coins)::int as c from public.point_entries where profile_id = $1 and season_id = $2', [memberA, activeSeason.id])
  assert.equal(num(ss.points), num(sum.p))
  assert.equal(num(ss.points), 100 + 50 + 100 + 100 + 300 + 5 * 150)
  assert.equal(await coinsBalance(memberA), num(sum.c))
})

let reversal
test('14.6.3 reverse_entry inverte pontos, moedas e valor, herda occurred_at/season/rule_id (source = system, §7.4) e atualiza as stats', async () => {
  const before = await seasonStats(memberA, activeSeason.id)
  const lsBefore = await lifetime(memberA)
  await expectError(t.rpcRow(memberA, 'reverse_entry', { p_entry_id: firstSaleEntry.id, p_reason: 'x' }), 'NOT_ADMIN')
  ;[reversal] = await t.rpcRow(admin, 'reverse_entry', { p_entry_id: firstSaleEntry.id, p_reason: 'Venda cancelada pelo cliente' })
  assert.equal(reversal.reverses_entry_id, firstSaleEntry.id)
  assert.equal(reversal.profile_id, memberA)
  assert.equal(num(reversal.points), -num(firstSaleEntry.points))
  assert.equal(num(reversal.coins), -num(firstSaleEntry.coins))
  assert.equal(num(reversal.amount), -8500)
  assert.equal(num(reversal.base_points), -100)
  assert.equal(num(reversal.multiplier), 1)
  // SQL fixer r2: §7.4 — estorno de rule/manual/system nasce com source = 'system' (herda rule_id, não a source);
  // a assertiva anterior ('rule') contrariava a spec e está registrada em supabase/DECISIONS.md.
  assert.equal(reversal.source, 'system')
  assert.equal(reversal.metric, 'sale')
  assert.equal(reversal.rule_id, ruleSale.id)
  assert.equal(iso(reversal.occurred_at), iso(firstSaleEntry.occurred_at), 'estorno herda a data do fato')
  assert.equal(reversal.season_id, firstSaleEntry.season_id)
  assert.equal(reversal.reason, 'Venda cancelada pelo cliente')

  const after = await seasonStats(memberA, activeSeason.id)
  assert.equal(num(after.points), num(before.points) - 100)
  assert.equal(num(after.sales_amount), num(before.sales_amount) - 8500)
  assert.equal(num(after.sales_count), num(before.sales_count) - 1)
  assert.equal(num(after.activities_count), num(before.activities_count) - 1)
  assert.equal(num(after.points_earned), num(before.points_earned) - 100, 'points_earned devolve o crédito original')
  const lsAfter = await lifetime(memberA)
  assert.equal(num(lsAfter.sales_amount), num(lsBefore.sales_amount) - 8500)
  assert.equal(num(lsAfter.coins_balance), num(lsBefore.coins_balance) - 100)
  assert.equal(await coinsBalance(memberA), await ledgerCoins(memberA))
  // conquista e missão não são desfeitas por estorno (B.8); marcos já pagos continuam
  assert.equal(await achievementCount(memberA, 'first_sale'), 1)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Lançamento estornado'", [memberA]), 1)
  assert.equal(await countRows("select 1 from public.audit_log where action = 'rpc' and table_name = 'reverse_entry' and row_id = $1", [firstSaleEntry.id]), 1)

  await expectError(t.rpcRow(admin, 'reverse_entry', { p_entry_id: firstSaleEntry.id, p_reason: 'de novo' }), 'ALREADY_REVERSED')
  await expectError(t.rpcRow(admin, 'reverse_entry', { p_entry_id: reversal.id, p_reason: 'estorno do estorno' }), 'CANNOT_REVERSE_REVERSAL')
  await expectError(t.rpcRow(admin, 'reverse_entry', { p_entry_id: '00000000-0000-0000-0000-000000000001', p_reason: 'x' }), 'ENTRY_NOT_FOUND')
  // o ledger é imutável: nem o postgres apaga/edita uma entry
  await expectError(t.sql('delete from public.point_entries where id = $1', [reversal.id]), /LEDGER_IMMUTABLE|immutable|não pode/i)
})

// =============================================================================
// 14.5 Colaborador resgata uma recompensa
// =============================================================================
let reward, redemption1, redemption2, manualEntryB
test('14.5.1 sem moedas → INSUFFICIENT_COINS; recompensa inexistente/inativa → REWARD_UNAVAILABLE', async () => {
  const ifood = await one("select * from public.rewards where name = 'R$ 20 iFood'")
  const err = await expectError(t.rpc(memberC, 'redeem_reward', { p_reward_id: ifood.id }), 'INSUFFICIENT_COINS')
  assert.equal(err.detail, 'Moedas insuficientes (faltam 500).')
  await expectError(t.rpc(memberC, 'redeem_reward', { p_reward_id: '00000000-0000-0000-0000-000000000001' }), 'REWARD_UNAVAILABLE')
  assert.equal(await countRows('select 1 from public.reward_redemptions'), 0)
  assert.equal(await countRows("select 1 from public.point_entries where source = 'reward'"), 0)
})

test('14.5.2 gestor cria recompensa com estoque 2 (policy admin); ajuste manual dá moedas ao membro-b', async () => {
  reward = await t.asUser(admin, async (tx) =>
    (await tx.query(`insert into public.rewards (name, category, value_amount, cost_coins, stock, icon, sort_order)
                     values ('Vale-teste', 'Voucher', 30, 500, 2, '🎁', 99) returning *`)).rows[0])
  assert.equal(num(reward.stock), 2)
  await expectError(t.asUser(memberB, (tx) => tx.query("insert into public.rewards (name, cost_coins) values ('x', 1)")), /row-level security/i)

  ;[manualEntryB] = await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: memberB, p_points: 1000, p_reason: 'Bônus de integração' })
  assert.equal(manualEntryB.source, 'manual')
  assert.equal(num(manualEntryB.points), 1000)
  assert.equal(num(manualEntryB.coins), 1000, 'B.3: coins = points quando positivo e p_coins omitido')
  assert.equal(await coinsBalance(memberB), 1005, '5 da ligação + 1000')
})

test('14.5.3 redeem_reward debita moedas, cria pedido requested, decrementa estoque e avisa os gestores', async () => {
  const r = await t.rpc(memberB, 'redeem_reward', { p_reward_id: reward.id })
  assert.ok(r.redemption_id)
  assert.equal(num(r.coins_balance), 505)
  redemption1 = await one('select * from public.reward_redemptions where id = $1', [r.redemption_id])
  assert.equal(redemption1.status, 'requested')
  assert.equal(redemption1.source, 'store')
  assert.equal(redemption1.profile_id, memberB)
  assert.equal(redemption1.person_name, 'Membro B')
  assert.equal(redemption1.title, 'Vale-teste')
  assert.equal(num(redemption1.cost_coins), 500)
  assert.equal(num(redemption1.value_amount), 30)
  const e = await one('select * from public.point_entries where id = $1', [redemption1.entry_id])
  assert.equal(e.source, 'reward')
  assert.equal(num(e.points), 0)
  assert.equal(num(e.coins), -500)
  assert.equal(e.reason, 'Resgate: Vale-teste')
  assert.equal(e.created_by, memberB)
  assert.equal(num((await one('select stock from public.rewards where id = $1', [reward.id])).stock), 1)
  assert.equal(await coinsBalance(memberB), 505)
  assert.equal(num((await lifetime(memberB)).coins_spent), 500)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Novo pedido de resgate'", [admin]), 1)
  assert.equal(await countRows("select 1 from public.audit_log where action = 'rpc' and table_name = 'redeem_reward' and row_id = $1", [r.redemption_id]), 1)

  // o colaborador vê o próprio pedido (RLS) e não vê o de outro
  const mine = await t.asUser(memberB, async (tx) => (await tx.query('select id, status from public.reward_redemptions')).rows)
  assert.deepEqual(mine.map((x) => x.id), [r.redemption_id])
  assert.equal(await t.asUser(memberC, async (tx) => (await tx.query('select count(*)::int as n from public.reward_redemptions')).rows[0].n), 0)

  // segundo resgate esgota o estoque; terceiro (membro-a, com saldo) → OUT_OF_STOCK
  const r2 = await t.rpc(memberB, 'redeem_reward', { p_reward_id: reward.id })
  redemption2 = await one('select * from public.reward_redemptions where id = $1', [r2.redemption_id])
  assert.equal(num(r2.coins_balance), 5)
  assert.equal(num((await one('select stock from public.rewards where id = $1', [reward.id])).stock), 0)
  assert.ok((await coinsBalance(memberA)) >= 500)
  await expectError(t.rpc(memberA, 'redeem_reward', { p_reward_id: reward.id }), 'OUT_OF_STOCK')
  assert.equal(await countRows("select 1 from public.point_entries where source = 'reward' and profile_id = $1", [memberA]), 0)
  // estorno direto de entry de resgate é barrado: cancele pelo fluxo de resgates
  await expectError(t.rpcRow(admin, 'reverse_entry', { p_entry_id: redemption1.entry_id, p_reason: 'x' }), 'USE_HANDLE_REDEMPTION')
})

test('14.5.4 handle_redemption: approve → deliver (com nota, entra no KPI); transições inválidas; só admin', async () => {
  await expectError(t.rpcRow(memberB, 'handle_redemption', { p_redemption_id: redemption1.id, p_action: 'approve' }), 'NOT_ADMIN')
  await expectError(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: redemption1.id, p_action: 'pay' }), 'ACTION_INVALID')
  await expectError(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: '00000000-0000-0000-0000-000000000001', p_action: 'approve' }), 'REDEMPTION_NOT_FOUND')

  const [a] = await t.rpcRow(admin, 'handle_redemption', { p_redemption_id: redemption1.id, p_action: 'approve' })
  assert.equal(a.status, 'approved')
  assert.equal(a.handled_by, admin)
  assert.ok(a.handled_at)
  assert.equal(await countRows("select 1 from public.notifications where profile_id = $1 and title = 'Resgate aprovado'", [memberB]), 1)
  await expectError(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: redemption1.id, p_action: 'approve' }), 'REDEMPTION_TRANSITION_INVALID')

  const kpiBefore = await t.asUser(admin, async (tx) => (await tx.query('select * from public.v_admin_kpis where season_id = $1', [activeSeason.id])).rows[0])
  assert.equal(num(kpiBefore.redemptions_pending_count), 2)
  assert.equal(num(kpiBefore.redemptions_delivered_amount), 0)

  const [d] = await t.rpcRow(admin, 'handle_redemption', { p_redemption_id: redemption1.id, p_action: 'deliver', p_notes: 'Entregue no PIX 12/09' })
  assert.equal(d.status, 'delivered')
  assert.equal(d.notes, 'Entregue no PIX 12/09')
  assert.equal(d.refund_entry_id, null)
  const notif = await one("select * from public.notifications where profile_id = $1 and title = 'Recompensa entregue'", [memberB])
  assert.equal(notif.message, 'Vale-teste — Entregue no PIX 12/09')
  const kpi = await t.asUser(admin, async (tx) => (await tx.query('select * from public.v_admin_kpis where season_id = $1', [activeSeason.id])).rows[0])
  assert.equal(num(kpi.redemptions_pending_count), 1)
  assert.equal(num(kpi.redemptions_delivered_amount), 30)
  // entregue não cancela; colaborador não enxerga v_admin_kpis
  await expectError(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: redemption1.id, p_action: 'cancel' }), 'REDEMPTION_TRANSITION_INVALID')
  assert.equal(await t.asUser(memberB, async (tx) => (await tx.query('select count(*)::int as n from public.v_admin_kpis')).rows[0].n), 0)
  // estoque não volta em entrega
  assert.equal(num((await one('select stock from public.rewards where id = $1', [reward.id])).stock), 0)
})

test('14.5.5 handle_redemption cancel: entry de estorno +cost_coins ligada por refund_entry_id, estoque devolvido, colaborador avisado', async () => {
  const balBefore = await coinsBalance(memberB)
  const [c] = await t.rpcRow(admin, 'handle_redemption', { p_redemption_id: redemption2.id, p_action: 'cancel', p_notes: 'Sem estoque no fornecedor' })
  assert.equal(c.status, 'cancelled')
  assert.ok(c.refund_entry_id)
  const refund = await one('select * from public.point_entries where id = $1', [c.refund_entry_id])
  assert.equal(refund.source, 'reward')
  assert.equal(refund.reverses_entry_id, redemption2.entry_id)
  assert.equal(num(refund.coins), 500)
  assert.equal(num(refund.points), 0)
  assert.equal(refund.reason, 'Sem estoque no fornecedor')
  const orig = await one('select * from public.point_entries where id = $1', [redemption2.entry_id])
  assert.equal(iso(refund.occurred_at), iso(orig.occurred_at))
  assert.equal(await coinsBalance(memberB), balBefore + 500)
  assert.equal(await coinsBalance(memberB), await ledgerCoins(memberB))
  assert.equal(num((await lifetime(memberB)).coins_spent), 500, 'estorno devolve coins_spent')
  assert.equal(num((await one('select stock from public.rewards where id = $1', [reward.id])).stock), 1)
  assert.equal((await one("select message from public.notifications where profile_id = $1 and title = 'Resgate cancelado'", [memberB])).message, 'Vale-teste — Sem estoque no fornecedor')
  await expectError(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: redemption2.id, p_action: 'approve' }), 'REDEMPTION_TRANSITION_INVALID')
  await expectError(t.rpcRow(admin, 'handle_redemption', { p_redemption_id: redemption2.id, p_action: 'cancel' }), 'REDEMPTION_TRANSITION_INVALID')

  const vr = await t.asUser(admin, async (tx) => (await tx.query('select * from public.v_redemptions where redemption_id = $1', [redemption2.id])).rows[0])
  assert.equal(vr.status, 'cancelled')
  assert.equal(vr.handled_by_name, (await one('select full_name from public.profiles where id = $1', [admin])).full_name)
  assert.equal(vr.reward_icon, '🎁')
})

test('B.15 estorno de moedas já gastas deixa o saldo negativo (dívida); a loja recusa até cobrir', async () => {
  assert.equal(await coinsBalance(memberB), 505)
  const r = await t.rpc(memberB, 'redeem_reward', { p_reward_id: reward.id })
  assert.equal(num(r.coins_balance), 5)
  const [rev] = await t.rpcRow(admin, 'reverse_entry', { p_entry_id: manualEntryB.id, p_reason: 'Bônus lançado por engano' })
  assert.equal(num(rev.coins), -1000)
  assert.equal(num(rev.points), -1000)
  assert.equal(await coinsBalance(memberB), -995, 'saldo devedor')
  assert.equal(await ledgerCoins(memberB), -995)
  const wallet = await t.asUser(memberB, async (tx) => (await tx.query('select * from public.v_wallet where profile_id = $1', [memberB])).rows[0])
  assert.equal(num(wallet.coins_balance), -995, 'v_wallet não aplica greatest(0)')
  const err = await expectError(t.rpc(memberB, 'redeem_reward', { p_reward_id: reward.id }), 'INSUFFICIENT_COINS')
  assert.equal(err.detail, 'Moedas insuficientes (faltam 1495).')
  // pontos da temporada fecham com o ledger (5 da ligação); moedas negativas não afetam nível
  const me = await t.asUser(memberB, async (tx) => (await tx.query('select points, level, coins_balance from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberB, activeSeason.id])).rows[0])
  assert.equal(num(me.points), 5)
  assert.equal(num(me.level), 0)
  assert.equal(num(me.coins_balance), -995)
  // ajuste manual negativo de moedas também é permitido (correção do ledger)
  const [adj] = await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: memberB, p_points: -5, p_reason: 'Correção', p_coins: -10 })
  assert.equal(num(adj.coins), -10)
  assert.equal(num(adj.points), -5)
  // ajuste negativo sem p_coins não confisca moedas (B.3)
  const [adj2] = await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: memberB, p_points: -5, p_reason: 'Correção 2' })
  assert.equal(num(adj2.coins), 0)
  assert.equal(await coinsBalance(memberB), -1005)
})

// =============================================================================
// 14.7 Evento especial × boost da roleta: vale o maior (B.4), não o produto
// =============================================================================
// O boost só nasce por approve_spin de prêmio 'multiplier' (profile_boosts.spin_id NOT NULL).
const winBoost = async (profileId, multiplier) => {
  await setPrizePair('premium', `${multiplier}x pontos`, 'multiplier', multiplier)
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: profileId, p_wheel_kind: 'premium', p_attempts: 1 })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const r = await t.rpc(profileId, 'spin_wheel', { p_queue_id: q.id })
  assert.equal(r.prize.kind, 'multiplier')
  const a = await t.rpc(admin, 'approve_spin', { p_spin_id: r.spin_id })
  assert.ok(a.spin.boost_id)
  return one('select * from public.profile_boosts where id = $1', [a.spin.boost_id])
}
let specialEvent
test('14.7.1 boost 3x sem evento: multiplier 3, boost_id gravado, moedas não multiplicam', async () => {
  const boost = await winBoost(memberA, 3)
  assert.equal(num(boost.multiplier), 3)
  assert.equal(boost.profile_id, memberA)
  const [e] = await sale(memberA, 1000)
  assert.equal(num(e.base_points), 100)
  assert.equal(num(e.multiplier), 3)
  assert.equal(num(e.points), 300)
  assert.equal(num(e.coins), 100)
  assert.equal(e.boost_id, boost.id)
  assert.equal(e.special_event_id, null)
})

test('14.7.2 evento 2x coincidindo com boost 3x: vale 3 (não 6) e a origem gravada é o boost', async () => {
  ;[specialEvent] = await t.rpcRow(admin, 'save_special_event', {
    p: { name: 'Hora do Fogo', multiplier: 2, starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1) },
  })
  assert.equal(num(specialEvent.multiplier), 2)
  const ve = await t.asUser(memberA, async (tx) => (await tx.query('select state from public.v_special_events where id = $1', [specialEvent.id])).rows[0])
  assert.equal(ve.state, 'live')
  // membros com event_alerts recebem o aviso
  assert.ok((await countRows("select 1 from public.notifications where kind = 'event' and profile_id = $1", [memberA])) >= 1)

  const [e] = await sale(memberA, 1000)
  assert.equal(num(e.multiplier), 3, 'max(evento 2, boost 3) = 3')
  assert.equal(num(e.points), 300)
  assert.equal(num(e.coins), 100)
  assert.equal(e.special_event_id, null)
  assert.ok(e.boost_id)
  // sobreposição de evento ativo é recusada pelo EXCLUDE (traduzido em EVENT_OVERLAP)
  await expectError(
    t.rpcRow(admin, 'save_special_event', { p: { name: 'Outro', multiplier: 3, starts_at: hoursFromNow(-0.5), ends_at: hoursFromNow(0.5) } }),
    'EVENT_OVERLAP',
  )
})

test('14.7.3 evento 2x com boost 1.5x: vale o evento (2), special_event_id gravado e boost_id nulo; sem nenhum dos dois, 1', async () => {
  const boost = await winBoost(memberB, 1.5)
  assert.equal(num(boost.multiplier), 1.5)
  const [e] = await sale(memberB, 1000)
  assert.equal(num(e.multiplier), 2)
  assert.equal(num(e.points), 200)
  assert.equal(num(e.coins), 100)
  assert.equal(e.special_event_id, specialEvent.id)
  assert.equal(e.boost_id, null)
  // membro-c sem boost, durante o evento: 2 pelo evento
  const [ec] = await sale(memberC, 1000)
  assert.equal(num(ec.multiplier), 2)
  assert.equal(ec.special_event_id, specialEvent.id)
  // fora da janela do evento (3h atrás) e fora do boost (começou agora): 1
  const [e1] = await sale(memberB, 1000, { p_occurred_at: hoursFromNow(-3) })
  assert.equal(num(e1.multiplier), 1)
  assert.equal(num(e1.points), 100)
  assert.equal(e1.special_event_id, null)
  assert.equal(e1.boost_id, null)
  // manual e system nunca multiplicam
  const [m] = await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: memberA, p_points: 40, p_reason: 'Elogio de cliente' })
  assert.equal(num(m.multiplier), 1)
  assert.equal(num(m.points), 40)

  // estorno da entry dobrada devolve -200 (copia points) com base_points -100 e multiplier 1
  const [rev] = await t.rpcRow(admin, 'reverse_entry', { p_entry_id: e.id, p_reason: 'Erro de digitação' })
  assert.equal(num(rev.points), -200)
  assert.equal(num(rev.base_points), -100)
  assert.equal(num(rev.multiplier), 1)
  assert.equal(num(rev.coins), -100)
  assert.equal(rev.special_event_id, null)
  const hist = await t.asUser(admin, async (tx) => (await tx.query('select * from public.v_point_entries_history where entry_id = $1', [e.id])).rows[0])
  assert.equal(hist.is_reversed, true)
  assert.equal(hist.reversed_by_entry_id, rev.id)
  assert.equal(hist.special_event_name, 'Hora do Fogo')
})

// =============================================================================
// B.16 Streak em dias LOCAIS (America/Sao_Paulo), não em dias UTC
// =============================================================================
test('B.16 entradas às 23:30 e 00:30 locais (mesmo dia UTC) contam 2 dias de streak; regra 0/0 conta; estorno recalcula', async () => {
  // usa membro-c e datas de ontem/hoje no fuso local
  const d = await one(`
    select ((public.local_today() - 1)::timestamp + interval '23 hours 30 minutes') at time zone 'America/Sao_Paulo' as late,
           ((public.local_today())::timestamp + interval '30 minutes') at time zone 'America/Sao_Paulo' as early,
           ((public.local_today() - 1)::timestamp + interval '22 hours') at time zone 'America/Sao_Paulo' as earlier_same_day,
           public.local_today() as today`)
  const utcDay = (x) => iso(x).slice(0, 10)
  assert.equal(utcDay(d.late), utcDay(d.early), 'as duas entradas caem no MESMO dia UTC (23:30 BRT = 02:30Z)')
  assert.equal(utcDay((await one('select public.local_day($1::timestamptz) as x', [iso(d.late)])).x), utcDay((await one('select (public.local_today() - 1) as x')).x), 'local_day converte no fuso')

  const lsBefore = await lifetime(memberC)
  // membro-c já vendeu hoje (14.7.3): streak 1 hoje
  assert.equal(num(lsBefore.streak_days), 1)
  const [e1] = await t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberC, p_rule_id: ruleCall.id, p_quantity: 1, p_occurred_at: iso(d.late) })
  assert.equal(num(e1.points), 5)
  const ls1 = await lifetime(memberC)
  assert.equal(num(ls1.streak_days), 2, 'ontem 23:30 local + hoje = 2 dias')
  assert.equal(iso(ls1.streak_last_day).slice(0, 10), iso(d.today).slice(0, 10))
  const [e2] = await t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberC, p_rule_id: ruleCall.id, p_quantity: 1, p_occurred_at: iso(d.early) })
  assert.equal(num((await lifetime(memberC)).streak_days), 2, 'hoje 00:30 local não abre um 3º dia')
  await t.rpcRow(admin, 'record_rule_entry', { p_profile_id: memberC, p_rule_id: ruleCall.id, p_quantity: 1, p_occurred_at: iso(d.earlier_same_day) })
  assert.equal(num((await lifetime(memberC)).streak_days), 2, 'ontem 22:00 local: mesmo dia, streak inalterado')
  assert.equal(num((await lifetime(memberC)).best_streak_days), 2)

  // estorno das duas entradas de ontem → recalcula: só hoje sobra → 1
  const [rev1] = await t.rpcRow(admin, 'reverse_entry', { p_entry_id: e1.id, p_reason: 'x' })
  assert.equal(iso(rev1.occurred_at), iso(e1.occurred_at))
  assert.equal(num((await lifetime(memberC)).streak_days), 2, 'ainda há a entrada de ontem 22:00')
  const late3 = await one("select id from public.point_entries where profile_id = $1 and occurred_at = $2::timestamptz and reverses_entry_id is null", [memberC, iso(d.earlier_same_day)])
  await t.rpcRow(admin, 'reverse_entry', { p_entry_id: late3.id, p_reason: 'x' })
  const lsAfter = await lifetime(memberC)
  assert.equal(num(lsAfter.streak_days), 1)
  // SQL fixer r1: §6.2 manda recompute_streak gravar best_streak_days = max(ilhas) do ledger (não greatest com o valor antigo),
  // para recompute_stats reproduzir o ledger (§7.2) e corrigir um best adulterado. O estorno apagou o dia que formava a
  // sequência de 2, logo o melhor streak segundo o ledger passa a ser 1 (ver supabase/DECISIONS.md).
  assert.equal(num(lsAfter.best_streak_days), 1, 'melhor streak segue o ledger após estorno (max das ilhas)')
  // v_profile_stats mostra o streak vivo (streak_last_day ≥ ontem)
  const me = await t.asUser(memberC, async (tx) => (await tx.query('select streak_days, best_streak_days from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberC, activeSeason.id])).rows[0])
  assert.equal(num(me.streak_days), 1)
  assert.equal(num(me.best_streak_days), 1) // idem: max das ilhas do ledger (SQL fixer r1)
  // recompute_stats reproduz o mesmo streak
  await t.rpc(admin, 'recompute_stats', { p_profile_id: memberC })
  const lsRe = await lifetime(memberC)
  assert.equal(num(lsRe.streak_days), 1)
  assert.equal(num(lsRe.best_streak_days), 1)
  void e2
})

// =============================================================================
// 14.8 Virada de temporada
// =============================================================================
let nextSeason, duel, mission
test('14.8.1 create_season: sobreposição → SEASON_OVERLAP (EXCLUDE); próxima temporada nasce inativa com season_goals copiadas', async () => {
  const cur = await one(`select public.local_day(starts_at) as starts_on, public.local_day(ends_at - interval '1 second') as ends_on from public.seasons where id = $1`, [activeSeason.id])
  await expectError(
    t.rpcRow(admin, 'create_season', { p_name: 'Sobreposta', p_starts_on: cur.starts_on, p_ends_on: cur.ends_on }),
    'SEASON_OVERLAP',
  )
  await expectError(t.rpcRow(admin, 'create_season', { p_name: 'Invertida', p_starts_on: '2030-02-01', p_ends_on: '2030-01-01' }), 'SEASON_RANGE_INVALID')
  await expectError(t.rpcRow(memberA, 'create_season', { p_name: 'x', p_starts_on: '2030-01-01', p_ends_on: '2030-01-31' }), 'NOT_ADMIN')
  // o EXCLUDE também vale para insert direto (23P01)
  await expectError(
    t.sql("insert into public.seasons (name, starts_at, ends_at, xp_per_level) select 'dup', starts_at, ends_at, 400 from public.seasons where id = $1", [activeSeason.id]),
    /exclusion|conflicts with existing key|23P01|SEASON_OVERLAP/i,
  )

  const nxt = await one(`
    select (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month')::date as starts_on,
           (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 month' - interval '1 day')::date as ends_on`)
  ;[nextSeason] = await t.rpcRow(admin, 'create_season', { p_name: 'Próxima temporada', p_starts_on: nxt.starts_on, p_ends_on: nxt.ends_on, p_team_goal_amount: 250000 })
  assert.equal(nextSeason.is_active, false)
  assert.equal(nextSeason.closed_at, null)
  assert.equal(num(nextSeason.team_goal_amount), 250000)
  assert.equal(num(nextSeason.xp_per_level), num((await one('select xp_per_level from public.app_settings where id = 1')).xp_per_level), 'xp_per_level congelado')
  assert.equal(await countRows('select 1 from public.season_goals where season_id = $1', [nextSeason.id]), 4, 'uma meta por perfil ativo')
  await expectError(t.rpcRow(admin, 'activate_season', { p_season_id: nextSeason.id }), 'SEASON_NOT_STARTED')
  assert.equal((await one('select is_active from public.seasons where id = $1', [nextSeason.id])).is_active, false)
  assert.equal((await one('select is_active from public.seasons where id = $1', [activeSeason.id])).is_active, true)
  // lançamento datado na próxima temporada é recusado (futuro) — nada entra numa temporada que não começou
  await expectError(sale(memberA, 10, { p_occurred_at: iso(nextSeason.starts_at) }), 'OCCURRED_AT_INVALID')
})

test('14.8.2 antes do fechamento: missão e duelo ativos na temporada corrente (serão clampados/finalizados)', async () => {
  ;[mission] = await t.rpcRow(admin, 'save_mission', {
    p: { title: 'Venda no mês', kind: 'special', metric: 'sale', target_kind: 'count', target_value: 50, reward_points: 10, reward_coins: 10,
         starts_at: iso(activeSeason.starts_at), ends_at: iso(activeSeason.ends_at), audience: 'all' },
  })
  ;[duel] = await t.rpcRow(admin, 'save_challenge', {
    p: { name: 'Duelo de vendas', kind: 'duel', metric: 'sales_count', target_value: 3, reward_points: 100, reward_coins: 100,
         starts_at: iso(Date.now()), ends_at: iso(activeSeason.ends_at), participant_ids: [memberA, memberB] },
  })
  assert.equal(duel.status, 'draft')
  ;[duel] = await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: duel.id })
  assert.equal(duel.status, 'active')
  await sale(memberA, 700)
  const board = await t.asUser(memberA, async (tx) => (await tx.query('select * from public.v_challenge_board where challenge_id = $1', [duel.id])).rows[0])
  assert.equal(num(board.participants_count), 2)
  assert.equal(board.participants[0].profile_id, memberA)
  assert.equal(num(board.participants[0].value), 1)
})

let closeResult
test('14.8.3 close_season: snapshot em season_results, CAMPEÃO, fechamento antecipado encurta ends_at, feed e notificação', async () => {
  await expectError(t.rpc(memberA, 'close_season', { p_season_id: activeSeason.id }), 'NOT_ADMIN')
  await expectError(t.rpc(admin, 'close_season', { p_season_id: nextSeason.id }), 'SEASON_NOT_STARTED')
  const statsBefore = await rows('select profile_id, points, sales_amount from public.profile_season_stats where season_id = $1', [activeSeason.id])
  const top = statsBefore.slice().sort((a, b) => num(b.points) - num(a.points))[0]
  assert.ok(num(top.points) > 0)

  closeResult = await t.rpc(admin, 'close_season', { p_season_id: activeSeason.id })
  assert.equal(closeResult.season_id, activeSeason.id)
  assert.equal(closeResult.champion_profile_id, top.profile_id)
  assert.equal(closeResult.results.length, 4, 'todos os perfis ativos (gestor incluído, rank_admins=true)')
  assert.equal(closeResult.results[0].profile_id, top.profile_id)
  assert.equal(num(closeResult.results[0].final_rank), 1)
  assert.equal(closeResult.next_season_id, nextSeason.id)

  const s = await one('select * from public.seasons where id = $1', [activeSeason.id])
  assert.equal(s.is_active, false)
  assert.ok(s.closed_at)
  assert.equal(s.closed_by, admin)
  const expectedEnd = await one(`select ((public.local_today() + 1)::timestamp) at time zone 'America/Sao_Paulo' as ends_at`)
  assert.equal(iso(s.ends_at), iso(expectedEnd.ends_at), 'B.10: ends_at encurtado para a próxima meia-noite local')
  const hasGap = iso(nextSeason.starts_at) > iso(s.ends_at)
  assert.deepEqual(closeResult.warnings, hasGap ? ['gap_until_next_season'] : [])

  const results = await rows('select * from public.season_results where season_id = $1 order by final_rank nulls last', [activeSeason.id])
  assert.equal(results.length, 4)
  assert.equal(results[0].profile_id, top.profile_id)
  // o snapshot é a base que decidiu o pódio: inclui o prêmio do duelo (+100, pago antes) e
  // exclui os +500 da conquista CAMPEÃO (concedida depois, a partir do próprio snapshot)
  const ssNow = await seasonStats(top.profile_id, activeSeason.id)
  assert.equal(num(results[0].final_points), num(top.points) + 100)
  assert.equal(num(results[0].final_points), num(ssNow.points) - 500)
  assert.equal(num(results[0].sales_amount), num(top.sales_amount))
  assert.equal(num(results[0].level), Math.floor(num(results[0].final_points) / num(s.xp_per_level)))
  assert.deepEqual(results.map((r) => num(r.final_rank)), [1, 2, 3, 4])

  // CAMPEÃO: escopo season, entry datada dentro da temporada
  assert.equal(await achievementCount(top.profile_id, 'champion'), 1)
  const champ = await one("select pa.*, e.points, e.coins, e.occurred_at, e.season_id as entry_season from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id join public.point_entries e on e.id = pa.entry_id where pa.profile_id = $1 and a.code = 'champion'", [top.profile_id])
  assert.equal(champ.season_id, activeSeason.id)
  assert.equal(num(champ.points), 500)
  assert.equal(num(champ.coins), 500)
  assert.equal(champ.entry_season, activeSeason.id)
  assert.ok(iso(champ.occurred_at) < iso(s.ends_at))
  assert.equal(await countRows("select 1 from public.profile_achievements pa join public.achievements a on a.id = pa.achievement_id where a.code = 'champion'"), 1, 'só um campeão')

  const feed = await one("select * from public.feed_events where kind = 'season_closed' and season_id = $1", [activeSeason.id])
  assert.equal(feed.payload.champion_profile_id, top.profile_id)
  assert.equal(feed.payload.season_name, activeSeason.name)
  const notif = await one("select * from public.notifications where profile_id = $1 and title = 'Temporada encerrada'", [memberC])
  assert.ok(notif.message.startsWith(activeSeason.name + ' — campeão: '))

  // missão clampada e desafio finalizado com pagamento
  const m = await one('select * from public.missions where id = $1', [mission.id])
  assert.equal(iso(m.ends_at), iso(s.ends_at))
  const c = await one('select * from public.challenges where id = $1', [duel.id])
  assert.equal(c.status, 'finished')
  assert.deepEqual(c.winner_ids, [memberA])
  assert.equal(await countRows("select 1 from public.point_entries where source = 'challenge' and profile_id = $1 and points = 100", [memberA]), 1)
  // sem temporada ativa até a próxima começar
  assert.equal((await one('select public.active_season_id() as id')).id, null)
  assert.equal((await t.rpc(admin, 'get_bootstrap')).season, null)
})

test('14.8.4 temporada fechada: novo lançamento → SEASON_CLOSED, estorno continua permitido; fechar/ativar de novo falha', async () => {
  await expectError(sale(memberA, 10), 'SEASON_CLOSED')
  await expectError(sale(memberA, 10, { p_occurred_at: hoursFromNow(-2) }), 'SEASON_CLOSED')
  const anyEntry = await one("select id from public.point_entries where profile_id = $1 and season_id = $2 and source = 'rule' and reverses_entry_id is null and not exists (select 1 from public.point_entries r where r.reverses_entry_id = point_entries.id) order by occurred_at desc limit 1", [memberA, activeSeason.id])
  const [rev] = await t.rpcRow(admin, 'reverse_entry', { p_entry_id: anyEntry.id, p_reason: 'Correção contábil' })
  assert.equal(rev.season_id, activeSeason.id)
  await expectError(t.rpc(admin, 'close_season', { p_season_id: activeSeason.id }), 'SEASON_ALREADY_CLOSED')
  await expectError(t.rpcRow(admin, 'activate_season', { p_season_id: activeSeason.id }), 'SEASON_CLOSED')
  await expectError(t.rpcRow(admin, 'activate_season', { p_season_id: nextSeason.id }), 'SEASON_NOT_STARTED')
})

test('14.8.5 activate_season (temporada já iniciada): vira a ativa, garante season_goals, notifica; stats de temporada zeradas, moedas e conquistas continuam', async () => {
  const coinsA = await coinsBalance(memberA)
  const [s] = await t.rpcRow(admin, 'activate_season', { p_season_id: prevSeason.id })
  assert.equal(s.is_active, true)
  assert.equal((await one('select public.active_season_id() as id')).id, prevSeason.id)
  assert.equal(await countRows('select 1 from public.seasons where is_active'), 1)
  assert.equal(await countRows('select 1 from public.season_goals where season_id = $1', [prevSeason.id]), 4)
  assert.equal(await countRows("select 1 from public.notifications where title = 'Nova temporada' and message = 'Temporada anterior'"), 4)
  assert.equal((await t.rpc(admin, 'get_bootstrap')).season.id, prevSeason.id)
  const me = await t.asUser(memberA, async (tx) => (await tx.query('select points, level, coins_balance, achievements_unlocked, sales_amount_lifetime from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberA, prevSeason.id])).rows[0])
  assert.equal(num(me.points), 0)
  assert.equal(num(me.level), 0)
  assert.equal(num(me.coins_balance), coinsA, 'moedas são vitalícias')
  assert.ok(num(me.achievements_unlocked) >= 3, 'conquistas vitalícias continuam')
  assert.ok(num(me.sales_amount_lifetime) > 0)
  assert.equal(await countRows("select 1 from public.audit_log where action = 'rpc' and table_name = 'activate_season' and row_id = $1", [prevSeason.id]), 1)
})
