# Legado Lovable (arquivo, não importado pelo app)

Arquivos copiados do `src/` original antes da remoção (FRONTEND-ARCH §1.3 e Apêndice A). Servem só para consulta de valores visuais.

| Arquivo | O que tem de útil |
|---|---|
| `gamification.css` | `.premium-card`, `.field-label`/`.field-input`, `.podium-glow`, roda (`.wheel`, `.wheel-center`, `.wheel-pointer`, anel de traços), confete (`.confetti-layer`, `@keyframes confetti-fall`) e breakpoint mobile da roda |
| `wheel-experience.css` | rótulos por setor (`.wheel-prize-spoke`, `.wheel-prize-label`, `writing-mode: vertical-rl`), setor vencedor piscando, `.wheel-spin-status`, painéis Clássica/Premium |
| `theme.css` | switch de tema original e o tema claro por `!important` (substituído por tokens em `src/styles/tokens.css`) |
| `overlays-misc.css` | CSS minificado dos overlays (manager, admin, fila da roleta) — só para consulta de cores/espaçamentos |

Nenhum arquivo daqui deve ser importado por `src/`. Os valores já foram convertidos em tokens (`src/styles/tokens.css`) e classes de identidade (`src/styles/components.css`); a roda vai para `src/features/wheel/wheel.css` (WP4), sem `!important`.
