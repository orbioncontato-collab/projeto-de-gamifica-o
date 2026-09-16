# Handoffs — WP2 (Visão geral, Ranking e Perfil)

Uma linha por pedido: arquivo · mudança · motivo. Nada aqui foi editado pelo WP2.

## Pedidos a outros pacotes

- `src/features/auth/test-utils.tsx` (WP1) · manter exportados `renderInRouter`, `makeMe`, `makeBootstrap` (o comentário diz "só para testes do WP1") · os testes de página do WP2 (`collaborator-dashboard.test.tsx`, `manager-overview.test.tsx`, `ranking-page.test.tsx`, `profile-page.test.tsx`) os importam para não duplicar o router de memória.
- `src/features/auth/test-utils.tsx` (WP1) · opcional: `makeMe().color` em hex (ex.: lido de `--avatar-fallback`) em vez de `var(--avatar-fallback)` · no banco `profiles.color` é hex (DATA-MODEL §4.6); o formulário do Perfil trata cor não-hex como "manter", mas fixtures em hex testariam o caminho real.
- `eslint.config.js` (WP0) · opcional: liberar a regra `noHexLiteral` em `**/*.test.{ts,tsx}` · fixtures de cor em testes precisam de hex (formato do banco); WP2 contornou com `hex('00E887')` em `profile/schemas.test.ts`.
- `src/components/shared/empty-state.tsx` (WP8) · opcional: `action.search?: Record<string, unknown>` para links com search obrigatório · `NoSeasonState`/`OnboardingCard` usam `useNavigate` + `onClick` para chegar em `/admin/configuracoes?aba=temporadas`, porque `action.to` não aceita `search`.
- `src/lib/database.types.ts` (WP0) · nada a mudar: `get_dashboard.stats` pode vir `null` (perfil sem linha em `v_profile_stats`); o WP2 cai para os números do bootstrap (`fallbackStats` em `collaborator-dashboard.tsx`) · registro.

## Decisões do WP2 (para o integrador)

- `NoSeasonState` (features/dashboard/components) é reutilizado por Ranking e Perfil (dependência `ranking → dashboard`, `profile → dashboard`, só desse componente).
- `useActivityFeed` é `useInfiniteQuery` com chave `qk.feed()` e cursor `occurred_at`; `getActivityFeedPage` devolve `{ rows, nextCursor }` (nextCursor `null` quando a página veio incompleta). O feed embutido em `get_dashboard.feed` não é usado (a lista viva usa o hook paginado + realtime).
- `useTeamOverview` usa a chave `qk.admin.teamStats(seasonId)` (mesma de `useTeamStats` do WP6) — cache compartilhado, sem consulta duplicada.
- Visão do gestor: card de onboarding (§9) aparece enquanto `v_team_stats.sales_count = 0` ou `total_count <= 1`.
- Perfil: paleta sugerida da cor lê os tokens do tema em runtime (`readAvatarPresets`), sem hex no código; o `<input type="color">` nativo continua disponível para cor livre.
- Sem temporada ativa: `useDashboard` não consulta; Perfil mostra os números do bootstrap e o estado §9 no lugar dos stats; Ranking mostra só o estado §9.

## Resultado da integração (onda 3)

- `test-utils` · **aplicado** — `renderInRouter`/`makeMe`/`makeBootstrap`/`TEST_SETTINGS` promovidos para `src/test/render.tsx`; `features/auth/test-utils.ts` só reexporta.
- `makeMe().color` · **aplicado** — agora `#f97316` (hex do banco, mesmo valor de `--avatar-fallback`).
- `eslint.config.js` · **aplicado** — `no-restricted-syntax` (hex) desligada em `**/*.test.{ts,tsx}`, `src/test/**` e `features/auth/test-utils.ts`.
- `EmptyState.action.search` · **aplicado** — `NoSeasonState` usa `to + search` (sem `useNavigate`).
- `get_dashboard.stats` nulo · **registro** — `fallbackStats` mantido.
