import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";
import { getAllVendorSlugs } from "@/lib/vendors";
import {
  addProposal,
  classifyField,
  editingConfigured,
  listProposals,
  reviewProposal,
  WIKI_BASE,
  type ProposalStatus,
} from "@/lib/vendor-edit";

/**
 * The wiki's write surface.
 *
 * Nothing here mutates a vendor record. A proposal is queued; approval writes
 * to an overlay that the build folds into the files. That keeps every page
 * static, keeps the record a file, and keeps git as the audit trail, while
 * removing the developer from the loop for Harry and for suppliers.
 *
 * Identity is not reinvented here. The session, the admin check and the
 * supplier claim gate already exist and are imported, not modified.
 */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

type Body = {
  action?: "propose" | "approve" | "reject";
  vendor_slug?: string;
  field?: string;
  value?: string;
  source_url?: string;
  quote?: string;
  rationale?: string;
  id?: string;
  note?: string;
};

export async function GET(req: Request) {
  if (!editingConfigured()) return json({ error: "Editing store not configured." }, 503);
  const session = await sessionFromRequest(req);
  const email = session?.email ?? null;
  const admin = isAdminEmail(email);
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") as ProposalStatus | null) ?? undefined;

  const all = await listProposals(status);
  if (admin) return json({ role: "netify", proposals: all });

  // A supplier sees only its own vendor's proposals, and never anyone else's.
  const slug = session?.vendor_slug;
  if (!slug) return json({ error: "Sign in to see proposals." }, 401);
  return json({ role: "supplier", proposals: all.filter((p) => p.vendor_slug === slug) });
}

export async function POST(req: Request) {
  // The editor posts a plain HTML form so it works without JavaScript; agents
  // and the review queue post JSON. Accept both rather than making the humans
  // depend on a client bundle.
  const ctype = req.headers.get("content-type") ?? "";
  const formPost = ctype.includes("form");

  /**
   * Send a human back to the page they were on, carrying a short outcome
   * code. The sentence itself lives in OUTCOMES and is rendered by the page,
   * so a redirect never carries message text or anything personal. A referer
   * that is not one of our own /sase pages is not trusted, and the review
   * queue is the fallback rather than an open redirect.
   */
  const back = (code: string) => {
    let path = `${WIKI_BASE}/admin/record-queue/`;
    try {
      const u = new URL(req.headers.get("referer") ?? "");
      if (u.pathname.startsWith(`${WIKI_BASE}/`)) path = u.pathname;
    } catch {
      // No referer, or not a URL at all. The queue is a safe place to land.
    }
    return new Response(null, {
      status: 303,
      headers: { location: `${path}?r=${code}`, "cache-control": "no-store" },
    });
  };

  /** JSON for agents, a redirect for humans, one call site either way. */
  const out = (code: string, payload: unknown, status = 200) =>
    formPost ? back(code) : json(payload, status);

  if (!editingConfigured()) return out("notconfigured", { error: "Editing store not configured." }, 503);
  const session = await sessionFromRequest(req);
  const email = session?.email ?? null;
  const admin = isAdminEmail(email);
  let body: Body;
  try {
    if (formPost) {
      const fd = await req.formData();
      body = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])) as Body;
    } else {
      body = (await req.json()) as Body;
    }
  } catch {
    return out("failed", { error: "Send JSON or a form post." }, 400);
  }

  /* ---------------- review: Netify only ---------------- */
  if (body.action === "approve" || body.action === "reject") {
    if (!admin) return out("notadmin", { error: "Only Netify can approve or reject a proposal." }, 403);
    if (!body.id) return out("failed", { error: "Give the proposal id." }, 400);
    const res = await reviewProposal(
      body.id,
      body.action === "approve" ? "approved" : "rejected",
      email!,
      body.note ?? null,
    );
    if (!res.ok) return out("failed", { error: res.error }, 400);
    if (formPost) return back(body.action === "approve" ? "approved" : "rejected");
    return json({
      ok: true,
      proposal: res.proposal,
      note:
        body.action === "approve"
          ? "Approved and written to the overlay. It reaches the live pages on the next build."
          : "Rejected. The proposal stays on the record with your note.",
    });
  }

  /* ---------------- propose ---------------- */
  const slug = (body.vendor_slug ?? "").trim();
  const field = (body.field ?? "").trim();
  const value = (body.value ?? "").trim();
  if (!getAllVendorSlugs().includes(slug)) return out("unknown_vendor", { error: `Unknown vendor: ${slug}` }, 400);
  if (!field || !value) return out("missing", { error: "Give a field and a value." }, 400);

  const cls = classifyField(field);
  if (cls === "unknown") return out("badfield", { error: `${field} is not an editable field.` }, 400);

  if (!admin) {
    // Supplier lane. The claim gate is the existing one, not a new check.
    const { requireClaimedSupplierFor } = await import("@/lib/auth");
    const refusal = await requireClaimedSupplierFor(session, slug, {});
    if (refusal) return formPost ? back("signin") : refusal;

    // Article 7. A supplier may correct a fact about itself. It may never
    // touch the judgement layer, not even as a suggestion, because a vendor
    // who can soften their own watch-outs has removed the reason to trust us.
    if (cls === "judgement") {
      if (formPost) return back("judgement");
      return json(
        {
          error:
            "This field is the Netify View and cannot be proposed by the company it describes. Summaries, differentiators, best-fit statements and watch-outs are written by Netify and are not open to the companies they describe. If you believe one is factually wrong, propose a correction to the underlying fact and cite the page that proves it.",
          field_class: "judgement",
        },
        403,
      );
    }
    // Evidence is mandatory in the supplier lane. No source, no proposal.
    if (!body.source_url || !body.quote) {
      if (formPost) return back("evidence");
      return json(
        {
          error:
            "A proposal from a vendor or service provider needs a source URL and the exact sentence on that page. We check the sentence is really there before anything is applied, which is the same standard we hold ourselves to.",
        },
        400,
      );
    }
  }

  if (!admin && !session?.email) return out("signin", { error: "Sign in to propose a change." }, 401);

  const rec = await addProposal({
    vendor_slug: slug,
    field,
    field_class: cls,
    proposed_value: value,
    source_url: body.source_url?.trim() || null,
    quote: body.quote?.trim() || null,
    rationale: body.rationale?.trim() || null,
    proposed_by: admin ? "netify" : "supplier",
    proposer_email: email ?? "unknown",
  });

  // A Netify edit applies on save. Asking Harry to approve his own correction
  // is a queue with one person in it, and the review queue exists to hold a
  // supplier's word to account, not ours.
  //
  // Article 9 is untouched by this. The proposal is still written first and
  // then approved by name, through the same reviewProposal path a supplier
  // correction takes, so the log records who changed what, when, and to what,
  // in exactly the same shape. Nothing is applied anonymously and nothing
  // skips the record.
  if (admin) {
    const applied = await reviewProposal(rec.id, "approved", email ?? "netify", "Applied on save by Netify.");
    if (formPost) return back("applied");
    return json({
      ok: true,
      proposal: applied.proposal ?? rec,
      note: "Saved and applied to the record, logged under your name. It reaches the live pages at the next build.",
    });
  }

  if (formPost) return back("queued");
  return json({
    ok: true,
    proposal: rec,
    note:
      "Thank you. Netify reviews every proposal, checks the sentence against the page you cited, and publishes it or explains why not.",
  });
}
