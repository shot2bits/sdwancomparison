/** Design-preview state. No network, identity, publication or supplier side effects. */
export type StudioFormat = 'rfi' | 'rfp';
export type StudioStep = 'describe' | 'requirements' | 'review' | 'engage';
export type StudioQuestion = { id: string; category: string; text: string };
export type StudioDraft = {
  format: StudioFormat; requirement: string; scope: '' | 'SASE' | 'SD-WAN' | 'SSE';
  sites: string; users: string; regions: string[]; timescale: string;
  service: '' | 'Fully managed' | 'Co-managed' | 'Self-managed' | 'Open to advice';
  questionIds: string[]; responseDays?: number;
};
export const EMPTY_STUDIO_DRAFT: StudioDraft = {
  format: 'rfi', requirement: '', scope: '', sites: '', users: '', regions: [],
  timescale: '', service: '', questionIds: [],
};
export const STUDIO_REGIONS = ['UK & Ireland', 'Europe', 'North America', 'Asia Pacific', 'Middle East & Africa', 'Latin America', 'Mainland China'];
export const STUDIO_STEPS: {id: StudioStep; label: string}[] = [
  {id:'describe',label:'Your project'}, {id:'requirements',label:'Build requirement'},
  {id:'review',label:'Review & publish'}, {id:'engage',label:'Supplier engagement'},
];
export function studioReadiness(d: StudioDraft, questions: StudioQuestion[]): string[] {
  const missing: string[] = [];
  if (d.requirement.trim().length < 20) missing.push('Describe the change you need in at least 20 characters.');
  if (!['SASE','SD-WAN','SSE'].includes(d.scope)) missing.push('Choose what you are buying.');
  const sites = Number(d.sites), users = Number(d.users);
  if (!((Number.isSafeInteger(sites) && sites > 0) || (Number.isSafeInteger(users) && users > 0))) missing.push('Add a whole-number site count or user count.');
  if (d.sites && (!Number.isSafeInteger(sites) || sites < 0)) missing.push('Use a whole-number site count, or leave it blank.');
  if (d.users && (!Number.isSafeInteger(users) || users < 0)) missing.push('Use a whole-number user count, or leave it blank.');
  if (!d.regions.length || d.regions.some(r=>!STUDIO_REGIONS.includes(r))) missing.push('Choose the regions suppliers must cover.');
  if (!d.timescale.trim()) missing.push('Choose a buying timescale, including Not decided if needed.');
  if (!d.service) missing.push('Choose a management model, or Open to advice.');
  if (d.format === 'rfp' && !questions.some(q=>d.questionIds.includes(q.id))) missing.push('Include at least one supplier question in your RFP.');
  return missing;
}
function sizeBand(value: string, noun: string): string {
  const n=Number(value);
  if (!Number.isSafeInteger(n) || n<1) return '';
  const bands=noun==='sites'?[[1,4],[5,9],[10,24],[25,49],[50,99],[100,249]]:[[1,49],[50,249],[250,999],[1000,4999]];
  const band=bands.find(([min,max])=>n>=min&&n<=max);
  return `${band?`${band[0]}–${band[1]}`:`${noun==='sites'?'250':'5,000'}+`} ${noun}`;
}
/** Public projection is an allowlist. Never includes free text, files, names or exact estate counts. */
export function studioPublicNotice(d: StudioDraft) {
  const scope=['SASE','SD-WAN','SSE'].includes(d.scope)?d.scope:'Network & security';
  const regions=d.regions.filter(r=>STUDIO_REGIONS.includes(r));
  const service=['Fully managed','Co-managed','Self-managed','Open to advice'].includes(d.service)?d.service:'';
  const timing=['Within 3 months','3–6 months','6–12 months','Not decided'].includes(d.timescale)?d.timescale:'Timescale to be confirmed';
  return {
    title:`${service&&service!=='Open to advice'?`${service} `:''}${scope} requirement`,
    size:[sizeBand(d.sites,'sites'),sizeBand(d.users,'users')].filter(Boolean).join(' · ') || 'Estate size to be confirmed',
    regions:regions.join(' · ') || 'Regions to be confirmed',
    summary:`An organisation is seeking ${scope} ${d.format==='rfp'?'proposals':'provider information'}${regions.length?` covering ${regions.join(', ')}`:''}. Approved suppliers can review the requirement and request to engage.`,
    timing,format:d.format==='rfp'?'Detailed RFP':'Statement of requirements · RFI',
  };
}
/** Only extract explicit mentions, for review. Never chooses a format or invents missing values. */
export function studioSuggestions(text: string): Partial<StudioDraft> {
  const result: Partial<StudioDraft> = {};
  if (/\bsase\b/i.test(text)) result.scope='SASE';
  else if (/\bsd[ -]?wan\b/i.test(text)) result.scope='SD-WAN';
  else if (/\bsse\b/i.test(text)) result.scope='SSE';
  const sites=text.match(/\b([1-9]\d*)\s+(?:sites?|offices?|branches|stores?)\b/i);
  const users=text.match(/\b([1-9]\d*)\s+(?:users?|employees?)\b/i);
  if(sites)result.sites=sites[1];
  if(users)result.users=users[1];
  if(/\bfully[ -]managed\b/i.test(text))result.service='Fully managed';
  else if(/\bco[ -]managed\b/i.test(text))result.service='Co-managed';
  const regions: string[]=[];
  if(/\b(?:UK|United Kingdom|Ireland)\b/i.test(text))regions.push('UK & Ireland');
  if(/\b(?:Europe|European)\b/i.test(text))regions.push('Europe');
  if(/\b(?:US|USA|United States|Canada|North America)\b/i.test(text))regions.push('North America');
  if(/\b(?:APAC|Asia Pacific)\b/i.test(text))regions.push('Asia Pacific');
  if(regions.length)result.regions=regions;
  return result;
}
export function studioDocument(d: StudioDraft, questions: StudioQuestion[]): string {
  return [
    `# ${d.scope || 'Network & security'} ${d.format.toUpperCase()}`,
    '## Statement of requirements',d.requirement.trim(),
    '## Project scope',`Sites: ${d.sites||'Not stated'}`,`Users: ${d.users||'Not stated'}`,
    `Regions: ${d.regions.join(', ')||'Not stated'}`,`Management: ${d.service||'Not stated'}`,
    `Timescale: ${d.timescale||'Not stated'}`,
    ...(d.format==='rfp'?['## Supplier response questions',...questions.filter(q=>d.questionIds.includes(q.id)).map(q=>`- [${q.id}] ${q.text}`)]:[]),
    '## Requested response',d.format==='rfp'?'Provide a proposal against the stated scope, itemised pricing, assumptions, exclusions and delivery approach.':'Explain your relevant capabilities, coverage, proposed approach and information needed for a formal proposal.',
    '\nDraft export. The saved publication receipt confirms whether this requirement has been issued.',
  ].join('\n\n');
}
export function studioCanEngage(published: boolean, approvedSupplier: boolean) { return published && approvedSupplier; }

export function studioPreviewDraft(d:StudioDraft):StudioDraft {const inferred=studioSuggestions(d.requirement);return {...d,...Object.fromEntries(Object.entries(inferred).filter(([key])=>{const v=d[key as keyof StudioDraft];return !v || (Array.isArray(v)&&v.length===0)}))};}
