# Handoffs — SQL fixer r2 (correções após red team r2)

Uma linha por pedido: arquivo · mudança · motivo. Detalhes em `supabase/DECISIONS.md` (entradas "SQL fixer r2").

- `docs/spec/DATA-MODEL.md` §9 (dono da spec) · adicionar `INVALID_ARGUMENT` ("Valor inválido." — detail varia: campo/constraint, "Campo obrigatório", "Valor fora da faixa permitida", "Data ou hora inválida", "Registro duplicado", "Referência inexistente"; RPCs de escrita com entrada livre) · §9 promete código de catálogo em toda escrita via RPC; 50 chamadas hostis vazavam 22P02/22007/22003/23514/23502/23503/23505 crus.
- `docs/spec/DATA-MODEL.md` §9 · anotar que argumento **tipado como enum na assinatura** (`save_wheel_prizes.p_wheel_kind`, `enqueue_wheel.p_wheel_kind`) fora do enum devolve 22P02 do cast antes da função (inalcançável por SQL) · o front só envia valores do enum.
- `docs/spec/DATA-MODEL.md` §4.7 point_entries · `point_entries_rule_only_ck` = `(source in ('rule') or rule_id is null or reverses_entry_id is not null)` e `point_entries_not_empty_ck` = `(... or reverses_entry_id is not null)` · §7.4 (source = system) + §6.6 passo 2 (herda rule_id) violavam os dois CKs; estorno de regra 0/0 não passava.
- `docs/spec/DATA-MODEL.md` §4.8 activities_count e §4.18 challenge_value('activities') · no estorno, o filtro `source in ('rule','manual')` olha a source da **original** · com source = system (§7.4) o estorno nunca decrementaria atividades.
- `docs/spec/DATA-MODEL.md` §6.7 A · `last_entry_at`: no estorno de original que contava (`counts_for_streak`), recalcular `max(occurred_at) filter counts_for_streak` da temporada · `greatest()` mantinha a data estornada e divergia de `recompute_stats` (§7.2).
- `docs/spec/DATA-MODEL.md` §7.4 · registrar que `admin_update_profile` compara e-mail com `lower(trim())`; `save_wheel_prizes` exige `sort_order` inteiro ≥ 0 (`INVALID_ARGUMENT`) · bugs de 23505 cru.
- `src/lib/rpc-errors.ts` (WP0) · mapear `INVALID_ARGUMENT` → "Valor inválido." com fallback para `error.details` (traz o campo) · novo código devolvido pelas RPCs de escrita.
- `src/lib/rpc-errors.ts` / telas de histórico (WP dono do ledger) · estorno de lançamento de regra/manual chega com `source = 'system'` em `v_ledger` (rótulo "Sistema"; `rule_name` continua preenchido) · §7.4 agora implementado literalmente.
