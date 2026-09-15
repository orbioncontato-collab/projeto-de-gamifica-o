import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Gift, ShieldCheck, Sparkles, X } from "lucide-react";
import "./wheel-experience.css";
import "./wheel-manager-approval.css";
import "./wheel-manager-flow.css";

const WHEEL_KEY = "orbion-wheel-prizes-v2";
const ACTIVE_TURN_KEY = "orbion-wheel-active-v1";
const PENDING_KEY = "orbion-wheel-pending-prize-v1";
const DEFAULT_PREMIUM = ["R$ 50 PIX", "500 pontos", "R$ 100 PIX", "Giro extra", "R$ 50 iFood", "1.000 pontos", "2x pontos", "Mystery Box"];
const DEFAULT_CLASSIC = ["R$ 10 PIX", "100 pontos", "R$ 20 PIX", "Giro extra", "R$ 30 iFood", "200 pontos"];
const SPIN_DURATION = 8200;

type QueueType = "classic" | "premium";
type ActiveTurn = {
  queueId: string;
  personId?: string;
  personName: string;
  type: QueueType;
  startedAt: string;
  attemptsAllowed?: number;
  attemptsUsed?: number;
};
type PendingPrize = {
  queueId: string;
  personName: string;
  type: QueueType;
  prize: string;
  createdAt: string;
};
type SpinResult = {
  prize: string;
  type: QueueType;
  managed: boolean;
  personName?: string;
  queueId?: string;
  createdAt: string;
};

function readConfig() {
  try {
    const raw = localStorage.getItem(WHEEL_KEY);
    if (!raw) return { classic: DEFAULT_CLASSIC, premium: DEFAULT_PREMIUM };
    const parsed = JSON.parse(raw) as { classic?: string[]; premium?: string[] };
    return {
      classic: parsed.classic?.filter(Boolean).length ? parsed.classic.filter(Boolean) : DEFAULT_CLASSIC,
      premium: parsed.premium?.filter(Boolean).length ? parsed.premium.filter(Boolean) : DEFAULT_PREMIUM,
    };
  } catch {
    return { classic: DEFAULT_CLASSIC, premium: DEFAULT_PREMIUM };
  }
}

function readActive(): ActiveTurn | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TURN_KEY);
    return raw ? (JSON.parse(raw) as ActiveTurn) : null;
  } catch {
    return null;
  }
}

function readPending(): PendingPrize | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingPrize) : null;
  } catch {
    return null;
  }
}

function wheelMode(wheel: HTMLElement): QueueType {
  return wheel.classList.contains("premium") ? "premium" : "classic";
}

function wheelPrizes(wheel: HTMLElement) {
  const config = readConfig();
  return wheelMode(wheel) === "premium" ? config.premium : config.classic;
}

function segmentBackground(mode: QueueType, count: number) {
  const premium = ["#ffc83d", "#855cff", "#14293b", "#00e887", "#ffc83d", "#4776ff", "#192a39", "#ff5252"];
  const classic = ["#4776ff", "#14293b", "#00e887", "#203650", "#855cff", "#162a3d"];
  const palette = mode === "premium" ? premium : classic;
  const segment = 360 / count;
  return `conic-gradient(${Array.from({ length: count }, (_, index) => `${palette[index % palette.length]} ${(index * segment).toFixed(3)}deg ${((index + 1) * segment).toFixed(3)}deg`).join(",")})`;
}

function syncPrizeLegend(wheel: HTMLElement, prizes: string[]) {
  const section = wheel.closest("section");
  if (!section) return;
  let list = section.querySelector<HTMLElement>("[data-wheel-dynamic-list]");
  if (!list) {
    list = section.querySelector<HTMLElement>("div.mt-5.grid.grid-cols-2.gap-2");
    if (list) list.dataset.wheelDynamicList = "1";
  }
  if (!list) return;
  const signature = JSON.stringify(prizes);
  if (list.dataset.signature === signature) return;
  list.dataset.signature = signature;
  list.replaceChildren(...prizes.map((prize) => {
    const item = document.createElement("div");
    item.className = "rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2 text-[11px] font-bold text-[#CBD5E1]";
    item.textContent = prize;
    return item;
  }));
}

function buildPrizeLabels(wheel: HTMLElement) {
  const prizes = wheelPrizes(wheel);
  const mode = wheelMode(wheel);
  const signature = JSON.stringify(prizes);
  const current = wheel.querySelector<HTMLElement>(":scope > .wheel-prize-layer");
  if (current?.dataset.mode === mode && current.dataset.signature === signature) return;

  current?.remove();
  const layer = document.createElement("div");
  layer.className = "wheel-prize-layer";
  layer.dataset.mode = mode;
  layer.dataset.signature = signature;
  prizes.forEach((prize, index) => {
    const spoke = document.createElement("div");
    spoke.className = "wheel-prize-spoke";
    spoke.style.setProperty("--prize-angle", `${((index + 0.5) * 360) / prizes.length}deg`);
    const label = document.createElement("span");
    label.className = "wheel-prize-label";
    label.textContent = prize;
    spoke.appendChild(label);
    layer.appendChild(spoke);
  });
  wheel.appendChild(layer);
  wheel.classList.add("wheel-enhanced");
  wheel.style.setProperty("background", segmentBackground(mode, prizes.length), "important");
  syncPrizeLegend(wheel, prizes);
}

function ensureStatus(wheel: HTMLElement) {
  const host = wheel.parentElement;
  if (!host) return null;
  let status = host.querySelector<HTMLElement>(":scope > .wheel-spin-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "wheel-spin-status";
    host.appendChild(status);
  }
  return status;
}

function getSpinButton() {
  const tagged = document.querySelector<HTMLButtonElement>('main button[data-wheel-spin-control="1"]');
  if (tagged) return tagged;
  const candidate = Array.from(document.querySelectorAll<HTMLButtonElement>("main button")).find((button) => {
    const text = (button.textContent || "").toUpperCase();
    return text.includes("GIRAR ROLETA") || text.includes("VER PRÊMIO") || text.includes("AGUARDANDO LIBERAÇÃO");
  });
  if (candidate) candidate.dataset.wheelSpinControl = "1";
  return candidate || null;
}

function selectWheelMode(type: QueueType) {
  const desired = type === "premium" ? "ROLETA PREMIUM" : "ROLETA CLÁSSICA";
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("main button")).find((item) => (item.textContent || "").toUpperCase().includes(desired));
  button?.click();
}

function syncManagerState(wheel: HTMLElement, force = false) {
  const active = readActive();
  let pending = readPending();
  if (pending && (!active || pending.queueId !== active.queueId)) {
    localStorage.removeItem(PENDING_KEY);
    pending = null;
  }

  const mode = wheelMode(wheel);
  if (active && mode !== active.type) {
    selectWheelMode(active.type);
    return;
  }

  const stateSignature = JSON.stringify({
    mode,
    active: active ? [active.queueId, active.personName, active.type, active.attemptsAllowed || 1, active.attemptsUsed || 0] : null,
    pending: pending ? [pending.queueId, pending.prize] : null,
  });
  if (!force && wheel.dataset.managerStateSignature === stateSignature) return;
  wheel.dataset.managerStateSignature = stateSignature;

  const status = ensureStatus(wheel);
  if (status && !status.dataset.locked) {
    if (!active) {
      status.innerHTML = `<span class="wheel-status-dot is-live"></span><strong>GIRO LIVRE</strong><span>•</span><span>${mode === "premium" ? "Roleta Premium" : "Roleta Clássica"}</span>`;
    } else if (pending) {
      status.innerHTML = `<span class="wheel-status-dot is-winner"></span><strong>AGUARDANDO APROVAÇÃO</strong><span>•</span><span>${pending.prize}</span>`;
    } else {
      const used = Number(active.attemptsUsed || 0);
      const allowed = Math.max(1, Number(active.attemptsAllowed || 1));
      status.innerHTML = `<span class="wheel-status-dot is-live"></span><strong>VEZ DE ${active.personName.toUpperCase()}</strong><span>•</span><span>Tentativa ${Math.min(allowed, used + 1)} de ${allowed}</span>`;
    }
  }

  const button = getSpinButton();
  if (button && button.getAttribute("aria-busy") !== "true") {
    button.classList.remove("wheel-spin-locked", "wheel-spin-pending");
    button.disabled = false;
    if (!active) button.textContent = "GIRAR ROLETA";
    else if (pending) {
      button.classList.add("wheel-spin-pending");
      button.textContent = `VER PRÊMIO • ${active.personName}`;
    } else button.textContent = `GIRAR ROLETA • ${active.personName}`;
  }

  const section = wheel.closest("section");
  if (!section) return;
  let banner = section.querySelector<HTMLElement>(":scope > .wheel-manager-context");
  if (!banner) {
    banner = document.createElement("div");
    banner.className = "wheel-manager-context";
    section.prepend(banner);
  }
  if (!active) {
    banner.className = "wheel-manager-context";
    banner.innerHTML = `<div><span>MODO LIVRE</span><strong>Roleta liberada para giro sem fila</strong></div><b>${mode === "premium" ? "ROLETA PREMIUM" : "ROLETA CLÁSSICA"}</b>`;
  } else if (pending) {
    banner.className = "wheel-manager-context pending";
    banner.innerHTML = `<div><span>PRÊMIO AGUARDANDO APROVAÇÃO</span><strong>${active.personName}</strong></div><b>${active.type === "premium" ? "PREMIUM" : "CLÁSSICA"}</b>`;
  } else {
    const used = Number(active.attemptsUsed || 0);
    const allowed = Math.max(1, Number(active.attemptsAllowed || 1));
    banner.className = "wheel-manager-context";
    banner.innerHTML = `<div><span>GIRO VINCULADO À FILA</span><strong>${active.personName} • Tentativa ${Math.min(allowed, used + 1)} de ${allowed}</strong></div><b>${active.type === "premium" ? "ROLETA PREMIUM" : "ROLETA CLÁSSICA"}</b>`;
  }
}

export function WheelExperience() {
  const [won, setWon] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rotation = useRef(0);
  const spinning = useRef(false);
  const timers = useRef<number[]>([]);
  const wheelRef = useRef<HTMLElement | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    const id = window.setTimeout(() => setMessage(null), 2400);
    timers.current.push(id);
  };

  useEffect(() => {
    const setup = (force = false) => {
      const wheel = document.querySelector<HTMLElement>(".wheel.premium, .wheel.classic");
      if (!wheel) {
        wheelRef.current = null;
        return;
      }
      wheelRef.current = wheel;
      const mode = wheelMode(wheel);
      if (wheel.dataset.enhancedMode !== mode && !spinning.current) {
        rotation.current = 0;
        wheel.style.transition = "none";
        wheel.style.transform = "rotate(0deg)";
        wheel.dataset.enhancedMode = mode;
        delete wheel.dataset.managerStateSignature;
      }
      buildPrizeLabels(wheel);
      syncPrizeLegend(wheel, wheelPrizes(wheel));
      syncManagerState(wheel, force);
    };

    const refresh = () => {
      const wheel = wheelRef.current || document.querySelector<HTMLElement>(".wheel.premium, .wheel.classic");
      if (wheel) {
        wheel.querySelector(":scope > .wheel-prize-layer")?.remove();
        delete wheel.dataset.managerStateSignature;
        const status = wheel.parentElement?.querySelector<HTMLElement>(":scope > .wheel-spin-status");
        if (status) delete status.dataset.locked;
      }
      requestAnimationFrame(() => setup(true));
    };

    setup(true);
    const main = document.querySelector("main") || document.body;
    const observer = new MutationObserver(() => {
      if (spinning.current) return;
      requestAnimationFrame(() => setup(false));
    });
    observer.observe(main, { childList: true, subtree: true });

    window.addEventListener("orbion-wheel-config-updated", refresh);
    window.addEventListener("orbion-wheel-turn-changed", refresh);
    window.addEventListener("orbion-wheel-queue-updated", refresh);

    const addTimer = (callback: () => void, delay: number) => {
      const id = window.setTimeout(callback, delay);
      timers.current.push(id);
      return id;
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>("button");
      if (!button) return;
      const text = (button.textContent || "").trim().toUpperCase();
      const active = readActive();
      const pending = readPending();

      const isModeButton = text.includes("ROLETA CLÁSSICA") || text.includes("ROLETA PREMIUM");
      if (isModeButton) {
        if (active) {
          const allowedMode = active.type === "premium" ? text.includes("ROLETA PREMIUM") : text.includes("ROLETA CLÁSSICA");
          if (!allowedMode || spinning.current) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        }
        requestAnimationFrame(() => setup(true));
        return;
      }

      const isSpin = button.dataset.wheelSpinControl === "1" || text.includes("GIRAR ROLETA") || text.includes("VER PRÊMIO") || text.includes("AGUARDANDO LIBERAÇÃO");
      if (!isSpin) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (spinning.current) return;

      if (active && pending && pending.queueId === active.queueId) {
        setWon({ prize: pending.prize, type: pending.type, managed: true, personName: pending.personName, queueId: pending.queueId, createdAt: pending.createdAt });
        return;
      }

      const wheel = wheelRef.current || document.querySelector<HTMLElement>(".wheel.premium, .wheel.classic");
      if (!wheel) return;
      wheelRef.current = wheel;
      const visibleType = wheelMode(wheel);

      if (active && visibleType !== active.type) {
        selectWheelMode(active.type);
        requestAnimationFrame(() => requestAnimationFrame(() => getSpinButton()?.click()));
        return;
      }

      buildPrizeLabels(wheel);
      wheel.querySelectorAll(".wheel-prize-spoke.is-selected").forEach((item) => item.classList.remove("is-selected"));
      const prizes = wheelPrizes(wheel);
      const status = ensureStatus(wheel);
      const index = Math.floor(Math.random() * prizes.length);
      const prize = prizes[index] ?? prizes[0] ?? "500 pontos";
      const segment = 360 / prizes.length;
      const selectedCenter = index * segment + segment / 2;
      const targetNormalized = (360 - selectedCenter) % 360;
      const currentNormalized = ((rotation.current % 360) + 360) % 360;
      const correction = (targetNormalized - currentNormalized + 360) % 360;
      const label = active?.personName || "Giro livre";
      const resultMode = active?.type || visibleType;

      rotation.current += 360 * 10 + correction;
      spinning.current = true;
      setWon(null);
      wheel.classList.add("wheel-spinning");
      wheel.style.willChange = "transform";
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.classList.add("wheel-spin-button-active");
      button.textContent = active ? `GIRANDO • ${active.personName}` : "GIRANDO...";
      if (status) {
        status.dataset.locked = "true";
        status.innerHTML = `<span class="wheel-status-dot is-live"></span><strong>${label.toUpperCase()}</strong><span>•</span><span>Girando em alta velocidade</span>`;
      }

      let finalized = false;
      let fallbackId = 0;
      const finalize = () => {
        if (finalized) return;
        finalized = true;
        if (fallbackId) window.clearTimeout(fallbackId);
        spinning.current = false;
        wheel.classList.remove("wheel-spinning");
        wheel.style.transition = "none";
        wheel.style.willChange = "auto";
        button.removeAttribute("aria-busy");
        button.classList.remove("wheel-spin-button-active");
        wheel.querySelectorAll<HTMLElement>(".wheel-prize-spoke")[index]?.classList.add("is-selected");

        const createdAt = new Date().toISOString();
        if (active) {
          const result: PendingPrize = { queueId: active.queueId, personName: active.personName, type: active.type, prize, createdAt };
          localStorage.setItem(PENDING_KEY, JSON.stringify(result));
          if (status) {
            status.dataset.locked = "true";
            status.innerHTML = `<span class="wheel-status-dot is-winner"></span><strong>PRÊMIO AGUARDANDO APROVAÇÃO</strong><span>•</span><span>${prize}</span>`;
          }
          setWon({ prize, type: active.type, managed: true, personName: active.personName, queueId: active.queueId, createdAt });
        } else {
          if (status) {
            status.dataset.locked = "true";
            status.innerHTML = `<span class="wheel-status-dot is-winner"></span><strong>RESULTADO DO GIRO LIVRE</strong><span>•</span><span>${prize}</span>`;
          }
          setWon({ prize, type: resultMode, managed: false, createdAt });
        }
        delete wheel.dataset.managerStateSignature;
        requestAnimationFrame(() => syncManagerState(wheel, true));
      };

      const onTransitionEnd = (transitionEvent: TransitionEvent) => {
        if (transitionEvent.target === wheel && transitionEvent.propertyName === "transform") finalize();
      };
      wheel.addEventListener("transitionend", onTransitionEnd, { once: true });

      requestAnimationFrame(() => {
        wheel.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.04, 0.82, 0.12, 1)`;
        wheel.style.transform = `rotate(${rotation.current}deg)`;
        addTimer(() => {
          if (status && spinning.current) status.innerHTML = `<span class="wheel-status-dot is-live"></span><strong>${label.toUpperCase()}</strong><span>•</span><span>Desacelerando...</span>`;
        }, 3900);
        addTimer(() => {
          if (status && spinning.current) status.innerHTML = '<span class="wheel-status-dot is-live"></span><strong>QUASE LÁ</strong><span>•</span><span>Definindo prêmio</span>';
        }, 6800);
        fallbackId = addTimer(finalize, SPIN_DURATION + 180);
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("orbion-wheel-config-updated", refresh);
      window.removeEventListener("orbion-wheel-turn-changed", refresh);
      window.removeEventListener("orbion-wheel-queue-updated", refresh);
      document.removeEventListener("click", handleClick, true);
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, []);

  const approve = () => {
    if (!won?.managed || !won.queueId || !won.personName) return;
    localStorage.removeItem(PENDING_KEY);
    window.dispatchEvent(new CustomEvent("orbion-wheel-prize-approved", {
      detail: { queueId: won.queueId, personName: won.personName, type: won.type, prize: won.prize },
    }));
    flash(`${won.prize} aprovado para ${won.personName}.`);
    setWon(null);
    requestAnimationFrame(() => {
      const wheel = wheelRef.current || document.querySelector<HTMLElement>(".wheel.premium, .wheel.classic");
      if (!wheel) return;
      const status = ensureStatus(wheel);
      if (status) delete status.dataset.locked;
      delete wheel.dataset.managerStateSignature;
      syncManagerState(wheel, true);
    });
  };

  const closeFreeResult = () => {
    setWon(null);
    requestAnimationFrame(() => {
      const wheel = wheelRef.current || document.querySelector<HTMLElement>(".wheel.premium, .wheel.classic");
      if (!wheel) return;
      const status = ensureStatus(wheel);
      if (status) delete status.dataset.locked;
      delete wheel.dataset.managerStateSignature;
      syncManagerState(wheel, true);
    });
  };

  const resultModal = won ? <div className="wheel-result-backdrop">
    <div className="wheel-result-confetti" aria-hidden="true">{Array.from({ length: 22 }).map((_, index) => <i key={index} style={{ left: `${(index * 23) % 100}%`, animationDelay: `${(index % 7) * .07}s` }} />)}</div>
    <section className="wheel-result-card" role="dialog" aria-modal="true" aria-label="Prêmio da roleta">
      <button className="wheel-result-close" onClick={() => won.managed ? setWon(null) : closeFreeResult()} aria-label="Fechar"><X className="h-5 w-5" /></button>
      <div className="wheel-result-icon"><Gift className="h-8 w-8" /></div>
      <div className="wheel-result-kicker"><Sparkles className="h-4 w-4" /> PRÊMIO SORTEADO</div>
      <h3>{won.managed ? `Parabéns, ${won.personName}!` : "Resultado do giro livre"}</h3>
      <p>O ponteiro parou exatamente em:</p>
      <div className="wheel-result-prize">{won.prize}</div>
      <div className="wheel-result-manager-meta">
        <div><span>Modo</span><strong>{won.managed ? "Giro pela fila" : "Giro livre"}</strong></div>
        <div><span>Tipo de giro</span><strong>{won.type === "premium" ? "Roleta Premium" : "Roleta Clássica"}</strong></div>
      </div>
      <div className="wheel-result-proof"><CheckCircle2 className="h-4 w-4" />Mesmo prêmio exibido no setor da roleta</div>
      {won.managed ? <>
        <div className="wheel-result-approval-note"><ShieldCheck className="mr-1 inline h-4 w-4" />A pessoa continua na fila até você aprovar este resultado.</div>
        <button className="wheel-result-redeem" onClick={approve}>Aprovar prêmio e concluir giro</button>
        <button className="wheel-result-secondary" onClick={() => setWon(null)}>Fechar sem aprovar</button>
      </> : <button className="wheel-result-redeem" onClick={closeFreeResult}>Concluir giro livre</button>}
    </section>
  </div> : null;

  return <>
    {typeof document !== "undefined" && resultModal ? createPortal(resultModal, document.body) : null}
    {message && <div className="wheel-redeem-toast"><ShieldCheck className="h-5 w-5" /><div><strong>Controle do gestor</strong><span> {message}</span></div></div>}
  </>;
}
