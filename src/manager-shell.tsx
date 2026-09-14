import { useEffect } from "react";

export function ManagerShell(){
  useEffect(()=>{
    const sync=()=>{
      const header=document.querySelector("header");
      if(!header)return;
      const buttons=Array.from(header.querySelectorAll("button"));
      const profile=buttons.find(button=>(button.textContent||"").includes("Marcelo Alves"));
      if(profile){
        const textNodes=Array.from(profile.querySelectorAll("div"));
        const role=textNodes.find(node=>(node.textContent||"").trim()==="Closer · Nível 7");
        if(role)role.textContent="Gestor · Visão da operação";
      }
    };
    sync();
    const observer=new MutationObserver(()=>requestAnimationFrame(sync));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
