/**
 * Rendered-HTML and redirect checks for the canonical RFP Builder page
 * (3 Sep 2026). Runs against a started server, local or production:
 *
 *   BASE=http://localhost:3000 PAGE=/sase/home/ tsx scripts/test-rfp-canonical-live.ts
 *   BASE=https://netify.co.uk PAGE=/sase-sd-wan-rfp-builder/ tsx scripts/test-rfp-canonical-live.ts
 *
 * Locally the page is /sase/home/ (the apex rewrite is what exposes it at
 * /sase-sd-wan-rfp-builder/). Redirects are checked with redirect:"manual"
 * so every hop is visible; the subdomain rules are exercised locally by
 * sending a Host header, which is how Next's `has: host` matches.
 *
 * What it asserts:
 *  - the page serves 200 to a browser, to Googlebot and to Bingbot with the
 *    same title, H1, canonical and schema (no cloaking, no bot variant);
 *  - exactly one <h1>, the ruled title and meta description, the canonical;
 *  - required phrases present in the HTML without any client interaction;
 *  - the captioned table with scoped headers, five FAQ questions, FAQPage,
 *    BreadcrumbList and WebPage (dateModified) JSON-LD parse;
 *  - no private project data or tokens in the public HTML;
 *  - legacy entries redirect to the canonical in one hop.
 */

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const PAGE = process.env.PAGE ?? "/sase/home/";
const CANON = "https://netify.co.uk/sase-sd-wan-rfp-builder/";
const LOCAL = BASE.startsWith("http://localhost");

const UAS = {
  browser: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36",
};

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string, detail?: unknown) {
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(detail === undefined ? msg : `${msg} (${JSON.stringify(detail)})`);
  }
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
}

function ld(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      if (Array.isArray(j)) out.push(...j);
      else out.push(j);
    } catch {
      out.push({ "@type": "PARSE_ERROR" });
    }
  }
  return out;
}

/** fetch() silently drops a Host header override, so host-scoped redirect
 *  rules (Next `has: [{ type: "host" }]`) are exercised through node:http,
 *  which sends exactly the headers given. Returns a fetch-like shape. */
async function get(url: string, ua: string, host?: string): Promise<{ status: number; headers: { get(n: string): string | null }; text(): Promise<string> }> {
  if (!host) return fetch(url, { headers: { "user-agent": ua }, redirect: "manual" });
  const u = new URL(url);
  const mod = u.protocol === "https:" ? await import("node:https") : await import("node:http");
  return new Promise((resolve, reject) => {
    const req = mod.request(
      { method: "GET", hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), path: u.pathname + u.search, headers: { "user-agent": ua, host } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: { get: (n: string) => (res.headers[n.toLowerCase()] as string | undefined) ?? null },
            text: async () => Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const pages: Record<string, string> = {};
  for (const [name, ua] of Object.entries(UAS)) {
    const res = await get(`${BASE}${PAGE}`, ua);
    expect(res.status === 200, `${name}: page serves 200`, res.status);
    pages[name] = await res.text();
  }
  const html = pages.browser;

  /* Same content for bots and browsers */
  const sig = (h: string) => ({
    title: h.match(/<title>([^<]*)<\/title>/)?.[1],
    h1: (h.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g) ?? []).map((x) => x.replace(/<[^>]+>/g, "").trim()),
    canonical: h.match(/rel="canonical" href="([^"]+)"/)?.[1],
    ldTypes: ld(h).map((x) => x["@type"]).sort(),
    hasTable: /<table\b[\s\S]*?<caption\b/.test(h),
  });
  const b = sig(pages.browser);
  for (const bot of ["googlebot", "bingbot"]) {
    expect(JSON.stringify(sig(pages[bot])) === JSON.stringify(b), `${bot} receives the same title, H1, canonical, schema and table as a browser`);
  }

  /* Head */
  expect(b.title === "SD-WAN and SASE RFP Builder, Template and Vendor Evaluation | Netify", "title is the ruled wording", b.title);
  expect(b.h1.length === 1, "exactly one h1", b.h1);
  expect(b.h1[0] === "Build an SD-WAN or SASE RFP and compare vendor responses", "h1 is the ruled wording", b.h1);
  expect(b.canonical === CANON, "canonical is the apex builder URL", b.canonical);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  expect(desc.length > 0 && desc.length <= 160, "meta description present and 160 characters or fewer", desc.length);
  expect(/SD-WAN RFP/.test(desc) && /SASE RFP/.test(desc), "meta description names both head terms");
  expect(/<meta name="robots" content="index, follow"/.test(html) || /name="robots" content="index,follow"/.test(html), "robots index, follow");

  /* Static content present without interaction */
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const phrase of [
    "An SD-WAN RFP is a request for proposal",
    "A SASE RFP is a request for proposal",
    "What an SD-WAN or SASE RFP covers",
    "Organisation and scale",
    "Pricing and contract terms",
    "Supplier evidence",
    "What should an SD-WAN RFP include?",
    "What should a SASE RFP include?",
    "What is the difference between an RFI and an RFP?",
    "How should SD-WAN and SASE vendors be evaluated?",
    "Is the Netify RFP Builder free?",
    "SD-WAN and SASE question bank",
    "SASE sample RFP",
    "SD-WAN sample RFP",
  ]) {
    expect(text.includes(phrase), `server HTML carries "${phrase}"`);
  }
  expect((text.match(/SASE RFP/g) ?? []).length >= 3 && (text.match(/SD-WAN RFP/g) ?? []).length >= 3, "both exact head terms appear at least three times in the text");
  expect(/<table\b[^>]*>[\s\S]*?<caption\b/.test(html), "table has a caption");
  expect(/<th scope="col"/.test(html) && (html.match(/<th scope="row"/g) ?? []).length === 8, "table has scoped column headers and eight row headers");
  expect((html.match(/<details\b/g) ?? []).length >= 5, "at least five <details> FAQ items are in the served HTML");
  expect(/<time dateTime="\d{4}-\d{2}-\d{2}">/.test(html), "visible review date carries a machine-readable dateTime");
  expect(html.includes('href="https://netify.co.uk/sase/rfp-builder/questions/"'), "links the question bank");
  expect(html.includes('href="https://netify.co.uk/sase/rfp-builder/sample-rfp/"') && html.includes('href="https://netify.co.uk/sd-wan/sample-rfp/"'), "links both sample RFPs");

  /* Schema */
  const schemas = ld(html);
  const types = schemas.map((s) => s["@type"]);
  expect(!types.includes("PARSE_ERROR"), "every JSON-LD block parses", types);
  const faq = schemas.find((s) => s["@type"] === "FAQPage") as { mainEntity?: { name: string; acceptedAnswer?: { text?: string } }[] } | undefined;
  expect(!!faq && (faq.mainEntity?.length ?? 0) === 5, "FAQPage with five questions");
  expect(!!faq && faq.mainEntity!.every((q) => typeof q.name === "string" && typeof q.acceptedAnswer?.text === "string" && q.acceptedAnswer.text.length > 40), "every FAQ has a name and an answer");
  expect(schemas.filter((s) => s["@type"] === "FAQPage").length === 1, "exactly one FAQPage on the page");
  const bc = schemas.find((s) => s["@type"] === "BreadcrumbList") as { itemListElement?: { item: string; position: number }[] } | undefined;
  expect(!!bc && bc.itemListElement?.length === 2 && bc.itemListElement[1].item === CANON, "BreadcrumbList ends at the canonical");
  const wp = schemas.find((s) => s["@type"] === "WebPage") as { dateModified?: string } | undefined;
  expect(!!wp && /^\d{4}-\d{2}-\d{2}$/.test(wp.dateModified ?? ""), "WebPage dateModified present");
  for (const t of ["WebApplication", "HowTo", "Organization", "TechArticle"]) expect(types.includes(t), `${t} schema still present`);

  /* No private data in public HTML */
  for (const needle of ["manage_token", "share_token", "KV_REST_API", "ANTHROPIC_API_KEY", "@gmail.com"]) {
    expect(!html.includes(needle), `no "${needle}" in the public HTML`);
  }
  expect(!/rfp_[a-z0-9]{8,}/.test(html.replace(/rfp_sample/g, "")), "no live project ids in the public HTML");

  /* The workflow entry is intact */
  expect(/List a project/.test(text) && /Build an RFP/.test(text) && /Check an existing RFP/.test(text), "the four entry routes are still rendered");
  // The living desk itself (prompt, sections, publish controls) mounts on
  // the client, as it always has; its server HTML is the entry routes above.
  // scripts/validate-rfp-canonical-journey.mjs drives the real browser
  // journey (type a requirement, project starts) against the same server.

  /* Redirects, one hop */
  const hops: [string, string | undefined, string][] = LOCAL
    ? [
        [`${BASE}/sase/rfp-builder`, undefined, CANON],
        [`${BASE}/sase/rfp-builder/`, undefined, CANON],
        [`${BASE}/rfp-builder`, "sase.netify.co.uk", CANON],
        [`${BASE}/rfp-builder/`, "sase.netify.co.uk", CANON],
      ]
    : [
        [`${BASE}/sase/rfp-builder`, undefined, CANON],
        [`${BASE}/sase/rfp-builder/`, undefined, CANON],
        ["https://sase.netify.co.uk/rfp-builder", undefined, CANON],
        ["https://sase.netify.co.uk/rfp-builder/", undefined, CANON],
        [`${BASE}/sd-wan-rfp-builder-app/`, undefined, CANON],
        [`${BASE}/sase-rfp-builder-app/`, undefined, CANON],
        [`${BASE}/rfp-builder/`, undefined, CANON],
        ["https://www.netify.co.uk/sd-wan-rfp-builder-app/", undefined, CANON],
        ["https://www.netify.co.uk/sase-rfp-builder-app/", undefined, CANON],
        ["https://www.netify.co.uk/rfp-builder/", undefined, CANON],
      ];
  for (const [url, host, dest] of hops) {
    const res = await get(url, UAS.googlebot, host);
    const loc = res.headers.get("location") ?? "";
    expect([301, 308].includes(res.status) && loc === dest, `${host ? `${host}${new URL(url).pathname}` : url} -> ${dest} in one hop`, { status: res.status, loc });
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(` - ${f}`));
    process.exit(1);
  }
  console.log("\nALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
