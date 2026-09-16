# Handoffs — WP1 (Layout, autenticação e notificações)

Uma linha por pedido: arquivo · mudança · motivo. Nada aqui foi editado pelo WP1.

- `src/lib/realtime.ts` (WP0) · adicionar `onChange?: (payload) => void` opcional em `useRealtimeInvalidate` · `useNotificationsRealtime` precisa do `notify.info(title)` no INSERT (§4.5) e hoje usa `subscribeToTables` direto com debounce próprio (250 ms duplicado em `features/notifications/hooks.ts`).
- `src/lib/query-keys.ts` (WP0) · `qk.notifications.list: (limit?: number) => [...]` · o sino consulta 8 e a página futura pode consultar 20; WP1 usa `[...qk.notifications.list(), limit]` como chave (ainda casa com `qk.notifications.all()` na invalidação).
- `src/features/team/api.ts` (WP6) · `export { cleanupAvatarFolder } from '@/features/auth/api'` · reexport previsto em §4.5; a função vive em `features/auth/avatar-api.ts` e é reexportada por `features/auth/api.ts`.
- `src/main.tsx` (WP0) · opcional: trocar `AppSplash` por `SplashScreen` de `features/auth/components/splash-screen.tsx` · só para seguir o nome de §3.2; o componente é um wrapper do `AppSplash`, sem diferença visual.
- `src/routes/_app/desafios.tsx` (WP3) · manter `validateSearch` aceitando `gerenciar?: boolean` · os dois itens "Desafios" da sidebar usam busca exata (`exact + includeSearch`) para não acender juntos (§3.6); item principal aponta para `/desafios` sem busca e o da administração para `?gerenciar=true`.
- `src/routes/_app/missoes.tsx`, `_app/recompensas.tsx`, `_admin/admin/pontuacao.tsx`, `_admin/admin/recompensas.tsx`, `_admin/admin/configuracoes.tsx` (WP3/5/7) · os links da sidebar passam a busca padrão (`filtro: 'hoje'`, `aba: 'loja'|'lancar'|'pedidos'|'geral'`) porque o `validateSearch` devolve campos obrigatórios · se algum pacote tornar o campo opcional, `components/layout/sidebar-nav.ts` pode remover o `search`.

## Resultado da integração (onda 3)

- `src/lib/realtime.ts` · **aplicado** — `useRealtimeInvalidate({ onChange? })`; `useNotificationsRealtime` passou a usá-lo (debounce duplicado removido).
- `src/lib/query-keys.ts` · **aplicado** — `qk.notifications.list(limit?)`.
- `src/features/team/api.ts` · **já estava** — `export { cleanupAvatarFolder }` presente.
- `src/main.tsx` · **aplicado** — `SplashScreen` no lugar de `AppSplash`.
- `src/routes/_app/desafios.tsx` · **já estava** — `gerenciar?: boolean` mantido no `validateSearch`.
- Links da sidebar com busca padrão · **mantido** — nenhum pacote tornou os campos opcionais.
