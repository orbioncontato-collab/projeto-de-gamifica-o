# Handoffs — WP7 (Pontuação, Configurações e Guia)

Uma linha por pedido: arquivo · mudança · motivo. Nenhum arquivo alheio foi editado.

- `src/lib/query-keys.ts` (WP0) · adicionar `qk.ledger.hasEntries: () => ['ledger', 'has-entries']` · o WP7 usa `[...qk.ledger.all(), 'has-entries']` em `features/settings/hooks.ts` (`useHasLedgerEntries`) para travar o fuso; formalizar na fábrica.
- `src/features/auth/test-utils.tsx` (WP1) · promover `renderInRouter`/`makeBootstrap`/`makeMe` para `src/test/render.tsx` (WP0) · os 4 testes de página do WP7 (`points-page.test.tsx`, `platform-settings-page.test.tsx`, `preferences-page.test.tsx`, `guide-page.test.tsx`) importam daqui porque `Link`/`useNavigate` exigem router (mesmo pedido do WP5).
- `src/lib/format.ts` (WP0) · adicionar `formatLocalDay(day: 'YYYY-MM-DD') => 'DD/MM/YYYY'` · datas de calendário (`starts_on`/`ends_on` das temporadas, `local_today() + 1`) não podem passar por `new Date()` sem virar o dia no fuso; o WP7 mantém `formatLocalDay` em `features/settings/season-logic.ts` até promover.
- `src/lib/format.ts` (WP0) · adicionar `hideTeamCode(masked)` ("A3F9-C21B-7E04" → "••••-••••-7E04") ao lado de `maskTeamCode` · a Equipe (`InviteDialog`, WP6) exibe o mesmo código mascarado; hoje a função vive em `features/settings/team-code.ts`.
- `src/components/shared/empty-state.tsx` (WP0/WP8) · aceitar `action.search` além de `to` · o estado vazio de "Lançar" quer levar à aba `?aba=regras` da mesma rota; o WP7 contorna com texto orientando "aba Regras".
- `docs/spec/FRONTEND-ARCH.md` §6 WP7 (documentação) · registrar que a checklist embutida em Configurações › Geral (`setup-checklist.tsx`) é uma versão derivada do estado (temporada ativa, meta, pendentes, próxima temporada) com link para o guia completo; a lista estática de 9 itens vive só em `features/guide/guide-steps.ts` porque `features/settings` não pode importar de `features/guide` (§2.3).
- `docs/spec/FRONTEND-ARCH.md` §6 WP7 (documentação) · a trava do fuso usa `v_point_entries_history` (`count: exact, head: true`) em vez de `v_admin_kpis.entries_count` · o KPI é por temporada e `TIMEZONE_LOCKED` vale para qualquer lançamento em qualquer temporada (DATA-MODEL §7.2); evita também importar `useAdminKpis` de `features/admin-dashboard` (WP6).

## Resultado da integração (onda 3)

- `qk.ledger.hasEntries()` · **aplicado** — `features/settings/hooks.ts` usa a fábrica.
- Helpers de teste em `src/test/render.tsx` · **aplicado**.
- `formatLocalDay` e `hideTeamCode` em `src/lib/format.ts` · **aplicado** — `season-logic.ts` e `team-code.ts` reexportam.
- `EmptyState.action.search` · **aplicado** — o estado vazio de "Lançar" ganhou o botão "Ir para Regras" (`?aba=regras`).
- Notas de §6 WP7 (checklist derivada em Configurações › Geral; trava do fuso por `v_point_entries_history`) · **aplicado** em FRONTEND-ARCH.
