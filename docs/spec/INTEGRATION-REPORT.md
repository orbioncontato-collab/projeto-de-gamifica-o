# Relatório de integração — onda 3 (FRONTEND-ARCH Apêndice B)

Data: 2026-09-15 · Escopo: `src/**` e configs da raiz (nunca `supabase/`, nunca `DATA-MODEL.md`). Nada foi commitado.

## 1. Resultado das verificações (saída final)

| Comando | Resultado |
|---|---|
| `npm run build` (`tsc -b && vite build`) | **OK** — exit 0, `dist/` gerado (maior chunk `index` 464,7 kB / 144,4 kB gzip) |
| `npm run lint` (`eslint .`) | **OK** — exit 0, 0 erros, 0 avisos |
| `npm run typecheck` (`tsc -p tsconfig.json` + `tsconfig.node.json`) | **OK** — exit 0 |
| `npm test` (`vitest run`) | **OK** — 51 arquivos, **398 testes passando** (eram 50 / 328 antes da integração) |
| `npx prettier --check .` | **OK** — todos os arquivos no estilo |
| `npx tsr generate` | árvore de rotas regenerada sem diferença (20 rotas) |

## 2. Handoffs aplicados (docs/spec/handoffs/*.md)

Cada arquivo de handoff recebeu uma seção **"Resultado da integração (onda 3)"** com o destino de cada pedido. Resumo:

| Pedido | Arquivo(s) | Situação |
|---|---|---|
| `useRealtimeInvalidate({ onChange? })` (WP1) | `src/lib/realtime.ts`, `features/notifications/hooks.ts` | aplicado; o hook de notificações deixou de duplicar o debounce |
| `qk.notifications.list(limit?)`, `qk.wheel.history(limit?)`, `qk.challenges.board(seasonId, statuses?)`, `qk.ledger.hasEntries()` (WP1/3/4/7) | `src/lib/query-keys.ts` + hooks das features | aplicado |
| `NAME_REQUIRED`, `GOAL_INVALID`, `AMOUNT_INVALID` (sql-fixer r1) | `src/lib/rpc-errors.ts` | aplicado |
| `renderInRouter`/`makeMe`/`makeBootstrap`/`TEST_SETTINGS` como helpers comuns (WP2/5/7) | `src/test/render.tsx` (origem), `features/auth/test-utils.ts` (reexport) | aplicado; `makeMe().color` em hex |
| hex liberado em testes (WP2/4) | `eslint.config.js` | aplicado (`**/*.test.*`, `src/test/**`, `test-utils.ts`) |
| `EmptyState.action.search` (WP2/5/6/7/8) | `components/shared/empty-state.tsx` + 6 chamadores | aplicado; `useNavigate` removido de `NoSeasonState`, `StoreGrid`, dashboard admin |
| `ParticipantsPicker` compartilhado (WP3) | `features/profiles/components/participants-picker.tsx` | aplicado; cópias de missions/challenges apagadas |
| `Insert/Update: never` → `RpcOnly` (WP6) | `src/lib/database/**` | aplicado nas 27 tabelas só-RPC |
| `assertAvatarFile` reexportado (WP6) | `features/auth/api.ts`, `features/team/api.ts` | aplicado (`assertAdminAvatarFile` = alias) |
| `formatLocalDay`, `hideTeamCode` (WP7) | `src/lib/format.ts` | aplicado; `season-logic.ts`/`team-code.ts` reexportam |
| `SplashScreen` em `main.tsx` (WP1, opcional) | `src/main.tsx` | aplicado |
| devtools contidos, `.safe-bottom`, reduced-motion da roleta (WP8) | `routes/__root.tsx`, `layout/bottom-nav.tsx`, `wheel/wheel.css` | aplicado |
| FRONTEND-ARCH §2.2 `novo?: boolean` e notas §6 WP7 | `docs/spec/FRONTEND-ARCH.md` | aplicado |
| `prizes_hash` em `v_wheel_queue` (WP4) | `supabase/` | **recusado** — view do banco; `spin_wheel` já devolve o hash |
| Alterações em `DATA-MODEL.md` (sql-fixer r1) e RPCs (red team r1) | spec / SQL | **pendentes com os donos** (fora do escopo do integrador) |

## 3. FEATURE-INVENTORY §0–§15 × implementação

Todas as 20 rotas existem e apontam para páginas reais (nenhum stub restante). Componentes verificados por seção:

- §0/§1 — login/cadastro/aguardando, sidebar (8 + 6 admin + Roleta + Guia), topbar (temporada, moedas, sino, avatar, tema), bottom nav (5), toast.
- §2/§2b — `LevelHero`, `StatCards`, `SalesTarget` (ritmo), `NextReward`, `RankingPreview`, `EventBanner` (contador), `MissionPreview`, `ActivityFeed`; gestor: métricas, tabela "Desempenho do time", "Top 3", "Saúde comercial", `CollaboratorDetailDialog`.
- §3 — pódio + lista com "Você" e gap. §4 — filtros, missão relâmpago, cards, editor (gestor). §5 — `DuelCard`, `TeamChallengeCard`, `ChallengesManager`.
- §6 — seletor, roda com setores/rótulos/ponteiro, giro que para no setor sorteado, confete, resultado, fila completa + rápida, "GIRO LIVRE"/"VEZ DE", aprovar/fechar, "Últimas aprovações", editor de prêmios.
- §7 — carteira (saldo, origens, últimos créditos), loja ("Faltam N moedas"), catálogo/pedidos do gestor. §8 — grid de conquistas. §9 — perfil com 4 stats, mini-grid, edição (nome, foto, cor).
- §10–§14 — dashboard admin (atalhos, 6 métricas, 3 gráficos recharts, indicadores, barra operacional), Equipe (tabela/cards, pendentes, editor, pontos iniciais, convite com código), Pontuação (regras, lançar por regra/manual, histórico com estorno), Configurações (preferências; empresa, temporadas, eventos, código, aprovação automática, manutenção), Guia (9 passos + checklist derivada).
- §15 — dark/light por tokens em `html[data-theme]`, `ThemeSwitch`, `meta theme-color`.

Lacuna fechada em código nesta onda: estado vazio de "Lançar" sem regras ganhou CTA "Ir para Regras" (`?aba=regras`). Sem lacunas funcionais abertas no front; os itens de banco continuam com os agentes SQL.

## 4. Renderização com banco vazio, nos dois temas

Novo teste `src/routes/routes-smoke.test.tsx` monta a **árvore de rotas real** (`routeTree.gen.ts`) com um Supabase falso (`src/test/fake-supabase.ts`): nenhuma linha em tabela/view, `season = null`, apenas os singletons (`app_settings`, `app_secrets`) e o catálogo da roleta (DATA-MODEL §13). Cobre 3 rotas públicas + 9 rotas do colaborador + 22 combinações do gestor + redirect de colaborador em `/admin`, **em `dark` e em `light`** = 70 casos. Falha se aparecer `RouteErrorState`/`ErrorState`, se o React logar aviso de chave/DOM/act, ou se o tema aplicado divergir.

Capturas de tela (`docs/spec/qa/`) não foram produzidas: não há Supabase local nesta máquina para autenticar; o smoke acima é o substituto verificável.

## 5. Arquivos > 400 linhas

- `src/lib/database.types.ts` (1.729 linhas) → barril de 20 linhas + `src/lib/database/{enums,rows,rows-game,views,payloads,schema-tables,schema-tables-game,schema-views,schema-functions,schema}.ts` (maior: `views.ts`, 378). `PublicTables = PublicTablesCore & PublicTablesGame`; nomes exportados inalterados, nenhum import externo mudou.
- Restante: maior arquivo de código é `features/wheel/wheel.css` (310). `src/routeTree.gen.ts` (514) é gerado e ignorado.

## 6. Limpeza

- `TODO`/`FIXME`/`HACK`: 0 em `src/`. `console.log/debug/info`: 0 (regra `no-console` já bloqueia).
- Hex fora de `styles/tokens.css` e `wheel-palette.ts`: 0 — o `/dev/showcase` passou a ler as cores de avatar dos tokens em runtime (`readAvatarPresets`).
- Nomes fictícios de pessoas: 0 em `src/` (fixtures usam "Usuário de Teste", "Cadastro de Teste", etc.); comentário de exemplo em `format.ts` neutralizado.
- `window.scrollTo` stubado em `src/test/setup.ts` (elimina 200+ linhas de ruído "Not implemented" do jsdom).
- `npx prettier --write` aplicado em `src/`, `index.html`, `vercel.json`, `README.md` (132 arquivos estavam fora do estilo; `docs/` e `supabase/` são ignorados pelo `.prettierignore`).

## 7. Pendências para outros donos

1. **Dono da spec** — aplicar em `DATA-MODEL.md` os itens de `handoffs/sql-fixer-r1.md` (§9 novos códigos, §7.3, §6.7 A, §4.9).
2. **Agentes SQL** — itens de `handoffs/redteam-security-r1.md` (validações que ainda vazam SQLSTATE cru; `PRIZES_INVALID`).
3. **QA visual** — capturas `docs/spec/qa/{dark,light}/*.png` das 20 rotas quando houver um projeto Supabase de teste (`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`).
4. **Bundle** — chunks `index` (464 kB) e `admin` (400 kB) acima do orçamento sugerido; candidatos a `lazy` por rota: recharts (admin) e o pacote de formulários.
