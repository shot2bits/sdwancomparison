import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, publicProject, hasAcceptedNda, kvConfigured } from "@/lib/rfp-store";
import { ProjectDetailsSchema, type ProjectDetails } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";
import { recordRfpBenchmark, recordDemandSample, indexRfpForBuyer } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** The supplier projection: what a share-token holder may see. */
function supplierView(project: ProjectDetails, ndaAccepted: boolean) {
  const pub = publicProject(project);
  if (project.nda.required && !ndaAccepted) {
    return {
      ...pub,
      rfp_sections: [], // redacted until the NDA is accepted
      nda_required: true,
      teaser: {
        sector: project.buyer.sector,
        organisation_size: project.buyer.organisation_size,
        product_scope: project.buyer.product_scope,
        operating_model: project.buyer.operating_model,
        region_count: project.buyer.regions.length,
        question_count: project.rfp_sections.filter((s) => s.included).reduce((n, s) => n + s.questions.length, 0),
      },
    };
  }
  return { ...pub, viewer: "supplier" };
}

/**
 * Read an RFP. The id alone grants nothing: it appears in every supplier link,
 * so an id-open read would leak the full project (and, before this gate, the
 * editable builder) to any supplier who trimmed the URL.
 *
 *   owner (manage_token via body/header/?manage=, owner session, or Netify)
 *     → full project (credentials stripped);
 *   ?token={share_token}
 *     → supplier view, NDA teaser respected;
 *   otherwise → 401.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  const url = new URL(req.url);

  // Owner read: full project. Kept exactly schema-shaped (no marker keys),
  // because the builder PUTs this object straight back and the schema is strict.
  const access = await requireRfpOwner(req, project);
  if (access.ok) {
    return Response.json(publicProject(project), { headers: cors });
  }

  // Supplier read: requires the share token from the response link.
  const shareToken = (url.searchParams.get("token") ?? "").trim();
  if (shareToken && shareToken === project.share_token) {
    const vendor = (url.searchParams.get("vendor") ?? "").trim();
    const accepted = project.nda.required ? await hasAcceptedNda(project, vendor) : true;
    return Response.json(supplierView(project, accepted), { headers: cors });
  }

  return ownerRequired("Reading this RFP workspace", cors);
}

/** Full update (the agent and the UI both PUT the whole ProjectDetails). */
export async function PUT(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const existing = await getProject(id);
  if (!existing) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }

  // Mutation is owner-only. A plain buyer session is NOT enough — that would
  // let any signed-in visitor (including a supplier who signed up as a buyer)
  // rewrite any RFP whose id they saw in a share link.
  const access = await requireRfpOwner(req, existing, body);
  if (!access.ok) return ownerRequired("Editing this RFP", cors);

  const regenerate = body.regenerate === true;
  delete body.regenerate;

  // Preserve immutable/credential/ownership fields: a PUT must never rotate the
  // manage_token, reassign identity-bearing tokens, or move the RFP to another
  // account.
  let merged = {
    ...existing,
    ...(body as object),
    id: existing.id,
    share_token: existing.share_token,
    created: existing.created,
    manage_token: existing.manage_token,
    owner_email: existing.owner_email,
  } as typeof existing;

  // Adopt ownership: a token-authorised save from a signed-in buyer binds the
  // RFP to that account (covers RFPs created before sign-in or before
  // owner_email existed), so account access keeps working across devices.
  if (!merged.owner_email && access.viaToken && access.session && (access.session.role === "buyer" || access.session.role === "netify")) {
    merged = { ...merged, owner_email: access.session.email };
    try { await indexRfpForBuyer(access.session.email, existing.id); } catch { /* best effort */ }
  }

  // Regenerate methodology sections from buyer context, preserving custom and mandatory choices.
  if (regenerate) {
    const custom = existing.rfp_sections.flatMap((s) => s.questions.filter((q) => q.source === "custom").map((q) => ({ category: s.category, q })));
    const mandatoryIds = new Set(existing.rfp_sections.flatMap((s) => s.questions.filter((q) => q.mandatory).map((q) => q.id)));
    const fresh = synthesiseSections(merged.buyer);
    for (const { category, q } of custom) {
      let sec = fresh.find((s) => s.category === category);
      if (!sec) { sec = { category, included: true, questions: [] }; fresh.push(sec); }
      if (!sec.questions.some((x) => x.id === q.id)) sec.questions.push(q);
    }
    for (const s of fresh) for (const q of s.questions) if (mandatoryIds.has(q.id)) { q.mandatory = true; if (q.priority === "optional") q.priority = "required"; }
    merged = { ...merged, rfp_sections: fresh };
  }

  const parsed = ProjectDetailsSchema.safeParse(merged);
  if (!parsed.success) {
    return Response.json({ error: "Invalid RFP shape.", issues: parsed.error.issues.slice(0, 5) }, { status: 422, headers: cors });
  }
  const saved = await saveProject(parsed.data);
  if (existing.status !== "published" && saved.status === "published") {
    const mandatory = saved.rfp_sections.flatMap((s) => s.questions.filter((q) => q.mandatory && q.feature_id !== "custom").map((q) => q.feature_id));
    try { await recordRfpBenchmark(saved.buyer.sector, mandatory); } catch { /* best effort */ }
    // Demand flywheel for the cost/TCO page: anonymised, month-bucketed,
    // real BuyerContext fields only. Never blocks the publish.
    try { await recordDemandSample(saved.buyer, mandatory); } catch { /* best effort */ }
  }
  return Response.json(saved, { headers: cors });
}
