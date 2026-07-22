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
import { assessSecurityRequirement, RULEBOOK_VERSION } from "@/lib/security/rulebook";
import type { SecurityRequirementInput, SecurityScopeVerdict } from "@/lib/security/rulebook";
import { SITE_URL } from "@/lib/structured-data";

const CYCLE_DEFINITION = {
  name: "workspace_cycle",
  description:
    `Netify Live Sourcing Workspace: run one drafting cycle over a buyer's free-text requirement, exactly as the page at ${SITE_URL}/workspace/ runs it. Input the buyer's words (and the requirement built so far, to iterate); output the validated field updates each carrying provenance (stated with the buyer's verbatim quote, or inferred with the inference named), the merged requirement in the exact shape assess_security_requirement takes, the ${RULEBOOK_VERSION} verdict when the scope is security, the evidence-graded supplier fit (real evaluation dates from the Netify dataset; for managed-security scope the dataset boundary is stated instead of an invented MSSP ranking), and the assembled statement of requirements as text with provenance marked. Read and compute only; nothing is stored and no supplier is contacted. Iterate by passing the returned requirement back with the buyer's next words; corrections are new cycles. To proceed: create_security_project (consented) for security scope, or send the buyer to ${SITE_URL}/workspace/?q={their sentence} to take over the same draft on the page. Every claim carries provenance; relay inferred and assumed markers to the buyer rather than presenting them as their own words.`,
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
      include_fit: { type: "boolean", description: "Set false to skip the supplier fit block. Default true." },
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
      brief: { type: "string" },
      workspace_url: { type: "string" },
      notes: { type: "array", items: { type: "string" } },
    },
    required: ["rulebook_version", "engine", "updates", "requirement", "brief", "workspace_url"],
  },
} as const;

export const WORKSPACE_TOOL_DEFINITIONS = [CYCLE_DEFINITION] as const;

export const WORKSPACE_TOOL_NAMES = new Set<string>(WORKSPACE_TOOL_DEFINITIONS.map((t) => t.name));

const lastValue = (updates: FieldUpdate[], path: string): string | undefined => {
  const xs = updates.filter((u) => u.path === path);
  return xs.length ? String(xs[xs.length - 1].value) : undefined;
};

export async function callWorkspaceTool(name: string, args: Record<string, unknown>): Promise<unknown> {
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
  const fit = includeFit
    ? workspaceFit({
        buying: fitBuying,
        regions: result.requirement.organisation?.regions ?? [],
        model: operatingModel ?? "any",
        // P3.3 parity: the agent's requirement drives the same named checks
        // the page drives, so both read identical evidence (Article 17).
        clouds: result.requirement.estate?.cloud ?? [],
        mplsEstate: (result.requirement.estate?.existingNetwork ?? []).includes("mpls"),
      })
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
    ...(fit ? { fit: { scope: fitBuying, ...fit, directory: undefined } } : {}),
    brief,
    workspace_url: `${SITE_URL}/workspace/?q=${encodeURIComponent(text.slice(0, 400))}`,
    notes: result.notes,
  };
}
