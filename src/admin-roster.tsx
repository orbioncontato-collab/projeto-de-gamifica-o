import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, ShieldCheck, Users } from "lucide-react";
import "./admin-roster.css";

type Person={id:string;name:string;role:string;email:string;points:number;photo?:string;status:"Ativo"|"Inativo"};
type Entry={personId:string;amount:number;type:"add"|"remove"};
const PEOPLE_KEY="orbion-admin-people-v1";
const ENTRIES_KEY="orbion-admin-entries-v1";
const base:Person[]=[
{id:"joao",name:"João Martins",role:"Closer",email:"joao@orbion.com.br",points:3480,status:"Ativo"},
{id:"amanda",name:"Amanda Silva",role:"SDR",email:"amanda@orbion.com.br",points:3120,status:"Ativo"},
{id:"marcelo",name:"Marcelo Alves",role:"Closer",email:"marcelo@orbion.com.br",points:2950,status:"Ativo"},
{id:"lucas",name:"Lucas Rocha",role:"Closer",email:"lucas@orbion.com.br",points:2700,status:"Ativo"},
{id:"gabriel",name:"Gabriel Lima",role:"SDR",email:"gabriel@orbion.com.br",points:2540,status:"Ativo"},
{id:"carolina",name:"Carolina Melo",role:"Closer",email:"carolina@orbion.com.br",points:2310,status:"Ativo"},
];
function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(v=>v[0]?.toUpperCase()||"").join("")}
function getList<T>(key:string):T[]{try{return JSON.parse(localStorage.getItem(key)||"[]") as T[]}catch{return[]}}
export function AdminRoster(){
 const [host,setHost]=useState<HTMLElement|null>(null); const [people,setPeople]=useState<Person[]>([]); const [entries,setEntries]=useState<Entry[]>([]); const [query,setQuery]=useState("");
 useEffect(()=>{const sync=()=>{const main=document.querySelector<HTMLElement>("main");const title=main?.querySelector("h1")?.textContent||"";if(!main||!title.includes("Gestão da equipe")){setHost(null);return;}let el=main.querySelector<HTMLElement>("[data-admin-roster]");if(!el){el=document.createElement("div");el.dataset.adminRoster="1";const toolbar=main.querySelector("[data-admin-controls]");toolbar?.insertAdjacentElement("afterend",el);if(!toolbar)main.prepend(el);}setHost(el);};const load=()=>{setPeople(getList<Person>(PEOPLE_KEY));setEntries(getList<Entry>(ENTRIES_KEY));};sync();load();const observer=new MutationObserver(()=>requestAnimationFrame(sync));observer.observe(document.body,{childList:true,subtree:true,characterData:true});const timer=window.setInterval(load,700);return()=>{observer.disconnect();clearInterval(timer)}} ,[]);
 const adjustment=useMemo(()=>entries.reduce<Record<string,number>>((a,e)=>{a[e.personId]=(a[e.personId]||0)+(e.type==="add"?e.amount:-e.amount);return a},{}),[entries]);
 const all=[...base,...people].filter(p=>`${p.name} ${p.role} ${p.email}`.toLowerCase().includes(query.toLowerCase()));
 if(!host)return null;
 return createPortal(<section className="admin-roster-section"><div className="admin-roster-head"><div><div className="admin-roster-kicker"><ShieldCheck className="h-4 w-4"/>CADASTRO OPERACIONAL</div><h2>Colaboradores do time</h2><p>As fotos enviadas no cadastro aparecem aqui junto com o saldo atualizado de pontos.</p></div><span><Users className="h-4 w-4"/>{all.length} pessoas</span></div><label className="admin-roster-search"><Search className="h-4 w-4"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar colaborador"/></label><div className="admin-roster-grid">{all.map(person=><article key={person.id}><div className="admin-roster-avatar">{person.photo?<img src={person.photo} alt={person.name}/>:<span>{initials(person.name)}</span>}</div><div className="admin-roster-copy"><strong>{person.name}</strong><span>{person.role}</span><small>{person.email}</small></div><div className="admin-roster-points"><span>Pontos</span><strong>{(person.points+(adjustment[person.id]||0)).toLocaleString("pt-BR")}</strong></div><div className={`admin-roster-status ${person.status==="Ativo"?"active":""}`}>{person.status}</div></article>)}</div></section>,host);
}
