import assert from 'node:assert/strict';
process.env.KV_REST_API_URL = 'https://memory-test.invalid';
process.env.KV_REST_API_TOKEN = 'test-only';
const db = new Map<string, string>();
globalThis.fetch = async (input, init) => {
  assert.equal(String(input), process.env.KV_REST_API_URL);
  const [cmd, ...args] = JSON.parse(String(init?.body));
  let result: unknown;
  if (cmd === 'GET') result = db.get(args[0]) ?? null;
  else if (cmd === 'EVAL') {
    const [script, , key, previous, next] = args;
    if (script.includes('CAS') || script.includes("ARGV[2]")) {
      result = (db.get(key) ?? '') === previous ? 1 : 0;
      if (result) db.set(key, next);
    } else {
      result = db.get(key) === previous ? 1 : 0;
      if (result) db.delete(key);
    }
  } else throw new Error(`Unexpected command: ${cmd}`);
  return Response.json({ result });
};
const { setBuyerMemoryFields, getBuyerMemory, learnBuyerMemory, MemoryRevisionError } = await import('../src/lib/buyer-memory');
const { releaseLock } = await import('../src/lib/agent-store');
await Promise.all([
  setBuyerMemoryFields('one@example.test', { organisation: 'One' }),
  setBuyerMemoryFields('one@example.test', { regions: ['uk_ireland'] }),
  learnBuyerMemory('one@example.test', { notes: ['Retain this note'] }),
]);
let memory = (await getBuyerMemory('ONE@example.test'))!;
assert.equal(memory.revision, 3);
assert.equal(memory.organisation, 'One');
assert.deepEqual(memory.regions, ['uk_ireland']);
assert.deepEqual(memory.notes, ['Retain this note']);
await assert.rejects(setBuyerMemoryFields('one@example.test', { organisation: 'Stale' }, 1), MemoryRevisionError);
assert.equal(await getBuyerMemory('two@example.test'), null);
const legacy = { ...memory } as Record<string, unknown>;
delete legacy.revision; delete legacy.facts;
db.set('buyer:legacy@example.test:memory', JSON.stringify(legacy));
assert.equal((await getBuyerMemory('legacy@example.test'))!.revision, 0);
db.set('buyer:broken@example.test:memory', '{broken');
await assert.rejects(setBuyerMemoryFields('broken@example.test', { organisation: 'Do not overwrite' }));
assert.equal(db.get('buyer:broken@example.test:memory'), '{broken');
db.set('lock', 'new-owner');
await releaseLock('lock', 'expired-owner');
assert.equal(db.get('lock'), 'new-owner');
await releaseLock('lock', 'new-owner');
assert.equal(db.has('lock'), false);
memory = await setBuyerMemoryFields('one@example.test', { facts: [] }, 3);
assert.equal(memory.revision, 4);
console.log('PASS: concurrent writes, revisions, identity isolation, legacy migration, corrupt-record safety and atomic lock ownership.');
const { GET, POST } = await import('../src/app/api/buyer/assistant/route');
const { selectedMemoryText } = await import('../src/lib/buyer-assistant');
db.set('auth:sess:buyer-one', JSON.stringify({ token: 'buyer-one', email: 'one@example.test', role: 'buyer', expires: Date.now() + 60000 }));
db.set('auth:sess:buyer-two', JSON.stringify({ token: 'buyer-two', email: 'two@example.test', role: 'buyer', expires: Date.now() + 60000 }));
db.set('auth:sess:supplier', JSON.stringify({ token: 'supplier', email: 'one@example.test', role: 'supplier', expires: Date.now() + 60000 }));
function request(token: string, body?: unknown, origin = 'https://netify.co.uk') {
  return new Request('https://netify.co.uk/sase/api/buyer/assistant', { method: body === undefined ? 'GET' : 'POST', headers: { cookie: `netify_session=${token}`, origin, 'x-netify-account': token === 'buyer-two' ? 'two@example.test' : 'one@example.test', 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
assert.equal((await GET(request(''))).status, 401);
assert.equal((await GET(request('supplier'))).status, 401);
assert.equal((await POST(request('buyer-one', null))).status, 400);
assert.equal((await POST(request('buyer-one', {}, 'https://attacker.invalid'))).status, 403);
const create = { action: 'save_fact', revision: 4, text: 'Twenty sites in the UK', source: 'Buyer confirmed', confirmed: true, expires_at: null };
const saved = await POST(request('buyer-one', create));
assert.equal(saved.status, 200);
const savedMemory = (await saved.json()).memory;
const factId = savedMemory.facts[0].id;
assert.equal(savedMemory.revision, 5);
assert.equal((await POST(request('buyer-one', create))).status, 409);
assert.equal((await POST(request('buyer-one', { ...create, email: 'two@example.test' }))).status, 400);
assert.deepEqual((await (await GET(request('buyer-two'))).json()).memory.facts, []);
assert.equal((await POST(request('buyer-two', { action: 'forget_fact', revision: 0, id: factId }))).status, 400);
assert.equal(selectedMemoryText(savedMemory, [factId]), create.text);
assert.throws(() => selectedMemoryText({ ...savedMemory, facts: [{ ...savedMemory.facts[0], confirmed_at: null }] }, [factId]));
assert.throws(() => selectedMemoryText({ ...savedMemory, facts: [{ ...savedMemory.facts[0], expires_at: 1 }] }, [factId]));
assert.equal((await POST(request('buyer-one', { action: 'run_skill', skill: 'review_requirements', revision: 4, fact_ids: [factId], text: '' }))).status, 409);
const forgotten = await POST(request('buyer-one', { action: 'forget_fact', revision: 5, id: factId }));
assert.equal(forgotten.status, 200);
assert.deepEqual((await forgotten.json()).memory.facts, []);
process.env.NETIFY_BUYER_ASSISTANT_ENABLED = 'false';
assert.equal((await GET(request('buyer-one'))).status, 404);
delete process.env.NETIFY_BUYER_ASSISTANT_ENABLED;
console.log('PASS: authenticated API, supplier/anonymous denial, owner isolation, strict inputs, stale writes, source confirmation/expiry, forgetting and kill switch.');
const beforeSkill = new Map(db);
const realSkill = await POST(request('buyer-one', { action: 'run_skill', skill: 'compare_options', revision: 6, fact_ids: [], text: 'We need SD-WAN for 20 UK sites with managed operations and Microsoft Azure connectivity.' }));
assert.equal(realSkill.status, 200, await realSkill.clone().text());
const realResult = (await realSkill.json()).result;
assert.ok(realResult.brief.length > 0);
assert.equal(realResult.comparison.columns.length, 4);
assert.equal(realResult.memory_revision, 6);
assert.deepEqual(db, beforeSkill);
console.log('PASS: actual requirement extraction and delivery comparison complete without any project/publication writes.');

const changedAccount = request('buyer-two', { action: 'run_skill', skill: 'review_requirements', revision: 0, fact_ids: [], text: 'Private details from a different account' });
changedAccount.headers.set('x-netify-account', 'one@example.test');
assert.equal((await POST(changedAccount)).status, 409);
console.log('PASS: a changed login cannot reuse another account’s open assistant state.');
