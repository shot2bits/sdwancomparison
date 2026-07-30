import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listResponses, saveResponse, hasAcceptedNda, newId, kvConfigured } from "@/lib/rfp-store";
import { RfpResponseSchema } from "@/lib/rfp-types";
import { matchVendorSlug } from "@/lib/rfp-evaluation";
import { recordCompletenessSample } from "@/lib/rfp-store";
import { sessionFromRequest, requireClaimedSupplierFor } from "@/lib/auth";
import { getGoal } from "@/lib/agent-store";
import { reviewBid } from "@/lib/bid-review";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";

export const runtime = "nodejs";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** List supplier responses (buyer evaluation view). Owner-only: this is every
 *  supplier's full submission, including commercial answers — the single most
 *  sensitive read on the RFP. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project);
  if (!access.ok) return ownerRequired("Reading vendor responses", cors);
  return Response.json({ responses: await listResponses(id) }, { headers: cors });
}

/** Supplier submits or updates their answers to the RFP questions. */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  if (project.status !== "published" && project.status !== "qa") {
    return Response.json({ error: "This RFP is not open for responses." }, { status: 409, headers: cors });
  }
  // Response window: submissions close at the deadline set when the buyer
  // submitted to the marketplace (deal room slice 1, 15 July 2026).
  if (project.response_deadline && Date.now() > project.response_deadline) {
    return Response.json({ error: "The response window for this RFP has closed." }, { status: 409, headers: cors });
  }
  let body: { vendor?: string; answers?: Record<string, string>; submit?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }
  if (!body.vendor) return Response.json({ error: "vendor is required." }, { status: 422, headers: cors });
  const slug = matchVendorSlug(body.vendor);
  const session = await sessionFromRequest(req);
  const gate = await requireClaimedSupplierFor(session, slug ?? "__unmatched__", cors);
  if (gate) return gate;
  // NDA gate: if the buyer requires an NDA, the responding organisation must
  // have a recorded acceptance of the current version before they can respond.
  if (!(await hasAcceptedNda(project, body.vendor))) {
    return Response.json(
      { error: "This RFP requires you to accept the buyer's NDA before responding.", nda_required: true },
      { status: 403, headers: cors },
    );
  }
  const existing = (await listResponses(id)).find((r) => r.vendor === body.vendor);
  const response = RfpResponseSchema.parse({
    id: existing?.id ?? newId("resp"),
    rfp_id: id,
    vendor: body.vendor,
    vendor_slug: existing?.vendor_slug ?? matchVendorSlug(body.vendor),
    answers: { ...(existing?.answers ?? {}), ...(body.answers ?? {}) },
    submitted: body.submit ? Date.now() : existing?.submitted ?? null,
    created: existing?.created ?? Date.now(),
  });
  const saved = await saveResponse(response);
  let review_summary: { coverage: number; gaps: number; proposed: number; risks: number } | null = null;
  if (body.submit) {
    const allResponses = await listResponses(id);
    const active = project.rfp_sections.filter((x) => x.included).flatMap((x) => x.questions.filter((q) => q.priority !== "optional"));
    const answered = active.filter((q) => (saved.answers[q.id] ?? "").trim()).length;
    if (active.length) { try { await recordCompletenessSample(answered / active.length); } catch { /* best effort */ } }
    // Reactive agent review: the agent reviews the bid without the buyer
    // prompting, scores it, flags gaps, drafts clarifications and queues them
    // for approval. It sends nothing. Best effort: a review failure must not
    // block the supplier's submission.
    try {
      const goal = await getGoal(id);
      const { review, risks, proposed } = await reviewBid(project, saved, goal, allResponses.length);
      review_summary = { coverage: review.coverage_ratio, gaps: review.gaps.length, proposed, risks: risks.length };
    } catch (e) {
      console.error("bid review failed:", e);
    }
  }
  return Response.json({ ...saved, review_summary }, { headers: cors });
}
