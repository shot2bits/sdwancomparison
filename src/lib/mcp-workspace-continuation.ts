import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { ALLOWED_PATHS, type FieldUpdate } from './workspace/extract';
import { mergeUpdates, requirementFrom } from './workspace/draft';
import { WorkspaceFactSchema } from './workspace/envelope-schemas';
import { SourceLedgerEntrySchema } from './workspace/source-ledger';
import { compileProcurementDocument } from './workspace/procurement-document';
import { deriveRfiQuestionSet } from './workspace/instrument';
import { assessSecurityRequirement, type SecurityRequirementInput } from './security/rulebook';

const Context = z.object({ facts: z.array(WorkspaceFactSchema), source_turns: z.array(SourceLedgerEntrySchema), document_purpose:z.enum(['brief','rfp','rfi']).optional() }).strict();
export function parseWorkspaceContinuation(raw: unknown) {
  return raw === undefined ? { facts: [], source_turns: [] } : Context.parse(raw);
}

/** Prepare a complete, reviewable next call. This helper never writes storage. */
export async function workspaceContinuation(input: {
  text: string; updates: FieldUpdate[]; base: SecurityRequirementInput;
  procurement: { buying?: string; operatingModel?: string }; continuation?: unknown;
  documentPurpose?: 'brief'|'rfp'|'rfi';
}) {
  const prior = parseWorkspaceContinuation(input.continuation);
  const cycle = Math.max(0, ...prior.facts.map(f => f.cycle)) + 1;
  // Legacy clients carried typed fields without provenance. Mark their origin honestly.
  const legacy: FieldUpdate[] = prior.facts.length ? [] : ALLOWED_PATHS.flatMap(path => {
    const [group,key] = path.split('.');
    const obj = group === 'procurement' ? input.procurement : (input.base as Record<string, unknown>)[group];
    const value = obj && typeof obj === 'object' ? (obj as Record<string,unknown>)[key] : undefined;
    return value === undefined ? [] : [{path,value,provenance:'inferred' as const,reason:'Carried structured context from the calling assistant; original buyer quote unavailable.'}];
  });
  const facts = mergeUpdates(prior.facts,[...legacy,...input.updates],cycle,'extract').facts;
  const source_turns = [...prior.source_turns,{id:randomUUID(),text:input.text,at:Date.now(),via:'typed' as const}];
  if(source_turns.reduce((n,t)=>n+t.text.length,0)>200000) throw new Error('Continuation source exceeds 200,000 characters; save the existing draft before starting another continuation.');
  const requirement = requirementFrom(facts);
  const buying = [...facts].reverse().find(f=>!f.struck&&f.path==='procurement.buying')?.value;
  const model = [...facts].reverse().find(f=>!f.struck&&f.path==='procurement.operatingModel')?.value;
  const verdict = !buying || buying==='managed_security' ? await assessSecurityRequirement(requirement) : null;
  const purpose=input.documentPurpose??prior.document_purpose??'brief';
  const instrument=purpose==='brief'?'sor':purpose;
  const compiled_document=compileProcurementDocument({facts,requirement,verdict,noted:[],rfiSet:deriveRfiQuestionSet({coveredSections:[],sector:requirement.organisation?.sector??null}),instrument,receipts:[],sourceTurns:source_turns,previousDocument:null,revision:null});
  const text=source_turns.map(t=>t.text).join('\n\n');
  const regionGroups:Record<string,string>={uk:'uk_ireland',ie:'uk_ireland',eu:'europe',us:'north_america',apac:'asia_pacific',me:'middle_east_africa',latam:'latin_america',china:'china_mainland'};
  const sector=requirement.organisation?.sector??null;
  const buyer_input={sector,site_count:requirement.estate?.sites??null,regions:[...new Set((requirement.organisation?.regions??[]).map(r=>regionGroups[r]??r))],operating_model:typeof model==='string'?model:'any',product_scope:buying==='sdwan'?'sdwan_only':buying==='sse'?'sse_only':buying==='sase'?'full_sase':'not_stated',notes:compiled_document.title};
  return {
    continuation:{facts,source_turns,document_purpose:purpose},
    next_call:{name:'start_project',requires_buyer_agreement:true,arguments:{mode:purpose==='brief'?'quick_list':'build_rfp',entrance_context:{sector,buyer_input,requirement_text:text,source_url:'https://netify.co.uk/sase/api/mcp/',raw_input:{document_purpose:purpose,timescale:requirement.constraints?.timeline??'',solution_scope:buying??'',workspace_payload:{facts,receipts:[],source_turns,decision_turns:[],instrument,compiled_document,position:{covered_sections:[]},base_revision:0}}}}},
  };
}
