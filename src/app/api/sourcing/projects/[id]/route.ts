import {recordMarketplaceFunnelEvent} from "@/lib/marketplace-funnel";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { requireRfpOwner } from "@/lib/rfp-access";
import {
  getProject,
  publicProject,
  kvGetJson,
  kvSetJson,
  listResponses,
  saveResponse,
} from "@/lib/rfp-store";
import { circuitLock } from "@/lib/circuit-store";
import { listReviews } from "@/lib/agent-store";
import { reviewBid } from "@/lib/bid-review";
import {
  FeedItemSchema,
  PricingSchema,
  type FeedItem,
} from "@/lib/opportunity-types";
import type { SourcingRecord } from "@/lib/sourcing-store";
const headers = { "Cache-Control": "private, no-store" };
type Ctx = { params: Promise<{ id: string }> };
const Proposal = z
  .object({
    id: z.string().uuid(),
    vendor_slug: z.string().min(1),
    vendor: z.string().min(1).max(200),
    answers: z.record(z.string(), z.string().max(20000)),
    pricing: PricingSchema.extend({
      currency: z.string().regex(/^[A-Z]{3}$/),
      notes: z.string().max(12000),
      unit_note: z.string().min(1).max(2000),
    }),
    evidence_url: z.url().refine((s) => s.startsWith("https://")),
    supplier_confirmed: z.literal(true),
  })
  .strict();
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const p = await getProject(id);
    if (!p || !(await requireRfpOwner(req, p)).ok)
      return Response.json(
        { error: "Private project access required." },
        { status: 401, headers },
      );
    if (!p.entrance_context?.raw_input.sourcing_request_id)
      return Response.json(
        { error: "Not a sourcing project." },
        { status: 404, headers },
      );
    const [feed, responses, reviews] = await Promise.all([
      kvGetJson<FeedItem[]>(`rfp:${id}:sourcing-pricing`),
      listResponses(id),
      listReviews(id),
    ]);
    return Response.json(
      { project: publicProject(p), feed: feed ?? [], responses, reviews },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Unable to open this private project." },
      { status: 503, headers },
    );
  }
}
export async function POST(req: Request, ctx: Ctx) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin)
      return Response.json(
        { error: "Origin not allowed." },
        { status: 403, headers },
      );
    const session = await sessionFromRequest(req);
    if (session?.role !== "netify")
      return Response.json(
        { error: "Netify desk access required." },
        { status: 403, headers },
      );
    const { id } = await ctx.params;
    const raw = await req.text();
    if (raw.length > 250000)
      return Response.json(
        { error: "Proposal too large." },
        { status: 413, headers },
      );
    const b = Proposal.parse(JSON.parse(raw));
    const result = await circuitLock(`sourcing-proposals:${id}`, async () => {
      const p = await getProject(id);
      if (!p) throw Error("Project not found");
      const requestId = p.entrance_context?.raw_input.sourcing_request_id;
      const r =
        typeof requestId === "string"
          ? await kvGetJson<SourcingRecord>(`sourcing:request:${requestId}`)
          : null;
      if (
        !r ||
        r.status !== "desk_review" ||
        r.project_id !== id ||
        !r.request.recipients.some(
          (x) => x.slug === b.vendor_slug && x.actions.includes("proposals"),
        )
      )
        throw Error("Provider not approved for proposals");
      const feed =
        (await kvGetJson<FeedItem[]>(`rfp:${id}:sourcing-pricing`)) ?? [];
      const receiptKey = `rfp:${id}:proposal-receipt:${b.id}`;
      const receipt = await kvGetJson<{ payload: string; review: unknown }>(
        receiptKey,
      );
      if (receipt && receipt.payload !== JSON.stringify(b))
        throw Error("Proposal identifier already used");
      if (receipt?.review)
        return { project_id: id, review: receipt.review, replayed: true };
      const vendor = (await getLiveShortlistDataset()).vendors.find(
        (v) => v.slug === b.vendor_slug,
      );
      if (!vendor) throw Error("Unknown provider");
      // Reserve the exact payload before side effects, so interrupted retries cannot replace it.
      if (!receipt)
        await kvSetJson(receiptKey, {
          payload: JSON.stringify(b),
          review: null,
        });
      const response = await saveResponse({
        id: b.id,
        rfp_id: id,
        vendor: vendor.name,
        vendor_slug: b.vendor_slug,
        answers: b.answers,
        submitted: Date.now(),
        created: Date.now(),
      });
      const item = FeedItemSchema.parse({
        id: b.id,
        actor_type: "supplier",
        actor_slug: b.vendor_slug,
        actor_name: vendor.name,
        type: "pricing",
        pricing: b.pricing,
        body: "Supplier-confirmed written proposal recorded by Netify.",
        links: [b.evidence_url],
        answers: b.answers,
        created: response.submitted,
      });
      await kvSetJson(`rfp:${id}:sourcing-pricing`, [
        ...feed.filter((f) => f.id !== b.id),
        item,
      ]);
      const existingReview = (await listReviews(id)).find(
        (x) => x.response_id === b.id,
      );
      const reviewed = existingReview
        ? { review: existingReview }
        : await reviewBid(p, response, null, (await listResponses(id)).length);
      await kvSetJson(receiptKey, {
        payload: JSON.stringify(b),
        review: reviewed.review,
      });
      return { project_id: id, review: reviewed.review };
    });
    await recordMarketplaceFunnelEvent({event:"supplier_response",project_id:id,source:"shortlist",channel:"system"});
    return Response.json(result, { headers });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Check proposal fields and supplier confirmation."
            : "Unable to record this proposal. Check the approved provider and proposal reference before retrying.",
      },
      { status: 422, headers },
    );
  }
}
