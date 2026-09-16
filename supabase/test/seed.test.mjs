// Testes do seed e da idempotência do schema.sql (DATA-MODEL §2.7, §13, §15).
// Cria um banco a partir de schema.sql, aplica schema.sql UMA SEGUNDA VEZ e confere
// que nada duplica, que o catálogo tem exatamente o esperado e que nenhuma pessoa,
// lançamento, fila ou resgate fictício existe.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, applySchema, SCHEMA_FILE } from './pglite-harness.mjs'
import { readFile } from 'node:fs/promises'

let t

before(async () => {
  t = await createTestDb()
  await applySchema(t.db, SCHEMA_FILE) // 2ª aplicação: idempotência
})
after(async () => t?.close())

const count = async (table) => Number((await t.sql(`select count(*)::int as n from public.${table}`)).rows[0].n)

test('schema.sql começa com begin; e termina com commit;', async () => {
  const sql = (await readFile(SCHEMA_FILE, 'utf8')).trim()
  const firstStatement = sql.split('\n').find((l) => l.trim() && !l.trim().startsWith('--'))
  assert.equal(firstStatement.trim(), 'begin;')
  assert.ok(sql.endsWith('commit;'))
  assert.ok(sql.startsWith('-- '), 'cabeçalho em comentário antes do begin;')
})

test('contagens do catálogo após duas aplicações', async () => {
  assert.equal(await count('app_settings'), 1)
  assert.equal(await count('app_secrets'), 1)
  assert.equal(await count('seasons'), 1)
  assert.equal(await count('point_rules'), 10)
  assert.equal(await count('wheels'), 2)
  assert.equal(await count('wheel_prizes'), 14)
  assert.equal(await count('achievements'), 6)
  assert.equal(await count('rewards'), 7)
})

test('prêmios por roleta: 6 na clássica e 8 na premium, peso 1, cores válidas', async () => {
  const r = await t.sql(`
    select w.kind, count(*)::int as n, bool_and(p.weight = 1) as w1, bool_and(p.color ~ '^#[0-9A-F]{6}$') as colored
    from public.wheel_prizes p join public.wheels w on w.id = p.wheel_id
    group by w.kind order by w.kind`)
  assert.deepEqual(r.rows.map((x) => [x.kind, x.n, x.w1, x.colored]), [['classic', 6, true, true], ['premium', 8, true, true]])
})

test('nenhuma pessoa, lançamento, fila, giro, resgate ou notificação fictícia', async () => {
  for (const table of ['profiles', 'profile_private', 'season_goals', 'point_entries', 'missions', 'challenges',
    'special_events', 'wheel_queue', 'wheel_spins', 'reward_redemptions', 'profile_achievements', 'feed_events', 'notifications']) {
    assert.equal(await count(table), 0, `${table} deveria estar vazia`)
  }
  const users = await t.sql('select count(*)::int as n from auth.users')
  assert.equal(Number(users.rows[0].n), 0)
})

test('temporada: exatamente uma ativa, nomeada pelo mês corrente e cobrindo hoje', async () => {
  const r = await t.sql(`
    select name, is_active, closed_at, team_goal_amount::text as goal, xp_per_level,
      (now() >= starts_at and now() < ends_at) as covers_today,
      (starts_at = date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') as starts_first_day,
      (ends_at = (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo') as ends_next_month
    from public.seasons where is_active`)
  assert.equal(r.rows.length, 1)
  const s = r.rows[0]
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const local = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  assert.equal(s.name, `${months[local.getMonth()]} ${local.getFullYear()}`)
  assert.equal(s.covers_today, true)
  assert.equal(s.starts_first_day, true)
  assert.equal(s.ends_next_month, true)
  assert.equal(s.closed_at, null)
  assert.equal(s.goal, '0.00')
  assert.equal(s.xp_per_level, 400)
})

test('app_settings com os defaults do §13.1', async () => {
  const r = await t.sql(`select company_name, xp_per_level, currency, timezone, target_conversion_pct::text as conv,
    target_attendance_pct::text as att, target_crm_pct::text as crm, target_activities_count, rank_admins, auto_approve_members
    from public.app_settings where id = 1`)
  assert.deepEqual(r.rows[0], {
    company_name: 'Orbion', xp_per_level: 400, currency: 'BRL', timezone: 'America/Sao_Paulo',
    conv: '25.00', att: '70.00', crm: '95.00', target_activities_count: 1000, rank_admins: true, auto_approve_members: false,
  })
})

test('app_secrets: team_code de 12 hex maiúsculos, bootstrap_done = false, bootstrap_email null', async () => {
  const r = await t.sql('select team_code, bootstrap_done, bootstrap_email from public.app_secrets where id = 1')
  assert.equal(r.rows.length, 1)
  assert.match(r.rows[0].team_code, /^[A-F0-9]{12}$/)
  assert.equal(r.rows[0].bootstrap_done, false)
  assert.equal(r.rows[0].bootstrap_email, null)
})

test('validate_team_code: errado → false, seed → true, nunca NULL (também como anon)', async () => {
  const { team_code } = (await t.sql('select team_code from public.app_secrets where id = 1')).rows[0]
  const wrong = await t.rpc(null, 'validate_team_code', { p_code: 'WRONGCODE000' }, 'anon')
  assert.equal(wrong, false)
  const nul = await t.rpc(null, 'validate_team_code', { p_code: null }, 'anon')
  assert.equal(nul, false)
  const right = await t.rpc(null, 'validate_team_code', { p_code: team_code }, 'anon')
  assert.equal(right, true)
  const lower = await t.rpc(null, 'validate_team_code', { p_code: ` ${team_code.toLowerCase()} ` }, 'anon')
  assert.equal(lower, true, 'aceita minúsculas e espaços (upper(trim))')
})

test('point_rules: regras auto e requires_amount conforme §13.4', async () => {
  const r = await t.sql(`select name, metric, points, coins, trigger_kind, amount_step::text as step, requires_amount
    from public.point_rules order by sort_order`)
  assert.deepEqual(r.rows.map((x) => x.name), ['Reunião agendada', 'Reunião realizada', 'Venda realizada', 'R$ 10.000 vendidos',
    'Meta semanal', 'Meta mensal', 'CRM atualizado', 'Recuperação de lead', 'Upsell', 'Ligação realizada'])
  assert.ok(r.rows.every((x) => x.points === x.coins), 'coins = points')
  const sale = r.rows.find((x) => x.metric === 'sale')
  assert.equal(sale.requires_amount, true)
  const step = r.rows.find((x) => x.trigger_kind === 'auto_amount_step')
  assert.equal(step.step, '10000.00')
  assert.equal(r.rows.find((x) => x.trigger_kind === 'auto_goal').metric, 'monthly_goal')
  assert.equal(r.rows.filter((x) => x.trigger_kind === 'manual').length, 8)
})

test('storage: bucket avatars público, 1,5 MB, sem svg/gif; 4 policies; realtime com 5 tabelas', async () => {
  const b = (await t.sql(`select public, file_size_limit::int as lim, allowed_mime_types as mimes from storage.buckets where id = 'avatars'`)).rows[0]
  assert.equal(b.public, true)
  assert.equal(b.lim, 1572864)
  assert.deepEqual(b.mimes, ['image/jpeg', 'image/png', 'image/webp'])
  const p = await t.sql(`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname`)
  assert.deepEqual(p.rows.map((x) => x.policyname), ['avatars_delete_own_or_admin', 'avatars_insert_own_or_admin', 'avatars_select_members', 'avatars_update_own_or_admin'])
  const pub = await t.sql(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename`)
  assert.deepEqual(pub.rows.map((x) => x.tablename), ['feed_events', 'notifications', 'wheel_prizes', 'wheel_queue', 'wheel_spins'])
  const ri = await t.sql(`select relname, relreplident from pg_class where relname in ('wheel_queue','wheel_spins','wheel_prizes','notifications') order by relname`)
  assert.ok(ri.rows.every((x) => x.relreplident === 'f'), 'replica identity full')
})

test('reaplicar o schema preserva team_code e temporada; migrations em ordem produzem o mesmo catálogo', async () => {
  const fresh = await createTestDb({ useMigrations: true })
  try {
    const before = (await fresh.sql('select team_code from public.app_secrets where id = 1')).rows[0].team_code
    const seasonBefore = (await fresh.sql('select id from public.seasons')).rows[0].id
    await applySchema(fresh.db, SCHEMA_FILE)
    const afterRow = (await fresh.sql('select team_code from public.app_secrets where id = 1')).rows[0]
    assert.equal(afterRow.team_code, before)
    assert.equal((await fresh.sql('select id from public.seasons')).rows[0].id, seasonBefore)
    const n = (await fresh.sql(`select (select count(*) from public.point_rules)::int as rules, (select count(*) from public.wheel_prizes)::int as prizes,
      (select count(*) from public.achievements)::int as ach, (select count(*) from public.rewards)::int as rew, (select count(*) from public.seasons)::int as seasons`)).rows[0]
    assert.deepEqual(n, { rules: 10, prizes: 14, ach: 6, rew: 7, seasons: 1 })
  } finally {
    await fresh.close()
  }
})
