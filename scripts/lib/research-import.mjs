// Pure transform for the Netify research and pricing workbooks.
// Input: { a: { [sheetName]: rowObject[] }, b: { [sheetName]: rowObject[] } }
// where each row object is keyed by the header text on row 8 of the sheet.
// Output: the public, versioned research dataset served by the site.
//
// One-way: the workbook is the research source; this file decides what is
// publishable. Excluded by rule (not research):
//   - "No information readily available online" placeholders (and the other
//     prohibited gap phrases listed in the workbook's own rules)
//   - test contact details, the researcher's name, internal CRM and scope
//     notes, export references, verification bookkeeping
//   - price lines and offers sourced from a development host (ams-dev3)
//   - pricing "discovery lead" sources as prices (kept as further reading
//     with no amounts or passages)
import { createHash } from "node:crypto";

export const RESEARCH_CONTRACT_VERSION = "netify-workbook-research/1.0.0";

/** Workbook provider IDs -> public comparison slugs used across the site. */
export const WORKBOOK_SLUGS = {
  aryaka: "aryaka", att: "att-business", "barracuda-secureedge": "barracuda-secureedge", bt: "bt-business",
  "cato-networks": "cato-networks", checkpoint: "check-point", cisco: "cisco", "cloudflare-one": "cloudflare-one",
  colt: "colt-technology-services", comcastbusiness: "comcast-business", "ericsson-cradlepoint": "cradlepoint-ericsson",
  expereo: "expereo", forcepoint: "forcepoint", "fortinet-fortisase": "fortinet", gtt: "gtt",
  "hpe-aruba-edgeconnect": "hpe-aruba", juniper: "juniper-networks", lumen: "lumen", netskope: "netskope",
  "ntt-data": "ntt", opensystems: "opensystems", orangebusiness: "orange-business",
  "palo-alto-prisma-sase": "palo-alto-networks", "sonicwall-cse": "sonicwall", velocloud: "arista-velocloud",
  verizon: "verizon-business", "versa-networks": "versa-networks", "virgin-media-o2": "virgin-media-o2",
  vodafone: "vodafone-business", zscaler: "zscaler",
};

export const PUBLIC_NAMES = {
  aryaka: "Aryaka", "att-business": "AT&T Business", "barracuda-secureedge": "Barracuda SecureEdge", "bt-business": "BT",
  "cato-networks": "Cato Networks", "check-point": "Check Point", cisco: "Cisco", "cloudflare-one": "Cloudflare One",
  "colt-technology-services": "Colt Technology Services", "comcast-business": "Comcast Business",
  "cradlepoint-ericsson": "Ericsson Cradlepoint", expereo: "Expereo", forcepoint: "Forcepoint", fortinet: "Fortinet FortiSASE",
  gtt: "GTT", "hpe-aruba": "HPE Aruba EdgeConnect", "juniper-networks": "Juniper Networks", lumen: "Lumen", netskope: "Netskope",
  ntt: "NTT DATA", opensystems: "Open Systems", "orange-business": "Orange Business", "palo-alto-networks": "Palo Alto Networks Prisma SASE",
  sonicwall: "SonicWall Cloud Secure Edge", "arista-velocloud": "VeloCloud", "verizon-business": "Verizon Business",
  "versa-networks": "Versa Networks", "virgin-media-o2": "Virgin Media O2 Business", "vodafone-business": "Vodafone Business", zscaler: "Zscaler",
};

export const SECTOR_SLUGS = {
  "Financial services": "financial-services", "Government & councils": "government", Retail: "retail", Healthcare: "healthcare",
  Manufacturing: "manufacturing", "Energy & utilities": "energy-and-utilities", Education: "education",
  "Transport & logistics": "transport-and-logistics", "Professional services": "professional-services", "Hospitality & leisure": "hospitality",
};

const PROHIBITED = /^(?:no information readily available online|unknown|cannot find|not found|not known|not published|tbc|tbd|n\/a|no information|unclear)\.?$/i;
const PLACEHOLDER_ANYWHERE = /no information readily available online/i;

export function text(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return text(value.result);
    if ("richText" in value) return text(value.richText.map((r) => r.text).join(""));
    if ("text" in value) return text(value.text);
    if ("hyperlink" in value) return text(value.hyperlink);
    return null;
  }
  const s = String(value).replace(/\s+/g, " ").trim();
  if (!s || PROHIBITED.test(s) || PLACEHOLDER_ANYWHERE.test(s)) return null;
  return s;
}

export function num(value) {
  const s = text(value);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = text(value);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Public record IDs never carry the internal export prefix. */
export function publicId(id) {
  const s = text(id);
  return s ? s.replace(/^SRC-CRM-/, "SRC-") : null;
}

export function slugFor(workbookId) {
  const slug = WORKBOOK_SLUGS[text(workbookId) ?? ""];
  if (!slug) throw new Error(`Unmapped workbook provider ID: ${workbookId}`);
  return slug;
}

const DEV_HOST = /(^|\.)ams-dev\d*\.|\/\/ams-dev\d*\./i;
export function isDevHost(url) {
  return DEV_HOST.test(String(url ?? ""));
}

function claimFor(relationship, sourceType) {
  if (/independent|third/i.test(`${relationship} ${sourceType}`)) return "third_party";
  if (/baseline|netify/i.test(`${relationship} ${sourceType}`)) return "netify_compilation";
  return "provider_published";
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

export function buildResearchDataset({ a, b }, { generatedAt } = {}) {
  const providersRows = a["Providers"] ?? [];
  const providers = providersRows.map((r) => {
    const slug = slugFor(r["Provider ID"]);
    return {
      slug,
      workbook_id: text(r["Provider ID"]),
      name: PUBLIC_NAMES[slug],
      roles: (text(r["Existing provider roles"]) ?? "").split(/;\s*/).filter(Boolean),
    };
  });

  // Sources (research workbook)
  const sources = [];
  const sourceIndex = new Map();
  for (const r of a["Sources"] ?? []) {
    const id = publicId(r["Source ID"]);
    const url = text(r["URL or secure document reference"]);
    if (!id || !url || isDevHost(url)) continue;
    const title = text(r["Document / record title"]);
    const rec = {
      id,
      slug: slugFor(r["Provider ID"]),
      source_type: text(r["Source type"]),
      title: title && title !== url ? title : null,
      publisher: text(r["Publisher / organisation"]),
      url,
      passage: text(r["Exact passage or recorded observation"]),
      published_date: isoDate(r["Publication / observation date"]),
      accessed_date: isoDate(r["Accessed date"]),
      claim: claimFor(text(r["Source relationship"]), text(r["Source type"])),
    };
    sources.push(rec);
    sourceIndex.set(id, rec);
  }

  const findings = [];
  for (const r of a["Findings"] ?? []) {
    if (text(r["Work status"]) !== "Evidence captured") continue;
    const answer = text(r["Answer and conditions"]);
    const sourceId = publicId(r["Primary source ID"]);
    const source = sourceId ? sourceIndex.get(sourceId) : undefined;
    if (!answer || !source) continue;
    findings.push({
      id: text(r["Finding ID"]),
      slug: slugFor(r["Provider ID"]),
      theme: text(r["Theme"]),
      field_id: text(r["Field ID"]),
      question: text(r["Research question"]),
      outcome: text(r["Finding outcome"]),
      answer,
      numeric_value: num(r["Numeric value"]),
      unit: num(r["Numeric value"]) === null ? null : text(r["Unit"]),
      scope: text(r["Product / edition / geography"]),
      source_id: sourceId,
      second_source_id: publicId(r["Second source ID"]),
      claim: source.claim,
      accessed_date: source.accessed_date,
    });
  }

  const cases = [];
  for (const r of a["Cases"] ?? []) {
    if (text(r["Work status"]) !== "Evidence captured") continue;
    const customer = text(r["Customer / secure reference"]);
    const sourceId = publicId(r["Supplier source ID"]) ?? publicId(r["Customer source ID"]);
    const source = sourceId ? sourceIndex.get(sourceId) : undefined;
    if (!customer || !source) continue;
    const sector = text(r["Sector"]);
    cases.push({
      id: text(r["Case research ID"]),
      slug: slugFor(r["Provider ID"]),
      sector,
      sector_slug: SECTOR_SLUGS[sector] ?? null,
      customer,
      site_count: num(r["Site count"]),
      site_count_qualifier: num(r["Site count"]) === null ? null : text(r["Site count qualifier"]),
      user_count: num(r["User count"]),
      user_count_qualifier: num(r["User count"]) === null ? null : text(r["User count qualifier"]),
      source_id: sourceId,
      claim: source.claim,
      accessed_date: source.accessed_date,
    });
  }

  const products = [];
  for (const r of a["Product scopes"] ?? []) {
    const name = text(r["Product and edition"]);
    const sourceId = publicId(r["Source ID"]);
    if (!name || !sourceId || !sourceIndex.has(sourceId)) continue;
    products.push({ id: text(r["Product record ID"]), slug: slugFor(r["Provider ID"]), category: text(r["Product category code"]), name, source_id: sourceId, accessed_date: sourceIndex.get(sourceId).accessed_date });
  }

  const siteDelivery = [];
  for (const r of a["Site delivery"] ?? []) {
    const service = text(r["Service at this location"]);
    const sourceId = publicId(r["Source ID"]);
    if (!service || !sourceId || !sourceIndex.has(sourceId)) continue;
    siteDelivery.push({ id: text(r["Delivery ID"]), slug: slugFor(r["Provider ID"]), country: text(r["Country"]), location_type: text(r["Location type"]), service, source_id: sourceId, accessed_date: sourceIndex.get(sourceId).accessed_date });
  }

  // Pricing workbook
  const pricingSources = [];
  const furtherReading = [];
  const pricingIndex = new Map();
  const nameToSlug = Object.fromEntries(Object.entries(PUBLIC_NAMES).map(([s, n]) => [n.toLowerCase(), s]));
  for (const [wb, s] of Object.entries(WORKBOOK_SLUGS)) nameToSlug[wb] = s;
  const providerFromLabel = (label) => {
    const m = String(label ?? "").match(/label:?\s*([^;.]+)/i);
    if (!m) return null;
    const key = m[1].trim().toLowerCase();
    const first = key.split(/\s+/)[0];
    return nameToSlug[key]
      ?? Object.entries(PUBLIC_NAMES).find(([, n]) => n.toLowerCase().startsWith(key))?.[0]
      ?? Object.entries(PUBLIC_NAMES).find(([, n]) => n.toLowerCase().split(/\s+/)[0] === first)?.[0]
      ?? null;
  };
  for (const r of b["Sources"] ?? []) {
    const id = text(r["Source ID"]);
    const url = text(r["URL / secure document ref"]);
    if (!id || !url || isDevHost(url)) continue;
    const type = text(r["Source type"]);
    const title = text(r["Title"]);
    const base = { id, publisher: text(r["Publisher / seller"]), url, title: title && title !== url ? title : null, source_type: type, observed_date: isoDate(r["Observed date"]), published_date: isoDate(r["Published / updated date"]) };
    if (/discovery lead/i.test(type ?? "")) {
      furtherReading.push({ ...base, slug: providerFromLabel(r["Product / region applicability"]) });
      continue;
    }
    const rec = { ...base, passage: text(r["Short passage / precise paraphrase"]) };
    pricingSources.push(rec);
    pricingIndex.set(id, rec);
  }

  const offers = [];
  const offerIndex = new Map();
  for (const r of b["Offers"] ?? []) {
    const id = text(r["Offer ID"]);
    const sourceId = text(r["Primary source ID"]);
    if (!id || !sourceId || !pricingIndex.has(sourceId)) continue;
    const rec = {
      id, slug: slugFor(r["Provider ID"]), seller: text(r["Seller legal / trading name"]), product: text(r["Exact product / edition"]),
      category: text(r["Product category"]), buyer_eligibility: text(r["Buyer / channel eligibility"]), management_model: text(r["Management model"]),
      included: text(r["Included functions / scope"]), minimum_commitment: text(r["Minimum population / commitment"]),
      contract_term_months: num(r["Contract term (months)"]), evidence_route: text(r["Commercial evidence route"]), source_id: sourceId,
    };
    offers.push(rec);
    offerIndex.set(id, rec);
  }

  const priceLines = [];
  for (const r of b["Price lines"] ?? []) {
    const offer = offerIndex.get(text(r["Offer ID"]));
    const sourceId = text(r["Source ID"]);
    const source = sourceId ? pricingIndex.get(sourceId) : undefined;
    if (!offer || !source) continue;
    const currency = text(r["Currency ISO code"]);
    const evidenceClass = text(r["Evidence class"]);
    const historical = /historical/i.test(`${evidenceClass} ${text(r["Validity basis"]) ?? ""} ${source.source_type}`) || Boolean(source.published_date && source.published_date < "2025-01-01");
    priceLines.push({
      id: text(r["Price line ID"]), offer_id: offer.id, slug: offer.slug, product: offer.product,
      component: text(r["Component"]), charge_basis: text(r["Charge / inclusion basis"]), evidence_class: evidenceClass,
      amount: num(r["Original amount"]), currency, charge_unit: text(r["Charge unit"]), period: text(r["Price period"]),
      contract_term_months: num(r["Contract term (months)"]), qualifier: text(r["Price qualifier"]),
      minimum_quantity: num(r["Minimum quantity"]), maximum_quantity: num(r["Maximum quantity"]), tax: text(r["Tax treatment"]),
      source_id: sourceId, observed_date: source.observed_date, published_date: source.published_date,
      historical, non_uk: currency !== "GBP",
      label: "List or published price, not a quote",
    });
  }

  const priceRules = [];
  for (const r of b["Price rules"] ?? []) {
    const offer = offerIndex.get(text(r["Offer ID"]));
    const sourceId = text(r["Source ID"]);
    const source = sourceId ? pricingIndex.get(sourceId) : undefined;
    const rule = text(r["Exact rule / condition"]);
    if (!offer || !source || !rule) continue;
    priceRules.push({ id: text(r["Rule ID"]), offer_id: offer.id, slug: offer.slug, rule_type: text(r["Rule type"]), rule, meter: text(r["Meter / unit"]), lower_threshold: num(r["Lower threshold"]), upper_threshold: num(r["Upper threshold"]), amount: num(r["Original amount"]), currency: text(r["Currency ISO code"]), source_id: sourceId, observed_date: source.observed_date });
  }

  // Keep only pricing sources that something references, plus their order.
  const usedPricing = new Set([...offers.map((o) => o.source_id), ...priceLines.map((l) => l.source_id), ...priceRules.map((r) => r.source_id)]);
  const pricing_sources = pricingSources.filter((s) => usedPricing.has(s.id));

  const accessed = sources.map((s) => s.accessed_date).filter(Boolean).sort();
  const observed = pricing_sources.map((s) => s.observed_date).filter(Boolean).sort();
  const body = { providers, sources, findings, cases, products, site_delivery: siteDelivery, offers, price_lines: priceLines, price_rules: priceRules, pricing_sources, further_reading: furtherReading };
  const contentHash = sha(JSON.stringify(body)).slice(0, 16);
  const updated = [accessed.at(-1), observed.at(-1)].filter(Boolean).sort().at(-1) ?? null;
  return {
    contract_version: RESEARCH_CONTRACT_VERSION,
    dataset_version: `netify-research/${updated ?? "undated"}+sha256-${contentHash}`,
    generated_at: generatedAt ?? null,
    updated_date: updated,
    evidence_window: { sources_accessed_from: accessed[0] ?? null, sources_accessed_to: accessed.at(-1) ?? null, pricing_observed_from: observed[0] ?? null, pricing_observed_to: observed.at(-1) ?? null },
    publication_status: "Unverified desk research. Each record is a provider-published (or third-party) claim with its access date; Netify has not independently verified it. Prices are list or published prices, not quotes.",
    counts: Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v.length])),
    ...body,
  };
}
