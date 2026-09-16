# Handoffs — WP5 (Recompensas e Conquistas)

Uma linha por pedido: arquivo · mudança · motivo. Nenhum arquivo alheio foi editado.

- `src/features/auth/test-utils.tsx` (WP1) · promover `renderInRouter` para `src/test/render.tsx` (WP0) como helper comum · os testes de página do WP5 (`rewards-page.test.tsx`, `rewards-admin-page.test.tsx`, `achievements-page.test.tsx`) importam `renderInRouter`/`makeBootstrap`/`makeMe` daqui porque `Link`/`useNavigate` exigem router; o comentário do arquivo diz "só para testes do WP1".
- `src/components/shared/empty-state.tsx` (WP0/WP8) · aceitar `action.search` (ou `LinkProps`) além de `to` · o `EmptyState` da loja precisa levar o gestor a `/admin/recompensas?aba=catalogo&novo=true`; hoje o WP5 contorna com `action.onClick` + `useNavigate`.
- `docs/spec/FRONTEND-ARCH.md` §2.2 (documentação) · registrar o search param `novo=true` em `/admin/recompensas` (abre o editor de recompensa) · adicionado pelo WP5 na própria rota (`routes/_app/_admin/admin/recompensas.tsx`), sem impacto em outros pacotes.

## Resultado da integração (onda 3)

- `renderInRouter` em `src/test/render.tsx` · **aplicado** (reexport mantido em `features/auth/test-utils.ts`).
- `EmptyState.action.search` · **aplicado** — a loja vazia leva a `/admin/recompensas?aba=catalogo&novo=true` por `Link` (sem `useNavigate`).
- FRONTEND-ARCH §2.2 `novo?: boolean` em `/admin/recompensas` · **aplicado**.
