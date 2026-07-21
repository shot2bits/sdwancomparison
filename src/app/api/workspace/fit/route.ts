/**
 * Live Sourcing Workspace: the likely-best-fit list (W0 slice 2, spec v1.3
 * section 3 point 5). Fit from evidence, never marketing: for network
 * scopes (SASE, SD-WAN, SSE) the list comes from the same matchSuppliers
 * the wizard uses, enriched with each vendor's REAL evaluation date and
 * dataset grades. For managed-security scope the dataset boundary is told
 * straight (truth rule 2): Netify's grading is deepest in network
 * security, and managed detection shortlists are compiled per project, so
 * no ranking is invented.
 *
 * Open and side-effect free; response is cacheable.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { matchSuppliers } from "@/lib/supplier-match";
import { getAllVendors } from "@/lib/vendors";
import { wizardRegions } from "@/lib/workspace/draft";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

const DATASET_BOUNDARY =
  "Netify's graded dataset is deepest in network security (SSE and SASE). Managed detection and SIEM shortlists are compiled per project from the marketplace's verified security responders, so no ranking is shown here.";

type FitSupplier = {
  slug: string;
  name: string;
  category: string;
  last_verified: string;
  evidence_coverage_pct: number;
  yes_count: number;
  coverage: Record<string, string>; // requested region -> dataset grade
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

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const url = new URL(req.url);
  const buying = url.searchParams.get("buying") ?? "";
  const regions = (url.searchParams.get("regions") ?? "").split(".").filter(Boolean);
  const model = url.searchParams.get("model") ?? "any";
  const include = (url.searchParams.get("include") ?? "").split(",").filter(Boolean).slice(0, 10);

  const regionKeys = wizardRegions(regions);
  const vendors = getAllVendors();
  const directory = vendors.map((v) => ({ slug: v.slug, name: v.name }));
  const headers = { ...cors, "cache-control": "public, max-age=300, stale-while-revalidate=3600" };

  if (buying === "managed_security") {
    return Response.json(
      {
        ok: true,
        mode: "compiled" as const,
        note: DATASET_BOUNDARY,
        suppliers: enrich(include, regionKeys, vendors),
        directory,
        methodology: "Netify vendor dataset, live",
      },
      { headers },
    );
  }

  const scope = buying === "sdwan" ? "sdwan" : buying === "sse" ? "sse" : "sase";
  const result = matchSuppliers({ scope, regions: regionKeys, model, preferred_regions: regionKeys });
  // The panel shows the strongest-coverage names first (the match module's
  // own ordering); enrich those, plus any vendors the buyer added by hand.
  const orderedSlugs = result.names
    .map((n) => vendors.find((v) => v.name === n)?.slug)
    .filter((s): s is string => Boolean(s));
  const slugs = [...new Set([...orderedSlugs, ...include])];

  return Response.json(
    {
      ok: true,
      mode: "graded" as const,
      count: result.count,
      total: result.total,
      suppliers: enrich(slugs, regionKeys, vendors),
      directory,
      methodology: "Netify vendor dataset, live",
    },
    { headers },
  );
}
