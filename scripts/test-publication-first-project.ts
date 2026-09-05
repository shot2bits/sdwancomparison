import { registerHooks } from 'node:module';
// Next supplies this build-time boundary marker; standalone service tests use its empty server implementation.
registerHooks({ resolve(specifier, context, next) { return specifier === 'server-only' ? { url: 'data:text/javascript,export {};', shortCircuit: true } : next(specifier, context); } });
import assert from 'node:assert/strict';
import { withFakeKv } from './fake-kv-harness';

await withFakeKv(async () => {
  const service = await import('../src/lib/marketplace-project-session');
  const { MARKETPLACE_PUBLICATION_CONSENT_TEXT: consent_text, MARKETPLACE_PUBLICATION_CONSENT_VERSION: consent_version } = await import('../src/lib/publication-policy');
  const { getProject, saveProject } = await import('../src/lib/rfp-store');
  const entrance_context = { version: 'project-entrance/1.0.0', source: 'shortlist', captured_at: Date.now(), requirement_text: 'Connect our shops with a resilient managed network.', buyer_input: { site_count: 12, sector: 'retail_ecommerce', regions: ['uk_ireland'] }, raw_input: { solution_scope: 'sdwan', timescale: 'six months' } };
  const draft = await service.startMarketplaceProject({ entrance_context, mode: 'find_providers' });
  const id = draft.project_reference, token = draft.project_session_token;
  const recovered = await service.readMarketplaceProject(id, token);
  assert.equal(recovered.buyer.site_count, 12);
  assert.equal(recovered.mode, 'find_providers');
  assert.equal(JSON.stringify(recovered).includes('manage_token'), false);
  await assert.rejects(service.readMarketplaceProject(id, 'wrong-token'));
  await assert.rejects(service.prepareMarketplacePublication(id, token, { base_revision: 0, consent_text, consent_version }), /company/);
  const update = { base_revision: 0, idempotency_key: 'company-confirmation', buyer_patch: { organisation: 'Example Retail Ltd' } };
  const saved = await service.updateMarketplaceProject(id, token, update);
  assert.equal(saved.revision, 1);
  assert.deepEqual(await service.updateMarketplaceProject(id, token, update), saved, 'retry is idempotent');
  await assert.rejects(service.updateMarketplaceProject(id, token, { ...update, idempotency_key: 'stale-update' }), /Revision/);
  await service.prepareMarketplacePublication(id, token, { base_revision: 1, consent_text, consent_version });
  assert.equal((await service.readMarketplaceProject(id, token)).prepared, true);
  await service.updateMarketplaceProject(id, token, { base_revision: 2, idempotency_key: 'changed-requirements', buyer_patch: { site_count: 20 } });
  assert.equal((await service.readMarketplaceProject(id, token)).prepared, false, 'editing requires renewed review');
  const project = (await getProject(id))!;
  await saveProject({ ...project, marketplace_revision: 4 });
  await assert.rejects(service.updateMarketplaceProject(id, token, { base_revision: 3, idempotency_key: 'external-edit', buyer_patch: { site_count: 25 } }), /changed/);
  console.log('PASS project reload, token isolation, company gate, idempotency, stale edits and consent invalidation');
});
