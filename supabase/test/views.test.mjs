// Views (DATA-MODEL §5): cenário pequeno montado só por RPCs e asserts de colunas/números
// documentados em v_profile_stats, v_ranking, v_team_stats, v_wallet, v_mission_board,
// v_challenge_board, v_activity_feed, v_sales_timeline, v_wheel_history; e recompute_stats
// reproduzindo exatamente as mesmas stats. Contas são rótulos técnicos, não pessoas.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, num } from './pglite-harness.mjs'

let t
let teamCode, admin, memberA, memberB, pendingC, season, rules, mission, duel, spin

const one = async (text, params = []) => (await t.sql(text, params)).rows[0]
const rows = async (text, params = []) => (await t.sql(text, params)).rows
const iso = (d) => new Date(d).toISOString()
const view = (userId, text, params = []) => t.asUser(userId, async (tx) => (await tx.query(text, params)).rows)
const viewOne = async (userId, text, params = []) => (await view(userId, text, params))[0]
const ruleEntry = (profileId, ruleName, extra = {}) =>
  t.rpcRow(admin, 'record_rule_entry', { p_profile_id: profileId, p_rule_id: rules[ruleName].id, p_quantity: 1, ...extra })

// Cenário (todos os lançamentos "agora", na temporada ativa):
//   membro-a: venda 8500 (100/100 + PRIMEIRA VENDA 50/50 + missão 20/20 + giro earned), 2 ligações (10/10),
//             ajuste manual +30 (30/30), roleta manual aprovada (+100/0)               → 310 pts / 210 moedas
//   membro-b: venda 3000 (100/100 + 50/50 + 20/20 + giro earned), reunião agendada (10/10),
//             reunião realizada (20/20), CRM atualizado (10/10)                        → 210 pts / 210 moedas
//   gestor: 0 pts (rank_admins = true → ranqueado, has_points = false); membro-c: pending (rank NULL)
before(async () => {
  t = await createTestDb()
  teamCode = (await one('select team_code from public.app_secrets where id = 1')).team_code
  season = await one('select * from public.seasons where is_active')
  rules = {}
  for (const r of await rows('select * from public.point_rules where deleted_at is null')) rules[r.name] = r

  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  await t.rpcRow(admin, 'update_app_settings', { p_patch: { auto_approve_members: true } })
  memberA = await t.createAuthUser({ email: 'membro-a@teste.local', metadata: { team_code: teamCode, full_name: 'Membro A' } })
  memberB = await t.createAuthUser({ email: 'membro-b@teste.local', metadata: { team_code: teamCode, full_name: 'Membro B' } })
  await t.rpcRow(admin, 'update_app_settings', { p_patch: { auto_approve_members: false } })
  pendingC = await t.createAuthUser({ email: 'membro-c@teste.local', metadata: { team_code: teamCode, full_name: 'Membro C' } })
  assert.equal((await one('select status from public.profiles where id = $1', [pendingC])).status, 'pending')

  // metas: individual do membro-a (20.000) e da equipe (100.000)
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: memberA, p_patch: { goal_amount: 20000 } })
  ;[season] = await t.rpcRow(admin, 'update_season', { p_season_id: season.id, p_patch: { team_goal_amount: 100000 } })

  // roleta clássica determinística (2 setores iguais de 100 pontos)
  await t.rpcRow(admin, 'save_wheel_prizes', {
    p_wheel_kind: 'classic',
    p_prizes: [{ label: '100 pontos', kind: 'points', value: 100, weight: 1, sort_order: 0 }, { label: '100 pontos', kind: 'points', value: 100, weight: 1, sort_order: 1 }],
  })
  // missão diária (venda, alvo 1, 20/20 + giro clássico) e duelo (sales_count, alvo 2) antes das vendas
  ;[mission] = await t.rpcRow(admin, 'save_mission', {
    p: { title: 'Venda do dia', kind: 'daily', metric: 'sale', target_kind: 'count', target_value: 1, reward_points: 20, reward_coins: 20,
         reward_spin: 'classic', starts_at: iso(season.starts_at), ends_at: iso(season.ends_at), audience: 'all' },
  })
  ;[duel] = await t.rpcRow(admin, 'save_challenge', {
    p: { name: 'Duelo do dia', kind: 'duel', metric: 'sales_count', target_value: 2, reward_points: 100, reward_coins: 100,
         starts_at: iso(Date.now()), ends_at: iso(season.ends_at), participant_ids: [memberA, memberB] },
  })
  await t.rpcRow(admin, 'activate_challenge', { p_challenge_id: duel.id })

  await ruleEntry(memberA, 'Venda realizada', { p_amount: 8500 })
  await ruleEntry(memberA, 'Ligação realizada', { p_quantity: 2 })
  await t.rpcRow(admin, 'record_manual_entry', { p_profile_id: memberA, p_points: 30, p_reason: 'Elogio de cliente' })
  await ruleEntry(memberB, 'Venda realizada', { p_amount: 3000 })
  await ruleEntry(memberB, 'Reunião agendada')
  await ruleEntry(memberB, 'Reunião realizada')
  await ruleEntry(memberB, 'CRM atualizado')

  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberA, p_wheel_kind: 'classic', p_attempts: 1 })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const r = await t.rpc(memberA, 'spin_wheel', { p_queue_id: q.id })
  await t.rpc(admin, 'approve_spin', { p_spin_id: r.spin_id })
  spin = await one('select * from public.wheel_spins where id = $1', [r.spin_id])
  assert.equal(spin.status, 'approved')
})
after(async () => t?.close())

test('v_profile_stats: números documentados do membro-a (pontos, nível, metas, moedas, streak, conquistas, giros pendentes)', async () => {
  const a = await viewOne(memberA, 'select * from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberA, season.id])
  assert.equal(a.full_name, 'Membro A')
  assert.equal(a.role, 'collaborator')
  assert.equal(a.status, 'active')
  assert.equal(a.season_is_active, true)
  assert.equal(num(a.points), 310)
  assert.equal(num(a.points_earned), 310)
  assert.equal(num(a.sales_amount), 8500)
  assert.equal(num(a.sales_count), 1)
  assert.equal(num(a.calls), 2)
  assert.equal(num(a.meetings_held), 0)
  assert.equal(num(a.activities_count), 4, 'venda + 2 ligações + ajuste manual')
  assert.equal(num(a.missions_completed), 1)
  assert.equal(a.conversion_pct, null, 'sem reuniões realizadas → NULL, nunca divisão por zero')
  assert.equal(a.attendance_pct, null)
  assert.equal(num(a.goal_amount), 20000)
  assert.equal(num(a.goal_pct), 42.5)
  assert.equal(num(a.goal_missing_amount), 11500)
  assert.ok(a.projected_goal_date, 'projeção existe quando 0 < vendas < meta')
  assert.ok(iso(a.projected_goal_date) > iso(season.starts_at))
  assert.equal(num(a.xp_per_level), 400)
  assert.equal(num(a.level), 0)
  assert.equal(num(a.xp_in_level), 310)
  assert.equal(num(a.xp_to_next), 90)
  assert.equal(num(a.coins_balance), 210)
  assert.equal(num(a.coins_earned_lifetime), 210)
  assert.equal(num(a.coins_spent_lifetime), 0)
  assert.equal(num(a.streak_days), 1)
  assert.equal(num(a.best_streak_days), 1)
  assert.equal(num(a.sales_amount_lifetime), 8500)
  assert.equal(num(a.sales_count_lifetime), 1)
  assert.equal(num(a.rank), 1)
  assert.equal(a.gap_to_above, null, 'líder não tem gap')
  assert.equal(a.is_tied_with_above, false)
  assert.equal(a.has_points, true)
  assert.equal(num(a.achievements_unlocked), 1)
  assert.equal(num(a.achievements_total), 6)
  assert.equal(num(a.pending_earned_spins), 1, 'giro ganho pela missão aguardando liberação')
  assert.ok(a.last_entry_at)
  assert.equal(a.email, 'membro-a@teste.local', 'próprio perfil vê o e-mail')

  const b = await viewOne(memberB, 'select * from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberB, season.id])
  assert.equal(num(b.points), 210)
  assert.equal(num(b.meetings_scheduled), 1)
  assert.equal(num(b.meetings_held), 1)
  assert.equal(num(b.crm_updates), 1)
  assert.equal(num(b.activities_count), 4)
  assert.equal(num(b.conversion_pct), 100)
  assert.equal(num(b.attendance_pct), 100)
  assert.equal(num(b.goal_amount), 0)
  assert.equal(b.goal_pct, null)
  assert.equal(num(b.goal_missing_amount), 0)
  assert.equal(b.projected_goal_date, null)
  assert.equal(num(b.rank), 2)
  assert.equal(num(b.gap_to_above), 100)

  // pendente e gestor: linha existe; pendente nunca ranqueia; gestor ranqueia (rank_admins = true) sem pontos
  const all = await view(admin, 'select profile_id, status, role, rank, points, has_points, email from public.v_profile_stats where season_id = $1 order by rank nulls last', [season.id])
  assert.equal(all.length, 4, 'perfil × temporada inclui inativos/pendentes')
  const c = all.find((x) => x.profile_id === pendingC)
  assert.equal(c.rank, null)
  assert.equal(c.status, 'pending')
  const g = all.find((x) => x.profile_id === admin)
  assert.equal(num(g.rank), 3)
  assert.equal(g.has_points, false)
  assert.ok(g.email, 'gestor vê e-mails')
  // colaborador não vê e-mail alheio (own-or-admin sai NULL)
  const bSeenByA = await viewOne(memberA, 'select email, phone from public.v_profile_stats where profile_id = $1 and season_id = $2', [memberB, season.id])
  assert.equal(bSeenByA.email, null)
})

test('v_ranking: só ranqueáveis, ordenado, gap_to_above NULL para o líder; rank_admins=false tira o gestor', async () => {
  const rk = await view(memberB, 'select * from public.v_ranking where season_id = $1 order by rank', [season.id])
  assert.deepEqual(rk.map((r) => [r.profile_id, num(r.rank), r.gap_to_above === null ? null : num(r.gap_to_above), num(r.points)]), [
    [memberA, 1, null, 310],
    [memberB, 2, 100, 210],
    [admin, 3, 210, 0],
  ])
  assert.equal(rk[0].full_name, 'Membro A')
  assert.equal(num(rk[0].level), 0)
  assert.equal(num(rk[0].sales_amount), 8500)
  assert.equal(num(rk[1].conversion_pct), 100)
  assert.equal(rk[2].has_points, false)
  assert.ok(!rk.some((r) => r.profile_id === pendingC), 'pendente ausente')
  // colunas expostas: sem e-mail/telefone
  assert.ok(!('email' in rk[0]) && !('phone' in rk[0]))

  await t.rpcRow(admin, 'update_app_settings', { p_patch: { rank_admins: false } })
  const rk2 = await view(memberB, 'select profile_id, rank, gap_to_above from public.v_ranking where season_id = $1 order by rank', [season.id])
  assert.deepEqual(rk2.map((r) => [r.profile_id, num(r.rank)]), [[memberA, 1], [memberB, 2]])
  assert.equal(rk2[0].gap_to_above, null)
  const g = await viewOne(admin, 'select rank from public.v_profile_stats where profile_id = $1 and season_id = $2', [admin, season.id])
  assert.equal(g.rank, null)
  await t.rpcRow(admin, 'update_app_settings', { p_patch: { rank_admins: true } })
})

test('v_team_stats: uma linha por temporada com somas, percentuais, contagens e fila', async () => {
  const ts = await viewOne(memberA, 'select * from public.v_team_stats where season_id = $1', [season.id])
  assert.equal(ts.season_name, season.name)
  assert.equal(ts.is_active, true)
  assert.equal(num(ts.team_goal_amount), 100000)
  assert.equal(num(ts.sales_amount), 11500)
  assert.equal(num(ts.attainment_pct), 11.5)
  assert.equal(num(ts.sales_missing_amount), 88500)
  assert.equal(num(ts.points_total), 520)
  assert.equal(num(ts.points_distributed), 520)
  assert.equal(num(ts.active_count), 3)
  assert.equal(num(ts.pending_count), 1)
  assert.equal(num(ts.total_count), 4)
  assert.equal(num(ts.sales_count), 2)
  assert.equal(num(ts.meetings_scheduled), 1)
  assert.equal(num(ts.meetings_held), 1)
  assert.equal(num(ts.calls), 2)
  assert.equal(num(ts.crm_updates), 1)
  assert.equal(num(ts.activities_count), 8)
  assert.equal(num(ts.missions_completed), 2)
  assert.equal(num(ts.avg_conversion_pct), 100, 'média só sobre ativos com reuniões realizadas (membro-b)')
  assert.equal(num(ts.attendance_pct), 100)
  assert.equal(num(ts.crm_pct), 33.33, '1 de 3 ativos com CRM atualizado')
  assert.equal(num(ts.queue_count), 2, '2 giros earned aguardando; a fila manual já está done')
  assert.ok(ts.target_conversion_pct !== undefined && ts.target_activities_count !== undefined)
  // temporada sem stats: zeros e percentuais NULL
  const [other] = await t.rpcRow(admin, 'create_season', { p_name: 'Futura', p_starts_on: '2031-01-01', p_ends_on: '2031-01-31' })
  const ts2 = await viewOne(memberA, 'select * from public.v_team_stats where season_id = $1', [other.id])
  assert.equal(num(ts2.sales_amount), 0)
  assert.equal(num(ts2.points_total), 0)
  assert.equal(ts2.attainment_pct, null)
  assert.equal(ts2.avg_conversion_pct, null)
  assert.equal(num(ts2.crm_pct), 0, '0 de 3 ativos com CRM')
})

test('v_wallet: saldo e origens das moedas (só créditos), própria linha para o colaborador e todas para o gestor', async () => {
  const w = await viewOne(memberA, 'select * from public.v_wallet where profile_id = $1', [memberA])
  assert.equal(num(w.coins_balance), 210)
  assert.equal(num(w.coins_earned), 210)
  assert.equal(num(w.coins_spent), 0)
  assert.equal(num(w.coins_from_sales), 100)
  assert.equal(num(w.coins_from_missions), 20)
  assert.equal(num(w.coins_from_goals), 0)
  assert.equal(num(w.coins_from_wheel), 0, 'prêmio de pontos não dá moedas')
  assert.equal(num(w.coins_from_challenges), 0)
  assert.equal(num(w.coins_from_achievements), 50)
  assert.equal(num(w.coins_from_manual), 30)
  // ligações (10 moedas) não entram em nenhuma origem documentada: origens ≤ saldo
  const origins = ['coins_from_sales', 'coins_from_missions', 'coins_from_goals', 'coins_from_wheel', 'coins_from_challenges', 'coins_from_achievements', 'coins_from_manual']
  assert.equal(origins.reduce((s, k) => s + num(w[k]), 0), 200)
  assert.equal((await view(memberA, 'select profile_id from public.v_wallet')).length, 1, 'colaborador vê só a própria carteira')
  assert.equal((await view(admin, 'select profile_id from public.v_wallet')).length, 4, 'gestor vê todas (inclusive pendente)')
  // "últimos 3 créditos" (query direta documentada em §14.5)
  const last3 = await view(memberA, 'select id, coins, reason, source, metric, occurred_at from public.point_entries where coins > 0 order by occurred_at desc, created_at desc limit 3')
  assert.equal(last3.length, 3)
  assert.ok(last3.every((e) => num(e.coins) > 0))
})

test('v_mission_board: missão × perfil ativo, período corrente, progresso e status da fila do giro', async () => {
  const board = await view(memberA, 'select * from public.v_mission_board where mission_id = $1 order by profile_id', [mission.id])
  assert.equal(board.length, 3, 'gestor + 2 membros ativos; pendente fora')
  assert.ok(!board.some((r) => r.profile_id === pendingC))
  const a = board.find((r) => r.profile_id === memberA)
  assert.equal(a.title, 'Venda do dia')
  assert.equal(a.kind, 'daily')
  assert.equal(a.is_current, true)
  assert.ok(a.period_key && a.period_start && a.period_end)
  assert.equal(num(a.progress_value), 1)
  assert.equal(num(a.progress_pct), 100)
  assert.equal(a.is_completed, true)
  assert.ok(a.completed_at)
  assert.ok(num(a.seconds_remaining) > 0)
  assert.equal(a.spin_queue_status, 'waiting')
  const g = board.find((r) => r.profile_id === admin)
  assert.equal(num(g.progress_value), 0)
  assert.equal(num(g.progress_pct), 0)
  assert.equal(g.is_completed, false)
  assert.equal(g.spin_queue_status, null)
})

test('v_challenge_board: duelo com exatamente 2 participantes em jsonb ordenado por valor, total e percentual', async () => {
  const c = await viewOne(memberB, 'select * from public.v_challenge_board where challenge_id = $1', [duel.id])
  assert.equal(c.name, 'Duelo do dia')
  assert.equal(c.kind, 'duel')
  assert.equal(c.metric, 'sales_count')
  assert.equal(c.status, 'active')
  assert.equal(num(c.target_value), 2)
  assert.equal(num(c.participants_count), 2)
  assert.equal(num(c.total_value), 2)
  assert.equal(num(c.total_pct), 100)
  assert.ok(num(c.days_left) >= 0)
  assert.equal(c.participants.length, 2)
  for (const p of c.participants) {
    assert.deepEqual(Object.keys(p).sort(), ['avatar_path', 'color', 'full_name', 'is_winner', 'job_title', 'pct', 'profile_id', 'status', 'value'])
    assert.equal(num(p.value), 1)
    assert.equal(num(p.pct), 50)
    assert.equal(p.is_winner, false)
    assert.equal(p.status, 'active')
  }
  assert.deepEqual(c.participants.map((p) => p.full_name), ['Membro A', 'Membro B'], 'empate → ordem por nome')
  assert.deepEqual(c.winner_ids, [])
})

test('v_activity_feed: eventos do cenário com nome/avatar do perfil, payload jsonb e ordem cronológica', async () => {
  const feed = await view(memberB, 'select * from public.v_activity_feed where season_id = $1 order by occurred_at desc, id', [season.id])
  const kinds = feed.map((f) => f.kind)
  assert.equal(kinds.filter((k) => k === 'sale').length, 2)
  assert.equal(kinds.filter((k) => k === 'achievement').length, 2)
  assert.equal(kinds.filter((k) => k === 'mission_completed').length, 2)
  assert.equal(kinds.filter((k) => k === 'wheel_prize').length, 1)
  assert.equal(kinds.filter((k) => k === 'level_up').length, 0, 'ninguém passou de 400 pontos')
  const saleA = feed.find((f) => f.kind === 'sale' && f.profile_id === memberA)
  assert.equal(saleA.full_name, 'Membro A')
  assert.equal(num(saleA.payload.amount), 8500)
  assert.deepEqual(Object.keys(saleA).sort(), ['avatar_path', 'color', 'full_name', 'id', 'job_title', 'kind', 'occurred_at', 'payload', 'profile_id', 'season_id'])
  const ach = feed.find((f) => f.kind === 'achievement' && f.profile_id === memberB)
  assert.equal(ach.payload.code, 'first_sale')
  assert.equal(ach.payload.title, 'PRIMEIRA VENDA')
  const wheel = feed.find((f) => f.kind === 'wheel_prize')
  assert.equal(wheel.profile_id, memberA)
  // pendente não lê o feed (RLS de membro ativo)
  assert.equal((await view(pendingC, 'select id from public.v_activity_feed')).length, 0)
})

test('v_sales_timeline: série diária zero-filled do início da temporada até hoje, acumulados e só o dia de hoje com vendas', async () => {
  // view "(ledger, admin)": o gestor vê o ledger inteiro; colaborador só as próprias entries (RLS)
  const tl = await view(admin, 'select * from public.v_sales_timeline where season_id = $1 order by day', [season.id])
  const own = await viewOne(memberA, 'select * from public.v_sales_timeline where season_id = $1 order by day desc limit 1', [season.id])
  assert.equal(num(own.sales_amount), 8500, 'colaborador enxerga só o próprio ledger na série')
  const expected = await one(`select (public.local_today() - public.local_day(starts_at) + 1)::int as n, public.local_today() as today from public.seasons where id = $1`, [season.id])
  assert.equal(tl.length, num(expected.n), 'um ponto por dia local desde o início da temporada')
  const last = tl[tl.length - 1]
  assert.equal(iso(last.day).slice(0, 10), iso(expected.today).slice(0, 10))
  assert.equal(num(last.sales_amount), 11500)
  assert.equal(num(last.sales_count), 2)
  assert.equal(num(last.sales_cum), 11500)
  assert.equal(num(last.points), 520, 'todos os pontos do dia (vendas, conquistas, missões, ajustes, roleta)')
  assert.equal(num(last.points_cum), 520)
  assert.equal(num(last.entries_count), await (async () => Number((await one('select count(*)::int as n from public.point_entries where season_id = $1', [season.id])).n))())
  for (const d of tl.slice(0, -1)) {
    assert.equal(num(d.sales_amount), 0)
    assert.equal(num(d.sales_count), 0)
    assert.equal(num(d.points), 0)
    assert.equal(num(d.entries_count), 0)
    assert.equal(num(d.sales_cum), 0)
  }
  // dias consecutivos, sem buraco
  for (let i = 1; i < tl.length; i++) {
    assert.equal(new Date(tl[i].day) - new Date(tl[i - 1].day), 86400000)
  }
  // estorno de uma venda: dia soma -1 em sales_count e -valor em sales_amount (ledger, não snapshot)
  const saleB = await one("select id from public.point_entries where profile_id = $1 and metric = 'sale' and source = 'rule' and reverses_entry_id is null", [memberB])
  await t.rpcRow(admin, 'reverse_entry', { p_entry_id: saleB.id, p_reason: 'Cancelada' })
  const after = await viewOne(admin, 'select * from public.v_sales_timeline where season_id = $1 order by day desc limit 1', [season.id])
  assert.equal(num(after.sales_amount), 8500)
  assert.equal(num(after.sales_count), 1)
  assert.equal(num(after.points), 420)
})

test('v_wheel_history: giro aprovado com prêmio, roleta, tentativa e nome de quem aprovou', async () => {
  const h = await view(memberB, 'select * from public.v_wheel_history order by approved_at desc')
  assert.equal(h.length, 1, 'só giros aprovados')
  const s = h[0]
  assert.equal(s.spin_id, spin.id)
  assert.equal(s.profile_id, memberA)
  assert.equal(s.person_name, 'Membro A')
  assert.equal(s.wheel_kind, 'classic')
  assert.equal(s.prize_kind, 'points')
  assert.equal(num(s.prize_value), 100)
  assert.equal(s.prize_label, '100 pontos')
  assert.equal(s.resolved_kind, 'points')
  assert.equal(num(s.resolved_value), 100)
  assert.equal(s.credited, true)
  assert.equal(num(s.attempt_index), 1)
  assert.ok(s.spun_at && s.approved_at)
  assert.equal(s.approved_by_name, (await one('select full_name from public.profiles where id = $1', [admin])).full_name)
  // giro rejeitado não aparece
  const [q] = await t.rpcRow(admin, 'enqueue_wheel', { p_profile_id: memberB, p_wheel_kind: 'classic', p_attempts: 1 })
  await t.rpcRow(admin, 'release_turn', { p_queue_id: q.id })
  const r = await t.rpc(memberB, 'spin_wheel', { p_queue_id: q.id })
  await t.rpc(admin, 'reject_spin', { p_spin_id: r.spin_id })
  assert.equal((await view(memberB, 'select spin_id from public.v_wheel_history')).length, 1)
})

test('recompute_stats reproduz exatamente v_profile_stats e as stats vitalícias a partir do ledger', async () => {
  const cols = `profile_id, points, points_earned, sales_amount, sales_count, meetings_scheduled, meetings_held, calls, crm_updates,
    lead_recoveries, upsells, activities_count, missions_completed, conversion_pct, attendance_pct, goal_pct, goal_missing_amount,
    level, xp_in_level, xp_to_next, coins_balance, coins_earned_lifetime, coins_spent_lifetime, streak_days, best_streak_days,
    sales_amount_lifetime, sales_count_lifetime, rank, gap_to_above, has_points, achievements_unlocked`
  const snapshot = () => view(admin, `select ${cols} from public.v_profile_stats where season_id = $1 order by profile_id`, [season.id])
  const before = await snapshot()
  const lsBefore = await rows('select profile_id, coins_earned, coins_spent, coins_balance, sales_amount, sales_count, missions_completed, streak_days, streak_last_day, best_streak_days, first_sale_at from public.profile_lifetime_stats order by profile_id')
  // corrompe as stats de propósito: recompute tem que reconstruir tudo do ledger
  await t.sql('update public.profile_season_stats set points = 0, sales_amount = 0, sales_count = 0, activities_count = 0, calls = 0, coins_earned = 0')
  await t.sql('update public.profile_lifetime_stats set coins_earned = 0, coins_spent = 0, sales_amount = 0, streak_days = 0, streak_last_day = null')
  assert.notDeepEqual(await snapshot(), before)

  const res = await t.rpc(admin, 'recompute_stats', {})
  assert.ok(res !== undefined)
  assert.deepEqual(await snapshot(), before)
  const lsAfter = await rows('select profile_id, coins_earned, coins_spent, coins_balance, sales_amount, sales_count, missions_completed, streak_days, streak_last_day, best_streak_days, first_sale_at from public.profile_lifetime_stats order by profile_id')
  assert.deepEqual(lsAfter, lsBefore)
  // versão por perfil também funciona e é idempotente
  await t.rpc(admin, 'recompute_stats', { p_profile_id: memberA })
  assert.deepEqual(await snapshot(), before)
  // e o ledger continua batendo com as views
  const sum = await one('select sum(points)::int as p from public.point_entries where profile_id = $1 and season_id = $2', [memberA, season.id])
  assert.equal(num(before.find((r) => r.profile_id === memberA).points), num(sum.p))
})
