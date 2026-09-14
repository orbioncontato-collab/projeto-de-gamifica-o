import { useEffect } from "react";

export function ManagerOverviewHider(){
  useEffect(()=>{
    const restore=()=>document.querySelectorAll<HTMLElement>("[data-manager-hidden]").forEach(el=>{el.style.removeProperty("display");delete el.dataset.managerHidden});
    const sync=()=>{
      const main=document.querySelector<HTMLElement>("main");
      if(!main)return;
      const manager=main.querySelector<HTMLElement>("[data-manager-overview] .manager-dashboard");
      if(!manager){restore();return;}
      for(const child of Array.from(main.children)){
        if(!(child instanceof HTMLElement)||child.hasAttribute("data-manager-overview")||child.hasAttribute("data-admin-controls")||child.hasAttribute("data-admin-roster")||child.hasAttribute("data-admin-config-section")||child.hasAttribute("data-admin-custom-page"))continue;
        const title=child.querySelector("h1")?.textContent||"";
        if(title.includes("Bom dia, Marcelo")){child.dataset.managerHidden="1";child.style.setProperty("display","none","important")}
      }
    };
    sync();
    const observer=new MutationObserver(()=>requestAnimationFrame(sync));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>{observer.disconnect();restore()};
  },[]);
  return null;
}
