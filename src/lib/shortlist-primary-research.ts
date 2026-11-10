import research from '../../data/shortlist-primary-research.json';
import type {PublishedProvider} from './sector-comparison';
type Review={models:string[];summary:string;source_urls:string[];scopes:string[]};
export const PRIMARY_RESEARCH_VERSION=research.version;
export function primaryResearchFor(slug:string):Review|null{return (research.providers as Record<string,Review>)[slug]??null;}
/** Add independently checked public offering evidence; never rewrite the source record. */
export function withPrimaryResearch(record:PublishedProvider):PublishedProvider{
 const review=primaryResearchFor(record.provider.slug);if(!review||record.evidence_sources.some(s=>String(s.id).startsWith('primary-research:')))return record;
 const ids=review.source_urls.map((_,i)=>`primary-research:${record.provider.slug}:${i}`);
 return {...record,evidence_sources:[...record.evidence_sources,...review.source_urls.map((url,i)=>({id:ids[i],url,title:'Primary-source operating-model and scope check',publisher:new URL(url).hostname,verified_date:research.verified_at,reliability_tier:'tier_1',source_status:'current'}))],service_models:[...record.service_models,...review.models.map(model=>({id:`primary-research:${record.provider.slug}:${model}`,model,support_state:'supported',qualification:review.summary+' This establishes an offered operating model, not the suitability of the buyer’s design.',confidence:'high',verified_date:research.verified_at,freshness_state:'current',evidence_source_ids:ids,provenance:PRIMARY_RESEARCH_VERSION}))]};
}
