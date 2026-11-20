/** Progressive enhancement only. The catalogue and all evidence arrive as HTML. */
export function enhanceProviderFirstEntrance(workspace) {
 const entrance=document.querySelector('#provider-first-entrance');if(!entrance)return;
 const rows=[...entrance.querySelectorAll('[data-pf-row]')];
 const profiles=new Map([...entrance.querySelectorAll('[data-pf-profile-record]')].map(el=>[el.dataset.pfProfileRecord,el]));
 const search=entrance.querySelector('#pf-provider-search'),type=entrance.querySelector('#pf-provider-type');
 // Index once. Searching never refetches or removes records from the document.
 const indexed=rows.map(row=>({row,text:(row.textContent+' '+row.dataset.pfSectors).toLocaleLowerCase('en-GB'),types:row.dataset.pfTypes.split('|')}));
 entrance.querySelectorAll('[data-pf-enhanced]').forEach(el=>el.hidden=false);
 const filter=()=>{const q=search.value.trim().toLocaleLowerCase('en-GB');let shown=0;for(const item of indexed){const match=(!q||item.text.includes(q))&&(!type.value||item.types.includes(type.value));item.row.hidden=!match;shown+=Number(match);}entrance.querySelector('#pf-results-status').textContent=`Showing ${shown} of ${rows.length} providers. Alphabetical order. All complete profiles remain below.`;entrance.querySelector('#pf-no-matches').hidden=shown!==0;};
 search.addEventListener('input',filter);type.addEventListener('change',filter);
 function stage(id){document.body.dataset.pfStage=id;entrance.querySelectorAll('.pf-journey [data-pf-stage]').forEach(el=>{if(el.dataset.pfStage===id)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});}
 entrance.addEventListener('click',event=>{
  const target=event.target.closest('[data-pf-stage],[data-pf-profile],[data-pf-clear],[data-pf-expand],[data-pf-collapse]');if(!target)return;
  if(target.hasAttribute('data-pf-clear')){search.value='';type.value='';filter();search.focus();return;}
  if(target.hasAttribute('data-pf-expand')||target.hasAttribute('data-pf-collapse')){const open=target.hasAttribute('data-pf-expand');for(const profile of profiles.values())profile.open=open;return;}
  if(target.dataset.pfProfile){event.preventDefault();const profile=profiles.get(target.dataset.pfProfile);if(profile){profile.open=true;profile.scrollIntoView({block:'start'});profile.focus({preventScroll:true});}return;}
  event.preventDefault();const next=target.dataset.pfStage;
  if(next==='catalogue'){stage('catalogue');entrance.querySelector('#pf-catalogue-title').scrollIntoView({block:'start'});return;}
  stage(next==='open'?'business':next);
  if(next==='business')workspace.beginBrief();
  else if(next==='providers'){if(!workspace.openComparison())stage('business');}
  else if(next==='rfp')workspace.openRfp();
  else {workspace.element.scrollIntoView({block:'start'});}
 });
 workspace.element.addEventListener('provider-first:progress',event=>{
  const status=event.detail;
  entrance.querySelectorAll('.pf-journey [data-pf-stage]').forEach(el=>el.classList.toggle('pf-complete',el.dataset.pfStage==='business'&&status.ready));
 });
 workspace.element.addEventListener('provider-first:stage',event=>stage(event.detail.stage));
 document.body.dataset.pfReady='true';
}
