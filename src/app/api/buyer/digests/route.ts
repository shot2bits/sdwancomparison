import { corsHeaders, preflight } from "@/lib/cors";
import { sessionFromRequest } from "@/lib/auth";
import { listBuyerRfpIds, kvConfigured } from "@/lib/rfp-store";
import { listDigests } from "@/lib/agent-store";
import type { Digest } from "@/lib/agent-types";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** A signed-in buyer's agent digests across all their RFPs, newest first. */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session?.email || session.role === "supplier") {
    return Response.json({ error: "Sign in as a buyer to see your agent digests.", auth_required: true }, { status: 401, headers: cors });
  }
  const ids = await listBuyerRfpIds(session.email);
  const all: Digest[] = [];
  for (const id of ids) {
    const ds = await listDigests(id);
    if (ds.length) all.push(ds[0]); // most recent digest per RFP
  }
  all.sort((a, b) => b.created - a.created);
  return Response.json({ digests: all.slice(0, 30) }, { headers: cors });
}
