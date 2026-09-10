// @ts-expect-error Node 24 runtime provides registerHooks.
import { registerHooks } from "node:module";
registerHooks({
  resolve(s: string, c: object, n: (s: string, c: object) => { url: string }) {
    return s === "server-only"
      ? { url: "data:text/javascript,export {};", shortCircuit: true }
      : n(s, c);
  },
});
import assert from "node:assert/strict";
import { withFakeKv } from "./fake-kv-harness";
import { CircuitInputSchema, newCircuitLine, CIRCUIT_CONSENT } from "../src/lib/circuit-schema";
const input = {
  company: "Private Company Ltd",
  sector: "manufacturing",
  timescale: "Six months",
  scope: "Underlay only" as const,
  lines: [
    {
      ...newCircuitLine(),
      name: "Private Factory",
      address: "Private Street, Birmingham B1 1AA",
      bandwidth: "1 Gbps",
    },
  ],
};
assert(CircuitInputSchema.safeParse(input).success);
for (const bandwidth of ["10003 months", "36 months", "3 years"]) {
  assert(!CircuitInputSchema.safeParse({...input, lines:[{...input.lines[0], bandwidth}]}).success);
}
for (const bandwidth of ["100 Mbps", "1 Gbps", "best available mobile speed", "Not sure", "1 Gbps for 36 months"]) {
  assert(CircuitInputSchema.safeParse({...input, lines:[{...input.lines[0], bandwidth}]}).success);
}
for (const patch of [
  { country: "Germany", router: "Meraki SD-WAN edge" },
  { remote: true, protect: true, devices: 10 },
  { resilience: "Dual RA02 Ethernet", kind: "Broadband" },
])
  assert(
    !CircuitInputSchema.safeParse({ ...input, lines: [{ ...input.lines[0], ...patch }] }).success,
  );
await withFakeKv(async () => {
  const s = await import("../src/lib/circuit-store");
  const intent = {id:crypto.randomUUID(),input,consent:CIRCUIT_CONSENT};
  const firstEmail = "circuit-acceptance@netify.co.uk";
  assert.equal(await s.circuitBuyerCanSignIn(firstEmail), false);
  await assert.rejects(()=>s.prepareCircuitBuyer({...intent,consent:""},firstEmail));
  const pending = await s.prepareCircuitBuyer(intent,firstEmail);
  assert.equal(pending.status,"draft"); assert.equal(pending.opportunity_id,null);
  assert.equal((await s.prepareCircuitBuyer(intent,firstEmail)).revision,1);
  await assert.rejects(()=>s.prepareCircuitBuyer(intent,"different@netify.co.uk"));
  await assert.rejects(()=>s.prepareCircuitBuyer({...intent,input:{...input,timescale:"Changed"}},firstEmail));
  assert.equal(await s.circuitBuyerCanSignIn(firstEmail),true);
  assert.equal(await s.circuitBuyerCanSignIn("different@netify.co.uk"),false);
  const authRequest = await import("../src/app/api/auth/request/route");
  const {issueAuthChallenge} = await import("../src/lib/auth-challenge");
  const now = Date.now;
  let challenge;
  try { Date.now = ()=>now()-1000; challenge=issueAuthChallenge(); } finally { Date.now=now; }
  const freshIntent={...intent,id:crypto.randomUUID()};
  const signup = await authRequest.POST(new Request("https://netify.co.uk/sase/api/auth/request",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"new-circuit-buyer@netify.co.uk",role:"buyer",return_to:"/sase/circuit-pricing/?request="+freshIntent.id,circuit_intent:freshIntent,bot_proof:{challenge,website:""}})}));
  assert.equal(signup.status,200);
  const signupBody = await signup.json(); assert(signupBody.dev_link);
  const {consumeMagicToken} = await import("../src/lib/rfp-store");
  const signedIdentity=await consumeMagicToken(new URL(signupBody.dev_link).searchParams.get("token")!);
  assert.equal(signedIdentity?.email,"new-circuit-buyer@netify.co.uk");
  console.log("PASS first-time circuit buyer verification; no RFP prerequisite; unverified draft remains private; ownership and retries preserved");
  const { getOpportunity } = await import("../src/lib/rfp-store");
  const { toPublicOpportunity } = await import("../src/lib/opportunity-types");
  const buyer = {
      token: "buyer",
      role: "buyer" as const,
      email: "buyer@example.test",
      vendor_slug: null,
      created: 1,
      expires: Date.now() + 1e6,
    },
    other = { ...buyer, email: "other@example.test" },
    admin = { ...buyer, email: "support@netify.com" };
  const id = crypto.randomUUID();
  let r = await s.circuitSave(id, input, 0, buyer);
  assert.equal(r.revision, 1);
  await assert.rejects(() => s.circuitGet(id, other), /not found/);
  assert.equal((await s.circuitSave(id, input, 0, buyer)).revision,1);
  await assert.rejects(() => s.circuitSave(id, {...input,timescale:"Changed timescale"}, 0, buyer), /changed/);
  await assert.rejects(() => s.circuitPublish(id, 1, "no", buyer), /consent/);
  r = await s.circuitPublish(id, 1, CIRCUIT_CONSENT, buyer);
  assert.equal(r.status, "sourcing");
  assert.equal(
    (await s.circuitPublish(id, 1, CIRCUIT_CONSENT, buyer)).opportunity_id,
    r.opportunity_id,
  );
  const pub = JSON.stringify(toPublicOpportunity((await getOpportunity(r.opportunity_id!))!));
  for (const secret of ["Private Company", "Private Street", "Private Factory", "buyer@example"])
    assert(!pub.includes(secret), secret);
  await assert.rejects(() => s.circuitSave(id, input, r.revision, buyer), /frozen/);
  const q = {
    id: crypto.randomUUID(),
    line_id: input.lines[0].id,
    supplier: "Test supplier",
    reference: "Q123",
    currency: "GBP",
    monthly: 300,
    installation: 0,
    term: "36 months",
    lead_time: "60 days",
    valid_until: "2030-01-01",
    sla: "99.9%",
    resilience_confirmation: "Pending survey",
    exclusions: "Subject to survey",
    evidence_url: "https://example.com/quote",
    protection_details: "Not selected",
    notes: "",
  };
  await assert.rejects(() => s.circuitAddQuote(id, q, buyer), /Admin/);
  r = await s.circuitAddQuote(id, q, admin);
  assert.equal(r.quotes.length, 1);
  r = await s.circuitAddQuote(id, q, admin);
  assert.equal(r.quotes.length, 1);
  r = await s.circuitNotify(id, q.id, admin);
  assert.equal(r.quotes[0].notification, "failed");
  assert.equal((await s.circuitList(other)).length, 0);
  const { createCircuitAccess, readCircuitAccess } = await import("../src/lib/circuit-agent");
  const access = await createCircuitAccess(id, buyer);
  assert.equal((await readCircuitAccess(id, access.token)).quotes.length, 1);
  await assert.rejects(() => createCircuitAccess(id, other));
  await createCircuitAccess(id, buyer);
  await assert.rejects(() => readCircuitAccess(id, access.token));
  const oldFetch = global.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "test-only";
  let sends = 0;
  global.fetch = (async (u, init) => {
    if (String(u) === "https://api.resend.com/emails") {
      sends++;
      return new Response("{}", { status: 200 });
    }
    return oldFetch(u, init);
  }) as typeof fetch;
  try {
    r = await s.circuitNotify(id, q.id, admin);
    assert.equal(r.quotes[0].notification, "accepted");
    await s.circuitNotify(id, q.id, admin);
    assert.equal(sends, 1);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldKey;
  }
  const {createSession}=await import('../src/lib/rfp-store');
  const route=await import('../src/app/api/circuits/route');
  assert.equal((await route.GET(new Request('https://netify.co.uk/sase/api/circuits/'))).status,401);
  const cookie=(await createSession({role:'buyer',email:buyer.email,vendor_slug:null})).token;
  const response=await route.GET(new Request('https://netify.co.uk/sase/api/circuits/?id='+id,{headers:{cookie:'netify_session='+cookie}}));
  assert.equal(response.status,200);assert.equal((await response.json()).request.id,id);
  assert.equal((await route.GET(new Request('https://netify.co.uk/sase/api/circuits/?admin=1',{headers:{cookie:'netify_session='+cookie}}))).status,403);
  assert.equal((await route.POST(new Request('https://netify.co.uk/sase/api/circuits/',{method:'POST',headers:{cookie:'netify_session='+cookie,origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({id,action:'publish',revision:2,consent:CIRCUIT_CONSENT})}))).status,403);
  console.log(
    "PASS circuit privacy, ownership, consent, frozen specs, quote idempotency and honest notification failure.",
  );
});
