// Tests for the one-way workbook importer and the committed research dataset.
// Run: npx tsx scripts/test-research-import.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildResearchDataset, slugFor, WORKBOOK_SLUGS, PUBLIC_NAMES } from "./lib/research-import.mjs";
import { shortlistEntity } from "../src/lib/shortlist-entity";
import { getShortlistDataset } from "../src/lib/vendors";

const PLACEHOLDER = "No information readily available online";
const FORBIDDEN = [/support@netify\.com/i, /07590\s?212\s?100/, /harry/i, /yelland/i, /SRC-CRM-/, /CRM (label|export|quote)/i, /crm-all-facts/i, /ams-dev\d/i, /no information readily available/i, /Passage matched on keywords/i, /Marketing audience wording/i];

// 1. Transform behaviour on a fixture
const fixture = {
  a: {
    Providers: [
      { "Provider ID": "bt", "Existing provider roles": "managed_service_provider; carrier_network_provider", "Netify test email": "support@netify.com", "Netify test telephone": "07590212100", "Research owner": "Harry Yelland" },
      { "Provider ID": "fortinet-fortisase", "Existing provider roles": "technology_vendor" },
    ],
    Sources: [
      { "Source ID": "SRC-CRM-bt-001", "Provider ID": "bt", "Source type": "Provider web page", "Document / record title": "https://business.bt.com/x", "Publisher / organisation": "BT", "URL or secure document reference": "https://business.bt.com/x", "Exact passage or recorded observation": "SD-WAN in 180 countries", "Accessed date": new Date("2026-11-17T00:00:00Z"), "Source relationship": "Primary record", "Snapshot / retained record": "CRM export crm-all-facts-and-sources-2026-11-20.xlsx", "Product / version / geography scope": "CRM label: BT" },
      { "Source ID": "SRC-CRM-fortinet-fortisase-002", "Provider ID": "fortinet-fortisase", "Source type": "Third-party publication", "URL or secure document reference": "https://example.org/review", "Accessed date": "2026-11-18", "Source relationship": "Independent corroboration" },
      { "Source ID": "SRC-CRM-bt-003", "Provider ID": "bt", "Source type": "Provider web page", "URL or secure document reference": "https://ams-dev3.example.com/x", "Accessed date": "2026-11-18", "Source relationship": "Primary record" },
    ],
    Findings: [
      { "Finding ID": "F-bt-RF-001", "Provider ID": "bt", Theme: "Commercial eligibility", "Field ID": "RF-001", "Research question": "Q1", "Work status": "Evidence captured", "Finding outcome": "Offered", "Answer and conditions": "Corporate sector", "Primary source ID": "SRC-CRM-bt-001", Researcher: "Harry Yelland", "Scope or conflict notes": "Marketing audience wording; not an eligibility rule." },
      { "Finding ID": "F-bt-RF-002", "Provider ID": "bt", Theme: "Commercial eligibility", "Field ID": "RF-002", "Research question": "Q2", "Work status": "To research", "Answer and conditions": PLACEHOLDER },
      { "Finding ID": "F-fortinet-fortisase-RF-001", "Provider ID": "fortinet-fortisase", Theme: "Commercial eligibility", "Field ID": "RF-001", "Research question": "Q1", "Work status": "Evidence captured", "Answer and conditions": "Enterprise", "Primary source ID": "SRC-CRM-fortinet-fortisase-002" },
    ],
    Cases: [
      { "Case research ID": "CR-bt-01", "Provider ID": "bt", Sector: "Retail", "Customer / secure reference": "UK fashion retailer", "Work status": "Evidence captured", "Supplier source ID": "SRC-CRM-bt-001" },
      { "Case research ID": "CR-bt-02", "Provider ID": "bt", Sector: "Education", "Customer / secure reference": PLACEHOLDER, "Work status": "To research" },
    ],
    "Product scopes": [{ "Product record ID": "PR-bt-01", "Provider ID": "bt", "Product and edition": "BT SD-WAN", "Source ID": "SRC-CRM-bt-001" }],
    "Site delivery": [{ "Delivery ID": "SD-bt-001", "Provider ID": "bt", Country: "United Kingdom", "Location type": "Country service", "Service at this location": "Operates in this country", "Source ID": "SRC-CRM-bt-001" }],
  },
  b: {
    Sources: [
      { "Source ID": "PS-1", "Publisher / seller": "BT", "URL / secure document ref": "https://business.bt.com/prices", "Source type": "Official pricing page", "Observed date": "2026-11-20", "Short passage / precise paraphrase": "£39.95 installation" },
      { "Source ID": "PS-2", "Publisher / seller": "Lumen", "URL / secure document ref": "https://ams-dev3.lumen.com/x", "Source type": "Official pricing page", "Observed date": "2026-11-17" },
      { "Source ID": "PS-3", "Publisher / seller": "costbench.com", "URL / secure document ref": "https://costbench.com/sase", "Source type": "Secondary discovery lead", "Short passage / precise paraphrase": "$12 per user", "Product / region applicability": "Discovery lead only; CRM label Fortinet FortiSASE" },
    ],
    Offers: [
      { "Offer ID": "OF-bt-01", "Provider ID": "bt", "Exact product / edition": "BT Business Broadband", "Primary source ID": "PS-1", "Commercial evidence route": "Published numeric tariff" },
      { "Offer ID": "OF-lumen-01", "Provider ID": "lumen", "Exact product / edition": "Lumen SASE", "Primary source ID": "PS-2" },
    ],
    "Price lines": [
      { "Price line ID": "PL-bt-01-01", "Offer ID": "OF-bt-01", Component: "Installation", "Original amount": 39.95, "Currency ISO code": "GBP", "Source ID": "PS-1" },
      { "Price line ID": "PL-lumen-01-01", "Offer ID": "OF-lumen-01", "Original amount": 140, "Currency ISO code": "USD", "Source ID": "PS-2" },
    ],
    "Price rules": [],
  },
};

const out = buildResearchDataset(fixture, { generatedAt: "2026-11-20" });
assert.deepEqual(out.providers.map((p: { slug: string }) => p.slug), ["bt-business", "fortinet"], "workbook IDs map to public slugs");
assert.equal(out.findings.length, 2, "only evidenced findings are published");
assert.equal(out.cases.length, 1, "placeholder cases are excluded");
assert.equal(out.sources.length, 2, "dev-host sources are excluded");
assert.equal(out.sources[0].id, "SRC-bt-001", "export prefix stripped from public IDs");
assert.equal(out.sources[0].title, null, "a title that is just the URL is dropped");
assert.equal(out.sources[1].claim, "third_party", "third-party sources are labelled");
assert.equal(out.findings[1].claim, "third_party");
assert.equal(out.price_lines.length, 1, "dev-host price lines are excluded");
assert.equal(out.price_lines[0].label, "List or published price, not a quote");
assert.equal(out.price_lines[0].non_uk, false);
assert.equal(out.offers.length, 1, "offers sourced from a dev host are excluded");
assert.equal(out.further_reading.length, 1, "discovery leads become further reading");
assert.equal(out.further_reading[0].slug, "fortinet");
assert.equal("passage" in out.further_reading[0], false, "discovery leads never carry amounts or passages");
assert.match(out.dataset_version, /^netify-research\/2026-11-20\+sha256-[0-9a-f]{16}$/);
assert.equal(buildResearchDataset(fixture).dataset_version, out.dataset_version, "dataset version is deterministic");
const fixtureText = JSON.stringify(out);
for (const re of FORBIDDEN) assert.doesNotMatch(fixtureText, re, `fixture output leaks ${re}`);
assert.throws(() => slugFor("not-a-provider"), /Unmapped workbook provider ID/);
assert.equal(Object.keys(WORKBOOK_SLUGS).length, 30);
for (const slug of Object.values(WORKBOOK_SLUGS) as string[]) assert.ok((PUBLIC_NAMES as Record<string, string>)[slug], `public name for ${slug}`);

// 2. Committed dataset invariants
const raw = readFileSync("data/research/workbook-research.json", "utf8");
const data = JSON.parse(raw);
for (const re of FORBIDDEN) assert.doesNotMatch(raw, re, `committed dataset leaks ${re}`);
assert.equal(data.providers.length, 30);
const published = new Set(getShortlistDataset().map((v) => v.slug));
for (const p of data.providers) assert.ok(published.has(p.slug), `research slug ${p.slug} is a published shortlist slug`);
const sourceIds = new Set(data.sources.map((s: { id: string }) => s.id));
for (const f of data.findings) assert.ok(sourceIds.has(f.source_id), `finding ${f.id} has a source`);
for (const c of data.cases) assert.ok(sourceIds.has(c.source_id), `case ${c.id} has a source`);
for (const s of data.sources) assert.ok(/^https?:\/\//.test(s.url), `source ${s.id} has a URL`);
const pricingIds = new Set(data.pricing_sources.map((s: { id: string }) => s.id));
for (const l of data.price_lines) {
  assert.ok(pricingIds.has(l.source_id), `price line ${l.id} has a source`);
  assert.equal(l.label, "List or published price, not a quote");
  if (l.amount !== null) assert.ok(l.currency, `price line ${l.id} has a currency`);
  assert.equal(l.non_uk, l.currency !== "GBP");
}
for (const f of data.further_reading) assert.equal(f.passage, undefined, "further reading carries no price text");
assert.ok(data.findings.every((f: { answer: string }) => f.answer && !/no information readily/i.test(f.answer)));

// 3. Carrier count comes from provider roles, UK entity status is separate
const entity = shortlistEntity(getShortlistDataset());
assert.ok(entity.counts.carriers >= 10, `carriers counted from roles (got ${entity.counts.carriers})`);
assert.doesNotMatch(entity.count_sentence, /\b0 (UK )?carriers/, "no zero-carrier sentence");
assert.match(entity.count_sentence, new RegExp(`${entity.counts.carriers} carriers or network providers`));
assert.match(entity.uk_sentence, /carriers have a reviewed UK entity/);

console.log(`PASS research import: ${data.findings.length} findings, ${data.sources.length} sources, ${data.cases.length} cases, ${data.price_lines.length} price lines; ${entity.counts.carriers} carriers`);
