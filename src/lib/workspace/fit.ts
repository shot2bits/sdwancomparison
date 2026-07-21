/**
 * The likely-best-fit computation, shared by the /api/workspace/fit route
 * and the workspace_cycle MCP tool so the page and an agent read the same
 * evidence (Article 17: one truth, every client). Server-side only (reads
 * the vendor dataset from disk).
 *
 * Fit from evidence, never marketing: network scopes rank via the same
 * matchSuppliers the wizard uses, enriched with each vendor's REAL
 * evaluation date and dataset grades; managed-security scope states the
 * dataset boundary instead of inventing an MSSP ranking (truth rule 2).
 */

import { matchSuppliers } from "@/lib/supplier-match";
import { getAllVendors } from "@/lib/vendors";
import { wizardRegions } from "@/lib/workspace/draft";

export const DATASET_BOUNDARY =
  "Netify's graded dataset is deepest in network security (SSE and SASE). Managed detection and SIEM shortlists are compiled per project from the marketplace's verified security responders, so no ranking is shown here.";

export type FitSupplier = {
  slug: string;
  name: string;
  category: string;
  last_verified: string;
  evidence_coverage_pct: number;
  yes_count: number;
  coverage: Record<string, string>; // requested region -> dataset grade
};

export type WorkspaceFitResult =
  | {
      mode: "compiled";
      note: string;
      suppliers: FitSupplier[];
      directory: Array<{ slug: string; name: string }>;
      methodology: string;
    }
  | {
      mode: "graded";
      count: number;
      total: number;
      suppliers: FitSupplier[];
      directory: Array<{ slug: string; name: string }>;
      methodology: string;
    };

type VendorRecord = ReturnType<typeof getAllVendors>[number];

function enrich(slugs: string[], regionKeys: string[], vendors: VendorRecord[]): FitSupplier[] {
  const bySlug = new Map(vendors.map((v) => [v.slug, v]));
  const out: FitSupplier[] = [];
  for (const slug of slugs) {
    const v = bySlug.get(slug);
    if (!v) continue;
    const regions = (v.regions ?? {}) as Record<string, unknown>;
    const coverage: Record<string, string> = {};
    for (const r of regionKeys) coverage[r] = String(regions[r] ?? "unknown");
    const score = (v.score_summary ?? {}) as Record<string, unknown>;
    out.push({
      slug: v.slug,
      name: v.name,
      category: v.category,
      last_verified: String(v.last_verified ?? ""),
      evidence_coverage_pct: Number(score.evidence_coverage_pct ?? 0),
      yes_count: Number(score.yes_count ?? 0),
      coverage,
    });
  }
  return out;
}

export function workspaceFit(opts: {
  buying: string;
  regions?: string[]; // workspace region ids (uk, ie, eu, us, apac, me)
  model?: string;
  include?: string[]; // buyer-added slugs to enrich regardless of match
}): WorkspaceFitResult {
  const regionKeys = wizardRegions(opts.regions ?? []);
  const include = (opts.include ?? []).filter(Boolean).slice(0, 10);
  const vendors = getAllVendors();
  const directory = vendors.map((v) => ({ slug: v.slug, name: v.name }));
  const methodology = "Netify vendor dataset, live";

  if (opts.buying === "managed_security") {
    return { mode: "compiled", note: DATASET_BOUNDARY, suppliers: enrich(include, regionKeys, vendors), directory, methodology };
  }

  const scope = opts.buying === "sdwan" ? "sdwan" : opts.buying === "sse" ? "sse" : "sase";
  const result = matchSuppliers({ scope, regions: regionKeys, model: opts.model ?? "any", preferred_regions: regionKeys });
  const orderedSlugs = result.names
    .map((n) => vendors.find((v) => v.name === n)?.slug)
    .filter((s): s is string => Boolean(s));
  const slugs = [...new Set([...orderedSlugs, ...include])];
  return {
    mode: "graded",
    count: result.count,
    total: result.total,
    suppliers: enrich(slugs, regionKeys, vendors),
    directory,
    methodology,
  };
}
