import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; repository has Node 20 definitions.
import { registerHooks } from 'node:module';
import { withFakeKv } from './fake-kv-harness';
import { getShortlistDataset } from '../src/lib/vendors';
import { ProjectDetailsSchema } from '../src/lib/rfp-types';
import { shortProjectReadiness } from '../src/lib/short-project';

// Only external business verification and provider database are substituted.
// The real publication pipeline, board, snapshots, unlock and invitation persistence run against isolated KV.
const vendors = getShortlistDataset();
const live = { vendors, source: 'neon', providerContractVersion: 'provider-match-records/2.0.0', datasetVersions: ['fixture-v1'], loadedAt: new Date().toISOString(), providerRevisions: vendors.map((v) => ({ slug: v.slug, providerId: v.slug, revisionId: `revision-${v.slug}`, datasetVersion: 'fixture-v1' })) };
const mocks: Record<string, string> = {
 'server-only': 'export {};',
 '@/lib/verify-business': 'export async function verifyBusinessEmail() { return { passed: true, domain: "buyer.example", checked_at: Date.now(), derived_company: "Private Buyer Ltd", failed_check: null }; }',
 '@/lib/live-shortlist': `export const LIVE_SHORTLIST_CONTRACT_VERSION="fixture"; export async function getStrictLiveShortlistDataset(){return ${JSON.stringify(live)}}`,
};
registerHooks({ resolve(specifier: string, context: object, next: (s: string,c: object) => { url: string }) {
 return mocks[specifier] ? { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true } : next(specifier,context);
} });
await withFakeKv(async () => {
 const { saveProject, getOpportunity, getProject } = await import('../src/lib/rfp-store');
 const { executePublish } = await import('../src/lib/rfp-publish');
 const { isMarketUnlocked } = await import('../src/lib/market-unlock');
 for (const mode of ['quick_list','find_providers'] as const) {
  const project = ProjectDetailsSchema.parse({ id: `rfp_${mode}_isolated`, title: 'Managed network refresh for manufacturing sites', created: Date.now(), updated: Date.now(), share_token: `share_${mode}`, manage_token: `manage_${mode}`, buyer: { organisation: 'Private Buyer Ltd', sector: 'manufacturing', site_count: 20, regions: ['uk_ireland'], product_scope: 'sdwan_only', operating_model: 'managed', notes: 'Replace ageing network equipment across twenty manufacturing sites with resilient managed connectivity.' }, journey: { contract_version: 'project-journey/1.0.0', source: 'shortlist', source_url: 'https://netify.co.uk/sase/shortlist/', mode, started_at: Date.now() }, entrance_context: { version: 'project-entrance/1.0.0', source: 'shortlist', captured_at: Date.now(), raw_input: { timescale: 'Within six months' } } });
  assert.equal(shortProjectReadiness(project).allowed, true);
  assert.equal(shortProjectReadiness({ ...project, buyer: { ...project.buyer, notes: 'Contact us at buyer@example.com for a private quote.' } }).allowed, false);
  await saveProject(project);
  const result = await executePublish(project, 'owner@buyer.example', { list_on_board: true, shortlist_size: 3 });
  assert.equal(result.board.listed, true, result.board.reason);
  assert.equal(await isMarketUnlocked(project.id), true);
  const { getLatestPublishedSnapshot, rfpContentSnapshot } = await import('../src/lib/published-snapshot');
  const snapshot = await getLatestPublishedSnapshot(project.id);
  writeFileSync(`/tmp/netify-published-${mode}.json`, JSON.stringify({ project: await getProject(project.id), snapshot, result }));
  const versioned = { ...project, entrance_context: { ...project.entrance_context!, raw_input: { ...project.entrance_context!.raw_input, publication_contract: 'short-project/1' } } };
  assert.notDeepEqual(rfpContentSnapshot(versioned), rfpContentSnapshot({ ...versioned, entrance_context: { ...versioned.entrance_context, raw_input: { ...versioned.entrance_context.raw_input, timescale: 'Next year' } } }), 'deadline changes cannot replay an earlier publication');
  const notice = (await getOpportunity(result.board.opportunity_id!))!;
  assert.equal(notice.timeline_note, 'Within six months');
  assert.equal(notice.response_mode, 'indicative_pricing');
  assert.equal(notice.buyer_org, '');
  assert.ok(!notice.summary.includes('Private Buyer Ltd'));
  assert.ok(notice.summary.includes(project.buyer.notes));
  const replay = await executePublish((await getProject(project.id))!, 'owner@buyer.example', { list_on_board: true, shortlist_size: 3 });
  assert.equal(replay.board.opportunity_id, result.board.opportunity_id, 'retry must not duplicate the board listing');
  console.log(`PASS ${mode}: real publish pipeline, anonymous notice, timescale, unlock, invitations and idempotent replay`);
 }
});
