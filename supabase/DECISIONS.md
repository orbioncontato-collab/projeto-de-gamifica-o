# DECISIONS — banco de dados (supabase/)

Registro das decisões de implementação tomadas pelos agentes de SQL que a spec
(`docs/spec/DATA-MODEL.md`) deixa em aberto ou que precisaram de ajuste para rodar no
PGlite e no Supabase com o mesmo arquivo. Formato: data · decisão · motivo · impacto.

## 2026-09-15 · Seed usa `where not exists` por chave natural, ignorando `deleted_at`

- **Decisão**: `point_rules` (`lower(name)`), `wheel_prizes` (`wheel_id, sort_order`) e
  `rewards` (`lower(name)`) são inseridos com `where not exists (...)` que **não** filtra
  `deleted_at`. `achievements` usa `on conflict (code) do nothing`; `wheels` usa
  `on conflict (kind) do nothing`; singletons usam `on conflict (id) do nothing`.
- **Motivo**: os índices únicos dessas tabelas são parciais (`where deleted_at is null`);
  um `on conflict do nothing` puro re-inseriria uma regra/prêmio/recompensa que o gestor
  apagou (soft delete) sempre que `schema.sql` fosse reaplicado. §13 pede idempotência por
  chave natural, e o esperado do operador é "reaplicar não muda meus dados".
- **Impacto**: reaplicar o schema nunca ressuscita catálogo apagado. Para restaurar um item
  o gestor recria pela UI.

## 2026-09-15 · Temporada do seed só na instalação nova (`where not exists (select 1 from seasons)`)

- **Decisão**: como a spec (§13.3). A temporada ativa é criada apenas quando a tabela está
  vazia; numa reaplicação meses depois, nenhuma temporada nova é inserida.
- **Motivo**: a virada de temporada é fluxo do gestor (§14.8, `create_season`/`activate_season`),
  e `seasons_one_active` + `seasons_no_overlap` impediriam de qualquer forma.
- **Impacto**: teste `seed.test.mjs` confirma 1 temporada após duas aplicações.

## 2026-09-15 · `team_code` gerado no seed com `extensions.gen_random_bytes(6)` → 12 hex maiúsculos

- **Decisão**: `upper(encode(extensions.gen_random_bytes(6), 'hex'))`, conforme §13.2, com
  `on conflict (id) do nothing` — o código nasce uma vez por instalação e é preservado em
  reaplicações.
- **Motivo**: o CHECK `team_code ~ '^[A-Z0-9]{12}$'` e `validate_team_code` (`upper(trim())`)
  aceitam o formato; rotação é via RPC do gestor, nunca via reaplicação do schema.

## 2026-09-15 · Realtime: adicionar tabelas à publication uma a uma, guardadas por `pg_publication_tables`

- **Decisão**: em vez de um único `alter publication ... add table a, b, c`, o 0012 itera as 5
  tabelas e só adiciona as que ainda não estão na publication.
- **Motivo**: `add table` de uma tabela já publicada falha (`already member of publication`),
  o que quebraria a idempotência de `schema.sql` num banco onde o Realtime já foi ligado
  pelo Dashboard. O bloco inteiro continua dentro de `if exists (pg_publication ...)` para o
  PGlite (o harness cria a publication no shim para exercitar o caminho).

## 2026-09-15 · `public.avatar_count` repetida em 0012 com `create or replace`

- **Decisão**: a função já existe em 0006 (§6.1); o 0012 a redefine identicamente antes das
  policies de storage.
- **Motivo**: §11 pede que a policy de INSERT dependa dela; repetir com `create or replace`
  garante que 0012 funcione mesmo se aplicado isolado, sem efeito colateral na concatenação.

## 2026-09-15 · Policies de `storage.objects` criadas diretamente (sem `do $$` de guarda)

- **Decisão**: `drop policy if exists` + `create policy` puros, como a spec.
- **Motivo**: no Supabase o papel `postgres` do SQL Editor tem privilégio para criar policies
  em `storage.objects`; no PGlite o shim cria a tabela com RLS ligado. Um guard `if exists
  (storage.objects)` só esconderia um erro real de instalação.

## 2026-09-15 · Pendentes em `profiles`: a policy `member or id = me` prevalece sobre a frase "colaboradores ativos não os veem em lugar nenhum"

- **Decisão**: `profiles_select` fica exatamente como a matriz de §10 (`member or id = me`); um
  colaborador ativo consegue `select` a linha de um perfil `pending` na tabela, mas nunca em
  `v_ranking`, `v_mission_board`, `v_achievement_board` (filtram `status = 'active'`), e em
  `v_profile_stats` o pendente aparece com `rank NULL` (§5.1). O filtro `status = 'active'`
  de `useActiveProfiles` (§10) é do front, não do banco.
- **Motivo**: §10 diz as duas coisas — a policy explícita e "colaboradores ativos não os veem
  em lugar nenhum (nem em `useActiveProfiles`, que filtra ...)". Restringir a policy para
  `member and (status = 'active' or admin) or id = me` quebraria o `get_bootstrap` do próprio
  pendente/inativo (que precisa da própria linha) e não está na matriz; a linha de `profiles`
  não carrega PII (`profile_private` continua `profile_id = me or admin`).
- **Impacto**: `rls.test.mjs` verifica a ausência do pendente nas views de ranking/missões/
  conquistas e o `rank NULL` em `v_profile_stats`, não na tabela `profiles`. Se o produto
  quiser esconder pendentes também na tabela, é uma mudança de policy em `0011` + este registro.

## 2026-09-15 · Teste (k): "nenhuma função executável além da lista" = lista fechada de §6.1 + §7

- **Decisão**: `schema.test.mjs` mantém a lista nominal (9 helpers + 37 RPCs) e falha tanto se
  uma função de `public` executável por `authenticated` não estiver nela quanto se alguma da
  lista perder o grant. Toda função de `public` **precisa** estar na lista — uma função de
  `public` sem grant é sinal de que deveria morar em `private`.
- **Motivo**: o `do $$` de `0011` concede execute a *todas* as funções de `public`; sem a lista
  nominal, uma função nova em `public` viraria RPC pública sem ninguém notar.

## 2026-09-15 · Testes de fluxo (§14.1–14.4): `spin_wheel` por terceiro devolve `NOT_ALLOWED`, não `NOT_YOUR_TURN`

- **Decisão**: `supabase/test/flows.test.mjs` espera `NOT_ALLOWED` (errcode 42501) quando um
  membro ativo que não é dono da vez chama `spin_wheel`.
- **Motivo**: a spec é a fonte de verdade — §7.6 (`spin_wheel`: "senão `NOT_ALLOWED`") e o
  catálogo §9 (`NOT_ALLOWED | Você não pode executar esta ação. | spin_wheel`). Não existe
  `NOT_YOUR_TURN` no catálogo; a instrução do orquestrador usou esse nome informalmente.
- **Impacto**: o front deve mapear `NOT_ALLOWED` na tela da roleta. Nenhuma mudança de SQL.

## 2026-09-15 · Testes de fluxo: a 1ª venda soma +50/+50 da conquista PRIMEIRA VENDA no mesmo lançamento

- **Decisão**: o cenário §14.2 assere `points = 250` em `profile_season_stats` após a venda de
  R$ 8.500 no evento 2x (200 da entry `rule` + 50 da entry `achievement` de `first_sale`),
  e `coins_balance = 150`. A entry da venda em si continua `points=200`, `coins=100`.
- **Motivo**: §14.2.3 lista "conquistas `first_sale`/`sales_total`" entre os efeitos de
  `after_point_entry`; o exemplo numérico da spec (`points += 200`) fala só da parcela da venda.
- **Impacto**: nenhum ajuste de SQL; documentado para quem ler o número 250 no teste.

## 2026-09-15 · Testes de fluxo: sorteio determinístico com dois prêmios idênticos (MIN_PRIZES)

- **Decisão**: para forçar o `resolved_kind` em `approve_spin` (points → coins) o teste usa
  `save_wheel_prizes('classic', [2 × mesmo prêmio])` em vez de um único prêmio.
- **Motivo**: `private.assert_wheel_prizes` exige ≥ 2 prêmios ativos numa roleta ativa
  (§4.22, `MIN_PRIZES`) e `weight` é `between 1 and 1000` — não há como zerar o peso do
  segundo setor. Dois setores iguais mantêm kind/valor determinísticos e ainda exercitam
  `sector_index` (posição do `prize.id` na lista ordenada por `sort_order, id`).
- **Impacto**: o teste também cobre `MIN_PRIZES` (lista com 1 prêmio é recusada) e
  `SPIN_PENDING` ao tentar editar prêmios com giro pendente.

## 2026-09-15 · Fix SQL (0010): `v_warnings || 'texto'` quebrava `close_season`/`admin_update_profile`

- **Decisão**: trocado `v_warnings := v_warnings || 'gap_until_next_season'` (e o análogo
  `'no_active_season_for_goal'`) por `array_append(v_warnings, '...')` em `20260915000010_rpcs.sql`;
  `schema.sql` regenerado.
- **Motivo**: com `text[] || literal`, o Postgres tenta ler o literal como **array** e falha com
  `22P02 malformed array literal` — `close_season` antecipado com próxima temporada criada
  (§14.8.2, `warnings: ['gap_until_next_season']`) não retornava. Coberto em
  `supabase/test/flows2.test.mjs` (14.8.3).
- **Impacto**: nenhum para o front; o contrato `warnings text[]` continua o mesmo.

## 2026-09-15 · Fix SQL (0009): `v_team_stats.avg_conversion_pct` devolvia 999.99 sem nenhuma reunião

- **Decisão**: `least(round(agg.avg_conversion * 100, 2), 999.99)` virou
  `case when agg.avg_conversion is not null then least(...) end`.
- **Motivo**: `least()` ignora NULL — temporada sem `meetings_held` (ou sem stats) mostrava
  999,99 % em vez de "—" (§5.3: percentual NULL quando não há base). Coberto em
  `supabase/test/views.test.mjs` (v_team_stats, temporada sem stats).
- **Impacto**: o front deve continuar tratando `avg_conversion_pct` NULL como "sem dados".

## 2026-09-15 · Testes §14.8: `season_results.final_points` é a base do pódio, sem os +500 de CAMPEÃO

- **Decisão**: `flows2.test.mjs` assere `final_points = pontos no momento do snapshot`
  (inclui o prêmio do duelo finalizado no passo 4, exclui a entry `achievement` de CAMPEÃO
  concedida no passo 6 a partir do próprio snapshot). `profile_season_stats.points` fica 500
  acima de `final_points` para o campeão.
- **Motivo**: §14.8.2 lista o snapshot antes de "CAMPEÃO … concedidos"; conceder antes criaria
  dependência circular (o campeão é lido do snapshot). O ledger continua íntegro.
- **Impacto**: telas de "histórico de temporadas" devem ler `season_results` (pódio oficial),
  não `profile_season_stats`, para mostrar a pontuação final.

## 2026-09-15 · Testes de views: `v_sales_timeline` como colaborador mostra só o ledger próprio

- **Decisão**: `views.test.mjs` consulta a série como gestor e assere que o colaborador vê
  apenas as próprias vendas no mesmo dia (8.500 vs 11.500).
- **Motivo**: a view é `security_invoker` sobre `point_entries` (RLS own-or-admin) e a spec a
  marca "(ledger, admin)" (§5.5). Não é bug; o front só deve usá-la na tela do gestor.
- **Impacto**: nenhum SQL alterado.

## 2026-09-15 · Testes de views: moedas de "Ligação realizada" não entram em nenhuma origem de `v_wallet`

- **Decisão**: o teste assere `soma das origens (200) < coins_balance (210)` para o membro-a.
- **Motivo**: §5.12 define `coins_from_sales` só para `metric in ('sale','upsell')`; regras como
  ligação/reunião/CRM dão moedas sem bucket próprio. Mantido como está (spec é a fonte).
- **Impacto**: o front não deve somar as origens para obter o saldo — usar `coins_balance`.

## 2026-09-15 · SQL fixer r1: RPCs admin nunca vazam SQLSTATE cru — códigos novos `NAME_REQUIRED`, `GOAL_INVALID`, `AMOUNT_INVALID`

- **Decisão**: validação antes de qualquer escrita em `create_season` (`p_name` 1–60 chars →
  `NAME_REQUIRED`; `p_team_goal_amount` 0..999.999.999.999 → `GOAL_INVALID`), `update_season`
  (`name`, `team_goal_amount` idem; `starts_on`/`ends_on` não conversíveis para `date` →
  `SEASON_RANGE_INVALID`), `admin_update_profile` (`goal_amount`/`default_goal_amount` via
  `private.patch_goal` → `GOAL_INVALID`; chave presente com `null` → `GOAL_INVALID`) e
  `record_rule_entry` (`p_amount > 999.999.999.999` → `AMOUNT_INVALID`; `null`/`<= 0` seguem
  como `AMOUNT_REQUIRED` em `before_point_entry`). `record_manual_entry` valida `v_coins`
  por faixa (`between`) em vez de `abs()` — `abs(INT_MIN)` estourava com 22003.
- **Motivo**: §9 promete "toda escrita do fluxo normal passa por RPC e devolve código do
  catálogo"; o catálogo não nomeia esses casos (lacuna de spec). Códigos escolhidos seguem o
  handoff `docs/spec/handoffs/redteam-security-r1.md`. Tetos = limite de `numeric(14,2)`.
- **Impacto**: pedido de inclusão dos 3 códigos em DATA-MODEL §9 e em `src/lib/rpc-errors.ts`
  (handoff `sql-fixer-r1.md`). Nenhuma tabela alterada; só `0010_rpcs.sql`.

## 2026-09-15 · SQL fixer r1: `first_sale_at` = `least(first_sale_at, occurred_at)` no trigger

- **Decisão**: `private.after_point_entry` usa `least(ls.first_sale_at, NEW.occurred_at)` em vez
  de `coalesce(...)` (§6.7 A, literal). `least` ignora `null`, então o 1º caso é idêntico.
- **Motivo**: venda retroativa (`p_occurred_at` anterior a uma venda já lançada) deixava o
  valor incremental na data mais tarde e `recompute_stats` (`min(occurred_at)`) o mudava —
  viola §7.2 "recompute reproduz o ledger". A fórmula de §6.7 está errada para retroativos.
- **Impacto**: pedido de correção de §6.7 A (handoff). Conquista PRIMEIRA VENDA não muda
  (é concedida no 1º fato, idempotente).

## 2026-09-15 · SQL fixer r1: `recompute_streak` grava `best_streak_days = max(ilhas)` (§6.2), não monotônico

- **Decisão**: `private.recompute_streak` passa a gravar `best_streak_days = max(ilhas)` do
  ledger (antes: `greatest(best_streak_days, max(ilhas))`). O trigger incremental continua
  com `greatest(best, streak_days)` (§4.9); só o recompute (retroativo, estorno,
  `recompute_stats`) reconstrói do zero.
- **Motivo**: §1.1 (ledger é a única origem) e §7.2 (recompute reproduz o ledger): um best
  adulterado ou inflado por uma entry estornada precisa poder ser corrigido. Consequência
  aceita: estornar o dia que formava a sequência reduz o best (o ledger diz que o dia não
  existiu). `flows2.test.mjs` B.16 ajustado (assertiva "melhor streak não regride" contrariava
  §6.2); `redteam-correctness-r1` já assere o comportamento da spec.
- **Impacto**: nenhum no front (lê `best_streak_days` de `v_profile_stats`).

## 2026-09-15 · SQL fixer r1: `release_turn` checa `status = 'waiting'` antes das tentativas (§7.6 passo 5)

- **Decisão**: entrada `done`/`active`/`removed` → `QUEUE_NOT_WAITING`; só entrada `waiting` com
  `attempts_used >= attempts_allowed` → `ATTEMPTS_EXHAUSTED`. Linha já travada com `for update`,
  então a checagem prévia de status é equivalente ao `update ... where status = 'waiting'`
  (mantido como cinto e suspensório).
- **Motivo**: ordem literal de §7.6 passo 5. `flows.test.mjs` 14.4.6 ajustado (esperava
  `ATTEMPTS_EXHAUSTED` para fila `done`).
- **Impacto**: nenhum; o front trata os dois códigos como mensagem.

## 2026-09-15 · SQL fixer r2: `INVALID_ARGUMENT` — nenhuma RPC de escrita vaza SQLSTATE cru (§9)

- **Decisão**: novo código de catálogo `INVALID_ARGUMENT` (errcode `P0001`, detail pt-BR:
  "Valor inválido (campo/constraint).", "Campo obrigatório (...)", "Valor fora da faixa permitida (...)",
  "Data ou hora inválida.", "Registro duplicado (...)", "Referência inexistente (...)"). As 14 RPCs de
  escrita com entrada livre (`admin_update_profile`, `update_app_settings`, `save_special_event`,
  `create_season`, `update_season`, `record_rule_entry`, `record_manual_entry`, `record_initial_points`,
  `save_mission`, `save_challenge`, `enqueue_wheel`, `update_queue_entry`, `save_wheel_prizes`,
  `handle_redemption`) terminam com `exception when data_exception or integrity_constraint_violation`
  → `private.fail_invalid(sqlstate, column, constraint, message)`. FK de perfil inexistente (23503 em
  `*_participants`) vira `PROFILE_NOT_FOUND`. Os casts do jsonb saíram do `declare` para o corpo
  (senão o erro acontece antes do handler). Erros `P0001`/`42501` do catálogo não passam pelo handler.
- **Motivo**: §9 ("toda escrita do fluxo normal passa por RPC e devolve código do catálogo") não tem
  código genérico para enum/uuid/timestamp/numeric inválidos nem para CK/NOT NULL; 50 chamadas hostis
  vazavam 22P02/22007/22003/23514/23502/23503/23505. Validar campo a campo em 14 funções repetiria os
  CKs da tabela; o handler é a rede final e os CKs continuam a fonte da regra.
- **Limite**: argumento tipado na assinatura (`save_wheel_prizes(p_wheel_kind wheel_kind)`,
  `enqueue_wheel(p_wheel_kind)`) com valor fora do enum é rejeitado pelo cast **antes** da função
  (22P02 do PostgREST/Postgres) — inalcançável por SQL; o front só envia valores do enum.
- **Impacto**: front deve mapear `INVALID_ARGUMENT` em `src/lib/rpc-errors.ts` (handoff). Teste
  `redteam-correctness-r1` ("peso 0 → 23514 cru") ajustado para `INVALID_ARGUMENT`.

## 2026-09-15 · SQL fixer r2: `admin_update_profile` compara e-mail com `lower(trim())`

- **Decisão**: a checagem `EMAIL_TAKEN` usa `lower(trim(p_patch ->> 'email'))`, o mesmo que o UPDATE
  grava. Antes, ` gestor@teste.local ` passava pela checagem e estourava `profile_private_email_uq`
  (23505 cru).

## 2026-09-15 · SQL fixer r2: `save_wheel_prizes` valida `sort_order` inteiro ≥ 0 antes da fase 1

- **Decisão**: item que não é objeto, sem `sort_order` numérico, negativo ou fracionário →
  `INVALID_ARGUMENT` antes de qualquer escrita. A fase 1 de §7.6 usa o espaço negativo
  (`-1 - sort_order`) como área temporária; um `sort_order = -1` na entrada colidia com ele
  (`wheel_prizes_sort_uq`, 23505 cru — rollback, sem corrupção).

## 2026-09-15 · SQL fixer r2: estorno de rule/manual/system nasce com `source = 'system'` (§7.4)

- **Decisão**: `reverse_entry` e `before_point_entry` gravam
  `source = case when orig.source in ('rule','manual','system') then 'system' else orig.source end`
  (antes: herdava a source, "DECISIONS.md #1" citado no trigger sem registro). Para isso, com
  `rule_id` herdado (§6.6 passo 2): `point_entries_rule_only_ck` e `point_entries_not_empty_ck`
  ganham `or reverses_entry_id is not null` (estorno de regra 0/0, ex. "Ligação realizada", precisa
  passar); `activities_count` (trigger e `recompute_stats`) e `private.challenge_value('activities')`
  olham a source da **original** no estorno (senão o estorno nunca decrementaria "atividades", que
  §4.8 define por `source in ('rule','manual')`); `challenge_value` passa de `immutable` a `stable`.
- **Motivo**: §7.4 literal; consequência em §5.4: `v_admin_kpis.entries_count` deixa de contar linhas
  de estorno. Os demais agregados já usavam `source in ('rule','manual','system')` ou `coins > 0`.
- **Impacto**: `v_ledger.source` do estorno de regra = `system` (rótulo "Sistema" no front; `rule_name`
  continua vindo de `rule_id`). `flows2` 14.6.3 ajustado; pedido de correção de §4.8/§4.18 (handoff).

## 2026-09-15 · SQL fixer r2: `last_entry_at` recalculado no estorno da última atividade (§4.8/§7.2)

- **Decisão**: em `after_point_entry`, no ramo "estorno de original que contava" (onde já chama
  `recompute_streak`), `profile_season_stats.last_entry_at` = `max(occurred_at)` das entries da
  temporada com `counts_for_streak(e)` (a original já não conta, pois o estorno existe).
- **Motivo**: `greatest(last_entry_at, NEW.occurred_at)` de §6.7 A não tem ramo de estorno e mantinha
  a data estornada; `recompute_stats` a rebaixava — viola §7.2 (mesma classe do `first_sale_at`
  já registrado). Pedido de correção de §6.7 A (handoff).
