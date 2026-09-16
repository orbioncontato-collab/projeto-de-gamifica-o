# RASCUNHO — Modelo de dados Supabase (para crítica dos agentes)

> Rascunho inicial. Os agentes de crítica devem apontar lacunas, inconsistências, riscos de RLS,
> problemas de normalização e tudo que a UI (FEATURE-INVENTORY.md) precisa e não está aqui.
> A versão final vai para `DATA-MODEL.md`.

## Princípios
- **Single-tenant por instalação**: cada cliente sobe o próprio Supabase. Não há `organizations`. Há um `app_settings` singleton (id = 1).
- **Ledger central**: `point_entries` é a única fonte de pontos, moedas, vendas (R$) e contagem de atividades. Tudo (ranking, missões, desafios, conquistas, gráficos) deriva dele por views/funções.
- **Regras de negócio no banco** (funções `security definer` + triggers) para que o front seja só consumidor; sorteio da roleta no servidor.
- **RLS em todas as tabelas**. Papel via `profiles.role` lido por função `public.is_admin()`.
- Timestamps `timestamptz`, `created_at default now()`, ids `uuid default gen_random_uuid()`.
- Tudo em `public`. Nomes em inglês snake_case; textos exibidos em pt-BR ficam no front.

## Enums
- `user_role`: `admin`, `collaborator`
- `profile_status`: `active`, `inactive`
- `metric_type`: `sale`, `meeting_scheduled`, `meeting_held`, `call`, `crm_update`, `lead_recovery`, `upsell`, `weekly_goal`, `monthly_goal`, `activity`, `custom`
- `entry_source`: `rule`, `manual`, `mission`, `challenge`, `wheel`, `reward`, `achievement`, `system`
- `mission_kind`: `daily`, `weekly`, `special`, `lightning`
- `challenge_kind`: `duel`, `team`
- `challenge_status`: `draft`, `active`, `finished`, `cancelled`
- `wheel_kind`: `classic`, `premium`
- `prize_kind`: `points`, `coins`, `cash`, `voucher`, `extra_spin`, `multiplier`, `mystery`, `custom`
- `queue_status`: `waiting`, `active`, `done`, `removed`
- `spin_status`: `pending`, `approved`, `rejected`
- `redemption_status`: `requested`, `approved`, `delivered`, `cancelled`
- `achievement_criteria`: `first_sale`, `streak_days`, `sales_total`, `monthly_goal`, `rank_first`, `points_total`, `missions_completed`, `custom`
- `notification_kind`: `ranking`, `mission`, `reward`, `wheel`, `challenge`, `achievement`, `system`

## Tabelas

### app_settings (singleton)
| coluna | tipo | notas |
|---|---|---|
| id | int PK check (id=1) | |
| company_name | text | "Orbion" |
| team_code | text | código de acesso da equipe (signup de colaborador) |
| xp_per_level | int default 400 | |
| coins_per_point | numeric default 0.25 | moedas ganhas por ponto (a critério) — OU moedas definidas na regra |
| currency | text default 'BRL' | |
| notifications_enabled | bool | |
| updated_at, updated_by | | |

### seasons
id, name ("Setembro 2026"), starts_at date, ends_at date, team_goal_amount numeric, is_active bool (só uma ativa — índice único parcial), created_at.

### profiles (1:1 auth.users)
id uuid PK FK auth.users, email, full_name, role user_role, job_title text (SDR/Closer/…), team text, phone, avatar_url, color text (cor do avatar), status profile_status, goal_amount numeric (meta individual), created_at, updated_at.
Trigger `handle_new_user` em `auth.users`: cria profile; se não existe nenhum admin → role admin, senão collaborator; valida `raw_user_meta_data->>'team_code'` contra `app_settings.team_code` (se não bater, RAISE — cadastro falha). Nome vem de `raw_user_meta_data->>'full_name'`.

### point_rules
id, name, metric metric_type, points int, coins int default 0, is_active bool, sort_order int, created_at. Seed com as 9 regras do original.

### point_entries (LEDGER)
id, profile_id FK, season_id FK, rule_id FK null, metric metric_type null, points int (±), coins int (±), amount numeric null (R$ da venda), quantity int default 1, reason text, source entry_source, reference_id uuid null (missão/desafio/giro/resgate), occurred_at timestamptz default now(), created_by FK profiles, created_at.
Índices: (profile_id, season_id), (season_id, occurred_at), (metric).

### missions
id, season_id, title, description, kind mission_kind, metric metric_type, target_count int, reward_points int, reward_coins int, reward_spin wheel_kind null, starts_at, ends_at, audience ('all' | 'selected'), is_active, created_by, created_at.
### mission_participants (mission_id, profile_id) PK composto — usado quando audience='selected'.
### mission_completions
id, mission_id, profile_id, completed_at, entry_id FK point_entries (crédito). Unique (mission_id, profile_id).
Trigger após insert em point_entries: recalcula progresso das missões ativas da pessoa; se atingiu target e não tem completion → insere completion + entry de recompensa (+ se reward_spin, insere na wheel_queue com source 'earned').

### challenges
id, season_id, name, description, kind challenge_kind, metric metric_type, target_value numeric null (coletivo), reward_points int, reward_description text, starts_at, ends_at, status challenge_status, created_by, created_at.
### challenge_participants (challenge_id, profile_id, PK). Duelo = exatamente 2; team = todos ativos (ou lista).
Progresso via view `v_challenge_progress` (soma de entries por participante na janela/métrica).
Função `finish_challenge(id)` (admin): define vencedor(es) e credita reward_points.

### wheels
id, kind wheel_kind unique, name, is_active. Seed: classic, premium.
### wheel_prizes
id, wheel_id, label, kind prize_kind, value numeric null (pontos/moedas/R$), weight int default 1, sort_order, is_active. Seed com os 6 + 8 do original.

### wheel_queue
id, profile_id null, person_name text, wheel_id, attempts_allowed int default 1 check 1..20, attempts_used int default 0, status queue_status, source ('manual'|'earned'), created_by, created_at, released_at, finished_at.
Regra: no máximo 1 entrada `active` (índice único parcial).

### wheel_spins
id, queue_id null, profile_id null, person_name, wheel_id, prize_id, prize_label (snapshot), prize_kind, prize_value, is_free bool (giro livre), status spin_status, spun_at, approved_by, approved_at, entry_id null (crédito gerado).
Funções: `release_turn(queue_id)`, `spin_wheel(queue_id null, wheel_kind)` → sorteia por peso, grava spin pending (ou free), retorna prize + index; `approve_spin(spin_id)` → credita (points/coins via entry; cash/voucher → cria reward_redemption 'approved' a entregar; extra_spin → attempts_allowed+1), incrementa attempts_used, fecha queue se acabou; `reject_spin(spin_id)`.

### rewards
id, name, category text, value_amount numeric null, cost_coins int, stock int null, icon text, is_active, sort_order, created_at.
### reward_redemptions
id, reward_id null (pode ser prêmio da roleta), profile_id, title (snapshot), cost_coins int, value_amount, status redemption_status, requested_at, handled_by, handled_at, notes, entry_id (débito de moedas).
Função `redeem_reward(reward_id)` (colaborador): valida saldo e estoque, cria redemption 'requested' + entry -coins.

### achievements
id, code unique, title, description, icon, criteria achievement_criteria, criteria_value numeric, is_active, sort_order. Seed com as 6.
### profile_achievements (profile_id, achievement_id, unlocked_at, PK composto).
Trigger após insert em point_entries e função `evaluate_achievements(profile_id)`.

### special_events
id, name ("Hora do Fogo"), description, multiplier numeric (2.0), starts_at, ends_at, is_active. Regra: ao inserir entry com source 'rule' dentro de evento ativo → points *= multiplier (trigger before insert).

### notifications
id, profile_id (null = todos), kind, message, is_read, created_at.

### activity (feed) — VIEW `v_activity_feed`
union de: entries source rule com metric sale ("realizou uma venda de R$ X"), profile_achievements ("desbloqueou X"), wheel_spins approved ("ganhou X na roleta"), level-ups (derivado? talvez tabela `level_events` preenchida por trigger).

## Views
- `v_profile_stats`: por perfil, temporada ativa: points, coins_balance, sales_amount, meetings_held, meetings_scheduled, calls, conversion_pct, level, xp_in_level, xp_to_next, streak_days, rank, gap_to_above, missions_completed.
- `v_ranking`: v_profile_stats ordenada (só ativos).
- `v_mission_progress`: por (mission, profile) progress_count, is_completed.
- `v_challenge_progress`: por (challenge, participant) value.
- `v_team_stats`: totais do time na temporada (sales, points, goal, attainment, coins, redemptions_amount, missions_completed, queue_count, avg_conversion).
- `v_sales_timeline`: vendas e pontos acumulados por dia na temporada (gráficos).
- `v_activity_feed`.
- `v_wheel_history`: últimos spins aprovados.

## RLS (matriz)
| tabela | colaborador SELECT | colaborador INSERT/UPDATE | admin |
|---|---|---|---|
| app_settings | sim (sem team_code? → coluna sensível; usar view `v_public_settings`) | não | tudo |
| seasons | sim | não | tudo |
| profiles | todos ativos (ranking precisa) | só o próprio (nome, foto) | tudo |
| point_rules | sim | não | tudo |
| point_entries | só as próprias + agregados via views (views `security_invoker`? → ranking precisa ver pontos de todos: views definer ou policy select geral) | não | tudo |
| missions/participants/completions | sim | não | tudo |
| challenges/participants | sim | não | tudo |
| wheels/prizes | sim | não | tudo |
| wheel_queue / spins | sim | não (só via RPC) | tudo |
| rewards | sim | não | tudo |
| reward_redemptions | próprias | insert via RPC `redeem_reward` | tudo |
| achievements / profile_achievements | sim | não | tudo |
| special_events | sim | não | tudo |
| notifications | próprias ou globais | update is_read própria | tudo |

Storage: bucket `avatars` público para leitura; upload só do próprio arquivo (`{uid}/*`) ou admin.

## Perguntas em aberto para os críticos
1. Pontos de todos visíveis para colaboradores (ranking) vs. privacidade do ledger: SELECT geral em point_entries ou views definer?
2. Moedas: derivadas de pontos (coins_per_point) ou definidas por regra? (Original: carteira mostra "+100 Venda, +50 Missão, +200 Meta" — parece que moedas ≈ pontos das regras.) Proposta: cada regra tem `coins` próprio; padrão = points.
3. Streak: calcular em view (custoso?) ou manter coluna materializada por trigger.
4. Level-up: evento derivado ou tabela.
5. Duelo com 2 participantes: constraint via trigger.
6. Temporada: entries fora da temporada ativa contam? Proposta: `season_id` obrigatório = temporada ativa no momento do lançamento.
