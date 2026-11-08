// @ts-expect-error Node 24 supplies registerHooks.
import { registerHooks } from "node:module";
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s === "server-only" ? {url:"data:text/javascript,export {};",shortCircuit:true}:n(s,c);}});
import assert from "node:assert/strict";
import { withFakeKv, FAKE_KV_URL, makeRequest } from "./fake-kv-harness";
await withFakeKv(async store => {
  process.env.VERCEL_ENV = "production";
  process.env.RESEND_API_KEY = "synthetic-test-key-never-sent";
  process.env.CRON_SECRET = "fixture-cron-secret";
  const kv = await import("../src/lib/rfp-store");
  const alerts = await import("../src/lib/admin-alerts");
  const cron = await import("../src/app/api/cron/admin-alerts/route");
  const originalFetch = global.fetch;
  let mode: "reject" | "accept" | "timeout" = "reject", sent = 0, failReceipt = false;
  const keys:string[] = [], bodies:string[] = [];
  global.fetch = async(input,init) => {
    const url = String(input);
    if(url === FAKE_KV_URL){
      const cmd = JSON.parse(String(init?.body ?? "[]"));
      if(failReceipt && cmd[0] === "SET" && String(cmd[1]).startsWith("admin-alerts:record:") && JSON.parse(cmd[2]).status === "accepted") {failReceipt=false; throw Error("Injected receipt write failure");}
      return originalFetch(input,init);
    }
    assert.equal(url,"https://api.resend.com/emails");
    sent++; keys.push(new Headers(init?.headers).get("Idempotency-Key")!); bodies.push(String(init?.body));
    if(mode === "timeout") throw Error("Injected ambiguous network timeout");
    return mode === "reject" ? Response.json({error:"Rate limited"},{status:429}) : Response.json({id:"synthetic-resend-id"});
  };
  const record = (id:string) => store.peekJson<import("../src/lib/admin-alerts").AdminAlert>(`admin-alerts:record:${id}`)!;
  const due = async(id:string) => {await kv.kvSetJson(`admin-alerts:record:${id}`, {...record(id),next_attempt:0});};
  const claim = await kv.requestVendorClaim("cisco","qa@cisco.com","cisco.com");
  const event = {kind:"supplier" as const,reference:"cisco",requested:claim.requested};
  const id = alerts.adminAlertId(event);
  assert.equal(record(id).status,"pending"); assert.equal(sent,1);
  assert.equal(record(id).payload!.to,"support@netify.com");
  assert.match(record(id).payload!.text,/#supplier-approvals/);
  await alerts.deliverAdminAlert(id); assert.equal(sent,1,"Backoff prevents request bursts");
  const repeat = await kv.requestVendorClaim("cisco","qa@cisco.com","cisco.com");
  assert.equal(repeat.requested,claim.requested);assert.equal(sent,1,"Repeated pending claim does not spam");
  assert.equal((await cron.GET(makeRequest("GET","https://fixture/cron"))).status,401);
  await due(id); mode="accept";
  const retried = await cron.GET(makeRequest("GET","https://fixture/cron",{headers:{authorization:"Bearer fixture-cron-secret"}}));
  assert.equal(retried.status,200);assert.equal(record(id).status,"accepted");assert.equal(sent,2);
  assert.equal(keys[0],keys[1]);assert.equal(bodies[0],bodies[1]);
  assert.equal((await (await import("../src/lib/email-bounces")).getResendSend("synthetic-resend-id"))!.kind,"admin_alert");
  await alerts.queueAdminAlert(event);await alerts.deliverAdminAlert(id);assert.equal(sent,2);
  assert.equal((await alerts.adminAlertSummary()).pending,0);
  // A send accepted by Resend but not saved locally uses the SAME immutable payload/key on retry.
  failReceipt=true;
  const second = await kv.requestVendorClaim("fortinet","qa@fortinet.com","fortinet.com");
  const secondId=alerts.adminAlertId({kind:"supplier",reference:"fortinet",requested:second.requested});
  assert.equal(record(secondId).status,"pending");
  await due(secondId);await alerts.deliverAdminAlert(secondId);
  assert.equal(record(secondId).status,"accepted");assert.equal(keys[2],keys[3]);assert.equal(bodies[2],bodies[3]);
  // Never send for an event whose source commit has not happened.
  const absent=await alerts.queueAdminAlert({kind:"supplier",reference:"absent",requested:1});
  const beforeAbsent=sent;await alerts.deliverAdminAlert(absent);assert.equal(sent,beforeAbsent);
  const uncommitted=await alerts.queueAdminAlert({kind:"project",reference:"rfp_absent",revision:"revision_absent",format:"RFI"});
  await alerts.deliverAdminAlert(uncommitted);assert.equal(sent,beforeAbsent);
  // An already-resolved approval does not need a stale alert.
  await kv.kvSetJson("vendor:claim:absent",{slug:"absent",requested:1,status:"approved"});
  await alerts.deliverAdminAlert(absent);assert.equal(record(absent).status,"cancelled");
  mode="timeout";
  const third=await kv.requestVendorClaim("aryaka","qa@aryaka.com","aryaka.com");
  const thirdId=alerts.adminAlertId({kind:"supplier",reference:"aryaka",requested:third.requested});
  await kv.kvSetJson(`admin-alerts:record:${thirdId}`,{...record(thirdId),first_attempt:Date.now()-24*3600000,next_attempt:0});
  const beforeExpired=sent;await alerts.deliverAdminAlert(thirdId);assert.equal(sent,beforeExpired);assert.equal(record(thirdId).status,"needs_review");
  assert.equal((await alerts.adminAlertSummary()).needs_review,1);
  mode="accept";
  assert.equal(await alerts.sendAdminTestAlert(),"accepted");
  const beforeTestRepeat=sent;
  assert.equal(await alerts.sendAdminTestAlert(),"accepted");assert.equal(sent,beforeTestRepeat);
  assert.equal(JSON.parse(bodies.at(-1)!).to,"support@netify.com");
  assert.match(JSON.parse(bodies.at(-1)!).subject,/test/);
  delete process.env.RESEND_API_KEY;
  const noKey=await kv.requestVendorClaim("cato","qa@catonetworks.com","catonetworks.com");
  const noKeyId=alerts.adminAlertId({kind:"supplier",reference:"cato",requested:noKey.requested});
  assert.equal(record(noKeyId).status,"pending");assert.equal(record(noKeyId).attempts,0);
  global.fetch=originalFetch;
  console.log("PASS support alerts: durable hooks, source-commit gating, Resend rejection/timeout/receipt retry, stable idempotency, duplicate suppression, cron auth, missing key and stale-approval cancellation");
});
