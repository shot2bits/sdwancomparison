import type {PublishedProvider} from './sector-comparison';
export const RESEARCH_SECTIONS=['products','capabilities','geographies','service_models','compliance','integrations','sector_evidence','case_studies','evaluations','evidence_sources'] as const;
const label=(key:string)=>key.replaceAll('_',' ');
/** Preserve every value, including unknown future fields. No character or row caps. */
export function fullResearchAppendixMarkdown(records:PublishedProvider[]):string{
 const parts=['## Complete published research appendix','Original source dates, source identifiers, qualifications, import interpretations and metadata are retained below. These records are research, not supplier-confirmed suitability.'];
 for(const record of records){parts.push('### '+record.provider.display_name);for(const [section,value] of Object.entries(record)){parts.push('#### '+label(section));const rows=Array.isArray(value)?value:[value];if(!rows.length)parts.push('No published records.');for(const [i,row] of rows.entries()){if(Array.isArray(value))parts.push('Record '+(i+1)+' of '+rows.length);if(row&&typeof row==='object'&&!Array.isArray(row)){for(const [key,field]of Object.entries(row)){const text=typeof field==='string'?field:JSON.stringify(field,null,2);parts.push(label(key)+':\n\n'+String(text).split(/\r?\n/).map(line=>'> '+line).join('\n'));}}else parts.push(String(row));}}}
 return parts.join('\n\n');
}
