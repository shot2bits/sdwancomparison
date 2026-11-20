import {createPartnerWorkspace} from './partner-workspace.js';
/** Presentation only. Changing mode never grants a role or changes the current project. */
export function mountWorkspaceMode(root){
 const bar=document.createElement('section');bar.className='ns-workspace-mode';bar.setAttribute('aria-label','Buyer and reseller workspace');
 bar.innerHTML='<div class="ns-mode-switch" role="group" aria-label="Workspace mode"><button type="button" data-workspace-mode="buyer" aria-pressed="false">Buyer</button><button type="button" data-workspace-mode="partner" aria-pressed="false" aria-controls="ns-reseller-tools">Reseller</button></div><p class="ns-mode-status" role="status" aria-live="polite"></p>';
 const slot=document.createElement('div');slot.id='ns-reseller-tools';slot.hidden=true;
 root.querySelector('.ns-top').after(bar);root.querySelector('#location-studio').after(slot);let partner=null;
 function select(mode,updateUrl=true){
  const reseller=mode==='partner';root.dataset.workspaceMode=reseller?'partner':'buyer';
  for(const button of bar.querySelectorAll('[data-workspace-mode]'))button.setAttribute('aria-pressed',String(button.dataset.workspaceMode===mode));
  bar.querySelector('.ns-mode-status').textContent=reseller?'Reseller mode · Working with your customers':'Buyer mode · Buying for your business';
  if(updateUrl){const url=new URL(location.href);reseller?url.searchParams.set('workspace','partner'):url.searchParams.delete('workspace');history.replaceState(history.state,'',url);}
  slot.hidden=!reseller;
  if(reseller){if(!partner){partner=createPartnerWorkspace(slot);slot.append(partner);}partner.open=true;}
 }
 bar.addEventListener('click',event=>{const button=event.target.closest('[data-workspace-mode]');if(button)select(button.dataset.workspaceMode);});
 // Retain the existing Project actions link, without reloading or losing unsaved work.
 root.addEventListener('click',event=>{const link=event.target.closest('a[href="/locations/?workspace=partner"]');if(!link)return;event.preventDefault();select('partner');slot.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 window.addEventListener('popstate',()=>select(new URLSearchParams(location.search).get('workspace')==='partner'?'partner':'buyer',false));
 select(new URLSearchParams(location.search).get('workspace')==='partner'?'partner':'buyer',false);
 return bar;
}
