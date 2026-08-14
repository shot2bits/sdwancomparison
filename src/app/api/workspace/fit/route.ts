/**
 * Live Sourcing Workspace: the likely-best-fit list (W0 slice 2, spec v1.3
 * section 3 point 5). Thin HTTP wrapper over lib/workspace/fit.ts, which
 * the workspace_cycle MCP tool shares, so the page and an agent read the
 * same evidence. Open and side-effect free; response is cacheable.
 *
 * Living Procurement Canvas Phase 2 correction (14 Aug 2026): this route
 * has no project id and no publish-state concept -- it scores the buyer's
 * ad hoc in-progress draft, which within the Canvas journey means it is
 * ALWAYS a pre-publication call (there is no post-publish caller: once a
 * project publishes, the workspace reads the frozen matched/invited
 * vendors from that project's own PublishedSnapshot instead, never a
 * fresh recompute here -- see ProjectDesk.tsx's `published` state). Per
 * the product rule ("no project-specific vendor names, rankings, MATCH
 * COUNTS, positions, evidence badges... before publication"), this
 * endpoint therefore never returns vendor-identifying OR match-count
 * fields to the browser: `suppliers` (names, slugs, positions, evidence,
 * marketplace links), `directory` (the full named vendor list) and
 * `count` (the number of vendors THIS project's scope matched -- a
 * project-specific match count, banned by the product rule independent
 * of whether a vendor name is attached to it) are all stripped from
 * every response, unconditionally -- not toggled by a query parameter a
 * caller could omit to bypass it. A second pass on this same round
 * caught `count` specifically: an earlier version of this fix stripped
 * `suppliers`/`directory` but left `count` in the response, still
 * reachable by any client hitting this route directly even after the
 * page itself stopped displaying it -- exactly the kind of gap the "as
 * well as the JSX so it cannot be bypassed" instruction exists to close.
 * `workspaceFit()` itself is UNCHANGED (still returns the full identifying
 * shape, `count` included) because the workspace_cycle MCP tool
 * (mcp-workspace-tools.ts) calls it directly, server-side, for a
 * distinct, out-of-scope surface; only this HTTP boundary -- the one
 * that reaches a buyer's browser -- is redacted. `total`/`methodology`/
 * `checks`/`note` all stay: none name a vendor or reveal a project-
 * specific match count -- `total` in particular is the WHOLE dataset
 * size (`matchSuppliers()`'s own `all.length`, never narrowed by this
 * project's scope), exactly the "total evaluated marketplace" figure the
 * product brief says is safe to show pre-publish.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { workspaceFit } from "@/lib/workspace/fit";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const url = new URL(req.url);
  const result = workspaceFit({
    buying: url.searchParams.get("buying") ?? "",
    regions: (url.searchParams.get("regions") ?? "").split(".").filter(Boolean),
    model: url.searchParams.get("model") ?? "any",
    include: (url.searchParams.get("include") ?? "").split(",").filter(Boolean),
    // P3.3: the requirement specifics the dataset genuinely grades.
    clouds: (url.searchParams.get("clouds") ?? "").split(".").filter(Boolean),
    mplsEstate: url.searchParams.get("mpls") === "1",
    wants: (url.searchParams.get("wants") ?? "").split(".").filter(Boolean),
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { suppliers, directory, count, ...safe } = result as typeof result & { count?: number };
  return Response.json(
    { ok: true, ...safe },
    { headers: { ...cors, "cache-control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
