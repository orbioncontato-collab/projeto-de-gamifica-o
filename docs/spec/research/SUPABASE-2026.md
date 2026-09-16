# Supabase — estado atual (pesquisa de setembro/2026)

> Pesquisa feita em 15/09/2026 contra a documentação oficial (supabase.com/docs), o código do Studio no GitHub (supabase/supabase) e a documentação do PostgreSQL. Cada item traz a URL de origem. Itens que não foram confirmados em fonte oficial estão marcados como **NÃO VERIFICADO**.
>
> Contexto do projeto (decisões fechadas, não reabrir): Vite SPA, single-tenant por instalação, 1º cadastro vira admin, colaboradores entram com `team_code`, só admins lançam atividades, deploy na Vercel, Supabase como único backend (Postgres + Auth + Storage, sem Edge Functions).

---

## 1. Criar o projeto no dashboard

| Item | Fato | Fonte |
|---|---|---|
| Onde | Dashboard → organização → botão **"New project"** (`https://supabase.com/dashboard/new/_`) | https://supabase.com/docs/guides/getting-started/quickstarts/reactjs |
| Campos do formulário | Organização, **Project name**, **Database password** (gerar e guardar — é a senha do Postgres, não é recuperável depois, só resetável em *Settings → Database*), **Region**, plano | https://supabase.com/docs/guides/getting-started/quickstarts/reactjs — rótulos exatos do formulário: **NÃO VERIFICADO** (a doc só diz "create a project from the dashboard") |
| Região para o Brasil | **South America (São Paulo)** = `sa-east-1`. Regiões "gerais" recomendadas: East US, Central EU, Southeast Asia. | https://supabase.com/docs/guides/platform/regions |
| Trocar região depois | **NÃO VERIFICADO** — a doc de regiões não fala; assumir que não é trivial (exige migração/restore). |
| Plano Free | 2 projetos ativos por conta (soma das orgs onde você é Owner/Admin); DB 500 MB; Storage 1 GB; egress 5 GB; 50.000 MAU. Projetos pausados não contam no limite. | https://supabase.com/docs/guides/platform/billing-on-supabase e https://supabase.com/pricing |
| Pausa por inatividade | Projeto Free com "baixa atividade em janela de 7 dias" pode ser pausado; restaura pelo dashboard; Pro não pausa. | https://supabase.com/docs/guides/platform/going-into-prod |
| Versão do Postgres | Novos projetos: **NÃO VERIFICADO** (a doc mostra apenas `select version()`; projetos recentes vêm em Postgres 15+ — o suficiente para `security_invoker` em views). | https://supabase.com/docs/guides/database/postgres/which-version-of-postgres |

Recomendação para este projeto: região `sa-east-1`, plano Free para desenvolvimento; a implantação de produção (uso diário por equipe comercial) provavelmente exige Pro por causa da pausa automática e do e-mail (seção 4).

---

## 2. Project URL e chaves de API (nomenclatura atual)

| Item | Fato | Fonte |
|---|---|---|
| Onde ficam | **Project Settings → API Keys** ("Every key lives there, legacy or not"). O painel **"Connect"** (botão no topo do projeto) também mostra URL + publishable key já no formato do framework escolhido (Vite/React). | https://supabase.com/docs/guides/api/api-keys |
| Project URL | `https://<project-ref>.supabase.co` — em *Project Settings → API* / painel *Connect*. | idem |
| Chaves novas | **Publishable key** `sb_publishable_...` (baixo privilégio, pode ir no bundle do front) e **Secret key** `sb_secret_...` (privilégio alto, só servidor). | idem |
| Chaves legadas | `anon` e `service_role` — JWTs longos começando em `eyJ`. **Serão descontinuadas até o fim de 2026.** Ambas as famílias funcionam ao mesmo tempo; criar chaves novas não revoga as antigas. | idem |
| Qual o front Vite usa | **A publishable key** (`sb_publishable_...`). Ela resolve para o papel `anon` (sem login) ou `authenticated` (com sessão) e respeita RLS. Nunca embarcar `sb_secret_` nem `service_role` no front. | idem |
| Header | Chaves vão no header `apikey` (o supabase-js faz isso sozinho); o JWT do usuário logado vai em `Authorization: Bearer` (também automático). | idem |
| Nomes de env recomendados pela doc | `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` | https://supabase.com/docs/guides/getting-started/quickstarts/reactjs |
| Aba "Legacy API keys" no dashboard | **NÃO VERIFICADO** o rótulo exato; a doc só cita "Settings > API Keys". |
| Data em que novos projetos deixam de receber `anon`/`service_role` | **NÃO VERIFICADO**. |

Snippet oficial (Vite):

```ts
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = createClient(supabaseUrl, supabasePublishableKey)
```

Também é preciso que a **Data API** esteja ativa (*Integrations → Data API*) e que o schema `public` esteja exposto (padrão).

---

## 3. SQL Editor

| Item | Fato | Fonte |
|---|---|---|
| Caminho | `https://supabase.com/dashboard/project/_/sql` (menu lateral **SQL Editor**) | https://supabase.com/docs/guides/database/overview |
| Colar script grande | Colar o `.sql` inteiro no editor e clicar **Run** (ou **Cmd/Ctrl+Enter**). O Studio envia o texto completo como um único batch ao Postgres; um erro em qualquer statement aborta o batch inteiro e o erro do Postgres aparece no painel de resultados (mensagem + posição). Ver observação abaixo sobre transação. | Run/Cmd+Enter: https://github.com/orgs/supabase/discussions/14206 e https://supabase.com/features/sql-editor |
| "Run" vs "Run selected" | O botão de execução muda de comportamento quando há texto selecionado: executa só a seleção. O componente `SqlRunButton` recebe a prop `hasSelection`. **Rótulo exato ("Run selected") NÃO VERIFICADO** — o arquivo com a string não pôde ser lido. | https://raw.githubusercontent.com/supabase/supabase/master/apps/studio/components/interfaces/SQLEditor/UtilityPanel/UtilityActions.tsx |
| Outros controles vistos no código | "Prettify SQL", "Intellisense enabled", "Add to/Remove from favorites", seletor **Limit** (paginação de linhas do resultado). | idem |
| Erros | Exibidos no painel inferior de resultados, com a mensagem do Postgres; o Assistant AI oferece "Error analysis". | https://supabase.com/features/sql-editor |
| Snippets | Queries salvas/compartilhadas por projeto ("Shared SQL Snippets"), histórico de execução. | idem |
| Confirmação de query destrutiva | **NÃO VERIFICADO** (não localizado no código lido). |
| Script inteiro em transação? | **NÃO VERIFICADO** se o Studio envolve o batch em `BEGIN/COMMIT`. Recomendação: envolver o `schema.sql` explicitamente em `begin; ... commit;` para garantir tudo-ou-nada, e escrever o script idempotente (`create table if not exists`, `drop policy if exists`, `create or replace function`). |

---

## 4. Authentication — configurações

### 4.1 Provider Email e "Confirm email"
| Item | Fato | Fonte |
|---|---|---|
| Caminho | **Authentication → Sign In / Providers** (`/dashboard/project/_/auth/providers`), provider **Email** (`?provider=Email`) | https://supabase.com/docs/guides/auth/passwords e https://supabase.com/docs/guides/auth/password-security |
| Email habilitado | "Email authentication is enabled by default". | https://supabase.com/docs/guides/auth/passwords |
| Toggle **Confirm email** | Dentro da configuração do provider Email. Em projetos hospedados vem **ligado por padrão**; em local/self-hosted vem desligado. Texto do dashboard: "Users will need to confirm their email address before signing in for the first time." Desligado = e-mail auto-confirmado no banco. | https://supabase.com/docs/guides/auth/general-configuration |
| **Allow new users to sign up** | Toggle geral em **Authentication → Sign In / Providers** ("If this config is disabled, only existing users can sign in"). Manter ligado (colaboradores se cadastram com `team_code`). | idem |
| Allow anonymous sign-ins / Allow manual linking | Existem na mesma página; manter desligados. | idem |

### 4.2 Site URL e Redirect URLs (Vercel)
| Item | Fato | Fonte |
|---|---|---|
| Caminho | **Authentication → URL Configuration** (`/dashboard/project/_/auth/url-configuration`) | https://supabase.com/docs/guides/auth/redirect-urls |
| **Site URL** | URL de produção (ex.: `https://<app>.vercel.app` ou domínio próprio). É o destino padrão quando o código não passa `redirectTo`/`emailRedirectTo`. | idem |
| **Redirect URLs** (allow list) | Adicionar: `http://localhost:5173/**`, `https://<app>.vercel.app/**` e, para previews, o wildcard `https://*-<team-or-account-slug>.vercel.app/**`. Qualquer `emailRedirectTo` passado no código **precisa casar** com uma entrada da lista, senão o Auth cai no Site URL. | idem |
| Templates de e-mail | Para o link do e-mail respeitar o `emailRedirectTo`, trocar `{{ .SiteURL }}` por `{{ .RedirectTo }}` em **Authentication → Emails → Templates** (Confirm signup). | idem |

### 4.3 Senha
| Item | Fato | Fonte |
|---|---|---|
| Caminho | Provider Email (`/dashboard/project/_/auth/providers?provider=Email`) | https://supabase.com/docs/guides/auth/password-security |
| Comprimento mínimo | Configurável; doc recomenda "anything less than 8 characters is not recommended". Valor padrão do campo: **NÃO VERIFICADO** (historicamente 6). |
| Caracteres exigidos | 4 opções: só dígitos; dígitos e letras; dígitos, minúsculas e maiúsculas; dígitos, minúsculas, maiúsculas e símbolos. | idem |
| Leaked password protection | HaveIBeenPwned — **só Pro ou superior**. | idem |

### 4.4 E-mail embutido, limites e SMTP customizado
| Item | Fato | Fonte |
|---|---|---|
| Limite do serviço embutido | **2 e-mails por hora** por projeto. | https://supabase.com/docs/guides/auth/rate-limits e https://supabase.com/docs/guides/auth/auth-smtp |
| Restrição de destinatário | Sem SMTP próprio, o Auth **só entrega para e-mails que são membros da organização** do projeto (aba **Team** em *Organization settings*). Vale desde 26/09/2024. Sem SLA. | https://supabase.com/docs/guides/auth/auth-smtp e https://supabase.com/changelog/29370-supabase-auth-changes-to-default-email-provider |
| Quando SMTP próprio é obrigatório | Qualquer uso além de teste: produção, email/senha com confirmação, magic link/OTP, convites, recuperação de senha. | https://supabase.com/docs/guides/auth/auth-smtp |
| Onde configurar SMTP | **Authentication → Emails → SMTP Settings** (`/dashboard/project/_/auth/smtp`). Ao ativar, limite inicial de 30 e-mails/hora, ajustável em **Authentication → Rate Limits** (`/auth/rate-limits`). | idem e https://supabase.com/docs/guides/platform/going-into-prod |
| Outros limites (por IP) | Sign-up/sign-in: 30 req/5 min; token (password/refresh/PKCE): 150 req/5 min; verify: 30 req/5 min. | https://supabase.com/docs/guides/auth/rate-limits |

**Consequência para o produto:** com "Confirm email" ligado e sem SMTP próprio, colaboradores **não conseguirão** se cadastrar (o e-mail de confirmação nem sai). Caminhos viáveis:
1. Desligar **Confirm email** (cadastro entra direto com sessão) — o `team_code` já filtra quem entra; recuperação de senha continuaria dependendo de e-mail; **ou**
2. Configurar SMTP próprio (Resend/SendGrid/SES etc.) e manter confirmação.

### 4.5 Admin criando usuário manualmente no dashboard
| Item | Fato | Fonte |
|---|---|---|
| Caminho | **Authentication → Users** → botão **"Add user"** → opção **"Create new user"** (a outra opção é **"Send invitation"** → botão **"Invite user"**, que cria usuário não confirmado e manda convite; expira em 1 h por padrão). | https://supabase.com/docs/guides/auth/users e código do Studio |
| Modal "Create a new user" | Campos **"Email address"**, **"User Password"**, checkbox **"Auto confirm user?"** (marcado = já confirmado), botão **"Create user"**. Aviso do modal: "A confirmation email will not be sent when creating a user via this form." | https://raw.githubusercontent.com/supabase/supabase/master/apps/studio/components/interfaces/Auth/Users/CreateUserModal.tsx |
| Metadata | O modal **não** tem campo de `user_metadata` (**NÃO VERIFICADO** se versões recentes adicionaram). Logo, um usuário criado assim dispara o trigger `handle_new_user` **sem** `full_name`/`team_code` no `raw_user_meta_data` — o trigger precisa tolerar metadata vazia (ou o admin edita o perfil depois). |
| `auth.admin.createUser()` | Exige secret/service_role key → **não usar no front**; fora de escopo (sem Edge Functions). | https://supabase.com/docs/guides/auth/users |

---

## 5. Storage

| Item | Fato | Fonte |
|---|---|---|
| Criar bucket (dashboard) | **Storage → "New bucket"** → nome (`avatars`) → toggle **Public bucket** → opcional: limite de tamanho por arquivo e MIME types permitidos → **"Create bucket"**. | https://supabase.com/docs/guides/storage/buckets/creating-buckets |
| Criar bucket (SQL, útil no `schema.sql`) | `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars','avatars', true, 1572864, array['image/*']) on conflict (id) do nothing;` — colunas `file_size_limit`/`allowed_mime_types`: **NÃO VERIFICADO** o nome exato (a doc mostra só `id, name, public`); via JS é `fileSizeLimit: '1MB'`, `allowedMimeTypes: ['image/*']`. | idem |
| Bucket público | Leitura (`GET` do objeto) é pública sem policy; **uploads continuam exigindo policy em `storage.objects`** ("By default Storage does not allow any uploads to buckets without RLS policies"). | https://supabase.com/docs/guides/storage/security/access-control |
| URL pública | `https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>` — obtida com `supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl` (síncrono, sem request). | https://supabase.com/docs/guides/storage/serving/downloads |
| Upload | `supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })`. Sem `upsert`, caminho existente retorna `400 Asset Already Exists`. Padrão "standard upload" para ≤ 6 MB (o app limita a 1,5 MB). Doc desaconselha sobrescrever pelo cache de CDN — use nome com timestamp/hash e atualize `profiles.avatar_url`. | https://supabase.com/docs/guides/storage/uploads/standard-uploads |
| Helper de pasta | `(storage.foldername(name))[1]` = primeiro segmento do caminho. Padrão da doc compara com `(select auth.jwt()->>'sub')` (equivalente a `(select auth.uid())::text`). | https://supabase.com/docs/guides/storage/security/access-control |

Policies para `avatars/{uid}/*` (padrão da doc adaptado; admin poder trocar foto de qualquer um fica a cargo de uma cláusula extra com a função `is_admin()` da seção 7):

```sql
-- leitura: bucket público já serve o arquivo; a policy de select é necessária para listar/baixar via API
create policy "avatars_select_public" on storage.objects
for select to public
using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

---

## 6. supabase-js v2 — superfície usada pela SPA

| Chamada | Fato | Fonte |
|---|---|---|
| `createClient<Database>(url, publishableKey, options?)` | Opções relevantes: `auth.persistSession` (padrão true, localStorage), `auth.autoRefreshToken` (true), `auth.detectSessionInUrl` (true — necessário para links de e-mail), `auth.flowType` (`'implicit'` padrão no browser ou `'pkce'`), `db.schema`. | https://supabase.com/docs/reference/javascript/initializing |
| `auth.signUp({ email, password, options: { data, emailRedirectTo } })` | `options.data` → vira `raw_user_meta_data` em `auth.users` (lido no trigger) e `user.user_metadata` no cliente. `emailRedirectTo` precisa estar na allow list. **Com Confirm email ligado**: retorna `session: null`; se o e-mail já existe retorna um "usuário falso ofuscado" com `identities: []` (anti-enumeração) — a UI deve tratar `data.user?.identities?.length === 0` como "e-mail já cadastrado". Com confirmação desligada: retorna sessão imediatamente. | https://supabase.com/docs/reference/javascript/auth-signup e https://supabase.com/docs/guides/auth/managing-user-data |
| `auth.signInWithPassword({ email, password })` | Retorna `{ data: { user, session }, error }`. | https://supabase.com/docs/guides/auth/passwords |
| `auth.signOut()` | Padrão `scope: 'global'` (revoga todos os refresh tokens). |  https://supabase.com/docs/reference/javascript/auth-signout (**NÃO VERIFICADO** nesta rodada — comportamento conhecido) |
| `auth.getSession()` | Lê sessão do storage local (não valida no servidor); para dado confiável use `auth.getUser()`. | https://supabase.com/docs/reference/javascript/auth-getsession (**NÃO VERIFICADO** nesta rodada) |
| `auth.onAuthStateChange((event, session) => …)` | Eventos: `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`, `PASSWORD_RECOVERY`. Retorna `{ data: { subscription } }` → `subscription.unsubscribe()` no cleanup do `useEffect`. **Não usar `await` em chamadas supabase dentro do callback** (deadlock) — dispare com `setTimeout`/estado e busque o perfil fora. | https://supabase.com/docs/reference/javascript/auth-onauthstatechange |
| `from('t').select('cols, rel(cols)')`, `.insert([...]).select()`, `.update({...}).eq(...)`, `.delete()` | Tipados via generic `Database`; helpers `Tables<'profiles'>`, `TablesInsert<'x'>`, `TablesUpdate<'x'>`, `Enums<'x'>` exportados pelo arquivo gerado. | https://supabase.com/docs/guides/api/rest/generating-types |
| `rpc('fn', { args })` | Chama função SQL do schema exposto; retorna `{ data, error }`. | https://supabase.com/docs/guides/database/functions |
| `storage.from('avatars').upload(...)` / `.getPublicUrl(path)` | Ver seção 5. | |

### Gerar tipos TypeScript
| Método | Fato | Fonte |
|---|---|---|
| Dashboard | **Project Settings → API → "Generate and download types"** (seção TypeScript). Rótulo exato do botão: **NÃO VERIFICADO**; a doc diz "generate and download TypeScript types directly from the project dashboard" na seção API das configurações. | https://supabase.com/docs/guides/api/rest/generating-types |
| CLI sem instalar globalmente | `npx supabase login` (abre browser / pede access token gerado em `https://supabase.com/dashboard/account/tokens`) e depois `npx supabase gen types typescript --project-id "<ref>" --schema public > src/types/database.types.ts`. Também aceita `SUPABASE_ACCESS_TOKEN` no ambiente. | idem |
| Tipos escritos à mão | Aceitável tecnicamente (o generic `Database` é só um tipo TS com formato `{ public: { Tables: {...}, Views, Functions, Enums } }`), mas a doc não recomenda; ela sugere gerar e, se necessário, sobrescrever campos com `MergeDeep` (type-fest). Recomendação: gerar após aplicar o `schema.sql` e versionar o arquivo. | idem |

---

## 7. Padrões Postgres recomendados (RLS, funções, triggers)

| Padrão | Fato | Fonte |
|---|---|---|
| `(select auth.uid())` | Envolver `auth.uid()`/`auth.jwt()`/funções `security definer` em `select` para o planner cachear por statement em vez de avaliar por linha. | https://supabase.com/docs/guides/database/postgres/row-level-security |
| `to authenticated` | Sempre declarar o papel na policy; evita rodar a policy para `anon`. | idem |
| Índices | Criar índice em toda coluna filtrada por policy (`user_id`, `season_id`…). | idem |
| Helper `security definer` | Função em schema **não exposto** (`private`) ou em `public` com `revoke execute from anon`; **obrigatório** `set search_path = ''` e nomes totalmente qualificados (`public.profiles`). Padrão `is_admin()`: | idem e https://supabase.com/docs/guides/database/functions |
| Views | Postgres 15+: `create view v with (security_invoker = true) as …` para respeitar RLS das tabelas base. Sem isso a view roda como dono (`postgres`) e **vaza dados** para `anon`/`authenticated` — é o alerta "security definer view" do Security Advisor. Usar `security_invoker = true` em todas as views (ranking, métricas). | https://supabase.com/docs/guides/database/postgres/row-level-security |
| Trigger em `auth.users` | Função `security definer set search_path = ''` + `create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();`. Lê `new.raw_user_meta_data ->> 'campo'`. | https://supabase.com/docs/guides/auth/managing-user-data |
| Bloquear cadastro no trigger | A doc avisa: "If the trigger fails, it could block signups". Ou seja, `raise exception 'invalid team code'` dentro do trigger **aborta o insert em `auth.users`** e o `signUp` retorna erro (mensagem genérica "Database error saving new user" — **NÃO VERIFICADO** o texto exato). Alternativa oficial para rejeitar cadastro com mensagem controlada: **Before User Created hook** (função Postgres, disponível no Free, configurada em **Authentication → Hooks**, retornando erro 4xx). | idem e https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook |
| Permissões do hook | Função do hook precisa de `grant execute … to supabase_auth_admin` e `revoke … from authenticated, anon, public`. | https://supabase.com/docs/guides/auth/auth-hooks |
| `gen_random_uuid()` | Função **nativa** do Postgres (core desde a v13; não precisa de `pgcrypto`). PG18 também tem `uuidv7()`. | https://www.postgresql.org/docs/current/functions-uuid.html |
| `pgcrypto` / `uuid-ossp` | Extensões ativadas em **Database → Extensions** ou `create extension if not exists pgcrypto with schema extensions;`. `uuid-ossp` vem ativado por padrão; `pgcrypto` por padrão: **NÃO VERIFICADO** (usar `if not exists` se precisar de `crypt()`/`gen_salt()`). Schema recomendado: `extensions`. | https://supabase.com/docs/guides/database/extensions e https://supabase.com/docs/guides/database/extensions/uuid-ossp |
| Realtime | Publicação `supabase_realtime` já existe; tabelas **não** entram por padrão: `alter publication supabase_realtime add table public.wheel_queue;` ou toggle em **Database → Publications**. `alter table … replica identity full` para receber `old` em UPDATE/DELETE. Eventos respeitam RLS (exceto DELETE). | https://supabase.com/docs/guides/realtime/postgres-changes |

Esqueleto recomendado:

```sql
-- helper de papel, sem penalidade de RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active
  );
$$;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;

-- trigger de criação de perfil (1º usuário vira admin; demais precisam de team_code válido)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_code text := new.raw_user_meta_data ->> 'team_code';
begin
  select count(*) into v_count from public.profiles;
  if v_count = 0 then
    insert into public.profiles (id, email, full_name, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'admin');
    return new;
  end if;
  if v_code is null or not exists (select 1 from public.settings s where s.team_code = v_code) then
    raise exception 'invalid_team_code';   -- aborta o signup
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'collaborator');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Observação: usuário criado pelo modal "Create new user" do dashboard chega **sem** `team_code` na metadata → cairia no `raise exception`. Decidir: (a) o trigger aceita metadata vazia quando `is_admin` criador… não é possível saber quem criou; então (b) documentar que o admin cria usuário pelo dashboard **somente** se o trigger permitir metadata vazia como colaborador inativo, ou (c) manter regra estrita e orientar que colaboradores sempre se cadastram pela tela com código. Recomendação: (c), mais simples e coerente com a decisão de produto.

---

## 8. Migrations vs `schema.sql` único

| Item | Fato | Fonte |
|---|---|---|
| Convenção CLI | `supabase/migrations/<YYYYMMDDHHMMSS>_descricao.sql`, criada com `supabase migration new descricao`; aplicada com `supabase db push` (remoto) / `supabase db reset` (local). | https://supabase.com/docs/guides/deployment/database-migrations |
| Regra da doc | "Never change the remote database directly" — alterar pelo SQL Editor/Table Editor **fura o histórico de migrations** e faz `db push` falhar por drift; a recuperação é `supabase db pull`/`db diff`. | idem |
| `schema.sql` colado no SQL Editor é suportado? | **Sim, é um caminho oficial** para quem **não usa** a CLI/migrations: os próprios quickstarts mandam colar SQL no SQL Editor. O que a doc proíbe é **misturar** os dois modelos. Para este projeto (sem CLI no fluxo do admin), adotar: um `supabase/schema.sql` **idempotente** (única fonte de verdade), aplicado via SQL Editor, versionado no repo; e, para mudanças futuras, arquivos `supabase/migrations/<timestamp>_x.sql` também idempotentes, aplicados na mesma forma (colar e Run) — o nome com timestamp mantém a ordem e permite migrar para a CLI depois sem renomear. | https://supabase.com/docs/guides/getting-started/quickstarts/reactjs |
| Tabela de controle | Se algum dia a CLI for adotada, ela usa `supabase_migrations.schema_migrations`; scripts aplicados à mão não ficam registrados — precisaria de `supabase migration repair`. **NÃO VERIFICADO** o comando exato nesta rodada. |

---

## Resumo das decisões técnicas derivadas

1. Front usa `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_`); nenhuma chave secreta no repo/Vercel front.
2. **Confirm email**: desligar (ou exigir SMTP próprio) — sem isso o cadastro por `team_code` não funciona por causa da regra "só membros da org recebem e-mail" + 2 e-mails/h.
3. Site URL = domínio Vercel de produção; Redirect URLs = localhost + produção + wildcard de preview.
4. Bucket `avatars` público, uploads em `avatars/{uid}/…` com policies por pasta; `getPublicUrl` para exibir.
5. Toda view com `security_invoker = true`; toda função `security definer` com `set search_path = ''`; policies com `to authenticated` e `(select auth.uid())`.
6. `handle_new_user` como trigger `security definer` em `auth.users`, com `raise exception` para bloquear `team_code` inválido; alternativa com mensagem melhor: Before User Created hook (Postgres, Free).
7. `schema.sql` idempotente colado no SQL Editor é o caminho oficial de instalação; migrations com timestamp para evoluções, sem misturar com CLI `db push`.
