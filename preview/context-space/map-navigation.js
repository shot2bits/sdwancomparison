/** Navigation state only. Never changes project requirements or saved selections. */
export function knowledgePath(id){if(!id?.startsWith('knowledge:'))return null;try{const p=JSON.parse(decodeURIComponent(id.slice(10)));return Array.isArray(p)&&p.length<=80&&p.every(k=>typeof k==='string'&&k.length<=500&&!['__proto__','constructor','prototype'].includes(k)||Number.isSafeInteger(k)&&k>=0)?p:null;}catch{return null;}}
const encode=p=>'knowledge:'+encodeURIComponent(JSON.stringify(p));
export function mapParent(id){
 if(!id||id==='overview')return null;
 if(id.startsWith('knowledge:')){const p=knowledgePath(id);return p?.length? p.length===1?'research-library':encode(p.slice(0,-1)):'research-library';}
 if(id.startsWith('feature:'))return 'product:'+id.split(':')[1];
 if(id.startsWith('product:'))return 'scope';
 if(id==='scope')return 'project';
 if(id.startsWith('provider:'))return 'project-shortlist';
 if(['project','sector-challenges','project-shortlist','written-brief','research-library'].includes(id))return 'overview';
 if(['document-business','questions','timing','instructions'].includes(id))return 'written-brief';
 if(['optional-details','custom-context'].includes(id))return 'sector-challenges';
 if(['apps','clouds','technology','operating'].includes(id))return 'optional-details';
 if(/^c\d+$/.test(id)||id.startsWith('own')||id.startsWith('supplier-'))return 'sector-challenges';
 return 'project';
}
export function mapBreadcrumbs(id,label,customIds=[]){const result=[],seen=new Set();let current=id||'overview';for(let i=0;current&&i<85;i++){if(seen.has(current))break;seen.add(current);result.unshift({id:current,label:label(current)});current=customIds.includes(current)?'sector-challenges':mapParent(current);}return result;}
export function createMapHistory(initial='project'){
 let entries=[initial],index=0;
 return {visit(id){if(id===entries[index])return;entries=entries.slice(0,index+1);entries.push(id);if(entries.length>200)entries.shift();index=entries.length-1;},back(){if(index===0)return null;return entries[--index];},forward(){if(index>=entries.length-1)return null;return entries[++index];},reset(id='project'){entries=[id];index=0;},get canBack(){return index>0;},get canForward(){return index<entries.length-1;},get current(){return entries[index];}};
}
