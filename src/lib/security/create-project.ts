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
import { rfpBuilderEntrance } from "@/lib/project-entrance";
import type { Understanding } from "@/lib/workspace/understanding";
import { notesWithSourceTurns } from "@/lib/workspace/extract";
import { mergeSourceLedger, type SourceLedgerEntry } from "@/lib/workspace/source-ledger";
import { mergeDecisionLedger, type DecisionLedgerEntry } from "@/lib/workspace/decision-ledger";

export const CREATE_CONSENT_TEXT =
  "Create my Security Sourcing project: Netify stores this requirement and scoping verdict so I can build and publish an RFP to matched vendors. No vendor is contacted until I publish.";

export interface CreateSecurityProjectInput {
  /** Optional buyer-chosen project title (Harry's 22 Jul workflow gap:
   *  rename before publish). Guarded like sectors: letters required,
   *  length capped; falls back to the derived title otherwise. */
  customTitle?: string;
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
  /**
   * Milestone 3 (Gap B/D rulings, 9 Aug 2026): the two twin-gate bypasses,
   * for the NEW conversational entry point only. Both default to false/
   * absent, so every existing caller (the web wizard's create route, the
   * existing create_security_project MCP tool) is byte-for-byte unchanged.
   *
   * skipConfidenceGate: create the Project even at low confidence — "low
   * confidence is Project state, not a reason for the Project not to
   * exist." The verdict is still computed and attached honestly, at
   * whatever confidence it lands on; nothing here changes the verdict
   * itself, only whether a low confidence stops creation.
   *
   * skipRfpGeneration: do not auto-generate the RFP document or advance
   * the phase past "scoped". The conversational capability creates
   * Project -> Understanding only (Gap D); the existing
   * generate_security_rfp tool remains available, unmodified, for the
   * buyer's later explicit step into drafting.
   */
  skipConfidenceGate?: boolean;
  skipRfpGeneration?: boolean;
  /** Milestone 3 (Gap A/C): the richer Understanding this creation was
   *  built from, stored verbatim on the Project alongside the rulebook's
   *  own `requirement`. Absent for every existing caller. */
  understanding?: Understanding;
  /** Reliability gate, fourth amendment (13 Aug 2026): the buyer's own
   *  verbatim source turns (see ProjectDesk.tsx's SourceTurn type and
   *  workspace/source-ledger.ts), persisted two ways from the SAME input —
   *  structured and complete into `project.source_ledger` (the canonical
   *  store this amendment introduces), and, unchanged from the third
   *  amendment, folded as a human-readable projection into `buyer.notes` via
   *  notesWithSourceTurns. Absent for every existing caller (the web
   *  wizard's create route has its own, separate notes path; the existing
   *  create_security_project MCP tool has no chat thread to draw from at
   *  all). */
  sourceTurns?: SourceLedgerEntry[];
  /** Living Procurement UK Decision-Maker Blueprint, correction pass
   *  (Robert, 15 Aug 2026), defects 3 and 4: the buyer's own structured
   *  NextQuestion actions (see ProjectDesk.tsx's answerNextQuestion and
   *  workspace/decision-ledger.ts), persisted into `project.decision_ledger`
   *  the same way sourceTurns above persists into `project.source_ledger` --
   *  a durable, structured store, not a browser-only one. Absent for every
   *  existing caller (the MCP tools have no NextQuestion cards to answer). */
  decisionTurns?: DecisionLedgerEntry[];
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

/** A custom title only stands when it reads as one (letters, sane length). */
function usableTitle(t: string | undefined): string | null {
  const s = String(t ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return /[a-zA-Z]{3,}/.test(s) ? s : null;
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
  //
  // Milestone 3 (Gap B ruling, 9 Aug 2026): the ONE exception is the new
  // conversational entry point, which opts in with skipConfidenceGate.
  // Every other caller (web wizard, existing create_security_project MCP
  // tool) never sets this flag, so this throw fires for them exactly as
  // before.
  if (verdict.confidence === "low" && !input.skipConfidenceGate) {
    throw new Error(
      "Confidence is low: answer the assessment's gap questions before creating a project. " +
        verdict.gaps.map((g) => g.question).join(" "),
    );
  }

  const pins = (input.preferredVendors ?? []).filter(Boolean).slice(0, 5);
  const buyerProfile = buyerFrom(input.requirement);
  // Fourth amendment: the ledger is built once, here, from this creation's
  // input turns (there is no existing ledger yet — `mergeSourceLedger([], ...)`
  // is just "validate and de-dup within this one batch"), and the SAME
  // ledger's text values feed the human-readable projection below, so the
  // two never drift apart at the moment of creation.
  const sourceLedger = mergeSourceLedger([], input.sourceTurns ?? []);
  const decisionLedger = mergeDecisionLedger([], input.decisionTurns ?? []);
  let project = ProjectDetailsSchema.parse({
    id: input.ids.id,
    created: now,
    updated: now,
    status: "draft",
    title: usableTitle(input.customTitle) ?? titleFor(input.requirement),
    buyer: {
      ...buyerProfile,
      notes: notesWithSourceTurns(String(buyerProfile.notes ?? ""), sourceLedger.map((t) => t.text)),
      ...(pins.length ? { pinned_vendors: pins } : {}),
    },
    rfp_sections: [],
    invited_vendors: [],
    share_token: input.ids.shareToken,
    manage_token: input.ids.manageToken,
    source: input.via === "mcp" ? "mcp" : "wizard",
    entrance_context: rfpBuilderEntrance({
      rawInput: {
        requirement: structuredClone(input.requirement),
        buyer: structuredClone(buyerProfile),
        preferred_vendors: [...pins],
        source_turns: structuredClone(input.sourceTurns ?? []),
        decision_turns: structuredClone(input.decisionTurns ?? []),
      },
      sourceUrl: input.via === "mcp" ? "/sase/api/mcp/" : "/sase-sd-wan-rfp-builder/",
      capturedAt: now,
    }),
    journey: {
      contract_version: "project-journey/1.0.0",
      source: input.via === "mcp" ? "mcp" : "rfp_builder",
      mode: "build_rfp",
      source_url: input.via === "mcp" ? "/sase/api/mcp/" : "/sase-sd-wan-rfp-builder/",
      started_at: now,
    },
    owner_email: input.ownerEmail ?? "",
    methodology_version: "2026.1",
    engine: "security_sourcing",
    engine_data: { verdicts: [], requirement: input.requirement },
    // Milestone 3 (9 Aug 2026, corrected same-day after an architecture
    // check): Understanding is canonical Project state, not engine_data —
    // set here, at the SAME level as engine_data itself, never nested
    // inside it. Absent for every caller that doesn't pass it, so the
    // Project shape is otherwise identical to before this milestone.
    ...(input.understanding ? { understanding: input.understanding } : {}),
    // Fourth amendment: the canonical structured ledger, top-level like
    // `understanding` for the same reason — engine-independent, not gated
    // by engine_data's authorised-writer invariants.
    source_ledger: sourceLedger,
    // Defects 3/4: the same canonical, structured, top-level treatment as
    // source_ledger immediately above, built once here from this creation's
    // input decisions (mergeDecisionLedger([], ...) is again just "validate
    // and de-dup within this one batch" -- there is no existing ledger yet).
    decision_ledger: decisionLedger,
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

  // Milestone 3 (Gap D ruling, 9 Aug 2026): the conversational entry point
  // opts out of automatic generation with skipRfpGeneration. The project
  // stops here, at phase "scoped" (a verdict attached, no document) — the
  // existing generate_security_rfp tool (regenerate-project.ts) already
  // handles building the first document for a project that has never been
  // drafted, unmodified, for whenever the buyer takes that explicit step.
  // Every existing caller leaves this flag unset, so the block below runs
  // for them exactly as before.
  if (!input.skipRfpGeneration) {
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
  }

  return { project, verdict };
}
