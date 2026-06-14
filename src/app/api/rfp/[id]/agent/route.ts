import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, listThreads, saveThread, kvConfigured } from "@/lib/rfp-store";
import { ProjectDetailsSchema, RFP_STATUSES, type ProjectDetails, type RfpSection } from "@/lib/rfp-types";
import {
  METHODOLOGY_VERSION,
  buildMethodology,
  questionForFeature,
  synthesiseSections,
} from "@/lib/rfp-methodology";
import { buildShortlist } from "@/lib/shortlist-core";
import { inviteSupplier } from "@/lib/rfp-connect";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";

export const runtime = "nodejs";
export const maxDuration = 120;
// Haiku: the agent does structured tool-use and short rationales; the heavy
// section synthesis is deterministic methodology code, so a fast model fits
// and roughly halves the round-trip time versus Sonnet.
const MODEL = "claude-haiku-4-5-20251001";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

function tools(): Anthropic.Tool[] {
  const cast = (s: object) => s as unknown as Anthropic.Tool.InputSchema;
  return [
    {
      name: "update_buyer_context",
      description: "Record or revise the buyer's business context (sector, site count, regions, compliance, operating model). Call this as soon as you learn a fact, before drafting questions.",
      input_schema: cast({
        type: "object",
        properties: {
          organisation: { type: "string" },
          sector: { type: "string", description: "One of the methodology sector keys, or null." },
          organisation_size: { type: "string", enum: ["large_global_enterprise", "mid_market", "small_business", "any"] },
          site_count: { type: "integer" },
          regions: { type: "array", items: { type: "string" } },
          compliance: { type: "array", items: { type: "string" }, description: "Methodology compliance keys, e.g. uk_gdpr, pci_dss, iec_62443." },
          operating_model: { type: "string", enum: ["managed", "co_managed", "diy", "any"] },
          notes: { type: "string" },
        },
      }),
    },
    {
      name: "regenerate_sections",
      description: "Rebuild all RFP sections from the current buyer context using the methodology. Use after major context changes. Preserves nothing custom, so prefer add_question for targeted edits.",
      input_schema: cast({ type: "object", properties: {} }),
    },
    {
      name: "add_question",
      description: "Add a methodology question to the RFP by feature id. Always supply a rationale citing the buyer requirement and the methodology version.",
      input_schema: cast({
        type: "object",
        properties: {
          feature_id: { type: "string", description: "A methodology feature id, e.g. f30_zero_trust_network_access." },
          priority: { type: "string", enum: ["required", "recommended", "optional"] },
          rationale: { type: "string" },
        },
        required: ["feature_id", "rationale"],
      }),
    },
    {
      name: "set_section_focus",
      description: "Increase or decrease emphasis on a category, for requests like 'make it more cloud-security focused'. Marks the category included and promotes its questions to required, or excludes it.",
      input_schema: cast({
        type: "object",
        properties: {
          category: { type: "string" },
          action: { type: "string", enum: ["emphasise", "include", "exclude"] },
        },
        required: ["category", "action"],
      }),
    },
    {
      name: "set_product_scope",
      description: "Set the product scope of the RFP. full_sase covers SD-WAN plus the cloud security stack; sse_only is security service edge without transport engineering; sdwan_only is networking without the SASE security layer; single_vendor_sase prefers one converged platform; best_of_breed pairs an SSE leader with a separate SD-WAN. Changing scope filters which methodology questions apply.",
      input_schema: cast({ type: "object", properties: { product_scope: { type: "string", enum: ["full_sase", "sse_only", "sdwan_only", "single_vendor_sase", "best_of_breed"] } }, required: ["product_scope"] }),
    },
    {
      name: "draft_custom_question",
      description: "Author a custom RFP question when the buyer wants something the standard methodology does not cover. Provide neutral question text, the evidence to request, the category it belongs in, and a rationale. Maps to the nearest feature id where one fits, otherwise marks it custom.",
      input_schema: cast({
        type: "object",
        properties: {
          text: { type: "string" },
          evidence_requested: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
          feature_id: { type: "string", description: "Nearest feature id, or empty string for genuinely custom." },
          rationale: { type: "string" },
          priority: { type: "string", enum: ["required", "recommended", "optional"] },
        },
        required: ["text", "evidence_requested", "category", "rationale"],
      }),
    },
    {
      name: "suggest_vendors",
      description: "Suggest best-fit vendors from the Netify marketplace for the current buyer context, using the live scoring engine. Returns ranked vendors with scores.",
      input_schema: cast({ type: "object", properties: { shortlist_size: { type: "integer", minimum: 3, maximum: 12 } } }),
    },
    {
      name: "engage_supplier",
      description: "Invite a graded vendor from the marketplace to engage with this RFP, with a short drafted intro message. Use after suggesting vendors when the buyer wants to connect with one. The supplier can then reply, share contact details or propose a demo.",
      input_schema: cast({
        type: "object",
        properties: {
          vendor_slug: { type: "string", description: "Marketplace vendor slug, e.g. cato-networks." },
          intro: { type: "string", description: "A short, specific opening message to the supplier referencing the buyer's needs." },
        },
        required: ["vendor_slug", "intro"],
      }),
    },
    {
      name: "set_status",
      description: "Advance the RFP lifecycle. Only move forward when the relevant work is complete (draft to review when sections are set, review to published when the buyer confirms).",
      input_schema: cast({ type: "object", properties: { status: { type: "string", enum: [...RFP_STATUSES] } }, required: ["status"] }),
    },
    {
      name: "answer_supplier_question",
      description: "Propose and record a buyer answer to an open supplier clarification thread.",
      input_schema: cast({
        type: "object",
        properties: { thread_id: { type: "string" }, answer: { type: "string" } },
        required: ["thread_id", "answer"],
      }),
    },
  ];
}

const CATEGORIES = buildMethodology().categories;

function systemPrompt(project: ProjectDetails, threadsSummary: string): string {
  return `You are the Netify RFP advisor, an agentic assistant that guides a buyer from a vague business need to a market-ready SASE and SD-WAN RFP, and helps manage supplier clarifications. You work on RFP "${project.title}" (id ${project.id}, status ${project.status}).

Operating rules:
1. Proactive discovery. Do not wait passively. If the buyer's context is missing critical pieces (sector, site count, regions, compliance, operating model), ask for them before drafting questions. Ask one or two sharp questions at a time, not a long form.
2. Methodology enforcement. Every question you add must map to the canonical SASE Methodology v${METHODOLOGY_VERSION}. Use feature ids. Never invent a question outside the framework.
3. Always cite. When you add or justify a question, state the reason and the methodology reference, for example: "Adding the TLS inspection question (f31_secure_web_gateway) because you flagged healthcare compliance, per SASE Methodology v${METHODOLOGY_VERSION}."
4. Dynamic state. You have full tool access to this RFP. When the buyer asks to change focus ("make it more cloud-security focused"), call set_section_focus or add_question directly rather than only describing the change.
5. Conversational flow. No submit buttons. When a section looks complete, offer the next step: "Security looks set. Shall we move to Commercials?"
6. Clarification loop. For supplier questions, categorise them and propose buyer answers via answer_supplier_question.

Methodology categories: ${CATEGORIES.join("; ")}.

Current buyer context: ${JSON.stringify(project.buyer)}.
Sections present: ${project.rfp_sections.map((s) => `${s.category} (${s.questions.filter((q) => q.priority !== "optional").length} active)`).join(", ") || "none yet"}.
${threadsSummary}

Efficiency. Work in as few steps as possible. When the buyer already gives enough context to build (sector, scope, region), do it in one move: call update_buyer_context and regenerate_sections together in the same turn, add any sector-specific questions in that same turn (batch multiple add_question calls at once rather than one per turn), then give the closing narrative. Do not spread the work across many turns.

Keep replies concise and in UK English. Never use em or en dashes; use commas or full stops. No marketing filler. After using tools, tell the buyer what you changed and why, then offer the next step.`;
}

export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "AI advisor not configured (missing API key)." }, { status: 503, headers: cors });
  }
  if (!kvConfigured()) {
    return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  }
  const { id } = await ctx.params;
  let project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { messages?: { role: "user" | "assistant"; content: string }[]; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }

  const history: Anthropic.MessageParam[] = (body.messages ?? [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (history.length === 0 && body.prompt) history.push({ role: "user", content: body.prompt.slice(0, 4000) });
  if (history.length === 0) return Response.json({ error: "No message." }, { status: 400, headers: cors });

  const threads = await listThreads(id);
  const openThreads = threads.filter((t) => t.status === "open");
  const threadsSummary = openThreads.length
    ? `Open supplier questions: ${openThreads.map((t) => `[${t.id}] ${t.vendor} (${t.category}): ${t.question}`).join(" | ")}.`
    : "No open supplier questions.";

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...history];
  let narrative = "";
  let dirty = false;

  try {
    for (let turn = 0; turn < 5; turn++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(project, threadsSummary),
        tools: tools(),
        messages,
      });
      const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join(" ").trim();
      if (text) narrative = text;
      const toolUses = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      if (toolUses.length === 0) break;

      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];

      for (const tu of toolUses) {
        let out: unknown = { ok: true };
        const input = tu.input as Record<string, unknown>;
        try {
          if (tu.name === "update_buyer_context") {
            project = { ...project, buyer: { ...project.buyer, ...cleanContext(input) } };
            dirty = true;
            out = { ok: true, buyer: project.buyer };
          } else if (tu.name === "regenerate_sections") {
            project = { ...project, rfp_sections: synthesiseSections(project.buyer) };
            dirty = true;
            out = { ok: true, sections: project.rfp_sections.map((s) => s.category) };
          } else if (tu.name === "add_question") {
            const fid = String(input.feature_id);
            const mq = questionForFeature(fid);
            if (!mq) { out = { ok: false, error: `Unknown feature ${fid}` }; }
            else {
              project = addQuestion(project, fid, String(input.rationale ?? ""), (input.priority as string) ?? "recommended", mq);
              dirty = true;
              out = { ok: true, added: fid, category: mq.category };
            }
          } else if (tu.name === "set_section_focus") {
            project = setFocus(project, String(input.category), String(input.action));
            dirty = true;
            out = { ok: true };
          } else if (tu.name === "set_product_scope") {
            const sc = String(input.product_scope);
            project = { ...project, buyer: { ...project.buyer, product_scope: sc as typeof project.buyer.product_scope }, rfp_sections: synthesiseSections({ ...project.buyer, product_scope: sc as typeof project.buyer.product_scope }) };
            dirty = true;
            out = { ok: true, product_scope: sc, sections: project.rfp_sections.map((s) => s.category) };
          } else if (tu.name === "draft_custom_question") {
            const cat = String(input.category);
            const fid = String(input.feature_id ?? "").trim();
            const pr = (["required", "recommended", "optional"].includes(String(input.priority)) ? String(input.priority) : "recommended") as "required" | "recommended" | "optional";
            const sections: RfpSection[] = project.rfp_sections.length ? [...project.rfp_sections] : synthesiseSections(project.buyer);
            let sec = sections.find((s) => s.category === cat);
            if (!sec) { sec = { category: cat, included: true, questions: [] }; sections.push(sec); }
            sec.included = true;
            sec.questions.push({
              id: fid ? `q_${fid}` : `q_custom_${Date.now().toString(36)}`,
              feature_id: fid || "custom",
              text: String(input.text), evidence_requested: String(input.evidence_requested ?? ""),
              rationale: String(input.rationale ?? ""), priority: pr,
              source: fid ? "methodology" : "custom", buyer_lens: "", supplier_lens: "", mandatory: pr === "required", weight: pr === "required" ? 4 : 3,
            });
            project = { ...project, rfp_sections: sections };
            dirty = true;
            out = { ok: true, added_custom: true, category: cat };
          } else if (tu.name === "suggest_vendors") {
            const size = Number(input.shortlist_size ?? 6);
            const result = buildShortlist(getShortlistDataset(), {
              sector: project.buyer.sector ?? null,
              organisation_size: project.buyer.organisation_size ?? "any",
              service_model: project.buyer.operating_model ?? "any",
              required_regions: project.buyer.regions ?? [],
              shortlist_size: size,
            }, FEATURE_NAMES);
            out = { ok: true, shortlist: result.shortlist.map((v) => `${v.rank}. ${v.name} (${v.score})`), criteria: result.criteria_summary };
          } else if (tu.name === "engage_supplier") {
            const r = await inviteSupplier(project.id, String(input.vendor_slug), String(input.intro ?? ""));
            out = "error" in r ? { ok: false, error: r.error } : { ok: true, invited: r.vendor_name, status: r.status };
          } else if (tu.name === "set_status") {
            const st = String(input.status);
            if ((RFP_STATUSES as readonly string[]).includes(st)) {
              project = { ...project, status: st as ProjectDetails["status"] };
              dirty = true;
              out = { ok: true, status: st };
            } else out = { ok: false };
          } else if (tu.name === "answer_supplier_question") {
            const t = threads.find((x) => x.id === String(input.thread_id));
            if (t) {
              await saveThread({ ...t, buyer_answer: String(input.answer ?? ""), status: "answered", answered: Date.now() });
              out = { ok: true };
            } else out = { ok: false, error: "thread not found" };
          }
        } catch (e) {
          out = { ok: false, error: e instanceof Error ? e.message : "tool error" };
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
      }
      messages.push({ role: "user", content: results });
    }

    if (dirty) {
      const parsed = ProjectDetailsSchema.safeParse(project);
      if (parsed.success) project = await saveProject(parsed.data);
    }

    return Response.json({ narrative, project }, { headers: cors });
  } catch (err) {
    console.error("rfp agent error:", err);
    return Response.json({ error: "Advisor request failed." }, { status: 502, headers: cors });
  }
}

function cleanContext(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["organisation", "sector", "organisation_size", "site_count", "regions", "compliance", "operating_model", "notes"]) {
    if (input[k] !== undefined) out[k] = input[k];
  }
  return out;
}

function addQuestion(project: ProjectDetails, fid: string, rationale: string, priority: string, mq: NonNullable<ReturnType<typeof questionForFeature>>): ProjectDetails {
  const sections = project.rfp_sections.length ? [...project.rfp_sections] : synthesiseSections(project.buyer);
  let sec = sections.find((s) => s.category === mq.category);
  if (!sec) { sec = { category: mq.category, included: true, questions: [] }; sections.push(sec); }
  sec.included = true;
  const qid = `q_${fid}`;
  const pr = (["required", "recommended", "optional"].includes(priority) ? priority : "recommended") as "required" | "recommended" | "optional";
  const existing = sec.questions.find((q) => q.id === qid);
  if (existing) {
    existing.priority = pr;
    existing.rationale = rationale || existing.rationale;
  } else {
    sec.questions.push({ id: qid, feature_id: fid, text: mq.rfp_question, evidence_requested: mq.evidence_requested, rationale, priority: pr, source: "methodology", buyer_lens: "", supplier_lens: "", mandatory: pr === "required", weight: pr === "required" ? 4 : 3 });
  }
  return { ...project, rfp_sections: sections };
}

function setFocus(project: ProjectDetails, category: string, action: string): ProjectDetails {
  const sections = project.rfp_sections.map((s) => {
    if (s.category.toLowerCase() !== category.toLowerCase()) return s;
    if (action === "exclude") return { ...s, included: false };
    const questions = action === "emphasise"
      ? s.questions.map((q) => ({ ...q, priority: q.priority === "optional" ? ("recommended" as const) : q.priority }))
      : s.questions;
    return { ...s, included: true, questions };
  });
  return { ...project, rfp_sections: sections };
}
