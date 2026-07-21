/**
 * MCP tools for Netify Security Sourcing (Phase A, 21 July 2026).
 * One tool: assess_security_requirement, the Notary read. The page advisor
 * (Phase B) and this tool call the same assessSecurityRequirement function,
 * so page and agent can never disagree; the verdict's inputDigest makes
 * that provable. Rulebook approved by Robert Sturt, 21 July 2026, with
 * amendments (MDR-1 split, semantic SASE escalation, the summary block).
 */

import { assessSecurityRequirement, RULEBOOK_VERSION } from "@/lib/security/rulebook";
import type { SecurityRequirementInput, SecurityScopeVerdict } from "@/lib/security/rulebook";
import { createSecurityProject } from "@/lib/security/persist-project";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { generateRfpSections } from "@/lib/security/generate-rfp";
import { getProject, saveProject } from "@/lib/rfp-store";
import { projectPhase, advanceProject, recordProjectEvent, openSecurityGaps } from "@/lib/project-machine";
import type { ProjectDetails, ProjectHistoryEvent } from "@/lib/rfp-types";
import { SITE_URL } from "@/lib/structured-data";

export const MCP_SECURITY_TOOL_DEFINITIONS = [
  {
    name: "assess_security_requirement",
    description:
      `Netify Security Sourcing: assess a business security requirement under the ${RULEBOOK_VERSION} rulebook and return an accountable scoping verdict. Assess your security requirement, create the right RFP and obtain responses from matched providers: this tool is the first step. Input the estate (users, sites, devices, cloud, existing security and network), the drivers (incident, audit, compliance, renewal, growth, consolidation, ransomware_concern) and constraints (compliance regimes, in-house SOC capacity: none, business_hours or twenty_four_seven). All fields optional: missing information becomes labelled gaps with the exact questions to ask, never guesses; with too little context the verdict honestly returns cannot_assess. Output: per-capability verdicts (endpoint, MDR/SOC, SSE, SIEM, managed firewall, awareness, email security, backup) each with reasoning, evidence and the fired rules; a summary block stating what is recommended, what is conditional and WHY things were NOT recommended; structured againstInterest entries where the rules route away from BT or Netify-monetised options (RELAY THESE TO THE USER VERBATIM; they are the point); service model, path recommendation (product, service, hybrid, or escalation to the SASE RFP when the requirement has become a network-plus-security transformation) and next steps. Read and compute only; no side effects; identical input provably returns the identical verdict (inputDigest). Netify recommends only what it can evaluate: two categories are declined by policy when they arise.`,
    inputSchema: {
      type: "object",
      properties: {
        organisation: {
          type: "object",
          properties: {
            sector: { type: "string" },
            sizeBand: { type: "string", enum: ["small", "medium", "large"] },
            regions: { type: "array", items: { type: "string" } },
          },
        },
        estate: {
          type: "object",
          properties: {
            users: { type: "integer", minimum: 1 },
            sites: { type: "integer", minimum: 0 },
            devices: {
              type: "object",
              properties: {
                computers: { type: "integer", minimum: 0 },
                mobiles: { type: "integer", minimum: 0 },
                servers: { type: "integer", minimum: 0 },
              },
            },
            specialDevices: { type: "array", items: { type: "string", enum: ["chromebook", "epos"] } },
            cloud: { type: "array", items: { type: "string" }, description: "e.g. m365, google, aws" },
            existingSecurity: { type: "array", items: { type: "string" }, description: "Declared controls, e.g. Defender P2, CrowdStrike, MSP-managed. Declare an empty array to state none." },
            existingNetwork: { type: "array", items: { type: "string" }, description: "e.g. btnet, bt_broadband, mpls, sdwan" },
          },
        },
        drivers: {
          type: "array",
          items: { type: "string", enum: ["incident", "audit", "compliance", "renewal", "growth", "consolidation", "ransomware_concern"] },
        },
        constraints: {
          type: "object",
          properties: {
            complianceRequirements: { type: "array", items: { type: "string" }, description: "e.g. iso27001, pci_dss, cyber_essentials_plus, fca, nhs_dspt" },
            inHouseSocCapacity: { type: "string", enum: ["none", "business_hours", "twenty_four_seven"] },
            budgetBand: { type: "string" },
            timeline: { type: "string" },
          },
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["rulebookVersion", "generatedAt", "inputDigest", "capabilities", "againstInterest", "assumptions", "gaps", "summary", "confidence"],
      properties: {
        rulebookVersion: { type: "string" },
        generatedAt: { type: "string" },
        inputDigest: { type: "string", description: "sha256 of the canonicalised input: identical input yields the identical verdict" },
        capabilities: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "needed", "reasoning", "route", "firedRules"],
            properties: {
              id: { type: "string" },
              needed: { type: "string", enum: ["required", "recommended", "not_indicated", "cannot_assess"] },
              reasoning: { type: "string" },
              evidence: { type: "array" },
              route: { type: ["string", "null"], enum: ["bt_product", "marketplace_service", "other_bt", "either", "out_of_scope", "escalate_sase", null] },
              routeDetail: { type: "string" },
              firedRules: { type: "array", items: { type: "string" } },
            },
          },
        },
        serviceModel: { type: ["string", "null"], enum: ["fully_managed", "co_managed", "product_only", null] },
        pathRecommendation: { type: ["string", "null"], enum: ["product_path", "service_path", "hybrid", "escalate_sase", null] },
        againstInterest: {
          type: "array",
          description: "Structured entries where the rules route away from Netify-monetised options; relay to the user verbatim",
          items: {
            type: "object",
            required: ["capabilityId", "routeDenied", "statement"],
            properties: {
              capabilityId: { type: "string" },
              routeDenied: { type: "string", enum: ["bt_product", "marketplace_service"] },
              statement: { type: "string" },
              evidence: { type: "string" },
            },
          },
        },
        assumptions: { type: "array", items: { type: "string" } },
        gaps: {
          type: "array",
          items: { type: "object", required: ["field", "question"], properties: { field: { type: "string" }, whyItMatters: { type: "string" }, question: { type: "string" } } },
        },
        summary: {
          type: "object",
          required: ["recommended", "conditional", "not_recommended"],
          properties: {
            recommended: { type: "array", items: { type: "string" } },
            conditional: { type: "array", items: { type: "string" } },
            not_recommended: {
              type: "array",
              items: { type: "object", required: ["capabilityId", "reason"], properties: { capabilityId: { type: "string" }, reason: { type: "string" }, alternative: { type: "string" } } },
            },
          },
        },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        nextSteps: { type: "array", items: { type: "object", properties: { action: { type: "string" }, tool: { type: "string" }, page: { type: "string" } } } },
      },
    },
  },
] as const;

const CREATE_PROJECT_DEFINITION = {
  name: "create_security_project",
  description:
    `Create a Netify Security Sourcing Project from a requirement: runs the ${RULEBOOK_VERSION} assessment server-side, attaches the verdict as the project's first immutable artefact, GENERATES THE RFP DOCUMENT from that verdict (question bank sections for required and recommended capabilities, plus a scoping-and-exclusions record carrying the against-interest statements and provenance), and returns the project with its builder link: the buyer lands in the existing RFP Builder with the document already populated. CONSENT REQUIRED: only call with the buyer's explicit agreement in this conversation; pass consent: true to confirm, and show the buyer the recorded consent wording (returned as consent_text). Creates an anonymous draft claimable when the buyer signs in; no emails are sent and no supplier is contacted until the buyer publishes. The returned manage_token is the creator's credential: hand it to the buyer with the builder link. TEST MODE for integration developers: pass test: true for a two-hour self-expiring project with no side effects.`,
  inputSchema: {
    type: "object",
    properties: {
      requirement: { type: "object", description: "The same shape assess_security_requirement takes: organisation, estate, drivers, constraints." },
      consent: { type: "boolean", description: "Must be true: the buyer's explicit agreement to create the project." },
      test: { type: "boolean", description: "Integration testing: self-expires in two hours, no side effects." },
    },
    required: ["requirement", "consent"],
  },
  outputSchema: {
    type: "object",
    required: ["created", "project_id", "phase", "builder_url", "verdict"],
    properties: {
      created: { type: "boolean" },
      project_id: { type: "string" },
      phase: { type: "string" },
      builder_url: { type: "string" },
      manage_token: { type: "string", description: "Creator credential; give it to the buyer with the link." },
      verdict: { type: "object", description: "The attached SecurityScopeVerdict, verbatim." },
      consent_text: { type: "string", description: "The consent wording recorded verbatim on the project." },
      test: { type: "boolean" },
      note: { type: "string" },
    },
  },
} as const;

const GET_STATUS_DEFINITION = {
  name: "get_security_project_status",
  description:
    "Read a Security Sourcing Project's status: phase, title, history length, latest verdict summary and next steps. Owner-gated: requires the project id AND its manage_token (the creator credential returned at creation). Read only.",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { type: "string" },
      manage_token: { type: "string" },
    },
    required: ["project_id", "manage_token"],
  },
  outputSchema: {
    type: "object",
    required: ["found"],
    properties: {
      found: { type: "boolean" },
      phase: { type: "string" },
      status: { type: "string" },
      title: { type: "string" },
      history_length: { type: "number" },
      verdict_version: { type: "number" },
      artefact_version: { type: "number", description: "Latest generated document version" },
      confidence: { type: "string" },
      summary: { type: "object" },
      open_gaps: { type: "number", description: "Scoping gaps still to answer or accept before publication" },
      builder_url: { type: "string" },
      test: { type: "boolean" },
    },
  },
} as const;

const GENERATE_RFP_DEFINITION = {
  name: "generate_security_rfp",
  description:
    "Regenerate a Security Sourcing project's RFP document from its latest stored verdict. The document is generated automatically at creation, so this tool is only needed after a re-scope (a new verdict attached to the project) or to restore the generated baseline. Deterministic: the same verdict always produces the same document, saved as artefact version n+1 with the previous versions kept recoverable. PROTECTS BUYER EDITS: if the document has been edited since the last generation this tool refuses unless force: true is passed with the buyer's explicit agreement in this conversation (their edits would be replaced; earlier versions remain in the project record). Owner-gated: requires project_id and manage_token.",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { type: "string" },
      manage_token: { type: "string" },
      force: { type: "boolean", description: "Replace buyer edits with a fresh generation. Only with the buyer's explicit agreement in this conversation." },
    },
    required: ["project_id", "manage_token"],
  },
  outputSchema: {
    type: "object",
    required: ["generated"],
    properties: {
      generated: { type: "boolean" },
      project_id: { type: "string" },
      artefact_version: { type: "number" },
      phase: { type: "string" },
      sections: { type: "number" },
      questions: { type: "number", description: "Answerable questions (informational items are not counted, weighted or scored)" },
      informational_items: { type: "number" },
      open_gaps: { type: "number", description: "Gaps that must be answered or individually accepted before publication" },
      builder_url: { type: "string" },
      note: { type: "string" },
    },
  },
} as const;

export const SECURITY_TOOL_DEFINITIONS_ALL = [
  ...MCP_SECURITY_TOOL_DEFINITIONS,
  CREATE_PROJECT_DEFINITION,
  GENERATE_RFP_DEFINITION,
  GET_STATUS_DEFINITION,
] as const;

export const SECURITY_TOOL_NAMES = new Set<string>(
  SECURITY_TOOL_DEFINITIONS_ALL.map((t) => t.name),
);

export async function callSecurityTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "assess_security_requirement":
      return assessSecurityRequirement((args ?? {}) as SecurityRequirementInput);
    case "create_security_project": {
      const requirement = args?.requirement;
      if (!requirement || typeof requirement !== "object") {
        return { error: "requirement is required: the same shape assess_security_requirement takes." };
      }
      if (args?.consent !== true) {
        return { error: "Consent is required: pass consent: true only with the buyer's explicit agreement in this conversation.", consent_text: CREATE_CONSENT_TEXT };
      }
      let created;
      try {
        created = await createSecurityProject({
          requirement: requirement as SecurityRequirementInput,
          via: "mcp",
          test: args?.test === true,
        });
      } catch (e) {
        // The core refuses (for example low confidence, with the gap
        // questions in the message); surface it as a structured error so
        // every client hears the same reason (Article 17).
        return { error: (e as Error).message };
      }
      const { project, verdict, builderPath } = created;
      return {
        created: true,
        project_id: project.id,
        phase: projectPhase(project),
        builder_url: `${SITE_URL}${builderPath}`,
        manage_token: project.manage_token,
        verdict,
        consent_text: CREATE_CONSENT_TEXT,
        ...(project.test ? { test: true } : {}),
        note: project.test
          ? "Test project: self-expires in two hours, no emails, no side effects."
          : "Anonymous draft created; the buyer claims it by signing in from the builder link. No supplier is contacted until the buyer publishes.",
      };
    }
    case "generate_security_rfp": {
      const id = String(args?.project_id ?? "");
      const token = String(args?.manage_token ?? "");
      if (!id || !token) return { error: "project_id and manage_token are required." };
      const project = await getProject(id);
      if (!project || project.manage_token !== token) {
        return { error: "Unknown project or wrong credential." };
      }
      const latest = project.engine_data?.verdicts?.slice(-1)[0];
      if (project.engine !== "security_sourcing" || !latest) {
        return { error: "Not a Security Sourcing project: no verdict on record to generate from." };
      }
      const verdict = latest.verdict as SecurityScopeVerdict;
      const arts = project.engine_data?.artefacts ?? [];
      const lastSnap = arts.length ? arts[arts.length - 1].sections_snapshot : null;
      const edited = lastSnap ? JSON.stringify(project.rfp_sections) !== JSON.stringify(lastSnap) : false;
      if (edited && args?.force !== true) {
        return {
          error:
            "The document has been edited since the last generation; regenerating would replace those edits (earlier versions stay recoverable in the project record). Pass force: true only with the buyer's explicit agreement in this conversation.",
        };
      }
      const sections = generateRfpSections(verdict);
      const version = (arts.length ? arts[arts.length - 1].version : 0) + 1;
      const now = Date.now();
      let updated: ProjectDetails = {
        ...project,
        rfp_sections: sections,
        engine_data: {
          verdicts: project.engine_data!.verdicts,
          requirement: project.engine_data!.requirement,
          artefacts: [
            ...arts,
            { version, kind: "rfp_sections", input_digest: verdict.inputDigest, created_at: now, via: "mcp", sections_snapshot: sections },
          ],
        },
      };
      const event: ProjectHistoryEvent = {
        at: now,
        actor: "assistant",
        actor_ref: "generate_security_rfp",
        via: "mcp",
        event: "rfp.generated",
        detail: {
          artefact_version: version,
          regenerated: arts.length > 0,
          forced: args?.force === true,
          verdict_digest: verdict.inputDigest,
          open_gaps: verdict.gaps.length,
        },
      };
      try {
        // At drafted, regeneration is a recorded event (v n+1, no phase
        // change); a pre-generation record advances scoped → drafted. After
        // publication the machine refuses: published documents do not
        // silently change under suppliers (one truth, Article 17).
        updated = projectPhase(updated) === "drafted" ? recordProjectEvent(updated, event) : advanceProject(updated, event);
        updated = await saveProject(updated);
      } catch (e) {
        return { error: (e as Error).message };
      }
      const askCount = sections.reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
      const infoCount = sections.reduce((n, s) => n + s.questions.filter((q) => q.priority === "optional").length, 0);
      return {
        generated: true,
        project_id: id,
        artefact_version: version,
        phase: projectPhase(updated),
        sections: sections.length,
        questions: askCount,
        informational_items: infoCount,
        open_gaps: verdict.gaps.length,
        builder_url: `${SITE_URL}/rfp-builder/${id}`,
        note: verdict.gaps.length
          ? "Draft generated. Publication will require each open gap to be answered (re-scope) or individually accepted by the buyer."
          : "Draft generated from the latest verdict.",
      };
    }
    case "get_security_project_status": {
      const id = String(args?.project_id ?? "");
      const token = String(args?.manage_token ?? "");
      if (!id || !token) return { error: "project_id and manage_token are required." };
      const project = await getProject(id);
      if (!project || project.manage_token !== token) {
        return { found: false, note: "Unknown project or wrong credential." };
      }
      const latest = project.engine_data?.verdicts?.slice(-1)[0];
      const v = latest?.verdict as SecurityScopeVerdict | undefined;
      const arts = project.engine_data?.artefacts ?? [];
      const openGaps = openSecurityGaps(project).length;
      return {
        found: true,
        phase: projectPhase(project),
        status: project.status,
        title: project.title,
        history_length: (project.history ?? []).length,
        ...(latest ? { verdict_version: latest.version } : {}),
        ...(arts.length ? { artefact_version: arts[arts.length - 1].version } : {}),
        ...(v ? { confidence: v.confidence, summary: v.summary, open_gaps: openGaps } : {}),
        builder_url: `${SITE_URL}/rfp-builder/${project.id}`,
        ...(project.test ? { test: true } : {}),
      };
    }
    default:
      return { error: `Unknown security tool: ${name}` };
  }
}
