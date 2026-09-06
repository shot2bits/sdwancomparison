/** Client-only bridge to the existing fact-ledger engine. No second question store. */
export type BriefFields = { scope: string; sector: string; sites: string; regions: string[]; operatingModel: string; outcome: string; timescale: string; company: string; requiredFeatures: string[] };
export type DocumentPurpose = 'brief' | 'rfp' | 'rfi';
export type WorkspaceProject = { id: string | null; fields: Partial<BriefFields>; payload: Record<string, unknown>; documentPurpose: DocumentPurpose; busy: boolean; published: boolean; legacyProject?: boolean };
export function readWorkspaceProject(): WorkspaceProject | null {
  const detail: { value: WorkspaceProject | null } = { value: null };
  window.dispatchEvent(new CustomEvent('netify:project-read', { detail }));
  return detail.value;
}
export async function confirmBriefInWorkspace(fields: BriefFields): Promise<WorkspaceProject | null> {
  const detail = { fields, accepted: false, error: '' };
  window.dispatchEvent(new CustomEvent('netify:project-confirm', { detail }));
  if (detail.error) throw new Error(detail.error);
  if (!detail.accepted) throw new Error('The requirements engine is still loading. Please try again.');
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  return readWorkspaceProject();
}
export function syncWorkspaceRevision(envelopeRevision: number, projectId?: string) {
  window.dispatchEvent(new CustomEvent('netify:project-revision', { detail: {envelopeRevision,projectId} }));
}
export function requestBrief(mode = 'quick_list') {
  const detail = { mode, accepted: false };
  window.dispatchEvent(new CustomEvent('netify:open-brief', { detail }));
  return detail.accepted;
}

export const WORKSPACE_SECTORS_BY_KEY: Record<string,string> = {manufacturing:'Manufacturing',healthcare:'Healthcare & pharma',financial_services:'Financial services',retail_ecommerce:'Retail & e-commerce',energy_utilities:'Energy & utilities',government_public_sector:'Government & public sector',education:'Education',transport_logistics:'Transport & logistics',professional_services:'Professional services',hospitality_leisure:'Hospitality & leisure'};
const REGION_MEMBERS: Record<string,string[]> = {uk_ireland:['uk','ie'],europe:['eu'],north_america:['us'],asia_pacific:['apac'],middle_east_africa:['me'],latin_america:['latam'],china_mainland:['china']};
/** A grouped checkbox cannot silently broaden a more precise existing fact. */
export function confirmedWorkspaceRegions(selected: string[], existing: string[]): string[] {
  return [...new Set(selected.flatMap(group=>{
    const members=REGION_MEMBERS[group]??[];
    const retained=existing.filter(region=>members.includes(region));
    return retained.length ? retained : members;
  }))];
}
export function workspaceUpdatesFromBrief(fields: Partial<BriefFields>, existingRegions: string[] = []): import('./workspace/extract').FieldUpdate[] {
  const updates: import('./workspace/extract').FieldUpdate[]=[];
  const add=(path:import('./workspace/extract').AllowedPath,value:unknown,quote:string)=>updates.push({path,value,quote,provenance:'stated'});
  if(fields.sites && Number.isSafeInteger(Number(fields.sites)) && Number(fields.sites)>0)add('estate.sites',Number(fields.sites),fields.sites);
  if(fields.scope && ['sase','sdwan','sse'].includes(fields.scope))add('procurement.buying',fields.scope,fields.scope.toUpperCase());
  if(fields.sector && WORKSPACE_SECTORS_BY_KEY[fields.sector])add('organisation.sector',WORKSPACE_SECTORS_BY_KEY[fields.sector],WORKSPACE_SECTORS_BY_KEY[fields.sector]);
  if(fields.timescale?.trim())add('constraints.timeline',fields.timescale,fields.timescale);
  if(fields.operatingModel && ['managed','co_managed','diy'].includes(fields.operatingModel))add('procurement.operatingModel',fields.operatingModel,fields.operatingModel);
  const regions=confirmedWorkspaceRegions(fields.regions??[],existingRegions);
  if(regions.length)add('organisation.regions',regions,(fields.regions??[]).join(', '));
  return updates;
}
