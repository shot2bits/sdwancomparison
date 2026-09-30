import type { ProjectDetails } from './rfp-types';
import { LIST_FACT_PATHS } from './workspace/extract';
import { wizardSectorKey, wizardRegions, type WorkspaceFact } from './workspace/draft';

type BuyerFactsSource = Pick<ProjectDetails, 'facts'|'buyer'|'procurement_document'|'envelope'|'engine_data'|'entrance_context'|'title'>;

export const BUYER_FACTS_CONTRACT = 'buyer-facts/2026-09-15.2';
/** Ledger identities, including tombstones, win before provenance is considered. */
function latestBuyerLedger(facts: WorkspaceFact[]) {
  const latest = new Map<string, WorkspaceFact>();
  for (const fact of facts) latest.set(LIST_FACT_PATHS.has(fact.path) ? fact.id : fact.path, fact);
  return [...latest.values()];
}
export function confirmedBuyerLedger(facts: WorkspaceFact[]) {
  return latestBuyerLedger(facts).filter(f => !f.struck && f.provenance === 'stated');
}

/** A read projection, never another mutable summary store. No notes fallback once a ledger/document exists. */
export function currentBuyerFacts(project: BuyerFactsSource) {
  const ledger = project.facts ?? [];
  const hasLedger = ledger.length > 0 || Boolean(project.envelope);
  const canonical = hasLedger || Boolean(project.procurement_document);
  const source = hasLedger ? 'buyer_fact_ledger' : project.procurement_document ? 'legacy_document_snapshot' : 'legacy_buyer_record';
  const confirmed = confirmedBuyerLedger(ledger);
  const read = (path: string): unknown[] => {
    if (hasLedger) return confirmed.filter(f => f.path === path).flatMap(f => Array.isArray(f.value) ? f.value : [f.value]);
    // Older saved documents have no provenance ledger: label this fallback, never call it confirmed.
    return Object.entries(project.procurement_document?.factSnapshot ?? {}).filter(([key]) => key === path || key.startsWith(path + ':')).flatMap(([,v]) => Array.isArray(v) ? v : [v]);
  };
  const scalar = (path: string) => read(path).at(-1);
  const text = (path: string) => typeof scalar(path) === 'string' ? String(scalar(path)).trim() : '';
  const list = (path: string) => read(path).filter((v): v is string => typeof v === 'string' && Boolean(v.trim()));
  const number = (path: string) => { const v = scalar(path); return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined; };
  const legacyEstate = (project.engine_data as unknown as {requirement?:{estate?:{users?:number}}})?.requirement?.estate;
  const legacyStaff = project.buyer.notes.match(/Staff:\s*(\d+)\./i);
  const buying = text('procurement.buying');
  const scopeMap: Record<string,string> = {sase:'full_sase',sdwan:'sdwan_only',sse:'sse_only',managed_security:'not_stated'};
  const states = Object.fromEntries(['estate.users','estate.sites','organisation.regions','organisation.sector','constraints.timeline','estate.existingNetwork','estate.existingSecurity','requirements.bespoke','drivers','procurement.buying','procurement.operatingModel'].map(path => {
    const all = latestBuyerLedger(ledger).filter(f => f.path === path);
    return [path, read(path).length ? (hasLedger ? 'confirmed' : 'legacy_unverified') : all.some(f => !f.struck && f.provenance === 'inferred') ? 'inferred' : all.length ? 'removed' : 'missing'];
  }));
  return {
    contract_version: BUYER_FACTS_CONTRACT, canonical, source, states,
    users: canonical ? number('estate.users') : legacyEstate?.users ?? (legacyStaff ? Number(legacyStaff[1]) : undefined),
    sites: canonical ? number('estate.sites') : project.buyer.site_count ?? undefined,
    timeline: canonical ? text('constraints.timeline') : String(project.entrance_context?.raw_input.timescale ?? project.buyer.notes.match(/Timeline:\s*([^\n]+?)(?:\.\s|$)/i)?.[1] ?? '').trim(),
    regions: canonical ? list('organisation.regions') : project.buyer.regions,
    sector: canonical ? text('organisation.sector') || null : project.buyer.sector,
    organisation_size: canonical ? text('organisation.sizeBand') || 'any' : project.buyer.organisation_size,
    scope: canonical ? scopeMap[buying] ?? 'not_stated' : project.buyer.product_scope,
    operating_model: canonical ? text('procurement.operatingModel') || 'any' : project.buyer.operating_model,
    compliance: canonical ? list('constraints.complianceRequirements') : project.buyer.compliance,
    existing_services: [...list('estate.existingNetwork'),...list('estate.existingSecurity'),...list('estate.existingProviders'),...list('estate.cloud')],
    requirements: list('requirements.bespoke'),
    business_outcomes: list('drivers'),
  };
}

export const matchingRegionKeys = (regions: string[]) => [...new Set(regions.map(r => wizardRegions([r])[0] ?? r))];

/** Existing buyer fields are a compatibility projection; the ledger remains authoritative. */
export function projectWithCurrentBuyerFacts(project: ProjectDetails): ProjectDetails {
  const f = currentBuyerFacts(project);
  if (!f.canonical) return project;
  return {...project, buyer:{...project.buyer, notes:currentPublicBrief(project).summary, sector:wizardSectorKey(f.sector ?? undefined) ?? f.sector, site_count:f.sites ?? null, regions:matchingRegionKeys(f.regions), organisation_size:f.organisation_size, product_scope:f.scope as ProjectDetails['buyer']['product_scope'], operating_model:f.operating_model as ProjectDetails['buyer']['operating_model'], compliance:f.compliance}};
}

export function currentDocumentCounts(project: ProjectDetails) {
  const doc = project.procurement_document;
  if (doc) return {sections:new Set(doc.clauses.map(c => c.section)).size, questions:doc.responseGroups.reduce((n,g) => n + g.questions.length,0), requirements:doc.clauses.length};
  const sections = project.rfp_sections.filter(s => s.included && s.questions.some(q => q.priority !== 'optional'));
  return {sections:sections.length, questions:sections.reduce((n,s) => n+s.questions.filter(q => q.priority !== 'optional').length,0), requirements:sections.reduce((n,s) => n+s.questions.filter(q => q.mandatory).length,0)};
}

function redact(text: string, project: BuyerFactsSource) {
  let result = text;
  const company = project.buyer.organisation.trim();
  if (company.length >= 2) result = result.replace(new RegExp('(?<!\\w)' + company.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(?!\\w)','gi'),'the buyer');
  return result.replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,'[contact withheld]').replace(/https?:\/\/\S+|\bwww\.\S+/gi,'[website withheld]').replace(/(?:\+?\d[\d ()-]{7,}\d)/g, value => value.replace(/\D/g,'').length >= 10 ? '[contact withheld]' : value).replace(/No supplier requirements have been created yet[^.]*\.?/gi,'').trim();
}
export function currentPublicBrief(project: BuyerFactsSource) {
  const f = currentBuyerFacts(project);
  // Whitelist buyer-confirmed intent/requirements, never quotes, source turns, private document prose or legacy notes.
  const intent = f.canonical ? [...f.business_outcomes,...f.requirements].map(v => redact(v,project).replace(/_/g,' ')).filter(Boolean).join('. ') : redact(project.buyer.notes,project);
  const summary = [intent && /[.!?]$/.test(intent) ? intent : intent ? intent + '.' : '', f.users ? `${f.users} users in scope.` : '', f.sites ? `${f.sites} sites.` : '', f.timeline ? `Timeline: ${redact(f.timeline,project)}.` : ''].filter(Boolean).join(' ');
  return {summary, timeline:redact(f.timeline,project), outcome:intent, title:redact(project.title,project)};
}

/** Block a new publication until its saved document corresponds to the current ledger. */
export function currentDocumentIsConsistent(project: ProjectDetails) {
  if (!project.procurement_document || (!project.facts.length && !project.envelope)) return true;
  const expected = Object.fromEntries(confirmedBuyerLedger(project.facts).map(f => [f.id,f.value]));
  const actual = project.procurement_document.factSnapshot;
  return Object.keys(expected).length === Object.keys(actual).length && Object.entries(expected).every(([key,value]) => JSON.stringify(value) === JSON.stringify(actual[key]));
}

/** Client/server brief preview from the same ledger, without a saved summary copy. */
export function publicBriefFromFacts(facts: WorkspaceFact[], company: string) {
  return currentPublicBrief({facts,title:'',buyer:{organisation:company,notes:'',sector:null,site_count:null,regions:[],compliance:[],organisation_size:'any',operating_model:'any',product_scope:'not_stated',pinned_vendors:[]}});
}
