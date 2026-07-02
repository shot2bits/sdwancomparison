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
import { RfpResponseSchema, BuyerContextSchema, ProjectDetailsSchema } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";
import { toPublicOpportunity } from "@/lib/opportunity-types";
import { getSampleNotice } from "@/lib/sample-notices";
import { normaliseNoticeDraft } from "@/lib/notice-validate";
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
    description: "For a supplier agent: respond to a live opportunity. type is comment, interest, pricing or decline. For pricing include amount, model (per_site_monthly, per_user_monthly, total_monthly, one_off, indicative), currency and notes. Optionally attach up to 5 evidence links (https URLs to case studies, SLA schedules, certifications) via links.",
    inputSchema: {
      type: "object",
      properties: {
        opportunity_token: { type: "string" },
        type: { type: "string", enum: ["comment", "interest", "pricing", "decline"] },
        body: { type: "string" },
        pricing: { type: "object" },
        links: { type: "array", items: { type: "string" }, description: "Up to 5 https evidence URLs." },
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
  {
    name: "get_opportunity",
    description: "Fetch one public opportunity notice by id: the full public projection (scope, buyer context, timeline, evidence requested, evaluation priorities, AI summary) plus its canonical notice URL and data.json URL. Sample notices are served with is_sample true. Never includes pricing amounts, buyer contact details or tokens. Open read.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Opportunity id from list_opportunities, or a sample notice slug." } }, required: ["id"] },
  },
  {
    name: "draft_opportunity_notice",
    description: "For a buyer agent: turn rough project fields into a normalised, publish-ready project notice draft. Validates every value against the marketplace catalogues (invalid values are dropped and reported), and returns the draft plus completeness gaps. Stateless and public: nothing is stored. Publishing requires the buyer to sign in at /opportunities/new (the draft fields map 1:1 onto the wizard).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string", description: "Plain-English description of the need." },
        scope: { type: "array", items: { type: "string" }, description: "underlay_circuits, sd_wan, sse, sase, managed_service, firewall_fwaas, ztna, swg, casb, connectivity, managed_security, not_sure" },
        buyer_org: { type: "string" },
        buyer_visibility: { type: "string", enum: ["named", "anonymous"] },
        buyer_sector: { type: "string" },
        buyer_size_band: { type: "string" },
        sites: { type: "integer" },
        users_band: { type: "string" },
        regions: { type: "array", items: { type: "string" } },
        cloud_platforms: { type: "array", items: { type: "string" } },
        current_environment: { type: "string" },
        desired_outcomes: { type: "string" },
        compliance_requirements: { type: "array", items: { type: "string" } },
        evidence_requested: { type: "array", items: { type: "string" } },
        evaluation_priorities: { type: "array", items: { type: "string" } },
        response_mode: { type: "string", enum: ["indicative_pricing", "discovery_calls", "written_responses", "quote_room", "reverse_auction", "shortlist", "full_rfp"] },
        response_deadline: { type: "string", description: "ISO date" },
        decision_target: { type: "string" },
        go_live_target: { type: "string" },
      },
      required: ["summary"],
    },
  },
  {
    name: "validate_opportunity_notice",
    description: "For a buyer agent: check a project notice draft for completeness before publishing. Returns a 0-1 completeness score, critical gaps (blockers for a useful notice) and recommended gaps (improve supplier response quality). Deterministic, stateless, public.",
    inputSchema: { type: "object", properties: { draft: { type: "object", description: "The notice draft fields (same shape as draft_opportunity_notice input)." } }, required: ["draft"] },
  },
  {
    name: "generate_rfp_from_opportunity",
    description: "For a buyer agent: create a draft RFP seeded from a public opportunity notice (scope, sector, estate, compliance and background carried over; methodology sections synthesised). Returns rfp_id, manage_token (KEEP SECRET - it is the buyer credential for publish/invite), share_token, and the builder/preview URLs. Downloading the final document and publishing to suppliers require the buyer to sign in.",
    inputSchema: { type: "object", properties: { opportunity_id: { type: "string" }, title: { type: "string", description: "Optional RFP title; defaults to the notice title." } }, required: ["opportunity_id"] },
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
    return {
      count: opportunities.length,
      opportunities: opportunities.map((o) => ({ ...o, notice_url: `${SITE_URL}/opportunities/${o.id}/`, data_url: `${SITE_URL}/opportunities/${o.id}/data.json` })),
    };
  }

  // Stateless public buyer-agent tools: no storage required.
  if (name === "draft_opportunity_notice") {
    const { notice, validation } = normaliseNoticeDraft(args);
    return {
      notice,
      validation,
      how_to_publish: `Publishing requires sign-in. Take the buyer to ${SITE_URL}/opportunities/new/ — the wizard fields map 1:1 onto this draft, drafting and preview are open, and the draft is only stored when the buyer publishes.`,
    };
  }
  if (name === "validate_opportunity_notice") {
    const draft = (args.draft ?? {}) as Record<string, unknown>;
    const { validation } = normaliseNoticeDraft(draft);
    return validation;
  }

  // Public notice read: works for sample notices even without storage.
  if (name === "get_opportunity") {
    const id = String(args.id ?? "");
    const sample = getSampleNotice(id);
    if (sample) {
      return { is_sample: true, note: "Sample project notice: a worked example, not a live opportunity.", opportunity: sample, notice_url: `${SITE_URL}/opportunities/${id}/`, data_url: `${SITE_URL}/opportunities/${id}/data.json` };
    }
    if (!kvConfigured()) return { error: "Opportunity not found." };
    const opp = await getOpportunity(id);
    if (!opp || opp.visibility !== "public") return { error: "Opportunity not found." };
    return {
      is_sample: false,
      opportunity: toPublicOpportunity(opp),
      notice_url: `${SITE_URL}/opportunities/${id}/`,
      data_url: `${SITE_URL}/opportunities/${id}/data.json`,
      how_to_respond: "Suppliers sign in with a verified work email, or agents use opportunity_respond with a per-supplier opportunity token. Pricing stays private to the buyer.",
    };
  }
  if (!kvConfigured()) return { error: "RFP storage not configured." };

  // Buyer agent: seed a draft RFP from a public opportunity notice.
  if (name === "generate_rfp_from_opportunity") {
    const oppId = String(args.opportunity_id ?? "");
    const source = getSampleNotice(oppId) ?? (await (async () => { const o = await getOpportunity(oppId); return o && o.visibility === "public" ? toPublicOpportunity(o) : null; })());
    if (!source) return { error: "Opportunity not found." };
    const scopeArr = source.scope as string[];
    const buyer = BuyerContextSchema.parse({
      sector: source.buyer_sector || null,
      organisation_size: source.buyer_size_band === "large_global" ? "large_global_enterprise" : source.buyer_size_band === "enterprise" || source.buyer_size_band === "mid_market" ? "mid_market" : source.buyer_size_band === "small" ? "small_business" : "any",
      site_count: source.sites,
      regions: source.regions.map((r) => (r === "asia_pacific" ? "apac" : r)),
      compliance: source.compliance_requirements,
      operating_model: scopeArr.includes("managed_service") || scopeArr.includes("managed_security") ? "managed" : "any",
      product_scope: scopeArr.includes("sase") ? "full_sase" : scopeArr.includes("sse") ? "sse_only" : scopeArr.includes("sd_wan") ? "sdwan_only" : "full_sase",
      notes: [source.title, source.summary, source.current_environment && `Current environment: ${source.current_environment}`, source.desired_outcomes && `Desired outcomes: ${source.desired_outcomes}`, `Source: project notice ${oppId}`].filter(Boolean).join("\n\n"),
    });
    const id = newId("rfp");
    const project = ProjectDetailsSchema.parse({
      id, created: Date.now(), updated: Date.now(), status: "draft",
      title: String(args.title ?? "") || `RFP: ${source.title}`,
      buyer, rfp_sections: synthesiseSections(buyer), invited_vendors: [],
      share_token: newId("tok"), manage_token: newId("mtok"), methodology_version: "2026.1",
    });
    const saved = await saveProject(project);
    return {
      rfp_id: saved.id,
      manage_token: saved.manage_token,
      share_token: saved.share_token,
      builder_url: `${SITE_URL}/rfp-builder/${saved.id}/`,
      preview_url: `${SITE_URL}/rfp-builder/${saved.id}/preview/`,
      sections: saved.rfp_sections.filter((s) => s.included).map((s) => ({ category: s.category, questions: s.questions.length })),
      note: "manage_token is the buyer credential for publish/invite - keep it secret. Downloading the final document and publishing to suppliers require buyer sign-in.",
    };
  }

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
      return { title: opp.title, scope: opp.scope, sites: opp.sites, regions: opp.regions, summary: opp.summary, status: opp.status, feed: opp.feed.map((f) => ({ actor: f.actor_name, type: f.type, body: f.body, pricing: f.pricing, links: f.links, created: f.created })) };
    }
    if (opp.status !== "open") return { error: "Opportunity is not open." };
    const t = String(args.type ?? "comment");
    const allowed = ["comment", "interest", "pricing", "decline"];
    const name2 = vendorName(ref.vendor_slug) ?? ref.vendor_slug;
    const updated = await addFeedItem(opp, "supplier", ref.vendor_slug, name2, (allowed.includes(t) ? t : "comment") as never, String(args.body ?? ""), t === "pricing" ? ((args.pricing ?? null) as never) : null, (args.links ?? []) as string[]);
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
