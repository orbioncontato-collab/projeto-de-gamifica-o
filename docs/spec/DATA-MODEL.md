# DATA-MODEL — Orbion Sales League (especificação final do banco Supabase)

> Versão final, 15/09/2026, revisada após a revisão adversarial (Apêndice D). **Revisão 15/09/2026 (tarde): aprovação de membros** — colaborador que se cadastra com `team_code` nasce `pending` até um gestor aprovar; `app_settings.auto_approve_members` liga a auto-aprovação (Apêndice B.21; §3, §4.1, §6.4, §7.1, §7.2, §14.1, §16.2). Substitui `DRAFT-data-model.md`. Base de verdade para quem for escrever `supabase/schema.sql` e `supabase/migrations/*.sql`: **nada aqui é sugestão** — tabela, coluna, constraint, função, trigger, policy e seed estão fechados. O que ficou deliberadamente de fora está no Apêndice A (achados recusados) e no Apêndice B (decisões de produto com alternativa registrada).
>
> Decisões já tomadas e NÃO reabertas: Vite SPA; single-tenant por instalação; 1º cadastro vira admin; colaboradores se cadastram com `team_code`; **só admins registram atividades comerciais** (colaborador é somente leitura, exceto resgatar recompensa e editar nome/foto/preferências próprias); deploy na Vercel; Supabase = Postgres + Auth + Storage (sem Edge Functions).
>
> Convenções de escrita: identificadores SQL em inglês `snake_case`; textos de erro em pt-BR no campo `detail`; código de erro estável no campo `message` (ver §9). Tudo o que a UI mostra em pt-BR fica no front.

---

## 0. Índice

1. Princípios e decisões arquiteturais
2. Convenções de implementação (schemas, extensões, grants padrão, templates)
3. Enums
4. Tabelas (coluna a coluna)
5. Views
6. Funções auxiliares (helpers) e funções de trigger
7. RPCs (funções expostas ao front)
8. Triggers (lista completa por tabela)
9. Catálogo de códigos de erro
10. Matriz de RLS
11. Storage
12. Realtime
13. Seed (catálogo, sem pessoas fictícias)
14. Fluxos de negócio
15. Ordem dos arquivos de migration
16. Manual de implantação — trechos obrigatórios (bootstrap, e-mail, recuperação)
Apêndice R — rastreabilidade dos achados críticos/altos
Apêndice A — achados recusados (com motivo)
Apêndice B — decisões de produto registradas
Apêndice C — mapa tela → objeto do banco
Apêndice D — Revisão adversarial (achados, resolução ou motivo da recusa)

---

## 1. Princípios e decisões arquiteturais

1. **Ledger central e imutável.** `public.point_entries` é a única origem de pontos, moedas, faturamento (R$) e contagem de atividades. Ninguém (nem admin) faz `UPDATE`/`DELETE` nele: correção = **estorno** (`reverse_entry`), que insere uma linha com sinais invertidos e `reverses_entry_id` apontando para a original.
2. **Tabelas derivadas mantidas por trigger, não views definer.** Ranking, feed, progresso de missão/desafio, conquistas e estatísticas de perfil ficam em tabelas (`profile_season_stats`, `profile_lifetime_stats`, `mission_progress`, `challenge_participants.current_value`, `profile_achievements`, `feed_events`) escritas por funções de trigger `SECURITY DEFINER` no schema `private`. Assim **toda view de `public` é `security_invoker = true`** (regra obrigatória do Supabase Security Advisor) e o ledger cru continua privado: colaborador lê apenas as próprias entries; admin lê todas.
3. **Regras de negócio no banco.** Sorteio da roleta, aprovação de prêmio, resgate, fechamento de temporada, cálculo de pontos por regra e multiplicador acontecem em RPCs `SECURITY DEFINER` com checagem de papel na primeira linha. O front é consumidor: nunca envia `points`, `coins`, `season_id`, `created_by` ou prêmio sorteado.
4. **Temporada resolvida por `occurred_at`**, não pela temporada ativa no momento do insert. Lançamento retroativo cai na temporada certa; sem temporada cobrindo a data → erro `NO_SEASON_FOR_DATE`. Temporadas não se sobrepõem (EXCLUDE gist) e no máximo uma é ativa (índice único parcial).
5. **Escopos temporais fixados.**
   - Por temporada: pontos, ranking, gap, nível/XP, vendas do período, conversão, metas (individual e do time), missões, desafios, conquistas `scope='season'`.
   - Vitalício: saldo de moedas (`SUM(coins)` sobre todas as temporadas), streak (sequência de dias), conquistas `scope='lifetime'` (primeira venda, 50K/100K club, em chamas).
6. **Moedas definidas por origem, nunca derivadas de coeficiente.** `point_rules.coins`, `missions.reward_coins`, `challenges.reward_coins`, `achievements.reward_coins`, prêmio `coins` da roleta. `app_settings.coins_per_point` não existe. Evento especial e boost multiplicam **só pontos**, nunca moedas. Estorno inverte pontos e moedas.
7. **Concorrência tratada no servidor.** Advisory locks por perfil (`wallet:<uid>`, `progress:<uid>`), `UPDATE ... WHERE status = X RETURNING` para transições de estado, `ON CONFLICT DO NOTHING` para idempotência, `FOR UPDATE` em fila/recompensa/temporada.
8. **Perfis nunca são apagados**, só inativados. `profiles.id` referencia `auth.users` **sem** `ON DELETE CASCADE`; a remoção acidental de um usuário no dashboard do Supabase falha (FK) em vez de apagar histórico. Usuário inativo — e usuário **pendente** (`status = 'pending'`, cadastro por `team_code` ainda não aprovado pelo gestor, §6.4/§14.1) — não tem acesso porque **todas** as policies e RPCs passam por `is_active_member()` (verdadeiro **só** para `status = 'active'`) — inclusive as policies "próprias" (`id = me` / `profile_id = me`), que são sempre `member and (...)`; a única exceção é o SELECT da **própria** linha em `profiles`, necessário para `get_bootstrap` devolver `status = 'inactive'` ou `'pending'` (§7.1). Inativar não encerra sessões já abertas (§16.3): o front faz `signOut()` ao receber `PROFILE_INACTIVE`/`42501` e leva o pendente para a tela "aguardando aprovação" ao receber `PROFILE_PENDING`. Para o banco, `pending` e `inactive` são **o mesmo** em acesso (zero linhas, zero RPCs, fora do ranking/boards/pickers); diferem só na origem (cadastro vs. inativação) e na ação do gestor (aprovar/recusar vs. reativar).
9. **Catálogos usam soft delete** (`is_active` + `deleted_at`); fatos (`point_entries`, `mission_progress`, `wheel_spins`, `reward_redemptions`, `challenge_results`, `milestone_awards`) usam FK `ON DELETE RESTRICT`. Colunas de ator (`created_by`, `approved_by`, `handled_by`, `updated_by`) → `profiles ON DELETE SET NULL`.
10. **Bootstrap sem corrida e sem janela pública.** `handle_new_user` pega `pg_advisory_xact_lock(hashtext('bootstrap_admin'))` antes de contar admins. O primeiro admin é criado pelo implantador **antes** de publicar a URL (Dashboard → Authentication → Users → *Add user* → *Create new user* com *Auto confirm* — §16.1): a chave publicável e a URL do projeto ficam no bundle público da Vercel, portanto qualquer cadastro feito antes do dono viraria admin. `app_secrets.bootstrap_email` é uma trava adicional e exige que a linha de `auth.users` chegue com `email_confirmed_at` preenchido (§6.4, Apêndice B.1). Depois do primeiro admin, novos admins só por `admin_update_profile`. Recuperação de um bootstrap tomado: §16.4.
11. **Fuso horário único**: `app_settings.timezone` (default `America/Sao_Paulo`). Toda conversão para "dia" usa `public.local_day(ts)`; nunca `date(occurred_at)` em UTC. O fuso fica travado depois do primeiro lançamento (`TIMEZONE_LOCKED`, §6.3/§7.2 — Apêndice B.18), porque streak, `period_key` de missões e limites de temporada já foram calculados nele.
12. **Estorno herda a data do fato.** A entry de estorno recebe `occurred_at` da original (§6.6): missão/desafio/streak/série diária enxergam o desfazimento no mesmo período em que o fato entrou; `created_at` registra quando o estorno foi feito.
13. **Saldo de moedas pode ficar negativo** (dívida) quando um estorno desfaz moedas já gastas; resgate exige saldo ≥ custo e o front mostra "Saldo devedor" (Apêndice B.15). Todo débito de moedas (resgate, estorno, ajuste manual negativo) serializa no advisory lock `wallet:<uid>` (§6.6).

---

## 2. Convenções de implementação

### 2.1 Schemas
- `public` — tabelas, views, enums e RPCs expostos pelo PostgREST.
- `private` — funções de trigger e helpers internos chamados **apenas** por triggers e funções `security definer`. **Não** é adicionado a `exposed schemas` do Data API; `REVOKE ALL ON SCHEMA private FROM anon, authenticated` (o owner `postgres` executa as funções via trigger/definer). **Regra:** nada que uma view `security_invoker` ou uma RPC `security invoker` precise chamar pode morar em `private` — chamar uma função exige `USAGE` no schema **para o papel invocador** (`authenticated`), mesmo que a função seja `security definer`; sem isso a view falha com `permission denied for schema private`. Por isso os helpers puros de tempo (`local_day`, `local_today`, `iso_week_key`, `mission_period`) ficam em `public` com `grant execute to authenticated` (§6.1).
- `extensions` — `pgcrypto` (`gen_random_bytes`) e `btree_gist` (EXCLUDE em ranges).

```sql
create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
revoke all on schema private from public, anon, authenticated;
```

### 2.2 Grants e default privileges (primeira migration, antes de qualquer tabela)
O Supabase cria, no projeto, `alter default privileges for role postgres in schema public grant all on tables | functions | sequences to anon, authenticated, service_role`. Sem desfazer isso, **toda** tabela/view nova recebe automaticamente SELECT/INSERT/UPDATE/DELETE/TRUNCATE para `authenticated` e toda função nova de `public` vira RPC pública — e as frases "sem grant", "nunca grant delete" e "revoke insert, update, delete" deste documento seriam falsas por padrão. Por isso os defaults são revogados **para o role `postgres`** (o owner das migrations), não só "no schema":
```sql
-- 0001: anon não lê nada (login é no GoTrue) e authenticated só recebe grants explícitos
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated;
-- service_role mantém os defaults (não é usado pelo app; serve ao dashboard/CLI)
```
E, **no fim de `0011_rls.sql`** (depois de todas as tabelas, views e funções existirem), a varredura de segurança repete os `revoke ... on all ...` acima e só então aplica os grants explícitos de §7.9 e §10 — assim um objeto criado por uma migration intermediária sem cuidado não fica exposto.

Cada tabela: `grant select on public.<t> to authenticated` só quando há policy de SELECT; `grant insert/update` só quando há policy correspondente; **nunca** `grant delete` para `authenticated` em nenhuma tabela (exclusões são soft delete ou não existem), com as duas exceções documentadas em §10 (`mission_participants`, `challenge_participants`). Views auto-atualizáveis (`v_seasons`, `v_special_events`, `v_redemptions`) recebem **apenas** `select`. Cada RPC: `revoke execute on function public.<f> from public, anon; grant execute on function public.<f> to authenticated;` (exceção: `signup_mode` e `validate_team_code` também para `anon`).

Teste obrigatório no harness (§15, teste (k)): varrer `pg_class` de `public` e falhar se (1) alguma tabela tiver `relrowsecurity = false`; (2) `has_table_privilege('authenticated', t, 'DELETE')` for true fora de `mission_participants`/`challenge_participants`; (3) alguma view tiver privilégio de `authenticated` além de SELECT; (4) alguma função de `public` fora da lista de §7.9/§6.1 tiver `has_function_privilege('authenticated', f, 'EXECUTE')`; (5) `anon` tiver qualquer privilégio em tabela/view ou EXECUTE fora de `signup_mode`/`validate_team_code`.

### 2.3 Template de função SECURITY DEFINER (obrigatório)
```sql
create or replace function public.<nome>(...)
returns ... language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then           -- ou public.is_active_member()
    raise exception using message = 'NOT_ADMIN', detail = 'Apenas gestores podem executar esta ação.', errcode = '42501';
  end if;
  ...
end $$;
revoke execute on function public.<nome>(...) from public, anon;
grant execute on function public.<nome>(...) to authenticated;
```
Todo objeto totalmente qualificado (`public.point_entries`, `auth.uid()`, `extensions.gen_random_bytes`, `pg_catalog.now()`). Owner de tudo = `postgres` (migrations rodam como postgres). As RPCs `security invoker` (`get_bootstrap`, `get_dashboard`) também levam `set search_path = ''` (uniformidade; evita alerta do Security Advisor). Toda leitura de linha-alvo por id usa `select ... into strict` com `exception when no_data_found then raise exception using message = '<OBJETO>_NOT_FOUND'` **antes** de qualquer checagem de papel que dependa da linha (senão `not (is_admin() or NULL = auth.uid())` é NULL, a checagem não dispara e a função morre num erro cru mais adiante); comparações com colunas possivelmente nulas usam `is distinct from` / `is not distinct from` — nunca `<>` / `=` (lógica de três valores). Funções de trigger ficam em `private` e são `security definer set search_path = ''` (o insert de `redeem_reward` vem do colaborador e o trigger precisa escrever em tabelas onde ele não tem policy).

### 2.4 Template de view
```sql
create or replace view public.v_<nome> with (security_invoker = true, security_barrier = true) as ...;
revoke all on public.v_<nome> from anon;
grant select on public.v_<nome> to authenticated;
```

### 2.5 Colunas padrão
- `id uuid primary key default gen_random_uuid()` (função nativa; não depende de pgcrypto).
- `created_at timestamptz not null default now()`; `updated_at timestamptz not null default now()` + trigger `private.set_updated_at()` em toda tabela mutável.
- `created_by uuid null references public.profiles(id) on delete set null` estampado por trigger `private.stamp_actor()` (`NEW.created_by := auth.uid()`, ignorando o valor recebido; quando `auth.uid()` é NULL — trigger interno — mantém o valor passado pela função chamadora).
- Texto livre com limite: `check (length(x) <= N)` sempre que a coluna vem do front.

### 2.6 Padrão de erro
`raise exception using message = '<CODE>', detail = '<texto pt-BR>', errcode = '<sqlstate>'` — `CODE` em `UPPER_SNAKE`, estável, listado em §9. O front lê `error.message` como código e usa `error.details` como fallback de texto.

### 2.7 Idempotência dos scripts
`create table if not exists`, `create or replace function`, `drop policy if exists ... ; create policy ...`, `drop trigger if exists`, `insert ... on conflict do nothing` em seeds. `do $$ ... $$` guardando `create type` e `alter publication`. `supabase/schema.sql` é **obrigatoriamente** envolto em `begin; ... commit;` (§15): um script aplicado pela metade deixaria, por exemplo, `app_secrets` sem a linha `id = 1` — e o trigger de cadastro trata essa ausência como erro fatal (`BOOTSTRAP_NOT_CONFIGURED`), nunca como "vale tudo".

---

## 3. Enums

Todos em `public`, criados com guarda `do $$ begin if not exists (select 1 from pg_type where typname = '...') then create type ... end if; end $$;`.

| enum | valores | uso |
|---|---|---|
| `user_role` | `admin`, `collaborator` | `profiles.role` |
| `profile_status` | `active`, `inactive`, `pending` | `profiles.status` — `pending` = cadastrado com `team_code` e aguardando aprovação do gestor (§6.4, §7.2, §14.1); para acesso vale como `inactive` (`is_active_member()` false, nenhuma policy/RPC, fora de ranking/boards/pickers); só o trigger de cadastro grava `pending`, e só `admin_update_profile` sai dele (`active` = aprovar, `inactive` = recusar) |
| `job_title` | `sdr`, `closer`, `social_seller`, `supervisor`, `manager` | `profiles.job_title` (rótulos pt-BR no front: SDR, Closer, Social Seller, Supervisor Comercial, Gestor) |
| `metric_type` | `sale`, `meeting_scheduled`, `meeting_held`, `call`, `crm_update`, `lead_recovery`, `upsell`, `amount_step`, `weekly_goal`, `monthly_goal`, `activity`, `custom` | `point_rules.metric`, `point_entries.metric`, `missions.metric` |
| `rule_trigger_kind` | `manual`, `auto_amount_step`, `auto_goal` | `point_rules.trigger_kind` |
| `entry_source` | `rule`, `manual`, `system`, `mission`, `challenge`, `wheel`, `reward`, `achievement` | `point_entries.source` |
| `mission_kind` | `daily`, `weekly`, `special`, `lightning` | `missions.kind` (define também a recorrência: daily = 1 conclusão por dia; weekly = 1 por semana ISO; special/lightning = 1 por janela) |
| `mission_target_kind` | `count`, `amount` | `missions.target_kind` |
| `mission_audience` | `all`, `selected` | `missions.audience` |
| `challenge_kind` | `duel`, `team` | `challenges.kind` |
| `challenge_metric` | `meetings_held`, `sales_count`, `revenue`, `points`, `activities` | `challenges.metric` |
| `challenge_status` | `draft`, `active`, `finished`, `cancelled` | `challenges.status` |
| `wheel_kind` | `classic`, `premium` | `wheels.kind` |
| `prize_kind` | `points`, `coins`, `cash`, `voucher`, `extra_spin`, `multiplier`, `mystery`, `custom` | `wheel_prizes.kind` |
| `queue_status` | `waiting`, `active`, `done`, `removed` | `wheel_queue.status` |
| `queue_source` | `manual`, `earned` | `wheel_queue.source` |
| `spin_status` | `pending`, `approved`, `rejected` | `wheel_spins.status` |
| `redemption_source` | `store`, `wheel` | `reward_redemptions.source` |
| `redemption_status` | `requested`, `approved`, `delivered`, `cancelled` | `reward_redemptions.status` |
| `achievement_criteria` | `first_sale`, `streak_days`, `sales_total`, `monthly_goal`, `rank_first`, `points_total`, `missions_completed` | `achievements.criteria` |
| `achievement_scope` | `lifetime`, `season` | `achievements.scope` |
| `feed_kind` | `sale`, `achievement`, `wheel_prize`, `level_up`, `mission_completed`, `challenge_finished`, `season_closed` | `feed_events.kind` |
| `notification_kind` | `ranking`, `mission`, `reward`, `wheel`, `challenge`, `achievement`, `level`, `event`, `season`, `system` | `notifications.kind` |
| `audit_action` | `insert`, `update`, `delete`, `rpc` | `audit_log.action` |

Semântica de `metric_type` (o que conta como quê):
- `sale` — venda realizada; `amount` obrigatório (> 0). `upsell` — idem, `amount` opcional.
- `meeting_scheduled`, `meeting_held`, `call`, `crm_update`, `lead_recovery` — atividades; `quantity` = quantas.
- `amount_step` — bônus automático a cada `point_rules.amount_step` R$ acumulados na temporada.
- `weekly_goal` — marco manual (gestor lança "Meta semanal"; 1 por semana ISO por pessoa).
- `monthly_goal` — marco automático quando `sales_amount` da temporada >= meta individual da temporada.
- `activity` — atividade genérica (regras novas criadas pelo gestor sem métrica específica). `custom` — igual a `activity`, reservado para regras que o gestor não quer que contem em "atividades realizadas".

---

## 4. Tabelas

Notação: **PK** chave primária; **FK** chave estrangeira; **NN** not null; **D** default; **CK** check; **UQ** unique; **IX** índice. Colunas `created_at`/`updated_at` seguem §2.5 e não são repetidas nas notas.

### 4.1 `app_settings` (singleton público)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | int | NN | 1 | PK, `CK (id = 1)` |
| company_name | text | NN | `'Orbion'` | `CK (length(company_name) between 1 and 80)` |
| xp_per_level | int | NN | 400 | `CK (xp_per_level between 50 and 100000)`; snapshot copiado para `seasons.xp_per_level` na criação da temporada |
| currency | text | NN | `'BRL'` | `CK (currency ~ '^[A-Z]{3}$')` |
| timezone | text | NN | `'America/Sao_Paulo'` | validado por trigger `private.validate_timezone()` (BEFORE INSERT/UPDATE: `perform now() at time zone NEW.timezone`; falha → `INVALID_TIMEZONE`) — CHECK não aceita subquery em `pg_timezone_names`. Só pode mudar enquanto `point_entries` está vazio: o mesmo trigger levanta `TIMEZONE_LOCKED` (§6.3, Apêndice B.18) |
| target_conversion_pct | numeric(5,2) | NN | 25 | `CK (between 0 and 100)` — meta de conversão exibida nos indicadores (unifica os 25%/30% do original) |
| target_attendance_pct | numeric(5,2) | NN | 70 | `CK (between 0 and 100)` |
| target_crm_pct | numeric(5,2) | NN | 95 | `CK (between 0 and 100)` |
| target_activities_count | int | NN | 1000 | `CK (>= 0)` — meta de "Atividades realizadas" do mês |
| streak_business_days_only | boolean | NN | false | reservado; `false` = dias corridos (regra "EM CHAMAS 7 dias consecutivos") |
| rank_admins | boolean | NN | true | `false` = gestores (`role = 'admin'`) ficam fora do ranking/pódio (`rank` NULL em `v_profile_stats`, ausentes em `v_ranking`) — Apêndice B.19 |
| auto_approve_members | boolean | NN | false | `false` = colaborador que se cadastra com `team_code` nasce `status = 'pending'` e precisa ser aprovado por um gestor (`admin_update_profile({status:'active'})`); `true` = nasce `active` na hora (comportamento antigo). Lido por `private.handle_new_user()` no momento do INSERT em `auth.users` (mudar o valor não afeta quem já está pendente). Editável só por `update_app_settings` — Apêndice B.21 |
| updated_at | timestamptz | NN | now() | trigger |
| updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |

Não contém segredo algum. RLS: SELECT `is_active_member()`; UPDATE `is_admin()`; sem INSERT/DELETE para `authenticated` (a linha vem do seed). Trigger de auditoria.

### 4.2 `app_secrets` (singleton privado, só admin)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | int | NN | 1 | PK, `CK (id = 1)` |
| team_code | text | NN | gerado no seed | `CK (team_code ~ '^[A-Z0-9]{12}$')` |
| team_code_rotated_at | timestamptz | NN | now() | |
| bootstrap_email | text | — | NULL | `CK (bootstrap_email is null or bootstrap_email = lower(bootstrap_email))`. NULL = o primeiro usuário inserido em `auth.users` vira admin — por isso o 1º admin é criado pelo Dashboard **antes** de publicar a URL (§16.1). Preenchido = só esse e-mail vira o primeiro admin **e** a linha de `auth.users` precisa chegar com `email_confirmed_at` preenchido (`BOOTSTRAP_REQUIRES_CONFIRMED_EMAIL`, §6.4) — o que só o Dashboard/Admin API (*Auto confirm*) garante no INSERT; um `auth.signUp` público com esse e-mail é abortado |
| bootstrap_done | boolean | NN | false | vira `true` na criação do primeiro admin; nunca volta a `false` (trigger `private.protect_app_secrets()` RAISE `BOOTSTRAP_LOCKED`) |
| updated_at | timestamptz | NN | now() | |
| updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |

Geração do `team_code` no seed (aleatório por instalação): `upper(encode(extensions.gen_random_bytes(6), 'hex'))` → 12 caracteres hex maiúsculos (ex.: `A3F9C21B7E04`). O mesmo gerador é usado por `rotate_team_code()`. A única leitura fora do admin é feita por `private.handle_new_user()` (definer, owner postgres — bypassa RLS por ser owner) e por `public.validate_team_code()` (definer, retorna só boolean). A linha `id = 1` é **obrigatória**: `handle_new_user` a lê com `select ... into strict` e aborta qualquer cadastro com `BOOTSTRAP_NOT_CONFIGURED` se ela não existir (sem isso, `v_secrets` NULL faria `v_code <> NULL` virar NULL e o `IF` de `INVALID_TEAM_CODE` não dispararia — qualquer código viraria colaborador ativo). O valor também fica em `auth.users.raw_user_meta_data` do próprio colaborador até o front limpá-lo (§14.1 passo 6) — nunca em JWT de terceiros.
RLS: SELECT/UPDATE `is_admin()`; sem INSERT/DELETE. `REVOKE ALL FROM anon`. O front chama `from('app_secrets')` **somente** na tela Configurações do gestor. Trigger de auditoria (grava `team_code` mascarado: só os 4 últimos caracteres).

### 4.3 `seasons`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| name | text | NN | — | `CK (length(name) between 1 and 60)`; ex.: "Setembro 2026" |
| starts_at | timestamptz | NN | — | início inclusivo (meia-noite local do 1º dia, convertido no `create_season`) |
| ends_at | timestamptz | NN | — | fim **exclusivo** (meia-noite local do dia seguinte ao último); `CK (ends_at > starts_at)` |
| team_goal_amount | numeric(14,2) | NN | 0 | `CK (>= 0)` |
| xp_per_level | int | NN | — | snapshot de `app_settings.xp_per_level` no `create_season`; `CK (> 0)` |
| is_active | boolean | NN | false | `create unique index seasons_one_active on public.seasons ((true)) where is_active` |
| closed_at | timestamptz | — | NULL | preenchido por `close_season`; `CK (closed_at is null or not is_active)` |
| closed_by | uuid | — | NULL | FK profiles `ON DELETE SET NULL` |
| created_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |
| created_at / updated_at | timestamptz | NN | now() | |

Constraints adicionais: `EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)` (sem sobreposição; exige `btree_gist`). Índice `(starts_at)`.
RLS: SELECT `is_active_member()`; sem INSERT/UPDATE/DELETE direto para `authenticated` — transições e criação só por RPC (`create_season`, `activate_season`, `close_season`, `update_season`). Trigger de auditoria.

### 4.4 `season_goals` (meta individual por temporada)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| season_id | uuid | NN | — | FK seasons `ON DELETE CASCADE`; PK (season_id, profile_id) |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` |
| goal_amount | numeric(14,2) | NN | 0 | `CK (>= 0)` |
| updated_at | timestamptz | NN | now() | |
| updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |

`create_season` faz fan-out: uma linha por perfil ativo com `goal_amount = profile_private.default_goal_amount`. `handle_new_user` cria a linha para a temporada ativa (se houver) — também para o pendente; a aprovação (`admin_update_profile({status:'active'})`, §7.2) repete o insert `on conflict do nothing` porque a temporada pode ter mudado enquanto ele esperava. Índice `(profile_id)`. Trigger `season_goals_goal_milestone` AFTER UPDATE OF `goal_amount` → `private.on_goal_amount_changed()` → `private.evaluate_goal_milestone(NEW.profile_id, NEW.season_id, now())` (§6.9): reduzir a meta, ou defini-la depois de as vendas já existirem, concede o marco "Meta mensal" e a conquista META BATIDA na hora — sem esperar uma venda nova.
RLS: SELECT `member and (profile_id = me or admin)`; INSERT/UPDATE `is_admin()` (`with check` idem); sem DELETE.

### 4.5 `season_results` (snapshot do fechamento)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| season_id | uuid | NN | — | FK seasons `ON DELETE RESTRICT`; PK (season_id, profile_id) |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` |
| final_rank | int | — | NULL | NULL para perfil não ativo (`inactive`/`pending`) no fechamento |
| final_points | int | NN | 0 | |
| sales_amount | numeric(14,2) | NN | 0 | |
| sales_count | int | NN | 0 | |
| goal_amount | numeric(14,2) | NN | 0 | meta individual da temporada |
| goal_reached | boolean | NN | false | |
| level | int | NN | 0 | |
| created_at | timestamptz | NN | now() | |

Escrita apenas por `close_season`: uma linha por perfil **ativo** (mesmo sem stats/meta — o snapshot é completo) e por perfil não ativo (`inactive`/`pending`) que tenha stats ou meta na temporada (um pendente normalmente só tem a linha de `season_goals` criada no cadastro). RLS: SELECT `member and (profile_id = me or admin)` — `goal_amount`/`goal_reached` são a meta individual (own-or-admin, coerente com `season_goals`); o histórico público de pontos/vendas por temporada continua em `profile_season_stats`/`v_profile_stats`. Nada mais.

### 4.6 `profiles` (colunas públicas; 1:1 com `auth.users`)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | — | PK; FK `auth.users(id)` **sem** cascade (`ON DELETE RESTRICT`) |
| full_name | text | NN | — | `CK (length(full_name) between 1 and 80)` |
| avatar_path | text | — | NULL | caminho do objeto no bucket `avatars` (`<id>/avatar-<epoch_ms>.<ext>`); `CK (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpe?g\|png\|webp)$')` — formato fechado: sem `..` (o browser normalizaria `<uid>/../../x` na URL pública), sem URL, sem nome livre; trigger `private.protect_profile_columns()` exige prefixo `id::text || '/'` quando quem edita não é admin |
| color | text | NN | `'#F97316'` | cor do avatar/iniciais; `CK (color ~ '^#[0-9A-Fa-f]{6}$')` |
| job_title | job_title | NN | `'sdr'` | |
| team | text | — | NULL | rótulo livre; `CK (team is null or length(team) <= 40)` |
| role | user_role | NN | `'collaborator'` | |
| status | profile_status | NN | `'active'` | `handle_new_user` grava explicitamente `'active'`/`'pending'` (§6.4; o default só cobre inserts de suporte). `pending` = aguardando aprovação do gestor: para toda policy/RPC/view vale como `inactive` (§3). Transições: `pending → active` (aprovar) e `pending → inactive` (recusar) só por `admin_update_profile` (§7.2); ninguém volta a `pending` |
| preferences | jsonb | NN | `'{"notifications": true, "event_alerts": true}'` | `CK (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) <= 2048)` — o colaborador grava esta coluna; sem o teto ele inflaria `profiles` (lida por `is_admin()`/`is_active_member()` em toda policy) com ~1 MB por request; chaves conhecidas: `notifications` bool, `event_alerts` bool |
| created_at / updated_at | timestamptz | NN | now() | |

Índices: `(status)` (também serve à contagem de pendentes em `get_bootstrap`/`v_team_stats`), `(role) where role = 'admin'`.
Privilégios de coluna (camada 1): `revoke update on public.profiles from authenticated; grant update (full_name, avatar_path, color, preferences) on public.profiles to authenticated;`. Admin edita as demais colunas via `admin_update_profile` (definer). Camada 2: trigger `private.protect_profile_columns()` (BEFORE UPDATE) — se `not public.is_admin()` e qualquer coluna fora da lista permitida mudou → RAISE `FORBIDDEN_COLUMN`; se `role` ou `status` mudam e a linha é o **último admin ativo** → RAISE `LAST_ADMIN`. Camada 3: policies de linha (§10).
**Não existem colunas de pontos, nível, moedas ou streak em `profiles`** — tudo é derivado do ledger. "Pontos iniciais" **não** fazem parte do formulário de edição (reenviar o formulário lançaria de novo, e sem temporada cobrindo `now()` o save inteiro falharia): é uma ação separada na tela Equipe → `record_initial_points(p_profile_id, p_points)` (§7.4), no máximo uma por (perfil, temporada); o formulário mostra "Pontos iniciais lançados: N" somente leitura. "Nível" no formulário é somente leitura.
Nunca `FORCE ROW LEVEL SECURITY` nesta tabela (o owner precisa ler dentro de `is_admin()`).

### 4.7 `profile_private` (PII e dados só do dono/admin)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| profile_id | uuid | NN | — | PK; FK profiles `ON DELETE RESTRICT` |
| email | text | NN | — | UQ (`lower(email)`); copiado de `auth.users.email` no signup; `CK (length(email) <= 254)` |
| phone | text | — | NULL | `CK (phone is null or length(phone) <= 30)` |
| default_goal_amount | numeric(14,2) | NN | 0 | `CK (>= 0)`; copiado para `season_goals` a cada nova temporada |
| notes | text | — | NULL | anotações do gestor; `CK (notes is null or length(notes) <= 1000)` |
| updated_at | timestamptz | NN | now() | |
| updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |

RLS: SELECT `member and (profile_id = me or admin)`; UPDATE só `is_admin()` (colaborador não edita e-mail/telefone/meta — o gestor faz); sem INSERT/DELETE para `authenticated` (insert só no `handle_new_user`).

### 4.8 `profile_season_stats` (agregado por temporada, mantido por trigger)

| coluna | tipo | NN | default | notas |
|---|---|---|---|---|
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT`; PK (profile_id, season_id) |
| season_id | uuid | NN | — | FK seasons `ON DELETE RESTRICT` |
| points | int | NN | 0 | `SUM(points)` líquido, todas as sources |
| points_earned | int | NN | 0 | pontos positivos líquidos de estornos ("pontos distribuídos") — ver §6.7 A |
| points_updated_at | timestamptz | — | NULL | `max(occurred_at)` das entries com `points > 0 and reverses_entry_id is null` (tiebreak do ranking: quem chegou antes fica na frente). Estornos e ajustes negativos **não** o alteram (quem sofre correção não cai no empate) e entry retroativa usa o `occurred_at`, não `now()`; `recompute_stats` reconstrói com a mesma fórmula |
| coins_earned | int | NN | 0 | `SUM(coins) where coins > 0` na temporada (informativo; saldo é vitalício) |
| coins_spent | int | NN | 0 | `-SUM(coins) where coins < 0` na temporada |
| sales_amount | numeric(14,2) | NN | 0 | `SUM(amount)` de entries `metric in ('sale','upsell')` e `source in ('rule','manual','system')` (estornos entram negativos) |
| sales_count | int | NN | 0 | `SUM(quantity * sign(points))` para `metric = 'sale'` (estorno decrementa) |
| meetings_scheduled | int | NN | 0 | idem `metric = 'meeting_scheduled'` |
| meetings_held | int | NN | 0 | idem `meeting_held` |
| calls | int | NN | 0 | idem `call` |
| crm_updates | int | NN | 0 | idem `crm_update` |
| lead_recoveries | int | NN | 0 | idem `lead_recovery` |
| upsells | int | NN | 0 | idem `upsell` |
| activities_count | int | NN | 0 | `SUM(quantity * sign(points))` para `source in ('rule','manual') and metric not in ('amount_step','weekly_goal','monthly_goal','custom')` |
| missions_completed | int | NN | 0 | incrementado em `mission_progress.completed_at` |
| last_entry_at | timestamptz | — | NULL | último `occurred_at` de entry de atividade (critério de streak, §4.9) |
| updated_at | timestamptz | NN | now() | |

Escrita exclusiva de `private.on_point_entry_inserted()` e `public.recompute_stats()`. `revoke insert, update, delete on public.profile_season_stats from authenticated`. RLS: SELECT `is_active_member()`. Índice `(season_id, points desc)`.

### 4.9 `profile_lifetime_stats` (agregado vitalício)

| coluna | tipo | NN | default | notas |
|---|---|---|---|---|
| profile_id | uuid | NN | — | PK; FK profiles `ON DELETE RESTRICT` |
| coins_earned | int | NN | 0 | |
| coins_spent | int | NN | 0 | |
| coins_balance | int | NN | 0 | `generated always as (coins_earned - coins_spent) stored` |
| sales_amount | numeric(14,2) | NN | 0 | vitalício (50K/100K CLUB) |
| sales_count | int | NN | 0 | |
| first_sale_at | timestamptz | — | NULL | |
| missions_completed | int | NN | 0 | |
| streak_days | int | NN | 0 | tamanho da sequência terminando em `streak_last_day` |
| streak_last_day | date | — | NULL | último dia local com "entrada de atividade" — `private.counts_for_streak(e)`: `e.reverses_entry_id is null` **e** não estornada (`not exists (select 1 from point_entries r where r.reverses_entry_id = e.id)`) **e** (`e.source = 'rule'` **ou** (`e.source = 'manual' and e.points > 0`)). Regra 0/0 (ex.: "Ligação realizada") conta como atividade; ajuste manual negativo, `system` (marcos, pontos iniciais), missão, roleta, desafio e conquista não contam (Apêndice B.16) |
| best_streak_days | int | NN | 0 | |
| updated_at | timestamptz | NN | now() | |

Streak efetivo (exibido) = `case when streak_last_day >= public.local_today() - 1 then streak_days else 0 end` — calculado na view `v_profile_stats`, portanto a coluna nunca "envelhece" errado. Regra de atualização no trigger (dia local `d` da entry de atividade): `d = streak_last_day` → nada; `d = streak_last_day + 1` → `streak_days + 1`; `d > streak_last_day + 1` (ou NULL) → `streak_days = 1`; `d < streak_last_day` (retroativo) → `perform private.recompute_streak(profile_id)` (recalcula pela técnica de ilhas sobre `select distinct public.local_day(occurred_at)` das entries em que `counts_for_streak` é verdadeiro). **Estorno** de uma entry de atividade → `recompute_streak` (a original deixa de contar — §6.7 A). `best_streak_days = greatest(best, streak_days)`.
Escrita exclusiva por trigger/`recompute_stats`. RLS: SELECT `member and (profile_id = me or admin)` — `coins_balance`/`coins_spent` são a carteira e o original mostra só as próprias moedas (ranking é por pontos). Em `v_profile_stats`, as colunas vitalícias de **outros** colaboradores saem NULL/0 para quem não é admin (LEFT JOIN + RLS) e o front só as renderiza na própria linha ou em telas de gestor. O que ranking/feed/conquistas precisam de terceiros (streak para EM CHAMAS, `sales_amount` vitalício para 50K/100K) é avaliado por trigger definer, não pela view.

### 4.10 `point_rules`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| name | text | NN | — | `CK (length(name) between 1 and 60)`; UQ parcial `(lower(name)) where deleted_at is null` |
| metric | metric_type | NN | `'activity'` | |
| points | int | NN | — | `CK (points between 0 and 100000)` |
| coins | int | NN | — | `CK (coins between 0 and 100000)`; seed = `points` |
| trigger_kind | rule_trigger_kind | NN | `'manual'` | `CK (trigger_kind <> 'auto_amount_step' or (metric = 'amount_step' and amount_step is not null))`; `CK (trigger_kind <> 'auto_goal' or metric = 'monthly_goal')`; `CK (metric not in ('amount_step','monthly_goal') or trigger_kind <> 'manual')` |
| amount_step | numeric(14,2) | — | NULL | `CK (amount_step is null or amount_step > 0)`; R$ por bloco (10.000) |
| requires_amount | boolean | NN | false | seed: true para `sale`; `record_rule_entry` exige `p_amount` quando true |
| is_active | boolean | NN | true | |
| sort_order | int | NN | 0 | |
| deleted_at | timestamptz | — | NULL | soft delete |
| created_by / updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |
| created_at / updated_at | timestamptz | NN | now() | |

Regra automática só pode existir uma por tipo: UQ parcial `(trigger_kind) where trigger_kind <> 'manual' and deleted_at is null and is_active`. RLS: SELECT `is_active_member()`; INSERT/UPDATE `is_admin()`; sem DELETE (UI "excluir" = `update set deleted_at = now(), is_active = false`). Trigger de auditoria.

### 4.11 `point_entries` (LEDGER, append-only)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` (`point_entries_profile_id_fkey`) |
| season_id | uuid | NN | — | FK seasons `ON DELETE RESTRICT`; **sempre** preenchido pelo trigger a partir de `occurred_at` (valor recebido é ignorado) |
| rule_id | uuid | — | NULL | FK point_rules `ON DELETE RESTRICT` |
| metric | metric_type | — | NULL | copiado da regra quando `source = 'rule'`; livre em `manual`/`system`; NULL em mission/challenge/wheel/reward/achievement |
| quantity | int | NN | 1 | `CK (quantity >= 1)` |
| amount | numeric(14,2) | — | NULL | R$ da venda; `CK (amount is null or metric in ('sale','upsell'))`; estorno grava `amount` negativo (`CK (amount is null or amount >= 0 or reverses_entry_id is not null)`) |
| base_points | int | NN | — | pontos antes do multiplicador: `rule.points * quantity` (rule), valor informado (manual/system/mission/...) |
| multiplier | numeric(4,2) | NN | 1 | `CK (multiplier between 1 and 10)`; só ≠ 1 quando `source = 'rule'` |
| points | int | NN | — | `CK (abs(points) <= 1000000)`; = `round(base_points * multiplier)`; estorno = `-original.points` |
| coins | int | NN | 0 | `CK (abs(coins) <= 1000000)`; nunca multiplicado |
| source | entry_source | NN | — | |
| reason | text | — | NULL | `CK (reason is null or length(reason) <= 500)`; obrigatório em `manual` (`CK (source <> 'manual' or reason is not null)`) |
| special_event_id | uuid | — | NULL | FK special_events `ON DELETE RESTRICT`; evento aplicado |
| boost_id | uuid | — | NULL | FK profile_boosts `ON DELETE RESTRICT`; boost aplicado |
| reverses_entry_id | uuid | — | NULL | FK point_entries `ON DELETE RESTRICT`; **UQ** (um estorno por entry); `CK (reverses_entry_id <> id)` |
| occurred_at | timestamptz | NN | now() | `CK (occurred_at <= now() + interval '5 minutes')`; estorno **herda** o `occurred_at` da original (§1.12, §6.6) |
| created_by | uuid | — | — | FK profiles `ON DELETE SET NULL` (`point_entries_created_by_fkey`); estampado por trigger |
| created_at | timestamptz | NN | now() | |

Checks de coerência por `source`:
- `CK (source <> 'rule' or rule_id is not null)`; `CK (source in ('rule') or rule_id is null)`.
- `CK (source <> 'reward' or (coins < 0 and points = 0) or reverses_entry_id is not null)` (débito de resgate; o estorno do resgate é `coins > 0`).
- `CK (source not in ('mission','challenge','wheel','achievement') or metric is null)`.
- `CK (source = 'rule' or points <> 0 or coins <> 0 or amount is not null)` — entry de regra vale como fato de atividade mesmo com 0 pontos/0 moedas (ex.: regra "Ligação realizada" 0/0 só para alimentar a missão "Fazer 5 ligações" sem inflar o ranking); nas demais sources nada zerado.
- `CK (multiplier = 1 or source = 'rule')`.

Índices: `(profile_id, season_id)`, `(profile_id, occurred_at desc)`, `(season_id, occurred_at)`, `(profile_id, metric, occurred_at)`, `(season_id, source)`, `(occurred_at desc) where metric = 'sale'`, `(rule_id)`, `(created_by)`.
Imutabilidade: `revoke update, delete on public.point_entries from authenticated`; sem policy de UPDATE/DELETE; trigger `private.forbid_ledger_mutation()` BEFORE UPDATE OR DELETE → RAISE `LEDGER_IMMUTABLE` (vale para qualquer papel, inclusive postgres via SQL Editor — quem precisar apagar de verdade desabilita o trigger conscientemente).
Fórmulas: `points = round(rule.points * quantity * multiplier)`; `coins = rule.coins * quantity`; `multiplier = greatest(event.multiplier, boost.multiplier)` (não acumula — Apêndice B.4).
RLS: SELECT `member and (profile_id = me or admin)`; INSERT `is_admin()` (fallback; o caminho normal é `record_rule_entry`/`record_manual_entry`); resto: nada.

### 4.12 `milestone_awards` (idempotência de marcos)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT`; PK (profile_id, season_id, metric, period_key) |
| season_id | uuid | NN | — | FK seasons `ON DELETE RESTRICT` |
| metric | metric_type | NN | — | `CK (metric in ('amount_step','weekly_goal','monthly_goal'))` |
| period_key | text | NN | — | `'block:3'` (3º bloco de R$ 10k), `'2026-W37'` (semana ISO), `'season'` (meta mensal) |
| entry_id | uuid | NN | — | FK point_entries `ON DELETE RESTRICT`; UQ |
| created_at | timestamptz | NN | now() | |

Índice único parcial extra `(profile_id, metric, period_key) where metric = 'weekly_goal'`: a semana ISO que cruza a virada de temporada (ex.: 28/09–04/10) só pode receber "Meta semanal" uma vez, em qualquer das duas temporadas — `record_rule_entry` checa a duplicata **sem** `season_id` (§7.4).
RLS: SELECT `member and (profile_id = me or admin)`; nada mais. Escrita só por trigger/RPC.

### 4.13 `special_events`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| name | text | NN | — | `CK (length(name) between 1 and 60)` |
| description | text | — | NULL | `CK (length <= 300)` |
| multiplier | numeric(4,2) | NN | 2 | `CK (multiplier between 1.1 and 10)` |
| starts_at | timestamptz | NN | — | |
| ends_at | timestamptz | NN | — | `CK (ends_at > starts_at)` |
| is_active | boolean | NN | true | |
| deleted_at | timestamptz | — | NULL | |
| created_by / updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |
| created_at / updated_at | timestamptz | NN | now() | |

`EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (is_active and deleted_at is null)` — nunca dois eventos ativos sobrepostos. Índice `(starts_at) where is_active and deleted_at is null`.
Trigger AFTER INSERT (e AFTER UPDATE quando `is_active` passa a true): `private.notify_all('event', ...)` cria notificação global "Evento {name} começa em ..." (respeita `preferences.event_alerts`).
RLS: SELECT `is_active_member()`; INSERT/UPDATE `is_admin()` — caminho normal é `save_special_event` (§7.2), que captura `exclusion_violation` e devolve `EVENT_OVERLAP` em vez do `23P01` cru; sem DELETE. Auditoria.

### 4.14 `profile_boosts` (prêmio "2x pontos")

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` |
| multiplier | numeric(4,2) | NN | 2 | `CK (between 1.1 and 10)` |
| starts_at | timestamptz | NN | now() | |
| expires_at | timestamptz | NN | — | `CK (expires_at > starts_at)`; `approve_spin` define `now() + interval '24 hours'` |
| spin_id | uuid | NN | — | FK wheel_spins `ON DELETE RESTRICT`; UQ |
| created_at | timestamptz | NN | now() | |

Aplicação: BEFORE INSERT em `point_entries` com `source = 'rule'`, escolhe o boost do perfil com `occurred_at` em `[starts_at, expires_at)`, maior `multiplier`, e grava `boost_id`. Um boost vale para todas as entries da janela (não é "usos"). Índice `(profile_id, expires_at)`.
RLS: SELECT `member and (profile_id = me or admin)`.

### 4.15 `missions`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| season_id | uuid | NN | — | FK seasons `ON DELETE RESTRICT`; derivado de `starts_at` em `save_mission` |
| title | text | NN | — | `CK (length between 1 and 80)` |
| description | text | — | NULL | `CK (length <= 300)` |
| icon | text | — | NULL | emoji/nome de ícone; `CK (length <= 40)` |
| kind | mission_kind | NN | — | |
| metric | metric_type | NN | — | `CK (metric not in ('amount_step','weekly_goal','monthly_goal'))` |
| target_kind | mission_target_kind | NN | `'count'` | `CK (target_kind <> 'amount' or metric in ('sale','upsell'))` |
| target_value | numeric(14,2) | NN | — | `CK (target_value > 0)`; count = `SUM(quantity)`, amount = `SUM(amount)` |
| reward_points | int | NN | 0 | `CK (between 0 and 100000)` |
| reward_coins | int | NN | 0 | `CK (between 0 and 100000)` |
| reward_spin | wheel_kind | — | NULL | giro "earned" na roleta indicada |
| starts_at | timestamptz | NN | — | |
| ends_at | timestamptz | NN | — | `CK (ends_at > starts_at)` |
| audience | mission_audience | NN | `'all'` | |
| is_active | boolean | NN | true | |
| deleted_at | timestamptz | — | NULL | |
| created_by / updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |
| created_at / updated_at | timestamptz | NN | now() | |

`CK (reward_points > 0 or reward_coins > 0 or reward_spin is not null)`. `save_mission` recusa `reward_spin` de roleta com `wheels.is_active = false` (`WHEEL_INACTIVE`). Trigger `private.validate_mission_window()` BEFORE INSERT/UPDATE: janela contida na temporada (`starts_at >= season.starts_at and ends_at <= season.ends_at`) senão `MISSION_WINDOW_INVALID`; `kind = 'lightning'` exige janela ≤ 24 h. Índices `(season_id, is_active, starts_at, ends_at)`, `(kind)`.
Período de conclusão por `kind`: `daily` → `period_key = local_day(occurred_at)::text` e janela = aquele dia local ∩ [starts_at, ends_at); `weekly` → `to_char(local_day, 'IYYY-"W"IW')`, janela = semana ISO local ∩ janela da missão; `special`/`lightning` → `period_key = 'once'`, janela = [starts_at, ends_at). Função `public.mission_period(p_kind, p_ts, p_starts, p_ends) returns (period_key text, period_start timestamptz, period_end timestamptz)` (§6.1 — fica em `public` porque `v_mission_board` é `security_invoker`).
RLS: SELECT `is_active_member()`; INSERT/UPDATE `is_admin()` (caminho normal: `save_mission`); sem DELETE.

### 4.16 `mission_participants`

| coluna | tipo | NN | default | notas |
|---|---|---|---|---|
| mission_id | uuid | NN | — | FK missions `ON DELETE CASCADE`; PK (mission_id, profile_id) |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` |

Usada só quando `audience = 'selected'`. Elegível = participante (selected) ou qualquer perfil ativo (all). RLS: SELECT `is_active_member()`; INSERT/DELETE `is_admin()` (via `save_mission`, que substitui a lista numa transação).

### 4.17 `mission_progress` (progresso + conclusão por período)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| mission_id | uuid | NN | — | FK missions `ON DELETE CASCADE`; PK (mission_id, profile_id, period_key) |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` |
| period_key | text | NN | — | ver §4.15 |
| period_start | timestamptz | NN | — | |
| period_end | timestamptz | NN | — | |
| value | numeric(14,2) | NN | 0 | `SUM(quantity)` ou `SUM(amount)` das entries elegíveis no período (estornos subtraem) |
| completed_at | timestamptz | — | NULL | |
| entry_id | uuid | — | NULL | FK point_entries `ON DELETE RESTRICT`; UQ; entry de recompensa (`source='mission'`) |
| queue_id | uuid | — | NULL | FK wheel_queue `ON DELETE SET NULL`; UQ; giro enfileirado |
| updated_at | timestamptz | NN | now() | |

Entries elegíveis: `source in ('rule','manual','system') and metric = mission.metric and season_id = mission.season_id and occurred_at in [period_start, period_end)` — o filtro por `season_id` impede que uma missão cuja janela ficou além do fim de uma temporada encurtada receba lançamentos da temporada seguinte (§7.3 faz o clamp das janelas). `value` pode ficar temporariamente negativo após estorno; as views usam `greatest(..., 0)`. Conclusão: `update ... set completed_at = now() where ... and completed_at is null and value >= target returning` — só quem obteve a linha credita (idempotente). Conclusão não é desfeita por estorno posterior (a recompensa já foi paga; o gestor estorna a recompensa manualmente se quiser). Índices `(profile_id, completed_at)`, `(mission_id)`.
RLS: SELECT `is_active_member()` (progresso é público, como o ranking); escrita só por trigger.

### 4.18 `challenges`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| season_id | uuid | NN | — | FK seasons `ON DELETE RESTRICT`; derivado de `starts_at` |
| name | text | NN | — | `CK (length between 1 and 80)` |
| description | text | — | NULL | `CK (length <= 300)` |
| kind | challenge_kind | NN | — | |
| metric | challenge_metric | NN | — | |
| target_value | numeric(14,2) | NN | — | `CK (> 0)`; duelo: objetivo visual/barra; coletivo: meta a bater |
| reward_points | int | NN | 0 | `CK (between 0 and 100000)` |
| reward_coins | int | NN | 0 | `CK (between 0 and 100000)` |
| reward_spin | wheel_kind | — | NULL | giro "earned" para cada premiado |
| reward_description | text | — | NULL | `CK (length <= 120)`; texto do prêmio ("Roleta Premium para todos") |
| starts_at | timestamptz | NN | — | |
| ends_at | timestamptz | NN | — | `CK (ends_at > starts_at)` |
| status | challenge_status | NN | `'draft'` | |
| winner_ids | uuid[] | NN | `'{}'` | preenchido por `finish_challenge` |
| activated_at / finished_at / cancelled_at | timestamptz | — | NULL | `CK (status <> 'active' or activated_at is not null)`; `CK (status <> 'finished' or finished_at is not null)` |
| created_by / updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |
| created_at / updated_at | timestamptz | NN | now() | |

Trigger `private.validate_challenge_window()`: janela contida na temporada (`CHALLENGE_WINDOW_INVALID`). Trigger `private.protect_challenge_status()` BEFORE UPDATE: se `NEW.status <> OLD.status` e `pg_trigger_depth() = 0` e `current_setting('app.rpc', true) is distinct from 'on'` → RAISE `STATUS_VIA_RPC_ONLY` (transições só por `activate_challenge`/`finish_challenge`/`cancel_challenge`, que fazem `set local app.rpc = 'on'`). Índices `(season_id, status)`.
Valor por métrica (usado no trigger e em `activate_challenge`): `meetings_held` → `SUM(quantity·sign)` de `metric='meeting_held'`; `sales_count` → idem `sale`; `revenue` → `SUM(amount)` de `metric in ('sale','upsell')`; `points` → `SUM(points)` (todas as sources exceto `reward`); `activities` → `SUM(quantity·sign)` de `source in ('rule','manual') and metric not in ('amount_step','weekly_goal','monthly_goal','custom')`. Só entries com `season_id = challenges.season_id and occurred_at in [starts_at, ends_at)`. `save_challenge` recusa `reward_spin` de roleta inativa (`WHEEL_INACTIVE`).
RLS: SELECT `is_active_member()`; INSERT/UPDATE `is_admin()`; sem DELETE (cancelamento = status).

### 4.19 `challenge_participants`

| coluna | tipo | NN | default | notas |
|---|---|---|---|---|
| challenge_id | uuid | NN | — | FK challenges `ON DELETE CASCADE`; PK (challenge_id, profile_id) |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` |
| current_value | numeric(14,2) | NN | 0 | mantido por trigger do ledger (só enquanto `status = 'active'`) e recalculado em `activate_challenge` |
| updated_at | timestamptz | NN | now() | |

Trigger `private.protect_challenge_participants()` BEFORE INSERT/DELETE: RAISE `CHALLENGE_NOT_DRAFT` se `challenges.status <> 'draft'`; BEFORE INSERT em duelo com já 2 participantes → `DUEL_NEEDS_TWO`. Constraint trigger `private.check_challenge_cardinality()` `DEFERRABLE INITIALLY DEFERRED` em `challenge_participants` (INSERT/DELETE) e `challenges` (UPDATE OF status): quando `status = 'active'`, duelo exige exatamente 2 participantes distintos e ativos; coletivo ≥ 2. Índice `(profile_id)`.
Participante inativado durante o desafio (Apêndice B.17): duelo `active` é cancelado por `admin_update_profile` (§7.2) com aviso ao outro participante; em coletivo `draft` o perfil é removido; em coletivo `active` ele permanece e `finish_challenge` o marca `is_winner = false` (nada é pago a quem não pode entrar no app). `v_challenge_board.participants[].status` expõe o estado para a UI.
RLS: SELECT `is_active_member()`; INSERT/DELETE `is_admin()` (via `save_challenge`); `revoke update on public.challenge_participants from authenticated` (só trigger altera `current_value`).

### 4.20 `challenge_results`

| coluna | tipo | NN | default | notas |
|---|---|---|---|---|
| challenge_id | uuid | NN | — | FK challenges `ON DELETE RESTRICT`; PK (challenge_id, profile_id) |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` |
| final_value | numeric(14,2) | NN | 0 | |
| is_winner | boolean | NN | false | |
| entry_id | uuid | — | NULL | FK point_entries `ON DELETE RESTRICT`; UQ; NULL se não premiado |
| queue_id | uuid | — | NULL | FK wheel_queue `ON DELETE SET NULL`; UQ |
| created_at | timestamptz | NN | now() | |

Escrita só por `finish_challenge`. RLS: SELECT `is_active_member()`.

### 4.21 `wheels`

| coluna | tipo | NN | default | notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| kind | wheel_kind | NN | — | UQ |
| name | text | NN | — | "Roleta Clássica" / "Roleta Premium"; `CK (length <= 40)` |
| is_active | boolean | NN | true | |
| updated_at | timestamptz | NN | now() | |

Trigger `wheels_protect_inactive` BEFORE UPDATE OF `is_active` (`private.protect_wheel_deactivation()`): `NEW.is_active = false and OLD.is_active` com fila `waiting`/`active` nesta roleta, missão `is_active and deleted_at is null and ends_at > now()` com `reward_spin = kind`, ou desafio `draft`/`active` com `reward_spin = kind` → RAISE `WHEEL_IN_USE` (senão a fila e as missões/desafios apontariam para giros impossíveis). Constraint trigger `wheels_check_prizes` AFTER UPDATE OF `is_active` DEFERRABLE INITIALLY DEFERRED (`private.check_wheel_prizes_on_wheel()` → `private.assert_wheel_prizes(NEW.id)`): **reativar** exige o mínimo de prêmios (`MIN_PRIZES`/`MYSTERY_NEEDS_POOL`) — o trigger de `wheel_prizes` só olha roletas ativas, então inativar → apagar todos os prêmios → reativar deixaria a roleta com peso total 0 e `draw_prize` dividiria por zero. RPCs `enqueue_wheel`, `update_queue_entry`, `release_turn`, `spin_wheel`, `spin_wheel_free`, `save_mission`, `save_challenge` recusam roleta inativa com `WHEEL_INACTIVE`.
RLS: SELECT `is_active_member()`; UPDATE `is_admin()` (só `name`/`is_active`); sem INSERT/DELETE (2 linhas fixas do seed).

### 4.22 `wheel_prizes`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| wheel_id | uuid | NN | — | FK wheels `ON DELETE RESTRICT` |
| label | text | NN | — | `CK (length between 1 and 40)` |
| kind | prize_kind | NN | — | |
| value | numeric(14,2) | — | NULL | `CK ((kind in ('points','coins','cash','voucher') and value > 0) or (kind = 'multiplier' and value between 1.1 and 10) or (kind in ('extra_spin','mystery','custom') and value is null))` |
| weight | int | NN | 1 | `CK (weight between 1 and 1000)` |
| color | text | — | NULL | cor do setor; `CK (color is null or color ~ '^#[0-9A-Fa-f]{6}$')` |
| sort_order | int | NN | 0 | UQ parcial `(wheel_id, sort_order) where deleted_at is null` |
| is_active | boolean | NN | true | |
| deleted_at | timestamptz | — | NULL | |
| created_at / updated_at | timestamptz | NN | now() | |
| updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |

Constraint trigger `private.check_wheel_min_prizes()` `DEFERRABLE INITIALLY DEFERRED` (AFTER INSERT/UPDATE/DELETE) → `private.assert_wheel_prizes(coalesce(NEW.wheel_id, OLD.wheel_id))`: cada roleta **ativa** precisa de ≥ 2 prêmios `is_active and deleted_at is null` (`MIN_PRIZES`); e ≥ 1 prêmio ativo que não seja `mystery`/`extra_spin` (`MYSTERY_NEEDS_POOL`). A mesma asserção roda ao reativar a roleta (§4.21). Trigger `private.block_prize_change_with_pending_spin()` BEFORE UPDATE/DELETE: RAISE `SPIN_PENDING` se existe `wheel_spins.status = 'pending'` na mesma roleta — como esse trigger só enxerga spins já commitados, `save_wheel_prizes` e `spin_wheel` pegam ambos o advisory lock `wheel_turn` (§7.6): um sorteio em andamento e uma edição de prêmios nunca se cruzam. Índice `(wheel_id, is_active) where deleted_at is null`.
Reordenação: o índice único parcial `(wheel_id, sort_order) where deleted_at is null` não é deferível, então trocar 0↔1 ou inserir no meio violaria o índice no meio da sequência de UPDATEs; `save_wheel_prizes` grava em duas fases (§7.6) — primeiro move os prêmios vivos para o espaço negativo (`sort_order = -1 - sort_order`), depois aplica os `sort_order` finais. Prêmios soft-deletados saem do índice (`deleted_at is not null`) e não colidem.
`prizes_hash` (retornado por `spin_wheel`) = `md5(string_agg(id::text || ':' || sort_order || ':' || label || ':' || kind || ':' || coalesce(value::text, '') || ':' || coalesce(color, ''), ',' order by sort_order))` dos prêmios ativos da roleta — muda também quando só rótulo/cor/tipo/valor mudam, para uma TV com a lista antiga em cache recarregar antes de animar (o front também recarrega ao receber UPDATE Realtime em `wheel_prizes`).
RLS: SELECT `is_active_member()`; INSERT/UPDATE `is_admin()` (caminho normal: `save_wheel_prizes`); sem DELETE.

### 4.23 `wheel_queue`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| profile_id | uuid | — | NULL | FK profiles `ON DELETE RESTRICT` |
| person_name | text | NN | — | snapshot de `full_name` ou nome do convidado; `CK (length between 1 and 80)` |
| wheel_id | uuid | NN | — | FK wheels `ON DELETE RESTRICT` |
| attempts_allowed | int | NN | 1 | `CK (attempts_allowed between 1 and 20)` |
| attempts_used | int | NN | 0 | `CK (attempts_used >= 0 and attempts_used <= attempts_allowed)` |
| status | queue_status | NN | `'waiting'` | |
| source | queue_source | NN | `'manual'` | |
| reference_kind | text | — | NULL | `'mission_progress'`, `'challenge_result'`; `CK (reference_kind is null or reference_kind in ('mission_progress','challenge_result'))` |
| reference_id | text | — | NULL | id textual da origem (`mission_id:profile_id:period_key` ou `challenge_id:profile_id`); UQ parcial `(reference_kind, reference_id) where reference_id is not null` (nunca enfileira duas vezes a mesma origem) |
| released_at | timestamptz | — | NULL | `CK (status <> 'active' or released_at is not null)` |
| finished_at | timestamptz | — | NULL | `CK (status not in ('done','removed') or finished_at is not null)` |
| removed_by | uuid | — | NULL | FK profiles `ON DELETE SET NULL` |
| created_by | uuid | — | NULL | FK profiles `ON DELETE SET NULL`; NULL quando `source = 'earned'` |
| created_at / updated_at | timestamptz | NN | now() | |

`CK (profile_id is not null or source = 'manual')` (earned sempre tem perfil). `create unique index wheel_queue_one_active on public.wheel_queue ((true)) where status = 'active'`. Índices `(status, created_at) where status in ('waiting','active')`, `(profile_id, status)`. Giros `earned` sempre criam uma linha própria (uma pessoa pode ter uma entrada manual e outra ganha na fila ao mesmo tempo); só `enqueue_wheel` recusa duplicata, e só entre entradas `source = 'manual'` (§7.6 — um giro ganho por missão não impede o gestor de adicionar a mesma pessoa manualmente). Perfil inativado: `admin_update_profile` remove suas entradas `waiting`/`active` (§7.2); `release_turn` recusa perfil inativo (`PROFILE_INACTIVE`).
RLS: SELECT `is_active_member()`; sem INSERT/UPDATE/DELETE para `authenticated` — tudo por RPC.

### 4.24 `wheel_spins`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| queue_id | uuid | NN | — | FK wheel_queue `ON DELETE RESTRICT` (giro livre **não** grava linha — §7) |
| profile_id | uuid | — | NULL | FK profiles `ON DELETE RESTRICT`; snapshot da fila |
| person_name | text | NN | — | snapshot |
| wheel_id | uuid | NN | — | FK wheels `ON DELETE RESTRICT` |
| attempt_index | int | NN | — | `attempts_used + 1` no momento do giro |
| prize_id | uuid | NN | — | FK wheel_prizes `ON DELETE RESTRICT`; prêmio sorteado (pode ser `mystery`) |
| prize_label / prize_kind / prize_value | text / prize_kind / numeric(14,2) | NN/NN/— | — | snapshot do sorteado |
| resolved_prize_id | uuid | NN | — | FK wheel_prizes `ON DELETE RESTRICT`; = `prize_id` exceto quando `prize_kind = 'mystery'` (resolvido no próprio sorteio entre prêmios ativos da mesma roleta excluindo `mystery`/`extra_spin`) |
| resolved_label / resolved_kind / resolved_value | text / prize_kind / numeric(14,2) | NN/NN/— | — | snapshot do prêmio efetivo; `CK (resolved_kind <> 'mystery')` |
| random_value | bigint | NN | — | valor do CSPRNG usado (auditoria) |
| prizes_hash | text | NN | — | hash dos prêmios ativos no momento do sorteio |
| status | spin_status | NN | `'pending'` | |
| spun_by | uuid | — | — | FK profiles `ON DELETE SET NULL`; quem chamou `spin_wheel` |
| spun_at | timestamptz | NN | now() | |
| approved_by | uuid | — | NULL | FK profiles `ON DELETE SET NULL` |
| approved_at | timestamptz | — | NULL | `CK ((status = 'pending') = (approved_at is null))` |
| entry_id | uuid | — | NULL | FK point_entries `ON DELETE RESTRICT`; UQ; crédito de pontos/moedas |
| redemption_id | uuid | — | NULL | FK reward_redemptions `ON DELETE RESTRICT`; UQ; cash/voucher |
| boost_id | uuid | — | NULL | FK profile_boosts `ON DELETE RESTRICT`; UQ |
| credited | boolean | NN | false | `false` também em aprovado de convidado com prêmio não creditável |

`create unique index wheel_spins_one_pending_per_queue on public.wheel_spins (queue_id) where status = 'pending'`. Índices `(status, spun_at desc)`, `(profile_id, spun_at desc)`.
RLS: SELECT `member and (status in ('approved','pending') or profile_id = me or admin)` — aprovados e o pendente da vez são públicos (histórico e estado "AGUARDANDO APROVAÇÃO" na tela da roleta); `rejected` só para o dono e o gestor. Sem escrita direta.

### 4.25 `rewards` (loja)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| name | text | NN | — | `CK (length between 1 and 60)` |
| category | text | — | NULL | `CK (length <= 40)` (Voucher, PIX, Benefício…) |
| value_amount | numeric(14,2) | — | NULL | R$ equivalente (para "Recompensas (R$ entregues)"); `CK (value_amount is null or value_amount >= 0)` |
| cost_coins | int | NN | — | `CK (cost_coins between 1 and 1000000)` |
| stock | int | — | NULL | NULL = ilimitado; `CK (stock is null or stock >= 0)`; decrementado atomicamente no resgate, restaurado no cancelamento |
| icon | text | — | NULL | `CK (length <= 40)` |
| is_active | boolean | NN | true | |
| sort_order | int | NN | 0 | |
| deleted_at | timestamptz | — | NULL | |
| created_by / updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |
| created_at / updated_at | timestamptz | NN | now() | |

RLS: SELECT `is_active_member()`; INSERT/UPDATE `is_admin()`; sem DELETE. Auditoria.

### 4.26 `reward_redemptions`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| source | redemption_source | NN | — | |
| reward_id | uuid | — | NULL | FK rewards `ON DELETE RESTRICT` |
| spin_id | uuid | — | NULL | FK wheel_spins `ON DELETE RESTRICT`; UQ |
| profile_id | uuid | — | NULL | FK profiles `ON DELETE RESTRICT` |
| person_name | text | NN | — | snapshot (convidado da roleta ou `full_name`) |
| title | text | NN | — | snapshot do nome da recompensa/prêmio |
| cost_coins | int | NN | 0 | `CK (>= 0)` |
| value_amount | numeric(14,2) | — | NULL | R$ a entregar |
| status | redemption_status | NN | `'requested'` | |
| requested_at | timestamptz | NN | now() | |
| handled_by | uuid | — | NULL | FK profiles `ON DELETE SET NULL` |
| handled_at | timestamptz | — | NULL | |
| notes | text | — | NULL | `CK (length <= 500)` |
| entry_id | uuid | — | NULL | FK point_entries `ON DELETE RESTRICT`; UQ; débito de moedas |
| refund_entry_id | uuid | — | NULL | FK point_entries `ON DELETE RESTRICT`; UQ; estorno no cancelamento |
| updated_at | timestamptz | NN | now() | |

`CK ((source = 'store' and reward_id is not null and profile_id is not null and entry_id is not null and cost_coins > 0) or (source = 'wheel' and spin_id is not null and cost_coins = 0 and entry_id is null))`; `CK (profile_id is not null or source = 'wheel')`; `CK (status <> 'cancelled' or source = 'wheel' or refund_entry_id is not null)`. Índices `(profile_id, status)`, `(status, requested_at)`.
RLS: SELECT `member and (profile_id = me or admin)`; sem INSERT/UPDATE/DELETE direto (RPCs `redeem_reward`, `handle_redemption`). Auditoria via RPC.

### 4.27 `achievements` (catálogo)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| code | text | NN | — | UQ; `CK (code ~ '^[a-z0-9_]{2,40}$')` |
| title | text | NN | — | `CK (length <= 60)` |
| description | text | — | NULL | `CK (length <= 200)` |
| icon | text | — | NULL | |
| criteria | achievement_criteria | NN | — | |
| criteria_value | numeric(14,2) | — | NULL | `CK ((criteria in ('first_sale','monthly_goal','rank_first') and criteria_value is null) or (criteria in ('streak_days','sales_total','points_total','missions_completed') and criteria_value > 0))` |
| scope | achievement_scope | NN | — | `CK ((criteria in ('monthly_goal','rank_first') and scope = 'season') or criteria not in ('monthly_goal','rank_first'))` |
| reward_points | int | NN | 0 | `CK (between 0 and 100000)` |
| reward_coins | int | NN | 0 | `CK (between 0 and 100000)` |
| is_active | boolean | NN | true | |
| sort_order | int | NN | 0 | |
| deleted_at | timestamptz | — | NULL | |
| created_at / updated_at | timestamptz | NN | now() | |
| updated_by | uuid | — | — | FK profiles `ON DELETE SET NULL` |

Avaliação por critério (fonte dos números): `first_sale` → `profile_lifetime_stats.first_sale_at is not null`; `streak_days` → `profile_lifetime_stats.streak_days >= v` (no momento da entry); `sales_total` → `lifetime.sales_amount >= v` (scope lifetime) ou `season.sales_amount >= v` (scope season); `points_total` → idem com `points`; `missions_completed` → idem; `monthly_goal` → concedida por `private.evaluate_goal_milestone` (§6.9) junto com o marco; `rank_first` → só em `close_season`. `points_total`/`missions_completed` são avaliadas para toda entry positiva, não só de regra (§6.7 B3').
RLS: SELECT `is_active_member()`; INSERT/UPDATE `is_admin()`; sem DELETE.

### 4.28 `profile_achievements`

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| profile_id | uuid | NN | — | FK profiles `ON DELETE RESTRICT` |
| achievement_id | uuid | NN | — | FK achievements `ON DELETE RESTRICT` |
| season_id | uuid | — | NULL | FK seasons `ON DELETE RESTRICT`; NULL para `scope = 'lifetime'` |
| unlocked_at | timestamptz | NN | now() | |
| entry_id | uuid | — | NULL | FK point_entries `ON DELETE RESTRICT`; UQ; NULL quando a conquista não dá pontos/moedas |
| trigger_entry_id | uuid | — | NULL | FK point_entries `ON DELETE SET NULL`; entry que disparou (auditoria) |

Índices únicos parciais: `(profile_id, achievement_id) where season_id is null` e `(profile_id, achievement_id, season_id) where season_id is not null`. Índice `(profile_id, unlocked_at desc)`.
RLS: SELECT `is_active_member()`; escrita só por trigger/`close_season`.

### 4.29 `feed_events` (feed público)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| kind | feed_kind | NN | — | |
| profile_id | uuid | — | NULL | FK profiles `ON DELETE RESTRICT`; NULL só em `season_closed` |
| season_id | uuid | — | NULL | FK seasons `ON DELETE RESTRICT` |
| payload | jsonb | NN | `'{}'` | só campos publicáveis (ver abaixo) |
| dedupe_key | text | — | NULL | UQ; ex.: `level_up:<profile>:<season>:7`, `sale:<entry_id>` |
| occurred_at | timestamptz | NN | now() | |
| created_at | timestamptz | NN | now() | |

Payload por `kind`: `sale` `{amount}`; `achievement` `{code, title, icon}`; `wheel_prize` `{label, kind, wheel_kind}`; `level_up` `{from_level, to_level}`; `mission_completed` `{title, reward_points, reward_coins}`; `challenge_finished` `{name, kind, is_winner}`; `season_closed` `{season_name, champion_profile_id?, champion_name?}` — os dois campos de campeão são **opcionais** (ausentes quando ninguém terminou com `points > 0`; o front renderiza "{season_name} encerrada — sem campeão"). **Nunca** `reason`, `created_by`, lançamentos manuais ou negativos. Índice `(occurred_at desc, id desc)`.
RLS: SELECT `is_active_member()`; escrita só por trigger/RPC (`revoke insert, update, delete ... from authenticated`).

### 4.30 `notifications` (fan-out: uma linha por destinatário)

| coluna | tipo | NN | default | constraints / notas |
|---|---|---|---|---|
| id | uuid | NN | gen_random_uuid() | PK |
| profile_id | uuid | NN | — | FK profiles `ON DELETE CASCADE` |
| kind | notification_kind | NN | — | |
| title | text | NN | — | `CK (length <= 80)` |
| message | text | NN | — | `CK (length <= 300)` |
| payload | jsonb | NN | `'{}'` | ids de referência (`entry_id`, `spin_id`, `mission_id`…) |
| is_read | boolean | NN | false | |
| created_at | timestamptz | NN | now() | |

Índices `(profile_id, created_at desc)`, `(profile_id) where not is_read`. Privilégios de coluna: `revoke update on public.notifications from authenticated; grant update (is_read) on public.notifications to authenticated`.
RLS: SELECT `member and profile_id = me`; UPDATE `member and profile_id = me` (`with check` idem); sem INSERT/DELETE para `authenticated` (produtores: `private.notify()`, `private.notify_all()`). Admin não lê notificações alheias (não há necessidade de UI). Produtores respeitam `profiles.preferences->>'notifications'` (e `event_alerts` para `kind = 'event'`): se `false`, a linha não é criada.

### 4.31 `audit_log`

| coluna | tipo | NN | default | notas |
|---|---|---|---|---|
| id | bigint | NN | identity | PK |
| actor_id | uuid | — | NULL | FK profiles `ON DELETE SET NULL`; `auth.uid()` ou NULL (trigger interno) |
| action | audit_action | NN | — | |
| table_name | text | NN | — | ou nome da RPC quando `action = 'rpc'` |
| row_id | text | — | NULL | |
| old_data | jsonb | — | NULL | |
| new_data | jsonb | — | NULL | |
| created_at | timestamptz | NN | now() | |

Alimentada por `private.audit_row()` (AFTER INSERT/UPDATE em `profiles` (só role/status/job_title/team), `app_settings`, `app_secrets` (team_code mascarado), `point_rules`, `rewards`, `wheel_prizes`, `seasons`, `special_events`, `achievements`) e pelas RPCs `approve_spin`, `reject_spin`, `handle_redemption`, `reverse_entry`, `rotate_team_code`, `admin_update_profile`, `close_season`, `finish_challenge`, `recompute_stats`. Índice `(created_at desc)`, `(table_name, row_id)`.
RLS: SELECT `is_admin()`; nenhuma escrita para `authenticated`.

### 4.32 (removida) `private.team_code_attempts`

A tabela de throttle por IP da pré-validação do código foi **removida** na revisão adversarial (Apêndice D, item 4). Motivos: `x-forwarded-for` é controlado pelo cliente (Cloudflare/Kong **anexam** o IP real, não substituem — um valor forjado muda a chave a cada request), logo o throttle era contornável e, pior, permitia inserir linhas sem limite via PostgREST até encher o banco; sem o header, todos caíam na chave `global` e 10 erros de qualquer anônimo (ou uma equipe atrás de NAT) bloqueavam a pré-validação da equipe inteira por 15 min. Força bruta real é inviável (16^12 ≈ 2,8·10^14 códigos) e o GoTrue já limita cadastros por IP. `validate_team_code` passa a ser só conveniência de UX (§7.1); a validação que vale continua no trigger `handle_new_user`.

---

## 5. Views

Todas: `with (security_invoker = true, security_barrier = true)`, `revoke all from anon, authenticated`, `grant select to authenticated` (só SELECT — inclusive nas auto-atualizáveis). Nenhuma view lê `point_entries` exceto as marcadas **(ledger)** — nelas o colaborador enxerga só as próprias linhas (RLS), o que é o comportamento desejado. O front **sempre** aplica `.order(...)` explícito (o PostgREST não garante ordem de view). Agregados envoltos em `coalesce(..., 0)` para saírem `not null` nos tipos gerados.

Regras transversais: (1) **todo percentual de view é limitado a `least(..., 999.99)`** e cabe em `numeric(5,2)` — sem teto, 10 vendas em 1 reunião realizada dariam 1000,00%, o cast estouraria (`numeric field overflow`) e a view **inteira** falharia para todos; o front renderiza > 100 como "100%+" em conversão/comparecimento. Percentuais de progresso usam `greatest(least(..., 100), 0)` porque estorno pode deixar o valor negativo. (2) Views só chamam funções de `public` (`public.local_day`, `public.local_today`, `public.mission_period` — §6.1); nunca `private.*` (§2.1). (3) Colunas own-or-admin (carteira, meta, PII) saem NULL/0 nas linhas de terceiros quando quem lê é colaborador.

### 5.1 `v_profile_stats` — perfil × temporada (inclui inativos e pendentes, `rank` NULL para eles)
Fonte: `profiles p` CROSS JOIN `seasons s` LEFT JOIN `profile_season_stats ss` ON (p.id, s.id) LEFT JOIN `profile_lifetime_stats ls` LEFT JOIN `season_goals g` ON (s.id, p.id) LEFT JOIN `profile_private pp` (só vem preenchido para a própria linha ou admin — RLS). Uma linha por (perfil, temporada).

| coluna | tipo | lógica |
|---|---|---|
| profile_id, season_id | uuid | |
| full_name, avatar_path, color, job_title, team, role, status | | de `profiles` |
| email, phone | text | de `profile_private` (NULL quando não visível) |
| season_name, season_starts_at, season_ends_at, season_is_active | | de `seasons` |
| points, points_earned | int | `coalesce(ss.points,0)`, `coalesce(ss.points_earned,0)` |
| sales_amount, sales_count, meetings_scheduled, meetings_held, calls, crm_updates, lead_recoveries, upsells, activities_count, missions_completed | | de `ss` (coalesce 0) |
| conversion_pct | numeric(5,2) | `case when meetings_held > 0 then least(round(sales_count::numeric / meetings_held * 100, 2), 999.99) else null end` |
| attendance_pct | numeric(5,2) | `case when meetings_scheduled > 0 then least(round(meetings_held::numeric / meetings_scheduled * 100, 2), 999.99) else null end` |
| goal_amount | numeric | `coalesce(g.goal_amount, 0)` |
| goal_pct | numeric(5,2) | `case when goal_amount > 0 then least(round(sales_amount / goal_amount * 100, 2), 999.99) else null end` |
| goal_missing_amount | numeric | `greatest(goal_amount - sales_amount, 0)` |
| projected_goal_date | date | `v_days := ceil(goal_amount / (sales_amount / days_elapsed))` (numeric); `null` se `goal_amount = 0` ou `sales_amount >= goal_amount` ou `sales_amount = 0` ou dias decorridos = 0 **ou `v_days > 3650`** (ritmo ínfimo — R$ 0,01 contra meta de R$ 1 mi — estouraria `int`/`date out of range` e derrubaria a view inteira); senão `public.local_day(s.starts_at) + v_days::int`, onde `days_elapsed = greatest(public.local_today() - public.local_day(s.starts_at), 1)` limitado a dias da temporada; front mostra "sem ritmo" quando NULL ou > fim da temporada |
| xp_per_level | int | `s.xp_per_level` |
| level | int | `greatest(points, 0) / xp_per_level` (divisão inteira) |
| xp_in_level | int | `greatest(points,0) - level * xp_per_level` |
| xp_to_next | int | `xp_per_level - xp_in_level` |
| coins_balance, coins_earned_lifetime, coins_spent_lifetime | int | de `ls` (coalesce 0) |
| streak_days | int | `case when ls.streak_last_day >= public.local_today() - 1 then ls.streak_days else 0 end` (coalesce 0) |
| best_streak_days, sales_amount_lifetime, sales_count_lifetime | | de `ls` |
| rank | int | `row_number() over (partition by s.id order by ss.points desc nulls last, ss.sales_amount desc nulls last, ss.points_updated_at asc nulls last, p.id)` calculado **só sobre perfis ranqueáveis**: `p.status = 'active' and ((select rank_admins from app_settings) or p.role <> 'admin')` (subquery); NULL para inativo, para **pendente** (`status = 'pending'` nunca ranqueia) e para gestor quando `rank_admins = false` (Apêndice B.19) |
| gap_to_above | int | `lag(points) over (mesma ordem) - points` (NULL para o 1º — front mostra "Você lidera" — e para não ranqueado) |
| is_tied_with_above | boolean | `lag(points) over (mesma ordem) = points` (false para o 1º); com `row_number` o empate dá posições distintas e `gap_to_above = 0`, então o front mostra "Empatado com o Nº acima" em vez de "0 pontos para a posição acima" |
| has_points | boolean | `points > 0`; no início da temporada todos têm 0 e ficariam ranqueados por `p.id` — o pódio só é desenhado quando o 1º tem `has_points` |
| achievements_unlocked | int | `count(distinct pa.achievement_id)` sobre `profile_achievements pa` JOIN `achievements a` (`a.is_active and a.deleted_at is null`), todas as temporadas + lifetime — META BATIDA em 3 temporadas conta 1 (senão o perfil mostraria "8 de 6") |
| achievements_total | int | `count(achievements where is_active and deleted_at is null)` — o front monta "X de Y desbloqueadas" |
| pending_earned_spins | int | `count(wheel_queue where profile_id = p.id and status = 'waiting' and source = 'earned')` |
| last_entry_at | timestamptz | `ss.last_entry_at` |

### 5.2 `v_ranking` — `v_profile_stats` filtrada `rank is not null` (só `status = 'active'`; gestores só quando `rank_admins`; pendentes e inativos nunca aparecem)
Colunas: `season_id, rank, gap_to_above, is_tied_with_above, has_points, profile_id, full_name, avatar_path, color, job_title, team, points, level, sales_amount, sales_count, conversion_pct, meetings_held`. Front: `.eq('season_id', id).order('rank')`; pódio só quando o 1º tem `has_points`.

### 5.3 `v_team_stats` — uma linha por temporada
Fonte: `seasons s` LEFT JOIN agregados de `profile_season_stats` (join `profiles` para status) LEFT JOIN contagem de `wheel_queue`.

| coluna | lógica |
|---|---|
| season_id, season_name, starts_at, ends_at, is_active, team_goal_amount, xp_per_level | de `seasons` |
| sales_amount | `sum(ss.sales_amount)` de **todos** os perfis (inativos incluídos — a venda aconteceu) |
| attainment_pct | `case when team_goal_amount > 0 then least(round(sales_amount / team_goal_amount * 100, 2), 999.99) else null end` |
| sales_missing_amount | `greatest(team_goal_amount - sales_amount, 0)` |
| points_total | `sum(ss.points)` |
| points_distributed | `sum(ss.points_earned)` |
| active_count | `count(profiles where status = 'active')` |
| pending_count | `count(profiles where status = 'pending')` — cadastros aguardando aprovação (contador da seção "Pendentes" da tela Equipe; o badge da sidebar usa `get_bootstrap().pending_members`, §7.1) |
| total_count | `count(profiles)` (inclui inativos e pendentes) |
| sales_count, meetings_scheduled, meetings_held, calls, crm_updates, activities_count, missions_completed | somas |
| avg_conversion_pct | `least(round(avg(sales_count::numeric / nullif(meetings_held,0)) * 100, 2), 999.99)` sobre perfis ativos com `meetings_held > 0` |
| attendance_pct | `least(round(sum(meetings_held)::numeric / nullif(sum(meetings_scheduled),0) * 100, 2), 999.99)` |
| crm_pct | `round(count(distinct ss.profile_id where crm_updates > 0 and profile ativo)::numeric / nullif(active_count,0) * 100, 2)` — "% de ativos com ≥1 atualização de CRM na temporada" |
| queue_count | `count(wheel_queue where status in ('waiting','active'))` |
| target_conversion_pct, target_attendance_pct, target_crm_pct, target_activities_count | de `app_settings` |

### 5.4 `v_admin_kpis` — **só admin** (linha por temporada; `where (select public.is_admin())` dentro da view)
| coluna | lógica |
|---|---|
| season_id | |
| redemptions_delivered_amount | `sum(coalesce(value_amount,0))` de `reward_redemptions` com `status = 'delivered'` e `handled_at` dentro da temporada |
| redemptions_pending_count | `count(status in ('requested','approved'))` (global, não por temporada) |
| entries_count | `count(point_entries where season_id = s.id and source in ('rule','manual'))` (ledger) |
| coins_issued | `sum(coins) where coins > 0` na temporada (ledger) |

### 5.5 `v_sales_timeline` — **(ledger, admin)** série diária zero-filled
Fonte: `seasons s` CROSS JOIN LATERAL `generate_series(public.local_day(s.starts_at), least(public.local_day(s.ends_at - interval '1 second'), public.local_today()), '1 day')` LEFT JOIN agregados de `point_entries` por `public.local_day(occurred_at)`. Estornos entram no dia do fato original (herdam `occurred_at`), então a série acumulada nunca mostra uma venda de segunda "desaparecendo" na terça.
Colunas: `season_id, day (date), sales_amount (soma do dia, metric in sale/upsell, source in rule/manual/system), sales_count, sales_cum (soma acumulada até o dia), points (líquido do dia), points_cum, entries_count`. Para colaborador retorna só os próprios números (RLS) — a UI só usa no Admin Dashboard.

### 5.6 `v_mission_board` — missão × perfil elegível
Fonte: `missions m` (`deleted_at is null`) JOIN elegíveis (`mission_participants` **JOIN `profiles` com `status='active'`** quando `audience='selected'`, senão `profiles where status='active'` — pendentes/inativos nunca aparecem no board) **LEFT JOIN LATERAL** `public.mission_period(m.kind, now(), m.starts_at, m.ends_at) per ON true` (retorna 0 linhas fora da janela ⇒ colunas de período NULL, mas a missão **continua listada** — o gestor precisa ver missões futuras/passadas para editar; um JOIN LATERAL simples as faria sumir) LEFT JOIN `mission_progress mp` ON `(mp.mission_id, mp.profile_id, mp.period_key) = (m.id, p.id, per.period_key)` LEFT JOIN `wheel_queue q` ON `mp.queue_id`.

| coluna | lógica |
|---|---|
| mission_id, season_id, profile_id | |
| title, description, icon, kind, metric, target_kind, target_value, reward_points, reward_coins, reward_spin, starts_at, ends_at, audience, is_active | de `missions` |
| is_current | `m.is_active and now() >= m.starts_at and now() < m.ends_at` |
| period_key, period_start, period_end | do período corrente; **NULL quando `not is_current`** |
| progress_value | `coalesce(mp.value, 0)` |
| progress_pct | `greatest(least(round(progress_value / target_value * 100), 100), 0)::int` |
| is_completed | `mp.completed_at is not null` |
| completed_at | |
| seconds_remaining | `case when is_current then greatest(extract(epoch from least(per.period_end, m.ends_at) - now()), 0)::int end` — NULL quando `not is_current`; para missão futura o front conta a partir de `starts_at`/`ends_at` |
| spin_queue_status | `q.status` |

Filtros do front: Hoje = `kind in ('daily','lightning') and is_current`; Semana = `kind = 'weekly' and is_current`; Especiais = `kind = 'special' and is_current`. Preview do dashboard = Hoje, `limit 3`, ordem `is_completed asc, ends_at asc`.

### 5.7 `v_challenge_board` — um desafio por linha, participantes em jsonb
Fonte: `challenges c` LEFT JOIN LATERAL agregação de `challenge_participants cp` JOIN `profiles p` (+ `challenge_results` quando finalizado).

| coluna | lógica |
|---|---|
| challenge_id, season_id, name, description, kind, metric, target_value, reward_points, reward_coins, reward_spin, reward_description, starts_at, ends_at, status, winner_ids, activated_at, finished_at | de `challenges` |
| days_left | `greatest(ceil(extract(epoch from ends_at - now()) / 86400), 0)::int` |
| total_value | `sum(cp.current_value)` (ou `sum(cr.final_value)` se finished) |
| total_pct | `greatest(least(round(total_value / target_value * 100), 100), 0)::int` |
| participants_count | `count(cp)` |
| participants | `jsonb_agg(jsonb_build_object('profile_id', p.id, 'full_name', p.full_name, 'avatar_path', p.avatar_path, 'color', p.color, 'job_title', p.job_title, 'status', p.status, 'value', cp.current_value, 'pct', greatest(least(round(cp.current_value / c.target_value * 100), 100), 0), 'is_winner', p.id = any(c.winner_ids)) order by cp.current_value desc, p.full_name)` — `status` permite à UI sinalizar participante inativado (B.17) |

### 5.8 `v_achievement_board` — conquista × perfil ativo
Fonte: `achievements a` (`is_active and deleted_at is null`) CROSS JOIN `profiles p` (`status = 'active'` — sem pendentes/inativos) LEFT JOIN `profile_achievements pa` (última desbloqueada: `max(unlocked_at)`; `is_unlocked = exists`).
Colunas: `achievement_id, profile_id, code, title, description, icon, criteria, criteria_value, scope, reward_points, reward_coins, sort_order, is_unlocked (bool), unlocked_at, unlocked_count (int; >1 para season repetidas)`.

### 5.9 `v_wheel_queue` — fila ativa/esperando
Fonte: `wheel_queue q` JOIN `wheels w` LEFT JOIN `profiles p` LEFT JOIN `wheel_spins sp` ON (`sp.queue_id = q.id and sp.status = 'pending'`). Filtro `q.status in ('waiting','active')`.
Colunas: `queue_id, position (row_number() over (order by (status='active') desc, created_at)), profile_id, person_name, avatar_path, color, source, wheel_id, wheel_kind, wheel_name, attempts_allowed, attempts_used, attempts_remaining (allowed - used), status, released_at, created_at, pending_spin_id, pending_prize_label, pending_prize_kind, pending_resolved_label, pending_spun_at`.
As colunas `pending_*` funcionam para qualquer membro ativo porque a policy de SELECT em `wheel_spins` inclui `status = 'pending'` (o prêmio pendente da vez atual é público por natureza — aparece na TV da roleta); só spins `rejected` de terceiros ficam ocultos.

### 5.10 `v_wheel_history` — últimas aprovações
Fonte: `wheel_spins` (`status = 'approved'`) JOIN `wheels` LEFT JOIN `profiles` (dono) LEFT JOIN `profiles` (aprovador).
Colunas: `spin_id, queue_id, profile_id, person_name, avatar_path, color, wheel_kind, prize_label, prize_kind, prize_value, resolved_label, resolved_kind, resolved_value, credited, attempt_index, spun_at, approved_at, approved_by_name`. Front: `.order('approved_at', desc).limit(10)`.

### 5.11 `v_redemptions` — pedidos (admin vê todos; colaborador só os seus, por RLS)
Fonte: `reward_redemptions r` LEFT JOIN `rewards` LEFT JOIN `profiles` (dono) LEFT JOIN `profiles` (handled_by).
Colunas: `redemption_id, source, reward_id, reward_icon, reward_category, profile_id, person_name, avatar_path, title, cost_coins, value_amount, status, requested_at, handled_at, handled_by_name, notes, spin_id`.

### 5.12 `v_wallet` — **(ledger)** carteira por perfil (própria ou admin)
Fonte: `profile_lifetime_stats ls` JOIN `profiles` LEFT JOIN agregados de `point_entries` por `profile_id`.
Colunas: `profile_id, coins_balance, coins_earned, coins_spent (de ls), coins_from_sales (sum coins>0 where source='rule' and metric in ('sale','upsell')), coins_from_missions (source='mission'), coins_from_goals (metric in ('weekly_goal','monthly_goal','amount_step')), coins_from_wheel (source='wheel'), coins_from_challenges (source='challenge'), coins_from_achievements (source='achievement'), coins_from_manual (source in ('manual','system') and (metric is null or metric not in ('weekly_goal','monthly_goal','amount_step')))` — todas as somas consideram só `coins > 0`. "Últimos 3 créditos" = query direta: `point_entries.select('id, coins, reason, source, metric, occurred_at, rule:point_rules(name)').gt('coins', 0).order('occurred_at', desc).limit(3)` (RLS já filtra; o embed usa a FK `point_entries.rule_id` e a policy SELECT `member` de `point_rules`; título exibido = `reason ?? rule.name ?? rótulo de source`). `coins_balance` pode ser **negativo** (saldo devedor — Apêndice B.15: estorno de entry que deu moedas já gastas); a view não aplica `greatest(..., 0)` e o front mostra "Saldo devedor de N moedas" e desabilita a loja até o saldo cobrir o custo.

### 5.13 `v_point_entries_history` — **(ledger)** histórico de lançamentos
Fonte: `point_entries e` JOIN `profiles p` ON `e.profile_id` (`point_entries_profile_id_fkey`) LEFT JOIN `profiles c` ON `e.created_by` LEFT JOIN `point_rules r` LEFT JOIN `special_events ev` LEFT JOIN `point_entries rev` ON `rev.reverses_entry_id = e.id`.
Colunas: `entry_id, profile_id, full_name, avatar_path, color, season_id, source, metric, rule_id, rule_name, quantity, amount, base_points, multiplier, points, coins, reason, special_event_name, occurred_at, created_at, created_by, created_by_name, reverses_entry_id, reversed_by_entry_id (rev.id), is_reversed (rev.id is not null)`. Front: `.order('occurred_at', desc).order('created_at', desc).range(...)` com `{ count: 'exact' }`. Estornos aparecem com o `occurred_at` da entry original (data do fato) e `created_at` = quando foram estornados; a UI mostra "estornado em {created_at}" na linha do estorno.

### 5.14 `v_activity_feed`
Fonte: `feed_events f` LEFT JOIN `profiles p`.
Colunas: `id, kind, profile_id, full_name, avatar_path, color, job_title, season_id, payload, occurred_at`. Paginação por cursor: `.order('occurred_at', desc).order('id', desc).lt('occurred_at', cursor).limit(20)`. A frase pt-BR é montada no front a partir de `kind` + `payload`.

### 5.15 `v_seasons`
`seasons` + `is_current = (now() >= starts_at and now() < ends_at)` + `days_total`, `days_elapsed`, `days_left` (em dias locais, via `public.local_day`). Colunas: todas de `seasons` mais as três derivadas.

### 5.16 `v_special_events`
`special_events` (`deleted_at is null`) + `state = case when not is_active then 'inactive' when now() < starts_at then 'upcoming' when now() < ends_at then 'live' else 'ended' end`, `seconds_to_start`, `seconds_to_end`. Banner: `.in('state', ['upcoming','live']).order('starts_at').limit(1)`.

---

## 6. Funções auxiliares e funções de trigger

Todas `security definer set search_path = ''`, owner `postgres`. As de `public` marcadas com (auth) recebem `revoke execute from public, anon; grant execute to authenticated`; as de `private` recebem `revoke execute ... from public, anon, authenticated` (chamadas só por triggers/definer, que rodam como owner). **Nenhuma view ou RPC `security invoker` chama `private.*`** (§2.1) — teste (l) do harness confirma que `set local role authenticated` consegue `select * from v_mission_board`, `v_profile_stats`, `v_sales_timeline` e `v_seasons`.

### 6.1 Helpers de papel e tempo (`public`)

| função | assinatura | corpo |
|---|---|---|
| `is_active_member()` (auth) | `returns boolean language sql stable` | `select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active')` — **false** para `inactive` **e** para `pending` (§3); é o único gate de acesso |
| `is_admin()` (auth) | `returns boolean language sql stable` | `... and p.role = 'admin' and p.status = 'active'` |
| `active_season_id()` (auth) | `returns uuid language sql stable` | `select id from public.seasons where is_active limit 1` |
| `app_timezone()` (auth) | `returns text language sql stable` | `select timezone from public.app_settings where id = 1` |
| `local_day(ts timestamptz)` (auth) | `returns date language sql stable` | `(ts at time zone public.app_timezone())::date` — pura, sem escrita |
| `local_today()` (auth) | `returns date language sql stable` | `public.local_day(now())` |
| `iso_week_key(d date)` (auth) | `returns text language sql immutable` | `to_char(d, 'IYYY-"W"IW')` |
| `avatar_count(p_uid uuid)` (auth) | `returns int language sql stable security definer` | `select count(*) from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] = p_uid::text` — usada pela policy de INSERT do Storage (§11), que roda como o invocador e por isso não pode chamar `private.*`; pura, só conta objetos da pasta informada |
| `mission_period(p_kind mission_kind, p_ts timestamptz, p_starts timestamptz, p_ends timestamptz)` (auth) | `returns table (period_key text, period_start timestamptz, period_end timestamptz) stable` | daily: dia local de `p_ts` (`[day 00:00 local, +1 day)` ∩ `[p_starts, p_ends)`), key `yyyy-mm-dd`; weekly: semana ISO local ∩ janela, key `IYYY-Www`; special/lightning: `('once', p_starts, p_ends)`. Retorna 0 linhas se `p_ts` fora de `[p_starts, p_ends)` |

As cinco últimas são puras e moram em `public` porque são chamadas por views `security_invoker` ou por policies do Storage (`v_profile_stats`, `v_sales_timeline`, `v_mission_board`, `v_seasons`) e pelas RPCs invoker — `authenticated` não tem `USAGE` em `private` (§2.1).

Uso em policies sempre como `(select public.is_admin())` / `(select public.is_active_member())` (initplan, avaliado uma vez por statement).

### 6.2 Helpers de `private`

| função | assinatura | corpo / regra |
|---|---|---|
| `private.season_for(ts timestamptz)` | `returns uuid stable` | `select id from public.seasons where ts >= starts_at and ts < ends_at`; NULL se nenhuma |
| `private.counts_for_streak(e public.point_entries)` | `returns boolean stable` | critério único de "entrada de atividade" (§4.9): `e.reverses_entry_id is null and not exists (select 1 from public.point_entries r where r.reverses_entry_id = e.id) and (e.source = 'rule' or (e.source = 'manual' and e.points > 0))` — usado por `after_point_entry` (A), `recompute_streak` e `last_entry_at` |
| `private.grant_achievement(p_profile_id uuid, p_achievement_id uuid, p_season_id uuid, p_trigger_entry_id uuid, p_occurred_at timestamptz)` | `returns uuid` | `insert into profile_achievements ... on conflict do nothing returning id`; se inseriu e a conquista dá `reward_points/coins > 0` → entry `source='achievement'` (`occurred_at = p_occurred_at`, `reason = title`) gravada em `entry_id`; `push_feed('achievement')`; `notify`. Devolve o id inserido ou NULL (já desbloqueada). Usada por §6.7 B3/B3', §6.9 e `close_season` |
| `private.assert_wheel_prizes(p_wheel_id uuid)` | `returns void` | se a roleta está `is_active`: ≥ 2 prêmios ativos não deletados senão `MIN_PRIZES`; ≥ 1 ativo fora de `mystery`/`extra_spin` senão `MYSTERY_NEEDS_POOL`. Núcleo compartilhado pelos constraint triggers de `wheel_prizes` e `wheels` |
| `private.challenge_value(p_metric challenge_metric, p_entry public.point_entries)` | `returns numeric immutable` | delta que a entry soma no desafio (regras da §4.18); 0 se não se aplica |
| `private.rand_below(p_n bigint)` | `returns bigint volatile` | `(('x' || encode(extensions.gen_random_bytes(8), 'hex'))::bit(64)::bigint & 9223372036854775807) % p_n` — CSPRNG do pgcrypto, uniforme o bastante para pesos ≤ 1000·prêmios |
| `private.draw_prize(p_wheel_id uuid, p_exclude_kinds prize_kind[])` | `returns table (prize public.wheel_prizes, random_value bigint) volatile` | soma `weight` dos prêmios ativos não excluídos ordenados por `sort_order`; **soma = 0 → RAISE `NO_PRIZES`** (nunca chega a `rand_below(0)`, que dividiria por zero); `r = rand_below(total)`; varredura cumulativa; retorna o prêmio cujo intervalo contém `r` |
| `private.prizes_hash(p_wheel_id uuid)` | `returns text stable` | ver §4.22 |
| `private.notify(p_profile_id uuid, p_kind notification_kind, p_title text, p_message text, p_payload jsonb default '{}')` | `returns void` | insere em `notifications` se o perfil está **ativo** (`status = 'active'` — pendente e inativo não recebem nada) e `preferences->>'notifications' is distinct from 'false'` (e, para `kind='event'`, `event_alerts` também) |
| `private.notify_all(p_kind, p_title, p_message, p_payload, p_exclude uuid default null)` | `returns void` | fan-out: uma chamada de `notify` por perfil ativo (exceto `p_exclude`) |
| `private.notify_admins(p_kind notification_kind, p_title text, p_message text, p_payload jsonb default '{}')` | `returns void` | fan-out: uma chamada de `notify` por perfil `role = 'admin' and status = 'active'`. Usada por `handle_new_user` ("Novo membro aguardando aprovação", §6.4) e por `redeem_reward` ("Novo pedido de resgate", §7.7) |
| `private.assert_active_member()` | `returns void` | checagem de chamador das RPCs de membro (§7): se `not public.is_active_member()` → lê `status` da própria linha de `profiles` (owner, sem RLS) e RAISE `PROFILE_PENDING` (errcode `42501`) quando `status = 'pending'`, senão `PROFILE_INACTIVE` (`42501`); sem linha → `PROFILE_NOT_FOUND`. O front distingue os dois só para escolher a mensagem da tela `/aguardando` (FRONTEND-ARCH §3.3) |
| `private.push_feed(p_kind feed_kind, p_profile_id uuid, p_season_id uuid, p_payload jsonb, p_dedupe_key text, p_occurred_at timestamptz default now())` | `returns void` | `insert into feed_events ... on conflict (dedupe_key) do nothing` |
| `private.audit(p_action audit_action, p_table text, p_row_id text, p_old jsonb, p_new jsonb)` | `returns void` | insere em `audit_log` com `actor_id = auth.uid()` |
| `private.lock_profile(p_profile_id uuid, p_scope text)` | `returns void` | `perform pg_advisory_xact_lock(hashtext(p_scope || ':' || p_profile_id::text))` — scopes: `wallet`, `progress` |
| `private.recompute_streak(p_profile_id uuid)` | `returns void` | dias distintos = `select distinct public.local_day(e.occurred_at) from point_entries e where e.profile_id = $1 and private.counts_for_streak(e)`; ilhas por `d - row_number()`; grava `streak_days`/`streak_last_day` da ilha mais recente (NULL/0 se não há dias) e `best_streak_days = max(ilhas)` |
| `private.insert_entry(...)` | `returns public.point_entries` | wrapper interno usado por triggers/RPCs para inserir no ledger com `created_by` explícito (o `stamp_actor` mantém o valor quando `auth.uid()` é NULL ou quando `current_setting('app.actor', true)` está definido) |

### 6.3 Funções de trigger genéricas (`private`)

| função | evento | lógica |
|---|---|---|
| `set_updated_at()` | BEFORE UPDATE | `NEW.updated_at := now()`; se a tabela tem `updated_by`, `NEW.updated_by := coalesce(auth.uid(), NEW.updated_by)` |
| `stamp_actor()` | BEFORE INSERT | `NEW.created_by := coalesce(auth.uid(), NEW.created_by)` (o valor vindo do front é sobrescrito quando há sessão) |
| `audit_row()` | AFTER INSERT/UPDATE | grava `audit_log` com `old_data`/`new_data` (`to_jsonb`), mascarando `team_code` (`'********' || right(code, 4)`); em `profiles` só dispara quando `role`, `status`, `job_title` ou `team` mudam (`WHEN (OLD.role, OLD.status, OLD.job_title, OLD.team) IS DISTINCT FROM (NEW.role, NEW.status, NEW.job_title, NEW.team)`) |
| `forbid_ledger_mutation()` | BEFORE UPDATE OR DELETE em `point_entries` | `raise exception using message = 'LEDGER_IMMUTABLE', detail = 'Lançamentos não podem ser alterados nem apagados; use um estorno.', errcode = '42501'` |
| `validate_timezone()` | BEFORE INSERT/UPDATE em `app_settings` | `perform now() at time zone NEW.timezone` dentro de `begin ... exception when others then raise 'INVALID_TIMEZONE'`; em UPDATE, se `NEW.timezone is distinct from OLD.timezone and exists (select 1 from public.point_entries)` → RAISE `TIMEZONE_LOCKED` (detail: "O fuso só pode ser alterado antes do primeiro lançamento.") — `streak_last_day`, `period_key` de missões diárias/semanais, chaves `YYYY-Www` e as meia-noites de `seasons` foram calculadas no fuso antigo (Apêndice B.18) |
| `protect_app_secrets()` | BEFORE UPDATE em `app_secrets` | `bootstrap_done` não pode voltar a false (`BOOTSTRAP_LOCKED`); `team_code` só muda via `rotate_team_code` (`current_setting('app.rpc', true) = 'on'`), senão `TEAM_CODE_VIA_RPC_ONLY` |

### 6.4 `private.handle_new_user()` — AFTER INSERT em `auth.users`
```
1. perform pg_advisory_xact_lock(hashtext('bootstrap_admin'));
2. v_name := left(trim(coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1))), 80); se vazio → NEW.email.
3. v_code := upper(trim(NEW.raw_user_meta_data->>'team_code'));   -- NULL continua NULL
4. select * into strict v_secrets from public.app_secrets where id = 1;
     exception when no_data_found → raise 'BOOTSTRAP_NOT_CONFIGURED' (detail 'Instalação incompleta: aplique o schema.sql por inteiro.')  -- aborta o signup
     -- sem STRICT, v_secrets NULL faria todos os testes abaixo virarem NULL e qualquer código entraria como colaborador
5. v_admin_exists := exists (select 1 from public.profiles where role = 'admin');
6. SE not v_admin_exists AND not v_secrets.bootstrap_done:                      -- ramo "primeiro admin"
     SE v_secrets.bootstrap_email is not null AND lower(NEW.email) is distinct from v_secrets.bootstrap_email
        → raise 'BOOTSTRAP_EMAIL_MISMATCH' (detail 'Este e-mail não está autorizado a criar a instalação.')  -- aborta
     SE v_secrets.bootstrap_email is not null AND NEW.email_confirmed_at is null
        → raise 'BOOTSTRAP_REQUIRES_CONFIRMED_EMAIL' (detail 'O primeiro gestor precisa ser criado pelo painel do Supabase (usuário já confirmado).')  -- aborta
     v_role := 'admin'; update public.app_secrets set bootstrap_done = true, updated_at = now() where id = 1;
   SENÃO:                                                                        -- ramo "colaborador"
     SE v_code is null OR v_code is distinct from v_secrets.team_code
        → raise 'INVALID_TEAM_CODE' (detail 'Código da equipe inválido.', errcode 'P0001')  -- aborta o signup
     v_role := 'collaborator';
7. v_status := case when v_role = 'admin' then 'active'
                 when (select auto_approve_members from public.app_settings where id = 1) then 'active'
                 else 'pending' end;          -- Apêndice B.21: colaborador nasce pendente salvo auto-aprovação
   insert into public.profiles (id, full_name, role, status) values (NEW.id, v_name, v_role, v_status);
8. insert into public.profile_private (profile_id, email) values (NEW.id, lower(NEW.email));
9. insert into public.profile_lifetime_stats (profile_id) values (NEW.id);
10. v_season := public.active_season_id(); se não nulo: insert into public.season_goals (season_id, profile_id, goal_amount) values (v_season, NEW.id, 0) on conflict do nothing;
11. se v_role = 'collaborator' AND v_status = 'pending':
      perform private.notify_admins('system', 'Novo membro aguardando aprovação', v_name || ' se cadastrou com o código da equipe e aguarda sua aprovação.', jsonb_build_object('profile_id', NEW.id, 'action', 'approve_member'));
    se v_role = 'collaborator' AND v_status = 'active' (auto-aprovação ligada):
      perform private.notify_all('system', 'Novo membro', v_name || ' entrou na equipe.', jsonb_build_object('profile_id', NEW.id), NEW.id);
    -- o pendente não recebe notificação nenhuma (notify ignora perfis não ativos); a "Novo membro entrou" para o time sai na aprovação (§7.2)
12. return NEW;
```
Lê **apenas** `full_name` e `team_code` da metadata (nunca `role`/`status` — o status vem exclusivamente de `app_settings.auto_approve_members`, lido dentro do trigger como owner). Com *Confirm email* ligado, o pendente só consegue sequer fazer login depois de confirmar o e-mail; com *Confirm email* desligado ele faz login na hora, mas cai na tela "aguardando aprovação" e não lê nada (§16.2). Grants: `revoke execute on function private.handle_new_user() from public, anon, authenticated; grant execute ... to supabase_auth_admin;` (o trigger em `auth.users` roda como `supabase_auth_admin`). Trigger: `create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();`. Nenhum trigger em UPDATE de `auth.users` (metadata nunca sincroniza para `profiles`). Após o cadastro o front chama `updateUser({ data: { team_code: null } })` — obrigatório; se falhar, o front repete na próxima chamada de bootstrap enquanto `user_metadata.team_code` existir (§14.1 passo 6).

Janela de bootstrap (Apêndice D, item 1): o trigger roda no INSERT de `auth.users`, **antes** de qualquer confirmação de e-mail; com *Confirm email* ligado o primeiro cadastrante viraria admin sem nem confirmar. Por isso: (a) o primeiro admin é criado pelo implantador **antes** de publicar a URL, via Dashboard → Authentication → Users → *Add user* → *Create new user* com *Auto confirm* (§16.1) — esse caminho chega ao trigger sem `team_code`, cai no ramo "primeiro admin" e passa; (b) `bootstrap_email`, quando preenchido, exige `email_confirmed_at` já preenchido no INSERT — o Dashboard/Admin API (`email_confirm: true`) gravam a linha já confirmada, enquanto `auth.signUp` público chega sem confirmação (ou, com *Confirm email* desligado, é confirmado por UPDATE posterior) e é abortado; logo `bootstrap_email` só faz sentido junto com o caminho do Dashboard; (c) após o primeiro admin, `bootstrap_done = true` fecha o ramo para sempre (`BOOTSTRAP_LOCKED`); a recuperação de um bootstrap tomado está em §16.4.
Usuário criado pelo modal "Create new user" do dashboard **depois** do bootstrap chega sem `team_code` → cai em `INVALID_TEAM_CODE` (decisão registrada no research: colaboradores só entram pela tela com código).

### 6.5 `private.protect_profile_columns()` — BEFORE UPDATE em `profiles`
```
v_is_admin := public.is_admin();
SE not v_is_admin:
   SE (NEW.role, NEW.status, NEW.job_title, NEW.team) IS DISTINCT FROM (OLD.role, OLD.status, OLD.job_title, OLD.team) → raise 'FORBIDDEN_COLUMN'
   SE NEW.avatar_path is not null AND NEW.avatar_path !~ ('^' || OLD.id::text || '/') → raise 'INVALID_AVATAR_PATH'
SE (NEW.role <> 'admin' OR NEW.status <> 'active') AND OLD.role = 'admin' AND OLD.status = 'active'
   AND (select count(*) from public.profiles where role='admin' and status='active' and id <> OLD.id) = 0 → raise 'LAST_ADMIN'
return NEW
```
(`pg_trigger_depth()` não é usado como bypass — `admin_update_profile` roda como admin, então passa pela regra normalmente; `LAST_ADMIN` vale para todos.)

### 6.6 `private.before_point_entry()` — BEFORE INSERT em `point_entries` (o coração do ledger)
```
1. NEW.created_by := coalesce(auth.uid(), NEW.created_by).
2. SE NEW.reverses_entry_id is not null (estorno):
     select * into strict v_orig from public.point_entries where id = NEW.reverses_entry_id;   -- no_data_found → 'ENTRY_NOT_FOUND'
     se v_orig.profile_id is distinct from NEW.profile_id → 'REVERSAL_MISMATCH';
     NEW.occurred_at := v_orig.occurred_at;      -- estorno herda a DATA DO FATO (§1.12); created_at registra quando foi estornado
     NEW.season_id := v_orig.season_id;          -- coerente com occurred_at herdado; explícito para não depender de season_for após um clamp de ends_at
     NEW.points := -v_orig.points; NEW.coins := -v_orig.coins; NEW.amount := case when v_orig.amount is null then null else -v_orig.amount end;
     NEW.metric := v_orig.metric; NEW.quantity := v_orig.quantity; NEW.base_points := -v_orig.base_points; NEW.multiplier := 1;
     NEW.rule_id := v_orig.rule_id; NEW.special_event_id := null; NEW.boost_id := null;
   SENÃO:
     NEW.season_id := private.season_for(NEW.occurred_at); se NULL → raise 'NO_SEASON_FOR_DATE'.
3. select closed_at into v_closed from public.seasons where id = NEW.season_id;
   se v_closed is not null AND NEW.reverses_entry_id is null AND current_setting('app.allow_closed', true) is distinct from 'on' → raise 'SEASON_CLOSED'.
3b. SE NEW.coins < 0 (já resolvido no passo 2 para estorno; para as demais sources o valor recebido) → perform private.lock_profile(NEW.profile_id, 'wallet');
   -- todo débito de moedas (resgate, estorno de moedas, ajuste manual negativo) serializa com redeem_reward; ordem de locks sempre wallet → progress (§6.7), sem deadlock
4. SE NEW.reverses_entry_id is null AND NEW.source = 'rule':
     select * into v_rule from public.point_rules where id = NEW.rule_id and deleted_at is null; se não achou → 'RULE_NOT_FOUND'; se not is_active → 'RULE_INACTIVE'.
     NEW.metric := v_rule.metric;
     NEW.base_points := v_rule.points * NEW.quantity;
     NEW.coins := v_rule.coins * NEW.quantity;
     se v_rule.requires_amount and (NEW.amount is null or NEW.amount <= 0) → 'AMOUNT_REQUIRED'.
     -- multiplicador por occurred_at
     v_event := select id, multiplier from public.special_events where is_active and deleted_at is null and NEW.occurred_at >= starts_at and NEW.occurred_at < ends_at;
     v_boost := select id, multiplier from public.profile_boosts where profile_id = NEW.profile_id and NEW.occurred_at >= starts_at and NEW.occurred_at < expires_at order by multiplier desc limit 1;
     NEW.multiplier := greatest(1, coalesce(v_event.multiplier,1), coalesce(v_boost.multiplier,1));
     NEW.special_event_id := case when v_event.multiplier >= coalesce(v_boost.multiplier,0) then v_event.id end;
     NEW.boost_id := case when coalesce(v_boost.multiplier,0) > coalesce(v_event.multiplier,0) then v_boost.id end;
     NEW.points := round(NEW.base_points * NEW.multiplier);
   SENÃO SE NEW.reverses_entry_id is null:
     NEW.multiplier := 1; NEW.special_event_id := null; NEW.boost_id := null;
     NEW.base_points := coalesce(NEW.base_points, NEW.points); NEW.points := NEW.base_points;
5. return NEW.
```
Consequências do estorno com data herdada: missão (B2) e desafio (C) enxergam o delta negativo **no mesmo período** do fato (venda de segunda estornada na terça reduz o progresso de segunda, não cria -1 na terça); `v_sales_timeline` subtrai no dia certo; estorno de fato anterior à janela de um desafio não subtrai nada dele; `SEASON_CLOSED` continua liberado para estornos; o CK `occurred_at <= now() + 5 min` é satisfeito trivialmente.

### 6.7 `private.after_point_entry()` — AFTER INSERT em `point_entries`
Fusível: `if pg_trigger_depth() > 4 then raise 'TRIGGER_DEPTH'`. Lock: `private.lock_profile(NEW.profile_id, 'progress')`. Passos, na ordem:

**A. Stats (todas as sources).**
- `insert into profile_season_stats (profile_id, season_id) ... on conflict do nothing`; depois `update` somando: `points += NEW.points`; `points_updated_at = case when NEW.points > 0 and NEW.reverses_entry_id is null then greatest(coalesce(points_updated_at, NEW.occurred_at), NEW.occurred_at) else points_updated_at end` (estorno e ajuste negativo não mexem no desempate; retroativa usa `occurred_at`); contadores "brutos" (`points_earned`, `coins_earned`, `coins_spent`) tratam estorno como **desfazimento**: se `NEW.reverses_entry_id is null` → `points_earned += greatest(NEW.points,0)`, `coins_earned += greatest(NEW.coins,0)`, `coins_spent += greatest(-NEW.coins,0)`; senão (estorno) → `points_earned -= greatest(orig.points,0)`, `coins_earned -= greatest(orig.coins,0)`, `coins_spent -= greatest(-orig.coins,0)`; se `source in ('rule','manual','system')`: `v_sign := sign(NEW.points)` (se `points = 0` então `v_sign := case when NEW.reverses_entry_id is null then 1 else -1 end`); `sales_amount += coalesce(NEW.amount,0)` quando `metric in ('sale','upsell')`; contadores por métrica `+= NEW.quantity * v_sign`; `activities_count` conforme §4.8; `last_entry_at = greatest(last_entry_at, NEW.occurred_at)` se `private.counts_for_streak(NEW)`.
- `profile_lifetime_stats`: `coins_earned/coins_spent` idem; `sales_amount/sales_count` idem; `first_sale_at = coalesce(first_sale_at, NEW.occurred_at)` quando venda positiva; streak conforme §4.9 quando `private.counts_for_streak(NEW)`; **se `v_is_reversal` e `private.counts_for_streak(orig)` era verdadeiro antes deste estorno** (i.e., `orig.source = 'rule' or (orig.source = 'manual' and orig.points > 0)`) → `perform private.recompute_streak(NEW.profile_id)` (a original deixa de contar; sem isso o streak nunca decrementaria porque o estorno tem `points < 0` e a original mantém `points > 0`).

**B. Se `NEW.source in ('rule','manual','system')`** (`v_is_reversal := NEW.reverses_entry_id is not null`; `orig` = linha apontada por `reverses_entry_id`, também usada em A):
- B1. **Marcos automáticos** (só se `not v_is_reversal`, `source = 'rule'`, `metric in ('sale','upsell')`, `amount > 0`):
  - `auto_amount_step`: para a regra ativa desse tipo, `v_blocks := floor(season.sales_amount / amount_step)`; para `k` de 1..v_blocks: se não existe `milestone_awards (profile_id, season_id, 'amount_step', 'block:'||k)` → insere a entry de recompensa (`private.insert_entry(source='system', metric='amount_step', base_points=rule.points, coins=rule.coins, reason='Bônus: R$ '||amount_step||' vendidos (bloco '||k||')', occurred_at=NEW.occurred_at, created_by=NEW.created_by)`) e em seguida `insert into milestone_awards (...) values (..., v_entry.id)`. O advisory lock `progress:<profile>` obtido no início do trigger serializa duas entries do mesmo perfil, portanto o "verifica e insere" é seguro; a PK de `milestone_awards` é a rede final (uma `unique_violation` aqui indica bug e deve propagar).
  - `auto_goal` (metric `monthly_goal`): `perform private.evaluate_goal_milestone(NEW.profile_id, NEW.season_id, NEW.occurred_at)` (§6.9) — a mesma função é chamada quando a meta muda (`admin_update_profile`, trigger em `season_goals`), em `activate_season` e em `close_season`, para que quem bate a meta por redução/definição tardia receba exatamente o mesmo marco (+500/+500) e a mesma conquista META BATIDA de quem bateu "ao vivo".
- B2. **Missões**: para cada missão `is_active and deleted_at is null and metric = NEW.metric and season_id = NEW.season_id and NEW.occurred_at in [starts_at, ends_at)` em que o perfil é elegível: `period := public.mission_period(...)`; `v_delta := case target_kind when 'count' then NEW.quantity * v_sign else coalesce(NEW.amount,0) end`; `insert into mission_progress ... on conflict (mission_id, profile_id, period_key) do update set value = mission_progress.value + excluded.value` (estorno entra com delta negativo e só reduz `value`); depois, **apenas se `not v_is_reversal`**, `update mission_progress set completed_at = now() where ... and completed_at is null and value >= target_value returning *` → se retornou: entry `source='mission'` (`base_points=reward_points`, `coins=reward_coins`, `reason=title`, `occurred_at=NEW.occurred_at`) se `reward_points > 0 or reward_coins > 0`; se `reward_spin`: `insert into wheel_queue (profile_id, person_name, wheel_id, source, reference_kind, reference_id) values (..., 'earned', 'mission_progress', mission_id||':'||profile_id||':'||period_key) on conflict do nothing returning id` → `mission_progress.queue_id`; `profile_season_stats.missions_completed += 1`; `lifetime.missions_completed += 1`; `push_feed('mission_completed', ...)`; `notify(profile, 'mission', 'Missão concluída', title)`.
- B3. **Conquistas de atividade** (só se `not v_is_reversal`; `achievements` ativas, não desbloqueadas para o escopo): avalia `first_sale`, `streak_days`, `sales_total` com os números de A (`monthly_goal` é concedida dentro de `evaluate_goal_milestone`, §6.9). Para cada verdadeira: `private.grant_achievement(profile, achievement, season_id, NEW.id, NEW.occurred_at)` = `insert into profile_achievements (profile_id, achievement_id, season_id, trigger_entry_id) on conflict do nothing returning id` → se inseriu e `reward_points > 0 or reward_coins > 0`: entry `source='achievement'` (`occurred_at = NEW.occurred_at`) e grava `entry_id`; `push_feed('achievement', ...)`; `notify(profile, 'achievement', 'Conquista desbloqueada', title)`.
- B4. **Feed de venda**: se `not v_is_reversal and source='rule' and metric='sale' and amount > 0` → `push_feed('sale', profile, season, {amount}, 'sale:'||NEW.id, NEW.occurred_at)`.

**B3'. Conquistas de acúmulo (toda source exceto `reward`, `NEW.points > 0`, `not v_is_reversal`):** avalia `points_total` e `missions_completed` (scope season com `ss.points`/`ss.missions_completed`; lifetime com os vitalícios) e concede via `grant_achievement`. Fica fora do ramo B porque quem cruza o limiar com pontos de roleta, desafio, missão ou conquista desbloquearia só no próximo lançamento de regra — e nunca, se a temporada fechasse antes. A entry `achievement` gerada também passa por B3' (idempotente pelo `on conflict do nothing`; o fusível `pg_trigger_depth()` continua valendo).

**C. Desafios ativos (todas as sources exceto `reward`, inclusive estornos):** para cada `challenges c` com `status='active'`, perfil participante, `c.season_id = NEW.season_id`, `NEW.occurred_at in [c.starts_at, c.ends_at)`: `update challenge_participants set current_value = current_value + private.challenge_value(c.metric, NEW) where ...` (`challenge_value` já devolve delta negativo para estornos; `metric = 'points'` soma também entries de `mission`/`wheel`/`achievement`/`challenge`).

**D. Level-up (todas as sources, `NEW.points > 0`):** `v_before := greatest(points_after - NEW.points, 0) / xp; v_after := greatest(points_after,0) / xp` (xp = `seasons.xp_per_level`); para cada nível `L` em `v_before+1 .. v_after`: `push_feed('level_up', profile, season, {from_level: L-1, to_level: L}, 'level_up:'||profile||':'||season||':'||L)`; `notify(profile, 'level', 'Você subiu de nível!', 'Nível '||v_after)` uma vez.

**E. Notificação de estorno:** se `NEW.reverses_entry_id is not null` → `notify(profile, 'system', 'Lançamento estornado', coalesce(NEW.reason,''))`. Notificação de lançamento manual negativo: `notify(profile, 'system', 'Ajuste de pontos', reason)`.

### 6.8 Outras funções de trigger (`private`)
| função | tabela / evento | lógica |
|---|---|---|
| `validate_mission_window()` | missions BEFORE INSERT/UPDATE | `NEW.season_id := private.season_for(NEW.starts_at)`; NULL → `NO_SEASON_FOR_DATE`; `NEW.ends_at > season.ends_at` → `MISSION_WINDOW_INVALID`; `kind='lightning' and ends_at - starts_at > interval '24 hours'` → `LIGHTNING_TOO_LONG` |
| `validate_challenge_window()` | challenges BEFORE INSERT/UPDATE | idem com `CHALLENGE_WINDOW_INVALID` |
| `protect_challenge_status()` | challenges BEFORE UPDATE | `NEW.status <> OLD.status and current_setting('app.rpc', true) is distinct from 'on'` → `STATUS_VIA_RPC_ONLY`; `OLD.status in ('finished','cancelled') and NEW.status <> OLD.status` → `CHALLENGE_FINAL` |
| `protect_challenge_participants()` | challenge_participants BEFORE INSERT/DELETE | status ≠ draft → `CHALLENGE_NOT_DRAFT`; duelo com 2 → `DUEL_NEEDS_TWO` |
| `check_challenge_cardinality()` | constraint trigger DEFERRABLE INITIALLY DEFERRED em challenge_participants (AFTER INSERT/DELETE) e challenges (AFTER UPDATE OF status) | para cada desafio afetado com `status='active'`: duelo ⇒ exatamente 2 participantes ativos e distintos (`DUEL_NEEDS_TWO`); coletivo ⇒ ≥ 2 (`TEAM_NEEDS_TWO`) |
| `check_wheel_min_prizes()` | constraint trigger DEFERRABLE INITIALLY DEFERRED em wheel_prizes AFTER INSERT/UPDATE/DELETE | `private.assert_wheel_prizes(coalesce(NEW.wheel_id, OLD.wheel_id))` → `MIN_PRIZES`, `MYSTERY_NEEDS_POOL` (§4.22) |
| `check_wheel_prizes_on_wheel()` | constraint trigger DEFERRABLE INITIALLY DEFERRED em wheels AFTER UPDATE OF is_active | `private.assert_wheel_prizes(NEW.id)` — reativar exige prêmios (§4.21) |
| `protect_wheel_deactivation()` | wheels BEFORE UPDATE OF is_active | `NEW.is_active = false and OLD.is_active` com fila `waiting`/`active`, missão vigente ou desafio `draft`/`active` apontando para `kind` → `WHEEL_IN_USE` (§4.21) |
| `on_goal_amount_changed()` | season_goals AFTER UPDATE OF goal_amount | `perform private.evaluate_goal_milestone(NEW.profile_id, NEW.season_id, now())` (§6.9) |
| `block_prize_change_with_pending_spin()` | wheel_prizes BEFORE UPDATE/DELETE | `SPIN_PENDING` se há spin pendente na roleta |
| `notify_special_event()` | special_events AFTER INSERT / AFTER UPDATE OF is_active | quando `is_active` e `ends_at > now()`: `notify_all('event', name, 'Multiplicador x'||multiplier||' de '||starts local||' a '||ends local)`; `push_feed` não (evento não é ação de pessoa) |

### 6.9 `private.evaluate_goal_milestone(p_profile_id uuid, p_season_id uuid, p_occurred_at timestamptz)` — marco "Meta mensal" + conquista META BATIDA num só lugar
```
1. select * into strict v_season from public.seasons where id = p_season_id;  -- no_data_found → SEASON_NOT_FOUND
   se v_season.closed_at is not null → return (close_season já tratou; não se cria entry em temporada fechada);
   se now() < v_season.starts_at → return (temporada futura: avalia quando começar/ativar).
2. perform private.lock_profile(p_profile_id, 'progress');   -- re-entrante quando chamada de dentro de after_point_entry
3. v_goal := season_goals.goal_amount (profile, season); v_sales := profile_season_stats.sales_amount (coalesce 0);
   se v_goal is null or v_goal <= 0 or v_sales < v_goal → return.
4. v_rule := regra ativa `trigger_kind = 'auto_goal'` (deleted_at is null); se existe e não existe `milestone_awards (p_profile_id, p_season_id, 'monthly_goal', 'season')`:
     v_ts := least(p_occurred_at, v_season.ends_at - interval '1 second');
     entry := private.insert_entry(source='system', metric='monthly_goal', base_points=v_rule.points, coins=v_rule.coins, reason='Meta mensal batida', occurred_at=v_ts, created_by=coalesce(auth.uid(), null));
     insert into milestone_awards (p_profile_id, p_season_id, 'monthly_goal', 'season', entry.id);
     notify(profile, 'achievement', 'Meta batida!', 'Você bateu sua meta da temporada.').
5. Conquista `criteria = 'monthly_goal'` (scope season) ativa: `private.grant_achievement(p_profile_id, a.id, p_season_id, entry.id | null, v_ts)` (idempotente — índice único parcial por temporada).
```
Chamada por: B1 (`after_point_entry`, com `NEW.occurred_at`), `admin_update_profile` quando `goal_amount` muda, trigger `season_goals_goal_milestone` (edição direta), `activate_season` (para cada perfil ativo, após completar `season_goals`) e `close_season` passo 6 (substitui o antigo "conquista `monthly_goal` para quem tem `goal_reached`" — agora quem bate a meta no fechamento recebe marco **e** conquista, igual a quem bateu ao vivo). Sem a regra `auto_goal` ativa, só a conquista é concedida.

---

## 7. RPCs (funções expostas em `public`)

Padrão: `language plpgsql security definer set search_path = ''` (as `security invoker` também levam `set search_path = ''`), `revoke execute from public, anon`, `grant execute to authenticated`. Primeira linha = checagem de papel **que não dependa da linha-alvo**; quando a checagem depende da linha (ex.: "admin ou dono da vez"), a RPC primeiro carrega a linha com `select ... into strict ... for update` e levanta `<OBJETO>_NOT_FOUND` (`QUEUE_NOT_FOUND`, `SPIN_NOT_FOUND`, `REDEMPTION_NOT_FOUND`, `ENTRY_NOT_FOUND`, `REWARD_UNAVAILABLE`, `SEASON_NOT_FOUND`, `CHALLENGE_NOT_FOUND`, `MISSION_NOT_FOUND`, `PROFILE_NOT_FOUND`) — com uuid inexistente, `NULL = auth.uid()` é NULL, `not (is_admin() or NULL)` não dispara e a função morreria num erro cru mais adiante, vazando estrutura interna. Comparações usam `is distinct from`. Teste (m) do harness chama cada RPC com uuid inexistente e espera o código `*_NOT_FOUND`. Parâmetros de perfil-alvo só existem em RPCs de admin; RPCs de colaborador usam `auth.uid()` internamente. Checagem de chamador nas RPCs de membro (`spin_wheel`, `spin_wheel_free`, `redeem_reward`, `mark_notifications_read`, `get_dashboard`): `perform private.assert_active_member()` (§6.2) — `PROFILE_PENDING` para quem está aguardando aprovação, `PROFILE_INACTIVE` para inativo; nas RPCs de admin `NOT_ADMIN` cobre os dois (`is_admin()` exige `status = 'active'`). Checagens de perfil-**alvo** (`record_*`, `enqueue_wheel`, `release_turn`, `approve_spin`, `activate_challenge`) exigem `status = 'active'` e levantam `PROFILE_INACTIVE`/`PARTICIPANT_INACTIVE` também para pendentes — o gestor nunca lança nada para quem ainda não foi aprovado. RPCs que mudam status fazem `perform set_config('app.rpc', 'on', true)` (escopo da transação) para passar pelos triggers de proteção. Toda RPC de escrita relevante grava `private.audit('rpc', '<nome>', row_id, null, jsonb dos parâmetros)`.

Retornos `jsonb` têm o schema descrito; retornos `setof <tabela>`/`<tabela>` são tipados automaticamente pelo `gen types`.

### 7.1 Cadastro e sessão

**`signup_mode() returns text`** — `security definer stable`; `grant execute to anon, authenticated`.
Retorna `'first_admin'` se `not exists (select 1 from profiles where role = 'admin')` e `app_secrets.bootstrap_done = false`; senão `'team_code'`. Não revela nada além do modo.

**`validate_team_code(p_code text) returns boolean`** — `security definer stable`; `grant execute to anon, authenticated`.
`return coalesce((select upper(trim(p_code)) = team_code from public.app_secrets where id = 1), false)` — devolve **só** boolean, nunca NULL (sem a linha `id = 1` a resposta é `false`, não NULL). Não grava nada e não faz throttle (§4.32 — a tabela de tentativas foi removida): é conveniência de UX para a tela de cadastro mostrar "Código inválido" antes de criar o usuário; a validação que vale é a do trigger `handle_new_user`, e o limite real de tentativas é o rate limit de cadastro do GoTrue por IP. O front chama antes de `auth.signUp` e normaliza `team_code` para maiúsculas antes de enviar na metadata; se a RPC falhar por rede, o front **ainda** permite o `signUp` (o trigger decide).

**`get_bootstrap() returns jsonb`** — `security invoker stable set search_path = ''`; exige sessão (`auth.uid() is not null`, senão `NOT_AUTHENTICATED`).
1. `select id, status, full_name into v_me from public.profiles where id = auth.uid()` — funciona para inativo e pendente porque a policy de SELECT de `profiles` é `member or id = me` (§10); não achou → `PROFILE_NOT_FOUND` (usuário sem perfil: o front faz `signOut()` com "Cadastro incompleto").
2. Se `v_me.status <> 'active'` retorna `{"me": {"id": ..., "status": "inactive" | "pending", "full_name": ...}}` e nada mais (não toca em nenhuma view — todas exigem `member`); o front leva para `/aguardando`: com `pending` mostra "Seu cadastro está aguardando aprovação do gestor" (com botão "Verificar novamente" que refaz o bootstrap) e com `inactive` mostra "Seu acesso foi desativado" e faz `signOut()`. Senão:
```json
{
  "me": { "id","full_name","avatar_path","color","job_title","team","role","status","preferences",
          "email","phone","goal_amount","points","points_earned","level","xp_in_level","xp_to_next","xp_per_level",
          "rank","gap_to_above","streak_days","coins_balance","sales_amount","sales_count","meetings_held",
          "conversion_pct","missions_completed","achievements_unlocked","pending_earned_spins" },
  "season": { "id","name","starts_at","ends_at","team_goal_amount","xp_per_level","is_active","days_left" } | null,
  "settings": { "company_name","xp_per_level","currency","timezone","target_conversion_pct","target_attendance_pct","target_crm_pct","target_activities_count","rank_admins" },
  "unread_notifications": 0,
  "pending_members": 0,
  "wheel": { "active_queue_id": uuid|null, "active_person_name": text|null, "pending_spin_id": uuid|null, "my_turn": bool },
  "active_event": { "id","name","multiplier","starts_at","ends_at","state" } | null
}
```
`me.*` vem de `v_profile_stats` para a temporada ativa (ou só de `profiles`/`profile_private`/`profile_lifetime_stats` quando não há temporada — campos de temporada saem 0/null). `pending_members` = `count(*) from profiles where status = 'pending'` **só quando o chamador é admin** (badge "Pendentes" na sidebar/Equipe); para colaborador é sempre `0` (a função é invoker e a policy de `profiles` já esconde os pendentes de quem não é admin — o valor não é calculado, é fixo).

**`get_dashboard(p_profile_id uuid default null, p_season_id uuid default null) returns jsonb`** — `security invoker stable set search_path = ''`.
`v_profile := coalesce(p_profile_id, auth.uid())`; se `v_profile <> auth.uid() and not is_admin()` → `NOT_ADMIN`. `v_season := coalesce(p_season_id, active_season_id())`; NULL → retorna `{"season": null}`.
```json
{
  "season": {...},                                   // como em get_bootstrap
  "stats": { <linha inteira de v_profile_stats> },
  "ranking_top": [ <v_ranking limit 5, mais a linha do próprio perfil se fora do top 5> ],
  "missions_today": [ <v_mission_board filtro Hoje, limit 3> ],
  "next_reward": { "id","name","icon","cost_coins","missing_coins" } | null,   // recompensa ativa mais barata com cost_coins > coins_balance; missing = cost - balance
  "pending_earned_spins": 0,
  "active_event": {...} | null,
  "feed": [ <v_activity_feed limit 20> ]
}
```

### 7.2 Perfil e configuração (admin salvo indicação)

**`admin_update_profile(p_profile_id uuid, p_patch jsonb) returns jsonb`** — admin.
Chaves aceitas em `p_patch` (qualquer outra → `INVALID_PATCH_KEY`): `full_name, avatar_path, color, job_title, team, role, status, email, phone, default_goal_amount, notes, goal_amount` (esta última grava em `season_goals` da temporada ativa; sem temporada ativa → ignorada com aviso no retorno). **Não** aceita `base_points` (pontos iniciais são `record_initial_points`, §7.4 — um save de formulário nunca lança pontos).
Passos: `select ... into strict` do perfil (`PROFILE_NOT_FOUND`); `update profiles` (colunas presentes); `update profile_private` (email só se não colide — `lower(email)` UQ → `EMAIL_TAKEN`; **não** altera `auth.users.email`: o e-mail de login muda só pelo próprio usuário via `updateUser`); `upsert season_goals` e, se `goal_amount` mudou, `perform private.evaluate_goal_milestone(p_profile_id, active_season_id(), now())` (§6.9); trigger `protect_profile_columns` aplica `LAST_ADMIN`.
Transições de `status` (qualquer outra → `PROFILE_STATUS_INVALID`): `pending → active` (**aprovar**), `pending → inactive` (**recusar**), `active → inactive` (inativar), `inactive → active` (reativar). `status: 'pending'` no patch é sempre recusado (`PROFILE_STATUS_INVALID`) — ninguém volta a pendente; patch com o mesmo status é no-op. Todas gravam `private.audit('rpc', 'admin_update_profile', ...)` com `old_status`/`new_status` no payload, além do `audit_row` de `profiles`.
**Aprovar** (`pending → active`, Apêndice B.21): (1) `update profiles set status = 'active'`; (2) `insert into season_goals (season_id, profile_id, goal_amount) values (active_season_id(), p, coalesce(profile_private.default_goal_amount, 0)) on conflict do nothing` (a temporada pode ter mudado desde o cadastro); (3) **depois** do update (senão `notify` ignora o perfil): `notify(p, 'system', 'Cadastro aprovado', 'Seu acesso ao ' || company_name || ' foi liberado. Bem-vindo à equipe!')` e `notify_all('system', 'Novo membro', full_name || ' entrou na equipe.', {profile_id}, p_exclude = p)`; (4) o pendente que estiver na tela `/aguardando` entra ao clicar "Verificar novamente" (o bootstrap passa a devolver o payload completo). Reativar (`inactive → active`) faz (1)–(2) sem notificações.
**Recusar** (`pending → inactive`): só `update` + auditoria; nenhuma notificação (o perfil não ativo não recebe); a linha de `auth.users` fica (FK `RESTRICT`), o e-mail não pode se cadastrar de novo e o gestor pode aprovar depois (`inactive → active`) se mudar de ideia. A limpeza abaixo roda também (é vazia para um pendente).
Se `status` passa a `'inactive'` (Apêndice B.17): (1) `wheel_queue` do perfil em `waiting`/`active` → se há spin `pending` na entrada `active` → RAISE `SPIN_PENDING` (aprove/feche antes); senão `status = 'removed', finished_at = now(), removed_by = auth.uid()`; (2) duelos `active` em que participa → `cancel_challenge(id)` com `notify` ao outro participante ("Duelo cancelado: participante inativado"); (3) desafios coletivos `draft` → `delete from challenge_participants` do perfil; coletivos `active` ficam (finish_challenge marca `is_winner = false`, §7.5); (4) o front faz `signOut()` na próxima resposta 42501/`PROFILE_INACTIVE` — sessões abertas não são encerradas pelo banco (§16.3).
Retorno: `{"profile": <v_profile_stats da temporada ativa>, "warnings": ["no_active_season_for_goal"]}`.

**`rotate_team_code() returns text`** — admin. `set_config('app.rpc','on',true)`; `update app_secrets set team_code = upper(encode(extensions.gen_random_bytes(6),'hex')), team_code_rotated_at = now(), updated_by = auth.uid() where id = 1 returning team_code`.

**`update_app_settings(p_patch jsonb) returns app_settings`** — admin. Chaves: `company_name, xp_per_level, currency, timezone, target_*, rank_admins, auto_approve_members`. `auto_approve_members` (boolean) só afeta cadastros futuros — quem já está `pending` continua pendente até o gestor aprovar (Apêndice B.21). `timezone` diferente do atual com `exists (select 1 from point_entries)` → RAISE `TIMEZONE_LOCKED` (detail "O fuso só pode ser alterado antes do primeiro lançamento."; o trigger `validate_timezone` repete a checagem para o `update` direto — Apêndice B.18). (Alternativa equivalente: `update` direto — a policy permite; a RPC existe para validar chaves e registrar auditoria. O front usa a RPC.)

**`save_special_event(p jsonb) returns special_events`** — admin. `p`: `{ id?, name, description?, multiplier, starts_at, ends_at, is_active? }`. Upsert em `special_events` dentro de `begin ... exception when exclusion_violation then raise 'EVENT_OVERLAP'` (detail "O período conflita com outro evento ativo.") — o front recebe um código do catálogo em vez do `23P01` cru. `ends_at <= starts_at` → `EVENT_RANGE_INVALID`. "Excluir" = `update set deleted_at = now(), is_active = false` (policy admin).

**`recompute_stats(p_profile_id uuid default null) returns jsonb`** — admin. Reconstrói `profile_season_stats` (inclusive `points_updated_at = max(occurred_at) where points > 0 and reverses_entry_id is null` — mesma fórmula do trigger, para a ordem de empates não mudar após um recompute), `profile_lifetime_stats` (inclusive streak via `recompute_streak`) e `challenge_participants.current_value` (desafios ativos) a partir do ledger, para um perfil ou todos. Retorno `{"profiles": n, "seasons": m}`. Não recria conquistas, marcos, missões ou feed (são fatos históricos).

### 7.3 Temporada (admin)

**`create_season(p_name text, p_starts_on date, p_ends_on date, p_team_goal_amount numeric default 0, p_activate boolean default false) returns seasons`**
1. `starts_at := (p_starts_on::timestamp) at time zone app_timezone()`; `ends_at := ((p_ends_on + 1)::timestamp) at time zone app_timezone()` (fim exclusivo). `p_ends_on < p_starts_on` → `SEASON_RANGE_INVALID`.
2. `insert into seasons (..., xp_per_level = app_settings.xp_per_level)`; sobreposição → captura `exclusion_violation` e lança `SEASON_OVERLAP`.
3. Fan-out `season_goals` para perfis ativos com `profile_private.default_goal_amount`.
4. Se `p_activate` → `activate_season(id)`.

**`update_season(p_season_id uuid, p_patch jsonb) returns seasons`** — chaves `name, team_goal_amount, starts_on, ends_on` (datas só se `closed_at is null`; encolher a janela deixando entries fora → `SEASON_HAS_ENTRIES_OUTSIDE`; deixando missão não deletada ou desafio não cancelado com janela fora do novo período → `SEASON_HAS_WINDOWS_OUTSIDE` — o gestor ajusta ou cancela antes).

**`activate_season(p_season_id uuid) returns seasons`** — `select ... into strict ... for update` (`SEASON_NOT_FOUND`); `closed_at is not null` → `SEASON_CLOSED`; **`starts_at > now()` → `SEASON_NOT_STARTED`** (detail "A temporada começa em {DD/MM}."; o front desabilita "Ativar" até a data — Apêndice B.20: ativar antes faria `active_season_id()` apontar para uma temporada que `season_for(now())` não devolve, e todo lançamento/aprovação falharia com `NO_SEASON_FOR_DATE`/`SEASON_CLOSED` enquanto o painel mostrasse tudo zerado); `update seasons set is_active = false where is_active; update ... set is_active = true where id = p` (mesma transação; o índice único não é violado); completa `season_goals` para perfis ativos sem linha nesta temporada (`default_goal_amount`); `perform private.evaluate_goal_milestone(p, p_season_id, now())` para cada perfil ativo (meta já batida por lançamentos retroativos); `notify_all('season', 'Nova temporada', name)`.

**`close_season(p_season_id uuid) returns jsonb`**
1. `select ... into strict ... for update` (`SEASON_NOT_FOUND`); já fechada → `SEASON_ALREADY_CLOSED`; `now() < starts_at` → `SEASON_NOT_STARTED` (fechar uma temporada futura deixaria `ends_at = local_today() + 1 < starts_at` e violaria o CK com erro cru).
2. `v_ends_at := case when now() < ends_at then (public.local_today() + 1)::timestamp at time zone app_timezone() else ends_at end` (fechamento antecipado encurta para a próxima meia-noite local — B.10). `set_config('app.rpc','on',true)`.
3. **Clamp das janelas** (B.10 estendida): `update missions set ends_at = least(ends_at, v_ends_at), is_active = is_active and (starts_at < v_ends_at) where season_id = p and ends_at > v_ends_at`; `update challenges set ends_at = least(ends_at, v_ends_at) where season_id = p and status in ('draft','active') and ends_at > v_ends_at` (os triggers de janela rodam com `app.rpc = 'on'`). Sem isso, missões/desafios ficariam com janela além do fim da temporada e — como B2/C filtram por `season_id` — parariam de progredir sem a UI explicar por quê.
4. Finaliza cada desafio `active` da temporada (`finish_challenge`, já com `ends_at` clampado), cancela `draft`.
5. Snapshot `season_results`: para **todo perfil ativo** e para todo perfil não ativo (`inactive`/`pending`) com linha em `profile_season_stats` ou `season_goals` (perfis cadastrados sem temporada ativa também entram): rank calculado como em `v_profile_stats` (só ranqueáveis), `goal_reached = sales_amount >= goal_amount and goal_amount > 0`.
6. Conquista `rank_first` (scope season) para `final_rank = 1` **se houver ≥ 1 ranqueável com `points > 0`** (senão não há campeão): `grant_achievement(..., season_id = p, occurred_at = least(now(), ends_at - interval '1 second'))` (entry cai na temporada certa; `app.allow_closed` não é necessário porque a temporada só é marcada como fechada no passo 7). Para cada perfil com `goal_reached`: `perform private.evaluate_goal_milestone(profile, p, least(now(), ends_at - 1s))` — marco **e** conquista META BATIDA, idempotentes.
7. `update seasons set is_active = false, closed_at = now(), closed_by = auth.uid(), ends_at = v_ends_at`.
8. `push_feed('season_closed', null, p, {season_name} || case when v_champion is not null then {champion_profile_id, champion_name} else '{}' end)`; `notify_all('season', 'Temporada encerrada', ...)`; auditoria.
9. Aviso de buraco: se existe temporada com `starts_at > v_ends_at` e nenhuma cobrindo `[v_ends_at, next.starts_at)` → `warnings: ['gap_until_next_season']` + `next_season_id`, `next_starts_at`; o front oferece "Antecipar início da próxima para {v_ends_at}" (`update_season(next, {starts_on: local_today() + 1})`).
Retorno: `{"season_id", "results": [ {profile_id, final_rank, final_points, sales_amount, goal_reached} ], "champion_profile_id": uuid | null, "warnings": [...], "next_season_id"?, "next_starts_at"?}`.
Depois de fechada, lançamentos com `occurred_at` na temporada falham (`SEASON_CLOSED`), exceto estornos (`reverse_entry`) — ver §6.6.

### 7.4 Ledger (admin)

**`record_rule_entry(p_profile_id uuid, p_rule_id uuid, p_quantity int default 1, p_amount numeric default null, p_occurred_at timestamptz default now(), p_reason text default null) returns point_entries`**
Validações: `p_profile_id` existe (`PROFILE_NOT_FOUND`) e ativo (`PROFILE_INACTIVE`), regra existe e não deletada (`RULE_NOT_FOUND`), `p_quantity between 1 and 1000` (`QUANTITY_INVALID`), `rule.points * p_quantity * 10 <= 1000000` (`POINTS_INVALID` — o pior caso com multiplicador 10 precisa caber no CK `abs(points) <= 1000000` do ledger, senão o erro seria um `23514` cru), `p_occurred_at <= now() + 5 min` e `>= now() - 90 days` (`OCCURRED_AT_INVALID`). Se a regra tem `metric = 'weekly_goal'`: `perform private.lock_profile(p_profile_id, 'progress')`; `v_key := public.iso_week_key(public.local_day(p_occurred_at))`; se já existe `milestone_awards (profile_id = p, metric = 'weekly_goal', period_key = v_key)` — **sem** filtrar `season_id`, pois a semana ISO pode cruzar a virada de temporada (§4.12) → `MILESTONE_ALREADY_AWARDED`; força `p_quantity := 1`. Insere `point_entries (profile_id, rule_id, quantity, amount, reason, source='rule', occurred_at)` — o trigger calcula o resto — e, para `weekly_goal`, grava `milestone_awards` com o `entry_id`. Retorna a linha inserida (com `points`, `multiplier`, `season_id` preenchidos).

**`record_manual_entry(p_profile_id uuid, p_points int, p_reason text, p_coins int default null) returns point_entries`**
`p_profile_id` existe/ativo (`PROFILE_NOT_FOUND`/`PROFILE_INACTIVE`); `p_points between -100000 and 100000 and p_points <> 0` (`POINTS_INVALID`); `length(p_reason) between 3 and 500` (`REASON_REQUIRED`); `coins := coalesce(p_coins, case when p_points > 0 then p_points else 0 end)` (remover pontos não confisca moedas por padrão — Apêndice B.3); `abs(coins) <= 100000`. Insere `source='manual', base_points=p_points, occurred_at=now()`. Com `coins < 0` o trigger pega o lock `wallet:<uid>` (§6.6) e o saldo **pode** ficar negativo (B.15) — não há `INSUFFICIENT_COINS` aqui; o gestor vê o saldo resultante no retorno da tela.

**`record_initial_points(p_profile_id uuid, p_points int) returns point_entries`** — admin. "Pontos iniciais" do cadastro (FEATURE §11), fora do formulário de perfil para ser idempotente: `p_points between 1 and 100000` (`POINTS_INVALID`); perfil ativo; `v_season := season_for(now())` (NULL → `NO_SEASON_FOR_DATE`); se já existe entry `source = 'system' and metric is null and reason = 'Pontos iniciais'` para (perfil, temporada) → `INITIAL_POINTS_EXISTS`; insere `source='system', base_points=p_points, coins=0, reason='Pontos iniciais', occurred_at=now()`. Por ser `system`, **não** conta como dia de streak nem como atividade (§4.9) e não entra no feed. O formulário de perfil mostra "Pontos iniciais lançados: N" (soma dessas entries na temporada ativa, lida de `v_point_entries_history`).

**`reverse_entry(p_entry_id uuid, p_reason text) returns point_entries`**
`select * from point_entries where id = p for update` (não existe → `ENTRY_NOT_FOUND`); já tem estorno (`exists reverses_entry_id = p`) → `ALREADY_REVERSED`; a própria linha é um estorno → `CANNOT_REVERSE_REVERSAL`; `source in ('reward')` → `USE_HANDLE_REDEMPTION` (resgates se cancelam pela RPC própria); `source = 'wheel'` com `redemption_id` → idem. Insere `point_entries (profile_id, source = case when orig.source in ('rule','manual','system') then 'system' else orig.source end, reverses_entry_id = p, reason = p_reason)` — **sem** `occurred_at`: o trigger `before_point_entry` (§6.6 passo 2) herda `occurred_at`, `season_id`, sinais invertidos e `rule_id` da original (funciona em temporada fechada), e, se a original deu moedas, pega o lock `wallet:<uid>` antes de inserir (serializa com `redeem_reward`; o saldo pode ficar negativo — B.15). Auditoria. `created_at` do estorno = quando foi estornado; o histórico o mostra na data do fato.

### 7.5 Missões e desafios (admin)

**`save_mission(p jsonb) returns missions`** — `p`: `{ id?, title, description?, icon?, kind, metric, target_kind?, target_value, reward_points?, reward_coins?, reward_spin?, starts_at, ends_at, audience?, participant_ids?: uuid[], is_active? }`. `id` presente e inexistente → `MISSION_NOT_FOUND`. `reward_spin` apontando para roleta `is_active = false` → `WHEEL_INACTIVE`. Upsert em `missions`; se `audience = 'selected'`: `delete from mission_participants where mission_id = id and profile_id <> all(ids)` + insert dos faltantes (`selected` com lista vazia → `PARTICIPANTS_REQUIRED`). Mudar `metric`/`target_*`/`kind` com `mission_progress` existente → `MISSION_HAS_PROGRESS` (crie outra missão). Trigger valida janela.

**`delete_mission(p_mission_id uuid) returns void`** — soft delete (`deleted_at = now(), is_active = false`).

**`save_challenge(p jsonb) returns challenges`** — `p`: `{ id?, name, description?, kind, metric, target_value, reward_points?, reward_coins?, reward_spin?, reward_description?, starts_at, ends_at, participant_ids: uuid[] }`. `id` presente e inexistente → `CHALLENGE_NOT_FOUND`; só em `status = 'draft'` (senão `CHALLENGE_NOT_DRAFT`). `reward_spin` de roleta inativa → `WHEEL_INACTIVE`. Upsert + substitui participantes; `kind = 'team'` com `participant_ids` vazio ⇒ todos os perfis ativos. Duelo com ≠ 2 ids → `DUEL_NEEDS_TWO` (falha antes de gravar).

**`activate_challenge(p_challenge_id uuid) returns challenges`** — `for update`; `status <> 'draft'` → `CHALLENGE_NOT_DRAFT`; `ends_at <= now()` → `CHALLENGE_WINDOW_INVALID`; valida cardinalidade e que todos os participantes estão ativos (`PARTICIPANT_INACTIVE`); recalcula `challenge_participants.current_value` a partir do ledger (entries em `[starts_at, ends_at)` já existentes); `set_config('app.rpc','on',true)`; `update ... set status='active', activated_at=now()`; `notify` cada participante (`kind='challenge'`).

**`finish_challenge(p_challenge_id uuid) returns jsonb`**
1. `set_config('app.rpc','on',true)`; `update challenges set status='finished', finished_at=now() where id=p and status='active' returning *` — 0 linhas → `CHALLENGE_NOT_ACTIVE` (idempotente contra duplo clique).
2. Recalcula `final_value` por participante a partir do ledger (mesma regra do trigger) e grava `challenge_results`.
3. Vencedores (participantes **inativos** nunca vencem — B.17): duelo com os dois ativos → maior `final_value` (empate → ambos; todos zero → ninguém); duelo com um inativo → o ativo vence se `final_value > 0`; coletivo → todos os participantes **ativos** se `sum(final_value) >= target_value` (a soma inclui o que o inativo produziu enquanto ativo), senão ninguém. `update challenges set winner_ids`.
4. Para cada vencedor: entry `source='challenge'` (`base_points=reward_points, coins=reward_coins, reason=name, occurred_at=least(now(), ends_at - 1s)`) se recompensa > 0 → `challenge_results.entry_id`; se `reward_spin` → `wheel_queue (source='earned', reference_kind='challenge_result', reference_id=challenge_id||':'||profile_id)` → `queue_id`; `push_feed('challenge_finished', ...)` para cada participante; `notify` cada participante.
Retorno: `{"challenge_id", "winner_ids": [...], "results": [{profile_id, final_value, is_winner, entry_id}]}`.

**`cancel_challenge(p_challenge_id uuid, p_reason text default null) returns challenges`** — `into strict` (`CHALLENGE_NOT_FOUND`); de `draft`/`active` para `cancelled` (`cancelled_at = now()`); nada é creditado; `notify` cada participante ativo com `coalesce(p_reason, 'Desafio cancelado')`.

### 7.6 Roleta

**`enqueue_wheel(p_profile_id uuid default null, p_person_name text default null, p_wheel_kind wheel_kind default 'classic', p_attempts int default 1) returns wheel_queue`** — admin. Exatamente um de `p_profile_id`/`p_person_name` (`QUEUE_TARGET_REQUIRED`); perfil deve existir (`PROFILE_NOT_FOUND`) e estar ativo (`PROFILE_INACTIVE`); roleta `is_active` senão `WHEEL_INACTIVE`; `person_name := profiles.full_name` ou `left(trim(p_person_name), 80)`; `p_attempts between 1 and 20` (`ATTEMPTS_INVALID`). Mesma pessoa já `waiting`/`active` **com `source = 'manual'`** → `ALREADY_IN_QUEUE` (checado por `profile_id`; convidado por `lower(person_name)`) — uma entrada `earned` pendente não bloqueia a manual (§4.23). Insere `status='waiting', source='manual'`.

**`update_queue_entry(p_queue_id uuid, p_wheel_kind wheel_kind default null, p_attempts int default null) returns wheel_queue`** — admin. `into strict ... for update` (`QUEUE_NOT_FOUND`); só `status in ('waiting','active')` (`QUEUE_NOT_EDITABLE`); com spin pendente → `SPIN_PENDING`; roleta nova inativa → `WHEEL_INACTIVE`; `p_attempts > attempts_used and p_attempts <= 20`, senão `ATTEMPTS_INVALID` (detail "Tentativas devem ser maiores que as já usadas ({n}) e até 20.") — permitir `= attempts_used` deixaria uma vez `active` presa com 0 restantes ("Tentativa 2 de 1"); para encerrar use `remove_from_queue`.

**`remove_from_queue(p_queue_id uuid) returns wheel_queue`** — admin. `into strict ... for update` (`QUEUE_NOT_FOUND`); spin pendente → `SPIN_PENDING`; `status in ('waiting','active')` → `status='removed', finished_at=now(), removed_by=auth.uid()`; senão `QUEUE_NOT_EDITABLE`.

**`release_turn(p_queue_id uuid) returns wheel_queue`** — admin.
1. `perform pg_advisory_xact_lock(hashtext('wheel_turn'))` (serializa gestores).
2. `select * into strict v_queue from wheel_queue where id = p for update` (`QUEUE_NOT_FOUND`); `v_queue.profile_id` inativo → `PROFILE_INACTIVE`; roleta da entrada inativa → `WHEEL_INACTIVE`.
3. Se existe spin `pending` → `SPIN_PENDING` (aprove/feche primeiro).
4. Entrada `active` diferente de `p` sem spin pendente → volta para `waiting` (`released_at = null`).
5. `update wheel_queue set status='active', released_at=now() where id=p and status='waiting' returning *`; 0 linhas → `QUEUE_NOT_WAITING`. `attempts_used >= attempts_allowed` → `ATTEMPTS_EXHAUSTED`.
6. `notify(profile_id, 'wheel', 'Sua vez na roleta!', ...)` se houver perfil.

**`spin_wheel(p_queue_id uuid) returns jsonb`** — admin **ou** dono da vez (`queue.profile_id is not distinct from auth.uid()` com `is_active_member()`); senão `NOT_ALLOWED`.
0. `perform pg_advisory_xact_lock(hashtext('wheel_turn'))` — o mesmo lock de `release_turn` e `save_wheel_prizes`: sorteio e edição de prêmios nunca se cruzam (sem isso, entre `draw_prize` e o commit, o gestor poderia soft-deletar o prêmio sorteado e a fila ficaria "AGUARDANDO APROVAÇÃO" de um prêmio que não existe mais).
1. `select * into strict v_queue from wheel_queue where id = p for update` (`QUEUE_NOT_FOUND` — **antes** da checagem de papel, que depende de `v_queue.profile_id`); checagem de papel; `status <> 'active'` → `NO_ACTIVE_TURN`; roleta inativa → `WHEEL_INACTIVE`; `attempts_used >= attempts_allowed` → `ATTEMPTS_EXHAUSTED`; spin pendente para a fila → `SPIN_PENDING`.
2. `(v_prize, v_rand) := private.draw_prize(wheel_id, '{}')` (`NO_PRIZES` se a roleta ficou sem prêmio); se `v_prize.kind = 'mystery'` → `(v_resolved, _) := private.draw_prize(wheel_id, '{mystery,extra_spin}')`, senão `v_resolved := v_prize`.
3. Insere `wheel_spins (queue_id, profile_id, person_name, wheel_id, attempt_index = attempts_used + 1, prize_* snapshot, resolved_* snapshot, random_value, prizes_hash, status='pending', spun_by=auth.uid())`.
4. Retorno:
```json
{ "spin_id", "queue_id", "wheel_kind", "person_name", "profile_id", "avatar_path",
  "attempt_index", "attempts_allowed",
  "prize": { "id","label","kind","value","sort_order" },
  "resolved_prize": { "id","label","kind","value" },
  "sector_index": <posição 0-based do prize entre os ativos ordenados por sort_order>,
  "sector_count": <n ativos>, "prizes_hash": "<md5>" }
```
O front localiza o setor por `prize.id` na lista carregada; se não achar ou `prizes_hash` divergir, recarrega prêmios antes de animar.

**`spin_wheel_free(p_wheel_kind wheel_kind) returns jsonb`** — `is_active_member()`. Roleta inativa → `WHEEL_INACTIVE`. Sorteia com `draw_prize` (resolvendo mystery; `NO_PRIZES` se vazia) e retorna o mesmo shape sem `spin_id`/`queue_id` (`"is_free": true`). **Não grava nada** (nenhum caminho para aprovação/crédito).

**`approve_spin(p_spin_id uuid) returns jsonb`** — admin.
0. `select * into strict v_spin from wheel_spins where id = p` (`SPIN_NOT_FOUND`); `v_spin.profile_id` inativo → `PROFILE_INACTIVE` (só `reject_spin` fecha o giro de quem foi inativado com spin pendente).
1. `update wheel_spins set status='approved', approved_by=auth.uid(), approved_at=now() where id=p and status='pending' returning *` — 0 linhas → `SPIN_NOT_PENDING` (idempotente).
2. `select * into strict from wheel_queue where id = spin.queue_id for update`.
3. Crédito conforme `resolved_kind` (só se `profile_id is not null`, exceto `cash`/`voucher`/`extra_spin`/`custom`, que valem para convidado):
   - `points` → entry `source='wheel', base_points=value, coins=0, reason='Roleta: '||resolved_label, occurred_at=now()` → `entry_id`, `credited=true`.
   - `coins` → entry `points=0, coins=value` → idem.
   - `cash`/`voucher` → `reward_redemptions (source='wheel', spin_id, profile_id, person_name, title=resolved_label, cost_coins=0, value_amount=value, status='approved', handled_by=auth.uid(), handled_at=now())` → `redemption_id`, `credited=true`.
   - `extra_spin` → `attempts_allowed := least(attempts_allowed + 1, 20)`; se já era 20 → `credited=false` (registrado em `notes` da auditoria); senão `credited=true`.
   - `multiplier` → `profile_boosts (profile_id, multiplier=value, starts_at=now(), expires_at=now()+24h, spin_id)` → `boost_id`, `credited=true`.
   - `custom` → só histórico, `credited=false`.
   - Convidado com `points`/`coins`/`multiplier` → `credited=false`.
4. `attempts_used += 1`; se `attempts_used >= attempts_allowed` → `status='done', finished_at=now()`.
5. `push_feed('wheel_prize', profile_id, active_season_id(), {label: resolved_label, kind: resolved_kind, wheel_kind}, 'wheel:'||spin_id)` se `profile_id`; `notify(profile_id, 'wheel', 'Prêmio aprovado', resolved_label)`; auditoria.
Prêmios `points`/`coins` geram entry com `occurred_at = now()`: se nenhuma temporada cobre `now()`, a aprovação falha com `NO_SEASON_FOR_DATE` (o gestor precisa ativar a temporada antes). Retorno: `{"spin": {id, status, credited, entry_id, redemption_id, boost_id}, "queue": {id, status, attempts_used, attempts_allowed}}`.

**`reject_spin(p_spin_id uuid) returns jsonb`** — admin. `into strict` (`SPIN_NOT_FOUND`); `update ... set status='rejected', approved_by=auth.uid(), approved_at=now() where id=p and status='pending' returning *` (0 → `SPIN_NOT_PENDING`). Não consome tentativa; fila continua `active`. Retorno igual ao de `approve_spin`.

**`save_wheel_prizes(p_wheel_kind wheel_kind, p_prizes jsonb) returns setof wheel_prizes`** — admin. Entrada `[{ id?, label, kind, value?, weight?, color?, sort_order, is_active? }]`. `perform pg_advisory_xact_lock(hashtext('wheel_turn'))` (serializa com `spin_wheel`/`release_turn`); spin pendente na roleta → `SPIN_PENDING`; `sort_order` duplicado na entrada → `SORT_ORDER_DUPLICATE`. Numa transação, em **duas fases** (§4.22): (1) `update wheel_prizes set sort_order = -1 - sort_order where wheel_id = w and deleted_at is null` (espaço negativo temporário, sem colisão com o índice único parcial); (2) prêmios existentes ausentes da lista → `deleted_at = now(), is_active = false` (saem do índice); presentes → update com o `sort_order` final; novos → insert. O constraint trigger deferido valida `MIN_PRIZES`/`MYSTERY_NEEDS_POOL` no commit. Retorna os prêmios ativos ordenados; o `prizes_hash` muda (inclui rótulo/tipo/valor/cor) e as telas recarregam.

### 7.7 Recompensas

**`redeem_reward(p_reward_id uuid) returns jsonb`** — `is_active_member()`; perfil = `auth.uid()`.
1. `perform private.lock_profile(auth.uid(), 'wallet')`.
2. `select * into strict from rewards where id = p and is_active and deleted_at is null for update`; não achou → `REWARD_UNAVAILABLE`.
3. `v_balance := coalesce((select sum(coins) from point_entries where profile_id = auth.uid()), 0)` (pode ser negativo — B.15); `< cost_coins` → `INSUFFICIENT_COINS` (detail inclui faltam N = `cost_coins - v_balance`, que com saldo devedor é maior que o custo).
4. Se `stock is not null`: `update rewards set stock = stock - 1 where id = p and stock > 0 returning id`; 0 linhas → `OUT_OF_STOCK`.
5. Entry `source='reward', points=0, coins=-cost_coins, reason='Resgate: '||name, occurred_at=now(), created_by=auth.uid()`.
6. `reward_redemptions (source='store', reward_id, profile_id, person_name=full_name, title=name, cost_coins, value_amount, status='requested', entry_id)`.
7. `private.notify_admins('reward', 'Novo pedido de resgate', ...)` (§6.2 — todos os gestores ativos). Retorno `{"redemption_id", "coins_balance": v_balance - cost_coins}`.

**`handle_redemption(p_redemption_id uuid, p_action text, p_notes text default null) returns reward_redemptions`** — admin. `p_action in ('approve','deliver','cancel')` (`ACTION_INVALID`). `select ... into strict ... for update` (`REDEMPTION_NOT_FOUND`). Em `cancel` com estorno de moedas: `perform private.lock_profile(profile_id, 'wallet')` antes de inserir (mesma ordem de locks de `redeem_reward`). Transições: `requested → approved` (approve), `requested|approved → delivered` (deliver), `requested|approved → cancelled` (cancel); outra → `REDEMPTION_TRANSITION_INVALID`. Em `cancel` com `source='store'`: entry de estorno `source='reward', reverses_entry_id = entry_id, reason = coalesce(p_notes,'Resgate cancelado')` → `refund_entry_id`; `update rewards set stock = stock + 1 where id = reward_id and stock is not null`. Sempre: `handled_by/handled_at/notes`; `notify(profile_id, 'reward', ...)` com o novo status; auditoria.

### 7.8 Notificações

**`mark_notifications_read(p_ids uuid[] default null) returns int`** — `is_active_member()`. `update notifications set is_read = true where profile_id = auth.uid() and not is_read and (p_ids is null or id = any(p_ids))`; retorna linhas afetadas.

### 7.9 Resumo de grants

| função | anon | authenticated | checagem interna |
|---|---|---|---|
| signup_mode, validate_team_code | ✔ | ✔ | — |
| get_bootstrap, get_dashboard, spin_wheel_free, redeem_reward, mark_notifications_read, is_active_member, is_admin, active_season_id, app_timezone, local_day, local_today, iso_week_key, mission_period, avatar_count | ✖ | ✔ | `is_active_member()` via `private.assert_active_member()` — `PROFILE_PENDING`/`PROFILE_INACTIVE` (get_dashboard: admin para terceiros; get_bootstrap devolve só `{me: {status}}` para inativo **e pendente**; os helpers de tempo são puros) |
| spin_wheel | ✖ | ✔ | admin ou dono da vez |
| todas as demais (inclusive `record_initial_points`, `save_special_event`) | ✖ | ✔ | `is_admin()` |

Nada em `private` tem EXECUTE para `anon`/`authenticated`/`public`. Depois desta tabela, a varredura de `0011` (§2.2) garante que nenhuma outra função de `public` ficou executável.

---

## 8. Triggers (lista completa)

| tabela | nome | timing / evento | função | observação |
|---|---|---|---|---|
| auth.users | on_auth_user_created | AFTER INSERT, FOR EACH ROW | private.handle_new_user | §6.4 |
| app_settings | app_settings_validate_tz | BEFORE INSERT OR UPDATE | private.validate_timezone | |
| app_settings | app_settings_updated_at | BEFORE UPDATE | private.set_updated_at | |
| app_settings | app_settings_audit | AFTER UPDATE | private.audit_row | |
| app_secrets | app_secrets_protect | BEFORE UPDATE | private.protect_app_secrets | |
| app_secrets | app_secrets_updated_at | BEFORE UPDATE | private.set_updated_at | |
| app_secrets | app_secrets_audit | AFTER UPDATE | private.audit_row | team_code mascarado |
| seasons | seasons_updated_at | BEFORE UPDATE | private.set_updated_at | |
| seasons | seasons_stamp_actor | BEFORE INSERT | private.stamp_actor | |
| seasons | seasons_audit | AFTER INSERT OR UPDATE | private.audit_row | |
| season_goals | season_goals_updated_at | BEFORE UPDATE | private.set_updated_at | |
| season_goals | season_goals_goal_milestone | AFTER UPDATE OF goal_amount | private.on_goal_amount_changed | §6.9 |
| profiles | profiles_protect_columns | BEFORE UPDATE | private.protect_profile_columns | §6.5 |
| profiles | profiles_updated_at | BEFORE UPDATE | private.set_updated_at | |
| profiles | profiles_audit | AFTER UPDATE | private.audit_row | WHEN role/status/job_title/team mudam |
| profile_private | profile_private_updated_at | BEFORE UPDATE | private.set_updated_at | |
| point_rules | point_rules_stamp_actor | BEFORE INSERT | private.stamp_actor | |
| point_rules | point_rules_updated_at | BEFORE UPDATE | private.set_updated_at | |
| point_rules | point_rules_audit | AFTER INSERT OR UPDATE | private.audit_row | |
| point_entries | point_entries_before | BEFORE INSERT | private.before_point_entry | §6.6 (inclui stamp de ator) |
| point_entries | point_entries_after | AFTER INSERT | private.after_point_entry | §6.7 |
| point_entries | point_entries_immutable | BEFORE UPDATE OR DELETE | private.forbid_ledger_mutation | |
| special_events | special_events_stamp_actor / _updated_at / _audit | idem padrão | | |
| special_events | special_events_notify | AFTER INSERT OR UPDATE OF is_active | private.notify_special_event | |
| missions | missions_validate_window | BEFORE INSERT OR UPDATE | private.validate_mission_window | |
| missions | missions_stamp_actor / _updated_at | | | |
| mission_progress | mission_progress_updated_at | BEFORE UPDATE | private.set_updated_at | |
| challenges | challenges_validate_window | BEFORE INSERT OR UPDATE | private.validate_challenge_window | |
| challenges | challenges_protect_status | BEFORE UPDATE | private.protect_challenge_status | |
| challenges | challenges_cardinality | CONSTRAINT AFTER UPDATE OF status, DEFERRABLE INITIALLY DEFERRED | private.check_challenge_cardinality | |
| challenges | challenges_stamp_actor / _updated_at | | | |
| challenge_participants | cp_protect | BEFORE INSERT OR DELETE | private.protect_challenge_participants | |
| challenge_participants | cp_cardinality | CONSTRAINT AFTER INSERT OR DELETE, DEFERRABLE INITIALLY DEFERRED | private.check_challenge_cardinality | |
| challenge_participants | cp_updated_at | BEFORE UPDATE | private.set_updated_at | |
| wheels | wheels_updated_at | BEFORE UPDATE | private.set_updated_at | |
| wheels | wheels_protect_inactive | BEFORE UPDATE OF is_active | private.protect_wheel_deactivation | `WHEEL_IN_USE` (§4.21) |
| wheels | wheels_check_prizes | CONSTRAINT AFTER UPDATE OF is_active, DEFERRABLE INITIALLY DEFERRED | private.check_wheel_prizes_on_wheel | reativar exige prêmios (§4.21) |
| wheel_prizes | wheel_prizes_min | CONSTRAINT AFTER INSERT OR UPDATE OR DELETE, DEFERRABLE INITIALLY DEFERRED | private.check_wheel_min_prizes | |
| wheel_prizes | wheel_prizes_block_pending | BEFORE UPDATE OR DELETE | private.block_prize_change_with_pending_spin | |
| wheel_prizes | wheel_prizes_updated_at / _audit | | | |
| wheel_queue | wheel_queue_updated_at | BEFORE UPDATE | private.set_updated_at | |
| rewards | rewards_stamp_actor / _updated_at / _audit | | | |
| reward_redemptions | reward_redemptions_updated_at | BEFORE UPDATE | private.set_updated_at | |
| achievements | achievements_updated_at / _audit | | | |

Nenhuma tabela tem trigger BEFORE DELETE de "cascata lógica": exclusões físicas não existem no fluxo da aplicação.

---

## 9. Catálogo de códigos de erro

`message` = código; `detail` = texto pt-BR; `errcode` = `42501` para permissão, `P0001` para regra de negócio, `23505` propagado só quando indicado.

| código | detail (pt-BR) | onde |
|---|---|---|
| NOT_AUTHENTICATED | Faça login para continuar. | get_bootstrap, RPCs |
| NOT_ADMIN | Apenas gestores podem executar esta ação. | RPCs admin |
| NOT_ALLOWED | Você não pode executar esta ação. | spin_wheel |
| PROFILE_INACTIVE | Este perfil está inativo. | `assert_active_member` (chamador inativo, errcode 42501); record_*; enqueue_wheel; release_turn; approve_spin (perfil-alvo com `status <> 'active'`, inclusive pendente) |
| PROFILE_PENDING | Seu cadastro está aguardando aprovação do gestor. | `assert_active_member` (chamador `status = 'pending'`, errcode 42501) — o front trata como erro de autenticação e leva para `/aguardando` |
| PROFILE_STATUS_INVALID | Transição de status não permitida (um perfil só pode ser aprovado, recusado, inativado ou reativado). | admin_update_profile |
| PROFILE_NOT_FOUND | Perfil não encontrado. | get_bootstrap, admin_update_profile, record_*, enqueue_wheel |
| INVALID_TEAM_CODE | Código da equipe inválido. | handle_new_user |
| BOOTSTRAP_EMAIL_MISMATCH | Este e-mail não está autorizado a criar a instalação. | handle_new_user |
| BOOTSTRAP_REQUIRES_CONFIRMED_EMAIL | O primeiro gestor precisa ser criado pelo painel do Supabase (usuário já confirmado). | handle_new_user |
| BOOTSTRAP_NOT_CONFIGURED | Instalação incompleta: aplique o schema.sql por inteiro. | handle_new_user |
| BOOTSTRAP_LOCKED | O bootstrap da instalação não pode ser reaberto. | protect_app_secrets |
| TEAM_CODE_VIA_RPC_ONLY | Use "Gerar novo código" para trocar o código da equipe. | protect_app_secrets |
| FORBIDDEN_COLUMN | Você só pode alterar nome, foto, cor e preferências. | protect_profile_columns |
| INVALID_AVATAR_PATH | Caminho de foto inválido. | protect_profile_columns |
| LAST_ADMIN | Não é possível rebaixar ou inativar o último gestor ativo. | protect_profile_columns |
| INVALID_PATCH_KEY | Campo não permitido: {key}. | admin_update_profile, update_app_settings, update_season |
| EMAIL_TAKEN | Este e-mail já está em uso. | admin_update_profile |
| INVALID_TIMEZONE | Fuso horário inválido. | validate_timezone |
| TIMEZONE_LOCKED | O fuso só pode ser alterado antes do primeiro lançamento. | validate_timezone, update_app_settings |
| LEDGER_IMMUTABLE | Lançamentos não podem ser alterados nem apagados; use um estorno. | forbid_ledger_mutation |
| NO_SEASON_FOR_DATE | Não existe temporada cobrindo esta data. | before_point_entry, validate_*_window |
| NO_ACTIVE_SEASON | Não há temporada ativa. | RPCs que exigem temporada |
| SEASON_CLOSED | Esta temporada já foi encerrada. | before_point_entry, activate_season |
| SEASON_ALREADY_CLOSED | Temporada já encerrada. | close_season |
| SEASON_OVERLAP | O período conflita com outra temporada. | create_season, update_season |
| SEASON_RANGE_INVALID | A data final deve ser posterior à inicial. | create_season, update_season |
| SEASON_HAS_ENTRIES_OUTSIDE | Existem lançamentos fora do novo período. | update_season |
| SEASON_HAS_WINDOWS_OUTSIDE | Existem missões ou desafios com janela fora do novo período. | update_season |
| SEASON_NOT_STARTED | A temporada começa em {DD/MM}. | activate_season, close_season |
| SEASON_NOT_FOUND | Temporada não encontrada. | activate_season, close_season, update_season, evaluate_goal_milestone |
| EVENT_OVERLAP | O período conflita com outro evento ativo. | save_special_event |
| EVENT_RANGE_INVALID | A data final deve ser posterior à inicial. | save_special_event |
| RULE_NOT_FOUND | Regra de pontuação não encontrada. | before_point_entry |
| RULE_INACTIVE | Esta regra está inativa. | before_point_entry |
| AMOUNT_REQUIRED | Informe o valor em R$ da venda. | before_point_entry |
| QUANTITY_INVALID | Quantidade deve ser entre 1 e 1000. | record_rule_entry |
| POINTS_INVALID | Pontos devem ser diferentes de zero e até 100.000 (com quantidade e multiplicador, até 1.000.000). | record_manual_entry, record_rule_entry, record_initial_points |
| INITIAL_POINTS_EXISTS | Pontos iniciais já lançados para este perfil nesta temporada. | record_initial_points |
| REASON_REQUIRED | Informe o motivo (3 a 500 caracteres). | record_manual_entry |
| OCCURRED_AT_INVALID | Data do lançamento inválida (até 90 dias atrás). | record_rule_entry |
| MILESTONE_ALREADY_AWARDED | Meta semanal já lançada para esta semana. | record_rule_entry |
| ENTRY_NOT_FOUND | Lançamento não encontrado. | reverse_entry |
| ALREADY_REVERSED | Este lançamento já foi estornado. | reverse_entry |
| CANNOT_REVERSE_REVERSAL | Não é possível estornar um estorno. | reverse_entry |
| USE_HANDLE_REDEMPTION | Cancele o resgate pela tela de recompensas. | reverse_entry |
| REVERSAL_MISMATCH | Estorno inconsistente com o lançamento original. | before_point_entry |
| TRIGGER_DEPTH | Profundidade de triggers excedida. | after_point_entry |
| MISSION_WINDOW_INVALID | A janela da missão precisa estar dentro da temporada. | validate_mission_window |
| LIGHTNING_TOO_LONG | Missão relâmpago dura no máximo 24 horas. | validate_mission_window |
| MISSION_HAS_PROGRESS | Missão já tem progresso; crie uma nova. | save_mission |
| MISSION_NOT_FOUND | Missão não encontrada. | save_mission, delete_mission |
| CHALLENGE_NOT_FOUND | Desafio não encontrado. | save_challenge, activate/finish/cancel_challenge |
| PARTICIPANTS_REQUIRED | Selecione ao menos um participante. | save_mission |
| CHALLENGE_WINDOW_INVALID | O período do desafio precisa estar dentro da temporada e no futuro. | validate_challenge_window, activate_challenge |
| CHALLENGE_NOT_DRAFT | O desafio já foi ativado. | save_challenge, activate_challenge, protect_* |
| CHALLENGE_NOT_ACTIVE | O desafio não está ativo. | finish_challenge |
| CHALLENGE_FINAL | Desafio finalizado/cancelado não pode mudar. | protect_challenge_status |
| STATUS_VIA_RPC_ONLY | Use as ações de ativar/finalizar/cancelar. | protect_challenge_status |
| DUEL_NEEDS_TWO | Um duelo precisa de exatamente 2 participantes. | vários |
| TEAM_NEEDS_TWO | Um desafio coletivo precisa de ao menos 2 participantes. | check_challenge_cardinality |
| PARTICIPANT_INACTIVE | Há participante inativo. | activate_challenge |
| QUEUE_TARGET_REQUIRED | Informe um colaborador ou um nome. | enqueue_wheel |
| ALREADY_IN_QUEUE | Esta pessoa já está na fila (entrada manual). | enqueue_wheel |
| ATTEMPTS_INVALID | Tentativas devem ser entre 1 e 20 e maiores que as já usadas ({n}). | enqueue_wheel, update_queue_entry |
| QUEUE_NOT_FOUND | Entrada da fila não encontrada. | update_queue_entry, remove_from_queue, release_turn, spin_wheel |
| SPIN_NOT_FOUND | Giro não encontrado. | approve_spin, reject_spin |
| WHEEL_INACTIVE | Esta roleta está desativada. | enqueue_wheel, update_queue_entry, release_turn, spin_wheel, spin_wheel_free, save_mission, save_challenge |
| WHEEL_IN_USE | A roleta tem fila, missão ou desafio pendente; não pode ser desativada. | protect_wheel_deactivation |
| NO_PRIZES | A roleta está sem prêmios ativos. | draw_prize |
| SORT_ORDER_DUPLICATE | Há prêmios com a mesma posição. | save_wheel_prizes |
| QUEUE_NOT_EDITABLE | Esta entrada da fila não pode mais ser alterada. | update/remove |
| QUEUE_NOT_WAITING | Só entradas em espera podem ser liberadas. | release_turn |
| NO_ACTIVE_TURN | Não há vez liberada. | spin_wheel |
| ATTEMPTS_EXHAUSTED | Tentativas esgotadas. | release_turn, spin_wheel |
| SPIN_PENDING | Há um prêmio aguardando aprovação. | vários |
| SPIN_NOT_PENDING | Este giro já foi processado. | approve_spin, reject_spin |
| MIN_PRIZES | Cada roleta precisa de ao menos 2 prêmios ativos. | check_wheel_min_prizes |
| MYSTERY_NEEDS_POOL | A roleta precisa de um prêmio comum além de Mystery/Giro extra. | check_wheel_min_prizes |
| REWARD_UNAVAILABLE | Recompensa indisponível. | redeem_reward |
| INSUFFICIENT_COINS | Moedas insuficientes (faltam {n}). | redeem_reward |
| OUT_OF_STOCK | Recompensa esgotada. | redeem_reward |
| ACTION_INVALID | Ação inválida. | handle_redemption |
| REDEMPTION_TRANSITION_INVALID | Transição de status não permitida. | handle_redemption |
| REDEMPTION_NOT_FOUND | Pedido de resgate não encontrado. | handle_redemption |

Front: `src/lib/rpc-errors.ts` mapeia código → texto; fallback `error.details`; `42501`/`PGRST301`/`PROFILE_INACTIVE` → `signOut()` se o bootstrap indicar perfil inativo; `PROFILE_PENDING` → `/aguardando` (sem `signOut()`, para o pendente poder clicar "Verificar novamente"). SQLSTATEs genéricos que ainda podem vazar de escrita direta por policy (não pela RPC): `23514` (`check_violation`) e `23P01` (`exclusion_violation`) → texto "Conflito de regra no banco" (`LEDGER_CONSTRAINT` como código sintético no front); `23505` → "Registro duplicado". Toda escrita do fluxo normal passa por RPC e devolve código do catálogo.

---

## 10. Matriz de RLS

`enable row level security` em **todas** as tabelas de `public` (teste (k) do harness falha se alguma ficar sem). `anon` não tem grant em nenhuma tabela. Colunas: C = colaborador ativo (`authenticated` com `is_active_member()`), A = admin ativo. "—" = sem policy **e sem grant** (revogado explicitamente, §2.2). Expressões abreviadas: `me` = `(select auth.uid())`, `member` = `(select public.is_active_member())`, `admin` = `(select public.is_admin())`. Toda policy é `to authenticated`. **Toda policy "própria" é `member and (...)`**: usuário inativo mantém access token por até 1 h e refresh token indefinidamente (§16.3), e sem o `member` continuaria lendo o próprio ledger/resgates/notificações e editando nome/foto. Única exceção: SELECT da própria linha em `profiles` (`member or id = me`) para `get_bootstrap` devolver `status = 'inactive'` ou `'pending'`. `admin` implica `member`. **Pendente** (`status = 'pending'`) é tratado exatamente como inativo por esta matriz: `member` é false, logo zero linhas em toda tabela/view e nenhuma RPC além de `get_bootstrap` — a única linha que ele enxerga é a própria em `profiles`. Só o admin vê os pendentes (`profiles`/`profile_private`/`v_profile_stats` com `status = 'pending'`); colaboradores ativos não os veem em lugar nenhum (nem em `useActiveProfiles`, que filtra `status = 'active'`).

| tabela | SELECT | INSERT (with check) | UPDATE (using / with check) | DELETE |
|---|---|---|---|---|
| app_settings | `member` | — | `admin` / `admin` | — |
| app_secrets | `admin` | — | `admin` / `admin` | — |
| seasons | `member` | — (RPC) | — (RPC) | — |
| season_goals | `member and (profile_id = me or admin)` | `admin` | `admin` / `admin` | — |
| season_results | `member and (profile_id = me or admin)` | — | — | — |
| profiles | `member or id = me` | — (trigger auth) | `member and (id = me or admin)` / idem + grant de colunas + trigger | — |
| profile_private | `member and (profile_id = me or admin)` | — | `admin` / `admin` | — |
| profile_season_stats | `member` | — | — | — |
| profile_lifetime_stats | `member and (profile_id = me or admin)` | — | — | — |
| point_rules | `member` | `admin` | `admin` / `admin` | — |
| point_entries | `member and (profile_id = me or admin)` | `admin` (fallback; RPC preferida) | — (trigger RAISE) | — (trigger RAISE) |
| milestone_awards | `member and (profile_id = me or admin)` | — | — | — |
| special_events | `member` | `admin` (caminho normal: `save_special_event`) | `admin` / `admin` | — |
| profile_boosts | `member and (profile_id = me or admin)` | — | — | — |
| missions | `member` | `admin` | `admin` / `admin` | — |
| mission_participants | `member` | `admin` | — | `admin` (só via save_mission; grant delete restrito a esta tabela) |
| mission_progress | `member` | — | — | — |
| challenges | `member` | `admin` | `admin` / `admin` (status protegido por trigger) | — |
| challenge_participants | `member` | `admin` | — (revoke) | `admin` (só via save_challenge) |
| challenge_results | `member` | — | — | — |
| wheels | `member` | — | `admin` / `admin` | — |
| wheel_prizes | `member` | `admin` | `admin` / `admin` | — |
| wheel_queue | `member` | — | — | — |
| wheel_spins | `member and (status in ('approved','pending') or profile_id = me or admin)` | — | — | — |
| rewards | `member` | `admin` | `admin` / `admin` | — |
| reward_redemptions | `member and (profile_id = me or admin)` | — | — | — |
| achievements | `member` | `admin` | `admin` / `admin` | — |
| profile_achievements | `member` | — | — | — |
| feed_events | `member` | — | — | — |
| notifications | `member and profile_id = me` | — | `member and profile_id = me` / idem + grant só `is_read` | — |
| audit_log | `admin` | — | — | — |

Grants correspondentes (exemplo para uma tabela de catálogo), aplicados **depois** da varredura `revoke all on all tables in schema public from anon, authenticated` do fim de `0011` (§2.2) — cada grant abaixo é o único caminho pelo qual `authenticated` recebe privilégio:
```sql
grant select, insert, update on public.rewards to authenticated;   -- nunca delete
grant select on public.profile_season_stats to authenticated;       -- tabelas "só leitura": nada além de select
grant select on public.v_seasons to authenticated;                  -- views: só select, mesmo as auto-atualizáveis
```
`mission_participants` e `challenge_participants` são as únicas com `grant delete to authenticated` (policy `admin`), porque `save_mission`/`save_challenge` são definer e não precisariam — o grant existe apenas para permitir edição direta pelo gestor em ferramentas de suporte; pode ser omitido sem afetar o app.

Índices exigidos pelas policies: `profiles(id)` (PK), `profiles(status)`, `point_entries(profile_id, ...)`, `season_goals(profile_id)`, `reward_redemptions(profile_id, status)`, `notifications(profile_id, ...)`, `wheel_spins(status, ...)`, `milestone_awards` (PK começa por profile_id), `profile_boosts(profile_id, expires_at)`.

---

## 11. Storage

Bucket único `avatars`:
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1572864, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
```
- Público para leitura (URL `…/storage/v1/object/public/avatars/<path>`), **sem SVG/GIF** (XSS/phishing).
- Convenção de caminho: `<profile_id>/avatar-<epoch_ms>.<ext>` (nome novo a cada upload para furar o cache da CDN; o front grava o novo `avatar_path` e apaga o anterior).
- Policies em `storage.objects` (o script cria com `drop policy if exists` — no PGlite as funções `storage.foldername` precisam de shim):

| policy | comando | papel | expressão |
|---|---|---|---|
| avatars_select_members | SELECT | authenticated | `bucket_id = 'avatars' and (select public.is_active_member())` |
| avatars_insert_own_or_admin | INSERT | authenticated | `bucket_id = 'avatars' and (select public.is_active_member()) and name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9]{10,16}\.(jpg\|jpeg\|png\|webp)$') and (select public.avatar_count((select auth.uid()))) < 3` **ou** (`(select public.is_admin()) and name ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpg\|jpeg\|png\|webp)$'`) |
| avatars_update_own_or_admin | UPDATE | authenticated | using e with check idem (mesmo regex de nome) |
| avatars_delete_own_or_admin | DELETE | authenticated | `bucket_id = 'avatars' and (select public.is_active_member()) and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))` |

(`public.avatar_count` é `security definer` com `grant execute to authenticated` (§6.1): a policy do Storage roda como o invocador, que não tem `USAGE` em `private` — mesma regra de §2.1; a função é pura e só conta objetos da pasta informada.)

- **Sem SELECT para `anon`/`public`**: a policy anterior (`to public using (bucket_id = 'avatars')`) permitia a qualquer pessoa com a chave publicável chamar `storage.from('avatars').list('')` e enumerar todos os `profile_id` e caminhos, e a um colaborador inativo listar. A leitura direta do objeto em bucket público (`/storage/v1/object/public/avatars/<path>`) **não** passa por policy, então `getPublicUrl` continua funcionando para o `<img>`; `list`/`download` pela API exigem membro ativo.
- **Nome fechado + cota**: a policy antiga só checava o 1º segmento da pasta — um colaborador podia subir arquivos ≤ 1,5 MB ilimitados com nomes arbitrários (~700 uploads esgotam 1 GB do plano Free e o Storage passa a recusar avatar de todos). Agora o nome precisa ser `<uid>/avatar-<epoch_ms>.<ext>` e a pasta aceita no máximo 3 objetos. O front, antes de subir, lista a própria pasta e apaga tudo que não seja o `avatar_path` atual (policy de DELETE própria); ao gravar o novo `avatar_path`, apaga o anterior. Se a cota estourar, o Storage devolve 403 e o front mostra "Limpe fotos antigas e tente de novo" com o botão que faz essa limpeza.
- `profiles.avatar_path` guarda só o caminho e tem o **mesmo** regex no CHECK (§4.6); `protect_profile_columns` impede não-admin de apontar para pasta alheia. O front monta a URL com `storage.from('avatars').getPublicUrl(path).data.publicUrl` (síncrono).
- Não há trigger de limpeza server-side em `storage.objects` (opcional no futuro: AFTER INSERT apagando os mais antigos da mesma pasta); a cota de 3 já limita o abuso.

---

## 12. Realtime

```sql
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.wheel_queue, public.wheel_spins, public.wheel_prizes, public.notifications, public.feed_events;
  end if;
end $$;
alter table public.wheel_queue replica identity full;
alter table public.wheel_spins replica identity full;
alter table public.wheel_prizes replica identity full;
alter table public.notifications replica identity full;
```
- `postgres_changes` respeita RLS: colaborador recebe `wheel_queue`/`wheel_spins` (públicos), só as próprias `notifications`, e o `feed_events` público. `point_entries` **não** entra na publicação (o front invalida `['ledger']` após mutations; para o colaborador ver o dashboard atualizar quando o gestor lança, o canal em `feed_events`/`notifications` já dispara a invalidação).
- Nunca usar Broadcast do cliente para transportar o prêmio: o resultado sai da RPC (quem clicou) ou do INSERT em `wheel_spins` (as outras telas).

---

## 13. Seed (catálogo — nenhuma pessoa, entry, fila ou resgate fictício)

Regra: o seed cria **apenas** catálogo e configuração. **Não existem usuários, perfis, lançamentos, missões, desafios, giros, resgates ou notificações fictícios.** Toda tela nasce em estado vazio bem desenhado até o primeiro admin se cadastrar e lançar dados reais. Todos os inserts são `on conflict do nothing` (idempotentes) e usam chaves naturais estáveis (`code`, `kind`, `lower(name)`).

### 13.1 `app_settings` (1 linha)
`(id=1, company_name='Orbion', xp_per_level=400, currency='BRL', timezone='America/Sao_Paulo', target_conversion_pct=25, target_attendance_pct=70, target_crm_pct=95, target_activities_count=1000, rank_admins=true, auto_approve_members=false)`. O fuso deve ser conferido **antes** do primeiro lançamento (`TIMEZONE_LOCKED` depois).

### 13.2 `app_secrets` (1 linha)
`(id=1, team_code = upper(encode(extensions.gen_random_bytes(6),'hex')), bootstrap_email = null, bootstrap_done = false)`. O código é **gerado aleatoriamente na execução do script** (cada instalação recebe um diferente); o gestor lê o valor na tela Configurações depois do primeiro login. A linha é obrigatória (`BOOTSTRAP_NOT_CONFIGURED` sem ela) e o script inteiro roda em `begin; ... commit;` para nunca ficar pela metade. O primeiro admin é criado pelo Dashboard **imediatamente** após aplicar o schema e **antes** de publicar a URL (§16.1); `bootstrap_email` é trava adicional opcional (`update public.app_secrets set bootstrap_email = 'dono@empresa.com' where id = 1;` — Apêndice B.1) e só é compatível com o caminho do Dashboard (§6.4).

### 13.3 `seasons` (1 linha ativa, nomeada pelo mês corrente)
```sql
insert into public.seasons (name, starts_at, ends_at, team_goal_amount, xp_per_level, is_active)
select
  (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'])
    [extract(month from (now() at time zone 'America/Sao_Paulo'))::int]
  || ' ' || extract(year from (now() at time zone 'America/Sao_Paulo'))::int,                    -- "Setembro 2026"
  date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo',                       -- 1º dia 00:00 local
  (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo', -- 1º dia do mês seguinte (exclusivo)
  0, 400, true
where not exists (select 1 from public.seasons);
```
Nomes em português via array (não depende de `lc_time`). `team_goal_amount = 0` até o gestor definir. O fuso é o literal do seed porque `app_settings` acabou de ser inserido com o mesmo valor.

### 13.4 `point_rules` (10 regras; `coins = points`)
| sort | name | metric | points | coins | trigger_kind | amount_step | requires_amount |
|---|---|---|---|---|---|---|---|
| 1 | Reunião agendada | meeting_scheduled | 10 | 10 | manual | | false |
| 2 | Reunião realizada | meeting_held | 20 | 20 | manual | | false |
| 3 | Venda realizada | sale | 100 | 100 | manual | | **true** |
| 4 | R$ 10.000 vendidos | amount_step | 150 | 150 | auto_amount_step | 10000 | false |
| 5 | Meta semanal | weekly_goal | 200 | 200 | manual | | false |
| 6 | Meta mensal | monthly_goal | 500 | 500 | auto_goal | | false |
| 7 | CRM atualizado | crm_update | 10 | 10 | manual | | false |
| 8 | Recuperação de lead | lead_recovery | 30 | 30 | manual | | false |
| 9 | Upsell | upsell | 80 | 80 | manual | | false |
| 10 | Ligação realizada | call | 5 | 5 | manual | | false |

Sem a regra `call`, a missão-exemplo do inventário ("Fazer 5 ligações") não teria como progredir até o gestor criar a regra. O gestor pode zerar pontos/moedas dela: uma regra 0/0 continua gerando entry (CK de §4.11) e alimentando missões, contando como dia de streak, sem inflar o ranking.

Regras `auto_*` não aparecem no seletor de "Lançar pontos" (o front filtra `trigger_kind = 'manual'`), mas aparecem na lista de regras para edição de pontos/ativação. "Meta semanal" lançada manualmente é deduplicada por semana ISO (`milestone_awards`, `period_key = public.iso_week_key(public.local_day(occurred_at))`, sem `season_id`) em `record_rule_entry`: segunda vez na mesma semana → erro `MILESTONE_ALREADY_AWARDED` (§9).

### 13.5 `wheels` (2) e `wheel_prizes` (6 + 8)
`wheels`: `(kind='classic', name='Roleta Clássica')`, `(kind='premium', name='Roleta Premium')`.

Clássica (peso 1 cada; cores sugeridas em sequência `#F97316, #22C55E, #3B82F6, #A855F7, #EF4444, #EAB308`):
| sort | label | kind | value |
|---|---|---|---|
| 0 | R$ 10 PIX | cash | 10 |
| 1 | 100 pontos | points | 100 |
| 2 | R$ 20 PIX | cash | 20 |
| 3 | Giro extra | extra_spin | null |
| 4 | R$ 30 iFood | voucher | 30 |
| 5 | 200 pontos | points | 200 |

Premium (peso 1 cada; cores `#F97316, #22C55E, #3B82F6, #A855F7, #EF4444, #EAB308, #14B8A6, #EC4899`):
| sort | label | kind | value |
|---|---|---|---|
| 0 | R$ 50 PIX | cash | 50 |
| 1 | 500 pontos | points | 500 |
| 2 | R$ 100 PIX | cash | 100 |
| 3 | Giro extra | extra_spin | null |
| 4 | R$ 50 iFood | voucher | 50 |
| 5 | 1.000 pontos | points | 1000 |
| 6 | 2x pontos | multiplier | 2 |
| 7 | Mystery Box | mystery | null |

### 13.6 `achievements` (6)
| sort | code | title | description | icon | criteria | value | scope | reward_points | reward_coins |
|---|---|---|---|---|---|---|---|---|---|
| 1 | first_sale | PRIMEIRA VENDA | Realize sua primeira venda | 🎯 | first_sale | null | lifetime | 50 | 50 |
| 2 | on_fire | EM CHAMAS | 7 dias consecutivos com atividade | 🔥 | streak_days | 7 | lifetime | 100 | 100 |
| 3 | club_50k | 50K CLUB | R$ 50.000 vendidos | 💎 | sales_total | 50000 | lifetime | 300 | 300 |
| 4 | goal_reached | META BATIDA | Bateu a meta mensal | ✅ | monthly_goal | null | season | 200 | 200 |
| 5 | champion | CAMPEÃO | 1º lugar no mês | 🏆 | rank_first | null | season | 500 | 500 |
| 6 | club_100k | 100K CLUB | R$ 100.000 vendidos | 👑 | sales_total | 100000 | lifetime | 600 | 600 |

Os pontos/moedas de conquista são valores iniciais editáveis pelo gestor (Apêndice B.5).

### 13.7 `rewards` (7)
| sort | name | category | value_amount | cost_coins | stock | icon |
|---|---|---|---|---|---|---|
| 1 | R$ 20 iFood | Voucher | 20 | 500 | null | 🍔 |
| 2 | R$ 50 iFood | Voucher | 50 | 1000 | null | 🍕 |
| 3 | R$ 50 PIX | PIX | 50 | 1200 | null | 💸 |
| 4 | R$ 100 PIX | PIX | 100 | 2200 | null | 💰 |
| 5 | Almoço pago | Benefício | null | 1500 | null | 🍽️ |
| 6 | Sair 2h mais cedo | Benefício | null | 1800 | null | ⏰ |
| 7 | Day Off | Benefício | null | 5000 | null | 🏖️ |

### 13.8 O que o seed NÃO cria
`profiles`, `profile_private`, `season_goals` (criadas no signup/create_season), `point_entries`, `missions`, `challenges`, `special_events`, `wheel_queue`, `wheel_spins`, `reward_redemptions`, `profile_achievements`, `feed_events`, `notifications`, `audit_log`. O `EventBanner`, o `LightningMission`, o `DuelCard`/`TeamChallenge` e o feed nascem vazios e o front mostra estado vazio ("Nenhum evento agendado", "Sem missão relâmpago hoje", etc.).

---

## 14. Fluxos de negócio

### 14.1 Cadastro — bootstrap do admin e entrada por `team_code`
1. Implantador aplica `schema.sql` no SQL Editor (transação única): cria tudo, seed gera `app_secrets.team_code` aleatório, temporada do mês corrente fica ativa. Confere `app_settings.timezone` (trava depois do 1º lançamento). Opcional: `update app_secrets set bootstrap_email = 'dono@empresa.com'`.
2. **Antes de publicar a URL na Vercel**, o implantador cria o primeiro admin no Dashboard: Authentication → Users → *Add user* → *Create new user*, com e-mail, senha e **Auto confirm** marcado (§16.1). Isso insere em `auth.users` sem `team_code` e com `email_confirmed_at` preenchido → `handle_new_user`: advisory lock → não há admin e `bootstrap_done = false` (e `bootstrap_email` nulo ou igual) → cria `profiles (role='admin')`, `profile_private`, `profile_lifetime_stats`, `season_goals` da temporada ativa, marca `bootstrap_done = true`. A partir daqui nenhum cadastro público pode virar admin.
3. Caminho alternativo (só ambiente local/teste): a tela de cadastro chama `signup_mode()` → `'first_admin'` (formulário sem código) e o dono faz `auth.signUp({ email, password, options: { data: { full_name } } })`. Em produção esse caminho **não** é usado, porque a URL e a chave publicável ficam no bundle e qualquer pessoa poderia se cadastrar primeiro — com *Confirm email* ligado, nem precisaria confirmar. Um segundo cadastro simultâneo espera o lock, encontra o admin e é tratado como colaborador (precisa de código → falha se não tiver).
4. Admin abre Configurações: lê `app_secrets.team_code`, define nome da empresa, meta do time, revisa a temporada; decide se liga "Aprovar novos membros automaticamente" (`update_app_settings({auto_approve_members:true})` — default desligado, Apêndice B.21); compartilha o código.
5. Colaborador: `signup_mode()` → `'team_code'`; front chama `validate_team_code(code)` (só UX, sem throttle) e então `auth.signUp({ ..., data: { full_name, team_code } })`. Trigger valida de novo (com `into strict` e `is distinct from`); código errado → signup abortado com `INVALID_TEAM_CODE` no `detail` (o GoTrue devolve "Database error saving new user"; o front já mostrou a mensagem correta na pré-validação). Sucesso → perfil `collaborator` com `status = 'pending'` (ou `active` se `auto_approve_members = true`), `season_goals` com meta 0. Pendente: notificação `system` "Novo membro aguardando aprovação" para todos os gestores ativos (`notify_admins`); a tela de sucesso do cadastro explica que um gestor precisa aprovar. Auto-aprovado: notificação "Novo membro" para todos, como antes. Se *Confirm email* estiver ligado (§16.2: opcional em produção), o colaborador só faz login depois de confirmar; em qualquer caso, enquanto `pending`, o login leva à tela `/aguardando` e o banco não devolve nada além de `{me:{status:'pending'}}`.
6. Front chama `updateUser({ data: { team_code: null } })` — obrigatório; se falhar, repete a cada `get_bootstrap()` enquanto `user.user_metadata.team_code` existir — e depois `get_bootstrap()`.
7. **Aprovação**: o gestor abre Equipe → seção "Pendentes" (badge com `get_bootstrap().pending_members` na sidebar) → "Aprovar" = `admin_update_profile(id, {status:'active'})` (auditoria, `season_goals` da temporada ativa, notificação "Cadastro aprovado" ao membro e "Novo membro" ao time) ou "Recusar" = `admin_update_profile(id, {status:'inactive'})` (auditoria; sem notificação; pode ser aprovado depois). Só então o admin edita cargo/equipe/meta/telefone do novo membro via `admin_update_profile`; lança pontos iniciais, se houver, com `record_initial_points` (recusado com `PROFILE_INACTIVE` enquanto pendente). Ao terminar o onboarding da equipe, a UI de Configurações lembra: "Todos já entraram? Gere um novo código" (`rotate_team_code`) — o código circula por WhatsApp e continua válido até ser trocado.
8. Para inativar: `admin_update_profile(id, {status:'inactive'})` → fila da roleta limpa, duelos ativos cancelados (§7.2); a partir do próximo request `is_active_member()` é false e todas as policies/RPCs negam; `get_bootstrap` devolve `{me:{status:'inactive'}}`; o front recebe `PROFILE_INACTIVE`/42501 e faz `signOut()`. A sessão aberta não é derrubada pelo banco (§16.3). Um pendente está, para o banco, nesse mesmo estado desde o cadastro — a diferença é só a mensagem da tela `/aguardando` e o botão "Verificar novamente".

### 14.2 Admin registra uma venda
1. Tela "Lançar pontos": admin escolhe colaborador, regra "Venda realizada" (`requires_amount`), quantidade 1, valor R$ 8.500, data (default agora), motivo opcional → `record_rule_entry(profile, rule, 1, 8500, now(), null)`.
2. `before_point_entry`: `season_id` = temporada que contém `occurred_at`; regra ativa → `metric='sale'`, `base_points=100`, `coins=100`; evento especial ativo às 14h–16h com 2x e `occurred_at` dentro → `multiplier=2`, `points=200`, `special_event_id` gravado; `created_by = auth.uid()`.
3. `after_point_entry`: stats da temporada (`points += 200`, `sales_amount += 8500`, `sales_count += 1`, `activities_count += 1`), lifetime (`sales_amount`, `first_sale_at` se primeira, streak do dia); marcos: `floor(sales_amount/10000)` blocos → se cruzou R$ 10k, entry `system` de +150/+150 (`amount_step`, `block:k`) e `milestone_awards`; meta mensal: se `sales_amount >= season_goals.goal_amount` e ainda não premiado → entry +500/+500 e conquista META BATIDA; missões com `metric='sale'` na janela (ex.: relâmpago "Realize uma venda hoje"); conquistas `first_sale`/`sales_total`; desafios ativos (`sales_count`, `revenue`, `points`, `activities`); feed `sale {amount: 8500}`; level-up se cruzou múltiplo de `xp_per_level` → feed + notificação.
4. Retorno da RPC: a entry com `points=200`, `multiplier=2`. Front invalida `['ledger']` e `['bootstrap']`; o colaborador vê pontos/ranking atualizados no próximo fetch (ou ao receber `feed_events` no canal Realtime).
5. Errou? Admin abre o histórico e clica "Estornar" → `reverse_entry(entry_id, 'Venda cancelada pelo cliente')`: entry `system` com `-200/-100/-8500`, **mesmo `occurred_at` e mesma temporada** da original (o histórico mostra o estorno na data da venda, com "estornado em {created_at}"); stats decrementam; progresso da missão/desafio do período da venda é reduzido (não o de hoje); streak é recalculado sem aquele dia; se as 100 moedas já tinham sido gastas, o saldo fica negativo ("Saldo devedor", B.15); missão já concluída **não** é desfeita (recompensa fica; o admin pode estornar a entry `mission` separadamente); marcos já pagos ficam (o bloco de R$ 10k só será concedido de novo quando `sales_amount` voltar a cruzar — a chave `block:k` impede pagar duas vezes).

### 14.3 Missão conclui automaticamente e alimenta a fila da roleta
1. Admin cria missão relâmpago via `save_mission({ kind:'lightning', metric:'sale', target_kind:'count', target_value:1, reward_points:50, reward_coins:50, reward_spin:'premium', starts_at: hoje 09:00, ends_at: hoje 18:00, audience:'all' })`. Trigger valida janela (≤ 24 h, dentro da temporada).
2. Colaborador vê a missão em `v_mission_board` (`is_current`, `progress_value=0`, `seconds_remaining` para o contador).
3. Admin lança a venda (14.2). `after_point_entry` B2: `mission_period(lightning, occurred_at)` = `('once', starts, ends)`; upsert `mission_progress value=1`; `update ... completed_at=now() where completed_at is null and value >= 1 returning` → concluiu: entry `source='mission'` +50/+50 (`reason='Realize uma venda hoje'`), `wheel_queue (profile, person_name, wheel=premium, source='earned', reference='mission_progress', reference_id=mission:profile:once, attempts=1)` → `mission_progress.queue_id`; `missions_completed += 1`; feed `mission_completed`; notificação "Missão concluída".
4. `v_mission_board` mostra "✅ MISSÃO CONCLUÍDA"; `v_profile_stats.pending_earned_spins = 1` (card NextReward: "Você tem 1 giro na Roleta Premium aguardando liberação"); `v_wheel_queue` lista a pessoa com `source='earned'`, posição pela ordem de chegada.
5. Missão diária "Fazer 5 ligações": amanhã o período muda (`period_key` = nova data) e o progresso começa em 0 de novo; a conclusão de ontem fica registrada em `mission_progress` com sua `period_key`.

### 14.4 Gestor libera a vez e aprova o giro
1. Tela da roleta (gestor): fila em `v_wheel_queue`. Gestor clica "Liberar giro" → `release_turn(queue_id)`: lock `wheel_turn`; não há spin pendente; outra entrada `active` volta a `waiting`; a escolhida vira `active` (`released_at`); notificação "Sua vez na roleta!". Realtime (`wheel_queue` UPDATE) atualiza a TV/celulares: "VEZ DE {NOME} • Tentativa 1 de 1".
2. Gestor (ou o próprio colaborador no celular, `queue.profile_id = auth.uid()`) clica "GIRAR ROLETA" → `spin_wheel(queue_id)`: `for update` na fila, checa `active`, tentativas, ausência de pendente; `draw_prize` com CSPRNG por peso; se "Mystery Box", resolve na hora entre os prêmios comuns; grava `wheel_spins pending` com snapshots, `random_value`, `prizes_hash`; retorna `prize`, `resolved_prize`, `sector_index`, `prizes_hash`.
3. Quem clicou anima a partir do retorno; as outras telas recebem o INSERT em `wheel_spins` pelo Realtime e animam com o mesmo `prize_id`. Ambas param no setor de `prize.id` (localizado na lista de prêmios carregada; se `prizes_hash` divergir, recarregam antes de animar). Modal: "Mystery Box → você ganhou R$ 50 PIX".
4. Estado "AGUARDANDO APROVAÇÃO • R$ 50 PIX". Gestor clica "Aprovar prêmio e concluir giro" → `approve_spin(spin_id)`: `update ... where status='pending' returning` (segundo clique/segundo gestor → `SPIN_NOT_PENDING`); crédito conforme `resolved_kind`: `cash` → `reward_redemptions (source='wheel', status='approved', value_amount=50, cost_coins=0)` (aparece na lista de resgates do gestor para entrega, e em "Recompensas (R$ entregues)" após `deliver`); `points` → entry `wheel`; `coins` → entry `wheel`; `extra_spin` → `attempts_allowed+1`; `multiplier` → `profile_boosts` 24 h; `attempts_used += 1`; se esgotou → `done`. Feed `wheel_prize`, notificação, auditoria.
5. "Fechar sem aprovar" → `reject_spin`: spin `rejected`, tentativa **não** consumida, vez continua `active` (pode girar de novo).
6. Convidado (nome manual): pode girar e ser aprovado; `cash`/`voucher` viram `reward_redemptions` com `profile_id null` + `person_name`; `points`/`coins`/`multiplier` ficam só no histórico (`credited=false`).
7. Giro livre: qualquer membro ativo chama `spin_wheel_free('classic')`; nada é gravado; modal "Giro livre — sem crédito".

### 14.5 Colaborador resgata uma recompensa
1. Carteira: `v_wallet` (saldo vitalício e origens), "últimos 3 créditos" (query direta em `point_entries` próprias), loja em `rewards` (`is_active`, `deleted_at is null`, `order sort_order`); card mostra "Resgatar" se `cost_coins <= coins_balance`, senão "Faltam N moedas".
2. Clique em "Resgatar" → `redeem_reward(reward_id)`: advisory lock `wallet:<uid>` (duplo clique/duas abas serializam); `rewards for update`; saldo = `SUM(coins)` do ledger sob o lock; estoque decrementado atomicamente (`stock > 0`); entry `reward` `-cost_coins`; `reward_redemptions requested`; notificação aos gestores. Retorno `{ redemption_id, coins_balance }` — o front atualiza o chip de moedas imediatamente.
3. Gestor: `v_redemptions` (filtro `status`) → `handle_redemption(id, 'approve')` → `('deliver', 'Entregue no PIX 12/09')` (entra em `v_admin_kpis.redemptions_delivered_amount`), ou `('cancel', 'Sem estoque no fornecedor')` → entry de estorno `+cost_coins` (`refund_entry_id`), estoque devolvido, notificação ao colaborador.
4. Colaborador vê seus pedidos em `reward_redemptions` (RLS) com status e notas.

### 14.6 Desbloqueio de conquista
- **Instantâneas** (no `after_point_entry`, para entries positivas de `rule`/`manual`/`system`): `first_sale` (primeira venda com `amount > 0`), `streak_days` (streak vitalício ≥ 7 no dia da entry), `sales_total` (50K/100K vitalício), `points_total`/`missions_completed` (se o gestor criar). `insert ... on conflict do nothing returning` garante uma vez por escopo (lifetime: uma na vida; season: uma por temporada). Se `reward_points/coins > 0`, entry `achievement` (`reason = title`) creditada na mesma temporada da entry gatilho; feed `achievement`; notificação.
- **META BATIDA**: concedida por `private.evaluate_goal_milestone` (§6.9) junto com o marco "Meta mensal" (+500/+500) — chamada na venda (B1), quando o gestor muda a meta (`admin_update_profile`, trigger em `season_goals`), ao ativar a temporada e no fechamento. O colaborador vê o troféu no mesmo instante em que bate a meta; quem "bate" porque o gestor reduziu a meta recebe exatamente o mesmo marco + conquista, na hora.
- **Conquistas de acúmulo** (`points_total`, `missions_completed`): avaliadas para **toda** entry positiva (B3'), inclusive roleta/desafio/missão/conquista — não só em lançamento de regra.
- **CAMPEÃO**: exclusivamente em `close_season` (1º lugar do ranking final). Nunca avaliado durante a temporada (o líder do dia 3 não recebe nada).
- `v_achievement_board` mostra "3 de 6" (`is_unlocked`) e `unlocked_count` para as repetíveis por temporada.

### 14.7 Evento especial (multiplicador)
1. Admin cria em Configurações: `save_special_event({ name: 'Hora do Fogo', multiplier: 2, starts_at: hoje 14:00 local, ends_at: hoje 16:00 local })` (§7.2; a policy admin permitiria o insert direto, mas o front usa a RPC para receber `EVENT_OVERLAP`/`EVENT_RANGE_INVALID` em vez de `23P01`/`23514` crus). EXCLUDE impede sobreposição com outro evento ativo. Trigger `notify_special_event` avisa todos (quem tem `event_alerts=false` não recebe).
2. `v_special_events.state` → `upcoming` (banner com "começa em HH:MM:SS" calculado no front a partir de `starts_at`) → `live` ("TODOS OS PONTOS EM DOBRO") → `ended` (banner some).
3. Lançamentos com `source='rule'` e `occurred_at` dentro da janela recebem `multiplier=2` (`base_points` preservado para auditoria: histórico mostra "100 × 2 = 200"). Lançamento retroativo dentro da janela também dobra (regra por `occurred_at`); lançado durante a janela mas com `occurred_at` fora, não dobra. Moedas não dobram. Entries manuais/missão/roleta não dobram. Boost "2x pontos" da roleta usa a mesma mecânica; se coincidir com evento, vale o maior (não acumula).
4. Estorno de uma entry dobrada devolve `-200` (copia `points` da original), mantendo o ledger consistente.

### 14.8 Virada de temporada
1. Antes do fim do mês o gestor cria a próxima: `create_season('Outubro 2026', '2026-10-01', '2026-10-31', 250000)` (EXCLUDE garante que começa depois do fim da atual; `xp_per_level` congelado; `season_goals` copiadas de `default_goal_amount`).
2. No último dia (ou no primeiro do mês seguinte) o gestor clica "Encerrar temporada" → `close_season(atual)`: janelas de missões/desafios são clampadas ao novo fim, desafios ativos são finalizados (prêmios pagos), `season_results` grava o pódio final (todos os perfis ativos), CAMPEÃO (só se alguém tem `points > 0`) e META BATIDA (marco + conquista) são concedidos (entries datadas dentro da temporada), `is_active=false`, `closed_at`, feed `season_closed` ("Setembro 2026 encerrada — campeão: {nome}" ou "— sem campeão"), notificação global. Se fechou antes do fim, `ends_at` é encurtado para a próxima meia-noite local e, se a próxima temporada começa depois disso, a resposta traz `warnings: ['gap_until_next_season']` e o front oferece "Antecipar início da próxima".
3. `activate_season(próxima)` — **só a partir de `starts_at`** (`SEASON_NOT_STARTED` antes; o front mostra "Começa em 01/10"): desativa a anterior (já inativa) e ativa a nova; `get_bootstrap().season` muda; chip do topbar passa a "Temporada Outubro 2026". Entre o encerramento antecipado e a meia-noite não há temporada ativa (o front mostra "Próxima temporada começa em …"). Ranking, nível, metas e missões começam do zero (`profile_season_stats` novo); moedas, streak e conquistas vitalícias continuam.
4. Lançamento esquecido de 30/09 feito em 02/10: `record_rule_entry(..., occurred_at='2026-09-30 17:00')` → `season_for` = Setembro → **fechada** → `SEASON_CLOSED`. O gestor tem duas opções: reabrir não existe; lança com `occurred_at` de outubro (vai para a nova temporada) ou registra como estorno/ajuste manual em outubro com motivo. Estornos de entries de setembro continuam permitidos (correção contábil).
5. Se ninguém encerrar: a temporada de setembro continua `is_active` e cobrindo só até 30/09; em 01/10 qualquer lançamento cai em `NO_SEASON_FOR_DATE` (não existe temporada de outubro) — o front mostra ao gestor o estado "Crie/ative a próxima temporada" quando `season.ends_at < now()`. Sem `pg_cron` (Apêndice A.7).

---

## 15. Ordem dos arquivos de migration (para o agente de SQL)

`supabase/schema.sql` = concatenação idempotente dos arquivos abaixo, **obrigatoriamente** envolta em `begin; ... commit;` (um schema aplicado pela metade — sem a linha de `app_secrets`, sem RLS numa tabela — não pode existir; o CI falha se o arquivo não começar com `begin;` e terminar com `commit;`). Os mesmos arquivos ficam em `supabase/migrations/` com prefixo de timestamp, e são os que o harness PGlite aplica em ordem.

1. `0001_extensions_schemas_grants.sql` — schemas `private`/`extensions`, extensões, `alter default privileges for role postgres ... revoke` + `revoke ... on all` (§2.1–2.2).
2. `0002_enums.sql` — §3.
3. `0003_tables_core.sql` — app_settings, app_secrets, seasons, profiles, profile_private, season_goals, season_results, profile_season_stats, profile_lifetime_stats, audit_log (tabelas sem dependência do ledger).
4. `0004_tables_catalog.sql` — point_rules, special_events, wheels, wheel_prizes, rewards, achievements, missions, mission_participants, challenges, challenge_participants.
5. `0005_tables_facts.sql` — point_entries, profile_boosts, milestone_awards, mission_progress, wheel_queue, wheel_spins, reward_redemptions, challenge_results, profile_achievements, feed_events, notifications (FKs circulares — `point_entries.boost_id` → `profile_boosts` → `wheel_spins` → `point_entries` — resolvidas com `alter table ... add constraint` ao final do arquivo).
6. `0006_helpers.sql` — §6.1–6.3 (helpers públicos — inclusive `local_day`/`local_today`/`iso_week_key`/`mission_period` com grant — e privados, genéricos).
7. `0007_trigger_functions.sql` — §6.4–6.9.
8. `0008_triggers.sql` — §8.
9. `0009_views.sql` — §5.
10. `0010_rpcs.sql` — §7 (+ grants).
11. `0011_rls.sql` — enable RLS + policies; **no fim**: `revoke all on all tables in schema public from anon, authenticated; revoke all on all functions in schema public from anon, authenticated, public; revoke all on all sequences in schema public from anon, authenticated;` seguido dos grants explícitos de §6.1/§7.9/§10 (tabela, coluna, view, função).
12. `0012_storage_realtime.sql` — §11–12 (com guardas `do $$ if exists $$` para PGlite).
13. `0013_seed.sql` — §13.

Testes obrigatórios no harness PGlite (RLS sob `set local role authenticated` + claims): (a) colaborador não lê `point_entries` alheias nem `app_secrets`; (b) colaborador não consegue `update profiles set role`; (c) dois `approve_spin` concorrentes → um `SPIN_NOT_PENDING`; (d) `redeem_reward` com saldo insuficiente/estoque 0 falha; (e) missão diária conclui uma vez por dia; (f) entry retroativa cai na temporada certa; (g) `close_season` concede CAMPEÃO ao 1º e nada quando todos têm 0 pontos; (h) último admin não pode ser inativado; (i) estorno inverte sinais, herda `occurred_at`/`season_id` e reduz o progresso de missão do período original; (j) usuário inativo: `get_bootstrap()` devolve só `{me:{status:'inactive'}}` e qualquer view/tabela devolve 0 linhas; o mesmo para usuário **pendente** (`{me:{status:'pending'}}`, 0 linhas, `redeem_reward`/`spin_wheel_free` → `PROFILE_PENDING`, ausente de `v_ranking`/`v_mission_board`/`v_achievement_board`); (k) varredura de privilégios (§2.2): toda tabela com RLS, nenhum DELETE para `authenticated` fora de `mission_participants`/`challenge_participants`, views só SELECT, nenhuma função executável além da lista, `anon` sem nada; (l) `set local role authenticated` consegue `select * from v_mission_board`, `v_profile_stats`, `v_sales_timeline`, `v_seasons` (helpers em `public`); (m) cada RPC com uuid inexistente devolve `*_NOT_FOUND` (nunca erro cru); (n) signup com `team_code` errado, NULL, e sem linha em `app_secrets` falham (`INVALID_TEAM_CODE`/`BOOTSTRAP_NOT_CONFIGURED`), e `validate_team_code` nunca devolve NULL; (o) roleta: inativar com fila → `WHEEL_IN_USE`; inativar, apagar prêmios e reativar → `MIN_PRIZES`; `draw_prize` em roleta vazia → `NO_PRIZES`; `save_wheel_prizes` trocando 0↔1 funciona; (p) `conversion_pct` com 10 vendas e 1 reunião = 999.99 e a view não falha; `projected_goal_date` com R$ 0,01 vendidos é NULL; (q) estorno de moedas já gastas deixa `coins_balance` negativo e `redeem_reward` recusa até cobrir; (r) `record_initial_points` duas vezes → `INITIAL_POINTS_EXISTS`; `admin_update_profile` recusa chave `base_points`; (s) `update_app_settings({timezone})` após um lançamento → `TIMEZONE_LOCKED`; (t) `activate_season`/`close_season` de temporada futura → `SEASON_NOT_STARTED`; `close_season` antecipado clampa `ends_at` de missões/desafios; (u) inativar participante de duelo ativo cancela o duelo e remove sua fila da roleta; (v) `points_total` desbloqueia com pontos vindos da roleta; (w) reduzir `goal_amount` abaixo das vendas concede marco + META BATIDA; (x) Storage: anon não lista `avatars`; nome fora do padrão e 4º objeto na pasta são recusados; (y) aprovação de membros: signup com `team_code` válido e `auto_approve_members = false` cria `profiles.status = 'pending'` e uma notificação `system` para cada admin ativo (nenhuma para colaboradores nem para o próprio); com `auto_approve_members = true` nasce `active` com "Novo membro" para todos; `admin_update_profile({status:'active'})` sobre pendente grava `audit_log`, `season_goals` da temporada ativa e notificação "Cadastro aprovado" ao membro; `{status:'inactive'}` recusa sem notificação; `{status:'pending'}` → `PROFILE_STATUS_INVALID`; `record_initial_points`/`enqueue_wheel` sobre pendente → `PROFILE_INACTIVE`; `get_bootstrap().pending_members` conta só para admin e é `0` para colaborador.

---

## 16. Manual de implantação — trechos obrigatórios

O manual completo pertence ao documento de deploy (VERCEL/SUPABASE); os trechos abaixo são **obrigatórios** porque o modelo de dados depende deles.

### 16.1 Ordem de implantação (não negociável)
1. Criar o projeto Supabase; anotar URL e chave publicável — **não** colocá-las em nenhum deploy ainda.
2. SQL Editor → colar `supabase/schema.sql` (começa com `begin;`, termina com `commit;`) → Run. Conferir: `select bootstrap_done, team_code from public.app_secrets;` devolve 1 linha com `bootstrap_done = false`.
3. **Imediatamente**: Authentication → Users → *Add user* → *Create new user*: e-mail do dono, senha forte, **Auto confirm** marcado. O trigger `handle_new_user` cria o perfil `admin` e marca `bootstrap_done = true`. Conferir: `select role from public.profiles;` devolve `admin`.
4. Só então configurar as variáveis na Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) e publicar. A URL e a chave ficam no bundle público — qualquer pessoa que abra a URL pode chamar `auth.signUp`; por isso o passo 3 vem antes do 4. Sem o passo 3, o primeiro visitante viraria admin (com *Confirm email* ligado, sem nem confirmar o e-mail) e o dono ficaria trancado fora (`BOOTSTRAP_LOCKED`).
5. Fazer login com o admin, abrir Configurações, conferir fuso (trava após o 1º lançamento), decidir a auto-aprovação (default desligada: cada cadastro fica "Pendente" na tela Equipe até o gestor aprovar), copiar o `team_code` e só então convidar a equipe. Ao terminar o onboarding, aprovar os pendentes e gerar um novo código.

`bootstrap_email` (opcional) é uma trava a mais: preenchido antes do passo 3, o trigger só aceita esse e-mail **e** exige a linha já confirmada (`BOOTSTRAP_REQUIRES_CONFIRMED_EMAIL`), o que o caminho do Dashboard garante; um `auth.signUp` público com o e-mail do dono é abortado mesmo com *Confirm email* desligado. Não substitui o passo 3.

### 16.2 E-mail e confirmação
- **A aprovação pelo gestor é o gate de entrada** (Apêndice B.21, §6.4, §7.2): com `auto_approve_members = false` (default), quem se cadastra com o `team_code` nasce `pending` e **não lê nada** até um gestor aprovar na tela Equipe. Por isso, em produção, ***Confirm email* é OPCIONAL**: mesmo desligado, alguém que tenha o `team_code` (circula por WhatsApp) e se cadastre com o e-mail/nome de um colega fica pendente, não aparece no ranking, não lê dados da equipe e é recusado pelo gestor — que enxerga nome e e-mail do pedido antes de aprovar. O único efeito residual é que o e-mail usado fica ocupado em `auth.users` (o dono real precisa pedir ao gestor para recusar e apagar o usuário no Dashboard, §16.4 último parágrafo); ligar *Confirm email* elimina isso e continua recomendado quando há SMTP.
- **SMTP próprio continua obrigatório em produção** (Resend/SES/SendGrid — Authentication → Emails → SMTP Settings), por dois motivos independentes da confirmação: (1) **recuperação de senha** ("Esqueci a senha" em `/login` usa `resetPasswordForEmail`) só chega com SMTP próprio — sem ele o Auth só entrega e-mail para membros da organização Supabase; (2) se *Confirm email* for ligado, o e-mail de confirmação também depende do SMTP. Sem SMTP, deixe *Confirm email* **desligado** (senão colaborador nenhum consegue entrar) e oriente a equipe a pedir reset de senha ao gestor pelo Dashboard.
- Com `auto_approve_members = true` (gestor liga conscientemente em Configurações), o modelo volta ao antigo — novo colaborador nasce `active` na hora — e aí *Confirm email* ligado + SMTP voltam a ser **exigidos** em produção, com rotação do `team_code` ao fim do onboarding e revisão da lista de membros (é a única barreira contra cadastro com e-mail alheio).
- Piloto/teste: qualquer combinação; o harness (§15, teste (y)) cobre pendente e auto-aprovado.

### 16.3 Inativar não encerra sessões abertas
`admin_update_profile(id, {status:'inactive'})` faz o banco negar tudo no próximo request (todas as policies são `member and ...`, `get_bootstrap` devolve `{me:{status:'inactive'}}` e o front faz `signOut()`). Recusar um pendente (`pending → inactive`) é o mesmo mecanismo — e o pendente nunca teve nada além da tela `/aguardando`, então não há sessão "com dados" para derrubar. Mas o access token vale por até 1 h e o refresh token não expira sozinho; sem `service_role` no app ninguém revoga sessão alheia. Se o gestor precisar de efeito imediato numa sessão que não chama o app (ex.: aba aberta numa TV), ele encerra as sessões do usuário pelo Dashboard (Authentication → Users → usuário → encerrar sessões) — o banco já nega tudo de qualquer forma.

### 16.4 Recuperação de bootstrap tomado (executar como `postgres` no SQL Editor)
Se alguém se cadastrou antes do dono e virou admin:
```sql
begin;
-- 1. rebaixar e inativar o invasor (LAST_ADMIN e FORBIDDEN_COLUMN exigem desligar o trigger de proteção)
alter table public.profiles disable trigger profiles_protect_columns;
update public.profiles set role = 'collaborator', status = 'inactive' where id = '<uuid do invasor>';
alter table public.profiles enable trigger profiles_protect_columns;
-- 2. reabrir o bootstrap (BOOTSTRAP_LOCKED exige desligar o trigger de app_secrets)
alter table public.app_secrets disable trigger app_secrets_protect;
update public.app_secrets set bootstrap_done = false, updated_at = now() where id = 1;
alter table public.app_secrets enable trigger app_secrets_protect;
-- 3. opcional: travar o próximo bootstrap ao e-mail do dono
update public.app_secrets set bootstrap_email = 'dono@empresa.com' where id = 1;
commit;
```
Depois: criar o dono pelo Dashboard (§16.1 passo 3), rotacionar o `team_code` na tela Configurações e revisar `audit_log`/`profiles` por outras contas criadas pelo invasor. O usuário do invasor **não** pode ser apagado em `auth.users` (FK `RESTRICT` de `profiles`) — fica inativo, o que basta. O mesmo vale para um cadastro **recusado** (`pending → inactive`): a linha fica; se o dono real do e-mail precisar se cadastrar, o implantador apaga as linhas de `profile_private`, `season_goals`, `profile_lifetime_stats` e `profiles` desse id no SQL Editor (como `postgres`, sem histórico de ledger — um pendente nunca teve entries) e só então o usuário no Dashboard.

---

## Apêndice R — Rastreabilidade: achados críticos/altos → resolução

| lente | achado | resolução (seção) |
|---|---|---|
| Integridade C | recursão/corrida no trigger de missões | §6.7: filtro `source in ('rule','manual','system')`, fusível `pg_trigger_depth() > 4`, advisory lock `progress:<uid>`, conclusão por `update ... where completed_at is null returning`, `mission_progress.entry_id` UNIQUE |
| Integridade C | approve_spin/reject/finish sem transição atômica | §7.5–7.6: `update ... where status = X returning` + `SPIN_NOT_PENDING`/`CHALLENGE_NOT_ACTIVE`; `wheel_spins.entry_id` UNIQUE; `challenge_results` com `entry_id` UNIQUE |
| Integridade C | redeem double-spend / estoque | §7.7: lock `wallet:<uid>`, `rewards for update`, saldo no ledger sob lock, `update rewards set stock = stock - 1 where stock > 0`, `CK stock >= 0`, `handle_redemption('cancel')` com `refund_entry_id` |
| Integridade C | release_turn/spin_wheel duplicados | §7.6: lock `wheel_turn`, `for update`, `wheel_spins(queue_id) where pending` UNIQUE, `wheel_queue ((true)) where active` UNIQUE, checks de tentativas |
| Integridade C | ledger mutável | §4.11: sem policy/grant de UPDATE/DELETE, trigger `forbid_ledger_mutation`, `reverses_entry_id` UNIQUE, `reverse_entry` |
| Integridade H | multiplicador sobrescreve valor | §4.11/§6.6: `base_points`, `multiplier`, `special_event_id`, `boost_id`; EXCLUDE gist em `special_events`; só `source='rule'` |
| Integridade H | season_id pela temporada ativa | §1.4/§6.6: `season_for(occurred_at)`, timestamptz, EXCLUDE, `closed_at`, `SEASON_CLOSED` |
| Integridade H | bootstrap race, último admin, inativo com sessão | §6.4 lock + `into strict`; §6.5 `LAST_ADMIN`; `member and (...)` em todas as policies/RPCs (§10); §16.3 sessões |
| Integridade H | checks por source | §4.11 |
| Integridade H | escopo das moedas | §1.5: saldo vitalício em `profile_lifetime_stats`; pontos por temporada |
| Integridade H | regras derivadas (10k, semanal, mensal) | §4.10 `trigger_kind`/`amount_step`, §4.12 `milestone_awards`, §6.7 B1, §7.4 dedupe semanal |
| Integridade H | conquistas sem recompensa/escopo | §4.27–4.28: `reward_*`, `scope`, `season_id` + índices únicos parciais, `close_season` |
| Integridade H | semântica dos prêmios | §7.6 approve_spin: `profile_boosts` (multiplier), mystery resolvido no sorteio, `extra_spin` com `least(...,20)`, `reward_redemptions.source`/CK, convidado, `deleted_at`, `MIN_PRIZES`, retorno por `prize_id` |
| Integridade H | `reference_id` polimórfico | removido; relação canônica é `<filha>.entry_id UNIQUE` (mission_progress, wheel_spins, reward_redemptions, profile_achievements, challenge_results, milestone_awards) |
| Segurança C | escalada via UPDATE em profiles | §4.6: grant de colunas + `protect_profile_columns` + policies + `admin_update_profile` |
| Segurança C | team_code vazando | §4.2 `app_secrets` (só admin); `validate_team_code` devolve boolean |
| Segurança C | views definer / default privileges | §2.2 `alter default privileges for role postgres ... revoke` + varredura no fim de `0011`; §5 todas `security_invoker`; agregados em tabelas de trigger; helpers de view em `public` (§6.1) |
| Segurança C | EXECUTE público em RPCs | §2.2 default privileges; §7.9 grants; checagem na 1ª linha |
| Segurança C | takeover do bootstrap | §16.1 (1º admin pelo Dashboard antes de publicar) + §6.4 lock, `bootstrap_done`, `bootstrap_email` com e-mail confirmado; §16.4 recuperação (Apêndice B.1, D.1) |
| Segurança C | redeem TOCTOU | idem acima |
| Segurança C | colaborador girando/aprovando; giro livre virando crédito | `spin_wheel` admin-ou-dono-da-vez; `spin_wheel_free` não persiste; `approve_spin` só admin e idempotente |
| Segurança H | ranking sem expor ledger | §4.8–4.9 `profile_season_stats`/`profile_lifetime_stats` por trigger definer; `v_ranking` invoker sobre elas |
| Segurança H | PII entre colegas | §4.7 `profile_private` |
| Segurança H | inativo com acesso | `member and (...)` em toda policy própria (§10); `get_bootstrap` lê a própria linha; front faz signOut em 42501; §16.3. Pendente (B.21) reutiliza o mesmo gate: `is_active_member()` só para `status = 'active'` |
| Segurança H | search_path | §2.3 template |
| Segurança H | triggers com privilégio do invocador | funções de trigger em `private` com `security definer` |
| Segurança H | storage/SVG/avatar_url arbitrário | §11 MIME allowlist, SELECT só para membros, nome fechado + cota de 3 por pasta, `avatar_path` com CK de formato + trigger |
| Segurança H | notificações globais | §4.30 fan-out, grant só `is_read` |
| Segurança H | `created_by`/`season_id`/`points` do cliente | §6.6 sobrescreve tudo; RPCs `record_*` |
| Produto C | missões recorrentes | §4.15 período por `kind`, §4.17 `mission_progress` (PK com `period_key`) |
| Produto C | escopos temporais | §1.5 |
| Produto C | prêmios multiplier/mystery/convidado | §7.6 |
| Produto H | NextReward | Apêndice B.6 + `get_dashboard.next_reward` + `pending_earned_spins` |
| Produto H | SalesTarget projetado / meta por temporada | §5.1 `projected_goal_date`, §4.4 `season_goals` |
| Produto H | ninguém escreve em notifications | §6.2 `notify`/`notify_all` + produtores listados em §6.7, §7 |
| Produto H | estoque/cancelamento | §7.7 |
| Produto H | regras automáticas + cálculo server-side | §4.10, §6.6, §7.4 |
| Produto H | métricas de desafio, objetivo do duelo, prêmio coletivo | §4.18 `challenge_metric`, `target_value NN`, `reward_coins/spin`, §7.5 |
| Produto H | CAMPEÃO/META BATIDA no fechamento | §7.3 `close_season`, §4.5 `season_results` |
| Produto H | quem gira, fechar sem aprovar, sincronização | §7.6, §12 |
| Front C | profiles UPDATE | idem |
| Front C | signup com team_code | §7.1 `signup_mode`, `validate_team_code` (só UX; throttle removido — §4.32) |
| Front H | bootstrap em 1 chamada | §7.1 `get_bootstrap` |
| Front H | shape denormalizado | §5.1 |
| Front H | views por `season_id` | todas as views agregadas expõem `season_id`; `active_season_id()` |
| Front H | Realtime | §12 |
| Front H | retorno de spin_wheel | §7.6 (`prize.id`, `sector_index`, `prizes_hash`) |
| Front H | RPCs da fila + view | §7.6, §5.9 |
| Front H | lançamento por RPC + histórico | §7.4, §5.13 (FKs nomeadas) |
| Front H | invalidação de cache | convenção de chaves `['ledger', ...]` registrada em §14.2 (front) |
| Front H | fuso | `app_settings.timezone`, `public.local_day`, `TIMEZONE_LOCKED` |
| Front H | catálogo de erros | §9 |
| Front H | dashboard em 1 chamada | §7.1 `get_dashboard` |
| Front H | geração de tipos | recomendação mantida: `supabase gen types` + zod nos retornos jsonb (`get_bootstrap`, `get_dashboard`, `spin_wheel*`, `approve_spin`, `reject_spin`, `redeem_reward`, `finish_challenge`, `close_season`, `admin_update_profile`, `recompute_stats`); demais RPCs retornam linhas tipadas |
| Front H | board de missões / desafios | §5.6, §5.7, `save_mission`, `save_challenge` |

---

## Apêndice A — achados médios/baixos recusados (com motivo)

| # | proposta | decisão | motivo |
|---|---|---|---|
| A.1 | Custom Access Token Hook com `role`/`status` no JWT | recusado | Latência de até 1 h para inativar; a tabela é a fonte de verdade e o custo de `(select is_admin())` por statement é desprezível |
| A.2 | Tabela `level_events` separada | recusado | `feed_events` com `dedupe_key = 'level_up:<profile>:<season>:<L>'` dá a mesma idempotência e alimenta feed + notificação sem segunda tabela |
| A.3 | Streak calculado na leitura (view/função) | recusado | Exigiria ler o ledger de terceiros (viola a policy) ou uma função definer por perfil; a versão materializada com `streak_last_day` + expressão na view não envelhece errado e recalcula em lançamento retroativo |
| A.4 | Manter `reference_kind/reference_id` informativo em `point_entries` | recusado | Duas fontes da mesma relação divergem; as filhas carregam `entry_id UNIQUE` |
| A.5 | Não decrementar `rewards.stock` (calcular `available`) | recusado | Decremento atômico é mais simples de ler no front (`stock` = disponível) e o cancelamento devolve |
| A.6 | `profiles.theme` | recusado | Tema fica em `localStorage`; sem valor em sincronizar entre dispositivos por ora |
| A.7 | `pg_cron` chamando `close_season` | recusado por ora | Botão "Encerrar temporada" + aviso no front cobrem; adicionar cron depois é uma migration isolada (`select cron.schedule(...)`) sem mudar o modelo |
| A.8 | `notification_reads` (tabela de leitura) | recusado | Fan-out é mais simples para N pequeno e permite `is_read` por linha com grant de coluna |
| A.9 | `season_goals.weekly_goal_amount` | recusado | Não há meta semanal no produto; "Meta semanal" fica como marco manual deduplicado por semana ISO |
| A.10 | `spin_milestones` (pontos desbloqueiam giro) | recusado | Cria regra nova; NextReward usa recompensa mais barata + giros ganhos pendentes (B.6) |
| A.11 | `profiles.base_points` | recusado | Segunda fonte de verdade; "pontos iniciais" é entry `system` via `record_initial_points` (uma por perfil/temporada), fora do formulário de perfil |
| A.12 | `v_public_settings` | desnecessário | `app_settings` não tem segredo; `app_secrets` é só admin |
| A.13 | Canais Realtime privados / Broadcast | recusado | `postgres_changes` com RLS basta; sem Broadcast do cliente |
| A.14 | `signup_failures` por e-mail no trigger | recusado | Throttle no banco (por e-mail ou por IP) foi removido de vez na revisão adversarial (§4.32): chave forjável, lockout coletivo e enchimento do banco; o espaço do código e o rate limit do GoTrue bastam |
| A.15 | `missions.recurrence` como coluna própria | absorvido | `kind` já define o período (daily/weekly/once) |
| A.16 | `profile_boosts.uses_left` | recusado | Janela de 24 h é mais simples de explicar ("2x pontos até amanhã às 15h") |
| A.17 | `wheel_spins.is_free` | removido | Giro livre não persiste; nenhum caminho para aprovação |
| A.18 | `achievement_criteria.custom` | removido | Sem semântica avaliável; regras novas usam os critérios existentes |
| A.19 | RPC `get_challenge_progress` | recusado | `challenge_participants.current_value` mantido por trigger é lido por view invoker |
| A.20 | Before User Created hook para mensagem de erro | opcional, não exigido | `validate_team_code` já dá a mensagem antes; o hook pode ser adicionado no painel sem mudar o schema |
| A.21 | `supabase/config.toml`, lint de `service_role` no front, SMTP | fora deste documento | Pertencem ao manual de implantação/CI (VERCEL doc) |
| A.22 | `abs(points) <= 100000` no ledger | ajustado | Limite em `record_manual_entry`/regras é 100.000; o CK da tabela é 1.000.000 para não bloquear estornos de blocos multiplicados |
| A.23 | `coins_per_point` | removido | Decisão Q2 |
| A.24 | `preferences` como colunas booleanas separadas | recusado | jsonb com grant de coluna único cobre as duas preferências e futuras |
| A.25 | Índice `point_entries (occurred_at desc) where metric='sale'` para o feed | mantido, mas o feed lê `feed_events` | Índice serve a `v_sales_timeline` e ao histórico |

---

## Apêndice B — decisões de produto registradas (alteráveis sem quebrar o modelo)

| # | decisão | alternativa registrada |
|---|---|---|
| B.1 | O primeiro usuário inserido em `auth.users` vira admin, e esse usuário é criado pelo implantador no Dashboard (*Add user*, *Auto confirm*) **antes** de publicar a URL (§16.1) — passo obrigatório do manual. `bootstrap_email` é trava opcional que exige e-mail já confirmado no INSERT (§6.4) | Self-signup do dono pela tela `first_admin` (só ambiente local/teste, nunca com a URL pública no ar) |
| B.2 | Nível = `floor(pontos_da_temporada / xp_per_level)` (nível 0 com < 400 pts; "Nível 7" = 2.800 pts como no original). Reseta por temporada (liga) | Nível vitalício: trocar a origem para `profile_lifetime_stats` (adicionar `points_lifetime`) |
| B.3 | Remover pontos manualmente não confisca moedas (`coins = 0` quando `points < 0`), salvo `p_coins` explícito | Default `coins = points` sempre |
| B.4 | Evento especial e boost não acumulam: vale o maior multiplicador | Multiplicar (`event × boost`) com teto 10 |
| B.5 | Conquistas dão pontos+moedas iguais (50/100/300/200/500/600) | Zerar `reward_*` para conquistas puramente honoríficas |
| B.6 | NextReward = (a) giros ganhos aguardando liberação, se houver; senão (b) recompensa ativa mais barata acima do saldo ("Faltam N moedas para {reward}") | Limiar de pontos desbloqueando roleta (`spin_milestones`, A.10) |
| B.7 | O dono da vez pode girar do próprio celular; sorteio continua no servidor e aprovação continua só do gestor | Só admin gira |
| B.8 | Missão concluída não é desfeita por estorno posterior | Trigger de "desconclusão" com estorno automático da recompensa |
| B.9 | Convidado (nome manual) recebe só `cash`/`voucher`/`extra_spin`; `points`/`coins`/`multiplier` ficam no histórico sem crédito | Bloquear convidados na Premium |
| B.10 | Fechar temporada antes do fim encurta `ends_at` para a próxima meia-noite | Proibir fechamento antecipado |
| B.11 | `crm_pct` = % de ativos com ≥ 1 "CRM atualizado" na temporada | Janela móvel de 7 dias |
| B.12 | E-mail de login só muda pelo próprio usuário (`updateUser`); admin edita apenas `profile_private.email` (exibição) | Sincronizar via trigger em `auth.users` (recusado por segurança) |
| B.13 | Streak em dias corridos (`streak_business_days_only = false`) | Dias úteis (a coluna existe; implementar em `recompute_streak`/trigger quando pedido) |
| B.14 | Retroatividade de lançamento limitada a 90 dias e sempre dentro de temporada não fechada | Ilimitada para admin |
| B.15 | Saldo de moedas pode ficar **negativo** (dívida): estorno de entry que deu moedas já gastas e ajuste manual com `coins < 0` não são bloqueados; a carteira mostra "Saldo devedor de N", a loja fica desabilitada até cobrir, `redeem_reward` exige `saldo >= custo`. Todo débito serializa no lock `wallet:<uid>` | Proibir dívida: `reverse_entry` → `COINS_ALREADY_SPENT` quando `saldo - orig.coins < 0`, `record_manual_entry` → `INSUFFICIENT_COINS` (bloqueia correções legítimas do ledger) |
| B.16 | Streak conta "entradas de atividade": entry de regra (mesmo 0 pontos/0 moedas) ou manual positiva, não estornada e não estorno; `system`/missão/roleta/desafio/conquista não contam. Estorno recalcula o streak | Só `points > 0` (regra 0/0 não contaria e "Ligação realizada" configurada como 0/0 não manteria a chama) |
| B.17 | Participante inativado: duelo `active` é cancelado automaticamente (aviso ao outro); coletivo `draft` remove o perfil; coletivo `active` mantém e `finish_challenge` marca `is_winner = false` para inativos; duelo com um inativo (inativação por caminho direto) → o ativo vence se `> 0` | Congelar o duelo até reativação |
| B.18 | `app_settings.timezone` trava após o primeiro lançamento (`TIMEZONE_LOCKED`) | Migração assistida: RPC que recalcula `streak_last_day`, `period_key` de `mission_progress`/`milestone_awards` e meia-noites de `seasons` no fuso novo, com `recompute_stats` ao final |
| B.19 | `app_settings.rank_admins = true`: gestores ativos aparecem no ranking/pódio (como no original, onde o gestor também vende) | `false`: `rank` NULL para `role = 'admin'` e ausência em `v_ranking` |
| B.20 | `activate_season` só a partir de `starts_at` (`SEASON_NOT_STARTED`); entre um fechamento antecipado e a meia-noite não há temporada ativa e o front mostra "Próxima temporada começa em …" | Permitir ativar antes com `warnings: ['season_not_started']` (dashboard mostraria a temporada nova zerada enquanto lançamentos ainda cairiam em `SEASON_CLOSED`) |
| B.21 | **Decisão (15/09/2026):** colaborador que se cadastra com `team_code` nasce `status = 'pending'` e precisa ser aprovado por um gestor — `handle_new_user` grava `pending` e chama `notify_admins('system', 'Novo membro aguardando aprovação')` (§6.4); `admin_update_profile({status:'active'})` aprova (auditoria + `season_goals` + notificação "Cadastro aprovado" ao membro + "Novo membro" ao time) e `{status:'inactive'}` recusa (§7.2); `get_bootstrap` devolve `{me:{status:'pending'}}` e o front mostra `/aguardando` (§7.1). O gestor pode ligar `app_settings.auto_approve_members` (`update_app_settings`, default `false`) para novos cadastros nascerem `active` como antes. Consequência: *Confirm email* passa a ser opcional em produção; SMTP continua obrigatório para recuperação de senha (§16.2) | Auto-aprovação ligada (`auto_approve_members = true`): nasce `active`, notificação "Novo membro" para todos, e produção volta a exigir *Confirm email* + SMTP |
| B.22 | `enqueue_wheel` recusa duplicata só entre entradas `manual`; entrada `earned` e manual coexistem | Recusar qualquer duplicata por pessoa |
| B.23 | `update_queue_entry` exige `p_attempts > attempts_used` (`ATTEMPTS_INVALID`); encerrar a vez é `remove_from_queue` | `p_attempts = attempts_used` → `status = 'done'` |

---

## Apêndice C — mapa tela → objetos

| tela / componente (FEATURE-INVENTORY) | leitura | escrita |
|---|---|---|
| Login / Cadastro | `signup_mode`, `validate_team_code` (só UX) | `auth.signUp`, `auth.signInWithPassword`, `updateUser({data:{team_code:null}})` |
| Layout (topbar, sidebar, sino, chip moedas/temporada) | `get_bootstrap`, `notifications` (own), Realtime `notifications` | `mark_notifications_read`, `profiles.preferences` |
| Dashboard colaborador | `get_dashboard` (stats, top 5, missões de hoje, next_reward, evento, feed) | — |
| Visão do gestor + modal de colaborador | `v_team_stats`, `v_ranking`, `v_profile_stats`, `get_dashboard(p_profile_id)`, `v_wheel_queue` | — |
| Ranking | `v_ranking` | — |
| Missões | `v_mission_board` | `save_mission`, `delete_mission` (admin) |
| Desafios | `v_challenge_board` | `save_challenge`, `activate_challenge`, `finish_challenge`, `cancel_challenge` |
| Roleta | `wheel_prizes`, `v_wheel_queue`, `wheel_spins` (pending), `v_wheel_history`, Realtime | `enqueue_wheel`, `update_queue_entry`, `remove_from_queue`, `release_turn`, `spin_wheel`, `spin_wheel_free`, `approve_spin`, `reject_spin`, `save_wheel_prizes` |
| Recompensas | `v_wallet`, `point_entries` (créditos), `rewards`, `reward_redemptions` (own), `v_redemptions` (admin) | `redeem_reward`, `handle_redemption`, `rewards` upsert (admin) |
| Conquistas / Perfil | `v_achievement_board`, `v_profile_stats` | `profiles` (nome/foto/cor), Storage `avatars` |
| Admin Dashboard | `v_team_stats`, `v_admin_kpis`, `v_sales_timeline`, `v_ranking` | — |
| Equipe (inclusive seção "Pendentes") | `v_profile_stats` (todos, inclui inativos e pendentes), `profiles` + `profile_private` (`status = 'pending'`, nome/e-mail/data do pedido), `v_team_stats.pending_count`, `get_bootstrap().pending_members` (badge), `v_point_entries_history` (pontos iniciais lançados) | `admin_update_profile` (`{status:'active'}` aprova, `{status:'inactive'}` recusa/inativa), `record_initial_points`, Storage (admin) |
| Pontuação | `point_rules`, `v_point_entries_history`, `v_profile_stats` | `point_rules` upsert, `record_rule_entry`, `record_manual_entry`, `reverse_entry` |
| Configurações | `app_settings`, `app_secrets` (admin), `v_seasons`, `v_special_events` | `update_app_settings` (inclui `rank_admins` e `auto_approve_members`; `timezone` só antes do 1º lançamento), `rotate_team_code` (lembrete pós-onboarding), `create_season`, `update_season`, `activate_season` (só após `starts_at`), `close_season` (com aviso de buraco), `save_special_event`, `recompute_stats` |
| Guia de uso | estático (9 passos: configurações → código → perfis → regras → missões → desafios → recompensas/prêmios → evento → teste) | — |

---

## Apêndice D — Revisão adversarial (achados, resolução ou motivo da recusa)

Revisão feita sobre a versão anterior deste documento. Cada item registra o achado, a decisão (**aplicado** / **aplicado com ajuste** / **recusado**) e onde a mudança vive. Impactos fora deste documento (FRONTEND-ARCH, manual de deploy) estão marcados com ⚠.

| # | sev. | achado | decisão | resolução |
|---|---|---|---|---|
| D.1 | HIGH | Janela de bootstrap: URL + chave publicável no bundle; quem abrir a URL antes do dono vira admin (com *Confirm email* ligado, sem nem confirmar — o trigger roda no INSERT); com `bootstrap_email` + *Confirm email* desligado, quem souber o e-mail do dono cadastra com ele | **aplicado** | §16.1 manual obrigatório (1º admin pelo Dashboard *Add user* + *Auto confirm* **antes** de publicar); §6.4 `BOOTSTRAP_REQUIRES_CONFIRMED_EMAIL` quando `bootstrap_email` está preenchido; §16.2 `bootstrap_email` só faz sentido com o caminho do Dashboard e produção exige *Confirm email* + SMTP; §16.4 snippet de recuperação (trigger `profiles_protect_columns` e `app_secrets_protect` desligados sob `postgres`). Nota: com *Confirm email* desligado o GoTrue confirma o e-mail por UPDATE **depois** do INSERT, então o self-signup com `bootstrap_email` preenchido também é abortado — o caminho do Dashboard é o único garantido, e é o recomendado. ⚠ manual de deploy |
| D.2 | MEDIUM | Default privileges do Supabase (`for role postgres ... grant all to anon, authenticated`) não eram desfeitos; toda tabela/view/função nova ficava gravável/executável por `authenticated`; frases "sem grant" eram falsas | **aplicado** | §2.2 `alter default privileges for role postgres ... revoke` (tables/functions/sequences) em `0001`; varredura `revoke all on all ...` no fim de `0011` antes dos grants explícitos; views só SELECT; teste (k) do harness varre `pg_class` (RLS ligado, sem DELETE, views só SELECT, funções fora da lista sem EXECUTE, `anon` sem nada) |
| D.3 | MEDIUM | `handle_new_user` com lógica de três valores: sem a linha de `app_secrets`, `v_secrets` NULL → `INVALID_TEAM_CODE` nunca dispara e qualquer código vira colaborador; `validate_team_code` podia devolver NULL | **aplicado** | §6.4 `select ... into strict` + `BOOTSTRAP_NOT_CONFIGURED`; `is distinct from`; §7.1 `coalesce(..., false)`; §2.7/§15 `begin; ... commit;` obrigatório; teste (n) |
| D.4 | MEDIUM | Throttle de `validate_team_code` por `x-forwarded-for`: chave forjável (proxies anexam o IP), inserção ilimitada em `team_code_attempts` (DoS de disco), lockout coletivo sem header/atrás de NAT | **aplicado (alternativa simples)** | Tabela e throttle **removidos** (§4.32); `validate_team_code` vira `stable`, só UX, sem escrita; `TOO_MANY_ATTEMPTS` sai do catálogo; força bruta é inviável (16^12) e o GoTrue já limita cadastros/IP. ⚠ FRONTEND-ARCH: remover o tratamento de `TOO_MANY_ATTEMPTS` e permitir `signUp` mesmo se a RPC falhar por rede — **atendido** (FRONTEND-ARCH §3.3, §4.3, §7 WP1) |
| D.5 | MEDIUM | Storage `avatars_select_public to public`: anon com a chave publicável lista todos os `profile_id`/caminhos e baixa fotos sem login; inativo lista | **aplicado** | §11 `avatars_select_members` (`authenticated` + `is_active_member()`); leitura direta do objeto público continua (não passa por policy), `getPublicUrl` intacto |
| D.6 | MEDIUM | Policy de INSERT só checava a pasta: uploads ilimitados com nome livre esgotam 1 GB do Free e travam avatar de todos | **aplicado** | §11 nome obrigatório `<uid>/avatar-<epoch_ms>.<ext>` no INSERT/UPDATE (admin idem com qualquer uid), cota `public.avatar_count(uid) < 3`, front limpa a pasta antes de subir; §4.6 CK com o mesmo regex em `avatar_path`. Trigger de limpeza server-side registrado como opcional (não implementado) |
| D.7 | LOW | Policies `= me` sem `is_active_member()`: inativo com token continua lendo ledger/resgates/notificações e editando nome/foto; `get_bootstrap` (invoker) não lia a própria linha inativa | **aplicado** (junto com D.26) | §10 todas as policies próprias viram `member and (...)`; `profiles` SELECT = `member or id = me`; §7.1 `get_bootstrap` lê `profiles` por `auth.uid()` antes de qualquer view; §16.3 documenta que inativar não encerra sessões; teste (j) |
| D.8 | LOW | `spin_wheel` etc. com uuid inexistente: `v_queue` NULL → checagem de papel não dispara, erro cru mais adiante | **aplicado** | §2.3/§7 preâmbulo: `into strict` + `*_NOT_FOUND` antes da checagem de papel; `is distinct from`; §9 `QUEUE_NOT_FOUND`, `SPIN_NOT_FOUND`, `REDEMPTION_NOT_FOUND`, `PROFILE_NOT_FOUND`, `SEASON_NOT_FOUND`, `CHALLENGE_NOT_FOUND`, `MISSION_NOT_FOUND`; teste (m) |
| D.9 | LOW | `season_results` expunha `goal_amount`/`goal_reached` de todos; `profile_lifetime_stats` expunha `coins_balance`/`coins_spent` de todos (carteira alheia) | **aplicado (opção policy)** | §4.5 e §4.9 policies `member and (profile_id = me or admin)`; colunas vitalícias de terceiros saem NULL/0 em `v_profile_stats` para colaborador (nenhuma tela mostra streak/carteira de colega; ranking é por temporada). A divisão em `profile_wallet` foi considerada e recusada por churn sem ganho de UI |
| D.10 | LOW | Views invoker chamando `private.local_today()` etc. sem grant explícito — falha previsível ao revogar EXECUTE de `private` | **aplicado** (absorvido por D.24) | Helpers movidos para `public` com grant; nada de `private` em view |
| D.11 | LOW | `preferences` sem limite de tamanho (colaborador infla `profiles`); `avatar_path` aceitava `<uid>/../../x` | **aplicado** | §4.6 `pg_column_size(preferences) <= 2048`; CK de formato fechado em `avatar_path` (mesmo regex do Storage) |
| D.12 | LOW | Identidade não verificada com *Confirm email* desligado: quem tem o `team_code` cadastra com o e-mail/nome de um colega, entra ativo e bloqueia o dono real do e-mail | **aplicado (documentação + alternativa)** | §16.2 produção = *Confirm email* ligado + SMTP próprio; desligado só em piloto; §14.1 lembrete de rotacionar `team_code` ao fim do onboarding e `updateUser({team_code:null})` obrigatório com retentativa; **Superado em 15/09/2026 por B.21 (decisão)**: novo colaborador nasce `pending` até o gestor aprovar (§6.4, §7.2, §14.1), o que fecha o achado mesmo com *Confirm email* desligado; §16.2 reescrita (confirmação opcional, SMTP obrigatório para senha). ⚠ FRONTEND-ARCH: retentativa do `updateUser` e lembrete de rotação — **atendido** (FRONTEND-ARCH §3.3, §3.4 `getBootstrap`, §6 WP7, §8.2) |
| D.13 | LOW | `reverse_entry`/`handle_redemption` sem lock `wallet`: corrida com `redeem_reward` deixa saldo negativo sem controle | **aplicado** (junto com D.30) | §6.6 passo 3b: todo insert com `coins < 0` pega `wallet:<uid>` no trigger (ordem wallet → progress); §7.7 `handle_redemption` idem no cancelamento; B.15 decide que saldo negativo é permitido e exibido |
| D.14 | LOW | Entre `draw_prize` e o commit, `save_wheel_prizes` podia soft-deletar o prêmio sorteado | **aplicado** | §7.6 `spin_wheel` e `save_wheel_prizes` pegam `pg_advisory_xact_lock(hashtext('wheel_turn'))` (mesmo lock de `release_turn`) |
| D.15 | OK | Ler `team_code` como colaborador/anon — bloqueado | **sem alteração** | Ressalva registrada em §4.2: o valor fica em `raw_user_meta_data` do próprio colaborador até o front limpar (D.12) |
| D.16 | OK | Ler ledger bruto de terceiros — bloqueado | **sem alteração** | Agregados de missão/desafio (R$) continuam públicos por design, como no original; carteira/meta fechadas em D.9 |
| D.17 | OK | Conceder-se admin — bloqueado | **sem alteração** | Janela pré-publicação tratada em D.1 |
| D.18 | OK | Girar/aprovar roleta como colaborador — bloqueado | **sem alteração** | NOT FOUND tratado em D.8 |
| D.19 | OK | Resgatar sem saldo / furar estoque — bloqueado | **sem alteração** | Corrida com `reverse_entry` tratada em D.13 |
| D.20 | OK | Concluir missão duas vezes — bloqueado | **sem alteração** | — |
| D.21 | OK | Forjar `point_entries` via view/RPC — bloqueado | **sem alteração** | Condicionado a D.2 (views só SELECT), agora garantido pela varredura de `0011` |
| D.22 | OK | Sobrescrever avatar alheio — bloqueado | **sem alteração** | Listagem e cota tratadas em D.5/D.6 |
| D.23 | OK | `search_path` e views sem `security_invoker` — bloqueado | **aplicado (recomendação)** | §2.3/§7: `set search_path = ''` também em `get_bootstrap`/`get_dashboard` |
| D.24 | CRITICAL | `authenticated` sem USAGE em `private` + views `security_invoker` chamando `private.local_today()`/`local_day()`/`mission_period()` → `permission denied for schema private`; dashboard, ranking, missões e bootstrap quebravam para todos | **aplicado** | §2.1 regra; §6.1 `public.local_day`, `public.local_today`, `public.iso_week_key`, `public.mission_period` com `revoke from public, anon; grant to authenticated`; todas as referências em §4, §5, §6, §7, §13 trocadas; §7.9 atualizado; teste (l) |
| D.25 | HIGH | Estorno com `occurred_at = now()`: missão de terça ia a -1 e a de segunda ficava concluída; estorno fora da janela do desafio não subtraía (ou subtraía indevidamente); streak nunca decrementava | **aplicado com ajuste** | §6.6 passo 2 (movido para antes da resolução da temporada): estorno herda `occurred_at`; `season_id` continua **explicitamente** herdado (equivalente a derivar de novo e imune a um `ends_at` clampado por fechamento antecipado); §4.9/§6.2 critério `counts_for_streak` exclui estornadas; §6.7 A recalcula streak no estorno; `greatest(least(..,100),0)` em §5.6/§5.7; §14.2 passo 5 |
| D.26 | HIGH | Perfil inativo não conseguia ler a própria linha em `profiles` → `get_bootstrap` não devolvia `{me:{status:'inactive'}}` | **aplicado** | Ver D.7; §10 `profiles` SELECT `member or id = me`; teste (j) |
| D.27 | HIGH | Inativar roleta → apagar prêmios → reativar passava com 0 prêmios (`rand_below(0)` divide por zero); fila/missões/desafios apontando para roleta inativa | **aplicado** | §4.21 `wheels_protect_inactive` (`WHEEL_IN_USE`) e `wheels_check_prizes` (constraint trigger deferido via `private.assert_wheel_prizes`); `WHEEL_INACTIVE` em `enqueue_wheel`, `update_queue_entry`, `release_turn`, `spin_wheel`, `spin_wheel_free`, `save_mission`, `save_challenge`; `draw_prize` → `NO_PRIZES`; §9; teste (o) |
| D.28 | HIGH | `conversion_pct`/`attendance_pct`/`attainment_pct`/`avg_conversion_pct` sem teto estouram `numeric(5,2)` e derrubam a view inteira | **aplicado** | §5 regra transversal `least(..., 999.99)`; §5.1/§5.3 fórmulas; front mostra "100%+"; teste (p) |
| D.29 | MEDIUM | CK `points <> 0 or coins <> 0 or amount` impedia regra de contagem 0/0; seed sem regra `call` para a missão "Fazer 5 ligações" | **aplicado** | §4.11 `CK (source = 'rule' or ...)`; §13.4 regra 10 "Ligação realizada" (5/5); B.16 decide que entry de regra 0/0 conta para streak; §9 nota de mapeamento `23514` |
| D.30 | MEDIUM | Saldo de moedas negativo por três caminhos (estorno, manual negativo, corrida) sem decisão | **aplicado (decisão B.15)** | Dívida permitida e exibida; locks em §6.6; `redeem_reward` exige `saldo >= custo`; `v_wallet` sem `greatest(..,0)`; teste (q) |
| D.31 | MEDIUM | Missões/desafios não filtravam por `season_id`; fechamento antecipado deixava janelas além do fim | **aplicado** | §4.17/§4.18/§6.7 B2 e C filtram `season_id`; §7.3 `close_season` clampa `ends_at` de missões/desafios antes de finalizar; `update_season` → `SEASON_HAS_WINDOWS_OUTSIDE` |
| D.32 | MEDIUM | `base_points` em `admin_update_profile` não idempotente e falhava sem temporada | **aplicado** | Removido de §7.2/§4.6; nova RPC `record_initial_points` (§7.4) com `INITIAL_POINTS_EXISTS`, `source='system'` (não conta streak — sem string-matching no critério); teste (r). ⚠ FRONTEND-ARCH: tirar "pontos-base" do formulário e criar a ação separada — **atendido** (FRONTEND-ARCH §4.2, §4.5 features/team, §6 WP6) |
| D.33 | MEDIUM | `points_total`/`missions_completed` só avaliadas em entry de regra/manual/sistema | **aplicado** | §6.7 B3' avalia para toda source com `points > 0` (exceto `reward`); teste (v) |
| D.34 | MEDIUM | Meta reduzida/definida tarde não concedia marco+META BATIDA; `close_season` concedia só a conquista | **aplicado** | §6.9 `private.evaluate_goal_milestone` chamada em B1, `admin_update_profile`, trigger `season_goals_goal_milestone`, `activate_season`, `close_season`; §14.6; teste (w) |
| D.35 | MEDIUM | Participante de duelo inativado: duelo seguia, inativo podia vencer e ser pago | **aplicado (B.17)** | §7.2 inativação cancela duelos ativos e remove de coletivos `draft`; §7.5 inativos nunca vencem; §5.7 `participants[].status`; teste (u) |
| D.36 | MEDIUM | `activate_season` antes de `starts_at` deixava `active_season_id()` ≠ `season_for(now())`; `close_season` de temporada futura violava CK | **aplicado (B.20)** | §7.3 `SEASON_NOT_STARTED` em ambas; `close_season` devolve `warnings: ['gap_until_next_season']` + próxima temporada; §14.8. ⚠ FRONTEND-ARCH: "Ativar" desabilitado até a data; oferta de antecipar a próxima — **atendido** (FRONTEND-ARCH §4.2 `CloseSeasonPayload`, §4.5 features/settings, §6/§7 WP7) |
| D.37 | MEDIUM | Trocar `timezone` com dados existentes corrompe streak/períodos/temporadas | **aplicado (B.18)** | `TIMEZONE_LOCKED` em `update_app_settings` e no trigger `validate_timezone`; §13.1 lembrete |
| D.38 | MEDIUM | `projected_goal_date` com ritmo ínfimo estoura `int`/`date` e derruba a view | **aplicado** | §5.1 `v_days > 3650 → null`; teste (p) |
| D.39 | MEDIUM | Reordenar prêmios violava o índice único parcial no meio dos UPDATEs | **aplicado (duas fases)** | §4.22/§7.6 espaço negativo temporário; `SORT_ORDER_DUPLICATE` para entrada inválida |
| D.40 | LOW | Empates no ranking (`gap = 0`), `points_updated_at` alterado por estorno/`now()`, recompute sem fórmula, pódio com zeros, gestores no ranking | **aplicado (B.19)** | §4.8/§6.7 A/§7.2 fórmula única de `points_updated_at`; §5.1 `is_tied_with_above`, `has_points`; §5.2; `app_settings.rank_admins` (default true) |
| D.41 | LOW | `enqueue_wheel` recusava manual quando havia `earned`, contradizendo §4.23 | **aplicado (B.22)** | Duplicata só entre `source = 'manual'` |
| D.42 | LOW | `update_queue_entry` com `p_attempts = attempts_used` prendia a vez | **aplicado (B.23)** | Exige `> attempts_used`, senão `ATTEMPTS_INVALID` |
| D.43 | LOW | `prizes_hash` não mudava ao editar rótulo/cor/tipo/valor | **aplicado** | §4.22 hash inclui `label`, `kind`, `value`, `color` |
| D.44 | LOW | `achievements_unlocked` contava repetições por temporada ("8 de 6") | **aplicado** | §5.1 `count(distinct achievement_id)` restrito a ativas + `achievements_total` |
| D.45 | LOW | `season_closed` com `champion_name: null`; snapshot incompleto sem `season_goals` | **aplicado** | §4.29 campos opcionais; §7.3 snapshot para todo perfil ativo; CAMPEÃO só com `points > 0`; §14.8; teste (g) |
| D.46 | LOW | "Meta semanal" duplicável na semana ISO que cruza a virada de temporada | **aplicado** | §4.12 índice único parcial `(profile_id, metric, period_key) where metric = 'weekly_goal'`; §7.4 checagem sem `season_id` |
| D.47 | LOW | `23P01` cru em evento sobreposto; `23514` cru com pontos × quantidade × multiplicador > 1e6 | **aplicado** | §7.2 `save_special_event` → `EVENT_OVERLAP`; §7.4 `record_rule_entry` valida `points * qty * 10 <= 1e6` → `POINTS_INVALID`; §9 mapeamento genérico. ⚠ FRONTEND-ARCH: eventos passam a usar a RPC em vez de insert direto — **atendido** (FRONTEND-ARCH §4.2 `save_special_event`, §4.5 `useSaveSpecialEvent`, §14.7 aqui) |
| D.48 | LOW | `v_mission_board` com LATERAL simples sumiria com missões fora da janela; shape não declarava NULLs | **aplicado** | §5.6 `LEFT JOIN LATERAL ... ON true` explícito; `period_*`/`seconds_remaining` NULL quando `not is_current` |
| D.49 | LOW | Perfil inativado com giro `earned` em `waiting` podia ser liberado/aprovado e pago | **aplicado** | §7.6 `release_turn`/`approve_spin` → `PROFILE_INACTIVE`; §7.2 inativação remove entradas da fila (`SPIN_PENDING` se há giro pendente) |
