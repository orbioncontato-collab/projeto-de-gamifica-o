# FRONTEND-ARCH — Orbion Sales League (arquitetura do front)

> Versão 1.0, 15/09/2026 — **revisão 1.1 (15/09/2026, tarde): aprovação de membros** (DATA-MODEL Apêndice B.21): colaborador que se cadastra com `team_code` nasce `pending`; `/inativo` vira `/aguardando` (pendente e inativo); Equipe ganha a seção "Pendentes" com Aprovar/Recusar e badge na sidebar; Configurações ganha o toggle de auto-aprovação (§2.1, §2.2, §3.3, §3.4, §3.6, §4.2–4.5, §4.8, §6, §7, §8.2, §9). Base de verdade para todos os agentes que implementarem a SPA. Entradas: `FEATURE-INVENTORY.md` (o que a UI faz), `DATA-MODEL.md` (o que o banco expõe — views, RPCs, enums, códigos de erro), `research/VERCEL-VITE-TANSTACK-2026.md`, `research/SUPABASE-2026.md` e o código Lovable atual em `src/` (identidade visual a preservar).
>
> Decisões fechadas (não reabrir): Vite SPA sem SSR; remover TanStack Start/Nitro/`@lovable.dev/*`; single-tenant por instalação; 1º cadastro vira admin; colaboradores entram com `team_code`; **só admins registram atividades comerciais** (colaborador é somente leitura, exceto resgatar recompensa e editar nome/foto/cor/preferências); deploy na Vercel; Supabase = Postgres + Auth + Storage (sem Edge Functions).
>
> Convenções: texto de UI em pt-BR; identificadores de código em inglês (`camelCase` no TS, `snake_case` no SQL/colunas); nenhuma cor hex em componente (só tokens); nenhum `!important`; nenhum `any`; nenhum dado fictício no bundle — toda tela nasce em estado vazio bem desenhado (§9).

---

## 0. Índice

1. Stack alvo e `package.json`
2. Layout de pastas e rotas
3. Fluxo de autenticação e guardas
4. Contratos compartilhados (client, tipos, chaves de query, hooks, realtime, toast, formatadores, componentes)
5. Tema (tokens dark/light em `html[data-theme]`)
6. Mapa de propriedade de arquivos — 9 pacotes de trabalho
7. Definition of Done por pacote
8. Vercel, `vercel.json`, variáveis de ambiente, `.env.example`
9. Estados vazios (banco sem dados)
Apêndice A — identidade visual a preservar (paleta e padrões do Lovable)
Apêndice B — checklist de integração final

---

## 1. Stack alvo e `package.json`

### 1.1 Versões (verificadas no registro npm em 15/09/2026)

| Camada | Pacote | Versão | Nota |
|---|---|---|---|
| Runtime | Node.js | **>= 22.12** | Vite 8 aceita 20.19+, mas `vitest@5` e `@supabase/supabase-js@2.116` exigem 22+. Vercel: fixar **22.x** em Settings → Node.js Version |
| Build | `vite` | 8.3.0 | Rolldown; sem `overrides.rolldown` |
| | `@vitejs/plugin-react` | 6.1.1 | sem Babel |
| | `@tailwindcss/vite` + `tailwindcss` | 4.3.3 | config CSS-first (`@theme inline`) |
| | `typescript` | ~6.0.3 | `typescript-eslint@8.70` aceita `<6.1`; **não** usar TS 7 (port Go) ainda |
| UI | `react` / `react-dom` | ^19.2.0 (latest 19.3.0) | |
| Router | `@tanstack/react-router` | 1.170.36 | file-based |
| | `@tanstack/router-plugin` | 1.168.38 | peer `react-router ^1.170.36` (números diferentes são normais) |
| | `@tanstack/react-router-devtools` | 1.167.2 (dev) | |
| Dados | `@tanstack/react-query` | 5.102.8 | |
| | `@supabase/supabase-js` | 2.116.0 | |
| Gráficos | `recharts` | 3.10.1 | `react-is` como peer explícito |
| Ícones | `lucide-react` | 1.46.0 | sem ícones de marca; `aria-hidden` por padrão |
| Toast | `sonner` | 2.0.8 | |
| Forms | `react-hook-form` + `@hookform/resolvers` + `zod` | 7.88.0 / 5.9.1 / 4.6.5 | resolvers 5.x aceita zod 4 |
| Utils | `clsx`, `tailwind-merge`, `class-variance-authority`, `date-fns`, `tw-animate-css` | 2.1.1 / 3.7.0 / 0.7.1 / 4.4.0 / 1.4.0 | |
| Radix (só os usados) | ver §1.4 | | |
| Lint/format | `eslint` 10.10.0, `typescript-eslint` 8.70.0, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-react-refresh` 0.5.7, `eslint-config-prettier` 10.1.8, `prettier` 3.9.6, `globals` 17.12.0, `@eslint/js` 10.0.1 | | |
| Testes | `vitest` 5.0.1, `@vitest/coverage-v8` 5.0.1, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1, `@testing-library/user-event` 14.6.7, `jsdom` 30.0.1 | | unit para `src/lib/**` e hooks puros |

### 1.2 `package.json` (exato — substitui o atual por completo)

```json
{
  "name": "orbion-sales-league",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.9.1",
    "@radix-ui/react-alert-dialog": "^1.1.23",
    "@radix-ui/react-checkbox": "^1.3.11",
    "@radix-ui/react-dialog": "^1.1.23",
    "@radix-ui/react-dropdown-menu": "^2.1.24",
    "@radix-ui/react-label": "^2.1.15",
    "@radix-ui/react-select": "^2.3.7",
    "@radix-ui/react-separator": "^1.1.15",
    "@radix-ui/react-slot": "^1.3.3",
    "@radix-ui/react-switch": "^1.3.7",
    "@radix-ui/react-tabs": "^1.1.21",
    "@radix-ui/react-tooltip": "^1.2.16",
    "@supabase/supabase-js": "^2.116.0",
    "@tanstack/react-query": "^5.102.8",
    "@tanstack/react-router": "^1.170.36",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.4.0",
    "lucide-react": "^1.46.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-hook-form": "^7.88.0",
    "react-is": "^19.2.0",
    "recharts": "^3.10.1",
    "sonner": "^2.0.8",
    "tailwind-merge": "^3.7.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@tailwindcss/vite": "^4.3.3",
    "@tanstack/react-router-devtools": "^1.167.2",
    "@tanstack/router-plugin": "^1.168.38",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/node": "^26.6.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.1.1",
    "@vitest/coverage-v8": "^5.0.1",
    "eslint": "^10.10.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.7",
    "globals": "^17.12.0",
    "jsdom": "^30.0.1",
    "prettier": "^3.9.6",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.70.0",
    "vite": "^8.3.0",
    "vitest": "^5.0.1"
  }
}
```

Gerenciador de pacotes: **npm** (apagar `bun.lock` e `bunfig.toml`; commitar `package-lock.json`). Motivo: a Vercel detecta o install command pelo lockfile e o time não usa Bun.

### 1.3 O que sai do repositório (apagar no pacote WP0)

| Item | Motivo |
|---|---|
| deps `@tanstack/react-start`, `nitro`, `@lovable.dev/vite-tanstack-config`, `vite-tsconfig-paths`, `overrides.rolldown` | SSR/Start; alias `@/` passa a `resolve.alias` |
| deps `@radix-ui/react-accordion, -aspect-ratio, -avatar, -collapsible, -context-menu, -hover-card, -menubar, -navigation-menu, -popover, -progress, -radio-group, -scroll-area, -slider, -toggle, -toggle-group`, `cmdk`, `vaul`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels` | componentes shadcn não usados (§1.4). Datas usam `<input type="date">`/`datetime-local` nativos |
| `src/start.ts`, `src/server.ts`, `src/router.tsx` (reescrito), `src/routes/index.tsx`, `src/routes/README.md`, `src/routeTree.gen.ts` (regenerado), `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/lib/lovable-error-reporting.ts`, `src/styles.css` (substituído por `src/styles/*`) | Start/Lovable |
| `src/gamification-app.tsx`, `src/gamification.css`, `src/wheel-*.tsx/.css`, `src/manager-*.tsx/.css`, `src/admin-*.tsx/.css`, `src/theme-controller.tsx`, `src/theme.css`, `src/hooks/use-mobile.tsx` | overlays com dados fictícios e `!important`. **Antes de apagar**, o WP0 copia para `docs/spec/legacy/` os trechos de CSS reaproveitados (roda, confete, pódio) — ver Apêndice A |
| `.lovable/`, `AGENTS.md`, `bun.lock`, `bunfig.toml`, `components.json` (recriado), `README.md` (reescrito) | vestígios Lovable/Bun |
| `eslint.config.js` regra `no-restricted-imports: server-only` e ignores `.output/.vinxi` | Start |

### 1.4 shadcn/ui — componentes mantidos (11) e apagados (39)

Mantidos em `src/components/ui/` (restilizados com tokens, sem `.dark` class — §5):

| Arquivo | Radix | Uso |
|---|---|---|
| `button.tsx` | `react-slot` + cva | variantes `primary` (verde), `secondary` (vidro), `ghost`, `danger`, `gold`, `blue`; tamanhos `sm/md/lg/icon` |
| `input.tsx`, `textarea.tsx`, `label.tsx` | `react-label` | campos (`.field-input` do original vira o estilo padrão) |
| `select.tsx` | `react-select` | selects de formulário (cargo, métrica, roleta, regra) |
| `switch.tsx` | `react-switch` | preferências, ativo/inativo, auto-aprovação de membros |
| `checkbox.tsx` | `react-checkbox` | seleção de participantes |
| `dialog.tsx` | `react-dialog` | todos os modais (missão, desafio, recompensa, regra, perfil, resultado da roleta) |
| `alert-dialog.tsx` | `react-alert-dialog` | confirmações destrutivas (estornar, encerrar temporada, remover da fila, cancelar resgate, inativar) |
| `sheet.tsx` | `react-dialog` | sidebar drawer no mobile |
| `dropdown-menu.tsx` | `react-dropdown-menu` | sino de notificações, menu do avatar |
| `tabs.tsx` | `react-tabs` | filtros (Hoje/Semana/Especiais), abas de pedidos, abas de configurações |
| `tooltip.tsx` | `react-tooltip` | ícones de ajuda |
| `separator.tsx`, `skeleton.tsx`, `table.tsx`, `sonner.tsx` | — | |

Apagados: `accordion, alert, aspect-ratio, avatar, badge, breadcrumb, calendar, card, carousel, chart, collapsible, command, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, sidebar, slider, toggle, toggle-group`. `Avatar`, `Badge`, `Progress`, `PremiumCard` são componentes próprios em `components/shared` (identidade visual do produto, não a do shadcn). Gráficos usam `recharts` direto com `chart-theme.ts` (WP6).

### 1.5 Arquivos de configuração

`vite.config.ts`
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }), // sempre antes de react()
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  build: { sourcemap: false, target: 'baseline-widely-available' },
})
```

`vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/lib/**', 'src/features/**/hooks.ts', 'src/features/wheel/spin-engine.ts'], thresholds: { lines: 80 } },
  },
})
```

`tsconfig.json` (mantém o atual, com ajustes): `"include": ["src", "vite.config.ts", "vitest.config.ts", "eslint.config.js"]`, `"types": ["vite/client", "vitest/globals"]`, manter `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `paths: { "@/*": ["./src/*"] }`. Adicionar `"allowImportingTsExtensions": true` continua ok com `noEmit`. Como o script `build` roda `tsc -b`, criar `tsconfig.node.json` só para os arquivos de config (`vite.config.ts`, `vitest.config.ts`) com `"composite": true` e referenciá-lo em `references` — padrão do template `react-ts` do Vite.

`index.html` (raiz do projeto; **não existe hoje**, obrigatório em SPA Vite)
```html
<!doctype html>
<html lang="pt-BR" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#07111F" />
    <link rel="icon" href="/favicon.ico" />
    <title>Orbion Sales League</title>
    <script>
      /* aplica o tema antes do primeiro paint; chave única: orbion-theme */
      try {
        var t = localStorage.getItem('orbion-theme');
        document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
      } catch (e) { document.documentElement.dataset.theme = 'dark'; }
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`eslint.config.js`: `js.configs.recommended`, `tseslint.configs.recommended`, `react-hooks` (`rules-of-hooks: error`, `exhaustive-deps: warn`), `react-refresh/only-export-components: warn`, `eslint-config-prettier` por último; ignores `dist`, `src/routeTree.gen.ts`, `coverage`. Regra extra do projeto: `no-restricted-syntax` proibindo `Literal[value=/^#[0-9a-fA-F]{6}$/]` dentro de `src/features/**` e `src/components/**` (cores só por token; exceção: `src/features/wheel/wheel-palette.ts`).

`.prettierrc`: `{ "semi": false, "singleQuote": true, "printWidth": 110, "trailingComma": "all" }`. `.prettierignore`: `dist`, `src/routeTree.gen.ts`, `package-lock.json`.

`.gitignore`: acrescentar `.env`, `.env.local`, `.env.*.local`, `coverage/`, `.vercel/`; remover linhas Wrangler/Nitro/Vinxi.

---

## 2. Layout de pastas e rotas

### 2.1 Árvore completa

```
index.html
vercel.json
.env.example
vite.config.ts · vitest.config.ts · tsconfig.json · tsconfig.node.json · eslint.config.js · .prettierrc
public/
  favicon.ico · robots.txt
src/
  main.tsx                      # createRoot + QueryClientProvider + AuthProvider + RouterProvider
  router.tsx                    # createRouter({ routeTree, context }) + declare module Register
  vite-env.d.ts                 # ImportMetaEnv { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY }
  routeTree.gen.ts              # gerado pelo plugin — nunca editar
  routes/
    __root.tsx                  # RootRoute com contexto { queryClient, auth }; <Outlet/>, NotFound, ErrorComponent, Toaster, Devtools(dev)
    login.tsx                   # /login
    signup.tsx                  # /signup
    aguardando.tsx              # /aguardando (perfil pendente de aprovação OU inativado — mensagem por `me.status`)
    _app.tsx                    # layout pathless: guard sessão + bootstrap; <AppShell/> (sidebar/topbar/bottom nav) + <Outlet/>
    _app/
      index.tsx                 # /            Visão geral (colaborador) | Visão do gestor (admin)
      ranking.tsx               # /ranking
      missoes.tsx               # /missoes?filtro=hoje|semana|especiais
      desafios.tsx              # /desafios
      roleta.tsx                # /roleta      roda + fila (painéis do gestor só para admin)
      recompensas.tsx           # /recompensas carteira + loja (todos) ; ?aba=loja|pedidos
      conquistas.tsx            # /conquistas
      perfil.tsx                # /perfil      (editar nome/foto/cor)
      configuracoes.tsx         # /configuracoes  preferências pessoais (todos)
      _admin.tsx                # layout pathless: guard role === 'admin'
      _admin/
        admin/
          index.tsx             # /admin                Dashboard administrativo
          equipe.tsx            # /admin/equipe?perfil=<uuid>&busca=
          pontuacao.tsx         # /admin/pontuacao?aba=regras|lancar|historico
          recompensas.tsx       # /admin/recompensas?aba=pedidos|catalogo
          roleta.tsx            # /admin/roleta          editor de prêmios
          configuracoes.tsx     # /admin/configuracoes?aba=geral|temporadas|eventos|codigo
          guia.tsx              # /admin/guia
  lib/
    supabase.ts                 # singleton, callRpc, avatarUrl, isSupabaseConfigured
    database.types.ts           # tipos escritos à mão a partir de DATA-MODEL.md (§4.2)
    rpc-errors.ts               # código → mensagem pt-BR; getErrorMessage(); RpcError
    query-keys.ts               # fábrica `qk` + invalidateAfterLedgerChange()
    query-client.ts             # QueryClient com defaults (staleTime, retry, onError global)
    realtime.ts                 # subscribeToTable(), useRealtimeInvalidate()
    notify.ts                   # wrapper do sonner
    format.ts                   # BRL, números pt-BR, %, ordinal, datas, relativo, countdown, iniciais
    labels.ts                   # rótulos pt-BR dos enums (job_title, metric_type, prize_kind, status…)
    gamification.ts             # nível/XP, saudação, medalha, frase do feed, filtro de missão, projeção
    forms.ts                    # useZodForm(schema, defaults), schemas comuns (money, uuid, dateLocal)
    dates.ts                    # toLocalInput(), fromLocalInput(), seasonWindow helpers (fuso do app)
    utils.ts                    # cn()
  features/
    auth/
      api.ts                    # signIn, signUp (validate_team_code → auth.signUp → updateUser), signOut, signupMode   [WP1]
      hooks.ts                  # useSignupMode, useLogin, useSignup, useLogout, useUpdateMyProfile, useUploadMyAvatar, useUpdateMyPreferences   [WP1]
      auth-provider.tsx         # AuthState, AuthProvider (onAuthStateChange), useAuth   [WP0]
      bootstrap-query.ts        # getBootstrap, bootstrapQueryOptions() (usado em beforeLoad), useBootstrap, useMe   [WP0]
      components/
        login-form.tsx · signup-form.tsx · signup-success.tsx ("Cadastro enviado" — explica a aprovação; variante "confirme seu e-mail") · auth-layout.tsx
        awaiting-screen.tsx (/aguardando: `pending` → "aguardando aprovação" + "Verificar novamente"; `inactive` → "acesso desativado" + Sair) · splash-screen.tsx
    profiles/                   # read-model compartilhado (WP0): v_profile_stats, v_ranking, profiles ativos, profiles pendentes (admin), profile_private, v_achievement_board
      api.ts · hooks.ts         # inclui getAchievementBoard/useAchievementBoard (promovidos: Perfil (WP2) e Conquistas (WP5) consomem daqui) e getPendingMembers/usePendingMembers (Equipe (WP6) e sidebar (WP1) consomem daqui)
      components/person-picker.tsx
    notifications/
      api.ts · hooks.ts
      components/notification-bell.tsx · notification-list.tsx
    dashboard/
      api.ts · hooks.ts
      components/
        collaborator-dashboard.tsx · level-hero.tsx · stat-cards.tsx · sales-target.tsx · next-reward.tsx
        ranking-preview.tsx · event-banner.tsx · mission-preview.tsx · activity-feed.tsx
        manager-overview.tsx · team-performance-table.tsx · top3-card.tsx · health-card.tsx
    ranking/
      components/podium.tsx · ranking-list.tsx · ranking-row.tsx · ranking-page.tsx
    missions/
      api.ts · hooks.ts · schemas.ts
      components/missions-page.tsx · mission-filters.tsx · lightning-mission.tsx · mission-card.tsx · mission-editor-dialog.tsx · missions-admin-list.tsx
    challenges/
      api.ts · hooks.ts · schemas.ts
      components/challenges-page.tsx · duel-card.tsx · team-challenge-card.tsx · challenge-editor-dialog.tsx · challenges-manager.tsx · challenge-actions.tsx
    wheel/
      api.ts · hooks.ts · realtime.ts · spin-engine.ts · wheel-palette.ts · schemas.ts
      components/
        wheel-page.tsx · wheel-selector.tsx · wheel.tsx · wheel-sector-labels.tsx · wheel-status-pill.tsx · wheel-context-banner.tsx
        spin-button.tsx · spin-result-dialog.tsx · confetti.tsx
        queue-quick-panel.tsx · queue-panel.tsx · queue-add-form.tsx · queue-list.tsx · queue-row.tsx · wheel-history.tsx
        prize-editor.tsx (usado por /admin/roleta)
      wheel.css                 # roda, ponteiro, centro, rótulos por setor, confete (portado do Lovable, sem !important)
    rewards/
      api.ts · hooks.ts · schemas.ts
      components/rewards-page.tsx · wallet-card.tsx · reward-card.tsx · store-grid.tsx · my-redemptions.tsx
                 reward-editor-dialog.tsx · redemptions-admin-table.tsx · rewards-admin-page.tsx
    achievements/
      api.ts · hooks.ts
      components/achievements-page.tsx · achievement-card.tsx
    profile/                    # mini-grid de conquistas vem de components/shared/achievements-mini-grid.tsx (hook de features/profiles)
      components/profile-page.tsx · profile-header.tsx · profile-stats.tsx · edit-profile-dialog.tsx · avatar-upload.tsx
    admin-dashboard/
      api.ts · hooks.ts · chart-theme.ts
      components/admin-dashboard-page.tsx · admin-metrics.tsx · sales-area-chart.tsx · points-bar-chart.tsx · points-line-chart.tsx · health-indicators.tsx · operations-bar.tsx
    team/
      api.ts · hooks.ts · schemas.ts   # api.ts inclui getTeamCode() (app_secrets.team_code, chave qk.settings.secrets()) e recordInitialPoints()
      components/team-page.tsx · team-table.tsx · team-cards.tsx · collaborator-editor-dialog.tsx · collaborator-detail-dialog.tsx · admin-avatar-upload.tsx
                 initial-points-card.tsx (ação "Lançar pontos iniciais", separada do formulário) · invite-dialog.tsx (modal "Como adicionar colaboradores")
                 pending-members-section.tsx (seção "Pendentes": nome, e-mail, data do pedido, botões Aprovar/Recusar — DATA-MODEL §7.2/§14.1 passo 7)
    points/
      api.ts · hooks.ts · schemas.ts
      components/points-page.tsx · rules-list.tsx · rule-editor-dialog.tsx · record-entry-form.tsx · manual-entry-form.tsx · entries-history-table.tsx · reverse-entry-dialog.tsx
    settings/
      api.ts · hooks.ts · schemas.ts
      components/preferences-page.tsx · platform-settings-page.tsx · company-form.tsx · season-panel.tsx · season-editor-dialog.tsx · close-season-dialog.tsx
                 team-code-card.tsx · member-approval-card.tsx (toggle "Aprovar novos membros automaticamente" = `auto_approve_members`) · special-events-panel.tsx · special-event-editor-dialog.tsx · maintenance-card.tsx
    guide/
      components/guide-page.tsx · guide-steps.ts
    theme/
      theme-provider.tsx · theme-switch.tsx · use-theme.ts
  components/
    layout/
      app-shell.tsx · sidebar.tsx · sidebar-nav.ts (itens por papel) · topbar.tsx · season-chip.tsx · coins-chip.tsx · user-menu.tsx · bottom-nav.tsx
    shared/
      page-frame.tsx · premium-card.tsx · badge.tsx · progress.tsx · avatar.tsx · stat-card.tsx · section-header.tsx
      empty-state.tsx · error-state.tsx · query-boundary.tsx · skeletons.tsx
      confirm-dialog.tsx · countdown.tsx · money-input.tsx · form-field.tsx · data-table.tsx · status-pill.tsx · icon-tile.tsx
      achievements-mini-grid.tsx  # usa useAchievementBoard de features/profiles; consumido por Perfil (WP2)
    ui/                         # shadcn mantidos (§1.4)
  styles/
    tokens.css                  # :root/html[data-theme] + @theme inline
    base.css                    # @import tailwindcss; reset; body; scrollbar; focus ring; @custom-variant dark
    components.css              # .premium-card, .glass, .eyebrow, .primary-btn (compat), .podium-glow, animações
  test/
    setup.ts                    # jest-dom, matchMedia mock, supabase mock helper
    render.tsx                  # renderWithProviders()
```

### 2.2 Rotas → URL → componente → quem vê

| Arquivo de rota | URL | Componente de página | Papel | Search params (`validateSearch`) |
|---|---|---|---|---|
| `login.tsx` | `/login` | `LoginForm` | anônimo (logado → redirect `/`) | `redirect?: string` |
| `signup.tsx` | `/signup` | `SignupForm` → `SignupSuccess` após enviar | anônimo | — |
| `aguardando.tsx` | `/aguardando` | `AwaitingScreen` | sessão com perfil `pending` (aguardando aprovação do gestor) ou `inactive` (acesso desativado) — a mensagem vem de `bootstrap.me.status` | — |
| `_app/index.tsx` | `/` | `CollaboratorDashboard` ou `ManagerOverview` (por `me.role`) | todos | — |
| `_app/ranking.tsx` | `/ranking` | `RankingPage` | todos | — |
| `_app/missoes.tsx` | `/missoes` | `MissionsPage` | todos (botão "Nova missão" só admin) | `filtro: 'hoje'\|'semana'\|'especiais'` (default `hoje`), `novo?: boolean` (admin: abre o editor) |
| `_app/desafios.tsx` | `/desafios` | `ChallengesPage` (+ `ChallengesManager` se admin) | todos | `novo?: boolean` (admin: abre o editor), `gerenciar?: boolean` (admin: abre na aba de gestão — item "Desafios" da seção Administração) |
| `_app/roleta.tsx` | `/roleta` | `WheelPage` (+ `QueueQuickPanel`/`QueuePanel` se admin) | todos | — |
| `_app/recompensas.tsx` | `/recompensas` | `RewardsPage` | todos | `aba: 'loja'\|'pedidos'` (default `loja`) |
| `_app/conquistas.tsx` | `/conquistas` | `AchievementsPage` | todos | — |
| `_app/perfil.tsx` | `/perfil` | `ProfilePage` | todos | — |
| `_app/configuracoes.tsx` | `/configuracoes` | `PreferencesPage` | todos | — |
| `_app/_admin/admin/index.tsx` | `/admin` | `AdminDashboardPage` | admin | — |
| `_app/_admin/admin/equipe.tsx` | `/admin/equipe` | `TeamPage` | admin | `perfil?: uuid` (abre `CollaboratorDetailDialog`), `busca?: string`, `editar?: uuid` (abre `CollaboratorEditorDialog`), `convidar?: boolean` (abre `InviteDialog` "Como adicionar colaboradores" — lê o código por `useTeamCode()` de `features/team`, nunca de `features/settings`), `pendentes?: boolean` (rola/foca a seção "Pendentes"; é o destino do badge da sidebar e da notificação "Novo membro aguardando aprovação") |
| `_app/_admin/admin/pontuacao.tsx` | `/admin/pontuacao` | `PointsPage` | admin | `aba: 'regras'\|'lancar'\|'historico'` (default `lancar`), `perfil?: uuid` |
| `_app/_admin/admin/recompensas.tsx` | `/admin/recompensas` | `RewardsAdminPage` | admin | `aba: 'pedidos'\|'catalogo'`, `status?: redemption_status`, `novo?: boolean` (abre o editor de recompensa — WP5) |
| `_app/_admin/admin/roleta.tsx` | `/admin/roleta` | `PrizeEditor` (duas colunas) | admin | — |
| `_app/_admin/admin/configuracoes.tsx` | `/admin/configuracoes` | `PlatformSettingsPage` | admin | `aba: 'geral'\|'temporadas'\|'eventos'\|'codigo'` |
| `_app/_admin/admin/guia.tsx` | `/admin/guia` | `GuidePage` | admin | — |

`validateSearch` é escrito como função pura (sem adapter zod — ver pesquisa §3.6, item não verificado com zod 4):
```ts
export const Route = createFileRoute('/_app/missoes')({
  validateSearch: (s: Record<string, unknown>): { filtro: MissionFilter } => ({
    filtro: s['filtro'] === 'semana' || s['filtro'] === 'especiais' ? s['filtro'] : 'hoje',
  }),
  component: MissionsRoute,
})
```
Todo arquivo de rota é fino: valida search, lê `Route.useSearch()`/`useRouteContext()` e renderiza o componente de página da feature. Nada de lógica de dados em `routes/`.

### 2.3 Regras de dependência entre camadas (verificadas em review)

1. `routes/*` → importa só de `features/<x>/components/*-page.tsx`, `components/layout`, `lib`.
2. `features/<x>` → importa de `lib/*`, `components/shared|ui|layout`, `features/auth/hooks` (`useMe`, `useAuth`), `features/profiles` (read-model), `features/theme/use-theme`. **Nunca** de outra feature. Precisa de algo de outra feature? Navega por URL (`<Link to="/admin/equipe" search={{ perfil: id }}>`) ou pede ao WP0 para promover a `features/profiles`/`components/shared`. Já promovidos por esta regra: `useAchievementBoard` (Perfil + Conquistas) → `features/profiles`; `AchievementsMiniGrid` → `components/shared`; leitura do `team_code` pela Equipe → `getTeamCode()` em `features/team/api.ts` (mesma chave `qk.settings.secrets()` que `features/settings` invalida ao rotacionar); nome da regra nos "últimos créditos" → embed `rule:point_rules(name)` na própria query de `features/rewards`.
3. `components/shared` e `components/layout` → importam só de `lib`, `components/ui`, `features/auth/hooks` (layout precisa de `useMe`) e `features/notifications` (topbar; WP1 é dono de ambos), `features/theme`.
4. `lib/*` → não importa de `features` nem `components`.
5. `recharts` só é importado dentro de `features/admin-dashboard` (chunk separado pelo code splitting de rota).
6. Nenhum componente lê `localStorage` diretamente, exceto `features/theme` (chave `orbion-theme`) e o supabase-js (sessão).

---

## 3. Fluxo de autenticação e guardas

### 3.1 Estado de autenticação (`features/auth/auth-provider.tsx`)

```ts
export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'
export interface AuthState {
  status: AuthStatus
  session: Session | null
  userId: string | null
}
```
- `AuthProvider` chama `supabase.auth.getSession()` no mount e assina `supabase.auth.onAuthStateChange((event, session) => ...)`. **Nunca** `await` de chamadas supabase dentro do callback (deadlock documentado) — o callback só faz `setState`; efeitos colaterais rodam em `useEffect` sobre `status`/`userId`.
- Eventos: `INITIAL_SESSION`/`SIGNED_IN`/`TOKEN_REFRESHED`/`USER_UPDATED` → `signed_in`; `SIGNED_OUT` → `signed_out` + `queryClient.clear()` + `router.navigate({ to: '/login' })`.
- `useAuth()` lê o contexto; `useMe()` (abaixo) lê o bootstrap.

### 3.2 `main.tsx`, `router.tsx`, `__root.tsx`

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { queryClient } from '@/lib/query-client'
import type { AuthState } from '@/features/auth/auth-provider'

export interface RouterContext { queryClient: typeof queryClient; auth: AuthState }

export const router = createRouter({
  routeTree,
  context: { queryClient, auth: undefined! }, // auth é injetado pelo RouterProvider em main.tsx
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,          // React Query é o cache
  scrollRestoration: true,
  defaultPendingComponent: PageSkeleton,
  defaultPendingMs: 200,
  defaultErrorComponent: RouteErrorState,
})
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
```

```tsx
// src/main.tsx
import '@/styles/tokens.css'; import '@/styles/base.css'; import '@/styles/components.css'
function InnerApp() {
  const auth = useAuth()
  if (auth.status === 'loading') return <SplashScreen />        // não monta rotas sem saber a sessão
  return <RouterProvider router={router} context={{ auth }} />
}
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider><InnerApp /></AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```
`__root.tsx`: `createRootRouteWithContext<RouterContext>()({ component: () => <><Outlet /><Toaster /><Devtools/></>, notFoundComponent: NotFound, errorComponent: RootErrorState })`. Sem `HeadContent`/`Scripts`/`?url` (eram do Start). Se `!isSupabaseConfigured()` (env ausente), a raiz renderiza `ConfigMissingScreen` explicando quais variáveis faltam — evita tela branca no primeiro deploy.

### 3.3 `/login`, `/signup`, `/aguardando`

**`/login`** (`login.tsx`): `beforeLoad: ({ context, search }) => { if (context.auth.status === 'signed_in') throw redirect({ to: search.redirect ?? '/' }) }`. Form (RHF + zod): e-mail, senha, "Entrar". `useLogin()` → `auth.signInWithPassword` → sucesso: `await queryClient.invalidateQueries({ queryKey: qk.bootstrap() })`, `await router.invalidate()`, `navigate({ to: redirect ?? '/' })`. Erro `invalid_credentials` → "E-mail ou senha inválidos." Link "Criar conta" → `/signup`. Link "Esqueci a senha" → `auth.resetPasswordForEmail(email, { redirectTo: origin + '/login' })` (só funciona com SMTP próprio — mostrar aviso discreto "se o e-mail não chegar, peça ao gestor").

**`/signup`** (`signup.tsx`): no mount `useSignupMode()` (rpc `signup_mode`, executável por `anon`):
- `'first_admin'` → cabeçalho "Você será o gestor desta instalação"; campos: nome completo, e-mail, senha (mín. 8), confirmar senha. Sem código.
- `'team_code'` → campos acima + **Código da equipe** (12 caracteres, `A-Z0-9`, normalizado `toUpperCase().trim()`, máscara visual `XXXX-XXXX-XXXX` só na exibição).
- Submit (`useSignup()`): (1) se modo `team_code` → `rpc('validate_team_code', { p_code })`; `false` → erro no campo "Código da equipe inválido." e **não** chama `signUp`; se a RPC **lançar** (erro de rede/RPC, não `false`) → prossegue com o `signUp` mesmo assim — a validação que vale é a do trigger `handle_new_user` (DATA-MODEL §7.1/§4.32; a RPC não tem throttle nem código `TOO_MANY_ATTEMPTS`); (2) `auth.signUp({ email, password, options: { data: { full_name, team_code } } })` (metadata **sem** `team_code` no modo `first_admin`); (3) `data.user?.identities?.length === 0` → "Este e-mail já está cadastrado."; (4) `data.session === null` (*Confirm email* ligado — opcional em produção, DATA-MODEL §16.2) → `SignupSuccess` variante **e-mail**: "Confirme seu e-mail" + "Depois de confirmar, seu cadastro ainda passa pela aprovação de um gestor — você será avisado quando o acesso for liberado" + "Voltar ao login"; (5) com sessão (*Confirm email* desligado, inclusive o modo `first_admin`): `auth.updateUser({ data: { team_code: null } })` — **obrigatório**; se falhar, não bloqueia o fluxo, porque a limpeza é repetida em cada bootstrap enquanto a metadata existir (`getBootstrap()`, §3.4) — depois invalidar bootstrap, `router.invalidate()`, navegar `/`: o guard de `_app` lê o bootstrap e, se `me.status === 'pending'` (modo `team_code` com `auto_approve_members = false`, o default), redireciona para `/aguardando`; se `active` (primeiro admin, ou auto-aprovação ligada), entra no app. No modo `team_code` o formulário mostra, antes do botão, o aviso "Seu cadastro será analisado por um gestor antes de liberar o acesso." (texto fixo — o front não sabe se a auto-aprovação está ligada; `signup_mode` não expõe isso). Erro `Database error saving new user` no signUp → mostrar "Não foi possível concluir o cadastro. Verifique o código." (é o `INVALID_TEAM_CODE` do trigger chegando pelo GoTrue; acontece quando a pré-validação falhou por rede ou o código foi rotacionado entre a validação e o `signUp`).

**`/aguardando`** (`aguardando.tsx`, componente `AwaitingScreen`): `beforeLoad`: sem sessão → `/login`; com sessão, `ensureQueryData(bootstrapQueryOptions())` — se `me.status === 'active'` → redirect `/` (aprovado enquanto a aba estava aberta), se `PROFILE_NOT_FOUND`/erro de auth → `signOut()` + `/login`. Duas variantes por `me.status` (DATA-MODEL §7.1): **`pending`** → título "Seu cadastro está aguardando aprovação do gestor", texto "Olá, {full_name}. Um gestor precisa aprovar sua entrada na equipe. Você receberá o acesso assim que isso acontecer.", botão primário "Verificar novamente" (`invalidateQueries(qk.bootstrap())` + `router.invalidate()`; com `active` o guard leva para `/`) e botão secundário "Sair"; **`inactive`** → título "Seu acesso foi desativado", texto "Fale com o gestor da sua equipe.", botão "Sair". A tela **não** faz `signOut()` automático para o pendente (ele pode ficar esperando e clicar "Verificar novamente"); para o inativo o `signOut()` só acontece no clique em "Sair" ou em `handleGlobalError` (§3.4). Sem sidebar/topbar (usa `AuthLayout`). A rota `/inativo` não existe mais.

### 3.4 Guardas (`_app.tsx` e `_app/_admin.tsx`)

```tsx
// src/routes/_app.tsx
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    if (context.auth.status !== 'signed_in') {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    let bootstrap: BootstrapPayload
    try {
      bootstrap = await context.queryClient.ensureQueryData(bootstrapQueryOptions())
    } catch (error) {
      if (isCode(error, 'PROFILE_NOT_FOUND')) {          // usuário do Auth sem linha em profiles (DATA-MODEL §7.1)
        await supabase.auth.signOut()
        notify.error(error, 'Cadastro incompleto')      // "Cadastro incompleto — refaça o cadastro ou fale com o gestor"
        throw redirect({ to: '/login' })
      }
      if (isAuthError(error)) { await supabase.auth.signOut(); throw redirect({ to: '/login' }) }
      throw error // RouteErrorState mostra "Não foi possível carregar seus dados" + Tentar novamente
    }
    if (bootstrap.me.status !== 'active') throw redirect({ to: '/aguardando' })   // 'pending' (aguardando aprovação) ou 'inactive' (DATA-MODEL §7.1)
    return { bootstrap }   // disponível em context para filhos
  },
  component: () => <AppShell><Outlet /></AppShell>,
})

// src/routes/_app/_admin.tsx
export const Route = createFileRoute('/_app/_admin')({
  beforeLoad: ({ context }) => {
    if (context.bootstrap.me.role !== 'admin') throw redirect({ to: '/' })
  },
  component: Outlet,
})
```
- `bootstrapQueryOptions()` = `queryOptions({ queryKey: qk.bootstrap(), queryFn: getBootstrap, staleTime: 60_000, gcTime: 5 * 60_000 })`. Realtime em `notifications`/`feed_events` e toda mutation relevante invalidam `qk.bootstrap()`.
- `getBootstrap()` (`features/auth/bootstrap-query.ts`, WP0): `const data = await callRpc('get_bootstrap')`; em seguida, **retentativa da limpeza do código** (DATA-MODEL §6.4, §14.1 passo 6): `const { data: { user } } = await supabase.auth.getUser(); if (user?.user_metadata?.team_code) void supabase.auth.updateUser({ data: { team_code: null } }).catch(() => undefined)` — best-effort, sem `await` bloqueante e sem toast; repete em cada bootstrap até a metadata sumir. Retorna `data` sem esperar o `updateUser`.
- `PROFILE_NOT_FOUND` só acontece com usuário criado no Auth sem trigger (instalação incompleta) ou perfil apagado à mão; o guard faz `signOut()` e mostra "Cadastro incompleto" (o `RouteErrorState` genérico não serve, porque "Tentar novamente" repetiria o erro para sempre).
- `isAuthError(e)`: `RpcError.code in ('NOT_AUTHENTICATED','PROFILE_INACTIVE','PROFILE_PENDING')` ou PostgREST `code === '42501'` ou `'PGRST301'`. Componente global: `queryClient` `onError` (QueryCache) chama `handleGlobalError`: com `PROFILE_PENDING` (DATA-MODEL §6.2 `assert_active_member`) invalida o bootstrap e navega para `/aguardando` **sem** `signOut()`; com os demais faz `signOut()` quando o bootstrap já indicou perfil não ativo (DATA-MODEL §9). Na prática um pendente nunca dispara queries (o guard o mantém em `/aguardando`, e o banco não permite `active → pending`), então `PROFILE_PENDING` só chega ao front se uma aba antiga chamar uma RPC com bootstrap em cache — o tratamento existe para essa aba cair em `/aguardando` em vez de numa tela quebrada.
- UI nunca "esconde" segurança: o banco nega tudo para inativos e não-admins; as guardas só evitam telas quebradas.

### 3.5 Logout, persistência, expiração

- `useLogout()` → `supabase.auth.signOut()` (escopo global). O `SIGNED_OUT` limpa o cache e navega.
- Persistência: padrão do supabase-js (`persistSession: true` em `localStorage`, `autoRefreshToken: true`, `detectSessionInUrl: true` para links de e-mail, `flowType: 'pkce'`). Fechar e reabrir o navegador mantém a sessão.
- Inativação em tempo real: o gestor inativa → próxima query falha com `42501`/`PROFILE_INACTIVE` → `handleGlobalError` → `signOut()` → `/login` com toast "Seu acesso foi desativado."
- Aprovação em tempo real: o pendente em `/aguardando` não tem canal Realtime (as policies negam tudo); ele clica "Verificar novamente" (ou recarrega) e o bootstrap passa a devolver o payload completo → `/`. A notificação "Cadastro aprovado" (DATA-MODEL §7.2) já o espera no sino.
- Troca de papel (colaborador → admin): o bootstrap é reconsultado a cada 60 s ou ao receber notificação; a sidebar reage a `me.role`.

### 3.6 Navegação por papel (`components/layout/sidebar-nav.ts`)

```ts
export const MAIN_NAV = [
  { to: '/',            label: 'Visão Geral', icon: Home },
  { to: '/ranking',     label: 'Ranking',     icon: Trophy },
  { to: '/missoes',     label: 'Missões',     icon: Target },
  { to: '/desafios',    label: 'Desafios',    icon: Swords },
  { to: '/roleta',      label: 'Roleta',      icon: Sparkles },
  { to: '/recompensas', label: 'Recompensas', icon: Gift },
  { to: '/conquistas',  label: 'Conquistas',  icon: Medal },
  { to: '/perfil',      label: 'Perfil',      icon: User },
] as const
export const ADMIN_NAV = [
  { to: '/admin',               label: 'Dashboard',     icon: BarChart3 },
  { to: '/admin/equipe',        label: 'Equipe',        icon: Users, badge: 'pending_members' },   // badge = bootstrap.pending_members (> 0); clique leva a ?pendentes=true
  { to: '/admin/pontuacao',     label: 'Pontuação',     icon: Bolt },
  { to: '/desafios',            label: 'Desafios',      icon: Swords, search: { gerenciar: true } }, // FEATURE §1: 6 itens + Roleta + Guia = 8; abre ChallengesManager
  { to: '/admin/recompensas',   label: 'Recompensas',   icon: Gift },
  { to: '/admin/roleta',        label: 'Roleta',        icon: Dices },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/admin/guia',          label: 'Guia de uso',   icon: BookOpen },
] as const
export const BOTTOM_NAV = ['/', '/ranking', '/missoes', '/roleta', '/perfil'] // rótulo "Início" para "/"
export const FOOTER_NAV = [{ to: '/configuracoes', label: 'Configurações', icon: Settings }] // + botão Sair
```
- Sidebar 250 px fixa em `lg+`; `Sheet` (drawer) abaixo disso. Seção "Administração" só com `me.role === 'admin'` (8 itens, como o original: Dashboard, Equipe, Pontuação, Desafios, Recompensas, Roleta, Configurações, Guia de uso). Item com `badge: 'pending_members'` renderiza uma pílula (`Badge` tone `warning`, `aria-label="{n} cadastros aguardando aprovação"`) com `bootstrap.pending_members` quando `> 0`, e o `Link` recebe `search: { pendentes: true }`; o valor vem do bootstrap (`get_bootstrap().pending_members`, só admin — DATA-MODEL §7.1) e atualiza quando o bootstrap é invalidado (notificação `system` "Novo membro aguardando aprovação" chega pelo Realtime de `notifications` e invalida `qk.bootstrap()`, §4.5 `useNotificationsRealtime`; aprovar/recusar invalida também). "Desafios" da administração aponta para a mesma rota `/desafios` com `search: { gerenciar: true }` (`validateSearch` de `desafios.tsx` aceita `gerenciar?: boolean`; `ChallengesManager` abre na aba de gestão); o item ativo na sidebar usa `activeOptions={{ includeSearch: true }}` para que "Desafios" da nav principal e o da administração não acendam juntos.
- Topbar: botão menu (mobile) · `SeasonChip` ("Temporada {season.name}" ou "Sem temporada ativa" em vermelho para admin) · `CoinsChip` (`me.coins_balance`) · `NotificationBell` (badge `unread_notifications`, dropdown com 8 últimas, "marcar todas como lidas") · `ThemeSwitch` · `UserMenu` (avatar + nome + "{cargo} · Nível {n}"; para admin: "Gestor · Visão da operação"; itens: Perfil, Configurações, Sair).
- Bottom nav mobile: 5 atalhos, `Link` com `activeOptions={{ exact: true }}` para `/`.

---

## 4. Contratos compartilhados (todo agente de feature codifica contra isto)

### 4.1 `src/lib/supabase.ts` — client singleton

```ts
import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Database, RpcName, RpcArgs, RpcResult } from './database.types'
import { RpcError } from './rpc-errors'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const isSupabaseConfigured = (): boolean => Boolean(url && key)

export const supabase = createClient<Database>(url ?? '', key ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  realtime: { params: { eventsPerSecond: 5 } },
})

/** Chama uma RPC e converte { data, error } em valor | throw RpcError. */
export async function callRpc<N extends RpcName>(name: N, args?: RpcArgs<N>): Promise<RpcResult<N>> {
  const { data, error } = await supabase.rpc(name, args as never)
  if (error) throw RpcError.fromPostgrest(error)
  return data as RpcResult<N>
}

/** Idem para builders do PostgREST: unwrap(supabase.from('rewards').select()) */
export async function unwrap<T>(q: PromiseLike<{ data: T | null; error: PostgrestError | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw RpcError.fromPostgrest(error)
  return data as T
}

const AVATAR_BUCKET = 'avatars'
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}
export function avatarObjectPath(profileId: string, file: File): string {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return `${profileId}/avatar-${Date.now()}.${ext}`
}
export const AVATAR_MAX_BYTES = 1_572_864
export const AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
```
Regras: o front **nunca** envia `points`, `coins`, `season_id`, `created_by`, prêmio sorteado; nunca chama `from('point_entries').insert` (usa RPC); nunca usa `service_role`/`sb_secret_`.

### 4.2 `src/lib/database.types.ts` — tipos escritos à mão a partir de `DATA-MODEL.md`

Formato compatível com o gerador oficial (para trocar por `supabase gen types` no futuro sem mexer no app). Regras de escrita:
- `Row` = colunas exatamente como em DATA-MODEL §4 (nullabilidade respeitada: `NN` → não-null, `—` → `| null`). `Insert`/`Update` só para tabelas que o **front escreve diretamente** por policy de `authenticated` (`profiles` update, `point_rules`, `rewards`, `achievements`, `special_events` update (soft delete), `wheels` update, `app_settings` update, `season_goals`, `notifications` update); as demais recebem `Insert: never; Update: never` — inclusive `missions`, `challenges`, `wheel_prizes`, `mission_participants` e `challenge_participants`, que só mudam por RPC (`save_mission`/`save_challenge`/`save_wheel_prizes`), e `special_events.Insert`, que é `never` porque a criação/edição passa por `save_special_event` (DATA-MODEL §7.2, D.47).
- `Views`: todas as 16 views de §5 com `Row` (agregados são `number`, não-null, porque as views usam `coalesce`).
- `Functions`: todas as RPCs de §7 com `Args` e `Returns`. RPCs que retornam `jsonb` usam `Returns: Json` no `Database` e recebem tipo forte no mapa `RpcPayloads`.
- `Enums`: os 22 enums de §3, literalmente.

```ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      app_settings: { Row: AppSettingsRow; Insert: never; Update: Partial<Pick<AppSettingsRow, 'company_name' | 'xp_per_level' | 'currency' | 'timezone' | 'target_conversion_pct' | 'target_attendance_pct' | 'target_crm_pct' | 'target_activities_count' | 'rank_admins' | 'auto_approve_members'>> }   // AppSettingsRow inclui auto_approve_members: boolean (DATA-MODEL §4.1)
      app_secrets: { Row: AppSecretsRow; Insert: never; Update: never }        // só leitura via UI; rotação por RPC
      seasons: { Row: SeasonRow; Insert: never; Update: never }
      season_goals: { Row: SeasonGoalRow; Insert: SeasonGoalInsert; Update: Partial<SeasonGoalInsert> }
      season_results: { Row: SeasonResultRow; Insert: never; Update: never }
      profiles: { Row: ProfileRow; Insert: never; Update: Partial<Pick<ProfileRow, 'full_name' | 'avatar_path' | 'color' | 'preferences'>> }
      profile_private: { Row: ProfilePrivateRow; Insert: never; Update: never } // admin edita via admin_update_profile
      profile_season_stats: { Row: ProfileSeasonStatsRow; Insert: never; Update: never }
      profile_lifetime_stats: { Row: ProfileLifetimeStatsRow; Insert: never; Update: never }
      point_rules: { Row: PointRuleRow; Insert: PointRuleInsert; Update: Partial<PointRuleInsert> & { deleted_at?: string | null } }
      point_entries: { Row: PointEntryRow; Insert: never; Update: never }
      milestone_awards: { Row: MilestoneAwardRow; Insert: never; Update: never }
      special_events: { Row: SpecialEventRow; Insert: never; Update: Pick<SpecialEventRow, 'is_active'> & { deleted_at?: string | null } } // criar/editar via save_special_event; Update só para o soft delete
      profile_boosts: { Row: ProfileBoostRow; Insert: never; Update: never }
      missions: { Row: MissionRow; Insert: never; Update: never }              // via save_mission/delete_mission
      mission_participants: { Row: MissionParticipantRow; Insert: never; Update: never }
      mission_progress: { Row: MissionProgressRow; Insert: never; Update: never }
      challenges: { Row: ChallengeRow; Insert: never; Update: never }          // via save_challenge/*_challenge
      challenge_participants: { Row: ChallengeParticipantRow; Insert: never; Update: never }
      challenge_results: { Row: ChallengeResultRow; Insert: never; Update: never }
      wheels: { Row: WheelRow; Insert: never; Update: Partial<Pick<WheelRow, 'name' | 'is_active'>> }
      wheel_prizes: { Row: WheelPrizeRow; Insert: never; Update: never }      // via save_wheel_prizes
      wheel_queue: { Row: WheelQueueRow; Insert: never; Update: never }
      wheel_spins: { Row: WheelSpinRow; Insert: never; Update: never }
      rewards: { Row: RewardRow; Insert: RewardInsert; Update: Partial<RewardInsert> & { deleted_at?: string | null } }
      reward_redemptions: { Row: RewardRedemptionRow; Insert: never; Update: never }
      achievements: { Row: AchievementRow; Insert: AchievementInsert; Update: Partial<AchievementInsert> }
      profile_achievements: { Row: ProfileAchievementRow; Insert: never; Update: never }
      feed_events: { Row: FeedEventRow; Insert: never; Update: never }
      notifications: { Row: NotificationRow; Insert: never; Update: Pick<NotificationRow, 'is_read'> }
      audit_log: { Row: AuditLogRow; Insert: never; Update: never }
    }
    Views: {
      v_profile_stats: { Row: VProfileStats }; v_ranking: { Row: VRanking }; v_team_stats: { Row: VTeamStats }
      v_admin_kpis: { Row: VAdminKpis }; v_sales_timeline: { Row: VSalesTimeline }; v_mission_board: { Row: VMissionBoard }
      v_challenge_board: { Row: VChallengeBoard }; v_achievement_board: { Row: VAchievementBoard }; v_wheel_queue: { Row: VWheelQueue }
      v_wheel_history: { Row: VWheelHistory }; v_redemptions: { Row: VRedemption }; v_wallet: { Row: VWallet }
      v_point_entries_history: { Row: VPointEntryHistory }; v_activity_feed: { Row: VActivityFeed }; v_seasons: { Row: VSeason }
      v_special_events: { Row: VSpecialEvent }
    }
    Functions: {
      signup_mode: { Args: Record<string, never>; Returns: 'first_admin' | 'team_code' }
      validate_team_code: { Args: { p_code: string }; Returns: boolean }
      get_bootstrap: { Args: Record<string, never>; Returns: Json }
      get_dashboard: { Args: { p_profile_id?: string | null; p_season_id?: string | null }; Returns: Json }
      admin_update_profile: { Args: { p_profile_id: string; p_patch: AdminProfilePatch }; Returns: Json }
      rotate_team_code: { Args: Record<string, never>; Returns: string }
      update_app_settings: { Args: { p_patch: AppSettingsPatch }; Returns: AppSettingsRow }
      save_special_event: { Args: { p: SaveSpecialEventInput }; Returns: SpecialEventRow }
      recompute_stats: { Args: { p_profile_id?: string | null }; Returns: Json }
      create_season: { Args: { p_name: string; p_starts_on: string; p_ends_on: string; p_team_goal_amount?: number; p_activate?: boolean }; Returns: SeasonRow }
      update_season: { Args: { p_season_id: string; p_patch: SeasonPatch }; Returns: SeasonRow }
      activate_season: { Args: { p_season_id: string }; Returns: SeasonRow }
      close_season: { Args: { p_season_id: string }; Returns: Json }
      record_rule_entry: { Args: { p_profile_id: string; p_rule_id: string; p_quantity?: number; p_amount?: number | null; p_occurred_at?: string; p_reason?: string | null }; Returns: PointEntryRow }
      record_manual_entry: { Args: { p_profile_id: string; p_points: number; p_reason: string; p_coins?: number | null }; Returns: PointEntryRow }
      record_initial_points: { Args: { p_profile_id: string; p_points: number }; Returns: PointEntryRow }
      reverse_entry: { Args: { p_entry_id: string; p_reason: string }; Returns: PointEntryRow }
      save_mission: { Args: { p: SaveMissionInput }; Returns: MissionRow }
      delete_mission: { Args: { p_mission_id: string }; Returns: undefined }
      save_challenge: { Args: { p: SaveChallengeInput }; Returns: ChallengeRow }
      activate_challenge: { Args: { p_challenge_id: string }; Returns: ChallengeRow }
      finish_challenge: { Args: { p_challenge_id: string }; Returns: Json }
      cancel_challenge: { Args: { p_challenge_id: string }; Returns: ChallengeRow }
      enqueue_wheel: { Args: { p_profile_id?: string | null; p_person_name?: string | null; p_wheel_kind?: WheelKind; p_attempts?: number }; Returns: WheelQueueRow }
      update_queue_entry: { Args: { p_queue_id: string; p_wheel_kind?: WheelKind | null; p_attempts?: number | null }; Returns: WheelQueueRow }
      remove_from_queue: { Args: { p_queue_id: string }; Returns: WheelQueueRow }
      release_turn: { Args: { p_queue_id: string }; Returns: WheelQueueRow }
      spin_wheel: { Args: { p_queue_id: string }; Returns: Json }
      spin_wheel_free: { Args: { p_wheel_kind: WheelKind }; Returns: Json }
      approve_spin: { Args: { p_spin_id: string }; Returns: Json }
      reject_spin: { Args: { p_spin_id: string }; Returns: Json }
      save_wheel_prizes: { Args: { p_wheel_kind: WheelKind; p_prizes: SavePrizeInput[] }; Returns: WheelPrizeRow[] }
      redeem_reward: { Args: { p_reward_id: string }; Returns: Json }
      handle_redemption: { Args: { p_redemption_id: string; p_action: 'approve' | 'deliver' | 'cancel'; p_notes?: string | null }; Returns: RewardRedemptionRow }
      mark_notifications_read: { Args: { p_ids?: string[] | null }; Returns: number }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_active_member: { Args: Record<string, never>; Returns: boolean }
      active_season_id: { Args: Record<string, never>; Returns: string | null }
      app_timezone: { Args: Record<string, never>; Returns: string }
    }
    Enums: {
      user_role: 'admin' | 'collaborator'
      profile_status: 'active' | 'inactive' | 'pending'   // pending = aguardando aprovação do gestor (DATA-MODEL §3)
      job_title: 'sdr' | 'closer' | 'social_seller' | 'supervisor' | 'manager'
      metric_type: 'sale' | 'meeting_scheduled' | 'meeting_held' | 'call' | 'crm_update' | 'lead_recovery' | 'upsell' | 'amount_step' | 'weekly_goal' | 'monthly_goal' | 'activity' | 'custom'
      rule_trigger_kind: 'manual' | 'auto_amount_step' | 'auto_goal'
      entry_source: 'rule' | 'manual' | 'system' | 'mission' | 'challenge' | 'wheel' | 'reward' | 'achievement'
      mission_kind: 'daily' | 'weekly' | 'special' | 'lightning'
      mission_target_kind: 'count' | 'amount'
      mission_audience: 'all' | 'selected'
      challenge_kind: 'duel' | 'team'
      challenge_metric: 'meetings_held' | 'sales_count' | 'revenue' | 'points' | 'activities'
      challenge_status: 'draft' | 'active' | 'finished' | 'cancelled'
      wheel_kind: 'classic' | 'premium'
      prize_kind: 'points' | 'coins' | 'cash' | 'voucher' | 'extra_spin' | 'multiplier' | 'mystery' | 'custom'
      queue_status: 'waiting' | 'active' | 'done' | 'removed'
      queue_source: 'manual' | 'earned'
      spin_status: 'pending' | 'approved' | 'rejected'
      redemption_source: 'store' | 'wheel'
      redemption_status: 'requested' | 'approved' | 'delivered' | 'cancelled'
      achievement_criteria: 'first_sale' | 'streak_days' | 'sales_total' | 'monthly_goal' | 'rank_first' | 'points_total' | 'missions_completed'
      achievement_scope: 'lifetime' | 'season'
      feed_kind: 'sale' | 'achievement' | 'wheel_prize' | 'level_up' | 'mission_completed' | 'challenge_finished' | 'season_closed'
      notification_kind: 'ranking' | 'mission' | 'reward' | 'wheel' | 'challenge' | 'achievement' | 'level' | 'event' | 'season' | 'system'
      audit_action: 'insert' | 'update' | 'delete' | 'rpc'
    }
    CompositeTypes: Record<string, never>
  }
}

// Helpers (mesmos nomes do gerador oficial + extras)
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Views<V extends keyof Database['public']['Views']> = Database['public']['Views'][V]['Row']
export type Enums<E extends keyof Database['public']['Enums']> = Database['public']['Enums'][E]
export type RpcName = keyof Database['public']['Functions']
export type RpcArgs<N extends RpcName> = Database['public']['Functions'][N]['Args']
export type RpcResult<N extends RpcName> = N extends keyof RpcPayloads ? RpcPayloads[N] : Database['public']['Functions'][N]['Returns']
export type WheelKind = Enums<'wheel_kind'>; export type JobTitle = Enums<'job_title'>; export type MetricType = Enums<'metric_type'> // etc. para todos os enums
```

Payloads `jsonb` (tipos fortes; shapes de DATA-MODEL §7):

```ts
export interface BootstrapMe {
  id: string; full_name: string; avatar_path: string | null; color: string; job_title: JobTitle; team: string | null
  role: Enums<'user_role'>; status: Enums<'profile_status'>; preferences: { notifications: boolean; event_alerts: boolean }
  email: string | null; phone: string | null; goal_amount: number
  points: number; points_earned: number; level: number; xp_in_level: number; xp_to_next: number; xp_per_level: number
  rank: number | null; gap_to_above: number | null; streak_days: number; coins_balance: number
  sales_amount: number; sales_count: number; meetings_held: number; conversion_pct: number | null
  missions_completed: number; achievements_unlocked: number; pending_earned_spins: number
}
export interface BootstrapSeason { id: string; name: string; starts_at: string; ends_at: string; team_goal_amount: number; xp_per_level: number; is_active: boolean; days_left: number }
export interface BootstrapSettings { company_name: string; xp_per_level: number; currency: string; timezone: string; target_conversion_pct: number; target_attendance_pct: number; target_crm_pct: number; target_activities_count: number; rank_admins: boolean }
export interface BootstrapWheel { active_queue_id: string | null; active_person_name: string | null; pending_spin_id: string | null; my_turn: boolean }
export interface ActiveEvent { id: string; name: string; multiplier: number; starts_at: string; ends_at: string; state: 'upcoming' | 'live' }
export type BootstrapMeBlocked = Pick<BootstrapMe, 'id' | 'full_name'> & { status: 'inactive' | 'pending' }   // DATA-MODEL §7.1 passo 2
export interface BootstrapPayload {
  me: BootstrapMe | BootstrapMeBlocked
  season: BootstrapSeason | null; settings: BootstrapSettings; unread_notifications: number
  pending_members: number            // cadastros aguardando aprovação; só admin recebe > 0 (DATA-MODEL §7.1) — badge da sidebar
  wheel: BootstrapWheel; active_event: ActiveEvent | null
}
export const isBlockedMe = (me: BootstrapPayload['me']): me is BootstrapMeBlocked => me.status !== 'active'
export interface PendingMember { id: string; full_name: string; avatar_path: string | null; color: string; created_at: string; profile_private: { email: string } | null }   // profiles + embed profile_private (admin), DATA-MODEL §10
// get_dashboard devolve APENAS { season: null } quando não há temporada (DATA-MODEL §7.1) — união discriminada por `season`
export interface DashboardData {
  season: BootstrapSeason; stats: VProfileStats | null; ranking_top: VRanking[]; missions_today: VMissionBoard[]
  next_reward: { id: string; name: string; icon: string | null; cost_coins: number; missing_coins: number } | null
  pending_earned_spins: number; active_event: ActiveEvent | null; feed: VActivityFeed[]
}
export type DashboardPayload = { season: null } | DashboardData
export const hasDashboard = (d: DashboardPayload): d is DashboardData => d.season !== null
export interface SpinPrize { id: string; label: string; kind: Enums<'prize_kind'>; value: number | null; sort_order?: number }
export interface SpinResultPayload {
  spin_id: string | null; queue_id: string | null; wheel_kind: WheelKind; person_name: string | null; profile_id: string | null; avatar_path: string | null
  attempt_index: number | null; attempts_allowed: number | null; prize: SpinPrize; resolved_prize: SpinPrize
  sector_index: number; sector_count: number; prizes_hash: string; is_free?: true
}
export interface ApproveSpinPayload { spin: { id: string; status: Enums<'spin_status'>; credited: boolean; entry_id: string | null; redemption_id: string | null; boost_id: string | null }; queue: { id: string; status: Enums<'queue_status'>; attempts_used: number; attempts_allowed: number } }
export interface RedeemPayload { redemption_id: string; coins_balance: number }
export interface FinishChallengePayload { challenge_id: string; winner_ids: string[]; results: { profile_id: string; final_value: number; is_winner: boolean; entry_id: string | null }[] }
export interface CloseSeasonPayload {
  season_id: string; champion_profile_id: string | null
  results: { profile_id: string; final_rank: number | null; final_points: number; sales_amount: number; goal_reached: boolean }[]
  warnings: string[]                 // 'gap_until_next_season' quando há temporada futura sem cobertura até ela (DATA-MODEL §7.3 passo 9)
  next_season_id?: string; next_starts_at?: string
}
export interface AdminUpdateProfilePayload { profile: VProfileStats; warnings: string[] }
export interface RecomputeStatsPayload { profiles: number; seasons: number }
export interface RpcPayloads {
  get_bootstrap: BootstrapPayload; get_dashboard: DashboardPayload; spin_wheel: SpinResultPayload; spin_wheel_free: SpinResultPayload
  approve_spin: ApproveSpinPayload; reject_spin: ApproveSpinPayload; redeem_reward: RedeemPayload; finish_challenge: FinishChallengePayload
  close_season: CloseSeasonPayload; admin_update_profile: AdminUpdateProfilePayload; recompute_stats: RecomputeStatsPayload
}
// Inputs jsonb de RPCs
export interface AdminProfilePatch { full_name?: string; avatar_path?: string | null; color?: string; job_title?: JobTitle; team?: string | null; role?: Enums<'user_role'>; status?: 'active' | 'inactive' /* nunca 'pending' — PROFILE_STATUS_INVALID (DATA-MODEL §7.2); 'active' sobre pendente = aprovar, 'inactive' = recusar */; email?: string; phone?: string | null; default_goal_amount?: number; notes?: string | null; goal_amount?: number } // sem base_points: pontos iniciais = record_initial_points (DATA-MODEL §7.4, D.32)
export interface AppSettingsPatch { company_name?: string; xp_per_level?: number; currency?: string; timezone?: string; target_conversion_pct?: number; target_attendance_pct?: number; target_crm_pct?: number; target_activities_count?: number; rank_admins?: boolean; auto_approve_members?: boolean }
export interface SaveSpecialEventInput { id?: string; name: string; description?: string | null; multiplier: number; starts_at: string; ends_at: string; is_active?: boolean }
export interface SeasonPatch { name?: string; team_goal_amount?: number; starts_on?: string; ends_on?: string }
export interface SaveMissionInput { id?: string; title: string; description?: string | null; icon?: string | null; kind: Enums<'mission_kind'>; metric: MetricType; target_kind?: Enums<'mission_target_kind'>; target_value: number; reward_points?: number; reward_coins?: number; reward_spin?: WheelKind | null; starts_at: string; ends_at: string; audience?: Enums<'mission_audience'>; participant_ids?: string[]; is_active?: boolean }
export interface SaveChallengeInput { id?: string; name: string; description?: string | null; kind: Enums<'challenge_kind'>; metric: Enums<'challenge_metric'>; target_value: number; reward_points?: number; reward_coins?: number; reward_spin?: WheelKind | null; reward_description?: string | null; starts_at: string; ends_at: string; participant_ids: string[] }
export interface SavePrizeInput { id?: string; label: string; kind: Enums<'prize_kind'>; value?: number | null; weight?: number; color?: string | null; sort_order: number; is_active?: boolean }
```
Checklist de aceite do arquivo (WP0): 31 tabelas, 16 views, 39 funções (35 RPCs de DATA-MODEL §7 — inclusive `record_initial_points` e `save_special_event` — + `is_admin`, `is_active_member`, `active_season_id`, `app_timezone`), 22 enums (`profile_status` com 3 valores); `expectTypeOf<BootstrapPayload['me']>()` aceita `{ status: 'pending' }` e `isBlockedMe` estreita; `tsc` passa com `supabase.from('v_ranking').select('*').eq('season_id', id).order('rank')` retornando `VRanking[]`; `callRpc('spin_wheel', { p_queue_id })` retorna `SpinResultPayload`. Testes em `database.types.test.ts` com `expectTypeOf`.

### 4.3 `src/lib/rpc-errors.ts`

```ts
export class RpcError extends Error {
  constructor(public code: string, message: string, public detail: string | null, public sqlstate: string | null) { super(message) }
  static fromPostgrest(e: { message: string; details?: string | null; code?: string | null; hint?: string | null }): RpcError {
    const isCatalogCode = /^[A-Z][A-Z0-9_]{2,}$/.test(e.message)   // DATA-MODEL §2.6: message = CODE
    return new RpcError(isCatalogCode ? e.message : (e.code ?? 'UNKNOWN'), e.message, e.details ?? null, e.code ?? null)
  }
}
export const RPC_MESSAGES: Record<string, string> = { /* os 85 códigos de DATA-MODEL §9 (inclui PROFILE_PENDING e PROFILE_STATUS_INVALID), texto pt-BR idêntico ao `detail` (não existe TOO_MANY_ATTEMPTS: o throttle foi removido, D.4) */ }
export function getErrorMessage(error: unknown): string {
  if (error instanceof RpcError) return RPC_MESSAGES[error.code] ?? error.detail ?? 'Não foi possível concluir a ação.'
  if (error instanceof Error) return error.message || 'Erro inesperado.'
  return 'Erro inesperado.'
}
export function isAuthError(error: unknown): boolean {
  return error instanceof RpcError && (['NOT_AUTHENTICATED', 'PROFILE_INACTIVE', 'PROFILE_PENDING'].includes(error.code) || error.sqlstate === '42501' || error.sqlstate === 'PGRST301')
}
export function isPendingError(error: unknown): boolean { return isCode(error, 'PROFILE_PENDING') }   // handleGlobalError: navega para /aguardando sem signOut (§3.4)
export function isCode(error: unknown, code: string): boolean { return error instanceof RpcError && error.code === code }
```
`INSUFFICIENT_COINS`, `INVALID_PATCH_KEY`, `ATTEMPTS_INVALID` e `SEASON_NOT_STARTED` têm `{n}`/`{key}`/`{DD/MM}` no texto: a mensagem final usa `error.detail` do servidor (que já vem interpolado) quando disponível. Códigos **sintéticos** do front (não vêm do banco, mas entram em `RPC_MESSAGES`): `LEDGER_CONSTRAINT` (`23514`/`23P01` crus de escrita direta por policy — DATA-MODEL §9), `DUPLICATE` (`23505`) e `AVATAR_QUOTA` (403 do Storage no upload de avatar: "Limpe fotos antigas e tente de novo").

### 4.4 `src/lib/query-keys.ts` — fábrica de chaves e matriz de invalidação

```ts
export const qk = {
  bootstrap: () => ['bootstrap'] as const,
  signupMode: () => ['signup-mode'] as const,
  dashboard: { all: () => ['dashboard'] as const, one: (profileId: string | null, seasonId: string | null) => ['dashboard', 'one', profileId, seasonId] as const },
  feed: () => ['feed'] as const,
  notifications: { all: () => ['notifications'] as const, list: () => ['notifications', 'list'] as const },
  profiles: {
    all: () => ['profiles'] as const,
    active: () => ['profiles', 'active'] as const,
    pending: () => ['profiles', 'pending'] as const,   // admin: cadastros aguardando aprovação (Equipe › Pendentes)
    stats: (seasonId: string | null) => ['profiles', 'stats', seasonId] as const,
    one: (profileId: string, seasonId: string | null) => ['profiles', 'one', profileId, seasonId] as const,
    private: (profileId: string) => ['profiles', 'private', profileId] as const,
    ranking: (seasonId: string | null) => ['profiles', 'ranking', seasonId] as const,
  },
  missions: { all: () => ['missions'] as const, board: (profileId: string, filter: string) => ['missions', 'board', profileId, filter] as const, admin: (seasonId: string | null) => ['missions', 'admin', seasonId] as const },
  challenges: { all: () => ['challenges'] as const, board: (seasonId: string | null) => ['challenges', 'board', seasonId] as const },
  wheel: { all: () => ['wheel'] as const, config: () => ['wheel', 'config'] as const, queue: () => ['wheel', 'queue'] as const, history: () => ['wheel', 'history'] as const },
  rewards: { all: () => ['rewards'] as const, catalog: (scope: 'store' | 'admin') => ['rewards', 'catalog', scope] as const, wallet: (profileId: string) => ['rewards', 'wallet', profileId] as const, credits: (profileId: string) => ['rewards', 'credits', profileId] as const, redemptions: (scope: 'mine' | 'admin', status: string | null) => ['rewards', 'redemptions', scope, status] as const },
  achievements: { all: () => ['achievements'] as const, one: (profileId: string) => ['achievements', 'one', profileId] as const },
  ledger: { all: () => ['ledger'] as const, rules: () => ['ledger', 'rules'] as const, history: (p: { profileId: string | null; page: number; pageSize: number }) => ['ledger', 'history', p] as const, initialPoints: (profileId: string, seasonId: string | null) => ['ledger', 'initial-points', profileId, seasonId] as const },
  admin: { all: () => ['admin'] as const, teamStats: (seasonId: string | null) => ['admin', 'team-stats', seasonId] as const, kpis: (seasonId: string | null) => ['admin', 'kpis', seasonId] as const, timeline: (seasonId: string | null) => ['admin', 'timeline', seasonId] as const },
  settings: { app: () => ['settings', 'app'] as const, secrets: () => ['settings', 'secrets'] as const, seasons: () => ['settings', 'seasons'] as const, events: () => ['settings', 'events'] as const },
}

/** Após qualquer mutation que toca o ledger (lançar, estornar, aprovar giro, resgatar, finalizar desafio, fechar temporada). */
export async function invalidateAfterLedgerChange(qc: QueryClient): Promise<void> {
  const keys: readonly (readonly unknown[])[] = [
    qk.bootstrap(), qk.feed(), qk.dashboard.all(), qk.profiles.all(), qk.missions.all(), qk.challenges.all(),
    qk.achievements.all(), qk.ledger.all(), qk.admin.all(), qk.rewards.all(), qk.wheel.all(),
  ]
  await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })))
}
```
Defaults do `QueryClient` (`lib/query-client.ts`): `staleTime: 30_000`, `gcTime: 5 min`, `retry: (n, e) => !isAuthError(e) && !(e instanceof RpcError) && n < 2` (erro de regra de negócio não repete), `refetchOnWindowFocus: true`, `QueryCache.onError → handleGlobalError`, `MutationCache.onError → notify.error(e)` (a menos que a mutation passe `meta: { silent: true }`).

### 4.5 Hooks por feature (assinaturas obrigatórias)

Convenção: `api.ts` exporta funções puras async (`getX`, `saveX`) que usam `supabase`/`callRpc`/`unwrap`; `hooks.ts` envolve em `useQuery`/`useMutation` com as chaves de `qk`. Todo `useQuery` de view aplica `.order()` explícito (PostgREST não garante ordem). Mutations retornam o `UseMutationResult` padrão; `onSuccess` invalida conforme a coluna "Invalida".

**features/auth** (WP1, exceto `useAuth` em `auth-provider.tsx` e `useBootstrap`/`useMe` em `bootstrap-query.ts`, que são do WP0)

| Hook | Params | Retorna | Fonte | Invalida |
|---|---|---|---|---|
| `useAuth()` | — | `AuthState` | contexto | — |
| `useBootstrap()` | — | `UseQueryResult<BootstrapPayload>` | rpc `get_bootstrap` | — |
| `useMe()` | — | `{ me: BootstrapMe; season: BootstrapSeason \| null; settings; wheel; activeEvent; unread: number; pendingMembers: number; isAdmin: boolean; seasonId: string \| null }` (assume bootstrap já carregado pelo guard; lança se ausente **ou se `isBlockedMe(me)`** — dentro de `_app` o guard garante `status = 'active'`; `/aguardando` usa `useBootstrap()` direto) | cache do bootstrap | — |
| `useSignupMode()` | — | `'first_admin' \| 'team_code'` | rpc `signup_mode` | — |
| `useLogin()` | `{ email, password }` | mutation | `auth.signInWithPassword` | bootstrap |
| `useSignup()` | `{ fullName, email, password, teamCode? }` | mutation → `{ needsEmailConfirmation: boolean; awaitsApproval: boolean }` (`awaitsApproval = modo team_code` — texto fixo; com sessão o guard decide pelo `me.status` real) | `validate_team_code` (`false` → aborta com erro de campo; **throw** de rede/RPC → ignora e segue) + `auth.signUp` + `auth.updateUser({ data: { team_code: null } })` (obrigatório; falha não bloqueia — `getBootstrap` repete) | bootstrap |
| `useLogout()` | — | mutation | `auth.signOut` | tudo (clear) |
| `useUpdateMyProfile()` | `{ full_name?, color? }` | mutation → `ProfileRow` | `from('profiles').update().eq('id', me.id).select().single()` | bootstrap, profiles |
| `useUploadMyAvatar()` | `File` | mutation → `avatar_path` | valida MIME/tamanho → `cleanupAvatarFolder(me.id, me.avatar_path)` → `storage.upload(avatarObjectPath(me.id, file), file, { contentType, cacheControl: '3600' })` → `profiles.update({ avatar_path })` → `storage.remove([old])` best-effort. Erro 403 do Storage (cota de 3 objetos por pasta, DATA-MODEL §11) → `RpcError` código sintético `AVATAR_QUOTA` ("Limpe fotos antigas e tente de novo") e a UI mostra botão "Limpar fotos antigas" que chama `cleanupAvatarFolder` e repete o upload | bootstrap, profiles |
| `cleanupAvatarFolder(profileId, keepPath)` (função de `features/auth/api.ts`, reexportada em `features/team/api.ts`) | | `Promise<number>` (objetos removidos) | `storage.from('avatars').list(profileId)` → `remove()` de todo objeto cujo caminho `${profileId}/${name}` seja diferente de `keepPath` (o `avatar_path` atual); best-effort, nunca lança para o chamador do upload | — |
| `useUpdateMyPreferences()` | `{ notifications?, event_alerts? }` | mutation | `profiles.update({ preferences })` | bootstrap |

**features/profiles** (WP0 — read-model compartilhado)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `useProfileStats(seasonId, opts?: { includeInactive?: boolean })` | | `VProfileStats[]` | `v_profile_stats` `.eq('season_id')` `.order('rank', { nullsFirst: false })` `.order('full_name')`; sem `includeInactive` filtra `status = 'active'`; com `includeInactive` traz `inactive` **e** `pending` (a tabela da Equipe mostra ambos com `StatusPill`) |
| `useProfileStat(profileId, seasonId)` | | `VProfileStats \| null` | idem `.eq('profile_id').maybeSingle()` |
| `useRanking(seasonId, limit?)` | | `VRanking[]` | `v_ranking` `.eq('season_id').order('rank')` |
| `useActiveProfiles()` | | `Pick<ProfileRow,'id'\|'full_name'\|'avatar_path'\|'color'\|'job_title'\|'team'\|'role'>[]` | `profiles` `.eq('status','active').order('full_name')` — pendentes e inativos **nunca** entram em picker nenhum (lançar pontos, fila, missão, desafio) |
| `usePendingMembers()` (admin) | | `PendingMember[]` | `profiles.select('id, full_name, avatar_path, color, created_at, profile_private(email)').eq('status', 'pending').order('created_at')` — chave `qk.profiles.pending()`; `enabled: isAdmin`; embed pela FK `profile_private.profile_id` (policy admin). Consumido por `PendingMembersSection` (WP6); o badge da sidebar **não** usa este hook (usa `bootstrap.pending_members`) |
| `useProfilePrivate(profileId)` | | `ProfilePrivateRow \| null` | `profile_private` `.eq('profile_id').maybeSingle()` (RLS: dono ou admin) |
| `useAchievementBoard(profileId = me.id)` | | `VAchievementBoard[]` | `v_achievement_board.eq('profile_id').order('sort_order')` — chave `qk.achievements.one(profileId)`; **promovido** para cá porque Perfil (WP2) e Conquistas (WP5) consomem (regra §2.3) |
| `PersonPicker` (componente) | `{ value: string \| null; onChange; excludeIds?; placeholder? }` | select com avatar+nome | `useActiveProfiles` |

Quando `seasonId === null` (sem temporada ativa), os hooks retornam `[]`/`null` sem consultar (`enabled: !!seasonId`) e a UI mostra o estado "sem temporada" (§9).

**features/notifications** (WP1)

| Hook | Retorna | Fonte |
|---|---|---|
| `useNotifications(limit = 20)` | `NotificationRow[]` | `notifications.order('created_at', desc).limit` |
| `useMarkNotificationsRead()` | mutation `(ids?: string[])` | rpc `mark_notifications_read` → invalida notifications, bootstrap |
| `useNotificationsRealtime()` | efeito | `useRealtimeInvalidate({ table: 'notifications', filter: `profile_id=eq.${me.id}`, keys: [qk.notifications.all(), qk.bootstrap()] })` + `notify.info(title)` no INSERT |
| `NotificationList` (componente) | — | item com `payload.action === 'approve_member'` (DATA-MODEL §6.4 passo 11) é clicável e navega para `/admin/equipe?pendentes=true`; os demais itens não navegam |

**features/dashboard** (WP2)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `useDashboard(profileId?: string, seasonId?: string)` | default `me.id`/ativa | `DashboardPayload` (`{ season: null }` \| `DashboardData`) | rpc `get_dashboard`; `enabled: !!(seasonId ?? me.seasonId)` — sem temporada nem consulta; o componente trata `!hasDashboard(data)` (ou query desabilitada) como o estado "Sem temporada ativa" de §9 |
| `useActivityFeed()` | — | `UseInfiniteQueryResult<VActivityFeed[]>` cursor `occurred_at` | `v_activity_feed` `.order('occurred_at', desc).order('id', desc).lt('occurred_at', cursor).limit(20)` |
| `useTeamOverview(seasonId)` (gestor) | | `VTeamStats \| null` | `v_team_stats.eq('season_id').maybeSingle()` |
| `useFeedRealtime()` | | efeito | `useRealtimeInvalidate({ table: 'feed_events', keys: [qk.feed(), qk.dashboard.all(), qk.bootstrap(), qk.profiles.all()] })` |

**features/missions** (WP3)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `useMissionBoard(filter: MissionFilter, profileId = me.id)` | | `VMissionBoard[]` | `v_mission_board.eq('profile_id').eq('is_current', true)` + `kind in (...)` por filtro (`hoje` = daily+lightning, `semana` = weekly, `especiais` = special) `.order('is_completed').order('ends_at')` |
| `useMissionsAdmin(seasonId)` | | `(MissionRow & { participant_ids: string[] })[]` | `missions.select('*, mission_participants(profile_id)').is('deleted_at', null).eq('season_id').order('starts_at', desc)` |
| `useSaveMission()` | `SaveMissionInput` | mutation → `MissionRow` | rpc `save_mission` → invalida missions, dashboard |
| `useDeleteMission()` | `missionId` | mutation | rpc `delete_mission` |
| `useMissionsRealtime()` | | efeito | cada feature assina o que precisa (não depende do WP2): `useRealtimeInvalidate({ table: 'feed_events', keys: [qk.missions.all(), qk.challenges.all()] })` |

**features/challenges** (WP3)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `useChallengeBoard(seasonId, statuses = ['active','draft','finished'])` | | `VChallengeBoard[]` (participants é `jsonb` tipado `ChallengeParticipant[]`) | `v_challenge_board.eq('season_id').in('status').order('status').order('ends_at')` |
| `useSaveChallenge()` / `useActivateChallenge()` / `useFinishChallenge()` / `useCancelChallenge()` | input / id | mutations | rpcs → invalida challenges; `finish` → `invalidateAfterLedgerChange` |

**features/wheel** (WP4)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `useWheelConfig()` | — | `Record<WheelKind, { wheel: WheelRow; prizes: WheelPrizeRow[] }>` | `wheels.select('*, wheel_prizes(*)')` filtrando `is_active and deleted_at is null` e ordenando `sort_order` no cliente |
| `useWheelQueue()` | — | `VWheelQueue[]` | `v_wheel_queue.order('position')` |
| `useWheelHistory(limit = 10)` | | `VWheelHistory[]` | `v_wheel_history.order('approved_at', desc).limit` |
| `useWheelState()` | — | `{ mode: 'free' \| 'turn' \| 'pending'; active: VWheelQueue \| null; pendingSpinId: string \| null; pendingLabel: string \| null; myTurn: boolean; wheelKind: WheelKind }` | derivado de `useWheelQueue` + `me.id` (`active = status==='active'`; `pending = active.pending_spin_id`) |
| `useEnqueue()` | `{ profileId?; personName?; wheelKind; attempts }` | mutation | rpc `enqueue_wheel` → invalida wheel.queue, bootstrap |
| `useUpdateQueueEntry()` / `useRemoveFromQueue()` / `useReleaseTurn()` | ids | mutations | rpcs → wheel.queue |
| `useSpinWheel()` | `queueId` | mutation → `SpinResultPayload` | rpc `spin_wheel` (o chamador anima com o retorno) → wheel.queue |
| `useSpinWheelFree()` | `wheelKind` | mutation → `SpinResultPayload` | rpc `spin_wheel_free` (nada gravado) |
| `useApproveSpin()` / `useRejectSpin()` | `spinId` | mutation → `ApproveSpinPayload` | rpcs → `invalidateAfterLedgerChange` + wheel.* |
| `useSaveWheelPrizes()` | `{ wheelKind, prizes: SavePrizeInput[] }` | mutation → `WheelPrizeRow[]` | rpc `save_wheel_prizes` → wheel.config |
| `useWheelRealtime({ onRemoteSpin })` | callback `(spin: WheelSpinRow) => void` | efeito | canal `wheel` com `postgres_changes` em `wheel_queue` (`*`), `wheel_spins` (`INSERT`, `UPDATE`), `wheel_prizes` (`*`) → invalida `wheel.all()`; INSERT em `wheel_spins` cujo `spun_by !== me.id` dispara `onRemoteSpin` (as outras telas animam com o mesmo `prize_id`) |

`spin-engine.ts` (puro, testado): `SPIN_DURATION_MS = 8200`, `SPIN_EASING = 'cubic-bezier(0.04, 0.82, 0.12, 1)'`, `EXTRA_TURNS = 10`, `sectorAngle(count) = 360 / count`, `sectorCenterDeg(index, count)`, `targetRotation(current, index, count)` = `current + 360*EXTRA_TURNS + ((360 - sectorCenterDeg) % 360 - (current % 360) + 360) % 360` (ponteiro fixo no topo; a roda gira no sentido horário e **para exatamente** no setor `index`), `resolveSectorIndex(prizes, prizeId)` → `number | null` (se `null` ou `sector_count !== prizes.length` → refetch `wheel.config` antes de animar). Setor `i` cobre `[i*seg, (i+1)*seg)` graus a partir do topo, no sentido horário — o `conic-gradient` e os rótulos usam a mesma convenção.

**features/rewards** (WP5)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `useWallet(profileId = me.id)` | | `VWallet \| null` | `v_wallet.eq('profile_id').maybeSingle()` |
| `useRecentCredits(profileId = me.id, limit = 3)` | | `RecentCredit[]` = `Pick<PointEntryRow,'id'\|'coins'\|'reason'\|'source'\|'metric'\|'occurred_at'> & { rule: { name: string } \| null }` | `point_entries.select('id, coins, reason, source, metric, occurred_at, rule:point_rules(name)').eq('profile_id').gt('coins', 0).order('occurred_at', desc).limit` — embed via FK `point_entries.rule_id` (policy SELECT de `point_rules` é `member`); título do crédito = `reason ?? rule?.name ?? ENTRY_SOURCE_LABELS[source]` (FEATURE §7: valor, título, data) sem importar de `features/points` |
| `useRewardsCatalog(scope: 'store' \| 'admin')` | | `RewardRow[]` | `rewards.is('deleted_at', null)` (+ `.eq('is_active', true)` em `store`) `.order('sort_order').order('cost_coins')` |
| `useMyRedemptions()` | | `VRedemption[]` | `v_redemptions.order('requested_at', desc)` (RLS filtra) |
| `useRedemptionsAdmin(status: RedemptionStatus \| null)` | | `VRedemption[]` | idem com `.eq('status')` |
| `useRedeemReward()` | `rewardId` | mutation → `RedeemPayload` | rpc `redeem_reward` → `setQueryData(bootstrap, coins_balance)` imediato + invalida rewards, bootstrap, ledger |
| `useHandleRedemption()` | `{ id, action, notes? }` | mutation | rpc `handle_redemption` → rewards, admin, ledger |
| `useSaveReward()` | `RewardInsert & { id? }` | mutation | `rewards.upsert()` (policy admin) → rewards |
| `useDeleteReward()` | `id` | mutation | `rewards.update({ deleted_at: now, is_active: false })` |

**features/achievements** (WP5)

| Hook | Retorna | Fonte |
|---|---|---|
| (sem hooks próprios) | — | consome `useAchievementBoard` de `features/profiles` (promovido no WP0); `AchievementsPage` renderiza `AchievementCard` por linha e o contador "N de M" |

**features/admin-dashboard** (WP6)

| Hook | Retorna | Fonte |
|---|---|---|
| `useTeamStats(seasonId)` | `VTeamStats \| null` | `v_team_stats.eq('season_id').maybeSingle()` |
| `useAdminKpis(seasonId)` | `VAdminKpis \| null` | `v_admin_kpis.eq('season_id').maybeSingle()` |
| `useSalesTimeline(seasonId)` | `VSalesTimeline[]` | `v_sales_timeline.eq('season_id').order('day')` |
| gráfico de pontos por colaborador | `VRanking[]` | `useRanking(seasonId)` (features/profiles) |

**features/team** (WP6)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `useTeamRoster(seasonId, search)` | | `VProfileStats[]` (todos, inclusive inativos e pendentes; filtro de busca no cliente) | `useProfileStats(seasonId, { includeInactive: true })` — a tabela/cards mostram `PROFILE_STATUS_LABELS[status]` em `StatusPill`; a seção "Pendentes" (acima da tabela) usa `usePendingMembers()` de `features/profiles`, que funciona **sem temporada ativa** |
| `useApproveMember()` / `useRejectMember()` | `profileId` | mutations → `AdminUpdateProfilePayload` | `admin_update_profile(id, { status: 'active' })` / `{ status: 'inactive' }` (DATA-MODEL §7.2) com `ConfirmDialog` no recusar ("Recusar cadastro de {nome}? Ele poderá ser aprovado depois na lista de inativos.") → invalida `qk.profiles.all()`, `qk.bootstrap()` (badge), `qk.admin.all()` (`v_team_stats.pending_count`); toast "Cadastro aprovado — {nome} já pode entrar" / "Cadastro recusado" |
| `useCollaboratorDashboard(profileId)` | | `DashboardPayload` | rpc `get_dashboard(p_profile_id)` (admin) |
| `useAdminUpdateProfile()` | `{ profileId, patch: AdminProfilePatch }` | mutation → `AdminUpdateProfilePayload` | rpc `admin_update_profile` → profiles, bootstrap (se `profileId === me.id`); `warnings` contém `no_active_season_for_goal` → toast de aviso. **Não** lança pontos (sem `base_points`) |
| `useRecordInitialPoints()` | `{ profileId, points }` | mutation → `PointEntryRow` | rpc `record_initial_points` → `invalidateAfterLedgerChange`; erros `INITIAL_POINTS_EXISTS`, `NO_SEASON_FOR_DATE`, `POINTS_INVALID`, `PROFILE_INACTIVE` pelo catálogo |
| `useInitialPointsSum(profileId)` | | `number` | `v_point_entries_history.select('points').eq('profile_id').eq('season_id', seasonId).eq('source', 'system').eq('reason', 'Pontos iniciais').is('reverses_entry_id', null)` somado no cliente (0 sem temporada ativa; `enabled: !!seasonId`) — chave `qk.ledger.initialPoints(profileId, seasonId)` (invalidada por `qk.ledger.all()` em `invalidateAfterLedgerChange`); exibe "Pontos iniciais lançados: N" no editor de colaborador |
| `useAdminUploadAvatar()` | `{ profileId, file }` | mutation → `avatar_path` | valida MIME/tamanho → `cleanupAvatarFolder(profileId, currentAvatarPath)` → storage upload em `${profileId}/avatar-<epoch>.<ext>` (policy admin) → `admin_update_profile({ avatar_path })` → `storage.remove([old])` best-effort; 403 → `AVATAR_QUOTA` + botão "Limpar fotos antigas" (mesmo tratamento de `useUploadMyAvatar`) |
| `useTeamCode()` (admin) | | `string` | `getTeamCode()` = `unwrap(supabase.from('app_secrets').select('team_code').eq('id', 1).single()).then(r => r.team_code)` — chave `qk.settings.secrets()` (a mesma que `useRotateTeamCode` invalida); usado só pelo `InviteDialog` (`?convidar=true`), exibido com `maskTeamCode` de `lib/format` |

**features/points** (WP7)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `usePointRules(opts?: { includeInactive?: boolean })` | | `PointRuleRow[]` | `point_rules.is('deleted_at', null).order('sort_order')`; seletor de lançamento filtra `trigger_kind === 'manual' && is_active` no cliente |
| `useSavePointRule()` | `PointRuleInsert & { id? }` | mutation | `point_rules.upsert()` |
| `useDeletePointRule()` | `id` | mutation | `update({ deleted_at, is_active: false })` |
| `useEntriesHistory({ profileId, page, pageSize = 25 })` | | `{ rows: VPointEntryHistory[]; total: number }` | `v_point_entries_history.select('*', { count: 'exact' }).order('occurred_at', desc).range(from, to)` (+ `.eq('profile_id')`) |
| `useRecordRuleEntry()` | `RpcArgs<'record_rule_entry'>` | mutation → `PointEntryRow` | rpc → `invalidateAfterLedgerChange` |
| `useRecordManualEntry()` | `RpcArgs<'record_manual_entry'>` | mutation → `PointEntryRow` | rpc → idem |
| `useReverseEntry()` | `{ entryId, reason }` | mutation → `PointEntryRow` | rpc → idem |

**features/settings** (WP7)

| Hook | Params | Retorna | Fonte |
|---|---|---|---|
| `useAppSettings()` | | `AppSettingsRow` | `app_settings.eq('id', 1).single()` |
| `useAppSecrets()` (admin) | | `AppSecretsRow` | `app_secrets.eq('id', 1).single()` — chave `qk.settings.secrets()`; usado na tela de configurações (a Equipe lê o código por `useTeamCode()` próprio, §4.5 features/team, sem importar daqui) |
| `useUpdateAppSettings()` | `AppSettingsPatch` (inclui `auto_approve_members`) | mutation | rpc `update_app_settings` → settings.app, bootstrap. O `MemberApprovalCard` (aba `codigo`) usa este hook com `{ auto_approve_members }` e mostra o aviso "Ligado: quem tiver o código entra na hora — recomendado só com confirmação de e-mail ativa (DATA-MODEL §16.2)" |
| `useRotateTeamCode()` | — | mutation → novo código | rpc `rotate_team_code` (com `ConfirmDialog`) → settings.secrets |
| `useSeasons()` | | `VSeason[]` | `v_seasons.order('starts_at', desc)` |
| `useCreateSeason()` / `useUpdateSeason()` / `useActivateSeason()` / `useCloseSeason()` | | mutations | rpcs → settings.seasons, bootstrap; `close` → `invalidateAfterLedgerChange` e devolve `CloseSeasonPayload` com `warnings`; `activate` trata `SEASON_NOT_STARTED` (o botão já vem desabilitado enquanto `starts_at > now`, com tooltip "Começa em DD/MM") |
| `useSpecialEvents()` | | `VSpecialEvent[]` | `v_special_events.order('starts_at', desc)` |
| `useSaveSpecialEvent()` | `SaveSpecialEventInput` | mutation → `SpecialEventRow` | rpc `save_special_event` (`callRpc('save_special_event', { p })`) — erros `EVENT_OVERLAP`/`EVENT_RANGE_INVALID` pelo catálogo (nunca `23P01` cru) → settings.events, bootstrap |
| `useDeleteSpecialEvent()` | id | mutation | `special_events.update({ deleted_at: now, is_active: false }).eq('id')` (policy admin; único write direto nessa tabela) → settings.events, bootstrap |
| `useRecomputeStats()` | `profileId?` | mutation → `RecomputeStatsPayload` | rpc → `invalidateAfterLedgerChange` |

### 4.6 `src/lib/realtime.ts`

```ts
export type RealtimeTable = 'wheel_queue' | 'wheel_spins' | 'wheel_prizes' | 'notifications' | 'feed_events'
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'
export interface TableSubscription<T extends RealtimeTable> {
  table: T; event?: RealtimeEvent; filter?: string
  onChange: (payload: RealtimePostgresChangesPayload<Tables<T>>) => void
}
/** Um canal por chamada; retorna unsubscribe. Reconecta sozinho (supabase-js). */
export function subscribeToTables(channelName: string, subs: TableSubscription<RealtimeTable>[]): () => void

/** Invalida chaves quando a tabela muda; debounce 250 ms para rajadas. */
export function useRealtimeInvalidate(opts: { table: RealtimeTable; filter?: string; keys: readonly (readonly unknown[])[]; enabled?: boolean }): void
```
- Só as 5 tabelas da publicação (DATA-MODEL §12). `point_entries` **não** é realtime: quem lança invalida localmente; as outras telas recebem via `feed_events`/`notifications`.
- Nunca usar Broadcast para transportar prêmio: o resultado vem da RPC (quem clicou) ou do INSERT em `wheel_spins` (demais telas).
- Nomes de canal: `wheel`, `notifications:<uid>`, `feed`. Um `useEffect` por hook; cleanup obrigatório.

### 4.7 `src/lib/notify.ts`

```ts
export const notify = {
  success: (message: string, description?: string) => toast.success(message, { description }),
  info: (message: string, description?: string) => toast(message, { description }),
  warning: (message: string, description?: string) => toast.warning(message, { description }),
  error: (error: unknown, fallback?: string) => toast.error(fallback ?? 'Não foi possível concluir', { description: getErrorMessage(error) }),
  promise: <T>(p: Promise<T>, msgs: { loading: string; success: string; error?: string }) => toast.promise(p, { ...msgs, error: (e) => msgs.error ?? getErrorMessage(e) }),
}
```
`<Toaster position="bottom-center" richColors={false} theme={theme} toastOptions={{ className: 'orbion-toast' }} />` no `__root.tsx`; estilo em `components.css` (borda verde, fundo `--bg-elevated`, como o toast original). No mobile a posição sobe acima do bottom nav (`--toast-offset`).

### 4.8 `src/lib/format.ts` e `src/lib/labels.ts`

```ts
// format.ts — tudo pt-BR, timezone do app vem de settings.timezone (default America/Sao_Paulo)
export const formatBRL = (n: number, opts?: { compact?: boolean; cents?: boolean }) => string   // "R$ 32.500" | "R$ 8.500,00" | compact: "R$ 200 mil", "R$ 1,2 mi"
export const formatNumber = (n: number, digits = 0) => string                                   // "1.850"
export const formatPoints = (n: number) => string                                               // "1.850 pts" (sinal quando negativo: "−200 pts")
export const formatCoins = (n: number) => string                                                // "740 moedas" / "1 moeda"
export const formatPct = (n: number | null, digits = 0) => string                               // "92,5%" | "—"
export const formatOrdinal = (n: number | null) => string                                       // "3º" | "—"
export const formatDateShort = (iso: string, tz?: string) => string                             // "27/09"
export const formatDate = (iso: string, tz?: string) => string                                  // "27/09/2026"
export const formatDateTime = (iso: string, tz?: string) => string                              // "27/09/2026 14:00"
export const formatTimeRange = (startIso: string, endIso: string, tz?: string) => string         // "14:00 às 16:00"
export const formatRelative = (iso: string, now = Date.now()) => string                         // "Agora" (<60s), "12 min", "1 h", "Ontem", "3 d", senão formatDateShort
export const formatCountdown = (seconds: number) => string                                      // "02:14:30" (HH:MM:SS, nunca negativo; >99h → "4d 02:14")
export const formatDaysLeft = (days: number) => string                                          // "finaliza em 2 dias" | "finaliza hoje"
export const initials = (fullName: string) => string                                            // "Marcelo Alves" → "MA"
export const firstName = (fullName: string) => string
export const maskTeamCode = (code: string) => string                                            // "A3F9C21B7E04" → "A3F9-C21B-7E04"
export const pluralize = (n: number, singular: string, plural: string) => string
```
```ts
// labels.ts — rótulos dos enums (única fonte)
export const JOB_TITLE_LABELS: Record<JobTitle, string> = { sdr: 'SDR', closer: 'Closer', social_seller: 'Social Seller', supervisor: 'Supervisor Comercial', manager: 'Gestor' }
export const METRIC_LABELS: Record<MetricType, string> = { sale: 'Venda realizada', meeting_scheduled: 'Reunião agendada', meeting_held: 'Reunião realizada', call: 'Ligação', crm_update: 'CRM atualizado', lead_recovery: 'Recuperação de lead', upsell: 'Upsell', amount_step: 'Bloco de faturamento', weekly_goal: 'Meta semanal', monthly_goal: 'Meta mensal', activity: 'Atividade', custom: 'Personalizada' }
export const MISSION_KIND_LABELS = { daily: 'Diária', weekly: 'Semanal', special: 'Especial', lightning: 'Relâmpago' }
export const CHALLENGE_METRIC_LABELS = { meetings_held: 'Reuniões', sales_count: 'Vendas', revenue: 'Faturamento', points: 'Pontos', activities: 'Atividades' }
export const CHALLENGE_STATUS_LABELS = { draft: 'Rascunho', active: 'Ativo', finished: 'Finalizado', cancelled: 'Cancelado' }
export const PRIZE_KIND_LABELS = { points: 'Pontos', coins: 'Moedas', cash: 'PIX', voucher: 'Voucher', extra_spin: 'Giro extra', multiplier: 'Multiplicador', mystery: 'Mystery Box', custom: 'Outro' }
export const WHEEL_KIND_LABELS = { classic: 'Roleta Clássica', premium: 'Roleta Premium' }
export const REDEMPTION_STATUS_LABELS = { requested: 'Solicitado', approved: 'Aprovado', delivered: 'Entregue', cancelled: 'Cancelado' }
export const PROFILE_STATUS_LABELS: Record<Enums<'profile_status'>, string> = { active: 'Ativo', pending: 'Pendente', inactive: 'Inativo' }   // StatusPill da Equipe: active=success, pending=warning, inactive=muted
export const QUEUE_SOURCE_LABELS = { manual: 'Adicionado pelo gestor', earned: 'Giro conquistado' }
export const ENTRY_SOURCE_LABELS = { rule: 'Regra', manual: 'Manual', system: 'Automático', mission: 'Missão', challenge: 'Desafio', wheel: 'Roleta', reward: 'Resgate', achievement: 'Conquista' }
export const NOTIFICATION_KIND_ICONS: Record<NotificationKind, string> = { ranking: '🔥', mission: '🎯', reward: '🎁', wheel: '🎰', challenge: '⚔️', achievement: '🏆', level: '🚀', event: '⚡', season: '📅', system: 'ℹ️' }
```

### 4.9 `src/lib/gamification.ts` (puro, 100 % testado)

```ts
export const levelFromPoints = (points: number, xpPerLevel: number) => Math.floor(Math.max(points, 0) / xpPerLevel)
export const xpProgress = (points: number, xpPerLevel: number) => ({ level, xpInLevel, xpToNext, pct })  // pct 0–100 com 1 casa
export const greeting = (date: Date, tz: string) => 'Bom dia' | 'Boa tarde' | 'Boa noite'                // 5–11 / 12–17 / resto
export const medalFor = (rank: number | null) => '🥇' | '🥈' | '🥉' | null
export const goalProjection = (row: Pick<VProfileStats,'projected_goal_date'|'season_ends_at'|'goal_amount'|'sales_amount'>) => { kind: 'reached' } | { kind: 'no_pace' } | { kind: 'on_track', date: string } | { kind: 'late', date: string }
export const feedSentence = (row: VActivityFeed) => { icon: string; name: string; text: string }     // 'sale' → "realizou uma venda de R$ 8.500"; 'achievement' → `desbloqueou "${title}"`; 'wheel_prize' → `ganhou ${label} na ${WHEEL_KIND_LABELS}`; 'level_up' → `subiu para o nível ${to}`; 'mission_completed' → `concluiu a missão "${title}"`; 'challenge_finished' → is_winner ? `venceu o desafio "${name}"` : `encerrou o desafio "${name}"`; 'season_closed' → `Temporada ${season_name} encerrada — campeão: ${champion_name}` (name = "Orbion")
export const missionFilterKinds: Record<MissionFilter, MissionKind[]> = { hoje: ['daily','lightning'], semana: ['weekly'], especiais: ['special'] }
export const nextRewardCopy = (dash: DashboardPayload) => { title: string; body: string; cta: { label: string; to: '/roleta' | '/recompensas' | '/missoes' } } // B.6: giros ganhos > recompensa mais barata > "complete missões para ganhar moedas"
export const eventState = (ev: ActiveEvent | null, now: number) => { kind: 'none' } | { kind: 'upcoming', secondsToStart } | { kind: 'live', secondsToEnd }
export const conversionOf = (sales: number, meetings: number) => number | null
export const wheelStatusLine = (state: WheelState) => string   // "GIRO LIVRE" | "VEZ DE {NOME} • Tentativa i de n" | "AGUARDANDO APROVAÇÃO • {prêmio}"
export const spinButtonLabel = (state: WheelState, spinning: boolean) => string // "GIRAR ROLETA" | "GIRAR ROLETA • {nome}" | "VER PRÊMIO • {nome}" | "GIRANDO…"
```

### 4.10 `src/lib/forms.ts` e `src/lib/dates.ts`

- `useZodForm(schema, defaultValues)` = `useForm({ resolver: zodResolver(schema), defaultValues, mode: 'onBlur' })`.
- Schemas base: `zMoney` (`z.coerce.number().min(0)` aceitando "8.500,00"), `zUuid`, `zLocalDateTime` (string de `datetime-local`), `zTeamCode` (`^[A-Z0-9]{12}$` após normalizar), `zPassword` (min 8), `zHexColor`, `zText(max)`.
- Erros de campo em pt-BR via `z.config({ customError })` global em `main.tsx` (zod 4).
- `dates.ts`: `toDateTimeLocalValue(iso, tz)` / `fromDateTimeLocalValue(value, tz)` (converte para ISO com offset do fuso do app, não do navegador — a temporada e as janelas são no fuso de `settings.timezone`), `todayLocal(tz)`, `seasonContains(season, iso)`, `isoWeekKey(date)`.

### 4.11 Componentes compartilhados — contratos de props (WP0 cria, WP8 refina; ninguém mais altera)

| Componente | Props | Comportamento |
|---|---|---|
| `PageFrame` | `{ eyebrow: string; title: string; subtitle?: string; action?: ReactNode; children }` | cabeçalho de página do original (eyebrow verde uppercase, h1 black, subtítulo muted) |
| `SectionHeader` | `{ eyebrow: string; title: string; action?: ReactNode }` | |
| `PremiumCard` | `{ as?: 'section' \| 'div'; tone?: 'default' \| 'green' \| 'gold' \| 'purple' \| 'red' \| 'blue'; glow?: boolean; padding?: 'sm' \| 'md' \| 'lg'; className?; children }` | `.premium-card` (gradiente + borda 1px + raio 22px); `tone` aplica gradiente/borda coloridos como LevelHero/NextReward/EventBanner/LightningMission |
| `Badge` | `{ tone: 'green' \| 'gold' \| 'red' \| 'blue' \| 'purple' \| 'dark'; children }` | pílula uppercase 9px |
| `Progress` | `{ value: number; tone?: 'green' \| 'gold' \| 'red' \| 'blue'; size?: 'sm' \| 'md' \| 'lg'; glow?: boolean; label?: string }` | barra com gradiente e `aria-valuenow` |
| `Avatar` | `{ name: string; color: string; avatarPath?: string \| null; size?: 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'; ring?: boolean }` | foto (via `avatarUrl`) ou iniciais sobre gradiente da `color`; `alt` = nome |
| `StatCard` | `{ label: string; value: string; icon: LucideIcon; tone: Tone; hint?: string; to?: LinkTo }` | 4 cards do dashboard |
| `IconTile` | `{ icon: LucideIcon; tone: Tone; size?: 'sm' \| 'md' \| 'lg' }` | quadrado com ícone colorido |
| `StatusPill` | `{ status: string; map: Record<string, { label: string; tone: Tone }> }` | status de resgate/desafio/fila |
| `EmptyState` | `{ icon: LucideIcon; title: string; description: string; action?: { label: string; to?: LinkTo; onClick?: () => void }; compact?: boolean; adminHint?: string }` | `adminHint` só renderiza se `useMe().isAdmin` |
| `ErrorState` | `{ error: unknown; onRetry?: () => void; compact?: boolean }` | usa `getErrorMessage` |
| `QueryBoundary` | `{ query: UseQueryResult<T>; skeleton: ReactNode; empty?: { when: (data: T) => boolean; render: ReactNode }; children: (data: T) => ReactNode }` | padroniza loading/erro/vazio/dados em uma chamada |
| `Skeletons` | `CardSkeleton`, `ListSkeleton({ rows })`, `TableSkeleton({ rows, cols })`, `PageSkeleton`, `WheelSkeleton` | `animate-pulse` sobre `--surface` |
| `ConfirmDialog` | `{ open; onOpenChange; title; description; confirmLabel; tone?: 'danger' \| 'primary'; onConfirm: () => Promise<void> \| void; loading? }` | AlertDialog; `Enter` confirma |
| `Countdown` | `{ to: string \| number; mode?: 'hms' \| 'days'; onZero?: () => void; className? }` | tick 1 s com `setInterval`, para em 0; usa `formatCountdown` |
| `MoneyInput` | `{ value: number \| null; onChange: (n: number \| null) => void; ...InputProps }` | máscara BRL, retorna número |
| `FormField` | `{ label: string; error?: string; hint?: string; required?; children }` | rótulo `.field-label` + erro |
| `DataTable<T>` | `{ columns: Column<T>[]; rows: T[]; rowKey; empty: ReactNode; mobileCard?: (row: T) => ReactNode; onRowClick? }` | tabela em `md+`, cards abaixo (padrão Equipe/Histórico) |
| `ThemeSwitch` | — | dois botões Escuro/Claro (`aria-pressed`) |

Cada componente tem story-like demo em `src/components/shared/__demo__/showcase.tsx` (rota `/dev/showcase` só em `import.meta.env.DEV`) para o WP8 validar os dois temas sem depender das features.

---

## 5. Tema — tokens dark/light em `html[data-theme]`

### 5.1 Princípios
- Dark é o tema padrão do produto (navy `#07111F`); light é opcional e persistido em `localStorage['orbion-theme']`.
- **Um** atributo: `html[data-theme="dark" | "light"]`, aplicado pelo script inline do `index.html` antes do primeiro paint e mantido por `features/theme/theme-provider.tsx`. `color-scheme` acompanha.
- Nenhum `!important`. Nenhum seletor por classe arbitrária (`[class*="bg-[#07111F]"]`). Nenhum hex em componente: tudo via `var(--token)` ou utilitário Tailwind gerado por `@theme inline` (`bg-bg`, `bg-elevated`, `text-text`, `text-muted`, `border-line`, `text-accent`, `bg-accent/10`, `text-gold`, `bg-gold/10`, `text-blue`, `text-purple`, `text-red`…). Opacidades funcionam porque Tailwind v4 usa `color-mix` sobre a variável.
- Exceção única: cores de setor da roleta vêm de `wheel_prizes.color` (dado) com fallback em `features/wheel/wheel-palette.ts`.

### 5.2 `src/styles/tokens.css`

```css
:root, html[data-theme='dark'] {
  color-scheme: dark;
  /* superfícies */
  --bg: #07111f;                 --bg-elevated: #0d1b2a;          --bg-sidebar: rgb(9 21 34 / 0.95);
  --card-from: #111f30;          --card-to: #0d1b2a;              --surface: rgb(255 255 255 / 0.035);
  --surface-hover: rgb(255 255 255 / 0.07);                       --surface-deep: rgb(0 0 0 / 0.10);
  --line: rgb(255 255 255 / 0.075);  --line-strong: rgb(255 255 255 / 0.12);
  --backdrop: rgb(2 7 16 / 0.82);
  /* texto */
  --text: #ffffff; --text-2: #cbd5e1; --muted: #94a3b8; --muted-2: #64748b; --muted-3: #475569; --placeholder: #475569;
  /* marca */
  --accent: #00e887; --accent-hover: #00ff9c; --accent-fg: #07111f;
  --gold: #ffc83d; --gold-soft: #ffe08b; --blue: #4776ff; --blue-soft: #7396ff; --purple: #855cff; --purple-soft: #b49bff;
  --red: #ff5252; --red-soft: #ff7272; --cyan: #27c2ff; --bronze: #d49a72;
  /* efeitos */
  --shadow-card: 0 18px 50px rgb(0 0 0 / 0.12); --shadow-modal: 0 32px 100px rgb(0 0 0 / 0.55);
  --glow-accent: 0 0 30px rgb(0 232 135 / 0.22); --glow-gold: 0 0 40px rgb(255 200 61 / 0.18);
  --ring: rgb(0 232 135 / 0.32);
  --radius-card: 22px; --radius-panel: 28px; --radius-ctl: 0.8rem;
  --bg-glow: radial-gradient(circle at 18% 0%, rgb(0 232 135 / 0.055), transparent 24rem);
  --wheel-rim: #111c29; --wheel-dark-1: #14293b; --wheel-dark-2: #192a39; --wheel-dark-3: #203650; --wheel-dark-4: #162a3d;
  --toast-offset: 24px;
}
html[data-theme='light'] {
  color-scheme: light;
  --bg: #f4f7fb; --bg-elevated: #ffffff; --bg-sidebar: rgb(255 255 255 / 0.97);
  --card-from: #ffffff; --card-to: #ffffff; --surface: #f8fafc; --surface-hover: #eef2f7; --surface-deep: #f1f5f9;
  --line: #dfe7f0; --line-strong: #cbd5e1; --backdrop: rgb(15 23 42 / 0.42);
  --text: #0f172a; --text-2: #334155; --muted: #64748b; --muted-2: #7c8da3; --muted-3: #94a3b8; --placeholder: #94a3b8;
  --accent: #00b86b; --accent-hover: #009e5a; --accent-fg: #ffffff;      /* verde mais escuro: contraste AA sobre branco */
  --gold: #d99a00; --gold-soft: #f2c94c; --blue: #2f5fe0; --blue-soft: #4776ff; --purple: #6d47e6; --purple-soft: #855cff;
  --red: #e03e3e; --red-soft: #ff5252; --cyan: #0a9bd6; --bronze: #b5732e;
  --shadow-card: 0 14px 38px rgb(15 23 42 / 0.055); --shadow-modal: 0 30px 90px rgb(15 23 42 / 0.18);
  --glow-accent: 0 0 0 transparent; --glow-gold: 0 0 0 transparent; --ring: rgb(0 184 107 / 0.3);
  --bg-glow: radial-gradient(circle at 18% 0%, rgb(0 232 135 / 0.05), transparent 24rem);
  --wheel-rim: #dfe7f0; --wheel-dark-1: #1e293b; --wheel-dark-2: #243244; --wheel-dark-3: #2c3a52; --wheel-dark-4: #223043;
}
@theme inline {
  --color-bg: var(--bg); --color-elevated: var(--bg-elevated); --color-sidebar: var(--bg-sidebar);
  --color-surface: var(--surface); --color-surface-hover: var(--surface-hover); --color-surface-deep: var(--surface-deep);
  --color-line: var(--line); --color-line-strong: var(--line-strong); --color-backdrop: var(--backdrop);
  --color-text: var(--text); --color-text-2: var(--text-2); --color-muted: var(--muted); --color-muted-2: var(--muted-2); --color-muted-3: var(--muted-3);
  --color-accent: var(--accent); --color-accent-hover: var(--accent-hover); --color-accent-fg: var(--accent-fg);
  --color-gold: var(--gold); --color-gold-soft: var(--gold-soft); --color-blue: var(--blue); --color-blue-soft: var(--blue-soft);
  --color-purple: var(--purple); --color-purple-soft: var(--purple-soft); --color-red: var(--red); --color-red-soft: var(--red-soft);
  --color-cyan: var(--cyan); --color-bronze: var(--bronze);
  --radius-card: var(--radius-card); --radius-panel: var(--radius-panel); --radius-ctl: var(--radius-ctl);
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

### 5.3 `src/styles/base.css`
```css
@import 'tailwindcss';
@import 'tw-animate-css';
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));
@custom-variant light (&:where([data-theme='light'], [data-theme='light'] *));
@layer base {
  html { background: var(--bg); }
  body { margin: 0; min-height: 100dvh; background: var(--bg-glow), var(--bg); color: var(--text); font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
  * { border-color: var(--line); scrollbar-width: thin; scrollbar-color: rgb(148 163 184 / 0.24) transparent; }
  :focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  ::selection { background: color-mix(in oklab, var(--accent) 30%, transparent); }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } } /* única exceção de !important permitida: acessibilidade */
}
```
Fonte: usar a pilha do sistema (sem Google Fonts por padrão — sem dependência externa nem CSP extra). Se o produto quiser Inter, self-host em `public/fonts` com `font-display: swap` (decisão do WP8).

### 5.4 `src/styles/components.css`
Classes de identidade (usadas pelos componentes de `components/shared`, não diretamente pelas features): `.premium-card` (gradiente `--card-from/--card-to`, borda `--line`, raio `--radius-card`, sombra `--shadow-card`), `.premium-card[data-tone=green|gold|purple|red|blue]` (gradientes tonais do original: `#102A28→#0D1B2A`, `#241F14→#151D29`, `#261D43→#111F30`, `#35161D→#111F30`, `#172C56→#111F30` em dark; em light: `#EEFCF6→#fff`, `#FFF9E8→#fff`, `#F3EEFF→#fff`, `#FFF1F1→#fff`, `#EEF3FF→#fff`), `.eyebrow`, `.field-label`, `.field-input`, `.podium-glow`, `.glass` (sidebar/topbar), `.orbion-toast`, `@keyframes confetti-fall`, `.confetti-layer` (portado), `.nav-item[data-status=active]`.

### 5.5 `features/theme`
- `ThemeProvider` (contexto `{ theme, setTheme, toggle }`): lê `document.documentElement.dataset.theme` no init (já aplicado pelo script), grava `localStorage['orbion-theme']` e `dataset.theme` no `setTheme`; escuta `storage` para sincronizar abas.
- `ThemeSwitch` na topbar (também no `/login` no canto superior direito). `useTheme()` é usado por `Toaster` e pelos gráficos (`chart-theme.ts` lê `getComputedStyle(document.documentElement).getPropertyValue('--accent')` etc. e reexecuta no toggle).
- `<meta name="theme-color">` é atualizado no toggle (`#07111F` / `#F4F7FB`).

---

## 6. Mapa de propriedade de arquivos — 9 pacotes de trabalho

Ordem de execução: **Onda 0** = WP0 (bloqueia tudo). **Onda 1** = WP1 e WP8 em paralelo (WP8 só toca estilos/compartilhados). **Onda 2** = WP2, WP3, WP4, WP5, WP6, WP7 em paralelo. **Onda 3** = integração (Apêndice B; sem pacote — o orquestrador roda `npm run build && npm run lint && npm test` e a checklist).

Regra de ouro: cada arquivo tem **um** dono. Um pacote que precise de mudança em arquivo alheio registra a necessidade em `docs/spec/handoffs/<wpN>.md` (uma linha: arquivo, mudança, motivo) em vez de editar. Arquivos "gerados" (`routeTree.gen.ts`, `package-lock.json`) não são de ninguém: nunca editar à mão; regenerar.

### WP0 — Fundação e design system (onda 0)
**Cria/possui:** `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.env.example`, `vercel.json`, `README.md`, `components.json`, `src/main.tsx`, `src/router.tsx`, `src/vite-env.d.ts`, `src/routes/__root.tsx`, **stubs** de todas as rotas listadas em §2.2 (cada uma renderiza `<PageFrame>` + `<EmptyState>` "Em construção"; a partir da onda 1 cada arquivo de rota pertence ao pacote indicado no resumo abaixo, e o WP0 não volta a tocá-los), `src/lib/**` (todos os 11 arquivos), `src/features/profiles/**` (inclusive `getAchievementBoard`/`useAchievementBoard`, promovidos para atender Perfil e Conquistas, e `getPendingMembers`/`usePendingMembers`, para Equipe), `src/features/auth/bootstrap-query.ts` (`getBootstrap` com a retentativa de `updateUser({ team_code: null })`, `bootstrapQueryOptions`, `useBootstrap`, `useMe`), `src/features/auth/auth-provider.tsx` (`AuthState`, `AuthProvider`, `useAuth`), `src/features/theme/**` (versão funcional), `src/components/ui/**` (11 mantidos, restilizados), `src/components/shared/**` (inclusive `achievements-mini-grid.tsx`), `src/styles/**`, `src/test/**`, `docs/spec/legacy/**` (CSS do Lovable arquivado), remoção de tudo listado em §1.3.
**Não toca:** nada de `features/*` além dos citados; nenhum componente de página.
**Entrega:** `npm run build`, `lint`, `test` verdes; app sobe em `/login` com tela de login stub; `/dev/showcase` mostra todos os compartilhados nos dois temas.

### WP1 — Layout, autenticação e notificações (onda 1)
**Possui:** `src/features/auth/**` exceto `auth-provider.tsx` e `bootstrap-query.ts` (WP0 continua dono; mudanças neles vão para `handoffs/wp1.md`), `src/features/notifications/**`, `src/components/layout/**`, `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/aguardando.tsx`, `src/routes/_app.tsx`, `src/routes/_app/_admin.tsx`.
**Não toca:** `lib/**`, `components/shared/**`, `styles/**`, demais rotas/features.
**Entrega:** fluxo completo §3 (primeiro admin, colaborador com código → `SignupSuccess` explicando a aprovação → `/aguardando` com "Verificar novamente", e-mail duplicado, senha errada, perfil inativo em `/aguardando`, logout), sidebar por papel com badge "Pendentes" no item Equipe (`bootstrap.pending_members`), topbar (temporada, moedas, sino com realtime, tema, menu do usuário), bottom nav, drawer mobile.

### WP2 — Visão geral (colaborador e gestor), Ranking e Perfil (onda 2)
**Possui:** `src/features/dashboard/**`, `src/features/ranking/**`, `src/features/profile/**`, `src/routes/_app/index.tsx`, `src/routes/_app/ranking.tsx`, `src/routes/_app/perfil.tsx`.
**Não toca:** `features/team/**` (modal de colaborador é do WP6: o botão "Ver desempenho" navega para `/admin/equipe?perfil=<id>`), `features/auth/**` (usa `useUpdateMyProfile`/`useUploadMyAvatar` prontos), `features/achievements/**` (o mini-grid do Perfil é `AchievementsMiniGrid` de `components/shared`, alimentado por `useAchievementBoard` de `features/profiles`).
**Entrega:** Dashboard §2 completo (LevelHero, 4 StatCards, SalesTarget com projeção, NextReward B.6, RankingPreview, EventBanner com contador, MissionPreview, ActivityFeed com realtime e paginação; `useDashboard` desabilitado sem temporada → estado "Sem temporada ativa"), ManagerOverview §2b (4 métricas, tabela de desempenho, Top 3, Saúde comercial), Ranking §3 (pódio com alturas/medalhas/glow, lista com "Você" e gap), Perfil §9 (stats, mini-grid de conquistas via `AchievementsMiniGrid`, editar nome/cor/foto com limpeza da pasta de avatares antes do upload e botão "Limpar fotos antigas" no 403).

### WP3 — Missões e Desafios (onda 2)
**Possui:** `src/features/missions/**`, `src/features/challenges/**`, `src/routes/_app/missoes.tsx`, `src/routes/_app/desafios.tsx`.
**Entrega:** filtros por search param, LightningMission com contador (`seconds_remaining`), cards com progresso/concluída, editor de missão (admin; participantes com `PersonPicker` múltiplo; janela validada contra a temporada no cliente antes de enviar), lista admin com excluir; DuelCard (barra proporcional, VS, prêmio, "finaliza em N dias"), TeamChallenge (meta/realizado/%/prêmio coletivo), ChallengesManager (lista com status, editor só em `draft`, ações ativar/finalizar/cancelar com `ConfirmDialog`).

### WP4 — Roleta: tela do colaborador, fila do gestor, RPC de giro, editor de prêmios (onda 2)
**Possui:** `src/features/wheel/**` (inclusive `wheel.css`), `src/routes/_app/roleta.tsx`, `src/routes/_app/_admin/admin/roleta.tsx`.
**Entrega:** seletor Clássica/Premium (bloqueado na roleta da vez ativa), roda com `conic-gradient` gerado dos prêmios (`color` ou paleta), rótulo por setor, ponteiro, centro, animação 8,2 s parando no `sector_index` do retorno, confete, `SpinResultDialog` (prêmio, modo, tipo, Mystery Box → prêmio resolvido, botões Aprovar/Fechar sem aprovar para admin; "Concluir giro livre"), status "GIRO LIVRE / VEZ DE / AGUARDANDO APROVAÇÃO", botão de giro por estado (admin ou dono da vez pode girar; demais veem "Aguardando liberação"), `QueueQuickPanel` (acima) e `QueuePanel` (abaixo, com busca, adicionar colaborador/convidado, roleta, tentativas com cadeado até 20, liberar/liberado, remover, "N restantes"), histórico "Últimas aprovações", realtime (outras telas animam no INSERT de `wheel_spins`; refetch de prêmios se `prizes_hash` mudou), editor de prêmios em `/admin/roleta` (label, tipo, valor, peso, cor, ordem, ativo; mín. 2; erro `SPIN_PENDING`).

### WP5 — Recompensas e Conquistas (onda 2)
**Possui:** `src/features/rewards/**`, `src/features/achievements/**`, `src/routes/_app/recompensas.tsx`, `src/routes/_app/conquistas.tsx`, `src/routes/_app/_admin/admin/recompensas.tsx`.
**Entrega:** carteira (saldo; as 3 métricas de origem **fixas** do original — "+Venda" = `v_wallet.coins_from_sales`, "+Missão" = `coins_from_missions`, "+Meta" = `coins_from_goals`, no mesmo layout; as demais origens (`coins_from_wheel`, `coins_from_challenges`, `coins_from_achievements`, `coins_from_manual`) ficam em tooltip/lista secundária "Outras origens"; últimos 3 créditos com título `reason ?? rule.name ?? ENTRY_SOURCE_LABELS[source]`), conquistas consumindo `useAchievementBoard` de `features/profiles`, loja (Resgatar/Faltam N moedas, estoque, confirmação), "Meus pedidos" (status/notas), admin: catálogo CRUD (nome, categoria, valor, custo, estoque, ícone, ativo) e fila de pedidos (aprovar/entregar/cancelar com notas); conquistas grid (desbloqueada/bloqueada, ✨, `unlocked_count`), contador "N de M".

### WP6 — Dashboard administrativo e Equipe (onda 2)
**Possui:** `src/features/admin-dashboard/**`, `src/features/team/**`, `src/routes/_app/_admin/admin/index.tsx`, `src/routes/_app/_admin/admin/equipe.tsx`.
**Entrega:** botões de atalho (Criar missão → `/missoes?novo=true`; Criar desafio → `/desafios?novo=true`; Gerenciar equipe → `/admin/equipe`), 6 métricas, 3 gráficos recharts 3 (área acumulada, barras por colaborador, linha de pontos) com `chart-theme.ts` reagindo ao tema, indicadores (conversão, comparecimento, CRM, atividades vs metas de `app_settings`), barra operacional (Cadastrar colaborador → `/admin/equipe?convidar=true`, que abre o `InviteDialog` "Como adicionar colaboradores" com o `team_code` lido por `useTeamCode()` (`features/team`), mascarado com `maskTeamCode`, botão copiar e o link `/signup` — contas nascem só pelo cadastro com código; Lançar pontos → `/admin/pontuacao?aba=lancar`; Histórico → `/admin/pontuacao?aba=historico`; contadores colaboradores/pontos/lançamentos), Equipe: tabela/cards, busca, `CollaboratorDetailDialog` (`?perfil=`), `CollaboratorEditorDialog` (`?editar=`; foto ≤ 1,5 MB com `cleanupAvatarFolder` antes do upload e botão "Limpar fotos antigas" no 403, nome, e-mail, cargo, status, equipe, telefone, meta individual, papel; nível somente leitura — o save do formulário **nunca** lança pontos), **pontos iniciais** como ação separada no mesmo diálogo (`InitialPointsCard`: mostra "Pontos iniciais lançados: N" via `useInitialPointsSum`; campo + botão próprio "Lançar pontos iniciais" → `useRecordInitialPoints`; `INITIAL_POINTS_EXISTS` desabilita o botão com a mensagem do catálogo; `NO_SEASON_FOR_DATE` orienta a ativar a temporada), inativar/reativar com `LAST_ADMIN` tratado; **seção "Pendentes"** (`PendingMembersSection`, acima da tabela, visível só quando `usePendingMembers()` devolve ≥ 1 ou `?pendentes=true`): cabeçalho "Cadastros aguardando aprovação ({n})", linha por pedido (avatar, nome, e-mail de `profile_private`, "pediu há {relativo}"), botões "Aprovar" (`useApproveMember`) e "Recusar" (`useRejectMember` com `ConfirmDialog`), `EmptyState` "Nenhum cadastro aguardando" quando aberta por `?pendentes=true` sem pendentes; a tabela principal mostra pendentes/inativos com `StatusPill` (`PROFILE_STATUS_LABELS`) e o editor de colaborador desabilita "Lançar pontos iniciais" para `status !== 'active'` (o banco devolveria `PROFILE_INACTIVE`).

### WP7 — Pontuação, Configurações (pessoais e da plataforma) e Guia (onda 2)
**Possui:** `src/features/points/**`, `src/features/settings/**`, `src/features/guide/**`, `src/routes/_app/configuracoes.tsx`, `src/routes/_app/_admin/admin/pontuacao.tsx`, `src/routes/_app/_admin/admin/configuracoes.tsx`, `src/routes/_app/_admin/admin/guia.tsx`.
**Entrega:** regras (lista com ativa/inativa, pontos, moedas, métrica, tipo; editor; nova; excluir soft), lançar por regra (colaborador com saldo atual, regra manual, quantidade, valor R$ quando `requires_amount`, data/hora ≤ 90 dias, motivo) e manual (±pontos, motivo, moedas opcionais), histórico paginado com estorno (`ConfirmDialog` + motivo), preferências pessoais (notificações, alertas de evento), plataforma — aba geral (`company-form.tsx`): empresa, XP por nível, metas de indicadores, toggle "Gestores participam do ranking" (`rank_admins`), fuso (campo desabilitado quando `v_admin_kpis.entries_count > 0` ou após erro `TIMEZONE_LOCKED`, com hint "Trava após o primeiro lançamento"); temporadas (`season-panel.tsx`: lista, criar, editar; botão "Ativar" desabilitado com tooltip "Começa em DD/MM" enquanto `starts_at > now` e `SEASON_NOT_STARTED` tratado se escapar; `close-season-dialog.tsx`: encerrar com resumo `CloseSeasonPayload` e, se `warnings` contém `gap_until_next_season`, oferta "Antecipar início da próxima para {todayLocal+1}" → `useUpdateSeason(next_season_id, { starts_on: todayLocal(tz) + 1 dia })`; alerta quando `season.ends_at < now`), eventos especiais (criar/editar via `save_special_event`, desativar via soft delete; `EVENT_OVERLAP`/`EVENT_RANGE_INVALID` pelo catálogo), código da equipe (mostrar mascarado, copiar, gerar novo; lembrete "Todos já entraram? Gere um novo código" — DATA-MODEL §14.1 passo 7), **aprovação de membros** (`member-approval-card.tsx`, na mesma aba `codigo`: `Switch` "Aprovar novos membros automaticamente" ligado a `app_settings.auto_approve_members` via `useUpdateAppSettings`; texto de ajuda "Desligado (recomendado): cada cadastro com o código fica em Equipe › Pendentes até um gestor aprovar. Ligado: quem tiver o código entra na hora — use só com confirmação de e-mail ativa."; a mudança vale só para cadastros futuros, DATA-MODEL Apêndice B.21), manutenção (`recompute_stats`); guia com os 9 passos do Apêndice C do DATA-MODEL + checklist.

**Notas de implementação (integração onda 3):** a checklist embutida em Configurações › Geral (`setup-checklist.tsx`) é uma versão derivada do estado (temporada ativa, meta, pendentes, próxima temporada) com link para o guia completo; a lista estática de 9 itens vive só em `features/guide/guide-steps.ts` porque `features/settings` não pode importar de `features/guide` (§2.3). A trava do fuso usa `v_point_entries_history` (`count: exact, head: true`, chave `qk.ledger.hasEntries()`) em vez de `v_admin_kpis.entries_count`: o KPI é por temporada e `TIMEZONE_LOCKED` vale para qualquer lançamento em qualquer temporada (DATA-MODEL §7.2).

### WP8 — Tema claro, polimento dos compartilhados, acessibilidade e responsivo (onda 1, continua na onda 3)
**Possui (herda do WP0):** `src/styles/**`, `src/components/shared/**`, `src/components/ui/**`, `src/features/theme/**`, `public/fonts/**` (se adotar fonte), `src/components/shared/__demo__/**`.
**Não pode:** mudar **props** de componente compartilhado (só internos/estilo); tocar features ou rotas. Reporta problemas visuais das features em `docs/spec/handoffs/wp8.md`.
**Entrega:** light theme completo e AA (texto 4.5:1), foco visível, `prefers-reduced-motion`, 320/375/768/1024/1440 sem overflow horizontal, `Sheet`/`Dialog` com foco preso, toast acima do bottom nav, capturas dos dois temas em `docs/spec/qa/`.

### Resumo (arquivo → dono)

| Caminho | Dono |
|---|---|
| raiz (`package.json`, configs, `index.html`, `vercel.json`, `.env.example`) | WP0 |
| `src/main.tsx`, `src/router.tsx`, `src/routes/__root.tsx`, `src/lib/**`, `src/features/profiles/**`, `src/test/**` | WP0 |
| `src/styles/**`, `src/components/shared/**` (inclusive `achievements-mini-grid.tsx`), `src/components/ui/**`, `src/features/theme/**` | WP0 cria → WP8 mantém |
| `src/features/auth/**`, `src/features/notifications/**`, `src/components/layout/**` (resto), `routes/login|signup|aguardando|_app|_app/_admin` | WP1 |
| `src/features/dashboard|ranking|profile/**`, `routes/_app/index|ranking|perfil` | WP2 |
| `src/features/missions|challenges/**`, `routes/_app/missoes|desafios` | WP3 |
| `src/features/wheel/**`, `routes/_app/roleta`, `routes/_app/_admin/admin/roleta` | WP4 |
| `src/features/rewards|achievements/**`, `routes/_app/recompensas|conquistas`, `routes/_app/_admin/admin/recompensas` | WP5 |
| `src/features/admin-dashboard|team/**`, `routes/_app/_admin/admin/index|equipe` | WP6 |
| `src/features/points|settings|guide/**`, `routes/_app/configuracoes`, `routes/_app/_admin/admin/pontuacao|configuracoes|guia` | WP7 |

---

## 7. Definition of Done por pacote

Comum a todos (bloqueante):
1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` verdes; nenhum `any`, nenhum `// @ts-ignore`, nenhum `console.log`.
2. Toda query renderiza os 4 estados: **carregando** (skeleton com a mesma altura do conteúdo), **erro** (`ErrorState` com "Tentar novamente"), **vazio** (`EmptyState` de §9 com orientação ao gestor) e **dados**. Toda mutation: botão com `loading`, toast de sucesso, toast de erro com mensagem do catálogo, botão desabilitado durante o envio (sem duplo clique).
3. Funciona com o banco **recém-instalado** (seed de catálogo, zero pessoas, zero lançamentos): nada quebra, nenhum `undefined` na tela, nenhum `NaN`, nenhum "R$ NaN", nenhuma divisão por zero.
4. Larguras 375, 768, 1024 e 1440 sem scroll horizontal; alvos de toque ≥ 44 px; bottom nav não cobre conteúdo (`pb-28` no `main` em mobile).
5. Dark e light corretos (nenhum hex, só tokens). Ícones decorativos `aria-hidden`; botões só-ícone com `aria-label`; modais com título; formulários com `label`.
6. Texto 100 % pt-BR; números/moeda/datas pelos formatadores de `lib/format.ts` (proibido `toLocaleString` direto).
7. Nenhum dado fictício, nenhum `localStorage` fora de `features/theme`, nenhuma chamada supabase fora de `api.ts`/`lib`.
8. Testes: `lib/**` ≥ 80 % (WP0); demais pacotes testam funções puras dos próprios `api.ts`/`schemas.ts`/engines e pelo menos 1 teste de renderização por página com `renderWithProviders` e supabase mockado (estados vazio + com dados).

Específico:

| WP | Critérios adicionais |
|---|---|
| WP0 | `/dev/showcase` exibe todos os compartilhados; `database.types.test.ts` compila (com `profile_status = 'pending'`, `BootstrapPayload.pending_members`, `PendingMember`); `usePendingMembers` testado com supabase mockado (lista vazia e com 2 pedidos); `spin-engine`, `format`, `gamification`, `rpc-errors` ≥ 90 %; `README.md` reescrito com setup local (`.env.local`), scripts e deploy; app sem env mostra `ConfigMissingScreen` |
| WP1 | Primeiro cadastro cria admin e cai em `/`; segundo cadastro sem código falha com mensagem certa; código inválido (`false`) bloqueia antes do `signUp`; `validate_team_code` falhando por rede **não** bloqueia o `signUp` e `Database error saving new user` vira "Não foi possível concluir o cadastro. Verifique o código."; `data.session === null` mostra `SignupSuccess` "Confirme seu e-mail" com a frase sobre a aprovação; cadastro com código **e** sessão cai em `/aguardando` com "Seu cadastro está aguardando aprovação do gestor" e "Verificar novamente" leva a `/` depois que o bootstrap devolve `active`; `updateUser({ team_code: null })` chamado após o cadastro; `PROFILE_NOT_FOUND` no bootstrap faz `signOut()` com "Cadastro incompleto"; sessão persiste após reload; logout limpa cache; perfil inativado cai em `/aguardando` com "Seu acesso foi desativado"; badge "Pendentes" aparece no item Equipe da sidebar só para admin e só quando `pending_members > 0`; colaborador não vê "Administração" e é redirecionado de `/admin/*`; sino atualiza via realtime; drawer fecha ao navegar |
| WP2 | Sem temporada ativa: `useDashboard` não consulta e o dashboard mostra estado "Sem temporada ativa" (§9) em vez de zeros; upload de foto no Perfil lista e limpa a pasta `avatars/<me.id>` antes de subir, remove a foto anterior após gravar e trata 403 com "Limpe fotos antigas e tente de novo" + botão que executa a limpeza; mini-grid do Perfil usa `AchievementsMiniGrid` (nenhum import de `features/achievements`); ranking com 1 pessoa mostra pódio parcial (2º/3º vazios "aguardando"); "Você" destacado; gap "líder" quando `gap_to_above` null; feed pagina por cursor; contador do evento zera e some; projeção de meta usa `goalProjection` |
| WP3 | Missão diária concluída ontem aparece zerada hoje (`period_key`); relâmpago some após `ends_at`; editor impede janela fora da temporada e relâmpago > 24 h antes de enviar; `MISSION_HAS_PROGRESS` exibido; duelo exige 2 participantes; coletivo sem participantes = todos |
| WP4 | Roda para no setor certo em 100 giros de teste (`spin-engine.test.ts`); duas abas: giro em uma anima na outra; `SPIN_PENDING` bloqueia liberar/editar; convidado pode ser aprovado; `extra_spin` aumenta tentativas; ao esgotar sai da fila; free spin não altera fila nem saldo; editor recusa < 2 prêmios; roleta re-renderiza ao salvar prêmios |
| WP5 | Saldo atualiza no chip imediatamente após resgate; `INSUFFICIENT_COINS`/`OUT_OF_STOCK` mostrados; cancelamento devolve moedas na UI; conquista repetível mostra `unlocked_count`; carteira mostra +Venda/+Missão/+Meta de `coins_from_sales`/`coins_from_missions`/`coins_from_goals` (fixas); último crédito de regra sem `reason` mostra o nome da regra (embed `point_rules(name)`) |
| WP6 | Gráficos com 0 pontos mostram estado vazio (não gráfico em branco); gráficos recoloridos ao trocar tema; `LAST_ADMIN` e `EMAIL_TAKEN` tratados; upload > 1,5 MB ou SVG bloqueado antes do envio; upload do admin limpa a pasta `avatars/<profileId>` antes de subir, remove a anterior após gravar e trata 403 com "Limpe fotos antigas e tente de novo" + botão de limpeza; salvar o formulário do colaborador não cria lançamento; "Lançar pontos iniciais" cria entry `system` e a segunda tentativa mostra `INITIAL_POINTS_EXISTS`; "Pontos iniciais lançados: N" reflete a soma; `?convidar=true` abre o modal com o código mascarado sem importar de `features/settings`; `?perfil=` abre o modal por URL; seção "Pendentes" lista os cadastros `pending` (nome, e-mail, data) mesmo **sem temporada ativa**, "Aprovar" chama `admin_update_profile({status:'active'})` e some da lista com toast, "Recusar" pede confirmação e chama `{status:'inactive'}`; ambos invalidam bootstrap (badge some) e `admin` (`pending_count`); `?pendentes=true` rola até a seção; pendente aparece na tabela com pílula "Pendente" e sem ações de pontos |
| WP7 | Lançar por regra exige valor quando `requires_amount`; data futura > 5 min bloqueada; `MILESTONE_ALREADY_AWARDED` mostrado; estorno aparece no histórico como `is_reversed`; encerrar temporada mostra resumo com campeão e, com `gap_until_next_season`, o botão "Antecipar início da próxima" chama `update_season`; "Ativar" fica desabilitado com tooltip "Começa em DD/MM" para temporada futura e `SEASON_NOT_STARTED` é exibido pelo catálogo; alerta "temporada terminou — crie/ative a próxima" quando `ends_at < now`; evento sobreposto mostra `EVENT_OVERLAP` do catálogo (nunca `23P01`) e `EVENT_RANGE_INVALID` para fim ≤ início; fuso desabilitado após o primeiro lançamento e `TIMEZONE_LOCKED` exibido; toggle `rank_admins` salva por `update_app_settings` e o ranking reflete após invalidar bootstrap/profiles; toggle "Aprovar novos membros automaticamente" salva `auto_approve_members` por `update_app_settings`, mostra o aviso sobre confirmação de e-mail e reflete em `useAppSettings` após invalidar; código da equipe copia para a área de transferência |
| WP8 | Contraste AA em ambos os temas (relatório axe sem violações críticas); `Tab` percorre sidebar → topbar → conteúdo; `Esc` fecha modais/drawer; capturas em `docs/spec/qa/{dark,light}/*.png` para as 18 rotas |

---

## 8. Vercel, `vercel.json`, variáveis e `.env.example`

### 8.1 `vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    },
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```
- O rewrite SPA é **obrigatório** (deep link `/admin/equipe` recarregado). Assets em `dist/assets` são servidos antes do rewrite.
- CSP fica fora do `vercel.json` na v1 (Supabase Realtime usa WebSocket para `wss://<ref>.supabase.co`; Storage público carrega imagens de `https://<ref>.supabase.co`). Se adotar, `connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co; img-src 'self' data: https://<ref>.supabase.co`.

### 8.2 Variáveis de ambiente (Project → Settings → Environment Variables; Production **e** Preview)

| Nome | Valor | Observação |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | chave pública (RLS protege); **nunca** `sb_secret_`/`service_role` |
| `VITE_APP_NAME` (opcional) | `Orbion Sales League` | título/`<title>`; default no código |

Após alterar variáveis → **Redeploy** (não se aplica a deployments anteriores). Node.js Version = 22.x. Framework Preset = Vite (fixado também no JSON). Plano: uso comercial exige **Pro** (pesquisa §1.7).

Supabase (Authentication → URL Configuration): Site URL = `https://<app>.vercel.app` (ou domínio); Redirect URLs = `http://localhost:5173/**`, `https://<app>.vercel.app/**`, `https://*-<team>.vercel.app/**`.

Supabase (Authentication → Providers → Email e Authentication → Emails → SMTP Settings) — política alinhada a DATA-MODEL §16.1–16.2 e ao manual de deploy:
- **O gate de entrada é a aprovação do gestor** (DATA-MODEL B.21): novo colaborador nasce `pending` e não lê nada até ser aprovado em Equipe › Pendentes. Por isso **"Confirm email" é OPCIONAL em produção**: desligado, o `signUp` volta com sessão e o app leva para `/aguardando`; ligado, o `/signup` mostra `SignupSuccess` "Confirme seu e-mail" e, após confirmar, o login leva para `/aguardando` do mesmo jeito. Ligar continua recomendado quando há SMTP (evita que um e-mail alheio fique ocupado em `auth.users`).
- **SMTP próprio continua obrigatório em produção** (Resend/SES/SendGrid): "Esqueci a senha" (`resetPasswordForEmail`) só entrega com SMTP próprio — sem ele o Auth só envia para membros da organização Supabase — e, se "Confirm email" estiver ligado, o e-mail de confirmação também depende dele. Sem SMTP: deixe "Confirm email" **desligado** (senão ninguém consegue entrar) e o gestor reseta senhas pelo Dashboard.
- Se o gestor ligar "Aprovar novos membros automaticamente" (`auto_approve_members`), o modelo volta ao antigo (entra ativo na hora) e aí "Confirm email" LIGADO + SMTP passam a ser exigidos, com rotação do `team_code` ao fim do onboarding e revisão da lista de membros — o `MemberApprovalCard` avisa isso ao ligar.
- O primeiro gestor é sempre criado pelo Dashboard (*Add user* + *Auto confirm*) **antes** de publicar a URL (DATA-MODEL §16.1) — independe da política de confirmação.

### 8.3 `.env.example`
```dotenv
# Copie para .env.local (ignorado pelo git). Só variáveis VITE_* chegam ao navegador.
VITE_SUPABASE_URL=https://SEU-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
# Opcional
VITE_APP_NAME=Orbion Sales League
```
`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_SUPABASE_URL?: string; readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string; readonly VITE_APP_NAME?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
```

### 8.4 Build local e CI mínimo
`npm ci && npm run lint && npm run typecheck && npm test && npm run build` (o mesmo comando roda na Vercel via `buildCommand` — lint/test ficam fora do build da Vercel para não bloquear deploy por warning; recomenda-se GitHub Action `ci.yml` com esses 4 passos em PR).

---

## 9. O que o app mostra com o banco sem dados

Contexto: o seed cria só catálogo (temporada do mês com meta 0, 10 regras — inclui "Ligação realizada" para a missão "Fazer 5 ligações" (DATA-MODEL §13.4), 2 roletas com prêmios, 6 conquistas, 7 recompensas). Nenhuma pessoa, lançamento, missão, desafio, fila, resgate, notificação. O primeiro usuário é o gestor. Todo `EmptyState` tem `adminHint` (só admin vê) apontando a ação seguinte.

| Tela | Estado vazio (todos veem) | `adminHint` / CTA (só gestor) |
|---|---|---|
| Visão geral (colaborador, 0 pontos) | LevelHero "Nível 0 · 0 pontos · faltam 400 para o nível 1"; StatCards "0 pts", "—" (sem posição quando `rank` null), "🔥 0 dias", "🪙 0"; SalesTarget "Sua meta ainda não foi definida" (goal 0) ou "R$ 0 de R$ X"; NextReward (B.6) "Faltam 500 moedas para R$ 20 iFood"; RankingPreview "Você é o único no ranking por enquanto"; EventBanner "Nenhum evento especial agendado"; MissionPreview "Sem missões para hoje"; Feed "Ainda não há atividade — as vendas e conquistas do time aparecem aqui" | — |
| Visão do gestor (só o admin cadastrado) | Métricas "R$ 0 / meta não definida", "0 vendas", "0 pontos · 1 ativo", "Fila: 0"; tabela com 1 linha (o próprio gestor) ou "Nenhum colaborador ainda"; Top 3 "Aguardando os primeiros pontos"; Saúde "— (sem reuniões registradas)" | Card de onboarding com 4 passos e links: "Defina a meta do time" (`/admin/configuracoes?aba=temporadas`), "Compartilhe o código da equipe" (`?aba=codigo`), "Lance a primeira venda" (`/admin/pontuacao?aba=lancar`), "Crie a primeira missão" (`/missoes`) |
| Sem temporada ativa (seed apagado ou temporada encerrada) | Banner vermelho fixo na topbar "Sem temporada ativa" para admin; colaborador vê "A próxima temporada ainda não começou" nas telas de ranking/missões/dashboard | CTA "Criar/ativar temporada" → `/admin/configuracoes?aba=temporadas`. Lançamentos ficam desabilitados com aviso `NO_ACTIVE_SEASON` |
| Ranking | Pódio com 1º = única pessoa; 2º/3º "vaga em aberto"; lista com "Você" | "Convide o time com o código da equipe" |
| Missões | "Nenhuma missão para hoje/semana/especial" ; LightningMission "Sem missão relâmpago hoje" | botão "Nova missão" no `EmptyState` |
| Desafios | "Nenhum desafio em andamento" (ilustração VS) | "Novo desafio"; manager list "Nenhum desafio criado" |
| Roleta | Roda funciona (prêmios do seed), status "GIRO LIVRE", botão "GIRAR ROLETA" (giro livre sem crédito, aviso no modal); fila "Ninguém na fila"; histórico "Nenhuma aprovação ainda" | painel da fila com "Adicionar à fila" habilitado |
| Recompensas | Carteira "0 Orb Coins · como ganhar moedas: vendas, missões, metas" (as 3 métricas mostram +0); últimos créditos "Nenhum crédito ainda"; loja completa (7 itens) com "Faltam N moedas" em todos; pedidos "Você ainda não resgatou nada" | admin: catálogo populado; pedidos "Nenhum pedido pendente" |
| Conquistas | 6 cards bloqueados, "0 de 6 desbloqueadas" | "Edite pontos/moedas das conquistas" (v2; na v1 só leitura) |
| Perfil | stats "R$ 0 · 0 · — · —"; mini-grid tudo bloqueado; botão "Editar perfil" | — |
| Admin › Dashboard | 6 métricas zeradas com "meta não definida"; gráficos substituídos por `EmptyState` "Sem lançamentos na temporada — lance a primeira venda"; indicadores "—/meta"; barra operacional "1 colaborador · 0 pontos · 0 lançamentos" | "Lançar pontos" |
| Admin › Equipe | tabela com o gestor; "Ainda só você aqui"; seção "Pendentes" oculta (aparece com o primeiro cadastro: "Cadastros aguardando aprovação (1)" + Aprovar/Recusar) | modal "Como adicionar colaboradores" (código + instrução de cadastro + frase "Você aprova cada cadastro em Pendentes") |
| Admin › Pontuação | regras (10 do seed); lançar: seletor de colaborador lista só o gestor; histórico "Nenhum lançamento ainda" | — |
| Admin › Recompensas | catálogo (7) ; pedidos "Nenhum pedido" | — |
| Admin › Roleta | 6 + 8 prêmios editáveis | — |
| Admin › Configurações | empresa "Orbion", XP 400, "Gestores participam do ranking" ligado, fuso editável (0 lançamentos), temporada do mês (meta R$ 0 → destaque "defina a meta"), eventos "Nenhum evento", código gerado, "Aprovar novos membros automaticamente" **desligado** | checklist de implantação embutida (mesma do guia) |
| `/aguardando` (colaborador recém-cadastrado) | "Seu cadastro está aguardando aprovação do gestor" + "Verificar novamente" + "Sair" (sem sidebar/topbar) | — |
| Notificações | "Sem notificações" | — |

---

## Apêndice A — identidade visual a preservar (extraída do Lovable)

- Fundo `#07111F` com brilho radial verde no topo-esquerdo; sidebar `rgba(9,21,34,.95)` com blur; topbar `#07111F/80` com blur; cards `linear-gradient(145deg, rgba(17,31,48,.96), rgba(13,27,42,.96))`, borda `rgba(255,255,255,.075)`, raio 22 px, sombra `0 18px 50px rgba(0,0,0,.12)`; modais `#0D1B2A` raio 24–28 px, backdrop `#020710/80` + blur.
- Acento verde `#00E887` (hover `#00FF9C`, texto sobre verde `#07111F`), dourado `#FFC83D`, azul `#4776FF` (soft `#7396FF`), roxo `#855CFF` (soft `#B49BFF`), vermelho `#FF5252` (soft `#FF7272`), ciano `#27C2FF`, bronze do pódio `#D49A72`, cinzas `#CBD5E1/#94A3B8/#64748B/#475569/#334155`.
- Tipografia: pesos 800–950 em títulos e números (`font-black`), eyebrows 10–11 px uppercase com `tracking 0.18–0.26em`, números grandes 36–48 px, mono para contadores.
- Padrões: `Badge` pílula 9 px uppercase; `Progress` com gradiente (`#00E887→#00FF9C`, `#FFC83D→#FFE08B`, `#FF5252→#FF7A7A`) e glow opcional; `Avatar` quadrado arredondado (raio 16 px) com gradiente da cor da pessoa e iniciais escuras; `StatCard` com ícone colorido em tile `18 %` de opacidade e seta no hover; hover `-translate-y-1` em cards.
- Cards tonais: LevelHero (verde `#102A28→#0D1B2A→#111F30`, glow verde), NextReward (dourado `#241F14→#151D29`), EventBanner (vermelho `#35161D→#111F30`), LightningMission (roxo `#261D43→#111F30`), TeamChallenge (vermelho `#25161B→#111F30`), carteira (verde), Premium wheel panel (`radial-gradient(circle at top, #352A12, #111F30 50%)`), Classic wheel panel (`#172C56`).
- Roleta: borda 12 px `#111C29`, anel externo com traços brancos (`repeating-conic-gradient`), anel interno fino, centro 96 px com gradiente navy + ícone dourado (premium) / azul (clássica) + "GIRE"; ponteiro branco 50 px no topo com triângulo; setores premium `#FFC83D, #855CFF, #14293B, #00E887, #FFC83D, #4776FF, #192A39, #FF5252` e clássica `#4776FF, #14293B, #00E887, #203650, #855CFF, #162A3D` (fallback quando `wheel_prizes.color` é nulo); rótulos verticais em `writing-mode: vertical-rl` girados por setor; giro 8,2 s `cubic-bezier(0.04, 0.82, 0.12, 1)` + 10 voltas; setor vencedor pisca em verde; status em pílula sob a roda; confete de 22–24 peças em 5 cores caindo 2,6 s.
- Pódio: 1º no centro (h-32, dourado, avatar xl com glow `0 0 40px rgba(255,200,61,.18)`), 2º à esquerda (h-24, prata), 3º à direita (h-20, bronze); medalhas 🥇🥈🥉 sobre o avatar.
- Toast: pílula `#0D1B2A` com borda verde `20 %`, ícone check verde, centralizada embaixo (acima do bottom nav no mobile).
- Light: fundo `#F4F7FB`, cards `#fff` com borda `#DFE7F0`, texto `#0F172A`, verde escurecido `#00B86B` para contraste.

Os arquivos originais ficam arquivados em `docs/spec/legacy/` (`gamification.css`, `wheel-experience.css`, `theme.css`) para consulta de valores; nada deles é importado pelo app.

## Apêndice B — checklist de integração final (onda 3)

1. `git merge` dos 9 pacotes sem conflito (ownership respeitada); `handoffs/*.md` resolvidos ou convertidos em issues.
2. `npm ci && npm run lint && npm run typecheck && npm test && npm run build` — build < 60 s, `dist/assets/index-*.js` gzip < 300 kB (recharts em chunk próprio da rota `/admin`).
3. Banco recém-instalado: percorrer as 18 rotas como admin recém-cadastrado e como colaborador (segundo cadastro com código) — nenhuma tela quebra, nenhuma requisição 4xx inesperada no Network.
4. Fluxos ponta a ponta (DATA-MODEL §14): 14.1 cadastro → `/aguardando` → gestor vê badge e aprova em Equipe › Pendentes → "Verificar novamente" entra no app (e o caminho "Recusar"; e com `auto_approve_members` ligado entra direto); 14.2 venda + estorno; 14.3 missão relâmpago → fila; 14.4 liberar → girar (em duas abas) → aprovar / rejeitar / convidado / giro livre; 14.5 resgate → aprovar → entregar / cancelar; 14.7 evento (criado por `save_special_event`; sobreposição → `EVENT_OVERLAP`; banner upcoming → live → some; multiplicador visível no histórico "100 × 2"); 14.8 criar → encerrar (com aviso `gap_until_next_season` e antecipação) → ativar temporada (só a partir de `starts_at`); 14.1 passo 7 pontos iniciais (`record_initial_points`, segunda vez → `INITIAL_POINTS_EXISTS`).
5. Realtime: notificação chega sem reload; fila e roleta sincronizam entre duas sessões; feed atualiza o dashboard do colaborador quando o gestor lança.
6. Tema: alternar em cada rota, recarregar (persistiu), abrir em aba nova (sincronizou).
7. Mobile (375): drawer, bottom nav, roda 350 px, modais roláveis, tabelas em cards.
8. Deploy Preview na Vercel com env de staging; deep link `/admin/equipe?perfil=<id>` recarregado funciona; `robots.txt` `Disallow: /`.
