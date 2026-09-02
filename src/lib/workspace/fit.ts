/**
 * The likely-best-fit computation, shared by the /api/workspace/fit route
 * and the workspace_cycle MCP tool so the page and an agent read the same
 * evidence (Article 17: one truth, every client). Server-side only (reads
 * the vendor dataset from disk).
 *
 * P3.3 (Robert's "Start P3.3", 22 July, spec v1.5 sections 13.7 and
 * 13.13): fit deepens to FEATURE LEVEL and comes under Article 14. Every
 * requirement specific with a genuine home in the dataset becomes a named
 * CHECK (the 40-feature grid, supported clouds, regional coverage, the
 * support model), each supplier carries its matched and missed checks with
 * the raw dataset grade, and the ORDER derives from that evidence with a
 * deterministic tiebreak, so any movement between two calls is traceable
 * to a check that changed. No check is invented where the dataset holds no
 * grade: what cannot be checked stays out of the ranking entirely (the
 * slice-1 lesson: never stretch a meaning to fit a field).
 *
 * Numbers order the list internally; they are never displayed. Movement,
 * with reasons and evidence dates, is the interface (13.13: people
 * understand movement, they do not understand scores).
 *
 * Fit from evidence, never marketing: network scopes rank via the same
 * matchSuppliers the wizard uses; managed-security scope states the
 * dataset boundary instead of inventing an MSSP ranking (truth rule 2).
 */

import { matchSuppliers } from "@/lib/supplier-match";
import type { ShortlistVendor } from "@/lib/shortlist-core";
import { getShortlistDataset } from "@/lib/vendors";
import { wizardRegions } from "@/lib/workspace/draft";

export const DATASET_BOUNDARY =
  "Netify's graded dataset is deepest in network security (SSE and SASE). Managed detection and SIEM shortlists are compiled per project from the marketplace's verified security responders, so no ranking is shown here.";

/** One named check: a requirement specific the dataset can genuinely grade. */
export type FitEvidence = {
  id: string;
  label: string;
  /** The dataset's own grade, verbatim: yes | partial | partner_integrated |
   *  managed_service_dependent | not_primary | unknown. */
  grade: string;
};

export type FitSupplier = {
  slug: string;
  name: string;
  category: string;
  last_verified: string;
  evidence_coverage_pct: number;
  yes_count: number;
  coverage: Record<string, string>; // requested region -> dataset grade
  /** Checks this supplier evidences (grade yes, partial, partner or
   *  managed-service dependent), with the grade carried verbatim. */
  matched: FitEvidence[];
  /** Checks the dataset does not evidence for this supplier. */
  missed: FitEvidence[];
  /** Fix, 10 Aug 2026 (Harry's E2E, Test 4.4): the desk's own fits panel
   *  had no vendor-contact route at all -- "Read the full record" only
   *  went to the vendor's Netify profile, one click short of the contact
   *  button every other surface (vendor page, compare page, best/ranked
   *  list) already carries. Same field the vendor page's own button reads
   *  (marketplace_url), added here so the panel can offer it directly. */
  marketplace_url: string | null;
};

export type WorkspaceFitResult =
  | {
      mode: "compiled";
      note: string;
      suppliers: FitSupplier[];
      directory: Array<{ slug: string; name: string }>;
      methodology: string;
      checks: Array<{ id: string; label: string }>;
    }
  | {
      mode: "graded";
      count: number;
      total: number;
      suppliers: FitSupplier[];
      directory: Array<{ slug: string; name: string }>;
      methodology: string;
      checks: Array<{ id: string; label: string }>;
    };

type VendorRecord = ShortlistVendor;

/* ------------------------------------------------------------------ */
/* The checks: requirement specifics the dataset genuinely grades      */
/* ------------------------------------------------------------------ */

/** Wants: taxonomy selections with a real home in the dataset. The ids are
 *  stable and shared with the taxonomy (want fields) and the MCP tool. */
const WANT_CHECKS: Record<string, { label: string; cap?: string; support?: string }> = {
  ztna: { label: "Zero trust network access", cap: "f30_zero_trust_network_access" },
  swg: { label: "Secure web gateway", cap: "f31_secure_web_gateway" },
  casb: { label: "CASB", cap: "f32_casb_capability" },
  dlp: { label: "Data loss prevention", cap: "f33_data_loss_prevention" },
  fwaas: { label: "Firewall as a service", cap: "f27_integrated_next_generation_firewall" },
  cellular: { label: "4G and 5G backup", cap: "f17_cellular_and_5g_support" },
  remote: { label: "Remote user access", cap: "f34_remote_user_access" },
  migration: { label: "Migration and professional services", cap: "f05_professional_services_and_migration_support" },
  mplsmig: { label: "MPLS coexistence and migration", cap: "f16_mpls_coexistence_and_migration" },
  unified: { label: "Single-vendor SASE platform", cap: "f28_full_sase_platform" },
  bob: { label: "Best-of-breed SSE integration", cap: "f29_sse_ecosystem_integration" },
  s247: { label: "24x7 support", support: "follow_the_sun_24x7" },
  ukdesk: { label: "UK-based support desk", support: "uk_support_desk" },
  tam: { label: "Named engineer or TAM", support: "named_tam" },
};

export const WANT_IDS = Object.keys(WANT_CHECKS);

const MODEL_CAPS: Record<string, { label: string; cap: string }> = {
  managed: { label: "Fully managed service", cap: "f01_fully_managed_service" },
  co_managed: { label: "Co-managed service", cap: "f03_co_managed_service" },
  diy: { label: "Self-managed model", cap: "f02_diy_self_managed_model" },
};

const CLOUD_CHECKS: Record<string, { label: string; key: string }> = {
  aws: { label: "AWS on-ramp", key: "aws" },
  azure: { label: "Azure on-ramp", key: "azure" },
  google: { label: "Google Cloud on-ramp", key: "gcp" },
};

const REGION_COVER_LABELS: Record<string, string> = {
  uk_ireland: "Coverage: the UK and Ireland",
  europe: "Coverage: Europe",
  north_america: "Coverage: North America",
  asia_pacific: "Coverage: Asia Pacific",
  middle_east_africa: "Coverage: the Middle East and Africa",
};

type Check = { id: string; label: string; gradeOf: (v: VendorRecord) => string };

const recOf = (o: unknown): Record<string, unknown> => (o && typeof o === "object" ? (o as Record<string, unknown>) : {});
const capGrade = (v: VendorRecord, capId: string): string => String(recOf(v.capabilities)[capId] ?? "unknown");

export function buildChecks(opts: {
  buying: string;
  regionKeys: string[];
  model?: string;
  clouds?: string[];
  mplsEstate?: boolean;
  wants?: string[];
}): Check[] {
  const checks: Check[] = [];
  const model = opts.model && MODEL_CAPS[opts.model] ? MODEL_CAPS[opts.model] : null;
  if (model) checks.push({ id: `model:${opts.model}`, label: model.label, gradeOf: (v) => capGrade(v, model.cap) });
  if (opts.buying === "sase") {
    checks.push({ id: "buying:sase", label: "Full SASE platform", gradeOf: (v) => capGrade(v, "f28_full_sase_platform") });
  }
  for (const c of opts.clouds ?? []) {
    const def = CLOUD_CHECKS[c];
    if (def) checks.push({ id: `cloud:${c}`, label: def.label, gradeOf: (v) => String(recOf(v.supported_clouds)[def.key] ?? "unknown") });
  }
  if (opts.mplsEstate && opts.buying !== "managed_security") {
    checks.push({ id: "estate:mpls", label: "MPLS coexistence and migration", gradeOf: (v) => capGrade(v, "f16_mpls_coexistence_and_migration") });
  }
  for (const r of opts.regionKeys) {
    const label = REGION_COVER_LABELS[r];
    if (label) checks.push({ id: `region:${r}`, label, gradeOf: (v) => String(recOf(v.regions)[r] ?? "unknown") });
  }
  for (const w of [...new Set(opts.wants ?? [])]) {
    const def = WANT_CHECKS[w];
    if (!def) continue;
    checks.push({
      id: `want:${w}`,
      label: def.label,
      gradeOf: (v) => (def.cap ? capGrade(v, def.cap) : String(recOf(v.support_model)[def.support!] ?? "unknown")),
    });
  }
  return checks;
}

/** Evidence weight of a dataset grade. Internal ordering only; never shown. */
const weight = (grade: string): number =>
  grade === "yes" ? 2 : grade === "partial" || grade === "partner_integrated" || grade === "managed_service_dependent" ? 1 : 0;

function enrich(slugs: string[], regionKeys: string[], vendors: VendorRecord[], checks: Check[]): FitSupplier[] {
  const bySlug = new Map(vendors.map((v) => [v.slug, v]));
  const out: FitSupplier[] = [];
  for (const slug of slugs) {
    const v = bySlug.get(slug);
    if (!v) continue;
    const regions = recOf(v.regions);
    const coverage: Record<string, string> = {};
    for (const r of regionKeys) coverage[r] = String(regions[r] ?? "unknown");
    const matched: FitEvidence[] = [];
    const missed: FitEvidence[] = [];
    for (const c of checks) {
      const grade = c.gradeOf(v);
      (weight(grade) > 0 ? matched : missed).push({ id: c.id, label: c.label, grade });
    }
    out.push({
      slug: v.slug,
      name: v.name,
      category: v.category,
      last_verified: String(v.last_verified ?? ""),
      evidence_coverage_pct: Number(v.evidence_coverage_pct ?? 0),
      yes_count: Object.values(v.capabilities).filter((grade) => grade === "yes").length,
      coverage,
      matched,
      missed,
      marketplace_url: v.marketplace_url ?? null,
    });
  }
  return out;
}

/** Order from evidence, deterministically (Article 14: any movement between
 *  two calls traces to a check whose grade set changed). Tiebreaks: the
 *  scope matcher's own order, then evaluation recency, then the slug. */
function orderByEvidence(suppliers: FitSupplier[], baseOrder: string[]): FitSupplier[] {
  const baseIdx = new Map(baseOrder.map((s, i) => [s, i]));
  const key = (s: FitSupplier) => {
    const total = s.matched.reduce((n, m) => n + weight(m.grade), 0);
    const full = s.matched.filter((m) => m.grade === "yes").length;
    return { total, full };
  };
  return [...suppliers].sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka.total !== kb.total) return kb.total - ka.total;
    if (ka.full !== kb.full) return kb.full - ka.full;
    const ia = baseIdx.get(a.slug) ?? 999, ib = baseIdx.get(b.slug) ?? 999;
    if (ia !== ib) return ia - ib;
    if (a.last_verified !== b.last_verified) return a.last_verified < b.last_verified ? 1 : -1;
    return a.slug < b.slug ? -1 : 1;
  });
}

export function workspaceFit(opts: {
  buying: string;
  regions?: string[]; // workspace region ids (uk, ie, eu, us, apac, me)
  model?: string;
  include?: string[]; // buyer-added slugs to enrich regardless of match
  clouds?: string[]; // workspace cloud ids (aws, azure, google)
  mplsEstate?: boolean; // MPLS stands in the stated estate
  wants?: string[]; // taxonomy selections with dataset homes (WANT_IDS)
}, vendors: ShortlistVendor[] = getShortlistDataset()): WorkspaceFitResult {
  const regionKeys = wizardRegions(opts.regions ?? []);
  const include = (opts.include ?? []).filter(Boolean).slice(0, 10);
  const directory = vendors.map((v) => ({ slug: v.slug, name: v.name }));
  const methodology = "Netify published provider evidence, live";
  const checks = buildChecks({
    buying: opts.buying,
    regionKeys,
    model: opts.model,
    clouds: opts.clouds,
    mplsEstate: opts.mplsEstate,
    wants: opts.wants,
  });
  const checkList = checks.map((c) => ({ id: c.id, label: c.label }));

  if (opts.buying === "managed_security") {
    return {
      mode: "compiled",
      note: DATASET_BOUNDARY,
      suppliers: enrich(include, regionKeys, vendors, checks),
      directory,
      methodology,
      checks: checkList,
    };
  }

  const scope = opts.buying === "sdwan" ? "sdwan" : opts.buying === "sse" ? "sse" : "sase";
  const result = matchSuppliers({ scope, regions: regionKeys, model: opts.model ?? "any", preferred_regions: regionKeys }, vendors);
  const orderedSlugs = result.names
    .map((n) => vendors.find((v) => v.name === n)?.slug)
    .filter((s): s is string => Boolean(s));
  const slugs = [...new Set([...orderedSlugs, ...include])];
  const enriched = enrich(slugs, regionKeys, vendors, checks);
  return {
    mode: "graded",
    count: result.count,
    total: result.total,
    suppliers: orderByEvidence(enriched, orderedSlugs),
    directory,
    methodology,
    checks: checkList,
  };
}
