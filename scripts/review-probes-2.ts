// @ts-expect-error Node provides registerHooks.
import { registerHooks } from "node:module";
registerHooks({ resolve(s: string, c: object, n: (s: string, c: object) => { url: string }) { return s === "server-only" ? { url: "data:text/javascript,export {};", shortCircuit: true } : n(s, c); } });
import { randomUUID } from "node:crypto";
import { withFakeKv, makeRequest } from "./fake-kv-harness";
await withFakeKv(async (store) => {
  process.env.VERCEL_ENV = "production"; process.env.RESEND_API_KEY = "k"; process.env.SOURCING_DESK_EMAIL = "desk@example.org";
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "review-secret-review-secret-review-secret";
  delete process.env.PROVIDER_MATCH_DATA_URL; delete process.env.PROVIDER_MATCH_SERVICE_TOKEN;
  const realFetch = global.fetch; const mails: any[] = []; let hang = false;
  global.fetch = async (input: any, init?: any) => { const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url; if (url === "https://api.resend.com/emails") { if (hang) throw new TypeError("fetch failed: socket hang up"); mails.push(JSON.parse(String(init?.body))); return Response.json({ id: "m" }); } return realFetch(input, init); };
  const requestRoute = await import("../src/app/api/sourcing/request/route");
  const confirmRoute = await import("../src/app/api/sourcing/confirm/route");
  const mk = (email: string) => ({ brief: { sites: 10, remote_users: 50, region: "uk_ireland", sector: "manufacturing", need: "sdwan", when: "Within 3 months", requirement: "PRIVATE", supplier_brief: "Anonymous ten-site requirement" }, recipients: [{ slug: "cisco", actions: ["demo"] }], email, consent: true, anonymous: true, idempotency_key: randomUUID() });
  // PROBE G: confirmed sourcing buyer tries to sign in from another device via the buyer-account route
  const body = mk("buyer@example.org");
  const r1 = await requestRoute.POST(makeRequest("POST", "https://x.example/sase/api/sourcing/request/", { body }));
  const receipt = await r1.json(); const link = mails[0].text.match(/#request=([^&]+)&token=([^\s]+)/)!; const id = link[1], token = link[2];
  const c = await confirmRoute.POST(makeRequest("POST", "https://x.example/sase/api/sourcing/confirm/", { body: { id, token, confirm: true } }));
  const rec = JSON.parse((store as any).str(`sourcing:request:${id}`)); console.log("PROBE G confirm:", c.status, "project:", rec.project_id, "cookie issued:", Boolean(c.headers.get("set-cookie")));
  const buyerMailText: string = mails.find((m) => m.subject === "Netify has your request")?.text ?? ""; console.log("PROBE G buyer mail tells them:", JSON.stringify(buyerMailText.split("\n").slice(-1)[0]));
  const authRequest = await import("../src/app/api/auth/request/route");
  const signin = await authRequest.POST(makeRequest("POST", "https://x.example/sase/api/auth/request", { body: { email: "buyer@example.org", role: "buyer", return_to: `/sase/rfp-builder/${rec.project_id}/`, bot_proof: { challenge: "", website: "" } } }));
  const sd = await signin.json(); console.log("PROBE G sign-in for confirmed sourcing buyer (no cookie):", signin.status, JSON.stringify(sd));
  // Same, but bypass the bot-proof to isolate the publication gate
  const { issueAuthChallenge } = await import("../src/lib/auth-challenge").catch(() => ({ issueAuthChallenge: null as any }));
  if (issueAuthChallenge) { const ch = issueAuthChallenge(); await new Promise((r) => setTimeout(r, 2600)); const s2 = await authRequest.POST(makeRequest("POST", "https://x.example/sase/api/auth/request", { body: { email: "buyer@example.org", role: "buyer", return_to: `/sase/rfp-builder/${rec.project_id}/`, bot_proof: { challenge: typeof ch === "string" ? ch : ch?.challenge ?? "", website: "" } } })); console.log("PROBE G sign-in with valid bot proof:", s2.status, JSON.stringify(await s2.json())); }
  // PROBE H: confirmation mail transport throws (hang / reset) then recovers; same client request key
  hang = true; const b2 = mk("interrupted@example.org");
  const h1 = await requestRoute.POST(makeRequest("POST", "https://x.example/sase/api/sourcing/request/", { body: b2 }));
  console.log("PROBE H first attempt during transport failure:", h1.status, JSON.stringify(await h1.json()));
  hang = false; const before = mails.length;
  const h2 = await requestRoute.POST(makeRequest("POST", "https://x.example/sase/api/sourcing/request/", { body: b2 }));
  console.log("PROBE H retry after transport recovered:", h2.status, JSON.stringify(await h2.json()), "| emails actually sent to buyer on retry:", mails.length - before);
  console.log("PROBE H idempotency lock present:", (store as any).store.has(`sourcing:idem:` + [...(store as any).store.keys()].find((k: string) => k.startsWith("sourcing:idem:"))?.slice(14)), "| lock TTL in code: 86400s (sourcing-store.ts:113)");
});
