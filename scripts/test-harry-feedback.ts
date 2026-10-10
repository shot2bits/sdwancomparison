import assert from 'node:assert/strict';
import { sourcingEvidence } from '../src/lib/sourcing-evidence';
import { getLiveShortlistDataset } from '../src/lib/live-shortlist';
import { getShortlistDataset } from '../src/lib/vendors';
import { applyReviewedComparisonEvidence } from '../src/lib/reviewed-comparison-evidence';
import { ukStatus } from '../src/lib/shortlist-entity';
import type { SourcingBrief } from '../src/lib/sourcing-contract';
const brief: SourcingBrief = { sites: 25, remote_users: 50, region: 'uk_ireland', sector: 'retail_ecommerce', need: 'sase', when: 'Exploring options', requirement: '', supplier_brief: '' };
const original = getShortlistDataset()[0];
const provider = (slug: string, region: string, sector: string, scope = 'yes', uk = 'not_confirmed') => ({
  ...structuredClone(original), slug, name: slug,
  regions: { ...original.regions, uk_ireland: region },
  sectors: { ...original.sectors, retail_ecommerce: sector },
  capabilities: { ...original.capabilities, f28_full_sase_platform: scope },
  uk_delivery: uk,
}) as typeof original;
const vendors = [provider('match', 'yes', 'yes'), provider('sector-gap', 'yes', 'unknown'), provider('region-gap', 'unknown', 'partial'), provider('no-context', 'unknown', 'unknown'), provider('unsupported-service', 'yes', 'yes', 'not_primary'), provider('unsupported-sector', 'yes', 'not_primary'), provider('unsupported-region', 'not_primary', 'yes')];
const result = sourcingEvidence(vendors, brief);
assert.deepEqual(result.matches.map(v => v.slug), ['match']);
assert.deepEqual(result.investigation.map(v => v.slug), ['sector-gap', 'region-gap']);
assert.match(result.investigation[0].reasons.join(' '), /Retail.*needs review/);
assert.match(result.investigation[1].reasons.join(' '), /UK and Ireland.*needs review/);
assert.ok(!result.investigation.some(v => v.slug.startsWith('unsupported') || v.slug === 'no-context'));
const ukOnly = sourcingEvidence(vendors, { ...brief, uk_provider_only: true });
assert.equal(ukOnly.matches.length, 0);
assert.ok(ukOnly.investigation.every(v => v.reasons.some(r => r.includes('UK headquarters'))));
assert.ok(ukOnly.outstanding_checks.includes('a UK headquarters or contracting entity'));
assert.deepEqual(sourcingEvidence(vendors, {...brief, when: 'Within 3 months', sites: 500 }).matches, result.matches, 'counts and timing must not silently alter evidence filters');
const live = await getLiveShortlistDataset();
const retail = sourcingEvidence(live.vendors, brief);
console.log(JSON.stringify({ source: live.source, retail_matches: retail.matches.map(v => v.name), investigation: retail.investigation, outstanding_checks: retail.outstanding_checks }, null, 2));
const expired = { ...original, uk_delivery: 'not_confirmed' as const, uk_evidence: { ...original.uk_evidence!, entity: { status: 'evidenced', source_urls: ['https://example.com'], checked_at: '2026-09-30', qualification: 'Old' } } } as typeof original;
assert.equal(ukStatus(expired).reviewed_at, null);
assert.deepEqual(ukStatus(expired).source_urls, []);
console.log('PASS Harry feedback: strict matches, qualified investigation options, unsupported exclusions, UK filter separation, timing and count invariance, stale UK evidence guard');

const bt = provider('bt-business', 'yes', 'yes');
bt.capabilities.f37_customer_portal_and_rbac = 'unknown';
applyReviewedComparisonEvidence(bt, '2026-09-01', Date.parse('2026-10-10T12:00:00Z'));
assert.equal(bt.capabilities.f37_customer_portal_and_rbac, 'partial');
assert.equal(bt.capabilities.f12_application_aware_routing, 'yes');
for (const [governed, now] of [['2026-10-11', '2026-10-12'], ['2026-09-01', '2027-01-08'], ['2026-09-01', '2026-10-09']]) {
  const untouched = provider('bt-business', 'yes', 'yes');
  untouched.capabilities.f37_customer_portal_and_rbac = 'unknown';
  applyReviewedComparisonEvidence(untouched, governed, Date.parse(now));
  assert.equal(untouched.capabilities.f37_customer_portal_and_rbac, 'unknown', 'newer reviews, expired evidence and future reviews must remain authoritative');
}
assert.equal(live.vendors.find(v=>v.slug === 'bt-business')?.capabilities.f37_customer_portal_and_rbac, 'partial');
assert.equal(live.vendors.find(v=>v.slug === 'virgin-media-o2')?.capabilities.f26_sla_backed_service_fabric, 'partial');
console.log('PASS partner evidence: qualified grades, fallback projection, superseding review, expiry and future-review bounds');
