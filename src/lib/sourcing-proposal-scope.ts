import {createHash} from 'node:crypto';
import type {ProjectDetails} from './rfp-types';
import type {FeedItem} from './opportunity-types';
import {kvGetJson} from './rfp-store';
function stable(value:unknown):unknown {
 if(Array.isArray(value))return value.map(stable);
 if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));
 return value;
}
/** Bind written responses to the actual requirement content, not login/activity timestamps. */
export function sourcingScopeHash(p:ProjectDetails){
 return createHash('sha256').update(JSON.stringify(stable({buyer:p.buyer,sections:p.rfp_sections,understanding:p.understanding,engine_data:p.engine_data,facts:p.facts,procurement_document:p.procurement_document}))).digest('hex');
}
export async function currentSourcingProposals(p:ProjectDetails,feed:FeedItem[]){
 const hash=sourcingScopeHash(p);
 const receipts=await Promise.all(feed.map(f=>kvGetJson<{scope_hash?:string}>(`rfp:${p.id}:proposal-receipt:${f.id}`)));
 const current=feed.filter((_,i)=>receipts[i]?.scope_hash===hash);
 return {scope_hash:hash,current,previous:feed.filter((_,i)=>receipts[i]?.scope_hash!==hash)};
}
