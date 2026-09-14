import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CirclePlus, Lock, Play, Unlock, UserPlus, Users, Zap } from "lucide-react";
import "./wheel-quick-queue.css";

type QueueType = "classic" | "premium";
type Person = { id: string; name: string; role: string; status?: string };
type QueueEntry = { id: string; personId?: string; personName: string; type: QueueType; createdAt: string; source: "manual" | "earned"; attemptsAllowed?: number; attemptsUsed?: number };
type ActiveTurn = { queueId: string; personId?: string; personName: string; type: QueueType; startedAt: string; attemptsAllowed?: number; attemptsUsed?: number };

const QUEUE_KEY = "orbion-wheel-queue-v1";
const ACTIVE_TURN_KEY = "orbion-wheel-active-v1";
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
function maxAttempts(entry: QueueEntry | ActiveTurn) { return Math.max(1, Number(entry.attemptsAllowed || 1)); }
function usedAttempts(entry: QueueEntry | ActiveTurn) { return Math.max(0, Number(entry.attemptsUsed || 0)); }

export function WheelQuickQueue() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [active, setActive] = useState<ActiveTurn | null>(null);
  const [customPeople, setCustomPeople] = useState<Person[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<Person>>>({});
  const [personId, setPersonId] = useState("joao");
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [type, setType] = useState<QueueType>("classic");
  const [attemptsUnlocked, setAttemptsUnlocked] = useState(false);
  const [attempts, setAttempts] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const people = useMemo(() => {
    const merged = basePeople.map(person => ({ ...person, ...(overrides[person.id] || {}) }));
    return [...merged, ...customPeople].filter(person => person.status !== "Inativo");
  }, [customPeople, overrides]);

  useEffect(() => {
    const syncHost = () => {
      const main = document.querySelector<HTMLElement>("main");
      const title = main?.querySelector("h1")?.textContent || "";
      if (!main || !title.includes("Central de Roletas")) { setHost(null); return; }
      let target = main.querySelector<HTMLElement>("[data-wheel-quick-queue]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.wheelQuickQueue = "1";
        const heading = main.querySelector("h1")?.parentElement?.parentElement;
        if (heading && heading.parentElement === main) heading.insertAdjacentElement("afterend", target);
        else main.prepend(target);
      }
      setHost(target);
    };
    const load = () => {
      setQueue(readList<QueueEntry>(QUEUE_KEY).map(item => ({ ...item, attemptsAllowed: maxAttempts(item), attemptsUsed: usedAttempts(item) })));
      setActive(readActive());
      setCustomPeople(readList<Person>(PEOPLE_KEY));
      setOverrides(readMap<Partial<Person>>(OVERRIDES_KEY));
    };
    syncHost(); load();
    const observer = new MutationObserver(() => requestAnimationFrame(syncHost));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(load, 650);
    window.addEventListener("orbion-wheel-queue-updated", load);
    window.addEventListener("orbion-wheel-turn-changed", load);
    return () => { observer.disconnect(); window.clearInterval(timer); window.removeEventListener("orbion-wheel-queue-updated", load); window.removeEventListener("orbion-wheel-turn-changed", load); };
  }, []);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 2400); };
  const saveQueue = (next: QueueEntry[]) => { localStorage.setItem(QUEUE_KEY, JSON.stringify(next)); setQueue(next); window.dispatchEvent(new CustomEvent("orbion-wheel-queue-updated")); };
  const attemptsAllowed = attemptsUnlocked ? Math.max(1, Math.min(20, attempts)) : 1;

  const add = () => {
    let personName = ""; let selectedId: string | undefined; let source: "manual" | "earned" = "earned";
    if (manual) {
      personName = manualName.trim(); source = "manual";
      if (!personName) return flash("Digite o nome da pessoa.");
    } else {
      const person = people.find(item => item.id === personId);
      if (!person) return flash("Selecione um colaborador.");
      personName = person.name; selectedId = person.id;
    }
    const entry: QueueEntry = { id: `queue-${Date.now()}`, personId: selectedId, personName, type, source, createdAt: new Date().toISOString(), attemptsAllowed, attemptsUsed: 0 };
    saveQueue([...queue, entry]); setManualName("");
    flash(`${personName} entrou na fila com ${attemptsAllowed} tentativa${attemptsAllowed === 1 ? "" : "s"}.`);
  };

  const release = (entry: QueueEntry) => {
    if (active && active.queueId !== entry.id) return flash(`Finalize a vez de ${active.personName} antes de liberar outra pessoa.`);
    const turn: ActiveTurn = { queueId: entry.id, personId: entry.personId, personName: entry.personName, type: entry.type, startedAt: new Date().toISOString(), attemptsAllowed: maxAttempts(entry), attemptsUsed: usedAttempts(entry) };
    localStorage.setItem(ACTIVE_TURN_KEY, JSON.stringify(turn)); setActive(turn);
    window.dispatchEvent(new CustomEvent("orbion-wheel-turn-changed", { detail: turn }));
    selectWheelMode(entry.type);
    flash(`${entry.personName}: tentativa ${usedAttempts(entry) + 1} de ${maxAttempts(entry)} liberada.`);
  };

  if (!host) return toast ? <div className="wheel-quick-toast"><Check />{toast}</div> : null;
  return <>{createPortal(<section className="wheel-quick-panel">
    <div className="wheel-quick-head"><div><span>CONTROLE RÁPIDO DO GESTOR</span><h2>Adicionar à fila da roleta</h2><p>Cadastre, defina a roleta e libere o giro sem sair do quadro principal.</p></div><div className={`wheel-quick-status ${active ? "live" : ""}`}><i />{active ? `Vez de ${active.personName}` : `${queue.length} na fila`}</div></div>

    <div className="wheel-quick-controls">
      <div className="wheel-quick-source"><button className={!manual ? "active" : ""} onClick={() => setManual(false)}><Users />Colaborador</button><button className={manual ? "active" : ""} onClick={() => setManual(true)}><UserPlus />Manual</button></div>
      {manual ? <input className="wheel-quick-input" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Nome da pessoa" /> : <select className="wheel-quick-input" value={personId} onChange={e => setPersonId(e.target.value)}>{people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select>}
      <select className="wheel-quick-input" value={type} onChange={e => setType(e.target.value as QueueType)}><option value="classic">Roleta Clássica</option><option value="premium">Roleta Premium</option></select>
      <div className="wheel-quick-attempts"><button className={attemptsUnlocked ? "unlocked" : ""} onClick={() => { setAttemptsUnlocked(value => !value); if (attemptsUnlocked) setAttempts(1); }} title="Destravar mais tentativas">{attemptsUnlocked ? <Unlock /> : <Lock />}</button><input type="number" min="1" max="20" disabled={!attemptsUnlocked} value={attemptsUnlocked ? attempts : 1} onChange={e => setAttempts(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /><span>tentativa{attemptsAllowed === 1 ? "" : "s"}</span></div>
      <button className="wheel-quick-add" onClick={add}><CirclePlus />Adicionar à fila</button>
    </div>
    <div className="wheel-quick-lock-note">{attemptsUnlocked ? <><Unlock />Limite destravado. Você pode liberar até 20 tentativas para esta entrada.</> : <><Lock />Padrão protegido em 1 tentativa. Clique no cadeado para permitir mais.</>}</div>

    {queue.length > 0 && <div className="wheel-quick-line">{queue.slice(0, 4).map(entry => {
      const isActive = active?.queueId === entry.id;
      const remaining = Math.max(0, maxAttempts(entry) - usedAttempts(entry));
      return <article key={entry.id} className={isActive ? "active" : ""}><div><strong>{entry.personName}</strong><span>{entry.type === "premium" ? "Premium" : "Clássica"} · {remaining} tentativa{remaining === 1 ? "" : "s"} restante{remaining === 1 ? "" : "s"}</span></div><button disabled={!!active && !isActive} onClick={() => release(entry)}>{isActive ? <><Zap />Liberado</> : <><Play />Liberar giro</>}</button></article>;
    })}{queue.length > 4 && <div className="wheel-quick-more">+{queue.length - 4} na fila</div>}</div>}
  </section>, host)}{toast && <div className="wheel-quick-toast"><Check />{toast}</div>}</>;
}

function selectWheelMode(type: QueueType) {
  const desired = type === "premium" ? "ROLETA PREMIUM" : "ROLETA CLÁSSICA";
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("main button")).find(item => (item.textContent || "").toUpperCase().includes(desired));
  button?.click();
}
