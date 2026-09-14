import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Gift, Sparkles, X } from "lucide-react";
import "./wheel-experience.css";

const WHEEL_KEY = "orbion-wheel-prizes-v2";
const DEFAULT_PREMIUM = ["R$ 50 PIX","500 pontos","R$ 100 PIX","Giro extra","R$ 50 iFood","1.000 pontos","2x pontos","Mystery Box"];
const DEFAULT_CLASSIC = ["R$ 10 PIX","100 pontos","R$ 20 PIX","Giro extra","R$ 30 iFood","200 pontos"];
const SPIN_DURATION = 8200;

function readConfig(){try{const raw=localStorage.getItem(WHEEL_KEY);if(!raw)return {classic:DEFAULT_CLASSIC,premium:DEFAULT_PREMIUM};const parsed=JSON.parse(raw) as {classic?:string[];premium?:string[]};return {classic:parsed.classic?.filter(Boolean).length?parsed.classic.filter(Boolean):DEFAULT_CLASSIC,premium:parsed.premium?.filter(Boolean).length?parsed.premium.filter(Boolean):DEFAULT_PREMIUM}}catch{return {classic:DEFAULT_CLASSIC,premium:DEFAULT_PREMIUM}}}
function wheelPrizes(wheel: HTMLElement) {const config=readConfig();return wheel.classList.contains("premium") ? config.premium : config.classic;}
function segmentBackground(mode:"premium"|"classic",count:number){const premium=["#ffc83d","#855cff","#14293b","#00e887","#ffc83d","#4776ff","#192a39","#ff5252"];const classic=["#4776ff","#14293b","#00e887","#203650","#855cff","#162a3d"];const palette=mode==="premium"?premium:classic;const segment=360/count;const parts=Array.from({length:count},(_,index)=>`${palette[index%palette.length]} ${(index*segment).toFixed(3)}deg ${((index+1)*segment).toFixed(3)}deg`);return `conic-gradient(${parts.join(",")})`;}
function syncPrizeLegend(wheel:HTMLElement,prizes:string[]){const section=wheel.closest("section");if(!section)return;let list=section.querySelector<HTMLElement>("[data-wheel-dynamic-list]");if(!list){list=section.querySelector<HTMLElement>("div.mt-5.grid.grid-cols-2.gap-2");if(list)list.dataset.wheelDynamicList="1"}if(!list)return;list.innerHTML="";prizes.forEach(prize=>{const item=document.createElement("div");item.className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2 text-[11px] font-bold text-[#CBD5E1]";item.textContent=prize;list?.appendChild(item)})}
function buildPrizeLabels(wheel: HTMLElement) {
  const prizes = wheelPrizes(wheel);
  const mode = wheel.classList.contains("premium") ? "premium" : "classic";
  const signature=JSON.stringify(prizes);
  const current = wheel.querySelector<HTMLElement>(":scope > .wheel-prize-layer");
  if (current?.dataset.mode === mode && current.dataset.signature===signature) {syncPrizeLegend(wheel,prizes);return;}
  current?.remove();
  const layer = document.createElement("div");layer.className = "wheel-prize-layer";layer.dataset.mode = mode;layer.dataset.signature=signature;
  prizes.forEach((prize, index) => {const spoke = document.createElement("div");spoke.className = "wheel-prize-spoke";spoke.style.setProperty("--prize-angle", `${((index + 0.5) * 360) / prizes.length}deg`);const label = document.createElement("span");label.className = "wheel-prize-label";label.textContent = prize;spoke.appendChild(label);layer.appendChild(spoke);});
  wheel.appendChild(layer);wheel.classList.add("wheel-enhanced");wheel.style.setProperty("background",segmentBackground(mode,prizes.length),"important");syncPrizeLegend(wheel,prizes);
}
function ensureStatus(wheel: HTMLElement) {const host = wheel.parentElement;if (!host) return null;let status = host.querySelector<HTMLElement>(":scope > .wheel-spin-status");if (!status) {status = document.createElement("div");status.className = "wheel-spin-status";host.appendChild(status);}if (!status.dataset.locked) {const count = wheelPrizes(wheel).length;status.innerHTML = `<span class="wheel-status-dot"></span><strong>${count} PRÊMIOS</strong><span>•</span><span>Ponteiro define o prêmio</span>`;}return status;}

export function WheelExperience() {
  const [won, setWon] = useState<string | null>(null);const [redeemed, setRedeemed] = useState<string | null>(null);const rotation = useRef(0);const spinning = useRef(false);const timers = useRef<number[]>([]);
  useEffect(() => {
    const setup = () => {const wheel = document.querySelector<HTMLElement>(".wheel.premium, .wheel.classic");if (!wheel) return;const mode = wheel.classList.contains("premium") ? "premium" : "classic";if (wheel.dataset.enhancedMode !== mode && !spinning.current) {rotation.current = 0;wheel.style.transition = "none";wheel.style.transform = "rotate(0deg)";wheel.dataset.enhancedMode = mode;}buildPrizeLabels(wheel);ensureStatus(wheel);};
    setup();
    const observer = new MutationObserver(() => window.requestAnimationFrame(setup));observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    const configUpdate=()=>{const wheel=document.querySelector<HTMLElement>(".wheel.premium, .wheel.classic");wheel?.querySelector(":scope > .wheel-prize-layer")?.remove();requestAnimationFrame(setup)};window.addEventListener("orbion-wheel-config-updated",configUpdate);
    const addTimer = (callback: () => void, delay: number) => {const id = window.setTimeout(callback, delay);timers.current.push(id);};
    const handleClick = (event: MouseEvent) => {
      const target = event.target;if (!(target instanceof Element)) return;const button = target.closest("button");if (!button) return;const text = (button.textContent ?? "").trim().toUpperCase();const isModeButton = text.includes("ROLETA CLÁSSICA") || text.includes("ROLETA PREMIUM");
      if (isModeButton && spinning.current) {event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();return;}
      if (!text.includes("GIRAR ROLETA")) return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if (spinning.current) return;
      const wheel = document.querySelector<HTMLElement>(".wheel.premium, .wheel.classic");if (!wheel) return;buildPrizeLabels(wheel);wheel.querySelectorAll(".wheel-prize-spoke.is-selected").forEach((item) => item.classList.remove("is-selected"));
      const prizes = wheelPrizes(wheel);const status = ensureStatus(wheel);const index = Math.floor(Math.random() * prizes.length);const prize = prizes[index] ?? prizes[0] ?? "500 pontos";const segment = 360 / prizes.length;const selectedCenter = index * segment + segment / 2;const targetNormalized = (360 - selectedCenter) % 360;const currentNormalized = ((rotation.current % 360) + 360) % 360;const correction = (targetNormalized - currentNormalized + 360) % 360;
      rotation.current += 360 * 10 + correction;spinning.current = true;setWon(null);wheel.classList.add("wheel-spinning");wheel.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.04, 0.82, 0.12, 1)`;void wheel.offsetWidth;wheel.style.transform = `rotate(${rotation.current}deg)`;button.setAttribute("disabled", "true");button.setAttribute("aria-busy", "true");button.classList.add("wheel-spin-button-active");
      if (status) {status.dataset.locked = "true";status.innerHTML = '<span class="wheel-status-dot is-live"></span><strong>GIRANDO</strong><span>•</span><span>Alta velocidade</span>';}
      addTimer(() => {if (status) status.innerHTML = '<span class="wheel-status-dot is-live"></span><strong>GIRANDO</strong><span>•</span><span>Desacelerando...</span>';}, 4100);
      addTimer(() => {if (status) status.innerHTML = '<span class="wheel-status-dot is-live"></span><strong>QUASE LÁ</strong><span>•</span><span>Definindo prêmio</span>';}, 6800);
      addTimer(() => {spinning.current = false;wheel.classList.remove("wheel-spinning");wheel.style.transition = "none";button.removeAttribute("disabled");button.removeAttribute("aria-busy");button.classList.remove("wheel-spin-button-active");const selectedSpoke = wheel.querySelectorAll<HTMLElement>(".wheel-prize-spoke")[index];selectedSpoke?.classList.add("is-selected");if (status) {status.dataset.locked = "true";status.innerHTML = `<span class="wheel-status-dot is-winner"></span><strong>PRÊMIO CONFIRMADO</strong><span>•</span><span>${prize}</span>`;}setWon(prize);addTimer(() => {if (status) {delete status.dataset.locked;const count = prizes.length;status.innerHTML = `<span class="wheel-status-dot"></span><strong>${count} PRÊMIOS</strong><span>•</span><span>Ponteiro define o prêmio</span>`;}}, 3800);}, SPIN_DURATION);
    };
    document.addEventListener("click", handleClick, true);
    return () => {observer.disconnect();window.removeEventListener("orbion-wheel-config-updated",configUpdate);document.removeEventListener("click", handleClick, true);timers.current.forEach((id) => window.clearTimeout(id));timers.current = [];};
  }, []);
  return <>{won && <div className="wheel-result-backdrop"><div className="wheel-result-confetti" aria-hidden="true">{Array.from({ length: 34 }).map((_, index) => <i key={index} style={{ left: `${(index * 19) % 100}%`, animationDelay: `${(index % 9) * 0.07}s` }} />)}</div><section className="wheel-result-card" role="dialog" aria-modal="true" aria-label="Prêmio da roleta"><button className="wheel-result-close" onClick={() => setWon(null)} aria-label="Fechar"><X className="h-5 w-5" /></button><div className="wheel-result-icon"><Gift className="h-8 w-8" /></div><div className="wheel-result-kicker"><Sparkles className="h-4 w-4" /> PRÊMIO CONFIRMADO</div><h3>Parabéns!</h3><p>O ponteiro parou exatamente em:</p><div className="wheel-result-prize">{won}</div><div className="wheel-result-proof"><CheckCircle2 className="h-4 w-4" /> Mesmo prêmio exibido na roleta</div><button className="wheel-result-redeem" onClick={() => {setRedeemed(won);setWon(null);window.setTimeout(() => setRedeemed(null), 2600);}}>Resgatar recompensa</button></section></div>}{redeemed && <div className="wheel-redeem-toast"><CheckCircle2 className="h-5 w-5" /><div><strong>{redeemed}</strong><span> adicionado às suas recompensas.</span></div></div>}</>;
}
