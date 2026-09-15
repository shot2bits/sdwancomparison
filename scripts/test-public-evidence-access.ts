import assert from 'node:assert/strict';
// @ts-expect-error Node 24 hook API
import { registerHooks } from 'node:module';
import { getShortlistDataset } from '../src/lib/vendors';
import { withFakeKv } from './fake-kv-harness';
const vendors = getShortlistDataset();
const live = { vendors, source: 'snapshot_fallback', providerContractVersion: 'snapshot', datasetVersions: [], providerRevisions: [], loadedAt: new Date().toISOString() };
registerHooks({ resolve(s: string, c: object, next: (s: string,c: object) => {url:string}) {
 const source = s === 'server-only' ? 'export {};' : s === '@/lib/live-shortlist' ? `export const LIVE_SHORTLIST_CONTRACT_VERSION="fixture"; export async function getLiveShortlistDataset(){return ${JSON.stringify(live)}}` : null;
 return source ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true } : next(s,c);
}});
function noScores(value: unknown): void {
 if (!value || typeof value !== 'object') return;
 for (const [key, child] of Object.entries(value)) {
  assert.ok(!['rank','score','default_shortlist','top_providers_at_balanced_setting','ranking'].includes(key), `public key ${key}`);
  noScores(child);
 }
}
await withFakeKv(async () => {
 const json = await import('../src/app/(marketing)/shortlist/data.json/route');
 const csv = await import('../src/app/(marketing)/shortlist/data.csv/route');
 const req = new Request('http://test/sase/shortlist/data.json');
 const response = await json.GET(req); const data = await response.json();
 noScores(data); assert.equal(data.vendors.length, 30); assert.ok(data.vendors[0].capabilities);
 assert.equal(response.headers.get('cache-control'), 'no-store');
 const body = await (await csv.GET(new Request('http://test/sase/shortlist/data.csv?view=all'))).text();
 assert.ok(!body.split('\r\n')[0].includes('"rank"')); assert.ok(!body.split('\r\n')[0].includes('"score"'));
 const { callMcpTool } = await import('../src/lib/mcp-tools');
 for (const [tool,args] of [['build_sase_shortlist',{required_regions:['north_america']}],['compare_vendors',{slugs:vendors.slice(0,2).map(v=>v.slug)}],['explain_shortlist',{a:vendors[0].slug,b:vendors[1].slug}]] as const) noScores(await callMcpTool(tool,args));
 const best = await import('../src/app/(marketing)/best/[slug]/data.json/route');
 const { BEST_PAGES } = await import('../src/lib/best-pages');
 noScores(await (await best.GET(req,{params:Promise.resolve({slug:BEST_PAGES[0].slug})})).json());
 const alternatives = await import('../src/app/(marketing)/alternatives/[slug]/data.json/route');
 noScores(await (await alternatives.GET(req,{params:Promise.resolve({slug:vendors[0].slug})})).json());
 console.log('PASS public JSON/CSV, curated twins and MCP tools: source evidence retained, computed rankings absent');
});
