/**
 * The Position surface's cold open (P1): the live market, served as data.
 * Everything here is real or absent: the evaluated suppliers with their
 * evaluation dates and grade counts (the dataset), the genuinely open
 * public notices (the board), and the rulebook version. The scene renders
 * this and nothing else; if the board is quiet, the scene is quiet, which
 * is the design language's first law (breath marks a real open door only).
 *
 * Open, read-only, cacheable.
 */

import { sessionFromRequest } from "@/lib/auth";
import { corsHeaders, preflight } from "@/lib/cors";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { getVendorGroup } from "@/lib/vendors";
import { listPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { RULEBOOK_VERSION } from "@/lib/security/rulebook";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Which workspace scopes a vendor can genuinely serve, from the dataset
 *  (the same category/group logic the matcher uses). */
function scopesFor(category: string, group: string): string[] {
  const cat = category.toLowerCase();
  const out = new Set<string>();
  if (cat.includes("sd-wan") || group === "technology_vendors" || group === "cellular_wireless" || group === "global_managed_providers") out.add("sdwan");
  if (cat.includes("sse") || group === "sse_platforms" || group === "cloud_native_sase") out.add("sse");
  if (cat.includes("sase") || group === "cloud_native_sase" || group === "sse_platforms" || group === "global_managed_providers") out.add("sase");
  return [...out];
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const live = await getLiveShortlistDataset();
  const vendors = live.vendors.map((v) => {
    return {
      slug: v.slug,
      name: v.name,
      category: v.category,
      last_verified: String(v.last_verified ?? ""),
      yes_count: Object.values(v.capabilities).filter((grade) => grade === "yes").length,
      scopes: scopesFor(v.category, getVendorGroup(v)),
    };
  });
  const latest = vendors.reduce((m, v) => (v.last_verified > m ? v.last_verified : m), "");

  // The board, at its true size; absent rather than invented when storage
  // is unreachable.
  let notices: Array<{ id: string; title: string; scope: string[]; sites: number | null; created: number }> = [];
  try {
    if (kvConfigured()) {
      notices = (await listPublicOpportunities()).slice(0, 12).map((o) => ({
        id: o.id,
        title: o.title,
        scope: o.scope ?? [],
        sites: o.sites,
        created: o.created,
      }));
    }
  } catch {
    /* the scene stays honest with an empty board */
  }

  return Response.json(
    {
      ok: true,
      rulebook_version: RULEBOOK_VERSION,
      runtime_provider_source: live.source,
      provider_contract_version: live.providerContractVersion,
      provider_dataset_versions: live.datasetVersions,
      vendors,
      latest_evaluation: latest,
      // The regate: anonymous callers get the honest COUNT (an aggregate)
      // but never the listing itself; signed-in accounts see the notices.
      notices: (await sessionFromRequest(req)) ? notices : [],
      counts: { vendors: vendors.length, notices: notices.length },
    },
    { headers: { ...cors, "cache-control": "public, max-age=120, stale-while-revalidate=600" } },
  );
}
