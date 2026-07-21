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
import { ProjectDetailsSchema, type ProjectDetails } from "@/lib/rfp-types";

export const CREATE_CONSENT_TEXT =
  "Create my Security Sourcing project: Netify stores this requirement and scoping verdict so I can build and publish an RFP to matched suppliers. No supplier is contacted until I publish.";

export interface CreateSecurityProjectInput {
  requirement: SecurityRequirementInput;
  contactEmail?: string;
  ownerEmail?: string; // from an authenticated session, if present
  via: "web" | "mcp";
  test?: boolean;
  ids: { id: string; shareToken: string; manageToken: string }; // injected so the core stays pure
  now?: number;
}

export interface BuiltSecurityProject {
  project: ProjectDetails;
  verdict: SecurityScopeVerdict;
}

function titleFor(req: SecurityRequirementInput): string {
  const sector = req.organisation?.sector?.trim();
  const users = req.estate?.users;
  const parts = ["Security sourcing"];
  if (sector) parts.push(`for ${sector}`);
  if (typeof users === "number" && users > 0) parts.push(`(${users} users)`);
  return parts.join(" ");
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

  let project = ProjectDetailsSchema.parse({
    id: input.ids.id,
    created: now,
    updated: now,
    status: "draft",
    title: titleFor(input.requirement),
    buyer: {},
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

  project = {
    ...project,
    engine_data: {
      verdicts: [
        {
          version: 1,
          verdict,
          input_digest: verdict.inputDigest,
          created_at: now,
          via: input.via === "mcp" ? "mcp" : "web",
        },
      ],
      requirement: input.requirement,
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

  return { project, verdict };
}
