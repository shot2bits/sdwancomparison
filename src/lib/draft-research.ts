import { buildShortlist, ShortlistInputSchema, type ShortlistVendor } from './shortlist-core';
import { matchSuppliers } from './supplier-match';
import { sectorUnconfirmedCoverage } from './coverage-preview';
export function draftResearch(vendors: ShortlistVendor[], scope: string, raw: unknown) {
  if (!['sase','sdwan','sse'].includes(scope)) throw new Error('Choose a solution.');
  const input = ShortlistInputSchema.parse(raw);
  if (!input.required_regions.length) throw new Error('Choose your regions.');
  const scoped = new Set(matchSuppliers({scope}, vendors).slugs);
  const candidates = vendors.filter(v => scoped.has(v.slug));
  const result = buildShortlist(candidates, input);
  return { matches: result.shortlist.map(v => ({slug:v.slug,name:v.name,gaps:v.gaps})), count:result.evaluation.filter(v=>v.eligible).length, sectorUnconfirmed:sectorUnconfirmedCoverage(candidates,input), considered:candidates.length };
}
