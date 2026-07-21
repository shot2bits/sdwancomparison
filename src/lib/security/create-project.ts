/**
 * Netify Security Sourcing: Project creation (Phase B step 2).
 *
 * Split for testability and one truth:
 * - buildSecurityProject: PURE assembly. Recomputes the verdict server-side
 *   from the submitted requirement (the client's rendering is a preview;
 *   Article 3 makes recomputation cheap and provable via the input digest),
 *   constructs the record, and walks it through the machine: scoping,
 *   project.created recorded, verdict attached, advanced to scoped. No I/O.
 * - createSecurityProject: the thin I/O wrapper. Persists via saveProject
 *   (the single write gate), and in TEST MODE skips the buyer index and the
 *   courtesy email and expires both keys after two hours, so a test leaves
 *   no durable production side effects (review target 4).
 */

import {
  assessSecurityRequirement,
  RULEBOOK_VERSION,
  type SecurityRequirementInput,
  type SecurityScopeVerdict,
} from "@/lib/security/rulebook";
import { advanceProject, recordProjectEvent } from "@/lib/project-machine";
import { generateRfpSections } from "@/lib/security/generate-rfp";
import { ProjectDetailsSchema, type ProjectDetails } from "@/lib/rfp-types";

export const CREATE_CONSENT_TEXT =
  "Create my Security Sourcing project: Netify stores this requirement and scoping verdict so I can build and publish an RFP to matched suppliers. No supplier is contacted until I publish.";

export interface CreateSecurityProjectInput {
  requirement: SecurityRequirementInput;
  contactEmail?: string;
  ownerEmail?: string; // from an authenticated session, if present
  via: "web" | "mcp";
  test?: boolean;
  /** Marketplace vendor slugs the buyer explicitly pinned (the workspace's
   *  add-a-supplier control). Validated against the dataset and capped at
   *  five by the I/O layer (this core stays pure); pinned vendors are
   *  always invited at publish, exactly as wizard pins are. */
  preferredVendors?: string[];
  ids: { id: string; shareToken: string; manageToken: string }; // injected so the core stays pure
  now?: number;
}

export interface BuiltSecurityProject {
  project: ProjectDetails;
  verdict: SecurityScopeVerdict;
}

/** A sector only enters titles and the buyer profile when it reads as one.
 *  Harry's QA (21 July 2026, F1): typing "66" produced the permanent title
 *  "Security sourcing for 66" while the market report correctly treated the
 *  same value as no sector at all. The guard lives engine-side so every
 *  client (page, API, MCP) gets the same behaviour (Article 17). */
export function usableSector(req: SecurityRequirementInput): string | null {
  const sector = req.organisation?.sector?.trim();
  return sector && /[a-zA-Z]/.test(sector) ? sector : null;
}

function titleFor(req: SecurityRequirementInput): string {
  const sector = usableSector(req);
  const users = req.estate?.users;
  const parts = ["Security sourcing"];
  if (sector) parts.push(`for ${sector}`);
  if (typeof users === "number" && users > 0) parts.push(`(${users} users)`);
  return parts.join(" ");
}

/** The legacy buyer profile, mapped from the security requirement so the
 *  generated document's background reflects what was actually entered
 *  (Harry's QA F5: compliance, drivers and SOC cover were vanishing and the
 *  background read as unfilled boilerplate). One mapping serves every
 *  downstream surface that composes from p.buyer. */
function buyerFrom(req: SecurityRequirementInput): Record<string, unknown> {
  const sector = usableSector(req);
  const sites = req.estate?.sites;
  const notes: string[] = [];
  const users = req.estate?.users;
  if (typeof users === "number" && users > 0) notes.push(`Staff: ${users}.`);
  const DRIVER_LABELS: Record<string, string> = {
    incident: "an incident (had or ongoing)",
    audit: "an audit",
    compliance: "compliance obligations",
    renewal: "a contract renewal",
    growth: "growth or change",
    consolidation: "consolidating point tools",
    ransomware_concern: "ransomware concern",
  };
  if (req.drivers?.length) notes.push(`Drivers: ${req.drivers.map((d) => DRIVER_LABELS[d] ?? d).join(", ")}.`);
  const soc = req.constraints?.inHouseSocCapacity;
  if (soc) notes.push(`In-house security operations cover: ${soc === "twenty_four_seven" ? "24/7" : soc.replace(/_/g, " ")}.`);
  if (req.estate?.specialDevices?.length) notes.push(`Special devices: ${req.estate.specialDevices.map((s) => (s === "epos" ? "EPOS tills" : "Chromebooks")).join(", ")}.`);
  if (req.estate?.existingSecurity?.length) notes.push(`Existing security tooling: ${req.estate.existingSecurity.join(", ")}.`);
  if (req.estate?.existingNetwork?.length) notes.push(`Network estate: ${req.estate.existingNetwork.join(", ")}.`);
  // Bridge the engine's compliance vocabulary to the builder's where a
  // direct equivalent exists (Harry's retest NF2: iso27001 vs iso_27001
  // meant even ISO 27001 never lit the builder's compliance chip and
  // Coverage read as if nothing was picked up). Regimes without a builder
  // equivalent (Cyber Essentials Plus, FCA, NHS DSPT) carry through
  // unchanged and render explicitly on the builder's compliance step.
  const COMPLIANCE_KEY_BRIDGE: Record<string, string> = { iso27001: "iso_27001" };
  const compliance = (req.constraints?.complianceRequirements ?? []).map((c) => COMPLIANCE_KEY_BRIDGE[c] ?? c);
  return {
    ...(sector ? { sector } : {}),
    ...(typeof sites === "number" && sites > 0 ? { site_count: sites } : {}),
    compliance,
    notes: notes.join(" "),
  };
}

export async function buildSecurityProject(
  input: CreateSecurityProjectInput,
): Promise<BuiltSecurityProject> {
  const now = input.now ?? Date.now();
  const verdict = await assessSecurityRequirement(input.requirement);

  // One behaviour for every client (Article 17): a project is not created
  // on guesswork. The page disables its button at low confidence; the API
  // and the MCP tool refuse here with the same reason.
  if (verdict.confidence === "low") {
    throw new Error(
      "Confidence is low: answer the assessment's gap questions before creating a project. " +
        verdict.gaps.map((g) => g.question).join(" "),
    );
  }

  const pins = (input.preferredVendors ?? []).filter(Boolean).slice(0, 5);
  let project = ProjectDetailsSchema.parse({
    id: input.ids.id,
    created: now,
    updated: now,
    status: "draft",
    title: titleFor(input.requirement),
    buyer: { ...buyerFrom(input.requirement), ...(pins.length ? { pinned_vendors: pins } : {}) },
    rfp_sections: [],
    invited_vendors: [],
    share_token: input.ids.shareToken,
    manage_token: input.ids.manageToken,
    source: input.via === "mcp" ? "mcp" : "wizard",
    owner_email: input.ownerEmail ?? "",
    methodology_version: "2026.1",
    engine: "security_sourcing",
    engine_data: { verdicts: [], requirement: input.requirement },
    phase: "scoping",
    history: [],
    consents: [
      {
        at: now,
        action: "create",
        granted_by: input.ownerEmail || input.contactEmail || "anonymous",
        via: input.via,
        text: CREATE_CONSENT_TEXT, // the wording shown, recorded verbatim (Article 13)
      },
    ],
    ...(input.test ? { test: true } : {}),
  });

  project = recordProjectEvent(project, {
    at: now,
    actor: input.via === "mcp" ? "assistant" : "buyer",
    actor_ref: input.ownerEmail || input.contactEmail || "",
    via: input.via,
    event: "project.created",
    detail: { engine: "security_sourcing", rulebook: RULEBOOK_VERSION, test: !!input.test },
    consent: true,
  });

  const via = input.via === "mcp" ? "mcp" : "web";

  project = {
    ...project,
    engine_data: {
      verdicts: [
        {
          version: 1,
          verdict,
          input_digest: verdict.inputDigest,
          created_at: now,
          via,
        },
      ],
      requirement: input.requirement,
      artefacts: [],
    },
  };

  project = advanceProject(project, {
    at: now + 1,
    actor: input.via === "mcp" ? "assistant" : "buyer",
    actor_ref: input.ownerEmail || input.contactEmail || "",
    via: input.via,
    event: "verdict.attached",
    detail: { version: 1, rulebookVersion: verdict.rulebookVersion, confidence: verdict.confidence },
  });

  // Step 3: generation happens INSIDE creation (adapter, not a page). The
  // buyer's next click lands in the EXISTING RFP Builder with the document
  // already populated; there is no generation UI anywhere. Deterministic
  // from the verdict (Article 3); the snapshot keeps v1 recoverable
  // (Article 9; acceptance check 8).
  const sections = generateRfpSections(verdict);
  const askCount = sections.reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
  const infoCount = sections.reduce((n, s) => n + s.questions.filter((q) => q.priority === "optional").length, 0);
  project = {
    ...project,
    rfp_sections: sections,
    engine_data: {
      ...project.engine_data!,
      artefacts: [
        {
          version: 1,
          kind: "rfp_sections" as const,
          input_digest: verdict.inputDigest,
          created_at: now,
          via,
          sections_snapshot: sections,
        },
      ],
    },
  };

  project = advanceProject(project, {
    at: now + 2,
    actor: "system", // the adapter generates; the buyer edits afterwards
    actor_ref: "generate-rfp",
    via: input.via,
    event: "rfp.generated",
    detail: {
      artefact_version: 1,
      sections: sections.length,
      questions: askCount,
      informational_items: infoCount,
      verdict_digest: verdict.inputDigest,
      open_gaps: verdict.gaps.length,
    },
  });

  return { project, verdict };
}
