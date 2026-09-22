# Orbion Sales League

Plataforma de gamificação para equipes comerciais: pontuação por regras, ranking por temporada,
missões, desafios, roleta de prêmios, loja de recompensas e conquistas — com visão do colaborador e
painel do gestor. Interface em português do Brasil.

- **Frontend:** Vite 8 · React 19 · TanStack Router/Query · Tailwind 4 · shadcn/ui · recharts 3
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage) — todo o negócio vive no banco (RPCs, views, RLS)
- **Especificações:** `docs/spec/DATA-MODEL.md` (banco, fonte da verdade), `docs/spec/FRONTEND-ARCH.md`
  (arquitetura do front), `docs/spec/FEATURE-INVENTORY.md` (inventário de telas)

## Requisitos

- Node.js **22.12+** (o projeto é desenvolvido com Node 26) e npm 11
- Um projeto Supabase (plano gratuito basta) com o schema instalado — ver `supabase/README.md`
- Nenhuma dependência local de Docker, Supabase CLI ou psql

## Variáveis de ambiente

Copie `.env.example` para `.env` (ignorado pelo git) e preencha:

| Variável                        | Onde encontrar                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase → Project Settings → API Keys → Project URL                              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → **Publishable key** (`sb_publishable_…`) |

Use sempre a chave _publishable_; nunca a _secret_/`service_role`. Só variáveis com prefixo `VITE_`
chegam ao navegador. Sem essas duas variáveis o app não fica em branco: ele mostra a tela
"O app ainda não está conectado ao Supabase" listando o que falta.

## Rodando localmente

```bash
npm ci            # instala exatamente o package-lock.json
npm run dev       # http://localhost:5173
```

Outros comandos:

| Comando                 | O que faz                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `npm run build`         | `tsc -b` + `vite build` → `dist/`                                                   |
| `npm run typecheck`     | checagem de tipos (`src/` e configs de build)                                       |
| `npm run lint`          | ESLint (inclui a regra "sem cor hex fora de `styles/tokens.css`")                   |
| `npm test`              | vitest (unitários de `src/lib` e componentes compartilhados)                        |
| `npm run test:coverage` | cobertura v8 (meta: 80 % em `src/lib`)                                              |
| `npm run routes:gen`    | regenera `src/routeTree.gen.ts` (o plugin do Vite também faz isso no `dev`/`build`) |
| `npm run preview`       | serve o `dist/` gerado                                                              |

Rota de desenvolvimento: `/dev/showcase` mostra todos os componentes compartilhados nos temas escuro e claro.

## Estrutura

```
src/
  routes/        # arquivos de rota (TanStack Router, file-based); só validam search e chamam a página
  features/      # uma pasta por domínio: api.ts (supabase) · hooks.ts (React Query) · components/
  components/    # ui/ (shadcn) · shared/ (design system do app) · layout/ (shell)
  lib/           # supabase, tipos do banco, formatação pt-BR, regras puras de gamificação
  styles/        # tokens.css (única fonte de cores) · base.css · components.css
supabase/        # migrations, schema.sql gerado e testes PGlite do banco
docs/spec/       # especificações e handoffs entre pacotes de trabalho
```

## Deploy (resumo — o passo a passo completo, com capturas, está no Manual em PDF)

1. **Banco primeiro.** Crie o projeto no Supabase (região São Paulo), cole `supabase/schema.sql`
   inteiro no SQL Editor e rode (`supabase/README.md`). Confira o fuso em `app_settings`
   (padrão `America/Sao_Paulo`) — ele trava depois do primeiro lançamento.
2. **Primeiro gestor, ANTES de publicar.** Supabase → Authentication → Users → _Add user_ →
   _Create new user_ com **Auto confirm** marcado. O primeiro usuário do banco vira gestor; se a
   URL for publicada antes disso, o primeiro visitante que se cadastrar vira gestor
   (recuperação em `docs/spec/DATA-MODEL.md` §16.4).
3. **Auth.** Authentication → Sign In / Providers → Email: desligue _Confirm email_ (o e-mail
   nativo do Supabase só entrega para membros da organização). Para "esqueci a senha" funcionar
   para o time, configure SMTP próprio em Authentication → Emails → SMTP Settings (§16.2).
4. **Vercel.** Importe o repositório; `vercel.json` já define framework Vite, `npm run build`,
   saída `dist/` e o rewrite de SPA. Cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
   em Project → Settings → Environment Variables (Production **e** Preview) e faça o deploy.
5. **URL de volta no Supabase.** Authentication → URL Configuration: Site URL = endereço da Vercel;
   Redirect URLs = `https://<app>.vercel.app/**` e, para previews, `https://*-<sua-conta>.vercel.app/**`.
6. **Primeiro acesso.** Entre com o gestor, ajuste empresa/temporada/código da equipe em
   Administração → Configurações; os colaboradores entram em `/signup` com o código e aguardam
   aprovação em Administração → Equipe → Pendentes.
7. **Marca.** Configurações → Marca: nome da plataforma, cor de destaque (7 presets),
   logo e tema padrão. Tudo pela interface — não é preciso editar código nem republicar.

CI mínimo recomendado em cada PR: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`.
