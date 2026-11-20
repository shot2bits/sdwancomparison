// Approved addition to Open backup. The active project is never restored over.
export function mountCoreBackupImport(workspace){
 const input=workspace.element.querySelector('#ls-backup-file');
 let enabled=fetch('/api/context-preview/core/status').then(r=>r.ok).catch(()=>false);
 const token=()=>{const a=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...a)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');};
 const request=async(path,body)=>{const r=await fetch('/api/context-preview/core/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.message||data.error);return data;};
 input.addEventListener('change',async event=>{
  event.stopImmediatePropagation();const file=input.files?.[0];input.value='';if(!file)return;
  let dialog;
  try{
   if(!await enabled)throw Error('Server backup import is unavailable here. Your current project has not changed.');
   if(file.size>4_800_000)throw Error('Backup exceeds the import limit. Nothing was imported or shortened.');
   const backup=await file.text(),new_project_id=crypto.randomUUID(),operation_id=crypto.randomUUID();
   const preview=await request('import-preview',{backup,new_project_id});const p=preview.reconciliation;
   const count=(n,word)=>n+' '+word+(n===1?'':'s');dialog=document.createElement('dialog');dialog.className='ls-import-dialog';dialog.setAttribute('aria-label','Review backup import');dialog.style.cssText='max-width:660px;width:calc(100% - 32px);max-height:85vh;overflow:auto;padding:28px;border:1px solid #aac7ba;border-radius:14px;color:#23463d;background:white;font:16px system-ui';
   const title=document.createElement('h2');title.textContent='Import backup as a new private project';dialog.append(title);
   for(const line of [`${count(p.location_records,'location record')} · ${count(p.total_sites,'site')} · ${p.unallocated_sites} unallocated · ${count(p.users,'user')}`,`${count(p.products,'product')} · ${count(p.custom_requirements,'requirement')} · ${count(p.selected_questions,'selected supplier question')}`,`${count(p.source_archives,'source archive')} · ${count(p.conversation_threads,'local conversation')} · ${count(p.proposals,'local proposal')}`,p.preserved,p.changes,`${count(p.reviews_to_repeat,'previous review')} ${p.reviews_to_repeat===1?'needs':'need'} repeating. Your current project stays unchanged.`]){const paragraph=document.createElement('p');paragraph.textContent=line;dialog.append(paragraph);}
   const confirm=document.createElement('button'),cancel=document.createElement('button'),message=document.createElement('p');message.setAttribute('role','status');
   confirm.className='ls-primary';cancel.className='ls-secondary';confirm.textContent='Import as new private project';cancel.textContent='Cancel';confirm.type=cancel.type='button';dialog.append(confirm,cancel,message);document.body.append(dialog);
   const close=()=>{dialog.close();dialog.remove();};cancel.onclick=close;dialog.addEventListener('cancel',()=>dialog.remove());dialog.showModal();
   const credentials={edit:token(),view:token()};
   confirm.onclick=async()=>{confirm.disabled=true;cancel.disabled=true;message.textContent='Importing into the isolated Neon development branch…';
    try{const result=await request('import',{backup,new_project_id,operation_id,credentials,preview_hash:preview.preview_hash});
     sessionStorage.setItem('netify-core-capability:'+result.project_id,credentials.edit);
     title.textContent='Backup imported into a new private project';
     message.textContent='Project '+result.project_id+' · revision '+result.revision+' · expires '+new Date(result.expires_at).toLocaleDateString('en-GB')+'. Original project unchanged. No suppliers contacted.';
     confirm.remove();cancel.disabled=false;cancel.textContent='Close';
     for(const [label,url] of [['Open imported project',result.edit_link],['Private view link',result.view_link]]){const a=document.createElement('a');a.textContent=label;const link=new URL(url);const qa=new URLSearchParams(location.search);if(qa.get('qa')==='phase1b'){link.searchParams.set('qa','phase1b');link.searchParams.set('qaBrowser',qa.get('qaBrowser')||'iab');}a.href=link.href;a.className='ls-receipt-link';a.referrerPolicy='no-referrer';dialog.append(a);}
    }catch(e){message.textContent='Import not confirmed: '+e.message+'. Retry uses the same import identity.';confirm.disabled=false;cancel.disabled=false;}
   };
  }catch(e){dialog?.remove();workspace.coreStatus('Backup not imported: '+e.message);}
 },true);
}
