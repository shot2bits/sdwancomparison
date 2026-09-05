/**
 * MCP tool for the Live Sourcing Workspace (W0 slice 4, spec v1.3
 * section 4: "the same cycle is the MCP contract"). One verb,
 * workspace_cycle, running the identical loop the page runs per pause:
 * extract (model-first with the deterministic rail and proven
 * provenance), assess (SEC-RULES for security scope), compose (the
 * living brief as text) and recommend (evidence-graded fit). An agent
 * iterating this cycle and then calling create_security_project reaches
 * the identical published state a person reaches on the page (Mandate
 * parity; the W0 acceptance criterion).
 */

import { extractRequirement } from "@/lib/workspace/extract";
import type { BuyingId, FieldUpdate, OperatingModelId } from "@/lib/workspace/extract";
import { briefModel, briefText, mergeUpdates, type WorkspaceFact } from "@/lib/workspace/draft";
import { workspaceFit } from "@/lib/workspace/fit";
import { earnedQuestions } from "@/lib/workspace/questions";
import { assessSecurityRequirement, RULEBOOK_VERSION } from "@/lib/security/rulebook";
import type { SecurityRequirementInput, SecurityScopeVerdict } from "@/lib/security/rulebook";
import { SITE_URL } from "@/lib/structured-data";
import { chunkForIngest } from "@/lib/workspace/ingest";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";

const CYCLE_DEFINITION = {
  name: "workspace_cycle",
  description:
    `Netify Live Sourcing Workspace: run one drafting cycle over a buyer's free-text requirement, exactly as the page at ${SITE_URL}/workspace/ runs it. Input the buyer's words (and the requirement built so far, to iterate); output the validated field updates each carrying provenance (stated with the buyer's verbatim quote, or inferred with the inference named), the merged requirement in the exact shape assess_security_requirement takes, the ${RULEBOOK_VERSION} verdict when the scope is security, the aggregate market context (personalised provider identities unlock after publication) (real evaluation dates from the Netify dataset; for managed-security scope the dataset boundary is stated instead of an invented MSSP ranking), and the assembled statement of requirements as text with provenance marked. Read and compute only; nothing is stored and no vendor is contacted. Iterate by passing the returned requirement back with the buyer's next words; corrections are new cycles. To proceed: create_security_project (consented) for security scope, or send the buyer to ${SITE_URL}/workspace/?q={their sentence} to take over the same draft on the page. Every claim carries provenance; relay inferred and assumed markers to the buyer rather than presenting them as their own words.`,
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The buyer's words this turn: a first sentence or a correction." },
      requirement: {
        type: "object",
        description: "The requirement built so far (the previous cycle's merged requirement); omit on the first turn.",
      },
      procurement: {
        type: "object",
        description: "Carried workspace context from earlier cycles (what is being BOUGHT, distinct from the estate).",
        properties: {
          buying: { type: "string", enum: ["managed_security", "sase", "sdwan", "sse"] },
          operatingModel: { type: "string", enum: ["managed", "co_managed", "diy"] },
        },
      },
      include_fit: { type: "boolean", description: "Set false to skip the vendor fit block. Default true." },
    },
    required: ["text"],
  },
  outputSchema: {
    type: "object",
    properties: {
      rulebook_version: { type: "string" },
      engine: { type: "string", enum: ["model", "deterministic_fallback"] },
      updates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            value: {},
            provenance: { type: "string", enum: ["stated", "inferred"] },
            quote: { type: "string" },
            reason: { type: "string" },
          },
          required: ["path", "provenance"],
        },
      },
      requirement: { type: "object" },
      procurement: {
        type: "object",
        properties: { buying: { type: "string" }, operatingModel: { type: "string" } },
      },
      verdict: { type: "object" },
      fit: { type: "object" },
      earned_questions: {
        type: "array",
        description:
          "Follow-up questions the desk would ask, each EARNED by a fact in this requirement (the earned-question law: no trigger, no question) and carrying the AI-search evidence that earned its place. Relay them to the buyer.",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            question: { type: "string" },
            section: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            evidence: { type: "array" },
          },
        },
      },
      brief: { type: "string" },
      workspace_url: { type: "string" },
      notes: { type: "array", items: { type: "string" } },
    },
    required: ["rulebook_version", "engine", "updates", "requirement", "brief", "workspace_url"],
  },
} as const;

const INGEST_DEFINITION = {
  name: "workspace_ingest",
  description:
    `Netify Live Sourcing Workspace: read a WHOLE document or conversation into a requirement in one call, where workspace_cycle takes a sentence. Paste the buyer's existing material verbatim: a ChatGPT, Perplexity, Gemini or Claude conversation, an existing SASE or SD-WAN RFP, SSE requirements, meeting notes or an email thread (plain text, up to 14,000 characters; longer material is read to the budget and the summary says so honestly). The text is cut on paragraph boundaries and run through the IDENTICAL extraction cycles the page runs, so every claim lands with provenance (stated with the buyer's verbatim quote, or inferred with the inference named), the same validation and magnitude guards apply, and clauses the engine cannot place are reported rather than dropped. Output: the merged requirement, all provenance-marked updates, the ${RULEBOOK_VERSION} verdict for security scope, aggregate market context (personalised provider identities unlock after publication), the earned follow-up questions to relay, the assembled statement of requirements, and a read_summary to show the buyer. Read and compute only; nothing is stored and no vendor is contacted. Continue with workspace_cycle for corrections, or hand the buyer the workspace_url; a human always signs before anything publishes.`,
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The buyer's material, verbatim: a conversation export, document text, notes or a thread. Plain text." },
      requirement: { type: "object", description: "A requirement built in earlier cycles to merge into; omit to start fresh." },
      procurement: {
        type: "object",
        description: "Carried workspace context from earlier cycles.",
        properties: {
          buying: { type: "string", enum: ["managed_security", "sase", "sdwan", "sse"] },
          operatingModel: { type: "string", enum: ["managed", "co_managed", "diy"] },
        },
      },
      include_fit: { type: "boolean", description: "Set false to skip the vendor fit block. Default true." },
    },
    required: ["text"],
  },
  outputSchema: {
    ...CYCLE_DEFINITION.outputSchema,
    properties: {
      ...CYCLE_DEFINITION.outputSchema.properties,
      read_summary: { type: "string", description: "The honest read line to relay: what landed, what the Notes kept, whether the budget truncated the read." },
      cycles: { type: "number" },
    },
  },
} as const;

export const WORKSPACE_TOOL_DEFINITIONS = [CYCLE_DEFINITION, INGEST_DEFINITION] as const;

export const WORKSPACE_TOOL_NAMES = new Set<string>(WORKSPACE_TOOL_DEFINITIONS.map((t) => t.name));

const lastValue = (updates: FieldUpdate[], path: string): string | undefined => {
  const xs = updates.filter((u) => u.path === path);
  return xs.length ? String(xs[xs.length - 1].value) : undefined;
};

export async function callWorkspaceTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "workspace_ingest") return callWorkspaceIngest(args);
  if (name !== "workspace_cycle") return { error: `Unknown workspace tool: ${name}` };
  const text = String(args?.text ?? "").slice(0, 4000);
  if (text.trim().length < 3) {
    return { error: "text is required: the buyer's words, a sentence or a correction." };
  }
  const base = (args?.requirement && typeof args.requirement === "object" ? args.requirement : {}) as SecurityRequirementInput;
  const carried = (args?.procurement && typeof args.procurement === "object" ? args.procurement : {}) as {
    buying?: BuyingId;
    operatingModel?: OperatingModelId;
  };

  const result = await extractRequirement(text, base);

  const buying = (lastValue(result.updates, "procurement.buying") as BuyingId | undefined) ?? carried.buying ?? null;
  const operatingModel =
    (lastValue(result.updates, "procurement.operatingModel") as OperatingModelId | undefined) ?? carried.operatingModel ?? null;
  const securityScope = buying === "managed_security" || buying === null;

  const verdict: SecurityScopeVerdict | null = securityScope ? await assessSecurityRequirement(result.requirement) : null;

  // Compose the same brief the page shows: a fresh fact ledger from this
  // cycle's updates plus the carried procurement context.
  const carryUpdates: FieldUpdate[] = [];
  if (carried.buying && !lastValue(result.updates, "procurement.buying")) {
    carryUpdates.push({ path: "procurement.buying", value: carried.buying, provenance: "stated", quote: "carried from your earlier turn" });
  }
  if (carried.operatingModel && !lastValue(result.updates, "procurement.operatingModel")) {
    carryUpdates.push({ path: "procurement.operatingModel", value: carried.operatingModel, provenance: "stated", quote: "carried from your earlier turn" });
  }
  const facts: WorkspaceFact[] = mergeUpdates([], [...result.updates, ...carryUpdates], 1, "extract").facts;
  const brief = briefText(briefModel({ facts, verdict }));

  const includeFit = args?.include_fit !== false;
  const sseSignal = Boolean(
    verdict?.capabilities.some((c) => c.id === "sse" && (c.needed === "required" || c.needed === "recommended")) ||
      verdict?.pathRecommendation === "escalate_sase",
  );
  const fitBuying = buying && buying !== "managed_security" ? buying : sseSignal ? "sse" : "managed_security";
  const live = includeFit ? await getLiveShortlistDataset() : null;
  const fit = includeFit
    ? workspaceFit({
        buying: fitBuying,
        regions: result.requirement.organisation?.regions ?? [],
        model: operatingModel ?? "any",
        // P3.3 parity: the agent's requirement drives the same named checks
        // the page drives, so both read identical evidence (Article 17).
        clouds: result.requirement.estate?.cloud ?? [],
        mplsEstate: (result.requirement.estate?.existingNetwork ?? []).includes("mpls"),
      }, live!.vendors)
    : undefined;

  return {
    rulebook_version: RULEBOOK_VERSION,
    engine: result.engine,
    ...(result.model ? { model: result.model } : {}),
    updates: result.updates,
    requirement: result.requirement,
    procurement: { ...(buying ? { buying } : {}), ...(operatingModel ? { operatingModel } : {}) },
    ...(verdict ? { verdict } : {}),
    // scope names WHICH ranking this is (an SSE list can honestly serve a
    // security requirement whose verdict includes SSE; it is never an MSSP
    // ranking in disguise).
    ...(fit ? { fit: { scope: fitBuying, runtime_provider_source: live!.source, provider_contract_version: live!.providerContractVersion, ...fit, suppliers: undefined, count: undefined, directory: undefined, requires_publication: true } } : {}),
    // P3.4 parity (one truth, three doors): the same earned follow-up
    // questions the desk asks, each summoned by the buyer's own facts and
    // carrying the AI-search evidence that earned its place. Relay them;
    // never invent questions of your own where these stand.
    earned_questions: earnedQuestions(result.requirement, buying, operatingModel ?? null, [], []).map((q) => ({
      id: q.id,
      question: q.question,
      section: q.section,
      options: q.options.map((o) => o.label),
      evidence: q.evidence,
    })),
    brief,
    workspace_url: `https://netify.co.uk/sase-sd-wan-rfp-builder/?q=${encodeURIComponent(text.slice(0, 400))}`,
    notes: result.notes,
  };
}

/** The Threshold's agent door (25 Jul): the same cycles, one call. Chunks
 *  run sequentially, each threading the merged requirement into the next,
 *  so a document reads exactly as a patient buyer typing it would. */
async function callWorkspaceIngest(args: Record<string, unknown>): Promise<unknown> {
  const raw = String(args?.text ?? "").slice(0, 14000);
  if (raw.trim().length < 20) {
    return { error: "text is required: the buyer's material, at least a few sentences." };
  }
  const plan = chunkForIngest(raw, { chunkMax: 3500, maxChunks: 4 });
  const carried = (args?.procurement && typeof args.procurement === "object" ? args.procurement : {}) as {
    buying?: BuyingId;
    operatingModel?: OperatingModelId;
  };

  let requirement = (args?.requirement && typeof args.requirement === "object" ? args.requirement : {}) as SecurityRequirementInput;
  const allUpdates: FieldUpdate[] = [];
  const allNotes: string[] = [];
  let engine = "deterministic_fallback";
  for (const chunk of plan.chunks) {
    const r = await extractRequirement(chunk, requirement);
    requirement = r.requirement;
    allUpdates.push(...r.updates);
    allNotes.push(...r.notes);
    if (r.engine === "model") engine = "model";
  }

  const buying = (lastValue(allUpdates, "procurement.buying") as BuyingId | undefined) ?? carried.buying ?? null;
  const operatingModel =
    (lastValue(allUpdates, "procurement.operatingModel") as OperatingModelId | undefined) ?? carried.operatingModel ?? null;
  const securityScope = buying === "managed_security" || buying === null;
  const verdict: SecurityScopeVerdict | null = securityScope ? await assessSecurityRequirement(requirement) : null;

  const facts: WorkspaceFact[] = mergeUpdates([], allUpdates, 1, "extract").facts;
  const brief = briefText(briefModel({ facts, verdict }));

  const includeFit = args?.include_fit !== false;
  const sseSignal = Boolean(
    verdict?.capabilities.some((c) => c.id === "sse" && (c.needed === "required" || c.needed === "recommended")) ||
      verdict?.pathRecommendation === "escalate_sase",
  );
  const fitBuying = buying && buying !== "managed_security" ? buying : sseSignal ? "sse" : "managed_security";
  const live = includeFit ? await getLiveShortlistDataset() : null;
  const fit = includeFit
    ? workspaceFit({
        buying: fitBuying,
        regions: requirement.organisation?.regions ?? [],
        model: operatingModel ?? "any",
        clouds: requirement.estate?.cloud ?? [],
        mplsEstate: (requirement.estate?.existingNetwork ?? []).includes("mpls"),
      }, live!.vendors)
    : undefined;

  /* The receipts idea, stated for the agent: which of its material landed
   * nowhere. The page keeps clauses verbatim; here the count plus the
   * engine notes carry the same honesty in one line. */
  const landed = allUpdates.length;
  const unplacedNotes = allNotes.filter((n) => /Dropped|kept verbatim|no home/i.test(n)).length;
  const read_summary = `Read ${plan.readChars.toLocaleString("en-GB")} characters in ${plan.chunks.length} cycle${plan.chunks.length === 1 ? "" : "s"}: ${landed} provenance-marked update${landed === 1 ? "" : "s"}${unplacedNotes ? `, ${unplacedNotes} engine note${unplacedNotes === 1 ? "" : "s"} on material that could not land` : ""}${plan.truncated ? `. The text exceeded the read budget (${plan.totalChars.toLocaleString("en-GB")} characters); send the remainder in a second call` : ""}. Relay inferred markers honestly; a human signs before anything publishes.`;

  return {
    rulebook_version: RULEBOOK_VERSION,
    engine,
    cycles: plan.chunks.length,
    updates: allUpdates,
    requirement,
    procurement: { ...(buying ? { buying } : {}), ...(operatingModel ? { operatingModel } : {}) },
    ...(verdict ? { verdict } : {}),
    ...(fit ? { fit: { scope: fitBuying, runtime_provider_source: live!.source, provider_contract_version: live!.providerContractVersion, ...fit, suppliers: undefined, count: undefined, directory: undefined, requires_publication: true } } : {}),
    earned_questions: earnedQuestions(requirement, buying, operatingModel ?? null, [], [], raw).map((q) => ({
      id: q.id,
      question: q.question,
      section: q.section,
      options: q.options.map((o) => o.label),
      evidence: q.evidence,
    })),
    brief,
    read_summary,
    workspace_url: `https://netify.co.uk/sase-sd-wan-rfp-builder/`,
    notes: allNotes,
  };
}
