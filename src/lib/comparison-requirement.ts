import {CHALLENGES,COMPARISON_REGIONS,SECTOR_CHOICES} from './sector-comparison-config';

/** Client-safe: turns the sector comparison brief into the requirement the bundle publishes. */
export type ComparisonBrief={sector:string;sites:number;users:number;regions:readonly string[];service_model:string;scope:string;challenges:{id:string;mandatory:boolean}[];notes:string};
export function comparisonToRequirement(b:ComparisonBrief){
 const products=b.scope==='sdwan'?['sdwan']:b.scope==='secure_access'?['ztna','sse']:['sdwan','sse','ztna'];
 const ids=SECTOR_CHOICES.map(s=>s.id as string);
 const regions=b.regions.map(r=>COMPARISON_REGIONS.find(x=>x[0]===r)?.[1]??r);
 const priorities=b.challenges.map(c=>(CHALLENGES.find(x=>x.id===c.id)?.label??c.id)+(c.mandatory?' (mandatory)':''));
 return {
  organisation:{sector:ids.includes(b.sector)?b.sector:'other'},
  products,
  sites:{count:Math.max(1,b.sites||1),regions},
  users:{count:Math.max(1,b.users||1),remote:0},
  desired_outcomes:b.notes.slice(0,2000),
  operating_model:b.service_model==='any'?'undecided':b.service_model,
  priorities:priorities.slice(0,10)
 };
}
