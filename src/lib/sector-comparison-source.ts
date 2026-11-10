import 'server-only';
import {z} from 'zod';
import type {PublishedProvider} from './sector-comparison';
const row=z.record(z.string(),z.unknown());
const recordSchema=z.object({provider:z.object({slug:z.string(),display_name:z.string(),provider_types:z.array(z.string()).optional()}).passthrough(),revision:z.object({id:z.string(),dataset_version:z.string(),reviewed_at:z.string()}).passthrough(),editorial:row.optional(),compliance:z.array(row).default([]),integrations:z.array(row).default([]),evaluations:z.array(row).default([]),products:z.array(row),capabilities:z.array(row),geographies:z.array(row),service_models:z.array(row),sector_evidence:z.array(row),case_studies:z.array(row),evidence_sources:z.array(row)}).passthrough();
const root='https://netify.co.uk/api/provider-knowledge/';
const indexSchema=z.object({providers:z.array(z.object({slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),revision_id:z.string()})).min(1).max(100)});
/** Published records only. No buyer data, credentials or private research is sent. */
export async function loadSectorComparisonRecords(){
 const indexResponse=await fetch(root,{next:{revalidate:300},signal:AbortSignal.timeout(12000)});
 if(!indexResponse.ok)throw new Error('Provider research is temporarily unavailable.');
 const index=indexSchema.parse(await indexResponse.json());
 const providers:PublishedProvider[]=[],unavailable:string[]=[];
 // Bound concurrency and preserve explicit partial-source failures.
 for(let i=0;i<index.providers.length;i+=6){await Promise.all(index.providers.slice(i,i+6).map(async item=>{
  try{const response=await fetch(root+item.slug+'/',{next:{revalidate:300},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error();const record=recordSchema.parse(await response.json());if(record.provider.slug!==item.slug||record.revision.id!==item.revision_id)throw new Error('Revision mismatch');providers.push(record as PublishedProvider);}catch{unavailable.push(item.slug);}
 }));}
 if(!providers.length)throw new Error('Provider research is temporarily unavailable. Your requirements are still available.');
 return {providers:providers.sort((a,b)=>a.provider.slug.localeCompare(b.provider.slug)),unavailable:unavailable.sort()};
}

export async function loadSectorComparisonRecord(slug:string){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return null;
 const response=await fetch(root+slug+'/',{next:{revalidate:300},signal:AbortSignal.timeout(12000)});
 if(response.status===404)return null;if(!response.ok)throw new Error('Research unavailable');
 const record=recordSchema.parse(await response.json());if(record.provider.slug!==slug)throw new Error('Provider identity mismatch');return record as PublishedProvider;
}
