# supabase/ — banco de dados do Orbion Sales League

Fonte de verdade: `docs/spec/DATA-MODEL.md`. Esta pasta contém as migrations SQL, o
arquivo consolidado `schema.sql` (gerado) e os testes que rodam em PGlite (Postgres em
WASM, em memória) — **sem Docker, sem Supabase CLI e sem psql**.

```
supabase/
├── migrations/            # 13 arquivos, ordem = prefixo de timestamp (DATA-MODEL §15)
├── schema.sql             # GERADO: concatenação das migrations em begin; ... commit;
├── build-schema.mjs       # gera schema.sql
├── test/                  # harness PGlite + *.test.mjs (node:test)
├── DECISIONS.md           # decisões de implementação fora do que a spec fixa
└── README.md
```

## 1. Instalar num projeto Supabase novo (SQL Editor)

Ordem obrigatória (DATA-MODEL §16.1):

1. Crie o projeto no Supabase e anote URL e chave publicável. **Não** publique nada ainda.
2. Abra **SQL Editor → New query**, cole o conteúdo **inteiro** de `supabase/schema.sql`
   (começa com `begin;` e termina com `commit;`) e clique em **Run**. Tudo roda numa única
   transação: ou aplica por completo, ou nada é gravado.
3. Confira: `select bootstrap_done, team_code from public.app_secrets;` → 1 linha com
   `bootstrap_done = false` e um `team_code` de 12 caracteres (gerado aleatoriamente nesta
   instalação).
4. **Imediatamente**: Authentication → Users → Add user → Create new user (e-mail do dono,
   senha forte, **Auto confirm** marcado). O trigger `handle_new_user` cria o perfil `admin`
   e marca `bootstrap_done = true`. Confira: `select role from public.profiles;` → `admin`.
5. Só então configure `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` na Vercel e
   publique. Faça login, abra Configurações, confira o fuso (trava após o 1º lançamento),
   copie o `team_code` e convide a equipe.

Reaplicar `schema.sql` num banco já instalado é seguro: tudo é idempotente
(`create ... if not exists`, `create or replace`, `drop ... if exists`, seed com
`on conflict do nothing` / `where not exists`). O `team_code`, a temporada e os dados
existentes são preservados; linhas de catálogo apagadas pelo gestor **não** voltam.

## 2. Ordem das migrations (DATA-MODEL §15)

| # | arquivo | conteúdo |
|---|---|---|
| 01 | `20260915000001_extensions_schemas_grants.sql` | schemas `private`/`extensions`, extensões, revoke de default privileges (§2.1–2.2) |
| 02 | `20260915000002_enums.sql` | enums (§3) |
| 03 | `20260915000003_tables_core.sql` | app_settings, app_secrets, seasons, profiles, stats, audit_log |
| 04 | `20260915000004_tables_catalog.sql` | point_rules, special_events, wheels, wheel_prizes, rewards, achievements, missions, challenges |
| 05 | `20260915000005_tables_facts.sql` | point_entries (ledger), filas, giros, resgates, feed, notificações |
| 06 | `20260915000006_helpers.sql` | helpers públicos e privados (§6.1–6.3) |
| 07 | `20260915000007_trigger_functions.sql` | funções de trigger (§6.4–6.9) |
| 08 | `20260915000008_triggers.sql` | triggers (§8) |
| 09 | `20260915000009_views.sql` | views (§5) |
| 10 | `20260915000010_rpcs.sql` | RPCs + grants (§7) |
| 11 | `20260915000011_rls.sql` | RLS, policies, revoke/grant final (§10) |
| 12 | `20260915000012_storage_realtime.sql` | bucket `avatars`, policies de storage, publication realtime (§11–12) |
| 13 | `20260915000013_seed.sql` | catálogo: settings, secrets, temporada do mês, 10 regras, 2 roletas + 14 prêmios, 6 conquistas, 7 recompensas (§13) |

O seed **não** cria pessoas, lançamentos, missões, filas, giros, resgates nem notificações.

## 3. Regenerar `schema.sql`

Nunca edite `schema.sql` à mão. Altere a migration e rode:

```bash
node supabase/build-schema.mjs
```

O script concatena `supabase/migrations/*.sql` em ordem lexicográfica, adiciona um
cabeçalho em comentário e envolve tudo em `begin; ... commit;`.

## 4. Rodar os testes (PGlite, sem Docker)

```bash
cd supabase/test
npm install          # só na primeira vez (instala @electric-sql/pglite)
npm test             # node --test ./*.test.mjs
npm run test:watch
```

Cada arquivo de teste cria um banco novo em memória, aplica o shim mínimo dos schemas
`auth`/`storage` do Supabase (funções `auth.uid()`, `storage.foldername()`, roles
`anon`/`authenticated`/`service_role`/`supabase_auth_admin`, publication
`supabase_realtime`) e depois `schema.sql`. O harness (`test/pglite-harness.mjs`) expõe
`createTestDb({ schemaFile, useMigrations })`, `asUser(uuid, fn, role)`, `asAnon(fn)`,
`createAuthUser(...)`, `rpc(uuid, name, args)`, `expectError(promise, code)` e
`expectRlsDenied`.

Arquivos de teste:

- `seed.test.mjs` — idempotência (schema aplicado duas vezes), contagens do catálogo,
  temporada ativa do mês, `validate_team_code`, `bootstrap_done = false`, bucket/policies
  de storage, publication realtime, ausência de dados fictícios.
- `flows2.test.mjs` — fluxos §14.5–§14.8: `redeem_reward`/`handle_redemption` (saldo,
  estoque, estorno com `refund_entry_id`), conquistas instantâneas (`first_sale`,
  `sales_total`) e `reverse_entry` (sinais invertidos, `occurred_at` herdado, saldo negativo
  B.15), evento × boost = maior multiplicador (B.4), streak em dias locais (B.16),
  `create_season`/`activate_season`/`close_season` (EXCLUDE, `SEASON_NOT_STARTED`,
  `season_results`, CAMPEÃO, `SEASON_CLOSED`).
- `views.test.mjs` — cenário pequeno via RPCs e números documentados de `v_profile_stats`,
  `v_ranking`, `v_team_stats`, `v_wallet`, `v_mission_board`, `v_challenge_board`,
  `v_activity_feed`, `v_sales_timeline`, `v_wheel_history`; `recompute_stats` reconstrói as
  mesmas stats a partir do ledger.

Os testes obrigatórios (a)–(y) listados em DATA-MODEL §15 são cobertos pelos demais
`*.test.mjs` conforme forem adicionados.

## 5. Diferenças PGlite × Supabase que o schema já trata

- `storage.foldername`/`filename` e `auth.uid()` vêm do shim no teste; no Supabase são nativos.
- A publication `supabase_realtime` só é alterada se existir (`do $$ if exists $$`).
- `extensions.gen_random_bytes` vem de `pgcrypto` em `extensions` (0001) nos dois ambientes.
