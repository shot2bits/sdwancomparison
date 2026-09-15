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
 const { saveProject, getOpportunity, getProject, listConnections, saveConnection, saveResponse, kvSetJson } = await import('../src/lib/rfp-store');
 const { executePublish } = await import('../src/lib/rfp-publish');
 const { isMarketUnlocked } = await import('../src/lib/market-unlock');
 for (const mode of ['quick_list','find_providers'] as const) {
  const project = ProjectDetailsSchema.parse({ id: `rfp_${mode}_isolated`, title: 'Managed network refresh for manufacturing sites', owner_email: 'owner@buyer.example', created: Date.now(), updated: Date.now(), share_token: `share_${mode}`, manage_token: `manage_${mode}`, buyer: { organisation: 'Private Buyer Ltd', sector: 'manufacturing', site_count: 20, regions: ['uk_ireland'], product_scope: 'sdwan_only', pinned_vendors: noMatches ? [vendors[0].slug] : [], operating_model: 'managed', notes: 'Replace ageing network equipment across twenty manufacturing sites with resilient managed connectivity.' }, journey: { contract_version: 'project-journey/1.0.0', source: 'shortlist', source_url: 'https://netify.co.uk/sase/shortlist/', mode, started_at: Date.now() }, entrance_context: { version: 'project-entrance/1.0.0', source: 'shortlist', captured_at: Date.now(), raw_input: { timescale: 'Within six months' } } });
  assert.equal(shortProjectReadiness(project).allowed, true);
  assert.equal(shortProjectReadiness({ ...project, buyer: { ...project.buyer, notes: 'Contact us at buyer@example.com for a private quote.' } }).allowed, false);
  const canonical = ProjectDetailsSchema.parse({ ...project, facts: [{ id: 'users', path: 'estate.users', value: 2, provenance: 'stated', struck: false, source: 'answer', cycle: 1 }, { id: 'timeline', path: 'constraints.timeline', value: 'Next quarter', provenance: 'stated', struck: false, source: 'answer', cycle: 1 }] });
  assert.ok(currentPublicBrief(canonical).summary.includes(project.buyer.notes));
  assert.ok(currentPublicBrief(canonical).summary.includes('2 users in scope.'));
  assert.equal(currentPublicBrief(canonical).timeline, 'Next quarter');
  assert.equal(shortProjectReadiness({ ...canonical, buyer: { ...canonical.buyer, notes: 'Contact buyer@example.com for the requirement.' } }).allowed, false);
  await saveProject(project);
  const mcpToken = `isolated-${mode}`;
  const tokenHash = createHash('sha256').update(mcpToken).digest('hex');
  await kvSetJson(`marketplace:project_session:${tokenHash}`, { project_id: project.id, token_hash: tokenHash, revision: 0, created_at: Date.now(), expires_at: Date.now()+3600000 });
  const { callRfpTool } = await import('../src/lib/mcp-rfp-tools');
  const mcpArgs = { project_id: project.id, project_session_token: mcpToken };
  assert.deepEqual(await callRfpTool('get_unlocked_matches', mcpArgs, {verifiedBuyerEmail:'owner@buyer.example'}), {error:'market_locked'});
  const reportRoute = await import('../src/app/api/rfp/[id]/report/route');
  const ctx = { params: Promise.resolve({ id: project.id }) };
  assert.equal((await reportRoute.GET(new Request(`http://test/sase/api/rfp/${project.id}/report`), ctx)).status, 401);
  const ownerRequest = () => new Request(`http://test/sase/api/rfp/${project.id}/report?manage=${project.manage_token}`);
  const locked = await (await reportRoute.GET(ownerRequest(), ctx)).json();
  assert.equal(locked.preview, true);
  assert.equal(locked.computed_matches, undefined);
  if (catalogueCase === 'empty' || catalogueCase === 'unavailable') {
    await assert.rejects(executePublish(project, 'owner@buyer.example', { list_on_board: true }), /catalogue/);
    assert.equal(await isMarketUnlocked(project.id), false);
    assert.equal((await listConnections(project.id)).length, 0);
    assert.equal((await getProject(project.id))!.status, 'draft');
    console.log(`PASS ${mode}: ${catalogueCase} catalogue blocks publication and invitations`);
    continue;
  }
  if (process.env.TEST_SNAPSHOT_FAILURE === '1') {
    const originalFetch = global.fetch;
    const failKey = `rfp:${project.id}:${mode === 'quick_list' ? 'published_snapshot' : 'published_snapshots'}`;
    let failed = false;
    global.fetch = (async (input, init) => {
      const command = init?.body ? JSON.parse(String(init.body)) : [];
      if (!failed && command[0] === 'SET' && command[1] === failKey) {
        failed = true;
        throw new Error('synthetic snapshot storage failure');
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    try {
      await assert.rejects(executePublish(project, 'owner@buyer.example', { list_on_board: true, shortlist_size: 3 }), /synthetic snapshot storage failure/);
    } finally { global.fetch = originalFetch; }
    assert.equal(failed, true);
    process.env.TEST_CATALOGUE_CHANGED = '1';
  }
  const publishInput = process.env.TEST_SNAPSHOT_FAILURE === '1' ? (await getProject(project.id))! : project;
  const simultaneous = await Promise.allSettled([
    executePublish(publishInput, 'owner@buyer.example', { list_on_board: true, shortlist_size: 3 }),
    executePublish(publishInput, 'owner@buyer.example', { list_on_board: true, shortlist_size: 3 }),
  ]);
  const successful = simultaneous.filter(r => r.status === 'fulfilled');
  assert.equal(successful.length, 1, 'concurrent publication is serialised: ' + simultaneous.filter(r => r.status === 'rejected').map(r => String((r as PromiseRejectedResult).reason)).join('; '));
  const result = (successful[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof executePublish>>>).value;
  assert.equal(result.board.listed, true, result.board.reason);
  assert.equal(await isMarketUnlocked(project.id), true);
  const { getLatestPublishedSnapshot, rfpContentSnapshot } = await import('../src/lib/published-snapshot');
  delete process.env.TEST_CATALOGUE_CHANGED;
  const snapshot = await getLatestPublishedSnapshot(project.id);
  const { getPublishedSnapshotHistory, savePublishedSnapshot } = await import('../src/lib/published-snapshot');
  assert.equal((await getPublishedSnapshotHistory(project.id)).length, 1);
  await savePublishedSnapshot(project.id, { ...snapshot!, computed_matches: [] });
  assert.deepEqual(await getLatestPublishedSnapshot(project.id), snapshot, 'same revision cannot be overwritten');
  assert.equal(snapshot!.market_report.matched.total_evaluated_market, vendors.length);
  assert.equal(snapshot!.market_report.matched.count, noMatches ? 0 : 3);
  assert.equal(snapshot!.matched_vendor_ids.length, noMatches ? 0 : 3);
  assert.equal(snapshot!.invited_vendor_ids.length, noMatches ? 0 : 3);
  assert.equal(snapshot!.provider_provenance!.evaluated_provider_count, vendors.length);
  assert.equal(snapshot!.provider_provenance!.matching_rules_version, 'shortlist-matching/2026-09-15.1');
  assert.ok(snapshot!.provider_provenance!.evaluated_at);
  assert.equal(snapshot!.provider_provenance!.evaluation!.length, vendors.length);
  assert.equal(snapshot!.provider_provenance!.eligible_provider_count, snapshot!.provider_provenance!.evaluation!.filter(v => v.eligible).length);
  assert.equal(snapshot!.computed_matches!.length, noMatches ? 0 : 3);
  if (noMatches) assert.ok(snapshot!.provider_provenance!.evaluation!.every(v => v.reasons.length > 0));
  const frozenBefore = JSON.stringify(snapshot);
  const { publicationOutcomes } = await import('../src/lib/publication-outcomes');
  let outcomes = await publicationOutcomes(project.id, snapshot);
  assert.equal(outcomes.invitations_created, noMatches ? 0 : 3);
  assert.equal(outcomes.delivery.not_attempted, noMatches ? 0 : 3);
  assert.equal(outcomes.supplier_responses, 0);
  assert.equal((await publicationOutcomes(project.id, null)).providers_evaluated, null);
  if (!noMatches) {
    const connection = (await listConnections(project.id))[0];
    await saveConnection({ ...connection, delivery: { state: 'failed', updated_at: Date.now(), receipt_ref: 'synthetic-transport-failure' } });
    await saveResponse({ id: 'draft-'+mode, rfp_id: project.id, vendor: connection.vendor_name, vendor_slug: connection.vendor_slug, answers: {}, created: Date.now(), submitted: null });
    outcomes = await publicationOutcomes(project.id, snapshot);
    assert.equal(outcomes.delivery.failed, 1);
    assert.equal(outcomes.supplier_responses, 0, 'a draft response is not submitted');
    await saveResponse({ id: 'submitted-'+mode, rfp_id: project.id, vendor: connection.vendor_name, vendor_slug: connection.vendor_slug, answers: { requirement: 'Synthetic supplier response' }, created: Date.now(), submitted: Date.now() });
    assert.equal((await publicationOutcomes(project.id, snapshot)).supplier_responses, 1);
    assert.equal(JSON.stringify(await getLatestPublishedSnapshot(project.id)), frozenBefore, 'delivery/response changes must not rewrite the snapshot');
  }
  const visible = await (await reportRoute.GET(ownerRequest(), ctx)).json();
  assert.equal(visible.computed_matches.length, noMatches ? 0 : 3);
  assert.equal((await reportRoute.GET(new Request(`http://test/sase/api/rfp/${project.id}/report`), ctx)).status, 401);
  assert.deepEqual(await callRfpTool('get_unlocked_matches', mcpArgs), {error:'verified_owner_required'});
  assert.deepEqual(await callRfpTool('get_unlocked_matches', mcpArgs, {verifiedBuyerEmail:'another@buyer.example'}), {error:'verified_owner_required'});
  const unlocked = await callRfpTool('get_unlocked_matches', mcpArgs, {verifiedBuyerEmail:'owner@buyer.example'}) as {matches:Array<{slug:string;score:number}>};
  assert.deepEqual(unlocked.matches.map(v => v.score), snapshot!.computed_matches!.map(v => v.score));
  process.env.TEST_CATALOGUE_CHANGED = '1';
  const versioned = { ...project, entrance_context: { ...project.entrance_context!, raw_input: { ...project.entrance_context!.raw_input, publication_contract: 'short-project/1' } } };
  assert.notDeepEqual(rfpContentSnapshot(versioned), rfpContentSnapshot({ ...versioned, entrance_context: { ...versioned.entrance_context, raw_input: { ...versioned.entrance_context.raw_input, timescale: 'Next year' } } }), 'deadline changes cannot replay an earlier publication');
  const notice = (await getOpportunity(result.board.opportunity_id!))!;
  assert.equal(notice.timeline_note, 'Within six months');
  assert.equal(notice.response_mode, 'indicative_pricing');
  assert.equal(notice.buyer_org, '');
  assert.ok(!notice.summary.includes('Private Buyer Ltd'));
  assert.ok(notice.summary.includes(project.buyer.notes));
  const replay = await executePublish((await getProject(project.id))!, 'owner@buyer.example', { list_on_board: true, shortlist_size: 3 });
  delete process.env.TEST_CATALOGUE_CHANGED;
  assert.equal((await listConnections(project.id)).length, noMatches ? 0 : 3);
  assert.equal(JSON.stringify(await getLatestPublishedSnapshot(project.id)), frozenBefore);
  assert.equal(replay.board.opportunity_id, result.board.opportunity_id, 'retry must not duplicate the board listing');
  console.log(`PASS ${mode}: real publish pipeline, anonymous notice, timescale, unlock, invitations and idempotent replay`);
 }
});
