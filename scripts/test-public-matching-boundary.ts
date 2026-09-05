import assert from 'node:assert/strict';
import { callMcpTool } from '../src/lib/mcp-tools';
import { publicShortlistPreview } from '../src/lib/public-shortlist';
import { getShortlistDataset } from '../src/lib/vendors';
const vendors = getShortlistDataset();
const preview = publicShortlistPreview(vendors, { service_model: 'managed', shortlist_size: 3 });
assert.equal(preview.requires_publication, true);
assert.equal(typeof preview.eligible_count, 'number');
for (const v of vendors) {
 assert.ok(!JSON.stringify(preview).includes(`"${v.slug}"`), 'no provider identity in personalised public preview');
 assert.ok(!JSON.stringify(preview).includes(v.name));
}
const mcp = await callMcpTool('build_sase_shortlist', { required_regions: ['europe'] }) as Record<string, unknown>;
assert.equal(mcp.requires_publication, true);
assert.equal(mcp.shortlist, undefined);
assert.equal(mcp.near_misses, undefined);
const compared = await callMcpTool('compare_vendors', { slugs: ['bt-business','vodafone-business'] }) as { slugs: string[] };
assert.deepEqual(compared.slugs, ['bt-business','vodafone-business']);
const base = await callMcpTool('explain_shortlist', { a: 'bt-business', b: 'vodafone-business' }) as { a: unknown; b: unknown };
const criteria = await callMcpTool('explain_shortlist', { a: 'bt-business', b: 'vodafone-business', criteria: { sector: 'manufacturing', required_regions: ['china_mainland'] } }) as typeof base;
assert.deepEqual(criteria.a, base.a, 'public explanation cannot become personalised via criteria');
assert.deepEqual(criteria.b, base.b);
console.log('PASS public factual comparisons remain available; personalised matching cannot bypass publication');
