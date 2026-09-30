// @ts-expect-error Node provides registerHooks.
import { registerHooks } from "node:module";
registerHooks({ resolve(s: string, c: object, n: (s: string, c: object) => { url: string }) { return s === "server-only" ? { url: "data:text/javascript,export {};", shortCircuit: true } : n(s, c); } });
import { randomUUID } from "node:crypto";
import { withFakeKv, makeRequest, FAKE_KV_URL } from "./fake-kv-harness";
await withFakeKv(async (store) => {
  process.env.VERCEL_ENV = "production"; process.env.RESEND_API_KEY = "k"; process.env.SOURCING_DESK_EMAIL = "desk@example.org";
  delete process.env.PROVIDER_MATCH_DATA_URL; delete process.env.PROVIDER_MATCH_SERVICE_TOKEN;
  const realFetch = global.fetch; const mails: any[] = [];
  global.fetch = async (input: any, init?: any) => { const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url; if (url === "https://api.resend.com/emails") { mails.push(JSON.parse(String(init?.body))); return Response.json({ id: "m" }); } return realFetch(input, init); };
  const requestRoute = await import("../src/app/api/sourcing/request/route");
  const confirmRoute = await import("../src/app/api/sourcing/confirm/route");
  const body = { brief: { sites: 10, remote_users: 50, region: "uk_ireland", sector: "manufacturing", need: "sdwan", when: "Within 3 months", requirement: "PRIVATE", supplier_brief: "Anonymous ten-site requirement" }, recipients: [{ slug: "cisco", actions: ["demo"] }], email: "buyer@example.org", consent: true, anonymous: true, idempotency_key: randomUUID() };
  const r1 = await requestRoute.POST(makeRequest("POST", "https://x.example/sase/api/sourcing/request/", { body }));
  const receipt = await r1.json(); const link = mails[0].text.match(/#request=([^&]+)&token=([^\s]+)/); const id = link[1], token = link[2];
  // PROBE A: concurrent confirmations (two tabs / double submit)
  const confirm = () => confirmRoute.POST(makeRequest("POST", "https://x.example/sase/api/sourcing/confirm/", { body: { id, token, confirm: true } }));
  const [a, b] = await Promise.all([confirm(), confirm()]);
  console.log("PROBE A concurrent confirm statuses:", a.status, b.status, "| second body:", JSON.stringify(await (a.status === 200 ? b : a).json()));
  // PROBE B: reopen the link after the one-hour token expiry, post-confirmation
  const key = `sourcing:request:${id}`; const rec = JSON.parse((store as any).str(key)); console.log("status after confirm:", rec.status);
  rec.expires_at = Date.now() - 1000; (store as any).command(["SET", key, JSON.stringify(rec)]);
  const reopen = await confirmRoute.POST(makeRequest("POST", "https://x.example/sase/api/sourcing/confirm/", { body: { id, token, confirm: false } }));
  console.log("PROBE B reopen after expiry (confirmed request):", reopen.status, JSON.stringify(await reopen.json()), "| set-cookie:", reopen.headers.get("set-cookie") ? "yes" : "none");
  // PROBE C: desk queue still lists it; buyer has no cookie route now
  console.log("PROBE C desk queue members:", (store as any).command(["ZRANGE", "sourcing:desk-review", 0, -1]));
});
// PROBE D: review_due expiry removes sector overrides silently
const { applyProjectionReview, REVIEWED_PROVIDER_PROJECTIONS } = await import("../src/lib/provider-projection-review");
const { getLiveShortlistDataset } = await import("../src/lib/live-shortlist");
const live = await getLiveShortlistDataset();
const cisco = live.vendors.find((v) => v.slug === "cisco")!;
console.log("PROBE D now:", cisco.sectors.manufacturing, cisco.projection_provenance?.resolution, "review_due:", REVIEWED_PROVIDER_PROJECTIONS["cisco"]?.review_due);
const copy = JSON.parse(JSON.stringify(cisco)); copy.sectors.manufacturing = "unknown"; const original = JSON.parse(JSON.stringify(copy));
applyProjectionReview(copy, { revision_id: "r", reviewed_at: "2026-09-01T00:00:00Z", sectors: {} } as any, original, undefined, Date.parse("2026-10-30T00:00:01Z"));
console.log("PROBE D at 2026-10-30T00:00:01Z:", copy.sectors.manufacturing, copy.projection_provenance?.resolution);
// PROBE E: match counts per sector x need on the current dataset (UK & Ireland)
const { publicShortlistPreview } = await import("../src/lib/public-shortlist");
const { SECTOR_KEYS } = await import("../src/lib/shortlist-core");
const needs: Record<string, string[]> = { sdwan: ["f09_encrypted_overlay_fabric"], sase: ["f28_full_sase_platform"], secure_access: ["f30_zero_trust_network_access"], help_deciding: [] };
console.log("PROBE E dataset source:", live.source, "| vendors:", live.vendors.length);
const header = ["sector", ...Object.keys(needs), "sase+UKonly"].join(" | "); console.log(header);
for (const sector of [null, ...SECTOR_KEYS]) {
  const row = [sector ?? "(none)"];
  for (const [need, feats] of Object.entries(needs)) row.push(String(publicShortlistPreview(live.vendors, { sector, required_regions: ["uk_ireland"], required_features: feats }).matches.length));
  row.push(String(publicShortlistPreview(live.vendors, { sector, required_regions: ["uk_ireland"], uk_provider_only: true, required_features: needs.sase }).matches.length));
  console.log(row.join(" | "));
}
// PROBE F: which vendors match manufacturing + sdwan today
console.log("PROBE F manufacturing/sdwan matches:", publicShortlistPreview(live.vendors, { sector: "manufacturing", required_regions: ["uk_ireland"], required_features: needs.sdwan }).matches.map((m: any) => m.name).join(", "));
console.log("PROBE F manufacturing/sase matches:", publicShortlistPreview(live.vendors, { sector: "manufacturing", required_regions: ["uk_ireland"], required_features: needs.sase }).matches.map((m: any) => m.name).join(", "));
