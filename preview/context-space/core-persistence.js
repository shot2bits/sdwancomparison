import {qaTiming} from './qa-timing.js';
// Opt-in development thin slice. Existing local projects are never imported implicitly.
export function createCorePersistence(workspace){
 const live=document.documentElement.dataset.coreEnvironment==='production';
 const id=new URLSearchParams(location.search).get('core');if(!id)return null;
 const storeKey='netify-core-capability:'+id;
 const fragment=new URLSearchParams(location.hash.slice(1));
 const token=fragment.get('cap')||sessionStorage.getItem(storeKey)||'';
 if(fragment.has('cap')){sessionStorage.setItem(storeKey,token);history.replaceState(null,'',location.pathname+location.search);}
 let claimed=false;let current=id==='new'?null:id,revision=0,busy=false,authority='edit',pending=null,viewLink='',editLink='';
 let opening;const linkButtons=[];
 const status=text=>workspace.coreStatus(text);
 const randomToken=()=>{const a=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...a)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');};
 let edit=token;
 async function request(path,body){const r=await fetch('/api/context-preview/core'+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(edit?{authorization:'Bearer '+edit}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok){const error=Error(value.error==='revision_conflict'?'Another browser has saved a newer scope. Your edits are retained here. Open the project link in a new tab to review the newer version before saving.':value.message||value.error);error.code=value.error;throw error;}return value;}
 function links(){if(!current)return;editLink=authority==='edit'?location.origin+'/locations/?core='+current+'#cap='+edit:'';for(const [b,getLink] of linkButtons)b.dataset.coreLink=getLink();}
 function showReceipt(result){revision=result.revision;workspace.coreRevision?.(revision);claimed=result.claimed??claimed;status((claimed?'Private owner project':live?'Private Neon project':'Neon development')+' · revision '+revision+' · access ends '+new Date(result.expires_at).toLocaleDateString('en-GB')+(claimed?'':' · not claimed'));document.dispatchEvent(new CustomEvent('netify-core-receipt',{detail:{claimed,revision}}));}
 opening=(async()=>{
  if(fragment.has('verify')){status('Confirm the verification link in Private access. No scope has been loaded.');return;}if(!current){status(live?'New private project · save to Neon':'New private development project · save to Neon');return;}
  const data=await request('/'+current);authority=data.authority;revision=data.revision;workspace.coreRevision?.(revision);await workspace.restoreCore(data.snapshot);links();showReceipt(data);qaTiming("load",0,current);
  if(authority==='view')status('View-only Neon project · revision '+revision+' · expires '+new Date(data.expires_at).toLocaleDateString('en-GB'));
 })().catch(e=>{status('Project not opened: '+e.message);throw e;});
 // A view capability can inspect the existing UI, but is never a write or claim authority.
 async function save(){const saveStarted=performance.now();if(busy)return false;busy=true;try{await opening;if(authority!=='edit')throw Error('This link is view-only. An edit link is required to save.');
  if(!pending){const snapshot=workspace.exportCore();if(!current){const key='netify-core-new:'+snapshot.packet.project.id;let credentials;try{credentials=JSON.parse(sessionStorage.getItem(key));}catch{}if(!credentials){credentials={edit:randomToken(),view:randomToken()};sessionStorage.setItem(key,JSON.stringify(credentials));}edit=credentials.edit;pending={path:'',body:{snapshot,operation_id:snapshot.packet.project.id,credentials}};}else pending={path:'/'+current,body:{snapshot,base_revision:revision,operation_id:crypto.randomUUID()}};}
  const data=await request(pending.path,pending.body);if(!current){current=data.project_id;sessionStorage.setItem('netify-core-capability:'+current,edit);history.replaceState(null,'',location.pathname+'?core='+current);viewLink=data.view_link;editLink=data.edit_link;links();}
  const bytes=new TextEncoder().encode(JSON.stringify(pending.body)).length;pending=null;showReceipt(data);qaTiming("save",saveStarted,current,{requestBytes:bytes});return true;
 }catch(e){status('Not saved: '+e.message);if(e.code==='revision_conflict'||e.code==='operation_key_reused')pending=null;return false;}finally{busy=false;}}
 // Link controls are added inside the existing project-actions area only.
 const actions=workspace.element.querySelector('.ls-heading-actions');
 for(const [label,getLink] of [['Copy edit link',()=>editLink],['Copy view link',()=>viewLink]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',async()=>{if(!current){status('Save this project to Neon first.');return;}const link=getLink();if(!link){status('This capability cannot issue another link.');return;}try{await navigator.clipboard.writeText(link);status(label+' copied. Keep this private.');}catch{status('Clipboard unavailable. Use the private project link issued when saving.');}});linkButtons.push([b,getLink]);actions.append(b);}
 return {save,ready:opening,get revision(){return revision;},get projectId(){return current;},get authority(){return authority;},identityRequest:(path,body)=>request('/identity/'+path,body),resumeWithEdit:async token=>{edit=token;authority='edit';sessionStorage.setItem('netify-core-capability:'+current,token);opening=Promise.resolve();const data=await request('/'+current);await workspace.restoreCore(data.snapshot);claimed=data.claimed;links();showReceipt(data);},clearDeleted:()=>{sessionStorage.removeItem(storeKey);sessionStorage.removeItem('netify-core-capability:'+current);for(const storage of [localStorage,sessionStorage])for(const k of Object.keys(storage)){try{const v=JSON.parse(storage.getItem(k));if(v?.project?.id===current||v?.connectedProject?.project?.id===current||v?.packet?.project?.id===current)storage.removeItem(k);}catch{}}location.replace('/locations/');}};
}
