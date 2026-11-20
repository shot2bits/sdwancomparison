import raw from "@data/research/workbook-research.json";

/**
 * Netify desk research imported from the research and pricing workbooks by
 * scripts/import-research-workbooks.mjs. Every record is an unverified
 * provider-published (or third-party) claim with its access date; prices are
 * list or published prices, never quotes. This layer is read from the repo,
 * so the authenticated provider-match feed cannot override it.
 */
export type Claim = "provider_published" | "third_party" | "netify_compilation";
export type ResearchSource = { id: string; slug: string; source_type: string | null; title: string | null; publisher: string | null; url: string; passage: string | null; published_date: string | null; accessed_date: string | null; claim: Claim };
export type Finding = { id: string; slug: string; theme: string; field_id: string; question: string; outcome: string | null; answer: string; numeric_value: number | null; unit: string | null; scope: string | null; source_id: string; second_source_id: string | null; claim: Claim; accessed_date: string | null };
export type ResearchCase = { id: string; slug: string; sector: string; sector_slug: string | null; customer: string; site_count: number | null; site_count_qualifier: string | null; user_count: number | null; user_count_qualifier: string | null; source_id: string; claim: Claim; accessed_date: string | null };
export type ProductScope = { id: string; slug: string; category: string | null; name: string; source_id: string; accessed_date: string | null };
export type SiteDelivery = { id: string; slug: string; country: string | null; location_type: string | null; service: string; source_id: string; accessed_date: string | null };
export type Offer = { id: string; slug: string; seller: string | null; product: string | null; category: string | null; buyer_eligibility: string | null; management_model: string | null; included: string | null; minimum_commitment: string | null; contract_term_months: number | null; evidence_route: string | null; source_id: string };
export type PriceLine = { id: string; offer_id: string; slug: string; product: string | null; component: string | null; charge_basis: string | null; evidence_class: string | null; amount: number | null; currency: string | null; charge_unit: string | null; period: string | null; contract_term_months: number | null; qualifier: string | null; minimum_quantity: number | null; maximum_quantity: number | null; tax: string | null; source_id: string; observed_date: string | null; published_date: string | null; historical: boolean; non_uk: boolean; label: string };
export type PriceRule = { id: string; offer_id: string; slug: string; rule_type: string | null; rule: string; meter: string | null; lower_threshold: number | null; upper_threshold: number | null; amount: number | null; currency: string | null; source_id: string; observed_date: string | null };
export type PricingSource = { id: string; publisher: string | null; url: string; title: string | null; source_type: string | null; observed_date: string | null; published_date: string | null; passage?: string | null };
export type FurtherReading = PricingSource & { slug: string | null };
export type ResearchProvider = { slug: string; workbook_id: string; name: string; roles: string[] };

export type ResearchDataset = {
  contract_version: string;
  dataset_version: string;
  generated_at: string | null;
  updated_date: string | null;
  evidence_window: { sources_accessed_from: string | null; sources_accessed_to: string | null; pricing_observed_from: string | null; pricing_observed_to: string | null };
  publication_status: string;
  counts: Record<string, number>;
  providers: ResearchProvider[];
  sources: ResearchSource[];
  findings: Finding[];
  cases: ResearchCase[];
  products: ProductScope[];
  site_delivery: SiteDelivery[];
  offers: Offer[];
  price_lines: PriceLine[];
  price_rules: PriceRule[];
  pricing_sources: PricingSource[];
  further_reading: FurtherReading[];
};

export const RESEARCH = raw as unknown as ResearchDataset;
export const RESEARCH_PATH = "/research";

export const SECTORS: { slug: string; name: string }[] = [
  { slug: "financial-services", name: "Financial services" }, { slug: "government", name: "Government & councils" },
  { slug: "retail", name: "Retail" }, { slug: "healthcare", name: "Healthcare" }, { slug: "manufacturing", name: "Manufacturing" },
  { slug: "energy-and-utilities", name: "Energy & utilities" }, { slug: "education", name: "Education" },
  { slug: "transport-and-logistics", name: "Transport & logistics" }, { slug: "professional-services", name: "Professional services" },
  { slug: "hospitality", name: "Hospitality & leisure" },
];
/** Sectors with a dedicated, indexable case page. */
export const CASE_PAGE_SECTORS = ["retail", "financial-services"] as const;

export const CLAIM_LABEL: Record<Claim, string> = {
  provider_published: "Unverified provider-published claim",
  third_party: "Unverified third-party claim",
  netify_compilation: "Earlier Netify compilation",
};

const sourceById = new Map(RESEARCH.sources.map((s) => [s.id, s]));
const pricingSourceById = new Map(RESEARCH.pricing_sources.map((s) => [s.id, s]));
const providerBySlug = new Map(RESEARCH.providers.map((p) => [p.slug, p]));

export function researchSource(id: string | null | undefined) {
  return id ? sourceById.get(id) : undefined;
}
export function pricingSource(id: string | null | undefined) {
  return id ? pricingSourceById.get(id) : undefined;
}
export function researchProvider(slug: string) {
  return providerBySlug.get(slug);
}
export function providerName(slug: string) {
  return providerBySlug.get(slug)?.name ?? slug;
}
export function researchSlugs() {
  return RESEARCH.providers.map((p) => p.slug);
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const maxDate = (dates: (string | null | undefined)[]) => dates.filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;

export function providerResearch(slug: string) {
  const findings = RESEARCH.findings.filter((f) => f.slug === slug);
  const sources = RESEARCH.sources.filter((s) => s.slug === slug);
  const cases = RESEARCH.cases.filter((c) => c.slug === slug);
  const products = RESEARCH.products.filter((p) => p.slug === slug);
  const siteDelivery = RESEARCH.site_delivery.filter((d) => d.slug === slug);
  const offers = RESEARCH.offers.filter((o) => o.slug === slug);
  const priceLines = RESEARCH.price_lines.filter((l) => l.slug === slug);
  const priceRules = RESEARCH.price_rules.filter((r) => r.slug === slug);
  const furtherReading = RESEARCH.further_reading.filter((f) => f.slug === slug);
  const themes = new Map<string, Finding[]>();
  for (const f of findings) themes.set(f.theme, [...(themes.get(f.theme) ?? []), f]);
  const newSources = sources.filter((s) => s.claim !== "netify_compilation");
  return {
    provider: providerBySlug.get(slug),
    findings, sources, newSources, cases, products, siteDelivery, offers, priceLines, priceRules, furtherReading,
    themes: [...themes.entries()].map(([theme, rows]) => ({ theme, rows })),
    updated: maxDate([...newSources.map((s) => s.accessed_date), ...priceLines.map((l) => l.observed_date)]),
  };
}

export type CompareRow = { field_id: string; theme: string; question: string; a: Finding; b: Finding };

/** Shared-question comparison built only from captured evidence. */
export function compareResearch(a: string, b: string) {
  const fa = new Map(RESEARCH.findings.filter((f) => f.slug === a).map((f) => [f.field_id, f]));
  const fb = new Map(RESEARCH.findings.filter((f) => f.slug === b).map((f) => [f.field_id, f]));
  const shared: CompareRow[] = [];
  for (const [field, x] of fa) {
    const y = fb.get(field);
    if (y) shared.push({ field_id: field, theme: x.theme, question: x.question, a: x, b: y });
  }
  shared.sort((p, q) => p.field_id.localeCompare(q.field_id));
  const themes = [...new Set([...fa.values(), ...fb.values()].map((f) => f.theme))].sort();
  const byTheme = themes.map((theme) => ({
    theme,
    a: [...fa.values()].filter((f) => f.theme === theme).length,
    b: [...fb.values()].filter((f) => f.theme === theme).length,
  }));
  const pa = providerResearch(a);
  const pb = providerResearch(b);
  const updated = maxDate([pa.updated, pb.updated]);
  const nameA = providerName(a);
  const nameB = providerName(b);
  const pricedA = pa.priceLines.filter((l) => l.amount !== null).length;
  const pricedB = pb.priceLines.filter((l) => l.amount !== null).length;
  const aOnly = fa.size - shared.length;
  const bOnly = fb.size - shared.length;
  const lead = fa.size === fb.size ? `${nameA} and ${nameB} have the same number of evidenced questions (${fa.size})`
    : `${fa.size > fb.size ? nameA : nameB} has the broader published evidence (${Math.max(fa.size, fb.size)} evidenced questions against ${Math.min(fa.size, fb.size)})`;
  const verdict = `As of ${formatDate(updated)}, ${lead}. Both publish evidence on ${shared.length} of the same desk-research questions; ${nameA} has evidence on ${aOnly} that ${nameB} does not, and ${nameB} on ${bOnly} that ${nameA} does not. Published customer cases found: ${nameA} ${pa.cases.length}, ${nameB} ${pb.cases.length}. Published list prices recorded: ${nameA} ${pricedA ? `${pricedA} line${pricedA === 1 ? "" : "s"}` : "none"}, ${nameB} ${pricedB ? `${pricedB} line${pricedB === 1 ? "" : "s"}` : "none"}. This measures published evidence, not quality or fit, and every row is an unverified provider claim.`;
  return { a, b, nameA, nameB, shared, byTheme, updated, verdict, counts: { a: fa.size, b: fb.size, aOnly, bOnly, casesA: pa.cases.length, casesB: pb.cases.length, pricedA, pricedB } };
}

export function sectorResearch(sectorSlug: string) {
  const sector = SECTORS.find((s) => s.slug === sectorSlug);
  const cases = RESEARCH.cases.filter((c) => c.sector_slug === sectorSlug);
  const rows = cases.map((c) => ({
    case: c,
    provider: providerName(c.slug),
    evidence: RESEARCH.findings.filter((f) => f.slug === c.slug).length,
    source: researchSource(c.source_id),
  })).sort((x, y) => (y.case.site_count ?? -1) - (x.case.site_count ?? -1) || y.evidence - x.evidence || x.provider.localeCompare(y.provider));
  return { sector, cases, rows, updated: maxDate(cases.map((c) => c.accessed_date)), thin: cases.length < 5 };
}

export function money(amount: number | null, currency: string | null) {
  if (amount === null || !currency) return "No amount stated";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function priceLabels(l: PriceLine) {
  return [l.label, l.non_uk ? `Non-UK price (${l.currency ?? "currency not stated"})` : "UK price (GBP)", l.historical ? "Historical" : null].filter(Boolean) as string[];
}

export function researchSummarySentence() {
  const c = RESEARCH.counts;
  return `Netify desk research updated ${formatDate(RESEARCH.updated_date)}: ${c.findings} evidenced findings from ${c.sources} sources across ${c.providers} providers, ${c.cases} published customer cases and ${RESEARCH.price_lines.filter((l) => l.amount !== null).length} published list-price lines. All are unverified provider-published or third-party claims with access dates; prices are not quotes.`;
}
