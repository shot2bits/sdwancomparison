import { writeFileSync } from 'node:fs';
import { canonicalFixture, fact, documentFor } from './canonical-facts-fixture';
import { createHash } from "node:crypto";
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; repository has Node 20 definitions.
import { registerHooks } from 'node:module';
import { withFakeKv } from './fake-kv-harness';
import { getShortlistDataset } from '../src/lib/vendors';
import { ProjectDetailsSchema } from '../src/lib/rfp-types';
import { currentPublicBrief } from '../src/lib/current-buyer-facts';
import { shortProjectReadiness } from '../src/lib/short-project';

// Only external business verification and provider database are substituted.
// The real publication pipeline, board, snapshots, unlock and invitation persistence run against isolated KV.
const catalogueCase = process.env.TEST_CATALOGUE_CASE ?? "matched";
const noMatches = catalogueCase === "zero";
const vendors = (catalogueCase === "empty" ? [] : getShortlistDataset()).map(v => noMatches ? {...v, sectors: Object.fromEntries(Object.keys(v.sectors).map(key => [key,"unknown"])) as typeof v.sectors} : v);
const live = { vendors, source: 'neon', providerContractVersion: 'provider-match-records/2.0.0', datasetVersions: ['fixture-v1'], loadedAt: new Date().toISOString(), providerRevisions: vendors.map((v) => ({ slug: v.slug, providerId: v.slug, revisionId: `revision-${v.slug}`, datasetVersion: 'fixture-v1' })) };
const mocks: Record<string, string> = {
 'server-only': 'export {};',
 '@/lib/verify-business': 'export async function verifyBusinessEmail() { return { passed: true, domain: "buyer.example", checked_at: Date.now(), derived_company: "Private Buyer Ltd", failed_check: null }; }',
 '@/lib/live-shortlist': `export const LIVE_SHORTLIST_CONTRACT_VERSION="fixture"; export function shortlistInputFromProviderMatchInput(){throw new Error("not used in publication fixture")}; export async function getLiveShortlistDataset(){return getStrictLiveShortlistDataset()}; export async function getStrictLiveShortlistDataset(){if (process.env.TEST_CATALOGUE_CASE === "unavailable" || process.env.TEST_CATALOGUE_CHANGED === "1") throw new Error("fixture catalogue unavailable"); return ${JSON.stringify(live)}}`,
};
registerHooks({ resolve(specifier: string, context: object, next: (s: string,c: object) => { url: string }) {
 return mocks[specifier] ? { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true } : next(specifier,context);
} });
await withFakeKv(async () => {
 const {saveProject,kvSetJson,createSession,listConnections} = await import('../src/lib/rfp-store');
 const {POST} = await import('../src/app/api/mcp/route');
 const {executePublish} = await import('../src/lib/rfp-publish');
 const {getLatestPublishedSnapshot} = await import('../src/lib/published-snapshot');
 const {MARKETPLACE_PUBLICATION_CONSENT_TEXT: text, MARKETPLACE_PUBLICATION_CONSENT_VERSION: version} = await import('../src/lib/publication-policy');
 const {currentBuyerFacts} = await import('../src/lib/current-buyer-facts');
 const session = await createSession({role:'buyer',email:'owner@buyer.example',vendor_slug:null});
 for (const mode of ['quick_list','find_providers'] as const) {
  const p=canonicalFixture(mode); p.marketplace_revision=0; await saveProject(p);
  const token='mcp-parity-'+mode;
  const hash=createHash('sha256').update(token).digest('hex');
  await kvSetJson(`marketplace:project_session:${hash}`,{project_id:p.id,token_hash:hash,revision:0,created_at:Date.now(),expires_at:Date.now()+3600000});
  const call=async(name:string,args:Record<string,unknown>,authenticated=true)=>{
   const r=await POST(new Request('http://fixture/sase/api/mcp/',{method:'POST',headers:{'content-type':'application/json',...(authenticated?{cookie:`netify_session=${session.token}`}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
   const body=await r.json();return {body,value:body.result?.structuredContent ?? JSON.parse(body.result.content[0].text)};
  };
  const base={project_id:p.id,project_session_token:token};
  assert.equal((await call('start_project',{})).value.error,'explicit_consent_required');
  assert.equal((await call('get_unlocked_matches',base)).value.error,'market_locked');
  assert.equal((await call('get_project_status',base,false)).value.error,'verified_owner_required');
  assert.deepEqual((await call('get_project_status',base)).value.buyer_facts,currentBuyerFacts(p));
  const prepared=(await call('prepare_publication',{...base,base_revision:0,consent_text:text,consent_version:version})).value;
  assert.equal(prepared.revision,1);
  const args={...base,base_revision:1,consent_text:text,consent_version:version};
  assert.equal((await call('publish_opportunity',args,false)).value.error,'verified_owner_required');
  const published=(await call('publish_opportunity',args)).value;
  if(catalogueCase==='empty'||catalogueCase==='unavailable') {assert.ok(published.error);assert.equal((await listConnections(p.id)).length,0);console.log(`PASS ${mode}: ${catalogueCase} blocks MCP publication`);continue;}
  assert.equal(published.ok,true,JSON.stringify(published));
  const matches=(await call('get_unlocked_matches',base)).value;
  assert.equal(matches.buyer_facts.users,2);assert.equal(matches.buyer_facts.timeline,'Within two months');
  assert.equal(matches.publication_outcomes.invitations_created,noMatches?0:5);
  const snapshot=await getLatestPublishedSnapshot(p.id);
  assert.deepEqual(matches.buyer_facts,snapshot!.market_report.buyer_facts);
  assert.deepEqual((await call('publish_opportunity',args)).value,published);
  assert.equal((await listConnections(p.id)).length,noMatches?0:5);
  const other={...canonicalFixture(mode),id:p.id+'_web',share_token:p.share_token+'_web',manage_token:p.manage_token+'_web'};
  await saveProject(other);
  await executePublish(other,'owner@buyer.example',{list_on_board:true,shortlist_size:5});
  const browserSnapshot=await getLatestPublishedSnapshot(other.id);
  assert.deepEqual(browserSnapshot!.market_report.buyer_facts,matches.buyer_facts);
  assert.deepEqual(browserSnapshot!.matched_vendor_ids,snapshot!.matched_vendor_ids);
  const report=await import('../src/app/api/rfp/[id]/report/route');
  const reportJson=await(await report.GET(new Request(`http://fixture/report?manage=${p.manage_token}`),{params:Promise.resolve({id:p.id})})).json();
  assert.deepEqual(reportJson.market_report.buyer_facts,matches.buyer_facts);
  assert.equal((await call('get_unlocked_matches',base,false)).value.error,'verified_owner_required');
  writeFileSync(`../mcp-parity/parity-${catalogueCase}-${mode}.json`,JSON.stringify({synthetic:true,mode,catalogue:catalogueCase,document_facts:currentBuyerFacts(p),report_facts:reportJson.market_report.buyer_facts,mcp_facts:matches.buyer_facts,outcomes:matches.publication_outcomes,published_matches:snapshot!.matched_vendor_ids,website_matches:browserSnapshot!.matched_vendor_ids},null,2));
  console.log(`PASS ${mode}: MCP HTTP, website pipeline and report facts/matches/outcomes agree; safe replay and private denial`);
 }
});
