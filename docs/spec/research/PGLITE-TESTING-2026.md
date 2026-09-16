# Testar migrations Supabase localmente com PGlite (sem Docker, sem Supabase CLI)

> Pesquisa + prova prática executada em 15/09/2026 neste Mac (Node v26.5.0, npm 11.17.0, `@electric-sql/pglite` 0.5.8 = PostgreSQL 18.3 em WASM).
> Probe executado em `/private/tmp/claude-501/-Users-alves-financeiro-dash/bd08e00b-e88b-4ffb-9475-a4577506e162/scratchpad/pglite-probe` (`probe.mjs`, `probe2.mjs`, `supabase/test/`). Resultado: 26/26 passos do probe e 3/3 testes do harness passaram.

## 1. Objetivo

Validar os arquivos `supabase/migrations/*.sql` do projeto (DDL, RLS, policies, triggers, funções `security definer`, views `security_invoker`, enums) sem subir Docker nem o Supabase CLI, usando apenas Node + PGlite em memória. O ganho: feedback em ~1,5 s, roda no `npm test` e no CI da Vercel/GitHub sem serviço externo.

## 2. Instalação

```bash
export PATH=/opt/homebrew/bin:$PATH   # Node 26 do Homebrew
npm i -D @electric-sql/pglite         # 0.5.8 (PostgreSQL 18.3)
```

Sem dependências nativas, sem postinstall. O pacote traz o binário WASM e as extensões `contrib` embutidas (importadas por caminho, ver §4.3). O test runner é o `node:test` nativo (sem vitest/jest).

Scripts sugeridos no `package.json`:

```json
{
  "scripts": {
    "test:db": "node --test \"supabase/test/**/*.test.mjs\"",
    "test:db:watch": "node --test --watch \"supabase/test/**/*.test.mjs\""
  }
}
```

Atenção: no Node 26 `node --test supabase/test/` (diretório) falha com "test failed"; use o glob entre aspas ou o caminho do arquivo.

## 3. O que foi provado (funciona)

| Item | Resultado no PGlite 0.5.8 | Observação |
|---|---|---|
| `select version()` | PostgreSQL 18.3 (wasm32) | Mesma major do Supabase atual (17/18): sintaxe compatível |
| Usuário padrão | `postgres`, `usesuper = true` | Superuser: **ignora RLS**. Nunca teste RLS nesse contexto |
| `plpgsql` | Já instalado (`pg_extension`) | Funções e triggers `language plpgsql` funcionam sem `create extension` |
| `gen_random_uuid()` | Built-in (core desde PG13) | **pgcrypto não é necessário** para uuid |
| `create extension pgcrypto` | OK, se registrada em `new PGlite({ extensions: { pgcrypto } })` | `crypt()`, `gen_salt()` funcionam |
| `create extension "uuid-ossp"` | OK (nome com aspas aceito) se registrada `uuid_ossp` | Só necessária se alguma migration usar `uuid_generate_v4()` |
| `create extension` sem registrar no construtor | **Falha**: `extension "pg_trgm" is not available` | A extensão precisa ser importada em JS e passada em `extensions` |
| `create extension ... schema extensions` | OK (após `create schema extensions`) | Padrão Supabase respeitado |
| `create role anon/authenticated/service_role` | OK, com `nologin noinherit`, `bypassrls` | Roles ficam em `pg_roles` como no Supabase |
| `create role x login password 'x'` | Aceito, sem efeito | PGlite tem conexão única; não há "conectar como outro usuário" |
| `set role authenticated` / `set local role` | OK: `current_user` muda, `session_user` continua `postgres` | É o mecanismo para testar RLS como não-superuser |
| `reset role` | OK | Fora de transação o `set role` persiste na sessão; use `set local role` dentro de `db.transaction()` para isolar |
| `set_config('request.jwt.claim.sub', uuid, true)` + `auth.uid()` shim | OK | Escopo local à transação (3º arg `true`) é resetado ao fim |
| `set_config('request.jwt.claims', json, ...)` + `auth.jwt()` shim | OK | Para policies que usam `auth.jwt() ->> 'role'` |
| RLS `enable row level security` + policy `using ((select auth.uid()) = ...)` | **Enforçado** sob `set role authenticated` | SELECT filtra, INSERT fora do `with check` lança `new row violates row-level security policy` (42501) |
| Policy chamando função `security definer` (`is_admin()`) | OK | Padrão Supabase para evitar recursão em RLS |
| View `with (security_invoker = true)` | OK: aplica RLS do chamador | |
| Trigger `before update` plpgsql (`updated_at`) | OK | |
| Enum (`create type ... as enum`) | OK | |
| Identity, generated columns stored, check constraints | OK | |
| `alter default privileges`, `grant ... on all tables in schema` | OK | |
| `alter table ... force row level security` | Aceito, mas **superuser continua ignorando RLS** | FORCE só afeta o *owner* não-superuser; inútil aqui. Use `set role` |
| `db.exec()` com múltiplos statements e `$$` dollar-quoting | OK | Roda um arquivo de migration inteiro de uma vez; retorna array de resultados |
| Erro de sintaxe/objeto inexistente na migration | Lança exceção com a mensagem do Postgres | Basta `try/catch` e prefixar o nome do arquivo |
| Performance | Boot + shim + 1 migration ≈ 1,5 s; 1000 inserts parametrizados ≈ 170 ms | |
| `db.transaction(async tx => ...)` | OK, com `rollback` automático em exceção | Base do helper `asUser()` |

## 4. Limitações (o que NÃO funciona ou é diferente do Supabase real)

1. **Extensões do Supabase inexistentes**: `pg_net`, `pgjwt`, `supabase_vault`, `pg_graphql`, `pgsodium` não estão disponíveis. Migrations que dependam delas precisam ser condicionais ou ficar fora do conjunto testado. O projeto (Postgres + Auth + Storage, sem Edge Functions) não precisa de nenhuma delas.
2. **`alter publication supabase_realtime add table ...` falha** (publication não existe). Se o projeto usar Realtime, o harness deve criar `create publication supabase_realtime;` no shim, ou a migration usa `do $$ ... if exists ... $$`.
3. **Schemas `auth`/`storage` são um shim**: só `auth.users(id, email, raw_user_meta_data, created_at)`, `auth.uid()`, `auth.role()`, `auth.jwt()`, `storage.buckets`, `storage.objects`. Triggers em `auth.users` (ex.: criar `profiles` no signup) podem ser testados porque a tabela existe, mas colunas extras (`email_confirmed_at`, `phone`, `is_anonymous`...) precisam ser adicionadas ao shim se a migration as referenciar.
4. **Sem GoTrue**: signup, JWT real, `raw_app_meta_data` de provider, confirmação de e-mail não existem. Simulamos o usuário inserindo em `auth.users` e setando os claims via `set_config`.
5. **Conexão única e superuser**: não há `psql -U authenticated`. A única forma de testar como não-superuser é `set [local] role`. `force row level security` não ajuda (superuser sempre passa).
6. **Roles precisam existir antes das migrations** que fazem `grant ... to authenticated` ou `create policy ... to authenticated`. O shim cria os três roles antes de aplicar as migrations, como o Supabase real.
7. **Storage policies**: `storage.objects` existe no shim, mas funções como `storage.foldername()`/`storage.filename()` não; adicionar ao shim se usadas nas policies de avatar.
8. **Extensões só carregam se importadas em JS**: `create extension` de qualquer contrib exige `import { x } from '@electric-sql/pglite/contrib/x'` + `extensions: { x }`. Contribs disponíveis: amcheck, auto_explain, bloom, btree_gin, btree_gist, citext, cube, dict_int, dict_xsyn, earthdistance, file_fdw, fuzzystrmatch, hstore, intarray, isn, lo, ltree, moddatetime, pageinspect, pg_buffercache, pg_freespacemap, pg_stat_statements, pg_surgery, pg_trgm, pg_visibility, pg_walinspect, pgcrypto, seg, tablefunc, tcn, tsm_system_rows, tsm_system_time, unaccent, uuid_ossp. `pgvector` é pacote separado (`@electric-sql/pglite-pgvector`).
9. **WASM 32-bit**: valores `bigint` chegam como `number`/`string` conforme o parser; `timestamptz` chega como `Date`. Nada disso afeta a validação de DDL.
10. **Não substitui o Supabase CLI para `db diff`/`db push`**: PGlite valida que as migrations aplicam e que o comportamento de RLS está certo; o deploy continua sendo feito pelo dashboard ou pelo CLI em CI.

## 5. Padrão de harness (código validado)

### 5.1 `supabase/test/pglite-harness.mjs`

```js
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const SUPABASE_SHIM_SQL = `
  create schema if not exists auth;
  create schema if not exists storage;
  create schema if not exists extensions;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create or replace function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  create or replace function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table if not exists storage.buckets (id text primary key, name text not null, public boolean not null default false);
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text, owner uuid, metadata jsonb, created_at timestamptz default now()
  );
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  end $$;
  grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;
`

export async function createTestDb({ migrationsDir } = {}) {
  const dir = migrationsDir ?? path.resolve(import.meta.dirname, '../migrations')
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.waitReady
  await db.exec(SUPABASE_SHIM_SQL)

  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const applied = []
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8')
    try {
      await db.exec(sql)
      applied.push(file)
    } catch (err) {
      err.message = `migration ${file}: ${err.message}`
      throw err
    }
  }

  const createUser = async ({ id, email, metadata = {} }) => {
    const r = await db.query(
      'insert into auth.users (id, email, raw_user_meta_data) values (coalesce($1::uuid, gen_random_uuid()), $2, $3::jsonb) returning id',
      [id ?? null, email, JSON.stringify(metadata)],
    )
    return r.rows[0].id
  }

  // Executa fn dentro de uma transação com role + claims do JWT simulados (escopo local à tx).
  const asUser = (userId, fn, role = 'authenticated') =>
    db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`)
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ''])
      await tx.query("select set_config('request.jwt.claim.role', $1, true)", [role])
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role })])
      return fn(tx)
    })
  const asAnon = (fn) => asUser(null, fn, 'anon')
  const asServiceRole = (fn) => asUser(null, fn, 'service_role')

  return { db, applied, createUser, asUser, asAnon, asServiceRole, close: () => db.close() }
}

export async function expectRlsDenied(promise) {
  try { await promise } catch (e) { if (/row-level security|permission denied/i.test(e.message)) return e; throw e }
  throw new Error('expected RLS denial, but statement succeeded')
}
```

Pontos-chave do padrão:
- **`set local role` + `set_config(..., true)` dentro de `db.transaction()`**: ao fim da transação `current_user` volta a `postgres` e `auth.uid()` volta a `null` (provado). Não há vazamento entre testes.
- Seeds e asserts "de fora" (contagens totais) rodam como superuser via `t.db`, que enxerga tudo.
- Policies do projeto devem usar `(select auth.uid())` (initPlan cacheado), exatamente como no Supabase.

### 5.2 `supabase/test/run-migrations.test.mjs` (estrutura recomendada)

```js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb, expectRlsDenied } from './pglite-harness.mjs'

let t
before(async () => { t = await createTestDb() })
after(async () => { await t.close() })

test('todas as migrations aplicam sem erro', () => {
  assert.ok(t.applied.length > 0)
})

test('toda tabela de public tem RLS habilitado', async () => {
  const r = await t.db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)
  assert.deepEqual(r.rows, [], 'tabelas sem RLS: ' + r.rows.map((x) => x.relname).join(', '))
})

test('RLS: colaborador só vê os próprios lançamentos; só admin insere', async () => {
  const admin = await t.createUser({ email: 'admin@x.dev' })
  const collab = await t.createUser({ email: 'c@x.dev' })
  await t.db.query("insert into public.profiles (id, full_name, role) values ($1, 'A', 'admin'), ($2, 'C', 'collaborator')", [admin, collab])

  await t.asUser(admin, (tx) => tx.query('insert into public.activities (owner_id, points) values ($1, 10), ($2, 20)', [admin, collab]))
  await expectRlsDenied(t.asUser(collab, (tx) => tx.query('insert into public.activities (owner_id, points) values ($1, 5)', [collab])))

  const mine = await t.asUser(collab, (tx) => tx.query('select count(*)::int n from public.activities'))
  assert.equal(mine.rows[0].n, 1)
  const all = await t.asUser(admin, (tx) => tx.query('select count(*)::int n from public.activities'))
  assert.equal(all.rows[0].n, 2)
  const anon = await t.asAnon((tx) => tx.query('select count(*)::int n from public.activities'))
  assert.equal(anon.rows[0].n, 0)
})
```

Saída real (`node --test "supabase/test/**/*.test.mjs"`): 3 pass, 0 fail, ~1,6 s.

### 5.3 Casos de teste que o projeto deve cobrir (derivados de FEATURE-INVENTORY.md)

Organizar em arquivos separados (`supabase/test/*.test.mjs`), todos usando o harness:

- `run-migrations.test.mjs`: migrations aplicam; toda tabela `public` tem RLS; toda tabela tem ao menos uma policy; nenhuma função `security definer` sem `set search_path`.
- `auth-flow.test.mjs`: trigger em `auth.users` cria `profiles`; 1º usuário vira `admin` e gera `team_code`; 2º usuário com `team_code` correto vira `collaborator`; código errado rejeita; admin ativa/inativa perfis, colaborador não.
- `ledger.test.mjs`: só admin insere/edita/exclui lançamentos (ledger); colaborador lê tudo do time (ranking) mas não escreve; pontos/moedas derivados batem com as views.
- `missions-challenges.test.mjs`: progresso calculado do ledger dentro da janela; só admin cria missão/desafio.
- `wheel.test.mjs`: fila da roleta; giro registra prêmio; colaborador só resgata a própria recompensa.
- `storage.test.mjs`: policy de avatar (só o dono escreve no próprio path; leitura pública).

## 6. Checklist de decisões

- pgcrypto: **não necessário** para uuid (`gen_random_uuid()` é core). Registrar apenas se alguma migration fizer `create extension pgcrypto` (o CLI do Supabase costuma gerar isso; manter no harness por segurança, custo zero).
- uuid-ossp: **não usar** nas migrations novas; se aparecer em migration herdada, registrar `uuid_ossp`.
- Sintaxe de extensão: `import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'` + `new PGlite({ extensions: { pgcrypto } })` + `create extension if not exists pgcrypto` na migration.
- Testar RLS: sempre via `asUser()` (`set local role` + claims). Nunca confiar em resultado obtido como `postgres`.
- Runner: `node --test` nativo, glob entre aspas.

## Fontes

- https://pglite.dev/docs/ (getting started, `.exec` para migrations, conexão única)
- https://pglite.dev/extensions/ (catálogo e sintaxe de importação das extensões)
- https://github.com/electric-sql/pglite/issues/274 (RLS não aplicada quando testada como superuser; resolvido com role não-superuser)
- Prova local: `probe.mjs` (26/26) e `probe2.mjs` no scratchpad citado no topo.
