import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, Coins, Crown, Flame, Medal, Target, Trophy, Users, X, Zap } from "lucide-react";
import "./manager-overview.css";

type Person = {
  id: string;
  name: string;
  role: string;
  email: string;
  points: number;
  photo?: string;
  status: "Ativo" | "Inativo";
  phone?: string;
  team?: string;
  goal?: number;
  level?: number;
  sales?: number;
  meetings?: number;
  conversion?: number;
  streak?: number;
  coins?: number;
};
type Entry = { personId: string; amount: number; type: "add" | "remove" };
type QueueEntry = { id: string; personId?: string; personName: string; type: "classic" | "premium"; createdAt: string };

const PEOPLE_KEY = "orbion-admin-people-v1";
const OVERRIDES_KEY = "orbion-admin-people-overrides-v2";
const ENTRIES_KEY = "orbion-admin-entries-v1";
const QUEUE_KEY = "orbion-wheel-queue-v1";

const basePeople: Person[] = [
  { id: "joao", name: "João Martins", role: "SDR", email: "joao@orbion.com.br", points: 3480, status: "Ativo", team: "Pré-vendas", goal: 50000, level: 8, sales: 52000, meetings: 31, conversion: 27, streak: 9, coins: 1240 },
  { id: "amanda", name: "Amanda Silva", role: "Closer", email: "amanda@orbion.com.br", points: 3120, status: "Ativo", team: "Vendas", goal: 50000, level: 8, sales: 47500, meetings: 29, conversion: 26, streak: 7, coins: 980 },
  { id: "marcelo", name: "Marcelo Alves", role: "SDR", email: "marcelo@orbion.com.br", points: 2950, status: "Ativo", team: "Pré-vendas", goal: 50000, level: 7, sales: 32500, meetings: 27, conversion: 24, streak: 6, coins: 740 },
  { id: "lucas", name: "Lucas Rocha", role: "Closer", email: "lucas@orbion.com.br", points: 2700, status: "Ativo", team: "Vendas", goal: 50000, level: 7, sales: 39000, meetings: 25, conversion: 23, streak: 5, coins: 690 },
  { id: "gabriel", name: "Gabriel Lima", role: "SDR", email: "gabriel@orbion.com.br", points: 2540, status: "Ativo", team: "Pré-vendas", goal: 50000, level: 6, sales: 28400, meetings: 23, conversion: 21, streak: 4, coins: 610 },
  { id: "carolina", name: "Carolina Melo", role: "Closer", email: "carolina@orbion.com.br", points: 2310, status: "Ativo", team: "Vendas", goal: 50000, level: 6, sales: 26100, meetings: 22, conversion: 20, streak: 3, coins: 540 },
];

function readList<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) || "[]") as T[]; } catch { return []; } }
function readMap<T>(key: string): Record<string, T> { try { return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, T>; } catch { return {}; } }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(v => v[0]?.toUpperCase() || "").join(""); }
function money(value: number) { return `R$ ${value.toLocaleString("pt-BR")}`; }

export function ManagerOverview() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<Person>>>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);

  useEffect(() => {
    const load = () => {
      setPeople(readList<Person>(PEOPLE_KEY));
      setOverrides(readMap<Partial<Person>>(OVERRIDES_KEY));
      setEntries(readList<Entry>(ENTRIES_KEY));
      setQueue(readList<QueueEntry>(QUEUE_KEY));
    };
    const sync = () => {
      const main = document.querySelector<HTMLElement>("main");
      const title = main?.querySelector("h1")?.textContent || "";
      const isOverview = title.includes("Bom dia, Marcelo") || title.includes("Vamos subir no ranking");
      if (!main || !isOverview) {
        main?.classList.remove("manager-overview-active");
        setHost(null);
        return;
      }
      main.classList.add("manager-overview-active");
      let target = main.querySelector<HTMLElement>("[data-manager-overview]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.managerOverview = "1";
        main.prepend(target);
      }
      setHost(target);
    };
    load(); sync();
    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(load, 900);
    return () => { observer.disconnect(); window.clearInterval(timer); document.querySelector("main")?.classList.remove("manager-overview-active"); };
  }, []);

  const adjustments = useMemo(() => entries.reduce<Record<string, number>>((acc, item) => {
    acc[item.personId] = (acc[item.personId] || 0) + (item.type === "add" ? item.amount : -item.amount);
    return acc;
  }, {}), [entries]);

  const merged = useMemo(() => {
    const fixed = basePeople.map(person => ({ ...person, ...(overrides[person.id] || {}) }));
    const custom = people.map((person, index) => ({ sales: 0, meetings: 0, conversion: 0, streak: 0, coins: Math.max(0, Math.round(person.points * .25)), level: Math.max(1, person.level || 1), goal: person.goal || 50000, team: person.team || "Comercial", ...person, id: person.id || `custom-${index}` }));
    return [...fixed, ...custom].map(person => ({ ...person, points: Math.max(0, person.points + (adjustments[person.id] || 0)) }));
  }, [people, overrides, adjustments]);

  if (!host) return selected ? <CollaboratorModal person={selected} people={merged} onClose={() => setSelected(null)} /> : null;
  return <>{createPortal(<ManagerDashboard people={merged} queue={queue} onSelect={setSelected} />, host)}{selected && <CollaboratorModal person={selected} people={merged} onClose={() => setSelected(null)} />}</>;
}

function ManagerDashboard({ people, queue, onSelect }: { people: Person[]; queue: QueueEntry[]; onSelect: (person: Person) => void }) {
  const active = people.filter(person => person.status === "Ativo");
  const totalSales = active.reduce((sum, person) => sum + (person.sales || 0), 0);
  const totalPoints = active.reduce((sum, person) => sum + person.points, 0);
  const target = 200000;
  const attainment = Math.round((totalSales / target) * 1000) / 10;
  const ranking = [...active].sort((a, b) => b.points - a.points);
  const averageConversion = active.length ? Math.round(active.reduce((sum, person) => sum + (person.conversion || 0), 0) / active.length) : 0;
  return <div className="manager-dashboard">
    <section className="manager-heading"><div><span><BarChart3 /> VISÃO DO GESTOR</span><h1>Visão geral da operação</h1><p>Acompanhe o time inteiro. Clique em qualquer colaborador para abrir o desempenho individual.</p></div><div className="manager-period"><span>Temporada atual</span><strong>Setembro 2026</strong></div></section>

    <div className="manager-metrics">
      <Metric icon={<Target />} label="Meta do time" value={money(target)} helper={`${attainment}% atingido`} tone="green" />
      <Metric icon={<ArrowUpRight />} label="Vendas realizadas" value={money(totalSales)} helper={`${money(Math.max(0, target - totalSales))} para a meta`} tone="blue" />
      <Metric icon={<Zap />} label="Pontos do time" value={`${totalPoints.toLocaleString("pt-BR")} pts`} helper={`${active.length} colaboradores ativos`} tone="purple" />
      <Metric icon={<Trophy />} label="Fila da roleta" value={`${queue.length} pessoas`} helper={queue.length ? "Aguardando liberação" : "Fila zerada"} tone="gold" />
    </div>

    <div className="manager-grid-main">
      <section className="manager-card team-performance">
        <div className="manager-card-head"><div><span>DESEMPENHO DO TIME</span><h2>Colaboradores</h2></div><div className="manager-pill"><Users /> {active.length} ativos</div></div>
        <div className="team-table-head"><span>Colaborador</span><span>Pontos</span><span>Vendas</span><span>Conversão</span><span>Posição</span><span></span></div>
        <div className="team-table-body">{ranking.map((person, index) => <button key={person.id} className="team-person-row" onClick={() => onSelect(person)}>
          <div className="team-person"><Avatar person={person} /><div><strong>{person.name}</strong><span>{person.role} · {person.team || "Comercial"}</span></div></div>
          <b>{person.points.toLocaleString("pt-BR")}</b><b>{money(person.sales || 0)}</b><b>{person.conversion || 0}%</b><b className={index < 3 ? "top-rank" : ""}>{index + 1}º</b><span className="open-person">Ver desempenho <ArrowUpRight /></span>
        </button>)}</div>
      </section>

      <div className="manager-side-stack">
        <section className="manager-card"><div className="manager-card-head"><div><span>RANKING</span><h2>Top 3 do mês</h2></div><Trophy className="gold-icon" /></div><div className="manager-ranking">{ranking.slice(0, 3).map((person, index) => <button key={person.id} onClick={() => onSelect(person)}><span className="rank-medal">{["🥇", "🥈", "🥉"][index]}</span><Avatar person={person} small /><div><strong>{person.name}</strong><span>{person.points.toLocaleString("pt-BR")} pts</span></div></button>)}</div></section>
        <section className="manager-card operation-health"><div className="manager-card-head"><div><span>SAÚDE COMERCIAL</span><h2>Indicadores rápidos</h2></div><Activity /></div><Health label="Conversão média" value={averageConversion} target="Meta 25%" /><Health label="Time ativo" value={active.length ? Math.round((active.length / people.length) * 100) : 0} target={`${active.length}/${people.length}`} /><Health label="Atingimento da meta" value={Math.min(100, attainment)} target={`${attainment}%`} /></section>
      </div>
    </div>
  </div>;
}

function Metric({ icon, label, value, helper, tone }: { icon: React.ReactNode; label: string; value: string; helper: string; tone: string }) { return <section className={`manager-metric ${tone}`}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{helper}</small></section>; }
function Health({ label, value, target }: { label: string; value: number; target: string }) { return <div className="health-line"><div><strong>{label}</strong><span>{target}</span></div><div className="health-track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>; }
function Avatar({ person, small = false }: { person: Person; small?: boolean }) { return <div className={`manager-avatar ${small ? "small" : ""}`}>{person.photo ? <img src={person.photo} alt={person.name} /> : <span>{initials(person.name)}</span>}</div>; }

function CollaboratorModal({ person, people, onClose }: { person: Person; people: Person[]; onClose: () => void }) {
  const ranking = [...people].filter(p => p.status === "Ativo").sort((a, b) => b.points - a.points);
  const rank = Math.max(1, ranking.findIndex(item => item.id === person.id) + 1);
  const next = ranking[rank - 2];
  const nextGap = next ? Math.max(0, next.points - person.points) : 0;
  const goal = person.goal || 50000;
  const sales = person.sales || 0;
  const progress = Math.min(100, Math.round((sales / goal) * 100));
  const level = person.level || Math.max(1, Math.floor(person.points / 400));
  const nextLevel = (level + 1) * 400;
  const levelStart = level * 400;
  const xpProgress = Math.max(0, Math.min(100, Math.round(((person.points - levelStart) / Math.max(1, nextLevel - levelStart)) * 100)));
  return <div className="collaborator-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}><section className="collaborator-modal">
    <button className="collaborator-close" onClick={onClose}><X /></button>
    <div className="collaborator-hero"><div className="collaborator-person"><Avatar person={person} /><div><span>VISÃO INDIVIDUAL</span><h2>{person.name}</h2><p>{person.role} · {person.team || "Comercial"}</p></div></div><div className="collaborator-rank"><Trophy /><div><strong>{rank}º lugar</strong><span>{rank > 1 ? `${nextGap} pts do ${rank - 1}º` : "Líder do ranking"}</span></div></div></div>
    <section className="collaborator-level"><div><span>NÍVEL {level}</span><h3>{person.points.toLocaleString("pt-BR")} <small>pontos</small></h3><div className="level-copy"><b>{Math.max(0, nextLevel - person.points)} pontos para o próximo nível</b><span>{xpProgress}%</span></div><div className="level-track"><i style={{ width: `${xpProgress}%` }} /></div></div><div className="level-bolt"><Zap /></div></section>
    <div className="collaborator-stats"><SmallStat icon={<Zap />} label="Pontuação" value={`${person.points.toLocaleString("pt-BR")} pts`} /><SmallStat icon={<Trophy />} label="Ranking" value={`${rank}º lugar`} /><SmallStat icon={<Flame />} label="Sequência" value={`${person.streak || 0} dias`} /><SmallStat icon={<Coins />} label="Moedas" value={`${person.coins || 0}`} /></div>
    <div className="collaborator-columns"><section className="collaborator-card"><div className="section-eyebrow">META INDIVIDUAL</div><h3>{money(sales)} <small>de {money(goal)}</small></h3><div className="sales-progress"><i style={{ width: `${progress}%` }} /></div><p>{progress}% da meta concluída. Faltam <strong>{money(Math.max(0, goal - sales))}</strong>.</p></section><section className="collaborator-card reward"><div className="section-eyebrow">PRÓXIMA RECOMPENSA</div><h3><Crown /> Roleta Premium</h3><p>Faltam <strong>{Math.max(0, nextLevel - person.points)} pontos</strong> para o próximo desbloqueio.</p><div className="reward-progress"><i style={{ width: `${xpProgress}%` }} /></div></section></div>
    <div className="collaborator-columns"><section className="collaborator-card"><div className="section-eyebrow">INDICADORES</div><div className="individual-kpis"><div><span>Vendas</span><strong>{money(sales)}</strong></div><div><span>Reuniões</span><strong>{person.meetings || 0}</strong></div><div><span>Conversão</span><strong>{person.conversion || 0}%</strong></div><div><span>Posição</span><strong>{rank}º</strong></div></div></section><section className="collaborator-card"><div className="section-eyebrow">MISSÕES ATUAIS</div><div className="mini-missions"><div><CheckCircle2 /><span>Atualizar todos os leads no CRM</span><b>+30</b></div><div><Target /><span>Realizar uma reunião</span><b>+70</b></div><div><Medal /><span>Bater a meta semanal</span><b>+200</b></div></div></section></div>
  </section></div>;
}

function SmallStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="collaborator-small-stat"><div>{icon}</div><span>{label}</span><strong>{value}</strong></div>; }
