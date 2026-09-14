import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { Camera, CheckCircle2, History, Minus, Plus, ShieldCheck, UserPlus, X, Zap } from "lucide-react";
import "./admin-experience.css";

type AdminPage = "dashboard" | "team" | "points" | null;
type Person = { id:string; name:string; role:string; email:string; points:number; photo?:string; status:"Ativo"|"Inativo" };
type Entry = { id:string; personId:string; personName:string; amount:number; type:"add"|"remove"; reason:string; createdAt:string };

const PEOPLE_KEY = "orbion-admin-people-v1";
const ENTRIES_KEY = "orbion-admin-entries-v1";
const basePeople: Person[] = [
  { id:"joao", name:"João Martins", role:"Closer", email:"joao@orbion.com.br", points:3480, status:"Ativo" },
  { id:"amanda", name:"Amanda Silva", role:"SDR", email:"amanda@orbion.com.br", points:3120, status:"Ativo" },
  { id:"marcelo", name:"Marcelo Alves", role:"Closer", email:"marcelo@orbion.com.br", points:2950, status:"Ativo" },
  { id:"lucas", name:"Lucas Rocha", role:"Closer", email:"lucas@orbion.com.br", points:2700, status:"Ativo" },
  { id:"gabriel", name:"Gabriel Lima", role:"SDR", email:"gabriel@orbion.com.br", points:2540, status:"Ativo" },
  { id:"carolina", name:"Carolina Melo", role:"Closer", email:"carolina@orbion.com.br", points:2310, status:"Ativo" },
];

function read<T>(key:string, fallback:T):T { try { const value=localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function pageFromTitle(title:string):AdminPage { if(title.includes("Central de Gestão")) return "dashboard"; if(title.includes("Gestão da equipe")) return "team"; if(title.includes("Configuração de pontos")) return "points"; return null; }
function initials(name:string){ return name.trim().split(/\s+/).slice(0,2).map(v=>v[0]?.toUpperCase()||"").join("")||"US"; }

export function AdminExperience(){
  const [page,setPage]=useState<AdminPage>(null);
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [people,setPeople]=useState<Person[]>(()=>read(PEOPLE_KEY,[]));
  const [entries,setEntries]=useState<Entry[]>(()=>read(ENTRIES_KEY,[]));
  const [modal,setModal]=useState<"person"|"points"|"history"|null>(null);
  const [toast,setToast]=useState<string|null>(null);
  const all=useMemo(()=>[...basePeople,...people],[people]);
  const adjustments=useMemo(()=>entries.reduce<Record<string,number>>((acc,e)=>{ acc[e.personId]=(acc[e.personId]||0)+(e.type==="add"?e.amount:-e.amount); return acc; },{}),[entries]);
  const balance=(person:Person)=>person.points+(adjustments[person.id]||0);

  useEffect(()=>{
    const sync=()=>{
      const main=document.querySelector<HTMLElement>("main");
      const title=main?.querySelector("h1")?.textContent||"";
      const current=pageFromTitle(title);
      setPage(current);
      if(!main||!current){ setHost(null); return; }
      let el=main.querySelector<HTMLElement>("[data-admin-controls]");
      if(!el){ el=document.createElement("div"); el.dataset.adminControls="1"; main.prepend(el); }
      setHost(el);
    };
    sync();
    const observer=new MutationObserver(()=>requestAnimationFrame(sync));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    const click=(event:MouseEvent)=>{
      const target=event.target;
      if(!(target instanceof Element)) return;
      const button=target.closest("button");
      if((button?.textContent||"").includes("Adicionar colaborador")){
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); setModal("person");
      }
    };
    document.addEventListener("click",click,true);
    return()=>{ observer.disconnect(); document.removeEventListener("click",click,true); };
  },[]);

  const savePerson=(person:Person)=>{ const next=[...people,person]; setPeople(next); localStorage.setItem(PEOPLE_KEY,JSON.stringify(next)); setModal(null); setToast(`${person.name} cadastrado com sucesso.`); setTimeout(()=>setToast(null),2600); };
  const saveEntry=(entry:Entry)=>{ const next=[entry,...entries]; setEntries(next); localStorage.setItem(ENTRIES_KEY,JSON.stringify(next)); setModal(null); setToast(`${entry.type==="add"?"+":"-"}${entry.amount} pontos lançados para ${entry.personName}.`); setTimeout(()=>setToast(null),2600); };

  return <>
    {page&&host&&createPortal(<AdminBar page={page} people={all} entries={entries} balance={balance} onPerson={()=>setModal("person")} onPoints={()=>setModal("points")} onHistory={()=>setModal("history")} />,host)}
    {modal==="person"&&<PersonModal onClose={()=>setModal(null)} onSave={savePerson}/>} 
    {modal==="points"&&<PointsModal people={all} balance={balance} onClose={()=>setModal(null)} onSave={saveEntry}/>} 
    {modal==="history"&&<HistoryModal entries={entries} onClose={()=>setModal(null)}/>} 
    {toast&&<div className="admin-toast"><CheckCircle2 className="h-5 w-5"/>{toast}</div>}
  </>;
}

function AdminBar({page,people,entries,balance,onPerson,onPoints,onHistory}:{page:Exclude<AdminPage,null>;people:Person[];entries:Entry[];balance:(p:Person)=>number;onPerson:()=>void;onPoints:()=>void;onHistory:()=>void}){
  const total=people.reduce((sum,p)=>sum+balance(p),0);
  return <section className="admin-bar">
    <div><div className="admin-kicker"><ShieldCheck className="h-4 w-4"/>ADMINISTRAÇÃO OPERACIONAL</div><h2>Gestão prática do time</h2><p>Cadastre colaboradores com foto e faça lançamentos manuais de pontuação.</p></div>
    <div className="admin-bar-actions"><button className="primary" onClick={onPerson}><UserPlus className="h-4 w-4"/>Cadastrar colaborador</button><button onClick={onPoints}><Zap className="h-4 w-4"/>Lançar pontos</button><button onClick={onHistory}><History className="h-4 w-4"/>Histórico</button></div>
    <div className="admin-bar-stats"><div><strong>{people.length}</strong><span>colaboradores</span></div><div><strong>{total.toLocaleString("pt-BR")}</strong><span>pontos atuais</span></div><div><strong>{entries.length}</strong><span>lançamentos</span></div><div><strong>{page==="dashboard"?"Geral":page==="team"?"Equipe":"Pontos"}</strong><span>módulo</span></div></div>
  </section>;
}

function PersonModal({onClose,onSave}:{onClose:()=>void;onSave:(p:Person)=>void}){
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [role,setRole]=useState("SDR"); const [points,setPoints]=useState("0"); const [status,setStatus]=useState<"Ativo"|"Inativo">("Ativo"); const [photo,setPhoto]=useState<string>(); const [error,setError]=useState<string|null>(null);
  const photoChange=(event:ChangeEvent<HTMLInputElement>)=>{ const file=event.target.files?.[0]; if(!file)return; if(!file.type.startsWith("image/")||file.size>1500000){setError("Use uma imagem JPG, PNG ou WEBP de até 1,5 MB.");return;} const reader=new FileReader(); reader.onload=()=>{if(typeof reader.result==="string")setPhoto(reader.result)}; reader.readAsDataURL(file); setError(null); };
  const submit=()=>{ if(!name.trim())return setError("Informe o nome."); if(!email.includes("@"))return setError("Informe um e-mail válido."); onSave({id:`custom-${Date.now()}`,name:name.trim(),email:email.trim(),role,points:Math.max(0,Number(points)||0),status,photo}); };
  return <Modal title="Cadastrar colaborador" subtitle="Esses dados ficam salvos no navegador para demonstração do MVP." onClose={onClose} wide>
    <div className="admin-person-form"><div className="photo-column"><div className="photo-preview">{photo?<img src={photo} alt="Prévia"/>:<><Camera className="h-8 w-8"/><span>{name?initials(name):"Foto"}</span></>}</div><label className="photo-button"><Camera className="h-4 w-4"/>Selecionar foto<input type="file" accept="image/*" onChange={photoChange}/></label><small>Até 1,5 MB</small></div>
    <div className="fields"><Field label="Nome completo"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do colaborador"/></Field><Field label="E-mail"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@empresa.com.br"/></Field><div className="two"><Field label="Cargo"><select value={role} onChange={e=>setRole(e.target.value)}><option>SDR</option><option>Closer</option><option>Social Seller</option><option>Supervisor Comercial</option><option>Gestor</option></select></Field><Field label="Status"><select value={status} onChange={e=>setStatus(e.target.value as "Ativo"|"Inativo")}><option>Ativo</option><option>Inativo</option></select></Field></div><Field label="Pontos iniciais"><input type="number" min="0" value={points} onChange={e=>setPoints(e.target.value)}/></Field></div></div>
    {error&&<div className="admin-error">{error}</div>}<Footer onClose={onClose} onSave={submit} label="Cadastrar colaborador" icon={<UserPlus className="h-4 w-4"/>}/>
  </Modal>;
}

function PointsModal({people,balance,onClose,onSave}:{people:Person[];balance:(p:Person)=>number;onClose:()=>void;onSave:(e:Entry)=>void}){
  const [personId,setPersonId]=useState(people[0]?.id||""); const [type,setType]=useState<"add"|"remove">("add"); const [amount,setAmount]=useState("100"); const [reason,setReason]=useState(""); const [error,setError]=useState<string|null>(null); const person=people.find(p=>p.id===personId);
  const submit=()=>{ const value=Number(amount); if(!person)return; if(value<=0)return setError("Informe uma quantidade maior que zero."); if(!reason.trim())return setError("Informe o motivo do lançamento."); onSave({id:`entry-${Date.now()}`,personId:person.id,personName:person.name,amount:Math.round(value),type,reason:reason.trim(),createdAt:new Date().toISOString()}); };
  return <Modal title="Lançar pontos" subtitle="Adicione ou remova pontos e registre o motivo do ajuste." onClose={onClose}><Field label="Colaborador"><select value={personId} onChange={e=>setPersonId(e.target.value)}>{people.map(p=><option key={p.id} value={p.id}>{p.name} · {balance(p).toLocaleString("pt-BR")} pts</option>)}</select></Field>{person&&<div className="balance-card"><span>Saldo atual</span><strong>{balance(person).toLocaleString("pt-BR")} pontos</strong></div>}<div className="point-type"><button className={type==="add"?"active add":""} onClick={()=>setType("add")}><Plus className="h-4 w-4"/>Adicionar</button><button className={type==="remove"?"active remove":""} onClick={()=>setType("remove")}><Minus className="h-4 w-4"/>Remover</button></div><Field label="Quantidade de pontos"><input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><Field label="Motivo"><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: bônus por venda realizada"/></Field>{error&&<div className="admin-error">{error}</div>}<Footer onClose={onClose} onSave={submit} label="Confirmar lançamento" icon={<Zap className="h-4 w-4"/>}/></Modal>;
}

function HistoryModal({entries,onClose}:{entries:Entry[];onClose:()=>void}){ return <Modal title="Histórico de pontos" subtitle="Lançamentos manuais feitos pelo gestor." onClose={onClose} wide>{entries.length===0?<div className="admin-empty"><History className="h-8 w-8"/><strong>Nenhum lançamento ainda</strong><span>Os ajustes de pontos aparecerão aqui.</span></div>:<div className="history-list">{entries.map(e=><article key={e.id}><div className={`entry-icon ${e.type}`}><Zap className="h-4 w-4"/></div><div><strong>{e.personName}</strong><span>{e.reason}</span><small>{new Date(e.createdAt).toLocaleString("pt-BR")}</small></div><b className={e.type==="add"?"positive":"negative"}>{e.type==="add"?"+":"-"}{e.amount} pts</b></article>)}</div>}<div className="modal-footer"><button className="save" onClick={onClose}>Fechar</button></div></Modal>; }

function Field({label,children}:{label:string;children:React.ReactNode}){ return <label className="admin-field"><span>{label}</span>{children}</label>; }
function Footer({onClose,onSave,label,icon}:{onClose:()=>void;onSave:()=>void;label:string;icon:React.ReactNode}){ return <div className="modal-footer"><button onClick={onClose}>Cancelar</button><button className="save" onClick={onSave}>{icon}{label}</button></div>; }
function Modal({title,subtitle,onClose,children,wide=false}:{title:string;subtitle:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){ return <div className="admin-modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><section className={`admin-modal ${wide?"wide":""}`}><button className="close" onClick={onClose}><X className="h-5 w-5"/></button><div className="admin-modal-head"><div className="admin-kicker"><ShieldCheck className="h-4 w-4"/>ADMINISTRAÇÃO</div><h2>{title}</h2><p>{subtitle}</p></div><div className="admin-modal-body">{children}</div></section></div>; }
