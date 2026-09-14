import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CirclePlus, Dices, Play, Search, ShieldCheck, Trash2, UserPlus, Users, Zap } from "lucide-react";
import "./wheel-queue.css";

type QueueType = "classic" | "premium";
type Person = { id: string; name: string; role: string; photo?: string; status?: string };
type QueueEntry = { id: string; personId?: string; personName: string; type: QueueType; createdAt: string; source: "manual" | "earned" };
type ActiveTurn = { queueId: string; personId?: string; personName: string; type: QueueType; startedAt: string };
type Approval = { id: string; personName: string; type: QueueType; prize: string; approvedAt: string };

export const QUEUE_KEY = "orbion-wheel-queue-v1";
export const ACTIVE_TURN_KEY = "orbion-wheel-active-v1";
export const WHEEL_HISTORY_KEY = "orbion-wheel-history-v1";
const PEOPLE_KEY = "orbion-admin-people-v1";
const OVERRIDES_KEY = "orbion-admin-people-overrides-v2";

const basePeople: Person[] = [
  { id: "joao", name: "João Martins", role: "SDR", status: "Ativo" },
  { id: "amanda", name: "Amanda Silva", role: "Closer", status: "Ativo" },
  { id: "marcelo", name: "Marcelo Alves", role: "SDR", status: "Ativo" },
  { id: "lucas", name: "Lucas Rocha", role: "Closer", status: "Ativo" },
  { id: "gabriel", name: "Gabriel Lima", role: "SDR", status: "Ativo" },
  { id: "carolina", name: "Carolina Melo", role: "Closer", status: "Ativo" },
];

function readList<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) || "[]") as T[]; } catch { return []; } }
function readMap<T>(key: string): Record<string, T> { try { return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, T>; } catch { return {}; } }
function readActive(): ActiveTurn | null { try { const raw = localStorage.getItem(ACTIVE_TURN_KEY); return raw ? JSON.parse(raw) as ActiveTurn : null; } catch { return null; } }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(v => v[0]?.toUpperCase() || "").join(""); }

export function WheelQueue() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>(() => readList<QueueEntry>(QUEUE_KEY));
  const [active, setActive] = useState<ActiveTurn | null>(() => readActive());
  const [history, setHistory] = useState<Approval[]>(() => readList<Approval>(WHEEL_HISTORY_KEY));
  const [customPeople, setCustomPeople] = useState<Person[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<Person>>>({});
  const [personId, setPersonId] = useState("joao");
  const [manualName, setManualName] = useState("");
  const [type, setType] = useState<QueueType>("classic");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const people = useMemo(() => {
    const base = basePeople.map(person => ({ ...person, ...(overrides[person.id] || {}) }));
    return [...base, ...customPeople].filter(person => person.status !== "Inativo");
  }, [customPeople, overrides]);

  useEffect(() => {
    const sync = () => {
      const main = document.querySelector<HTMLElement>("main");
      const title = main?.querySelector("h1")?.textContent || "";
      if (!main || !title.includes("Central de Roletas")) { setHost(null); return; }
      let target = main.querySelector<HTMLElement>("[data-wheel-queue]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.wheelQueue = "1";
        main.append(target);
      }
      setHost(target);
    };
    const loadPeople = () => {
      setCustomPeople(readList<Person>(PEOPLE_KEY));
      setOverrides(readMap<Partial<Person>>(OVERRIDES_KEY));
      setQueue(readList<QueueEntry>(QUEUE_KEY));
      setActive(readActive());
      setHistory(readList<Approval>(WHEEL_HISTORY_KEY));
    };
    const approve = (event: Event) => {
      const detail = (event as CustomEvent<{ queueId: string; personName: string; type: QueueType; prize: string }>).detail;
      if (!detail) return;
      setQueue(current => {
        const next = current.filter(item => item.id !== detail.queueId);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
        return next;
      });
      localStorage.removeItem(ACTIVE_TURN_KEY);
      setActive(null);
      const approved: Approval = { id: `approval-${Date.now()}`, personName: detail.personName, type: detail.type, prize: detail.prize, approvedAt: new Date().toISOString() };
      setHistory(current => {
        const next = [approved, ...current].slice(0, 20);
        localStorage.setItem(WHEEL_HISTORY_KEY, JSON.stringify(next));
        return next;
      });
      flash(`${detail.personName} aprovado. A pessoa saiu da fila.`);
    };
    sync(); loadPeople();
    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(loadPeople, 1000);
    window.addEventListener("orbion-wheel-prize-approved", approve);
    return () => { observer.disconnect(); window.clearInterval(timer); window.removeEventListener("orbion-wheel-prize-approved", approve); };
  }, []);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 2600); };
  const persist = (next: QueueEntry[]) => { setQueue(next); localStorage.setItem(QUEUE_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent("orbion-wheel-queue-updated")); };
  const addExisting = () => {
    const person = people.find(item => item.id === personId);
    if (!person) return;
    persist([...queue, { id: `queue-${Date.now()}`, personId: person.id, personName: person.name, type, createdAt: new Date().toISOString(), source: "earned" }]);
    flash(`${person.name} adicionado à fila.`);
  };
  const addManual = () => {
    if (!manualName.trim()) return flash("Digite o nome da pessoa para adicionar manualmente.");
    persist([...queue, { id: `queue-${Date.now()}`, personName: manualName.trim(), type, createdAt: new Date().toISOString(), source: "manual" }]);
    setManualName("");
    flash("Pessoa adicionada manualmente à fila.");
  };
  const changeType = (id: string, nextType: QueueType) => persist(queue.map(item => item.id === id ? { ...item, type: nextType } : item));
  const remove = (id: string) => {
    if (active?.queueId === id) { localStorage.removeItem(ACTIVE_TURN_KEY); setActive(null); }
    persist(queue.filter(item => item.id !== id));
  };
  const release = (entry: QueueEntry) => {
    const next: ActiveTurn = { queueId: entry.id, personId: entry.personId, personName: entry.personName, type: entry.type, startedAt: new Date().toISOString() };
    localStorage.setItem(ACTIVE_TURN_KEY, JSON.stringify(next));
    setActive(next);
    window.dispatchEvent(new CustomEvent("orbion-wheel-turn-changed", { detail: next }));
    selectWheelMode(entry.type);
    flash(`Vez de ${entry.personName}. ${entry.type === "premium" ? "Roleta Premium" : "Roleta Clássica"} liberada.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const visibleQueue = queue.filter(item => item.personName.toLowerCase().includes(search.toLowerCase()));
  if (!host) return toast ? <div className="wheel-queue-toast"><Check />{toast}</div> : null;
  return <>{createPortal(<section className="wheel-queue-shell">
    <div className="wheel-queue-head"><div><span><ShieldCheck /> CONTROLE DO GESTOR</span><h2>Fila de giros</h2><p>Você decide quem gira, qual roleta será usada e quando o prêmio será aprovado.</p></div><div className={`wheel-active-badge ${active ? "live" : ""}`}><i />{active ? `Vez de ${active.personName}` : "Nenhum giro liberado"}</div></div>

    <div className="wheel-queue-add-grid">
      <section className="wheel-queue-add-card"><div className="queue-add-title"><Users /><div><strong>Adicionar colaborador</strong><span>Use alguém já cadastrado no time.</span></div></div><div className="queue-add-fields"><select value={personId} onChange={e => setPersonId(e.target.value)}>{people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select><WheelType value={type} onChange={setType} /><button onClick={addExisting}><CirclePlus />Adicionar à fila</button></div></section>
      <section className="wheel-queue-add-card"><div className="queue-add-title"><UserPlus /><div><strong>Cadastro manual na fila</strong><span>Para convidado ou pessoa ainda não cadastrada.</span></div></div><div className="queue-add-fields"><input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Nome da pessoa" /><WheelType value={type} onChange={setType} /><button onClick={addManual}><CirclePlus />Adicionar manualmente</button></div></section>
    </div>

    <div className="wheel-queue-toolbar"><div className="queue-search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar na fila" /></div><span>{queue.length} {queue.length === 1 ? "pessoa aguardando" : "pessoas aguardando"}</span></div>

    {visibleQueue.length === 0 ? <div className="wheel-queue-empty"><Dices /><strong>Fila vazia</strong><span>Adicione alguém acima quando quiser liberar um giro.</span></div> : <div className="wheel-queue-list">{visibleQueue.map((entry, index) => {
      const isActive = active?.queueId === entry.id;
      return <article key={entry.id} className={isActive ? "active" : ""}><div className="queue-position">{String(index + 1).padStart(2, "0")}</div><div className="queue-avatar"><span>{initials(entry.personName)}</span></div><div className="queue-person"><strong>{entry.personName}</strong><span>{entry.source === "manual" ? "Adicionado manualmente" : "Colaborador do time"} · {new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div><select value={entry.type} disabled={isActive} onChange={e => changeType(entry.id, e.target.value as QueueType)}><option value="classic">Roleta Clássica</option><option value="premium">Roleta Premium</option></select><button className={`release ${isActive ? "released" : ""}`} disabled={!!active && !isActive} onClick={() => !isActive && release(entry)}>{isActive ? <><Zap />Liberado</> : <><Play />Liberar giro</>}</button><button className="remove" onClick={() => remove(entry.id)} title="Remover da fila"><Trash2 /></button></article>;
    })}</div>}

    {history.length > 0 && <section className="wheel-queue-history"><div><span>ÚLTIMAS APROVAÇÕES</span><h3>Prêmios concluídos</h3></div><div>{history.slice(0, 4).map(item => <article key={item.id}><Check /><div><strong>{item.personName}</strong><span>{item.prize} · {item.type === "premium" ? "Premium" : "Clássica"}</span></div><time>{new Date(item.approvedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></article>)}</div></section>}
  </section>, host)}{toast && <div className="wheel-queue-toast"><Check />{toast}</div>}</>;
}

function WheelType({ value, onChange }: { value: QueueType; onChange: (value: QueueType) => void }) { return <select value={value} onChange={e => onChange(e.target.value as QueueType)}><option value="classic">Roleta Clássica</option><option value="premium">Roleta Premium</option></select>; }

function selectWheelMode(type: QueueType) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("main button"));
  const desired = type === "premium" ? "ROLETA PREMIUM" : "ROLETA CLÁSSICA";
  const button = buttons.find(item => (item.textContent || "").toUpperCase().includes(desired));
  button?.click();
}
