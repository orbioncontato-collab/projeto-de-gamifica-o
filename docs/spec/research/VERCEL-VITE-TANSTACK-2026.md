# Pesquisa: Vercel + Vite SPA + TanStack Router + Tailwind v4 (estado em setembro/2026)

> Data da pesquisa: 15/09/2026. Fontes: docs oficiais (vercel.com/docs, vite.dev, tanstack.com via repositório GitHub `TanStack/router`, tailwindcss.com, lucide.dev, wiki do recharts) e registro npm (`registry.npmjs.org`, consultado em 15/09/2026).
> Decisões já tomadas e NÃO reabertas aqui: Vite SPA sem SSR; remover TanStack Start/Nitro/Lovable; Supabase como único backend; deploy na Vercel.
> Itens marcados com **[NÃO VERIFICADO]** não puderam ser confirmados em fonte primária e devem ser checados antes de virar regra.

---

## 0. Resumo executivo

| Tema | Decisão recomendada |
|---|---|
| Build | Vite **8.3.0** (Rolldown), `@vitejs/plugin-react` **6.1.1**, Node **20.19+ / 22.12+** |
| Router | `@tanstack/react-router` **1.170.36** + `@tanstack/router-plugin` **1.168.38** (file-based, `src/routes`, `routeTree.gen.ts`) |
| Dados | `@tanstack/react-query` **5.102.8** + `@supabase/supabase-js` **2.116.0** |
| CSS | `tailwindcss` + `@tailwindcss/vite` **4.3.3**, config CSS-first (`@theme`), tema via `html[data-theme]` |
| Gráficos / ícones | `recharts` **3.10.1** (migrar de 2.15), `lucide-react` **1.46.0** (migrar de 0.575) |
| TypeScript | `typescript` **~6.0.3** (o template oficial do Vite usa `~6.0.2`; a tag `latest` do npm é 7.0.2, port nativo em Go) |
| Deploy | Vercel, preset **Vite** (auto-detectado), `vite build` → `dist`, `vercel.json` com rewrite SPA obrigatório |
| Plano Vercel | Uso comercial exige **Pro** (política citada literalmente na seção 1.7) |

---

## 1. Vercel

### 1.1 Importar repositório GitHub
Fonte: https://vercel.com/docs/git/vercel-for-github (atualizado 2026-08-11) e https://vercel.com/docs/git#deploying-a-git-repository

- Fluxo: dashboard → **Add New… → Project → Import Git Repository** → escolher o repo → Vercel detecta o framework → **Deploy**.
- "Vercel for GitHub will **deploy every push by default**. This includes pushes and pull requests made to branches."
- Branch de produção: "pushes and merges to the Production Branch (commonly `main`) will be made live to those domains".
- Cada PR ganha uma Preview URL única com comentário automático no PR.
- Permissão necessária: para repositório pessoal você precisa ser **Owner**; em organização, Owner ou Member com acesso ao repo (Outside Collaborator não consegue importar).
- Fork protection: PRs vindos de fork exigem autorização manual antes de fazer deploy (protege as env vars).

### 1.2 Preset de framework e build
Fonte: https://vercel.com/docs/builds/configure-a-build (2026-08-28) e https://vercel.com/docs/frameworks/frontend/vite (2026-08-26)

- "In several use cases, Vercel automatically detects your project's framework and sets the best settings for you." O preset **Vite** existe na lista oficial ("Vite is a new breed of frontend build tool…").
- Com o preset Vite, os valores padrão são: Build Command `vite build` (ou o script `build` do package.json), Output Directory **`dist`**, Install Command auto-detectado pelo lockfile (npm/pnpm/yarn/bun). **[NÃO VERIFICADO na página, mas consistente com o comportamento documentado: "If Vercel detects a framework, the output directory will automatically be configured."]**
- Atenção: o package.json atual contém `@tanstack/react-start` e `nitro`; enquanto esses pacotes existirem, a Vercel pode detectar **"TanStack Start"** (há preset específico, inclusive "TanStack Start … imported from Lovable") em vez de "Vite". Removê-los ANTES do primeiro import garante a detecção como Vite. Se necessário, forçar no `vercel.json`: `{ "framework": "vite" }` ou via Settings → Build & Deployment → Framework Preset.
- Override por deployment: `buildCommand`, `outputDirectory`, `framework` em `vercel.json`.
- Node.js: Vite 8 exige `^20.19.0 || >=22.12.0` (campo `engines` do pacote `vite@8.3.0`). Confirmar em Settings → Node.js Version que está em 20.x ou 22.x. **[NÃO VERIFICADO: qual é o default atual da Vercel — checar no painel]**
- Máquina de build no Hobby: 2 vCPUs, 8 GB RAM, disco 32 GB.

### 1.3 Variáveis de ambiente
Fonte: https://vercel.com/docs/environment-variables (2026-08-20) e https://vite.dev/guide/env-and-mode

- Onde: Project → **Settings → Environment Variables**; escolher os ambientes **Production / Preview / Development** (e Custom).
- Citação literal: "Any change you make to environment variables are not applied to previous deployments, they only apply to new deployments." → **Após alterar uma variável é obrigatório fazer um novo deploy (Redeploy).**
- Vite só expõe ao cliente variáveis com prefixo `VITE_`: "Variables prefixed with `VITE_` will be exposed in client-side source code after Vite bundling." Elas são "statically replaced at build time".
- Portanto, na Vercel as chaves devem ser `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`), lidas via `import.meta.env.VITE_SUPABASE_URL`. A anon/publishable key do Supabase é pública por design (segurança vem do RLS) — nunca colocar `service_role` em `VITE_*` ("`VITE_*` variables should not contain sensitive information").
- Doc da Vercel sobre Vite: "To access Vercel's System Environment Variables in Vite during the build process, prefix the variable name with `VITE`" (ex.: `VITE_VERCEL_ENV`).
- Local: `.env.local` (ignorado no git) ou `vercel env pull` para gerar `.env`.
- Limite: 64 KB total por deployment.

### 1.4 Fallback SPA (rewrite) — obrigatório
Fonte: https://vercel.com/docs/frameworks/frontend/vite → seção "Using Vite to make SPAs"

Citação literal: "If your Vite app is configured to deploy as a Single Page Application (SPA), deep linking won't work out of the box. To enable deep linking in SPA Vite apps, create a `vercel.json` file at the root of your project, and add the following code:"

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- **Resposta à pergunta "a Vercel já faz isso sozinha para o preset Vite?": NÃO.** A documentação oficial (agosto/2026) continua exigindo o `vercel.json` explícito. O guia "deploy-to-production" do TanStack Router repete exatamente o mesmo `vercel.json`.
- Arquivos estáticos existentes em `dist/` (JS, CSS, imagens) são servidos antes do rewrite (comportamento "filesystem first"), então o rewrite não quebra assets. **[NÃO VERIFICADO em citação literal nesta pesquisa; comportamento histórico da plataforma]**
- Nota da doc: se `cleanUrls: true` estiver no `vercel.json`, usar `"destination": "/"` em vez de `/index.html`.

### 1.5 Domínio customizado
Fonte: https://vercel.com/docs/domains/working-with-domains/add-a-domain (2026-08-28)

- Project → **Settings → Domains → Add Domain**.
- Apex (`exemplo.com.br`) → registro **A** (a doc atual mostra o valor no painel; KB cita `76.76.21.21`); subdomínio (`app.exemplo.com.br`) → **CNAME** único por projeto (ex.: `xxxx.vercel-dns-017.com`, valor mostrado no painel); alternativa: nameservers da Vercel.
- SSL é automático após verificação. Ao adicionar apex, a Vercel sugere também `www`.
- "Hobby teams have a limit of 50 custom domains per project."

### 1.6 Limites do plano Hobby (gratuito)
Fonte: https://vercel.com/docs/plans/hobby (2026-08-31)

| Recurso | Hobby |
|---|---|
| Fast Data Transfer (banda CDN) | 100 GB/mês |
| Fast Origin Transfer | 10 GB/mês |
| Edge Requests | 1.000.000/mês |
| Function Invocations | 1.000.000/mês (irrelevante: SPA sem functions) |
| Projetos | 200 |
| Domínios por projeto | 50 |
| Deployments por dia | 100 |
| Build | 2 vCPU, 8 GB, 32 GB disco |
| Colaboração em time | não ("Team collaboration features: -") |
| Suporte por e-mail | não |
| Runtime logs | 1 hora |
| Web Analytics | 50.000 eventos/mês |

- "As the Hobby plan is a free tier there are no billing cycles. In most cases, if you exceed your usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can use the feature again."

### 1.7 Cláusula de uso comercial do Hobby — citação literal
Fonte: https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage (2026-07-29) e https://vercel.com/docs/plans/hobby

> "**Hobby teams** are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan."
>
> "Commercial usage is defined as any Deployment that is used for the purpose of financial gain of **anyone** involved in **any part of the production** of the project, including a paid employee or consultant writing the code. Examples of this include, but are not limited to, the following:
> - Any method of requesting or processing payment from visitors of the site
> - Advertising the sale of a product or service
> - Receiving payment to create, update, or host the site
> - Affiliate linking is the primary purpose of the site
> - The inclusion of advertisements, including but not limited to online advertising platforms like Google AdSense"
>
> "Asking for Donations **does not** fall under commercial usage."
>
> (página Hobby) "As stated in the fair use guidelines, the Hobby plan restricts users to non-commercial, personal use only."

**Implicação para a Orbion Sales League:** é uma ferramenta interna de uma empresa (Orbion) usada por funcionários para operação comercial, e provavelmente desenvolvida/hospedada mediante pagamento. Isso se enquadra em "financial gain of anyone involved" e "Receiving payment to create, update, or host the site". **Recomendação: publicar em um time Vercel no plano Pro** (US$ 20/usuário/mês por seat Developer; seats Viewer são gratuitos, conforme a página Hobby → "Upgrading to Pro"). Se houver dúvida, a própria Vercel pede para contatar o suporte. Existe trial do Pro.

---

## 2. Vite + React 19 + TypeScript (SPA pura)

Fonte: https://vite.dev/guide/ (mostra v8.3.0), https://vite.dev/blog/announcing-vite8, https://vite.dev/guide/migration, template oficial `packages/create-vite/template-react-ts` (GitHub, main), npm.

### 2.1 Versões (npm, 15/09/2026)
| Pacote | `latest` | Publicado | Observação |
|---|---|---|---|
| `vite` | **8.3.0** | 2026-09-10 | tag `previous` = 7.3.6. Vite 8 lançado em 12/03/2026, **estável** |
| `create-vite` | 9.2.1 | 2026-09-10 | |
| `@vitejs/plugin-react` | **6.1.1** | 2026-08-28 | peer `vite ^8.0.0`; 6.0.0 (12/03/2026) removeu Babel: "Vite 8+ can handle React Refresh Transform by Oxc and doesn't need Babel for it." |
| `react` / `react-dom` | **19.3.0** | 2026-09-09 | template do Vite usa `^19.2.8`; recomendar `^19.2.0` ou subir para 19.3 |
| `typescript` | `latest` = 7.0.2 (nativo/Go); 6.x = 6.0.3; 5.x = 5.9.3 | | template do Vite fixa **`~6.0.2`**. O exemplo oficial do TanStack instala `typescript: npm:@typescript/typescript6@^6.0.2` e `@typescript/native: npm:typescript@^7.0.2` lado a lado. **[NÃO VERIFICADO: compatibilidade de todas as ferramentas (typescript-eslint, editores) com TS 7]** → usar **`~6.0.3`** |

### 2.2 O que `npm create vite@latest` gera hoje (template `react-ts`)
```json
{
  "scripts": { "dev": "vite", "build": "tsc -b && vite build", "lint": "oxlint", "preview": "vite preview" },
  "dependencies": { "react": "^19.2.8", "react-dom": "^19.2.8" },
  "devDependencies": {
    "@types/node": "^24.13.3", "@types/react": "^19.2.18", "@types/react-dom": "^19.2.7",
    "@vitejs/plugin-react": "^6.1.1", "oxlint": "^1.81.0", "typescript": "~6.0.2", "vite": "^8.3.0"
  }
}
```
```ts
// vite.config.ts (template oficial)
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
export default defineConfig({ plugins: [react()] })
```
- Só existem `template-react` e `template-react-ts` (o antigo `react-swc-ts` não existe mais; o guia cita `react-compiler-ts` como variante). O plugin SWC ficou desnecessário porque o transform é feito pelo Oxc do Rolldown.
- Node: "Vite requires Node.js version 20.19+, 22.12+."

### 2.3 Vite 8 — fatos relevantes
- "Vite 8 ships with Rolldown as its single, unified, Rust-based bundler" (esbuild e Rollup saíram).
- Migração: `build.rollupOptions` → `build.rolldownOptions`; "esbuild is now deprecated … migrate to oxc"; "Lightning CSS is now used for CSS minification by default"; targets de browser subiram (Chrome 111, Safari 16.4 = Baseline Widely Available).
- O package.json atual tem `overrides: { "rolldown": "1.2.1" }` — **remover**; `vite@8.3.0` depende de `rolldown ~1.2.6`.

### 2.4 Estrutura mínima da SPA
- `index.html` **na raiz do projeto** (hoje o repo NÃO tem `index.html` porque o Start gerava o HTML no servidor — precisa ser criado): "in a Vite project, index.html is front-and-central instead of being tucked away inside public … index.html is the entry point to your application."
- `src/main.tsx` → `createRoot` + `RouterProvider`.
- `import.meta.env.VITE_*` para config pública; `import.meta.env.MODE`, `DEV`, `PROD` embutidos.
- `tsconfig.json`: manter `"types": ["vite/client"]` (já existe) para tipar `import.meta.env`; opcionalmente `src/vite-env.d.ts` com `interface ImportMetaEnv { readonly VITE_SUPABASE_URL: string; ... }`.

---

## 3. TanStack Router (file-based) em Vite SPA — sem Start

Fonte: `docs/router/installation/with-vite.md`, `routing/file-naming-conventions.md`, `guide/authenticated-routes.md`, `guide/search-params.md`, `how-to/deploy-to-production.md` e exemplos `examples/react/quickstart-file-based`, `authenticated-routes`, `basic-react-query-file-based` (repositório TanStack/router, branch main, lidos em 15/09/2026).

### 3.1 Versões (npm, 15/09/2026)
| Pacote | `latest` | Publicado | Peer/notas |
|---|---|---|---|
| `@tanstack/react-router` | **1.170.36** | 2026-09-13 | peer react >=18; o repo já está em 1.170.18 |
| `@tanstack/router-plugin` | **1.168.38** | 2026-09-13 | peer `@tanstack/react-router ^1.170.36`, `vite >=8` ok; depende internamente de `zod ^4.5.4` |
| `@tanstack/react-router-devtools` | ^1.167.2 (usado no exemplo oficial) | | opcional, só dev |
| `@tanstack/react-query` | **5.102.8** | 2026-08-27 | v5 continua a linha estável |
| `@tanstack/zod-adapter` | — | | só necessário para **zod v3**; com zod v4 (Standard Schema) `validateSearch` aceita o schema direto **[NÃO VERIFICADO na doc atual — a doc diz apenas "The @tanstack/zod-adapter package is required when using Zod v3"]** |

Os números de versão de `react-router` (1.170.x) e `router-plugin` (1.168.x) **não são iguais e isso é normal** — cada pacote versiona independentemente; o que importa é o peer range do plugin.

### 3.2 Instalação e `vite.config.ts` (citação do doc oficial)
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    // ...
  ],
})
```
Para o projeto, acrescentar `tailwindcss()` (`@tailwindcss/vite`) e, se mantiver o alias `@/`, `tsconfigPaths()` (`vite-tsconfig-paths`) ou `resolve.alias`.

Defaults do plugin (doc):
```json
{ "routesDirectory": "./src/routes", "generatedRouteTree": "./src/routeTree.gen.ts", "routeFileIgnorePrefix": "-", "quoteStyle": "single" }
```
- `routeTree.gen.ts` é gerado/atualizado automaticamente pelo plugin (dev e build). Doc recomenda ignorar no Prettier/ESLint e marcar como readonly no VSCode. O arquivo atual do repo tem um bloco `declare module '@tanstack/react-start'` — será regenerado sem ele assim que o Start sair.

### 3.3 `main.tsx` (exemplo oficial `quickstart-file-based`, adaptado com React Query do exemplo `basic-react-query-file-based`)
```tsx
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import './styles.css'

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0, // React Query cuida do cache
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

const rootElement = document.getElementById('app')!
if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}
```
`__root.tsx` na SPA usa `createRootRouteWithContext<{ queryClient: QueryClient; auth: AuthState }>()` + `<Outlet />`. **Não** usar `HeadContent`/`Scripts`/`appCss?url` (são do Start/SSR — o `__root.tsx` atual usa isso e precisa ser reescrito).

### 3.4 Convenções de nome de arquivo (tabela oficial)
| Recurso | Descrição |
|---|---|
| `__root.tsx` | rota raiz, obrigatória em `routesDirectory` |
| `.` separador | `blog.post.tsx` → filho de `blog` |
| `$` token | segmento dinâmico → `param` |
| `_` prefixo | **pathless layout route** — não entra na URL |
| `_` sufixo | exclui a rota do aninhamento no pai |
| `-` prefixo | arquivo/pasta ignorados no route tree (colocar componentes ao lado das rotas) |
| `(pasta)` | route group, não entra na URL |
| `index` | casa exatamente com o pai (`/`) |
| `route.tsx` | arquivo de rota de um diretório |

Exemplo do doc: `_app.tsx` (layout pathless) + `_app.a.tsx` → `/a` renderiza `<Root><App><A>`.

### 3.5 Guarda de autenticação com layout pathless (doc + exemplo `authenticated-routes`)
```tsx
// src/routes/_app.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: () => <Outlet />,
})
```
- Doc: "The `beforeLoad` function for a route is called before any of its child routes' `beforeLoad` functions. It is essentially a middleware function for the route and all of its children."
- Contexto: `createRootRouteWithContext<{ auth: AuthState }>()`, `createRouter({ routeTree, context: { auth: undefined! } })` e um `InnerApp` que faz `<RouterProvider router={router} context={{ auth }} />` com o `auth` vindo de um hook (no nosso caso, sessão do Supabase). Após login/logout chamar `router.invalidate()` (o exemplo oficial faz isso no logout).
- Para o papel (gestor/colaborador) usar um segundo layout pathless, ex. `_app/_admin.tsx`, com `beforeLoad` que lança `redirect({ to: '/' })` se `context.auth.profile.role !== 'admin'`.
- Estrutura proposta: `routes/__root.tsx`, `routes/login.tsx`, `routes/signup.tsx`, `routes/_app.tsx`, `routes/_app/index.tsx` (Visão geral), `_app/ranking.tsx`, `_app/missoes.tsx`, `_app/desafios.tsx`, `_app/roleta.tsx`, `_app/recompensas.tsx`, `_app/conquistas.tsx`, `_app/perfil.tsx`, `_app/_admin.tsx`, `_app/_admin/admin/index.tsx`, `_app/_admin/admin/equipe.tsx`, `_app/_admin/admin/pontuacao.tsx`, `_app/_admin/admin/configuracoes.tsx`, `_app/_admin/admin/guia.tsx`.

### 3.6 Search params (doc `guide/search-params.md`)
```tsx
export const Route = createFileRoute('/_app/missoes')({
  validateSearch: (search: Record<string, unknown>) => ({
    filtro: (search.filtro as 'hoje' | 'semana' | 'especiais') ?? 'hoje',
  }),
})
const { filtro } = Route.useSearch()
<Link from={Route.fullPath} search={(prev) => ({ ...prev, filtro: 'semana' })}>Semana</Link>
```
Com zod v3 usar `zodValidator` de `@tanstack/zod-adapter`; o repo está em `zod ^3.25.76` — avaliar subir para **zod 4** (o exemplo oficial usa `zod ^4.4.3`) e passar o schema direto.

### 3.7 `Link`
`<Link to="/ranking" activeProps={{ className: 'font-bold' }} activeOptions={{ exact: true }}>` (exemplo oficial em `__root.tsx`); também expõe `data-status="active"` para estilizar via Tailwind (`data-[status=active]:font-semibold`).

### 3.8 Deploy (doc `how-to/deploy-to-production.md`, seção "Vercel Deployment")
Passo 1 é literalmente criar `vercel.json` com `rewrites [{ source: "/(.*)", destination: "/index.html" }]`. O passo "For TanStack Start (SSR)" não se aplica.

---

## 4. Tailwind CSS v4 com `@tailwindcss/vite`

Fonte: https://tailwindcss.com/docs/installation/using-vite, https://tailwindcss.com/docs/theme, https://tailwindcss.com/docs/dark-mode; npm.

- Versões: `tailwindcss` e `@tailwindcss/vite` **4.3.3** (2026-07-16); peer `vite ^5.2.0 || ^6 || ^7 || ^8`. `tailwind-merge` 3.7.0, `tw-animate-css` já presente (1.3.4).
- Instalação oficial:
```bash
npm install tailwindcss @tailwindcss/vite
```
```ts
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [tailwindcss()] })
```
```css
@import "tailwindcss";
```
- Sem `tailwind.config.js` e sem PostCSS: configuração **CSS-first**.
- `@theme` cria tokens que viram utilitários: "Theme variables aren't just CSS variables — they also instruct Tailwind to create new utility classes". Namespaces: `--color-*` → `bg-/text-/border-…`, `--font-*`, `--text-*`, `--spacing-*`, `--breakpoint-*`.
- `@theme inline`: "Using the `inline` option, the utility class will use the theme variable value instead of referencing the actual theme variable" — é o padrão para tokens que apontam para variáveis definidas em `:root`/`[data-theme]` (padrão shadcn v4).
- Dark mode por atributo (citação exata da doc):
```css
@import "tailwindcss";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

### 4.1 Padrão recomendado para os tokens do inventário (`--bg`, `--card`, `--text`, `--muted`, `--accent`) com `html[data-theme]`
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* valores por tema: variáveis CSS normais (NÃO geram utilitários) */
:root, html[data-theme="light"] {
  --bg: oklch(0.985 0 0);
  --card: oklch(1 0 0);
  --text: oklch(0.2 0 0);
  --muted: oklch(0.55 0 0);
  --accent: oklch(0.72 0.17 150); /* verde Orbital */
}
html[data-theme="dark"] {
  --bg: oklch(0.15 0.01 260);
  --card: oklch(0.2 0.01 260);
  --text: oklch(0.97 0 0);
  --muted: oklch(0.7 0 0);
  --accent: oklch(0.78 0.17 150);
}

/* mapeia para utilitários: bg-bg, bg-card, text-text, text-muted, bg-accent… */
@theme inline {
  --color-bg: var(--bg);
  --color-card: var(--card);
  --color-text: var(--text);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
}
```
- Dark é o padrão do produto: o `ThemeController` deve gravar `data-theme` em `document.documentElement` antes do primeiro paint (script inline no `index.html` lendo `localStorage`) e persistir a escolha. Nenhum `!important` sobre classes arbitrárias.
- shadcn/ui v4 já usa exatamente este esquema (`:root` + `.dark` + `@theme inline`); basta trocar o seletor `.dark` por `html[data-theme="dark"]` (ou manter `.dark` e definir `@custom-variant dark` para a classe). O `components.json` atual do repo indica shadcn com Tailwind v4 — verificar `src/styles.css` ao migrar.

---

## 5. recharts e lucide-react

### 5.1 recharts
- npm: **3.10.1** (2026-07-25); 2.x parou em 2.15.4 (versão no repo). Peer: React 16.8–19, `react-is`.
- Migração 2→3 (wiki oficial "3.0 migration guide"): 
  - "`accessibilityLayer` … In 2.x this prop is false by default, in 3.0 it's true by default."
  - "Removal of `ref.current.current` in ResponsiveContainer".
  - "Update `TooltipProps` to `TooltipContentProps` when using `Tooltip`'s `content` prop" (afeta o `chart.tsx` do shadcn — o shadcn já publicou o `chart.tsx` para v3: PR shadcn-ui/ui#8486).
  - "Z-Index of Elements (Tooltip, Legend, chart items, etc.) is determined based upon render order".
  - Remoção de props internas clonadas; TypeScript 5.x+.
- Recomendação: **usar recharts 3.10.1** na reescrita (gráficos: área acumulada, barras por colaborador, linha de pontos) e regenerar `src/components/ui/chart.tsx` com `npx shadcn@latest add chart` (versão compatível com v3). Sem razão para ficar em 2.x num projeto novo.

### 5.2 lucide-react
- npm: **1.46.0** (2026-09-14). O repo está em 0.575.0.
- Lucide v1 (https://lucide.dev/guide/version-1): todos os **ícones de marca removidos** (usar Simple Icons se precisar), **somente ESM e CJS** (UMD removido), `aria-hidden="true"` por padrão, `IconNode` → `LucideIconNode`, `absoluteStrokeWidth` depreciado em favor de `nonScalingStroke`, `LucideProvider` para props padrão. Peer React 16.5–19.
- Recomendação: **lucide-react ^1.46.0**. Revisar nomes de ícones usados nos componentes shadcn gerados (alguns aliases antigos foram removidos ao longo da 0.x, ex. `edit`, `edit-2`). Não usar ícones de marca.

---

## 6. Limpeza do `package.json` atual

Arquivo: `/Users/alves/financeiro dash/gamificacao/package.json` (name `tanstack_start_ts`).

### 6.1 Remover (TanStack Start / Nitro / Lovable)
| Pacote | Onde | Motivo |
|---|---|---|
| `@tanstack/react-start` `1.168.32` | dependencies | framework SSR; traz `start-server-core`, `react-start-server`, `react-start-rsc` etc. |
| `nitro` `3.0.260603-beta` | devDependencies | servidor/adaptador de deploy exigido pelo Start |
| `@lovable.dev/vite-tanstack-config` `^2.20.0` | devDependencies | wrapper que injeta tanstackStart + nitro + devtools + tailwind + tsconfigPaths; seus peers são `nitro`, `@tanstack/react-start`, `vite-tsconfig-paths`, `@tailwindcss/vite`, `@vitejs/plugin-react` |
| `overrides.rolldown = "1.2.1"` | overrides | pin antigo; `vite@8.3.0` já pede `rolldown ~1.2.6` |

Também remover arquivos/código que dependem deles: `vite.config.ts` (reescrever), `src/start.ts` (`createStart`, `createCsrfMiddleware`), `src/server.ts` (`@tanstack/react-start/server-entry`), `src/router.tsx` (`getRouter` do Start → vira `main.tsx`), `src/lib/lovable-error-reporting*`, referência a Start no `eslint.config.js` (linha 30), `bunfig.toml` (`minimumReleaseAgeExcludes` de pacotes `@lovable.dev/*`), `HeadContent`/`Scripts`/`?url` no `__root.tsx`, e o bloco `declare module '@tanstack/react-start'` no `routeTree.gen.ts` (regenerado). Criar `index.html` na raiz.

### 6.2 Manter
`@tanstack/router-plugin` (subir para 1.168.38), `@tanstack/react-router` (1.170.36), `@tanstack/react-query` (5.102.8), `@vitejs/plugin-react` (6.1.1), `@tailwindcss/vite` + `tailwindcss` (4.3.3), `vite-tsconfig-paths` (6.1.1, opcional — pode ser substituído por `resolve.alias`), `vite` (8.3.0), todos os `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `cmdk`, `vaul`, `sonner`, `input-otp`, `embla-carousel-react`, `react-day-picker`, `react-hook-form` + `@hookform/resolvers`, `react-resizable-panels`, `date-fns`, `zod`, `lucide-react` (→ 1.46.0), `recharts` (→ 3.10.1).

### 6.3 Adicionar
`@supabase/supabase-js` **2.116.0** (2026-09-07). Opcional: `@tanstack/react-router-devtools` (dev), `@tanstack/zod-adapter` (só se ficar em zod 3).

### 6.4 shadcn/radix não dependem do Start — confirmado
Verificado no registro npm (dependencies + peerDependencies das versões `latest`): `@radix-ui/react-dialog` 1.1.23, `cmdk` 1.1.1, `vaul` 1.1.2, `sonner` 2.0.8, `class-variance-authority` 0.7.1, `tailwind-merge` 3.7.0 → **nenhum** depende de `@tanstack/*`, `nitro` ou `@lovable.dev/*`. Os pacotes Radix dependem apenas de React e de outros `@radix-ui/*`. O shadcn/ui documenta oficialmente a instalação "Vite + TanStack Router" (`npx shadcn@latest add …`), confirmando que funciona em SPA sem Start.

### 6.5 Exemplo de `package.json` alvo (versões de 15/09/2026)
```json
{
  "name": "orbion-sales-league",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.19.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.116.0",
    "@tanstack/react-query": "^5.102.8",
    "@tanstack/react-router": "^1.170.36",
    "lucide-react": "^1.46.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "recharts": "^3.10.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@tanstack/react-router-devtools": "^1.167.2",
    "@tanstack/router-plugin": "^1.168.38",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.1.1",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.3",
    "vite": "^8.3.0"
  }
}
```
(+ os pacotes de UI listados em 6.2, mantidos nas versões atuais.)

---

## 7. `vercel.json` e `vite.config.ts` finais recomendados

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }), // antes do react()
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
```

---

## 8. Itens NÃO VERIFICADOS (checar antes de fixar como regra)
1. Valor exato do "Build Command"/"Output Directory" exibido pelo preset Vite no painel da Vercel (doc só diz que é configurado automaticamente; `dist` é o default do Vite).
2. Versão default de Node.js nos projetos novos da Vercel em set/2026 (garantir ≥ 20.19 no painel).
3. Comportamento "filesystem first" do rewrite `/(.*)` (assets estáticos servidos antes do fallback) — comportamento histórico, não citado literalmente nas páginas lidas.
4. `validateSearch` aceitando schema zod v4 (Standard Schema) sem `@tanstack/zod-adapter` — inferido da nota "adapter required when using Zod v3".
5. Compatibilidade de `typescript@7.x` (port nativo) com `typescript-eslint`, editores e `tsc -b`; por isso a recomendação conservadora é `~6.0.3`, igual ao template oficial do Vite.
6. Data exata do lançamento de lucide v1 (a página oficial não traz data; a linha 1.x está em 1.46.0 desde 14/09/2026).
7. Se a Vercel detectaria o repo atual como "TanStack Start" por causa de `@tanstack/react-start` no package.json — mitigação: remover os pacotes antes do import e/ou fixar `"framework": "vite"`.
8. Preço de seat Pro (US$ 20/usuário/mês, Viewer gratuito) foi lido na página Hobby "Upgrading to Pro"; confirmar em vercel.com/pricing na hora da contratação.

## 9. Fontes
- https://vercel.com/docs/frameworks/frontend/vite (2026-08-26)
- https://vercel.com/docs/builds/configure-a-build (2026-08-28)
- https://vercel.com/docs/environment-variables (2026-08-20)
- https://vercel.com/docs/routing/rewrites (2026-08-11)
- https://vercel.com/docs/git/vercel-for-github (2026-08-11)
- https://vercel.com/docs/domains/working-with-domains/add-a-domain (2026-08-28)
- https://vercel.com/docs/plans/hobby (2026-08-31)
- https://vercel.com/docs/limits/fair-use-guidelines (2026-07-29)
- https://vite.dev/guide/ · https://vite.dev/guide/env-and-mode · https://vite.dev/guide/migration · https://vite.dev/blog/announcing-vite8
- https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts
- https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md
- https://github.com/TanStack/router/tree/main/docs/router (installation/with-vite.md, routing/file-naming-conventions.md, guide/authenticated-routes.md, guide/search-params.md, how-to/deploy-to-production.md, quick-start.md)
- https://github.com/TanStack/router/tree/main/examples/react (quickstart-file-based, authenticated-routes, basic-react-query-file-based)
- https://tailwindcss.com/docs/installation/using-vite · https://tailwindcss.com/docs/theme · https://tailwindcss.com/docs/dark-mode
- https://github.com/recharts/recharts/wiki/3.0-migration-guide
- https://lucide.dev/guide/version-1
- https://github.com/shadcn-ui/ui (docs/installation/tanstack-router.mdx)
- https://registry.npmjs.org (consultas de `dist-tags`, `time`, `dependencies`, `peerDependencies` em 15/09/2026)
