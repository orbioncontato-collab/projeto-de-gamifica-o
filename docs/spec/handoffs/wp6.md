# Handoffs — WP6 (Dashboard administrativo e Equipe)

Uma linha por pedido; nenhum arquivo de outro pacote foi editado.

- **WP0 (`src/lib/database.types.ts`)**: `supabase.from('app_secrets').select('team_code').single()` infere `data: never` (o tipo `Insert/Update: never` quebra a inferência do builder); `features/team/api.ts#getTeamCode` contorna com `unwrap<Pick<AppSecretsRow,'team_code'>>(...)` — avaliar `Insert: Record<string, never>` ou equivalente para as tabelas só-RPC.
- **WP1 (`src/features/auth/api.ts`)**: reexportar `assertAvatarFile` de `avatar-api.ts` (hoje só `cleanupAvatarFolder`/`uploadMyAvatar` saem por `api.ts`); enquanto isso `features/team/api.ts` tem `assertAdminAvatarFile` com a mesma regra (MIME + 1,5 MB) para não importar de `avatar-api` direto.
- **WP2 (`features/dashboard`)**: `useCollaboratorDashboard` (WP6) usa a mesma chave `qk.dashboard.one(profileId, seasonId)` e o mesmo payload `get_dashboard(p_profile_id, p_season_id)` — sem conflito, só registrando o compartilhamento de cache.
- **WP7 (`/admin/pontuacao`, `/admin/configuracoes`)**: WP6 navega para `?aba=lancar`, `?aba=historico` e `?aba=temporadas` conforme os `validateSearch` atuais dos stubs; se os nomes mudarem, avisar.
- **WP8 (`components/shared`)**: `EmptyStateAction` não aceita `search` no `to`; para CTAs com query string (`/admin/configuracoes?aba=temporadas`) WP6 usa `onClick` + `navigate`. Opcional: aceitar `search` em `EmptyStateAction`.
- **Integração (onda 3)**: `npx tsc -b --noEmit` na data desta entrega falha apenas em `src/features/settings/**` e `src/features/points/**` (WP7 em andamento); os arquivos do WP6 estão limpos.

## Resultado da integração (onda 3)

- `database.types` · **aplicado** — `Insert/Update: never` → `RpcOnly = Record<string, never>` nas 27 tabelas só-RPC (a inferência de `select(colunas)` volta a funcionar); `getTeamCode` mantém tipagem explícita porque o retorno contextual `Promise<string>` ainda faz `unwrap<T>` inferir `never`.
- `assertAvatarFile` reexportado por `features/auth/api.ts` · **aplicado** — `assertAdminAvatarFile` virou alias (mesma regra, sem duplicação).
- `/admin/pontuacao?aba=...` e `/admin/configuracoes?aba=temporadas` · **confirmados** nos `validateSearch` finais.
- `EmptyStateAction.search` · **aplicado** — dashboard admin e Equipe usam `to + search`.
