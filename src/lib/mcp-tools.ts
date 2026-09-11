/**
 * MCP tool definitions and handlers. The logic core lives in
 * src/lib/shortlist-core.ts; handlers here only validate and dispatch.
 */

import { publicShortlistPreview } from "@/lib/public-shortlist";
import { FEATURES, FEATURE_NAMES, getVendor, getAllVendorSlugs } from "@/lib/vendors";
import { buildComparison, buildShortlist, DEFAULT_INPUT, encodeScenario, type ShortlistInput, type ShortlistVendor } from "@/lib/shortlist-core";
import { applyComparisonHandoff } from "@/lib/comparison-handoff";
import { SITE_URL } from "@/lib/structured-data";
import { getDemandIndex } from "@/lib/demand-index";
import { GOVERNED_SHORTLIST_CONTRACT_VERSION } from "@/lib/governed-provider-catalogue";
import { getLiveShortlistDataset, LIVE_SHORTLIST_CONTRACT_VERSION } from "@/lib/live-shortlist";
// Moved to its own dependency-free module (18 Aug 2026) so a client
// component (McpEvidencePanel.tsx) can import the tool catalogue without
// pulling this file's server-only imports (`@/lib/vendors`, node:fs) into
// the browser bundle — see mcp-tool-definitions.ts's own doc comment.
// Re-exported here so every existing import site is unaffected.
export { MCP_TOOL_DEFINITIONS } from "@/lib/mcp-tool-definitions";


/** Shape of the sector_evidence block in a netify.co.uk sector page JSON twin. */
type SectorEvidenceTwin = {
  contract: string;
  sector: string;
  summary: Record<string, unknown>;
  status_vocabulary: unknown[];
  evidence_rules: string[];
  requirements: { code: string; label: string; explanation: string; evidence_rule: string; display_order: number; regimes?: string[] | "all" }[];
  regulation_map?: unknown;
  providers: {
    slug: string;
    name: string;
    marketplace_url: string;
    research_status: string;
    overall_confidence: string;
    fit_conclusion: string | null;
    gaps_and_unknowns: string | null;
    reviewed_by: string | null;
    reviewed_date: string | null;
    source_count: number;
    accepted_source_count: number;
    requirements: { code: string; label: string; state: string; evidence_source_ids: string[]; verified_date: string | null }[];
    sources: { id: string; requirement_codes: string[]; [key: string]: unknown }[];
  }[];
};

export async function callMcpTool(name: string, args: unknown): Promise<unknown> {
  const live = await getLiveShortlistDataset();
  const shortlist = live.vendors;
  const knownShortlistSlugs = shortlist.map((vendor) => vendor.slug);
  switch (name) {
    case "build_sase_shortlist": {
      const result = publicShortlistPreview(shortlist, args ?? {}, FEATURE_NAMES);
      // The resume address (25 July 2026, machine-layer parity): the same
      // scenario codec the page itself uses to make every state shareable,
      // so this URL lands a human on the live shortlist with these exact
      // criteria applied and every input editable. Encode from the page's
      // own defaults so the address decodes to the state that recomputes
      // this result.
      const scenario = encodeScenario({ ...DEFAULT_INPUT, ...((args ?? {}) as Partial<ShortlistInput>) } as ShortlistInput);
      const resumeUrl = `${SITE_URL}/shortlist/${scenario ? `?${scenario}` : ""}`;
      const engineUrl = `${new URL("/sase-sd-wan-rfp-builder/", SITE_URL)}?journey=find_providers${scenario ? `&${scenario}` : ""}`;
      return {
        ...result,
        engine_url: engineUrl,
        resume_url: resumeUrl,
        _meta: {
          canonicalUrl: `${SITE_URL}/shortlist/`,
          resume_url: resumeUrl,
          note: "Public comparison remains available. Use start_project to prepare a short notice; get_unlocked_matches returns personalised results after verified publication. The resume URL carries these criteria into the project entrance.",
        },
      };
    }
    case "list_sase_features":
      return {
        features: FEATURES,
        extended_dimensions: {
          regions: ["uk_ireland", "europe", "north_america", "asia_pacific", "middle_east_africa", "latin_america", "china_mainland"],
          clouds: ["aws", "azure", "gcp", "oracle_cloud", "alibaba_cloud"],
          ai: ["ai_driven_operations", "ai_security_analytics", "ai_assistant"],
          other: ["disaster_recovery", "deployment_speed"],
        },
        _meta: { canonicalUrl: `${SITE_URL}/shortlist/` },
      };
    case "list_sase_vendors":
      return {
        contract_version: GOVERNED_SHORTLIST_CONTRACT_VERSION,
        vendors: shortlist.map((v) => ({
          slug: v.slug,
          name: v.name,
          category: v.category,
          evidence_coverage_pct: v.evidence_coverage_pct,
          evidence_source_count: v.evidence_source_count ?? 0,
          independent_evidence_source_count: v.independent_evidence_source_count ?? 0,
          reviewed_at: v.last_verified,
          profile_url: v.marketplace_url,
        })),
        _meta: { canonicalUrl: "https://netify.co.uk/marketplace/" },
      };
    case "get_sase_vendor_profile": {
      const slug = (args as { slug?: string })?.slug ?? "";
      if (!knownShortlistSlugs.includes(slug)) {
        return { error: `Unknown vendor slug: ${slug}. Call list_sase_vendors for valid slugs.` };
      }
      const v = shortlist.find((vendor) => vendor.slug === slug);
      return {
        ...v,
        governed_profile: { evidenceSourceCount: v?.evidence_source_count ?? 0, reviewedAt: v?.last_verified, profileUrl: v?.marketplace_url },
        contract_version: GOVERNED_SHORTLIST_CONTRACT_VERSION,
        source_contract_version: LIVE_SHORTLIST_CONTRACT_VERSION,
        dataset_versions: live.datasetVersions,
        runtime_provider_source: live.source,
        _meta: { canonicalUrl: v?.marketplace_url },
      };
    }
    case "compare_vendors": {
      const input = (args ?? {}) as { slugs?: string[]; question?: string };
      const slugs = (input.slugs ?? [])
        .filter((slug, index, all) => knownShortlistSlugs.includes(slug) && all.indexOf(slug) === index)
        .slice(0, 3);
      const comparison = buildComparison(shortlist, slugs, FEATURES);
      if (!comparison) return { error: "Provide two or three distinct valid provider slugs. Call list_sase_vendors for valid values." };
      const params = applyComparisonHandoff(new URLSearchParams(), {
        providers: comparison.slugs,
        question: (input.question ?? "").slice(0, 1000),
        source: "mcp",
      });
      const resumeUrl = `${SITE_URL}/shortlist/?${params.toString()}#comparison-workspace`;
      const engineUrl = `${new URL("/sase-sd-wan-rfp-builder/", SITE_URL)}?${params.toString()}#comparison-workspace`;
      return {
        ...comparison,
        engine_url: engineUrl,
        resume_url: resumeUrl,
        _meta: {
          canonicalUrl: `${SITE_URL}/shortlist/`,
          resume_url: resumeUrl,
          note: "The human workspace uses this same deterministic comparison result and can continue with contextual questions.",
        },
      };
    }
    case "get_demand_index":
      // Async: the route awaits callMcpTool, so returning the promise is safe.
      return getDemandIndex().then((index) =>
        index
          ? { ...index, _meta: { canonicalUrl: `${SITE_URL}/demand/`, machineReadable: `${SITE_URL}/demand/data.json` } }
          : { error: "Index store not configured." },
      );

    case "verify_claim":
      return verifyClaim(args);
    case "list_exclusions":
      return listExclusions(args);
    case "explain_shortlist":
      return explainShortlist({ ...((args ?? {}) as Record<string, unknown>), criteria: DEFAULT_INPUT }, shortlist);

    case "get_sector_evidence": {
      // Sector evidence layer (8 Sep 2026). The rows live in the netify.co.uk
      // Neon store and are published as the sector page's JSON twin, so this
      // tool reads the same document the page renders from: one status per
      // provider per requirement, each with its reviewed source rows. No
      // second copy of the research is kept here.
      const input = (args ?? {}) as { sector?: string; provider?: string; requirement?: string; regime?: string; include_sources?: boolean };
      const sectorPaths: Record<string, string> = {
        manufacturing: "sd-wan-sase-for-manufacturing",
        retail: "sd-wan-sase-for-retail",
        "financial-services": "sd-wan-sase-for-financial-services",
        healthcare: "sd-wan-for-healthcare",
      };
      const path = sectorPaths[input.sector ?? ""];
      if (!path) return { error: "Unknown sector. Use manufacturing, retail, financial-services or healthcare." };
      const pageUrl = `https://netify.co.uk/${path}/`;
      let twin: { sector_evidence?: SectorEvidenceTwin | null; regulation_map?: unknown } | null = null;
      try {
        const res = await fetch(`${pageUrl}data.json`, { next: { revalidate: 3600 } });
        if (res.ok) twin = (await res.json()) as { sector_evidence?: SectorEvidenceTwin | null; regulation_map?: unknown };
      } catch {
        twin = null;
      }
      const layer = twin?.sector_evidence ?? null;
      if (!layer) {
        return { sector: input.sector, has_evidence_layer: false, page_url: pageUrl, note: "No sector evidence review has been published for this sector yet. Manufacturing and financial-services are published." };
      }
      const includeSources = input.include_sources !== false;
      // Financial services: requirements carry the regimes they belong to and
      // source rows carry regulatory_regime, so a UK question never gets a US
      // bank case study as its evidence. Sectors without regimes ignore this.
      const regime = input.regime?.trim().toLowerCase();
      const regimeWord: Record<string, string> = { uk: "UK", eu: "EU", us: "US", canada: "Canada" };
      if (regime && !regimeWord[regime]) return { error: "Unknown regime. Use uk, eu, us or canada." };
      const inRegime = (r: { regimes?: string[] | "all" }) => !regime || !r.regimes || r.regimes === "all" || r.regimes.includes(regime);
      const sourceInRegime = (s: { [key: string]: unknown }) => !regime || !s.regulatory_regime || ["Multiple", "Not stated", regimeWord[regime]].includes(String(s.regulatory_regime));
      const requirementFilter = input.requirement?.trim().toLowerCase();
      const providerFilter = input.provider?.trim().toLowerCase();
      if (requirementFilter && !layer.requirements.some((r) => r.code === requirementFilter)) {
        return { error: `Unknown requirement code for ${input.sector}. Valid codes: ${layer.requirements.map((r) => r.code).join(", ")}.` };
      }
      const providers = layer.providers
        .filter((p) => !providerFilter || p.slug === providerFilter)
        .map((p) => {
          const regimeCodes = new Set(layer.requirements.filter(inRegime).map((r) => r.code));
          const requirements = p.requirements.filter((r) => (!requirementFilter || r.code === requirementFilter) && regimeCodes.has(r.code));
          const sourceIds = new Set(requirements.flatMap((r) => r.evidence_source_ids));
          const sources = includeSources
            ? p.sources.filter((s) => sourceInRegime(s) && (requirementFilter ? s.requirement_codes.includes(requirementFilter) || sourceIds.has(s.id) : true))
            : undefined;
          return {
            slug: p.slug,
            name: p.name,
            marketplace_url: p.marketplace_url,
            research_status: p.research_status,
            overall_confidence: p.overall_confidence,
            fit_conclusion: p.fit_conclusion,
            gaps_and_unknowns: p.gaps_and_unknowns,
            reviewed_by: p.reviewed_by,
            reviewed_date: p.reviewed_date,
            accepted_source_count: p.accepted_source_count,
            requirements,
            ...(sources ? { sources } : {}),
          };
        });
      if (providerFilter && providers.length === 0) {
        return { error: "Unknown provider slug for this sector. Call list_sase_vendors for valid values." };
      }
      return {
        sector: layer.sector,
        has_evidence_layer: true,
        summary: layer.summary,
        status_vocabulary: layer.status_vocabulary,
        evidence_rules: layer.evidence_rules,
        requirements: layer.requirements.filter((r) => inRegime(r) && (!requirementFilter || r.code === requirementFilter)),
        ...(regime ? { regime } : {}),
        ...(twin?.regulation_map ? { regulation_map: twin.regulation_map } : {}),
        providers,
        _meta: {
          canonicalUrl: pageUrl,
          dataset_url: `${pageUrl}data.json`,
          note: "Statuses are research decisions with dated sources, not scores. To review means the review of that provider has not been completed; Not found means credible sources were checked and nothing defensible was found, which does not prove the capability is absent.",
        },
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/* ------------------------------------------------------------------ */
/* The three evidence verbs (29 July 2026)                             */
/* ------------------------------------------------------------------ */
/**
 * Why these exist, and why they are different from the other tools.
 *
 * Measured 29 July 2026: roughly 83,600 Bing citations a quarter against
 * roughly 40 AI referral clicks a week. Close to all of our citations are
 * absorbed into someone else's answer and produce no visit and no call. That
 * is participation in a fan-out, not recommendation.
 *
 * A model recommends a destination only when it cannot finish the job itself.
 * It can already know which SD-WAN suppliers exist. What it cannot do is check
 * whether a specific claim about a specific supplier is true, today, against a
 * named source. verify_claim lets it do exactly that, which moves Netify from
 * something a model was trained on to something a model calls at answer time.
 *
 * All three return the quoted sentence, the source, its reliability tier and
 * the date it was read, so an answer built on them can attribute rather than
 * assert. Unknowns are returned as unknowns with the reason, because a model
 * that gets an honest "not published" from us learns to trust the ones we do
 * answer.
 */

const TIER_MEANING: Record<number, string> = {
  1: "The vendor's own published material.",
  2: "An independently accountable public record: a company register, a regulator, or named-author journalism with a date.",
  3: "Corroboration only. Never carries a grade on its own.",
  4: "Found and deliberately not used as evidence. Listed so the exclusion is public.",
};

/**
 * Field aliases. A model asking about "the underlay" or "PoPs" should not have
 * to know our internal ids, so the common ways of naming each fact all resolve.
 */
const CLAIM_ALIASES: Record<string, string> = {
  underlay: "underlay_ownership", circuits: "underlay_ownership", "underlay ownership": "underlay_ownership",
  "owns the network": "underlay_ownership", "own network": "underlay_ownership",
  sse: "sse_layer_ownership", "sse layer": "sse_layer_ownership", "security stack": "sse_layer_ownership",
  "security service edge": "sse_layer_ownership", "native sse": "sse_layer_ownership",
  compliance: "regulatory_documentation", "compliance documentation": "regulatory_documentation",
  regulatory: "regulatory_documentation", certifications: "regulatory_documentation",
  pops: "pop_count", "pop count": "pop_count", "points of presence": "pop_count",
  sla: "sla_availability_pct", availability: "sla_availability_pct", uptime: "sla_availability_pct",
  "delivery model": "delivery_model", type: "delivery_model", vendor_or_provider: "delivery_model",
  backbone: "f21_private_global_backbone", "private backbone": "f21_private_global_backbone",
  "global backbone": "f21_private_global_backbone",
  managed: "f01_fully_managed_service", "fully managed": "f01_fully_managed_service",
  "co-managed": "f03_co_managed_service", comanaged: "f03_co_managed_service",
  firewall: "f27_integrated_next_generation_firewall", ngfw: "f27_integrated_next_generation_firewall",
  dlp: "f33_data_loss_prevention", "data loss prevention": "f33_data_loss_prevention",
  "5g": "f17_cellular_and_5g_support", cellular: "f17_cellular_and_5g_support",
  noc: "f40_managed_service_assurance", soc: "f40_managed_service_assurance",
  "cloud gateways": "f19_public_cloud_gateways", "private pops": "f20_private_pops_dedicated_pops",
};

type SourcedFactShape = {
  value: string; evidence: number[]; confidence: string;
  quote: string; claimed_by: string; note: string | null;
};
type RegisterEntry = {
  n: number; tier: number; title: string; url: string;
  published: string | null; verified_on: string; reliability: string;
};

function factsOf(v: unknown): Record<string, SourcedFactShape> {
  return ((v as { sourced_facts?: Record<string, SourcedFactShape> }).sourced_facts ?? {});
}
function registerOf(v: unknown): RegisterEntry[] {
  return ((v as { evidence_register?: RegisterEntry[] }).evidence_register ?? []);
}
function conflictsOf(v: unknown): Array<Record<string, unknown>> {
  return ((v as { conflicts?: Array<Record<string, unknown>> }).conflicts ?? []);
}

/** Resolve whatever the caller typed to a field id we actually hold. */
function resolveClaim(raw: string, available: string[]): string | null {
  const q = raw.trim().toLowerCase();
  if (available.includes(raw)) return raw;
  if (CLAIM_ALIASES[q] && available.includes(CLAIM_ALIASES[q])) return CLAIM_ALIASES[q];
  const direct = available.find((f) => f.toLowerCase() === q);
  if (direct) return direct;
  // last resort: the longest alias whose words all appear in the question
  const words = q.split(/[^a-z0-9]+/).filter(Boolean);
  let best: string | null = null;
  for (const [alias, field] of Object.entries(CLAIM_ALIASES)) {
    if (!available.includes(field)) continue;
    const aw = alias.split(/[^a-z0-9]+/).filter(Boolean);
    if (aw.every((w) => words.includes(w)) && (!best || alias.length > best.length)) best = alias;
  }
  return best ? CLAIM_ALIASES[best] : null;
}

const ATTRIBUTION_BASE = "Netify SD-WAN and SASE vendor comparison";

/** Shared attribution line so every verb answer can be quoted with a name and a date. */
function attributionFor(verifiedOn: string): string {
  return `${ATTRIBUTION_BASE}, verified ${verifiedOn}, netify.co.uk/sase/shortlist`;
}

export function verifyClaim(args: unknown): unknown {
  const a = (args ?? {}) as { slug?: string; claim?: string; field?: string };
  const slug = (a.slug ?? "").trim();
  if (!getAllVendorSlugs().includes(slug)) {
    return { error: `Unknown vendor slug: ${slug || "(none given)"}. Call list_sase_vendors for valid slugs.` };
  }
  const v = getVendor(slug);
  const facts = factsOf(v);
  const register = registerOf(v);
  const byN = new Map(register.map((e) => [e.n, e]));
  const raw = (a.claim ?? a.field ?? "").trim();

  if (!raw) {
    return {
      supplier: v.name, slug,
      error: "Give a claim to check.",
      verifiable_now: Object.keys(facts),
      note: "These are the facts sourced individually for this vendor, each with a named source, a reliability tier and a quoted sentence. Other capability grades exist but are graded from category evidence rather than sourced per vendor.",
    };
  }

  const field = resolveClaim(raw, Object.keys(facts));
  if (!field) {
    const caps = (v.capabilities as unknown as Record<string, string>);
    const capField = resolveClaim(raw, Object.keys(caps));
    if (capField) {
      return {
        supplier: v.name, slug, claim: raw, resolved_field: capField,
        status: "graded_not_individually_sourced",
        value: caps[capField],
        verified_on: v.last_verified,
        note: "This capability carries a grade but was not sourced individually for this vendor. It sits in the market-baseline set, graded from category evidence. Treat it as indicative and confirm it directly with the vendor.",
        attribution: attributionFor(v.last_verified),
        _meta: { canonicalUrl: `${SITE_URL}/vendors/${slug}` },
      };
    }
    return {
      supplier: v.name, slug, claim: raw,
      status: "no_such_claim",
      verifiable_now: Object.keys(facts),
      note: "That claim does not map to a fact we hold for this vendor. The list above is what can be verified.",
      _meta: { canonicalUrl: `${SITE_URL}/vendors/${slug}` },
    };
  }

  const f = facts[field];
  const sources = (f.evidence ?? []).map((n) => byN.get(n)).filter(Boolean).map((e) => ({
    url: e!.url, title: e!.title, tier: e!.tier, tier_meaning: TIER_MEANING[e!.tier],
    published: e!.published, read_on: e!.verified_on, reliability: e!.reliability,
  }));
  const related = conflictsOf(v).filter((c) => String(c.field ?? "").includes(field.replace(/^f\d+_/, "")));

  const unknown = !f.value || f.value === "unknown";
  return {
    supplier: v.name, slug,
    claim: raw, resolved_field: field,
    status: unknown ? "not_found_in_public_sources" : (related.length ? "verified_with_conflict" : "verified"),
    value: unknown ? null : f.value,
    quote: f.quote || null,
    sources,
    verified_on: v.last_verified,
    confidence: f.confidence,
    claimed_by: f.claimed_by,
    note: f.note,
    conflicting_claims: related.length ? related : undefined,
    attribution: attributionFor(v.last_verified),
    _meta: {
      canonicalUrl: `${SITE_URL}/vendors/${slug}#evidence`,
      note: unknown
        ? "We looked and did not find this in public sources. Report it as unknown rather than inferring it; the reason is in note."
        : "The quote is present on the cited page and was confirmed there independently. Attribute to the source, or to Netify citing the source.",
    },
  };
}

export function listExclusions(args: unknown): unknown {
  const a = (args ?? {}) as { slug?: string };
  const slug = (a.slug ?? "").trim();
  const vendors = slug ? (getAllVendorSlugs().includes(slug) ? [getVendor(slug)] : []) : getAllVendorSlugs().map(getVendor);
  if (slug && vendors.length === 0) {
    return { error: `Unknown vendor slug: ${slug}. Call list_sase_vendors for valid slugs.` };
  }
  const out = vendors.map((v) => {
    const reg = registerOf(v);
    return {
      supplier: v.name, slug: v.slug,
      rejected: reg.filter((e) => e.tier === 4).map((e) => ({
        title: e.title, url: e.url, reason: e.reliability, read_on: e.verified_on,
      })),
      corroboration_only: reg.filter((e) => e.tier === 3).map((e) => ({
        title: e.title, url: e.url, note: e.reliability,
      })),
      conflicting_claims: conflictsOf(v),
      sources_used: reg.filter((e) => e.tier !== 4).length,
    };
  }).filter((x) => x.rejected.length || x.conflicting_claims.length || x.corroboration_only.length);

  const totalRejected = out.reduce((n, x) => n + x.rejected.length, 0);
  const totalConflicts = out.reduce((n, x) => n + x.conflicting_claims.length, 0);
  return {
    method:
      "Sources are graded on four tiers. Tier 1 is the vendor's own material, tier 2 an independently accountable public record, tier 3 corroboration that never carries a grade alone, and tier 4 sources found and deliberately not used. Tier 4 entries stay listed so the exclusion is auditable, including sources kept only to document a claim that conflicts with ours.",
    suppliers_covered: out.length,
    sources_rejected: totalRejected,
    conflicts_documented: totalConflicts,
    suppliers: out,
    attribution: ATTRIBUTION_BASE,
    _meta: {
      canonicalUrl: `${SITE_URL}/vendors`,
      note: "This record explains which sources Netify excluded and why.",
    },
  };
}

export function explainShortlist(args: unknown, shortlist?: ShortlistVendor[]): unknown {
  const a = (args ?? {}) as { a?: string; b?: string; criteria?: Record<string, unknown> };
  const slugA = (a.a ?? "").trim(), slugB = (a.b ?? "").trim();
  const known = shortlist?.map((provider) => provider.slug) ?? getAllVendorSlugs();
  if (!known.includes(slugA) || !known.includes(slugB)) {
    return { error: `Give two known vendor slugs as a and b. Unknown: ${[slugA, slugB].filter((s) => !known.includes(s)).join(", ") || "(none given)"}. Call list_sase_vendors.` };
  }
  const result = buildShortlist(shortlist ?? [], a.criteria ?? {}, FEATURE_NAMES);
  // buildShortlist numbers the shortlist and leaves near misses at rank 0. A
  // model reading rank 0 reports the supplier as ranked zero rather than absent,
  // which is worse than saying nothing, so placement is stated explicitly and
  // rank is null whenever the supplier is not on the list. Caught live 29 Jul.
  const place = (slug: string) => {
    const onList = result.shortlist.find((x) => x.slug === slug);
    if (onList) return { rec: onList, rank: onList.rank as number | null, placement: "in_shortlist" };
    const near = result.near_misses.find((x) => x.slug === slug);
    if (near) return { rec: near, rank: null, placement: near.eligible ? "eligible_but_outside_shortlist" : "excluded_by_criteria" };
    return { rec: undefined, rank: null, placement: "not_returned_for_these_criteria" };
  };
  const pA = place(slugA), pB = place(slugB);
  const rA = pA.rec, rB = pB.rec;
  const vA = getVendor(slugA), vB = getVendor(slugB);
  const fA = factsOf(vA), fB = factsOf(vB);
  const regA = new Map(registerOf(vA).map((e) => [e.n, e])), regB = new Map(registerOf(vB).map((e) => [e.n, e]));

  const differences = Object.keys(fA)
    .filter((k) => fB[k] && fA[k].value !== fB[k].value)
    .map((k) => ({
      fact: k,
      [slugA]: {
        value: fA[k].value, quote: fA[k].quote || null,
        source: (fA[k].evidence ?? []).map((n) => regA.get(n)?.url).filter(Boolean)[0] ?? null,
        confidence: fA[k].confidence,
      },
      [slugB]: {
        value: fB[k].value, quote: fB[k].quote || null,
        source: (fB[k].evidence ?? []).map((n) => regB.get(n)?.url).filter(Boolean)[0] ?? null,
        confidence: fB[k].confidence,
      },
    }));

  return {
    criteria: result.input,
    shortlist_size: result.shortlist.length,
    a: { slug: slugA, name: vA.name, rank: pA.rank, placement: pA.placement, score: rA?.score ?? null, eligible: rA?.eligible ?? null, gating_failures: rA?.gating_failures ?? [] },
    b: { slug: slugB, name: vB.name, rank: pB.rank, placement: pB.placement, score: rB?.score ?? null, eligible: rB?.eligible ?? null, gating_failures: rB?.gating_failures ?? [] },
    sourced_differences: differences,
    differences_count: differences.length,
    scoring_note: result.methodology_note,
    honest_limit:
      "The score is a weighted average across 40 capability grades. Sixteen of those forty no longer separate this market, so a score gap of a point or two is not a meaningful difference between vendors. The sourced differences above are the ones that carry evidence behind them, and they are what should decide a shortlist.",
    verified_on: vA.last_verified,
    attribution: attributionFor(vA.last_verified),
    _meta: {
      canonicalUrl: `${SITE_URL}/compare/${slugA}-vs-${slugB}`,
      note: "Every value in sourced_differences carries a quoted sentence and the page it came from, so an answer can attribute rather than assert.",
    },
  };
}
