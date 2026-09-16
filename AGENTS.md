# Notas para quem contribui (humano ou agente)

- Base de verdade: `docs/spec/FRONTEND-ARCH.md` (front), `docs/spec/DATA-MODEL.md` (banco) e `docs/spec/FEATURE-INVENTORY.md` (o que a UI faz). Leia antes de escrever código.
- Texto de UI em pt-BR; identificadores em inglês (`camelCase` no TS, `snake_case` no SQL).
- Nenhuma cor hex em `src/features/**` ou `src/components/**` — só tokens (`var(--accent)`, `text-accent`, `bg-surface`…). Nenhum `!important`, nenhum `any`, nenhum dado fictício.
- Cada arquivo tem um dono (FRONTEND-ARCH §6). Precisa mudar arquivo alheio? Escreva uma linha em `docs/spec/handoffs/<seu-wp>.md`.
- `src/routeTree.gen.ts` e `package-lock.json` são gerados: nunca edite à mão (`npm run routes:gen`, `npm install`).
- Antes de entregar: `npm run lint && npm run typecheck && npm test && npm run build`.
- Não faça commit nem push dentro de um pacote de trabalho — o orquestrador integra.
