#!/usr/bin/env node
// Gera supabase/schema.sql concatenando supabase/migrations/*.sql em ordem
// (ordem lexicográfica = ordem cronológica do prefixo de timestamp) e envolvendo
// tudo em `begin; ... commit;` (DATA-MODEL §2.7/§15).
// Uso: node supabase/build-schema.mjs   (sem dependências)

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(HERE, 'migrations')
const OUT = path.join(HERE, 'schema.sql')

const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
if (files.length === 0) {
  console.error('nenhuma migration em', MIGRATIONS_DIR)
  process.exit(1)
}

const header = `-- =============================================================================
-- Orbion Sales League — schema completo do banco (Supabase / Postgres)
-- Arquivo GERADO por supabase/build-schema.mjs a partir de supabase/migrations/*.sql.
-- NÃO edite este arquivo à mão: altere a migration correspondente e rode
--   node supabase/build-schema.mjs
--
-- Como aplicar (instalação nova):
--   1. Abra o projeto no Supabase → SQL Editor → New query.
--   2. Cole este arquivo INTEIRO (ele começa com "begin;" e termina com "commit;")
--      e clique em Run. Tudo roda numa única transação: ou aplica por completo,
--      ou nada é gravado (um schema pela metade — sem a linha de app_secrets ou
--      sem RLS numa tabela — nunca pode existir).
--   3. Confira: select bootstrap_done, team_code from public.app_secrets;
--      deve devolver 1 linha com bootstrap_done = false.
--   4. IMEDIATAMENTE crie o primeiro gestor em Authentication → Users → Add user
--      → Create new user com "Auto confirm" marcado (DATA-MODEL §16.1), ANTES de
--      publicar a URL do app. Só depois configure a Vercel.
--
-- O script é idempotente: pode ser executado de novo sobre um banco já instalado
-- (create ... if not exists, create or replace, drop ... if exists, seeds com
-- on conflict do nothing). O team_code e os dados existentes são preservados.
--
-- Ordem das migrations concatenadas (DATA-MODEL §15):
${files.map((f, i) => `--   ${String(i + 1).padStart(2, ' ')}. ${f}`).join('\n')}
-- Gerado em: ${new Date().toISOString()}
-- =============================================================================

begin;
`

let body = ''
for (const file of files) {
  const sql = (await readFile(path.join(MIGRATIONS_DIR, file), 'utf8')).replace(/\s+$/, '')
  body += `\n-- -----------------------------------------------------------------------------\n-- >>> ${file}\n-- -----------------------------------------------------------------------------\n${sql}\n`
}

const footer = `
commit;
`

await writeFile(OUT, header + body + footer, 'utf8')
console.log(`schema.sql gerado: ${files.length} migrations, ${(header + body + footer).length} bytes → ${OUT}`)
