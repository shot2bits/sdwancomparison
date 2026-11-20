/** Pure canonical estate projections. No browser, database, AI or supplier effects. */
import {validateEstate,effective,sitePlanning,networkPlanText,scheduleText,estatePlanningText,siteReviewSignature,userReviewSignature,legacySiteReviewSignature,legacyUserReviewSignature,estateReadiness,siteScopeMissing} from './location-model.js';
export const stableJSON=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
// Synchronous SHA-256 supports the same review contract in browser and server.
export function scopeDigest(value){
 const bytes=new TextEncoder().encode(stableJSON(value)),size=Math.ceil((bytes.length+9)/64)*64,b=new Uint8Array(size);b.set(bytes);b[bytes.length]=128;const d=new DataView(b.buffer);d.setUint32(size-4,bytes.length*8);d.setUint32(size-8,Math.floor(bytes.length/0x20000000));
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const ro=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Uint32Array(64);
 for(let o=0;o<size;o+=64){for(let i=0;i<16;i++)w[i]=d.getUint32(o+i*4);for(let i=16;i<64;i++){const a=w[i-15],z=w[i-2];w[i]=(w[i-16]+(ro(a,7)^ro(a,18)^(a>>>3))+w[i-7]+(ro(z,17)^ro(z,19)^(z>>>10)))>>>0;}let [a,c,e,f,g,j,l,m]=h;for(let i=0;i<64;i++){const t=(m+(ro(g,6)^ro(g,11)^ro(g,25))+((g&j)^(~g&l))+k[i]+w[i])>>>0,u=((ro(a,2)^ro(a,13)^ro(a,22))+((a&c)^(a&e)^(c&e)))>>>0;m=l;l=j;j=g;g=(f+t)>>>0;f=e;e=c;c=a;a=(t+u)>>>0;}[a,c,e,f,g,j,l,m].forEach((v,i)=>h[i]=(h[i]+v)>>>0);}
 return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}
export function normaliseEstate(raw,input={}){
 const e=validateEstate(raw),p=e.planning;if(p?.sharedSignature===JSON.stringify(e.defaults))p.sharedSignature="profile/2:"+scopeDigest(e.defaults);
 const validSites=new Set(e.sites.filter(s=>p?.siteReviews?.[s.id]&&[siteReviewSignature(e,s),legacySiteReviewSignature(e,s)].includes(p.siteReviews[s.id])).map(s=>s.id));
 const validUsers=Boolean(p?.userReview&&[userReviewSignature(e,input),legacyUserReviewSignature(e,input)].includes(p.userReview));
 const profiles=e.sharedProfiles??{},seen=new Map(Object.entries(profiles).map(([id,v])=>[stableJSON(v),id]));let n=0;
 for(const s of e.sites)if(s.profile){const key=stableJSON(s.profile);let id=seen.get(key);if(!id){do{id='plan-'+(++n);}while(Object.hasOwn(profiles,id));profiles[id]=s.profile;seen.set(key,id);}s.profileRef=id;delete s.profile;}
 if(Object.keys(profiles).length)e.sharedProfiles=profiles;
 for(const [field,poolName,refName]of [['connectivity','networkPlans','networkPlanRef'],['features','featureSets','featureSetRef']]){const pool=e[poolName]??{},entries=new Map(Object.entries(pool).map(([id,v])=>[stableJSON(v),id]));let count=0;for(const site of e.sites)if(site[field]){const key=stableJSON(site[field]);let id=entries.get(key);if(!id){do{id=field+'-'+(++count);}while(Object.hasOwn(pool,id));pool[id]=site[field];entries.set(key,id);}site[refName]=id;delete site[field];}if(Object.keys(pool).length)e[poolName]=pool;}
 if(p){for(const s of e.sites)if(validSites.has(s.id))p.siteReviews[s.id]=siteReviewSignature(e,s);if(validUsers)p.userReview=userReviewSignature(e,input);}
 return e;
}
export function detachLegacySchedule(packet,estate,products=[]){
 const id='location-estate-schedule',item=packet.workspace.custom.find(x=>x.id===id);if(!item)return;
 const generated=scheduleText(estate,products)+'\n\n'+estatePlanningText(estate,packet.project.input,Object.keys(packet.siteDrafts??{}).length);
 estate.legacySchedule??={...structuredClone(item),buyerModified:item.text!==generated};
 packet.workspace.custom=packet.workspace.custom.filter(x=>x.id!==id);packet.project.input.custom=packet.project.input.custom.filter(x=>x.id!==id);
}
export function estatePage(sites,page=1,size=25){size=[25,50,100].includes(Number(size))?Number(size):25;const pages=Math.max(1,Math.ceil(sites.length/size));page=Math.min(pages,Math.max(1,Number(page)||1));return {page,size,pages,total:sites.length,start:sites.length?(page-1)*size+1:0,end:Math.min(sites.length,page*size),sites:sites.slice((page-1)*size,page*size)};}
export function siteExceptionLines(e,s,products=[]){
 const lines=[],label=id=>products.find(p=>p.id===id)?.label??id,p=s.profile??e.sharedProfiles?.[s.profileRef]??e.groups[s.type]??e.defaults;
 for(const [id,on]of Object.entries(s.overrides??{}))lines.push('Product '+label(id)+': '+(on?'included':'excluded'));
 if(s.features||s.featureSetRef)for(const [id,features]of Object.entries(s.features??e.featureSets[s.featureSetRef]))lines.push(label(id)+' features: '+features.join('; '));
 for(const [key,name]of [['connectivity','Connections'],['bandwidth','Bandwidth'],['resilience','Resilience']]){const value=key==='connectivity'?(s.connectivity??e.networkPlans?.[s.networkPlanRef]):s[key];if(value!==undefined&&stableJSON(value)!==stableJSON(p[key]))lines.push(name+': '+(key==='connectivity'?networkPlanText(value):value));}
 if(s.notes)lines.push('Requirements: '+s.notes);return lines;
}
export function estateReviewPlan(e,input={},drafts=0){const r=estateReadiness(e,input,drafts),u=e.planning?.users;return ['ESTATE REVIEW: '+(r.ready?'Site and user requirements reviewed; supplier delivery still requires confirmation.':r.missing.join('; ')),'HQ role: '+(e.planning?.hqDecision??'Not reviewed')+(e.planning?.hqSiteId?' / '+(e.sites.find(s=>s.id===e.planning.hqSiteId)?.name??''):''),'Cloud integration: '+(e.planning?.cloudIntegration?JSON.stringify(e.planning.cloudIntegration):'Not reviewed'),u?'UNIQUE USER POPULATION: '+u.count+' users, including '+u.remote+' remote users. Do not sum location counts as licence quantities.\nGroups: '+u.groups+'\nUser locations: '+u.regions+'\nAccess and applications: '+u.requirements:'USER REQUIREMENTS: not reviewed.'].join('\n');}
export function estateProfileText(p,products=[]){const label=id=>products.find(p=>p.id===id)?.label??id;return ['Products: '+(p.products.map(label).join('; ')||'Not selected'),...Object.entries(p.features).map(([id,fs])=>label(id)+' features: '+fs.join('; ')),'Requirements: '+(p.requirements||'Not supplied'),'Connections: '+networkPlanText(p.connectivity??null),'Bandwidth: '+(p.bandwidth||'Not supplied'),'Resilience: '+(p.resilience||'Not supplied')].join('\n')}
export function estatePlans(e,products=[]){return [{label:"Shared estate plan",text:estateProfileText(e.defaults,products)},...Object.entries(e.groups).map(([id,p])=>({label:"Group plan: "+id,text:estateProfileText(p,products)})),...Object.entries(e.sharedProfiles??{}).map(([id,p])=>({label:"Assigned plan: "+id,text:estateProfileText(p,products)}))];}
export function estateDocument(estate,input={},products=[]){
 const e=validateEstate(estate),label=id=>products.find(p=>p.id===id)?.label??id;
 const profileText=p=>estateProfileText(p,products);
 const lines=['## Structured estate schedule','City positions are approximate planning locations. Supplier availability and delivery require confirmation.','### Shared estate plan',profileText(e.defaults)];
 for(const [name,p]of Object.entries(e.groups))lines.push('### Group plan: '+name,profileText(p));
 for(const [name,p]of Object.entries(e.sharedProfiles??{}))lines.push('### Assigned plan: '+name,profileText(p));
 lines.push('### Estate review plan',estateReviewPlan(e,input));
 for(const s of e.sites){const plan=s.profileRef?'Assigned '+s.profileRef:s.profile?'Site plan':e.groups[s.type]?'Group '+s.type:'Shared estate plan';lines.push('### Location ['+s.id+'] '+s.name,[s.type,s.city,s.country,s.region,s.count+' site(s)',s.users+' site-associated users'].join(' | '),'Applicable plan: '+plan,'Applications: '+(s.apps||'Not supplied'),'Cloud: '+(s.clouds||'Not supplied'),'Existing connectivity: '+(s.circuit||'Not supplied'),...siteExceptionLines(e,s,products),'Review: '+(e.planning?.siteReviews?.[s.id]===siteReviewSignature(e,s)?'Reviewed against this scope':'Needs review')+(siteScopeMissing(e,s).length?' · '+siteScopeMissing(e,s).join('; '):''),...(s.original?['Original imported columns: '+JSON.stringify(s.original)]:[]));if(s.profile)lines.push('Site plan: '+profileText(s.profile));}
 for(const source of e.sources??[])lines.push('### Original source ['+source.id+'] '+source.label,'Imported: '+source.importedAt,source.text);
 if(e.legacySchedule?.buyerModified)lines.push('### Original legacy schedule wording',e.legacySchedule.text);
 return lines.join('\n\n');
}
