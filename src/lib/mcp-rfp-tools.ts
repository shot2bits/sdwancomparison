/**
 * Agent-to-agent RFP tools for the MCP server. These let a supplier's AI
 * agent fetch a published RFP and submit responses, and let any agent check
 * an RFP's status, all over JSON-RPC. Token-gated and KV-backed (async).
 * This is the agentic procurement infrastructure piece: the RFP becomes a
 * machine-callable object, not just a web form.
 */

import { getProjectByToken, getProject, listResponses, saveResponse, newId, kvConfigured } from "@/lib/rfp-store";
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
  if (!kvConfigured()) return { error: "RFP storage not configured." };
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
