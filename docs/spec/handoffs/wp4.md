# Handoff — WP4 (Roleta) → outros pacotes

Nenhum arquivo fora de `src/features/wheel/**`, `src/routes/_app/roleta.tsx` e `src/routes/_app/_admin/admin/roleta.tsx` foi alterado.

- WP0 (`src/lib/query-keys.ts`): `qk.wheel.history()` não recebe `limit`; o WP4 usa `[...qk.wheel.history(), limit]` (mesmo padrão de `useNotifications`). Opcional: `history: (limit?: number) => [...]`.
- WP0 (`src/lib/database.types.ts`): `VWheelQueue` não expõe `prizes_hash` da roleta; o WP4 confere `prizes_hash` só via `sector_count !== prizes.length`/`prize.id` ausente (refetch de `wheel.config`). Opcional: expor `prizes_hash` em `v_wheel_queue`/`wheels` para comparação direta (DATA-MODEL §7.6 diz "se `prizes_hash` divergir").
- WP0 (`eslint.config.js`): a regra `no-restricted-syntax` de hex também pega arquivos `*.test.ts` em `src/features/**`; os testes do WP4 montam cores por template literal/`WHEEL_PALETTE`. Opcional: excluir `**/*.test.{ts,tsx}` da regra.
- WP0 (`src/styles/skeletons` / `WheelSkeleton`): ok como está; nenhum ajuste necessário.
- WP8 (`src/styles/overlays.css`): `.confetti-layer` é reaproveitado pelo `Confetti` do WP4 (24 peças, 2,6 s) — manter as classes `confetti-layer` e `confetti-layer i` e os `nth-child` de cor.
- WP1 (`src/components/layout/sidebar-nav.ts`): nada a mudar; rotas `/roleta` e `/admin/roleta` já apontam para `WheelPage` e `PrizeEditor`.
- Contratos adicionais do WP4 (só dentro de `features/wheel`, sem impacto): `useWheelState(fallbackKind?)` devolve também `queueQuery`; `useWheelRealtime` aceita `onPrizesChanged?` e `enabled?`; helpers puros em `wheel-logic.ts`, `spin-controller.ts`, `prize-editor-state.ts`.

## Resultado da integração (onda 3)

- `qk.wheel.history(limit?)` · **aplicado** — `features/wheel/hooks.ts` usa a fábrica.
- `prizes_hash` em `VWheelQueue` · **recusado (fora do front)** — exigiria mudar `v_wheel_queue` (supabase/, agentes SQL); `spin_wheel` já devolve `prizes_hash` no payload e a conferência por `sector_count`/`prize.id` continua válida.
- `eslint.config.js` hex em testes · **aplicado**.
- `.confetti-layer` · **mantido** intacto em `styles/overlays.css`.
