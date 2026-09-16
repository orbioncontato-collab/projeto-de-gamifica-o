# Handoff — RED TEAM r1 (segurança) → agente SQL (supabase/migrations/20260915000010_rpcs.sql)

Teste: `supabase/test/redteam-security-r1.test.mjs` (33 testes; 31 passam, 2 falham — ambos baixa severidade, nenhum vazamento/escalada encontrado).

- `record_manual_entry`: `abs(v_coins)` estoura com `p_coins = -2147483648` (22003 cru) — validar `v_coins between -100000 and 100000` em vez de `abs()` → `POINTS_INVALID`.
- `create_season(p_name null)`: vaza 23502 cru — validar `p_name` (trim/length) → código do catálogo (ex.: `NAME_REQUIRED`) antes do insert.
- `record_rule_entry(p_amount 1e30)`: vaza 22003 cru (numeric overflow) — validar `p_amount <= 1e12` (ou o teto do CK) → `AMOUNT_INVALID`.
- `admin_update_profile({goal_amount: -5})`: vaza 23514 cru (CK de `season_goals`) — validar `goal_amount >= 0` → `GOAL_INVALID`.
- `update_season({starts_on: 'abc'})`: vaza 22007 cru — capturar `invalid_datetime_format` → `SEASON_RANGE_INVALID`.
- (informativo) `save_wheel_prizes(p_prizes null | {} | [{}])` responde `SORT_ORDER_DUPLICATE` — código enganoso; `PRIZES_INVALID` seria mais claro (não é bug de segurança).

## Resultado da integração (onda 3)

- Todos os pedidos são do SQL (`supabase/`, fora do escopo do integrador). No front, os novos códigos (`NAME_REQUIRED`, `GOAL_INVALID`, `AMOUNT_INVALID`) já têm mensagem em `rpc-errors.ts`; `PRIZES_INVALID` não existe nas migrations, então não foi mapeado.
