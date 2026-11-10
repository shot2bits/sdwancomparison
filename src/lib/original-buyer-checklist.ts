import originals from '../../data/original-buyer-checklists.json';
import checks from '../../data/buyer-checklist-fact-checks.json';
export type BuyerChecklistCheck={status:string;claim:string;finding:string;source_urls:string[]};
export type OriginalBuyerChecklist={version:string;source_dataset:string;source_document:string;source_document_sha256:string;paragraphs:string[];fact_check:{version:string;checked_at:string;scope:string;notice:string;notes:BuyerChecklistCheck[]}};
/** Original questions are archival buyer guidance, never evidence for ranking. */
export function originalBuyerChecklist(slug:string,dataset:string):OriginalBuyerChecklist|null{
 if(dataset!==originals.source_dataset)return null;
 const original=(originals.providers as Record<string,{source_document:string;source_document_sha256:string;paragraphs:string[]}>)[slug];
 const notes=(checks.providers as Record<string,BuyerChecklistCheck[]>)[slug];
 if(!original||!notes)return null;
 return {...original,version:originals.version,source_dataset:originals.source_dataset,fact_check:{version:checks.version,checked_at:checks.checked_at,scope:checks.scope,notice:checks.notice,notes}};
}
export function buyerChecklistMarkdown(checklist:OriginalBuyerChecklist):string[]{
 return ['### Harry’s original buyer checklist','Current checks — '+checklist.fact_check.checked_at,checklist.fact_check.notice,...checklist.fact_check.notes.flatMap(note=>['#### '+note.status.replaceAll('_',' ')+' — '+note.claim,note.finding,...note.source_urls.map(url=>'Source: '+url)]),'#### Original wording (historical research)',...checklist.paragraphs,'Original source: '+checklist.source_document+'; dataset: '+checklist.source_dataset+'; version: '+checklist.version,'Source document SHA-256: '+checklist.source_document_sha256,'Fact-check scope: '+checklist.fact_check.scope];
}
