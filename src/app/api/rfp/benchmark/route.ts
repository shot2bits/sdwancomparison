import { corsHeaders, preflight } from "@/lib/cors";
import { getBenchmark, kvConfigured } from "@/lib/rfp-store";
import { FEATURE_NAMES } from "@/lib/vendors";
import { SECTOR_LABELS } from "@/lib/shortlist-core";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Anonymised benchmark intelligence. The data moat that compounds with use. */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ available: false }, { headers: cors });
  const b = await getBenchmark();
  const topMandatory = Object.entries(b.mandatory_by_feature)
    .sort((a, c) => c[1] - a[1])
    .slice(0, 12)
    .map(([fid, count]) => ({ feature_id: fid, name: (FEATURE_NAMES as Record<string, string>)[fid] ?? fid, count }));
  const samples = b.response_completeness_samples;
  const medianCompleteness = samples.length
    ? [...samples].sort((a, c) => a - c)[Math.floor(samples.length / 2)]
    : null;
  const bySector = Object.fromEntries(
    Object.entries(b.mandatory_by_sector_feature).map(([sec, feats]) => {
      const top = Object.entries(feats).sort((a, c) => c[1] - a[1]).slice(0, 5)
        .map(([fid, count]) => ({ name: (FEATURE_NAMES as Record<string, string>)[fid] ?? fid, count }));
      const label = (SECTOR_LABELS as Record<string, string>)[sec] ?? sec;
      return [label, top];
    }),
  );
  return Response.json({
    available: true,
    total_rfps: Object.values(b.rfps_by_sector).reduce((n, x) => n + x, 0),
    rfps_by_sector: b.rfps_by_sector,
    top_mandatory_questions: topMandatory,
    top_mandatory_by_sector: bySector,
    median_response_completeness: medianCompleteness,
    note: "Anonymised aggregate signal from RFPs built with this tool. Counts only, no organisation identities.",
  }, { headers: cors });
}
