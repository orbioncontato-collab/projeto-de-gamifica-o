# Handoffs — WP3 (Missões e Desafios)

Uma linha por pedido: arquivo · mudança · motivo.

- `src/features/profiles/components/` (WP0) · promover um `ParticipantsPicker` múltiplo (`{ value: string[]; onChange; max?; id?; disabled? }` — `PersonPicker` + chips removíveis) · hoje existe em cópia idêntica em `features/missions/components/participants-picker.tsx` e `features/challenges/components/participants-picker.tsx` porque a regra §2.3 proíbe import entre features; ao promover, as duas cópias podem ser apagadas.
- `src/lib/query-keys.ts` (WP0) · opcional: `qk.challenges.board(seasonId)` recebe sufixo de status no `features/challenges/hooks.ts` (`[...qk.challenges.board(seasonId), 'active,draft,finished']`) · o board público (active+finished) e o gestor (todos os status) precisam de caches distintos; se preferir, adicionar o parâmetro `statuses` à fábrica.
- `src/features/wheel/components/queue-add-form.tsx` (WP4) · 2 erros `TS2375/TS2379` (`exactOptionalPropertyTypes`) observados durante o `tsc -b` do WP3 · não são do WP3; registrados para o integrador.
- `src/features/rewards/components/rewards-page.test.tsx` (WP5) · `coins_balance` não existe em `BootstrapMe | BootstrapMeBlocked` (TS2339) observado durante o `tsc -b` · idem, fora do WP3.
- `src/features/team/api.ts` (WP6) · 1 erro TS observado no último `tsc -b` · idem, fora do WP3.

## Resultado da integração (onda 3)

- `ParticipantsPicker` · **aplicado** — promovido para `src/features/profiles/components/participants-picker.tsx`; as duas cópias (missions/challenges) apagadas e os imports trocados.
- `qk.challenges.board(seasonId, statuses?)` · **aplicado** — `features/challenges/hooks.ts` usa a fábrica.
- Erros TS em `wheel/queue-add-form.tsx`, `rewards-page.test.tsx`, `team/api.ts` · **já resolvidos** pelos donos antes da integração (`tsc -b` limpo).
