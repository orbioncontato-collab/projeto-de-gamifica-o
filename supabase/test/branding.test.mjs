// Marca (migration 14): colunas novas em app_settings, update_app_settings com os campos
// de marca, get_branding() para anon (só o que a tela de login mostra) e limites do logo.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectError, expectRlsDenied } from './pglite-harness.mjs'

let t
let admin, member

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

before(async () => {
  t = await createTestDb()
  const teamCode = (await t.sql('select team_code from public.app_secrets where id = 1')).rows[0].team_code
  admin = await t.createAuthUser({ email: 'gestor@teste.local', confirmed: true })
  member = await t.createAuthUser({ email: 'membro@teste.local', metadata: { team_code: teamCode, full_name: 'Membro' } })
  await t.rpc(admin, 'admin_update_profile', { p_profile_id: member, p_patch: { status: 'active' } })
})
after(async () => t?.close())

test('defaults: Sales League, preset esmeralda, sem logo, tema escuro', async () => {
  const r = (await t.sql('select platform_name, brand_preset, logo_data_url, default_theme from public.app_settings where id = 1')).rows[0]
  assert.deepEqual(r, { platform_name: 'Sales League', brand_preset: 'esmeralda', logo_data_url: null, default_theme: 'dark' })
})

test('get_branding: anon lê só os 5 campos da marca; nada de metas, fuso ou segredos', async () => {
  const b = await t.rpc(null, 'get_branding', {}, 'anon')
  assert.deepEqual(Object.keys(b).sort(), ['brand_preset', 'company_name', 'default_theme', 'logo_data_url', 'platform_name'])
  assert.equal(b.company_name, 'Orbion')
  assert.equal(b.platform_name, 'Sales League')
  // a tabela em si continua fechada para anon
  await expectRlsDenied(t.asAnon((tx) => tx.query('select * from public.app_settings')))
})

test('update_app_settings: gestor altera nome da plataforma, preset, logo e tema; get_branding reflete', async () => {
  const [row] = await t.rpcRow(admin, 'update_app_settings', {
    p_patch: { platform_name: 'Liga Acme', brand_preset: 'safira', logo_data_url: PNG_1PX, default_theme: 'light', company_name: 'Acme' },
  })
  assert.equal(row.platform_name, 'Liga Acme')
  assert.equal(row.brand_preset, 'safira')
  assert.equal(row.logo_data_url, PNG_1PX)
  assert.equal(row.default_theme, 'light')
  const b = await t.rpc(null, 'get_branding', {}, 'anon')
  assert.deepEqual(b, {
    company_name: 'Acme',
    platform_name: 'Liga Acme',
    brand_preset: 'safira',
    logo_data_url: PNG_1PX,
    default_theme: 'light',
  })
})

test('update_app_settings: logo_data_url = null apaga a logo (não é ignorado como coalesce)', async () => {
  const [row] = await t.rpcRow(admin, 'update_app_settings', { p_patch: { logo_data_url: null } })
  assert.equal(row.logo_data_url, null)
  // patch sem a chave não mexe na logo
  await t.rpc(admin, 'update_app_settings', { p_patch: { logo_data_url: PNG_1PX } })
  const [again] = await t.rpcRow(admin, 'update_app_settings', { p_patch: { platform_name: 'Liga Acme 2' } })
  assert.equal(again.logo_data_url, PNG_1PX)
})

test('audit_log: a logo não é gravada no audit (só o marcador <logo>)', async () => {
  const r = await t.sql(
    `select new_data as payload from public.audit_log where table_name = 'update_app_settings' order by id desc limit 5`,
  )
  const withLogo = r.rows.map((x) => x.payload).filter((p) => p && 'logo_data_url' in p)
  assert.ok(withLogo.length >= 2, 'houve patches com logo_data_url')
  for (const p of withLogo) assert.ok(p.logo_data_url === null || p.logo_data_url === '<logo>', JSON.stringify(p))
  assert.ok(!JSON.stringify(r.rows).includes('base64'), 'nenhum base64 no audit')
})

test('validação: preset desconhecido, nome vazio/longo, tema inválido, logo sem prefixo ou grande → INVALID_ARGUMENT', async () => {
  await expectError(t.rpc(admin, 'update_app_settings', { p_patch: { brand_preset: 'neon' } }), /INVALID_ARGUMENT/)
  await expectError(t.rpc(admin, 'update_app_settings', { p_patch: { platform_name: '' } }), /INVALID_ARGUMENT/)
  await expectError(t.rpc(admin, 'update_app_settings', { p_patch: { platform_name: 'x'.repeat(41) } }), /INVALID_ARGUMENT/)
  await expectError(t.rpc(admin, 'update_app_settings', { p_patch: { default_theme: 'auto' } }), /INVALID_ARGUMENT/)
  await expectError(t.rpc(admin, 'update_app_settings', { p_patch: { logo_data_url: 'https://x/logo.png' } }), /INVALID_ARGUMENT/)
  await expectError(
    t.rpc(admin, 'update_app_settings', { p_patch: { logo_data_url: 'data:image/png;base64,' + 'A'.repeat(280001) } }),
    /INVALID_ARGUMENT/,
  )
})

test('colaborador não altera a marca (NOT_ADMIN)', async () => {
  await expectError(t.rpc(member, 'update_app_settings', { p_patch: { brand_preset: 'coral' } }), 'NOT_ADMIN')
})

test('schema.sql idempotente: reaplicar sobre o banco instalado preserva a marca configurada', async () => {
  await t.rpc(admin, 'update_app_settings', { p_patch: { brand_preset: 'ambar', platform_name: 'Liga Final' } })
  const { applySchema } = await import('./pglite-harness.mjs')
  await applySchema(t.db)
  const r = (await t.sql('select platform_name, brand_preset from public.app_settings where id = 1')).rows[0]
  assert.deepEqual(r, { platform_name: 'Liga Final', brand_preset: 'ambar' })
})
