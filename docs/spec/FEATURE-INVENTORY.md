# Inventário de funcionalidades — Orbion Sales League (estado atual do repo)

> Verdade-base extraída da leitura integral do código Lovable (`src/gamification-app.tsx` + 10 overlays).
> Toda funcionalidade listada aqui PRECISA existir na plataforma reescrita, agora com dados reais no Supabase.
> Onde o original usa dado fictício, a versão nova usa dado do banco (ou estado vazio bem desenhado).

## 0. Papéis e sessão
- Dois papéis: **gestor** (admin) e **colaborador**.
- Original: sem login; topbar mostra "Marcelo Alves · Closer · Nível 7" fixo e "740 moedas"; botão "Sair" simulado.
- Novo: login/cadastro reais (Supabase Auth). 1º cadastro = gestor. Gestor define **código da equipe**; colaboradores se cadastram informando o código. Gestor pode ativar/inativar qualquer perfil.

## 1. Layout global
- Sidebar (250px, fixa em desktop, drawer em mobile) com logo "Orbion / Sales League", nav principal (8 itens), seção "Administração" (só gestor; 6 itens + "Roleta" + "Guia de uso" injetados por overlay), item "Configurações" e "Sair".
- Topbar: botão menu (mobile), chip "Temporada Setembro 2026" (nome da temporada ativa), chip de moedas do usuário, sino de notificações com dropdown (5 itens fictícios), avatar + nome + cargo/nível, **switch de tema claro/escuro** (overlay `theme-controller`).
- Bottom nav mobile com 5 atalhos (Início, Ranking, Missões, Roleta, Perfil).
- Toast global de confirmação.

## 2. Visão Geral (colaborador) — `Dashboard`
- Saudação "Bom dia, {nome}", avatar, posição no ranking e gap de pontos para a posição acima.
- `LevelHero`: nível atual, pontos, barra XP (pontos / próximo nível), "faltam N pontos para o nível X". Regra de nível no overlay: 400 XP por nível (`level*400 → (level+1)*400`).
- 4 StatCards: Pontuação, Ranking, Sequência (dias consecutivos 🔥), Moedas.
- `SalesTarget`: vendas do período vs meta individual (R$), %, faltam R$, "ritmo atual: meta projetada para DD/MM".
- `NextReward`: próxima recompensa (Roleta Premium) e pontos faltantes para desbloquear.
- `RankingPreview`: top 5 com destaque "Você".
- `EventBanner`: evento especial "HORA DO FOGO — 14:00 às 16:00 — TODOS OS PONTOS EM DOBRO — começa em HH:MM:SS" (contador).
- `MissionPreview`: 3 missões de hoje com progresso.
- `ActivityFeed`: feed do time (venda, conquista desbloqueada, prêmio da roleta, subiu de nível) com tempo relativo.

## 2b. Visão Geral (gestor) — `ManagerOverviewV2` (substitui a do colaborador quando gestor)
- Cabeçalho "Visão do gestor / Visão geral da operação", temporada.
- 4 métricas: Meta do time (R$) + % atingido; Vendas realizadas + faltam R$; Pontos do time + nº ativos; Fila da roleta (nº pessoas).
- Tabela "Desempenho do time": colaborador (foto/iniciais, cargo, equipe), pontos, vendas, conversão, posição, "Ver desempenho".
- Card "Top 3 do mês". Card "Saúde comercial": conversão média (meta 25%), time ativo, atingimento da meta.
- Modal de colaborador (visão individual): nível/XP, pontos, ranking + gap, sequência, moedas, meta individual (R$ e %), próxima recompensa, indicadores (vendas, reuniões, conversão, posição), missões atuais.
- Topbar do gestor mostra "Gestor · Visão da operação".

## 3. Ranking — `RankingPage`
- Pódio (1º/2º/3º com alturas diferentes, medalhas, glow no 1º).
- Classificação completa: posição/medalha, avatar, nome (+ badge "Você"), cargo · nível, pontos, R$ vendas. Badge "TEMPORADA ATIVA". Gap para a posição acima.

## 4. Missões — `MissionsPage`
- Filtros: Hoje / Semana / Especiais.
- `LightningMission`: missão relâmpago ("Realize uma venda hoje") com recompensa "1 giro na Roleta Premium" e tempo restante (contador).
- Cards de missão: ícone, título, descrição, badge "+N pts", estado "EM PROGRESSO x/y" ou "✅ MISSÃO CONCLUÍDA", barra de progresso.
- Missões do original: "Fazer 5 ligações", "Agendar 2 reuniões", "Atualizar todos os leads no CRM", "Realizar uma reunião".
- Botão "Nova missão" (modal): nome, tipo (Diária…), objetivo (métrica), quantidade, pontuação, participantes (Todos/…), data inicial, data final, descrição. **Só gestor** na versão nova.
- Progresso da missão precisa vir dos lançamentos reais (ledger) dentro da janela da missão, por métrica.

## 5. Desafios — `ChallengesPage` + `ChallengesManager` (overlay)
- `DuelCard`: duelo entre 2 colaboradores (avatar, nome, valor da métrica de cada um, "VS", objetivo, barra proporcional, prêmio "+300 pontos", "finaliza em N dias").
- `TeamChallenge`: desafio coletivo (meta R$ 50.000, realizado R$ 38.500, 77%, prêmio coletivo "Roleta Premium para todos").
- Gestão (gestor): lista de desafios com tipo (Duelo/Coletivo), nome, descrição, métrica (Reuniões/Vendas/Faturamento/Pontos/Atividades), meta, prêmio, período, participantes, ativo; botão "Novo desafio"; editor completo.
- Progresso do desafio vem do ledger, por métrica, dentro do período, por participante (duelo) ou somado (coletivo).

## 6. Roleta — `WheelPage` + `WheelExperience` + `WheelQueue` + `WheelQuickQueue` + `WheelAdmin`
- Duas roletas: **Clássica** (6 prêmios padrão: R$ 10 PIX, 100 pontos, R$ 20 PIX, Giro extra, R$ 30 iFood, 200 pontos) e **Premium** (8: R$ 50 PIX, 500 pontos, R$ 100 PIX, Giro extra, R$ 50 iFood, 1.000 pontos, 2x pontos, Mystery Box).
- Seletor de roleta; roda com setores coloridos (conic-gradient) + rótulo de cada prêmio no setor; ponteiro; centro com ícone; animação de giro (~8s, cubic-bezier) que **para exatamente no setor sorteado**; confete; modal de resultado com prêmio, modo (giro pela fila / giro livre), tipo de roleta.
- **Fila do gestor** (`WheelQueue`, painel completo abaixo da roleta + `WheelQuickQueue`, painel compacto acima): adicionar colaborador cadastrado OU nome manual (convidado); escolher roleta; tentativas por pessoa (padrão 1, cadeado destrava até 20); busca na fila; lista com posição, avatar, nome, origem (colaborador/manual), giros usados x/y, seletor de roleta, "N restantes", botão "Liberar giro" (só um ativo por vez) / "Liberado", remover.
- Estado visível na roleta: "GIRO LIVRE" / "VEZ DE {NOME} • Tentativa i de n" / "AGUARDANDO APROVAÇÃO • {prêmio}"; botão muda para "GIRAR ROLETA • {nome}" / "VER PRÊMIO • {nome}".
- Fluxo gerido: gestor libera → gira → prêmio fica **pendente** → gestor "Aprovar prêmio e concluir giro" (consome 1 tentativa; se acabou, sai da fila) ou "Fechar sem aprovar".
- Giro livre (sem fila) permitido — resultado não gera crédito.
- Histórico "Últimas aprovações" (nome, prêmio, tipo, hora).
- Admin da roleta: editar texto de cada prêmio, adicionar/remover (mín. 2), salvar; ao salvar a roleta do colaborador atualiza.
- Novo: prêmio aprovado precisa **creditar de verdade** (pontos/moedas/valor em R$ como recompensa a entregar) — o original só registrava histórico.

## 7. Recompensas — `RewardsPage`
- Carteira: saldo de Orb Coins, 3 métricas de origem (+100 Venda, +50 Missão, +200 Meta), últimos 3 créditos (valor, título, data).
- Loja: cards (ícone, custo em moedas, nome, "Resgatar" ou "Faltam N moedas"); catálogo original: R$ 20 iFood (500), R$ 50 iFood (1000), R$ 50 PIX (1200), R$ 100 PIX (2200), Almoço pago (1500), Sair 2h mais cedo (1800), Day Off (5000).
- "Cadastrar recompensa" (gestor): nome, categoria, valor, custo em moedas, quantidade disponível, ícone, ativo/inativo.
- Novo: resgate cria pedido → gestor aprova/entrega; saldo de moedas debitado.

## 8. Conquistas — `AchievementsPage`
- Grid de conquistas (desbloqueada/bloqueada, ícone, título, descrição, ✨). Catálogo: PRIMEIRA VENDA, EM CHAMAS (7 dias consecutivos), 50K CLUB, META BATIDA (meta mensal), CAMPEÃO (1º lugar no mês), 100K CLUB.
- Novo: desbloqueio automático por critério a partir do ledger/ranking.

## 9. Perfil — `ProfilePage`
- Avatar, nome, badge nível, cargo · empresa, pontos, posição; 4 stats (Vendas R$, Reuniões, Conversão %, Posição); conquistas "3 de 6 desbloqueadas" em mini-grid.
- Novo: editar próprios dados básicos (nome, foto) — opcional.

## 10. Administração — Dashboard (`AdminDashboard` + `AdminExperience` bar)
- Botões: Criar missão, Criar desafio, Gerenciar equipe.
- 6 métricas: Meta do time, Realizado, Atingimento, Pontos distribuídos, Recompensas (R$ entregues), Missões concluídas.
- Gráficos (recharts): evolução de vendas acumulada no mês (área), pontos por colaborador (barras), evolução de pontos (linha). Indicadores: Conversão, Comparecimento, CRM atualizado, Atividades realizadas (meta de cada).
- Barra "Administração operacional": Cadastrar colaborador, Lançar pontos, Histórico; contadores (colaboradores, pontos atuais, lançamentos).

## 11. Administração — Equipe (`TeamPage` + `AdminRoster`)
- Tabela: nome, cargo, pontos, nível, ranking, vendas, status, "Ver perfil" (modal). Cards em mobile.
- Cadastro/edição completa: foto (upload ≤1,5 MB), nome, e-mail, cargo (SDR/Closer/Social Seller/Supervisor Comercial/Gestor), status (Ativo/Inativo), equipe, telefone, pontos-base, nível, meta individual (R$). Busca.
- Novo: foto vai para Supabase Storage (bucket `avatars`); cadastro de conta é via signup com código (gestor edita perfil, ativa/inativa, muda papel).

## 12. Administração — Pontuação (`PointsPage` + `RulesManager` + `PointsModal` + `HistoryModal`)
- Regras de pontuação (nome, pontos, ativa/inativa; editar; nova): Reunião agendada 10, Reunião realizada 20, Venda realizada 100, R$ 10.000 vendidos 150, Meta semanal 200, Meta mensal 500, CRM atualizado 10, Recuperação de lead 30, Upsell 80.
- Lançar pontos: colaborador (com saldo), adicionar/remover, quantidade, motivo; histórico de lançamentos (pessoa, motivo, data, ±N).
- Novo: lançamento por **regra** (ex.: "Venda realizada" com valor em R$) alimenta vendas/reuniões/missões/desafios/conquistas; lançamento manual livre continua existindo.

## 13. Administração — Configurações (`SettingsPage`)
- Toggles de preferências (notificações, alertas de evento). Botão salvar.
- Novo (gestor): nome da empresa, temporada ativa (nome, início, fim), meta do time, código da equipe, XP por nível, evento especial (multiplicador, janela).

## 14. Guia de uso (overlay `UsageGuide`)
- 7 passos de implantação dentro do app + checklist. Manter como página estática (conteúdo vem do manual).

## 15. Tema
- Dark (padrão) e light, persistido; original usa `!important` sobre classes arbitrárias — novo usa tokens CSS (`--bg`, `--card`, `--text`, `--muted`, `--accent`…) em `html[data-theme]`.

## Métricas que aparecem na UI e precisam ter origem no banco
| Métrica | Origem proposta |
|---|---|
| pontos | soma de `point_entries.points` na temporada |
| moedas | soma de `point_entries.coins` − resgates |
| nível / XP | `floor(pontos / xp_por_nivel)`; barra = pontos dentro do nível |
| ranking / posição / gap | view ordenada por pontos na temporada |
| vendas (R$) | soma de `point_entries.amount` onde métrica = venda |
| reuniões | contagem de entradas com métrica reunião realizada |
| conversão % | reuniões realizadas → vendas (vendas / reuniões) |
| sequência (dias) | dias consecutivos com pelo menos 1 entrada positiva |
| meta individual | `profiles.goal_amount` |
| meta do time | `settings.team_goal_amount` |
| missões concluídas | `mission_completions` |
| recompensas (R$) | soma de `reward_redemptions` entregues × valor |
| fila da roleta | `wheel_queue` status waiting/active |
