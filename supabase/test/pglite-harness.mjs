// Harness PGlite para o schema do Orbion Sales League.
// Cada arquivo de teste cria um banco novo em memória (PostgreSQL 18 em WASM),
// aplica o shim mínimo dos schemas auth/storage do Supabase, cria os roles
// (anon/authenticated/service_role/supabase_auth_admin) e aplica supabase/schema.sql.
// Nada aqui depende de Docker, do Supabase CLI ou de psql.

import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const SCHEMA_FILE = path.resolve(HERE, '../schema.sql')
export const MIGRATIONS_DIR = path.resolve(HERE, '../migrations')

// Shim do que o Supabase entrega pronto e o PGlite não tem: schemas auth/storage,
// auth.uid()/auth.role()/auth.jwt(), storage.foldername()/filename(), roles e a
// publication supabase_realtime. Colunas de auth.users limitadas ao que o trigger lê.
export const SUPABASE_SHIM_SQL = `
  create schema if not exists auth;
  create schema if not exists storage;
  create schema if not exists extensions;

  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    raw_app_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create or replace function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  create or replace function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz default now()
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text,
    owner uuid,
    metadata jsonb,
    created_at timestamptz default now()
  );
  create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $$
  declare _parts text[];
  begin
    select string_to_array(name, '/') into _parts;
    return _parts[1:array_length(_parts, 1) - 1];
  end $$;
  create or replace function storage.filename(name text) returns text language plpgsql immutable as $$
  declare _parts text[];
  begin
    select string_to_array(name, '/') into _parts;
    return _parts[array_length(_parts, 1)];
  end $$;
  alter table storage.objects enable row level security;

  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
    if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
  end $$;
  grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;
  grant execute on function storage.foldername(text), storage.filename(text) to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
  grant usage on schema public to supabase_auth_admin;

  do $$ begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      create publication supabase_realtime;
    end if;
  end $$;
`

export async function createDb() {
  const db = new PGlite({ extensions: { pgcrypto, btree_gist } })
  await db.waitReady
  await db.exec(SUPABASE_SHIM_SQL)
  return db
}

export async function applySchema(db, file = SCHEMA_FILE) {
  const sql = await readFile(file, 'utf8')
  await db.exec(sql)
}

export async function applyMigrations(db, dir = MIGRATIONS_DIR) {
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
  return applied
}

/**
 * Banco de teste completo: shim + schema.sql + helpers.
 * - asUser(uuid, fn, role='authenticated'): executa fn(tx) numa transação com
 *   `set local role` e os claims do JWT simulados (auth.uid() = uuid).
 * - asAnon(fn): idem com role anon e sem claims.
 * - createAuthUser({ email, metadata, confirmed }): insere em auth.users (dispara handle_new_user).
 * - rpc(uuid, name, args): chama uma função de public como o usuário informado.
 * - sql(text, params): consulta como postgres (superuser, ignora RLS) para asserts "de fora".
 */
export async function createTestDb({ schemaFile = SCHEMA_FILE, useMigrations = false } = {}) {
  const db = await createDb()
  if (useMigrations) await applyMigrations(db)
  else await applySchema(db, schemaFile)

  const sql = (text, params = []) => db.query(text, params)

  const asUser = (userId, fn, role = 'authenticated') =>
    db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`)
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ''])
      await tx.query("select set_config('request.jwt.claim.role', $1, true)", [role])
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(userId ? { sub: userId, role } : { role }),
      ])
      return fn(tx)
    })
  const asAnon = (fn) => asUser(null, fn, 'anon')

  const createAuthUser = async ({ id, email, metadata = {}, confirmed = false } = {}) => {
    const r = await db.query(
      `insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
       values (coalesce($1::uuid, gen_random_uuid()), $2, $3::jsonb, case when $4::boolean then now() end)
       returning id`,
      [id ?? null, email, JSON.stringify(metadata), confirmed],
    )
    return r.rows[0].id
  }

  const rpc = (userId, name, args = {}, role = 'authenticated') =>
    asUser(
      userId,
      async (tx) => {
        const keys = Object.keys(args)
        const placeholders = keys.map((k, i) => `${k} => $${i + 1}`).join(', ')
        const values = keys.map((k) => {
          const v = args[k]
          if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) return JSON.stringify(v)
          return v
        })
        const r = await tx.query(`select public.${name}(${placeholders}) as result`, values)
        return r.rows[0]?.result
      },
      role,
    )

  const rpcRow = (userId, name, args = {}, role = 'authenticated') =>
    asUser(
      userId,
      async (tx) => {
        const keys = Object.keys(args)
        const placeholders = keys.map((k, i) => `${k} => $${i + 1}`).join(', ')
        const values = keys.map((k) => {
          const v = args[k]
          if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) return JSON.stringify(v)
          return v
        })
        const r = await tx.query(`select * from public.${name}(${placeholders})`, values)
        return r.rows
      },
      role,
    )

  return { db, sql, asUser, asAnon, createAuthUser, rpc, rpcRow, close: () => db.close() }
}

/** Espera que a promise falhe com um código do catálogo (message) ou com um regex. */
export async function expectError(promise, code) {
  try {
    await promise
  } catch (e) {
    const ok = code instanceof RegExp ? code.test(e.message) : e.message === code || e.message.includes(code)
    if (ok) return e
    const err = new Error(`esperado erro ${code}, recebido: ${e.message}${e.detail ? ' — ' + e.detail : ''}`)
    err.cause = e
    throw err
  }
  throw new Error(`esperado erro ${code}, mas a instrução foi executada com sucesso`)
}

export async function expectRlsDenied(promise) {
  return expectError(promise, /row-level security|permission denied/i)
}

/** Converte numeric/bigint (string) em number para asserts. */
export const num = (v) => (v === null || v === undefined ? v : Number(v))
