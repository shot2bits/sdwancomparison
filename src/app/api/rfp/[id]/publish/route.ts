import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { executePublish, DeclinedApprovalError } from "@/lib/rfp-publish";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Publish an RFP: invite the best-fit graded vendors, move the RFP to
 * published, list it on the public opportunity board and notify the Netify
 * team and the buyer. Requires the RFP owner (manage_token or the owning
 * account) AND a verified buyer/netify session: publishing reaches named
 * suppliers, so possession of the draft alone is no longer enough.
 * The publish mechanics live in lib/rfp-publish.ts, shared with the auth
 * verify endpoint's pending_submit path.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { manage_token?: string; shortlist_size?: number; list_on_board?: boolean; marketing_opt_in?: boolean; acknowledge_declined_approval?: boolean; excluded_vendors?: unknown } = {};
  try { body = await req.json(); } catch { /* body optional */ }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Publishing this RFP", cors);

  // Hard identity gate: signed-out owners and agents get a machine-readable
  // handoff instead of a silent token-only publish. Drafting stays open; the
  // manage_token remains the ownership proof, the session is the identity.
  const sessionEmail = access.session && (access.session.role === "buyer" || access.session.role === "netify") ? access.session.email : "";
  if (!sessionEmail) {
    return Response.json(
      {
        error: "sign_in_required",
        auth_required: true,
        message: "Publishing sends this RFP to vendors and service providers, so it needs a verified work email. Open the builder, sign in and publish again; your draft is untouched.",
        sign_in_url: `${SITE_URL}/rfp-builder/${project.id}/`,
      },
      { status: 401, headers: cors },
    );
  }

  let result;
  try {
    result = await executePublish(project, sessionEmail, {
      shortlist_size: body.shortlist_size,
      list_on_board: body.list_on_board,
      marketing_opt_in: body.marketing_opt_in,
      acknowledge_declined_approval: body.acknowledge_declined_approval === true,
      // F3: buyer exclusions for the ranked fill (sanitised again in the
      // core; unknown slugs are inert). A pinned vendor always beats one.
      excluded_vendors: Array.isArray(body.excluded_vendors)
        ? body.excluded_vendors.filter((s): s is string => typeof s === "string").slice(0, 40)
        : undefined,
    });
  } catch (e) {
    // D5: a declined approval requires the explicit confirmation; the
    // machine's own refusals (open gaps, missing consent) surface with
    // their reasons instead of a blank 500.
    if (e instanceof DeclinedApprovalError) {
      return Response.json(
        { error: e.message, requires_decline_confirmation: true, confirmation_text: e.message },
        { status: 409, headers: cors },
      );
    }
    return Response.json({ error: (e as Error).message }, { status: 409, headers: cors });
  }
  const { published, invited, criteria, board, market_report, matched_vendors } = result;

  // Step 10 board-journey closure: a completed HTTP response is not the
  // same thing as a completed publication. `executePublish()` deliberately
  // returns a locked result when the board write or MarketUnlock binding
  // fails, leaving the project retryable and sending no invitations. The
  // old route still returned 200/ok:true for that locked result, so clients
  // announced "Published" even though there was no board id to visit. Make
  // the lifecycle boundary explicit at the API: no public board id means
  // publication did not complete.
  if (!board.opportunity_id) {
    return Response.json(
      {
        ok: false,
        code: "board_publication_incomplete",
        error: board.reason ?? "The opportunity could not be listed on the board. Nothing was sent; review the RFP and try again.",
        retryable: true,
        board,
        market_unlocked: false,
      },
      { status: 409, headers: cors },
    );
  }

  // Round 4 correction (14 Aug 2026), Robert's finding 4: `matched_vendors`
  // is the REAL buildShortlist() selection (same source as `invited`), not
  // `market_report.matched.names` (a different, simpler matchSuppliers()
  // ranking that can genuinely omit an invited vendor). Returning it here
  // means the immediate post-publish view can render the correct matched
  // set, not only a later resumed read.
  // Market-unlock correction round (16 Aug 2026): `board.opportunity_id`
  // is only ever set once the Opportunities Board record was created
  // successfully, which is the same moment executePublish() commits the
  // MarketUnlock record (rfp-publish.ts) -- so its presence here is a
  // reliable, cheap proxy for the canonical market_unlocked boolean
  // without a second KV read. Callers should still treat market-unlock.ts
  // as the single source of truth on any LATER read (the GET routes all
  // query it directly); this is only for this one immediate response.
  return Response.json({ ok: true, status: published.status, invited, matched_vendors, criteria, board, market_report, market_unlocked: true }, { headers: cors });
}
