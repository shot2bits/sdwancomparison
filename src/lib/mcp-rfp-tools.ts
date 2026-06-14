/**
 * Agent-to-agent RFP tools for the MCP server. These let a supplier's AI
 * agent fetch a published RFP and submit responses, and let any agent check
 * an RFP's status, all over JSON-RPC. Token-gated and KV-backed (async).
 * This is the agentic procurement infrastructure piece: the RFP becomes a
 * machine-callable object, not just a web form.
 */

import { getProjectByToken, getProject, saveProject, listResponses, saveResponse, getConnectionByToken, newId, kvConfigured } from "@/lib/rfp-store";
import { addMessage, inviteSupplier } from "@/lib/rfp-connect";
import { buildShortlist } from "@/lib/shortlist-core";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { resolveOpportunityToken, getOpportunity, listPublicOpportunities } from "@/lib/rfp-store";
import { addFeedItem, vendorName } from "@/lib/opportunity";
import { RfpResponseSchema } from "@/lib/rfp-types";
import { matchVendorSlug } from "@/lib/rfp-evaluation";
import { SITE_URL } from "@/lib/structured-data";

export const MCP_RFP_TOOL_DEFINITIONS = [
  {
    name: "get_rfp",
    description: "Fetch a published SASE/SD-WAN RFP by its share token so a supplier agent can read the questions. Returns title, status, scope, delivery model and the active questions with the evidence requested.",
    inputSchema: { type: "object", properties: { token: { type: "string", description: "The RFP share token issued to invited suppliers." } }, required: ["token"] },
  },
  {
    name: "list_rfp_questions",
    description: "List the active questions for an RFP by share token, grouped by category, each with its feature id and the evidence to provide.",
    inputSchema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] },
  },
  {
    name: "respond_to_rfp",
    description: "Submit or update a supplier's answers to an RFP. Provide the share token, your organisation name, and an answers map of question id to response text. Set submit true to finalise.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string" },
        vendor: { type: "string", description: "Responding organisation name." },
        answers: { type: "object", description: "Map of question id to answer text." },
        submit: { type: "boolean" },
      },
      required: ["token", "vendor", "answers"],
    },
  },
  {
    name: "get_rfp_status",
    description: "Return an RFP's lifecycle status and response count by share token.",
    inputSchema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] },
  },
  {
    name: "supplier_inbox",
    description: "For a supplier agent: read the buyer messages on a connection using the per-connection supplier token. Returns the RFP summary and the message thread.",
    inputSchema: { type: "object", properties: { supplier_token: { type: "string" } }, required: ["supplier_token"] },
  },
  {
    name: "publish_rfp",
    description: "For a buyer agent: publish an RFP to the curated supplier list. Invites the best-fit graded vendors and moves the RFP to published. Requires the rfp_id and the manage_token issued when the RFP was created (the buyer/agent credential for push actions).",
    inputSchema: { type: "object", properties: { rfp_id: { type: "string" }, manage_token: { type: "string" }, shortlist_size: { type: "integer", minimum: 3, maximum: 12 } }, required: ["rfp_id", "manage_token"] },
  },
  {
    name: "list_opportunities",
    description: "List open opportunities on the public board: title, buyer, scope, region, sites, engagement type (quote_room or auction), auction format, eligibility, deadline and activity counts. No pricing amounts. Open read, no token. Optionally filter by scope (underlay_circuits, sd_wan, sse, sase, managed_service).",
    inputSchema: { type: "object", properties: { scope: { type: "string", description: "Optional scope filter." } } },
  },
  {
    name: "opportunity_inbox",
    description: "For a supplier agent: read a live opportunity and its activity feed using the per-supplier opportunity token.",
    inputSchema: { type: "object", properties: { opportunity_token: { type: "string" } }, required: ["opportunity_token"] },
  },
  {
    name: "opportunity_respond",
    description: "For a supplier agent: respond to a live opportunity. type is comment, interest, pricing or decline. For pricing include amount, model (per_site_monthly, per_user_monthly, total_monthly, one_off, indicative), currency and notes.",
    inputSchema: {
      type: "object",
      properties: {
        opportunity_token: { type: "string" },
        type: { type: "string", enum: ["comment", "interest", "pricing", "decline"] },
        body: { type: "string" },
        pricing: { type: "object" },
      },
      required: ["opportunity_token", "type"],
    },
  },
  {
    name: "supplier_reply",
    description: "For a supplier agent: reply to the buyer on a connection. type is message, demo_response, contact_share or decline. payload carries structured contact details or demo slots.",
    inputSchema: {
      type: "object",
      properties: {
        supplier_token: { type: "string" },
        type: { type: "string", enum: ["message", "demo_response", "contact_share", "decline"] },
        body: { type: "string" },
        payload: { type: "object" },
      },
      required: ["supplier_token", "body"],
    },
  },
] as const;

export const RFP_TOOL_NAMES: Set<string> = new Set(MCP_RFP_TOOL_DEFINITIONS.map((t) => t.name as string));

function activeQuestions(project: NonNullable<Awaited<ReturnType<typeof getProjectByToken>>>) {
  return project.rfp_sections
    .filter((s) => s.included)
    .map((s) => ({
      category: s.category,
      questions: s.questions.filter((q) => q.priority !== "optional").map((q) => ({
        id: q.id, feature_id: q.feature_id, text: q.text, evidence_requested: q.evidence_requested, mandatory: q.mandatory,
      })),
    }))
    .filter((s) => s.questions.length > 0);
}

export async function callRfpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // name validated against RFP_TOOL_NAMES by the caller
  // Public board read: open, no token. Safe before the storage guard.
  if (name === "list_opportunities") {
    if (!kvConfigured()) return { opportunities: [], count: 0 };
    let opportunities = await listPublicOpportunities();
    const scope = typeof args.scope === "string" ? args.scope : null;
    if (scope) opportunities = opportunities.filter((o) => o.scope.includes(scope as never));
    return { count: opportunities.length, opportunities };
  }
  if (!kvConfigured()) return { error: "RFP storage not configured." };

  // Buyer agent: publish an RFP to the curated supplier list using the manage_token.
  if (name === "publish_rfp") {
    const project = await getProject(String(args.rfp_id ?? ""));
    if (!project) return { error: "RFP not found." };
    if (!project.manage_token || args.manage_token !== project.manage_token) return { error: "Invalid manage_token for this RFP." };
    const size = Math.min(Math.max(Number(args.shortlist_size ?? 8), 3), 12);
    const result = buildShortlist(getShortlistDataset(), {
      sector: project.buyer.sector ?? null,
      organisation_size: project.buyer.organisation_size ?? "any",
      service_model: project.buyer.operating_model ?? "any",
      required_regions: project.buyer.regions ?? [],
      shortlist_size: size,
    }, FEATURE_NAMES);
    const invited: string[] = [];
    for (const v of result.shortlist) {
      const r = await inviteSupplier(project.id, v.slug, `You are invited to respond to the RFP "${project.title}".`);
      if (!("error" in r)) invited.push(r.vendor_name);
    }
    await saveProject({ ...project, status: "published", invited_vendors: Array.from(new Set([...project.invited_vendors, ...result.shortlist.map((v) => v.slug)])) });
    return { ok: true, status: "published", invited };
  }
  // Opportunity supplier-agent tools use a per-supplier opportunity token.
  if (name === "opportunity_inbox" || name === "opportunity_respond") {
    const otoken = String(args.opportunity_token ?? "");
    if (!otoken) return { error: "opportunity_token is required." };
    const ref = await resolveOpportunityToken(otoken);
    if (!ref) return { error: "Invalid opportunity token." };
    const opp = await getOpportunity(ref.opp_id);
    if (!opp) return { error: "Opportunity not found." };
    if (name === "opportunity_inbox") {
      return { title: opp.title, scope: opp.scope, sites: opp.sites, regions: opp.regions, summary: opp.summary, status: opp.status, feed: opp.feed.map((f) => ({ actor: f.actor_name, type: f.type, body: f.body, pricing: f.pricing, created: f.created })) };
    }
    if (opp.status !== "open") return { error: "Opportunity is not open." };
    const t = String(args.type ?? "comment");
    const allowed = ["comment", "interest", "pricing", "decline"];
    const name2 = vendorName(ref.vendor_slug) ?? ref.vendor_slug;
    const updated = await addFeedItem(opp, "supplier", ref.vendor_slug, name2, (allowed.includes(t) ? t : "comment") as never, String(args.body ?? ""), t === "pricing" ? ((args.pricing ?? null) as never) : null);
    return { ok: true, status: updated.status };
  }

  // Supplier-agent tools use a per-connection supplier token.
  if (name === "supplier_inbox" || name === "supplier_reply") {
    const stoken = String(args.supplier_token ?? "");
    if (!stoken) return { error: "supplier_token is required." };
    const conn = await getConnectionByToken(stoken);
    if (!conn) return { error: "Connection not found for that token." };
    if (name === "supplier_inbox") {
      const project = await getProject(conn.rfp_id);
      return {
        rfp: project ? { title: project.title, status: project.status, sector: project.buyer.sector, scope: project.buyer.product_scope } : null,
        status: conn.status,
        messages: conn.messages.map((mm) => ({ from: mm.from, type: mm.type, body: mm.body, payload: mm.payload, created: mm.created })),
      };
    }
    const t = String(args.type ?? "message");
    const allowed = ["message", "demo_response", "contact_share", "decline"];
    const updated = await addMessage(conn, "supplier", (allowed.includes(t) ? t : "message") as never, String(args.body ?? ""), (args.payload ?? {}) as Record<string, string>);
    return { ok: true, status: updated.status };
  }

  const token = String(args.token ?? "");
  if (!token) return { error: "token is required." };

  if (name === "get_rfp") {
    const p = await getProjectByToken(token);
    if (!p) return { error: "RFP not found for that token." };
    return {
      id: p.id, title: p.title, status: p.status, methodology_version: p.methodology_version,
      scope: p.buyer.product_scope, delivery_model: p.buyer.operating_model,
      sector: p.buyer.sector, compliance: p.buyer.compliance,
      open_for_responses: p.status === "published" || p.status === "qa",
      sections: activeQuestions(p),
      respond_via: `${SITE_URL}/api/mcp (tool respond_to_rfp) or ${SITE_URL}/rfp-builder/${p.id}/respond?token=${token}`,
    };
  }
  if (name === "list_rfp_questions") {
    const p = await getProjectByToken(token);
    if (!p) return { error: "RFP not found for that token." };
    return { sections: activeQuestions(p) };
  }
  if (name === "get_rfp_status") {
    const p = await getProjectByToken(token);
    if (!p) return { error: "RFP not found for that token." };
    const responses = await listResponses(p.id);
    return { status: p.status, open_for_responses: p.status === "published" || p.status === "qa", response_count: responses.length };
  }
  if (name === "respond_to_rfp") {
    const p = await getProjectByToken(token);
    if (!p) return { error: "RFP not found for that token." };
    if (p.status !== "published" && p.status !== "qa") return { error: "This RFP is not open for responses." };
    const vendor = String(args.vendor ?? "");
    if (!vendor) return { error: "vendor is required." };
    const answers = (args.answers ?? {}) as Record<string, string>;
    const existing = (await listResponses(p.id)).find((r) => r.vendor === vendor);
    const response = RfpResponseSchema.parse({
      id: existing?.id ?? newId("resp"),
      rfp_id: p.id,
      vendor,
      vendor_slug: existing?.vendor_slug ?? matchVendorSlug(vendor),
      answers: { ...(existing?.answers ?? {}), ...answers },
      submitted: args.submit ? Date.now() : existing?.submitted ?? null,
      created: existing?.created ?? Date.now(),
    });
    await saveResponse(response);
    return { ok: true, recorded: Object.keys(answers).length, submitted: Boolean(args.submit) };
  }
  return { error: `Unknown RFP tool ${name}` };
}
