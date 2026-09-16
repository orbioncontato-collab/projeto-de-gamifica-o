# Handoffs — SQL fixer r1 (correções após red team r1)

Uma linha por pedido: arquivo · mudança · motivo. Detalhes em `supabase/DECISIONS.md` (entradas "SQL fixer r1").

- `docs/spec/DATA-MODEL.md` §9 (dono da spec) · adicionar `NAME_REQUIRED` ("Informe o nome (1 a 60 caracteres)." — create_season, update_season), `GOAL_INVALID` ("A meta deve ser um valor entre 0 e 999.999.999.999." — create_season, update_season, admin_update_profile) e `AMOUNT_INVALID` ("O valor em R$ deve ser no máximo 999.999.999.999." — record_rule_entry) · §9 promete código de catálogo em toda escrita via RPC; esses casos vazavam 23502/23514/22003/22007 crus.
- `docs/spec/DATA-MODEL.md` §7.3 update_season · registrar que `starts_on`/`ends_on` não conversíveis para `date` respondem `SEASON_RANGE_INVALID` · antes vazava 22007.
- `docs/spec/DATA-MODEL.md` §6.7 A · trocar `first_sale_at = coalesce(first_sale_at, NEW.occurred_at)` por `least(first_sale_at, NEW.occurred_at)` · venda retroativa divergia de `recompute_stats` (`min(occurred_at)`), violando §7.2.
- `docs/spec/DATA-MODEL.md` §4.9 · anotar que `best_streak_days = greatest(best, streak_days)` vale só no caminho incremental; em `recompute_streak` é `max(ilhas)` (§6.2) e pode regredir após estorno · duas frases da spec pareciam contradizer-se; implementação segue §6.2.
- `src/lib/rpc-errors.ts` (WP0) · mapear `NAME_REQUIRED`, `GOAL_INVALID`, `AMOUNT_INVALID` para os textos acima · novos códigos devolvidos por RPCs admin.

## Resultado da integração (onda 3)

- `src/lib/rpc-errors.ts` · **aplicado** — `NAME_REQUIRED`, `GOAL_INVALID`, `AMOUNT_INVALID` mapeados com os textos do catálogo.
- Pedidos a `docs/spec/DATA-MODEL.md` (§9, §7.3, §6.7 A, §4.9) · **pendentes com o dono da spec** (integrador não edita DATA-MODEL).
