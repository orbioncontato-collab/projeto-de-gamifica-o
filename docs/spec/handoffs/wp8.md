# Handoffs — WP8 (tema claro, compartilhados, acessibilidade, responsivo)

Uma linha por pedido: arquivo · mudança · motivo. WP8 não editou nenhum destes arquivos.

## Pedidos a outros pacotes

- `src/routes/__root.tsx` (WP0) · envolver os devtools do TanStack (`import.meta.env.DEV`) em um contêiner com `overflow: hidden` ou desativar abaixo de 640px · o painel flutuante dos devtools é o único elemento que ultrapassa a viewport em 320px (classes `go339260511`); não afeta produção.
- `src/components/layout/bottom-nav.tsx` (WP1) · usar a classe `.safe-bottom` (styles/widgets.css) no `<nav>` e manter altura ≈ 72px · o toast global fica a `--toast-offset` = 88px + `env(safe-area-inset-bottom)` do rodapé abaixo de 1024px; se a barra crescer além de 80px, avisar para ajustar o token.
- `src/components/layout/*` (WP1) · `main` com `pb-28` em mobile (DoD §7.4) e `.glass` para sidebar/topbar · classes já existem em `styles/components.css`.
- `src/features/**` (WP2–WP7) · para texto colorido usar `TONE_TEXT`/`text-*-soft` (`text-blue-soft`, `text-purple-soft`, `text-red-soft`) em vez de `text-blue`/`text-purple`/`text-red` · no tema escuro `#4776FF` e `#855CFF` ficam abaixo de 4.5:1 sobre os cards; os `*-soft` são AA nos dois temas (no claro os `*-soft` também foram escurecidos).
- `src/features/**` (WP2–WP7) · tabelas/chips largos dentro de `.scroll-x` (ou `DataTable`, que já rola) · evita overflow horizontal da página em 320/375.
- `src/features/**` (WP2–WP7) · números em `.nums` (tabular) e texto longo (e-mail, nome) em `.break-safe` · alinhamento em tabelas e sem largura mínima forçada.
- `src/features/wheel/wheel.css` (WP4) · respeitar `@media (prefers-reduced-motion: reduce)` no giro (`animation-duration` já cai para 0.01ms pelo `base.css`; o resultado deve aparecer no setor final sem animação) e não renderizar `.confetti-layer` (o CSS já o oculta) · acessibilidade.
- `index.html` (WP0) · nada a mudar: `theme-provider.tsx` atualiza `<meta name="theme-color">` lendo `--bg` · registro.

## Decisões do WP8 (para o integrador)

- Paleta clara reescrita para AA (≥ 4.5:1 sobre `#fff` e sobre `--bg`): accent `#007f4b` (5.1:1), gold `#946600` (5.1), blue `#2a55cc` (6.4), purple `#6242d6` (6.4), red `#cf2f2f` (5.1), red-soft `#cc2e2e` (5.2), cyan `#0576a6` (5.1), bronze `#9c5f1f` (5.2), muted `#5b6b82` (5.4), muted-2 `#5f6f88` (4.9); `--accent-fg` branco sobre accent = 5.1:1. Dark: `--muted-2` → `#8090a8` (5.1:1 sobre os cards; era 3.5).
- Foco visível: `outline: 2px solid var(--ring)` + `outline-offset: 2px` no `:focus-visible` (anel sólido, não compete com `box-shadow`); todos os `focus-visible:outline-none` dos componentes `ui` foram removidos. Itens de menu/select mostram anel interno (`focus:ring-inset`).
- `styles/components.css` dividido em `components.css` + `overlays.css` + `widgets.css` (< 300 linhas); classes de identidade em `@layer components` para que utilitários (`pl-9` em `Input` com ícone) vençam.
- `html/body { overflow-x: clip }` como rede de segurança contra scroll horizontal; `img/svg/video { max-width: 100% }`; alvo de toque ≥ 44px em `Dialog`/`Sheet` (botão fechar), itens de `Select`/`DropdownMenu`, `Switch`/`Checkbox` em telas de toque (`pointer: coarse`).
- Toast: `offset`/`mobileOffset` passados ao sonner (`var(--toast-offset)`, 16px laterais) — verificado a 88px do rodapé em 375px.
- `/dev/showcase` agora cobre `components/shared` **e** os 11 primitivos `ui` + `ThemeSwitch`, com seletor de largura (320/375/768/1024) por coluna de tema.
- Capturas `docs/spec/qa/{dark,light}/*.png` das 18 rotas ficam para a onda 3 (rotas ainda são stubs nesta onda).

## Resultado da integração (onda 3)

- `src/routes/__root.tsx` devtools · **aplicado** — contêiner `fixed inset-0 overflow-hidden`, oculto abaixo de 640px (`hidden sm:block`).
- `bottom-nav.tsx` `.safe-bottom` · **aplicado** (altura mantida).
- `main` com `pb-28` e `.glass` em sidebar/topbar · **já estava**.
- `text-blue|purple|red` sem `-soft` nas features · **verificado** — nenhuma ocorrência.
- Tabelas em `.scroll-x` · **verificado** — o único `<table>` vive em `components/ui/table.tsx`, já com `overflow-x-auto`.
- `wheel.css` reduced-motion · **aplicado** — `.wheel { transition: none }` e sem `filter` no giro; pouso pelo `setTimeout` do `spin-controller`.
- Capturas `docs/spec/qa/{dark,light}` · **não feitas** (sem Supabase local para logar); substituídas pelo smoke de rotas `src/routes/routes-smoke.test.tsx` (35 combinações rota×papel por tema).
