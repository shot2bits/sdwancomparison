import {writeFileSync} from 'node:fs';
import {loadProviderMatchRecordFeed} from '../src/lib/provider-match-source';
import {getShortlistDataset} from '../src/lib/vendors';
import {mergeNeonProviderRecords} from '../src/lib/live-shortlist';
import {SECTOR_KEYS} from '../src/lib/shortlist-core';
const publicUrl=process.argv.find(a=>a.startsWith('--public-uk-review='))?.split('=').slice(1).join('=');
if(publicUrl){
 const response=await fetch(publicUrl);if(!response.ok)throw Error(`Public audit failed: ${response.status}`);const data=await response.json();
 const carriers=['bt-business','virgin-media-o2','vodafone-business','colt-technology-services'];
 const reviewed=data.vendors.filter((v:{slug:string})=>carriers.includes(v.slug)).map((v:any)=>({slug:v.slug,uk_delivery:v.uk_delivery,uk_ireland:v.regions.uk_ireland,source_urls:v.projection_provenance?.active_review?.source_urls??[],qualification:v.uk_basis}));
 if(reviewed.length!==4||reviewed.some((r:any)=>!['uk_hq','uk_entity'].includes(r.uk_delivery)||r.uk_ireland!=='yes'||!r.source_urls.length))throw Error('Four source-backed UK carriers required');
 console.log(JSON.stringify({runtime_provider_source:data.runtime_provider_source,reviewed},null,2));
}else{
const feed=await loadProviderMatchRecordFeed();const base=getShortlistDataset();const after=mergeNeonProviderRecords(base,feed.providers);
const strong=feed.providers.flatMap(p=>Object.entries(p.sectors).filter(([,s])=>s.evidence_strength==='strong').map(([sector,s])=>({provider:p.slug,sector,...s})));
const rows=SECTOR_KEYS.map(sector=>({sector,curated_positive:base.filter(p=>['yes','partial','partner_integrated'].includes(p.sectors[sector])).length,governed_positive:after.filter(p=>['yes','partial','partner_integrated'].includes(p.sectors[sector])).length,source_review_queue:after.reduce((n,p)=>n+(p.projection_provenance?.sector_review_queue.filter(s=>s.sector===sector).length??0),0)}));
writeFileSync('docs/action-first/sector-audit.json',JSON.stringify({captured_at:new Date().toISOString(),source_contract:feed.contractVersion,providers:feed.providers.length,strong_rows:strong.length,rows,strong_case_study_review:strong},null,2));
writeFileSync('docs/action-first/03-data-repair.md',`# Projection audit\n\nRead-only source capture: ${new Date().toISOString()}. ${feed.providers.length} providers; ${strong.length} strong case-study rows in the matching feed.\n\n| Sector | Curated positive | Current governed positive | Strong-evidence rows needing review |\n|---|---:|---:|---:|\n${rows.map(r=>`|${r.sector}|${r.curated_positive}|${r.governed_positive}|${r.source_review_queue}|`).join('\n')}\n\nThe before/after change removes fabricated UK-delivery defaults, retains historic grades and their original review date in projection provenance, and queues unresolved strong case-study fields. No new positive sector grades have been invented. This is NOT completion of the source adjudication. Named source references and qualification review are required to resolve the queue. Manufacturing tests prove that current supported evidence survives into matches, not that an actual supplier has been validated.\n\nAuthority: published governed capability evidence first; dated field-specific reviewed resolutions with source URLs may fill gaps only until their review deadline and never supersede a later governed review. Historic curated grades remain accessible for review, not automatically authoritative. BT's manufacturing note explicitly describes Managed Azure Network Services rather than SD-WAN/SASE.\n`);
console.log(JSON.stringify({providers:feed.providers.length,strong_rows:strong.length,rows}));

}
