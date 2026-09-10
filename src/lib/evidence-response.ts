/**
 * The Evidence Response (Robert's "do 1", 18 July 2026): when an RFP reaches
 * a supplier, Netify pre-drafts the answers it already holds evidence for,
 * so the supplier edits rather than writes. The marketplace's own dataset
 * responds to itself; vendors only have to confirm, correct and price.
 *
 * Honesty rules, in order:
 *  - Every drafted line derives ONLY from the vendor's evidence grades
 *    (data/vendors/{slug}.json) and the canonical STATUS vocabulary. Nothing
 *    is invented; the grade and evaluation date ride inside every draft.
 *  - Grades below "yes" draft with their qualifier stated, never upgraded.
 *  - not_primary and unknown produce NO draft text: those answers need the
 *    supplier, and the note says so.
 *  - Pricing and commercial questions are NEVER pre-drafted, whatever the
 *    grade. Pricing is the supplier's alone.
 *  - Every draft ends with a bracketed provenance and instruction line, so
 *    a supplier can never submit Netify's words believing they were their
 *    own considered answer.
 */

import { getAllVendors, FEATURES, STATUS_DESCRIPTIONS } from "@/lib/vendors";
import type { ProjectDetails } from "@/lib/rfp-types";
import type { ShortlistVendor } from "@/lib/shortlist-core";

type EvidenceVendor = Pick<ShortlistVendor, "slug" | "name" | "last_verified" | "capabilities" | "key_differentiators" | "shortlist_summary"> & {
  evidence_summary?: string;
};

export type EvidenceDraftAnswer = {
  question_id: string;
  feature_id: string;
  status: string | null;
  /** Draft answer text, empty when the answer needs the supplier. */
  draft: string;
  needs_input: boolean;
  note: string;
};

export type EvidenceDraft = {
  available: boolean;
  reason?: string;
  vendor_slug?: string;
  vendor_name?: string;
  /** Dataset last_verified date, quoted in every draft. */
  evaluated?: string;
  coverage?: { drafted: number; needs_input: number; total: number };
  answers?: EvidenceDraftAnswer[];
  /** Dataset positioning the supplier may reuse in an opening statement. */
  company_note?: string;
  provenance?: string[];
};

const FEATURE_BY_ID = new Map(FEATURES.map((f) => [f.id, f]));

/** Pricing and commercial questions are never pre-drafted. */
function isCommercial(category: string, text: string): boolean {
  return /commercial/i.test(category) || /\bpric(e|es|ing)\b|\bcost(s)?\b|\bdiscount\b|\binvoice\b|\bpayment\b|\bcommercial\b/i.test(text);
}

/** Resolve a supplier-typed organisation name (or slug) to a dataset vendor. */
export function resolveVendor(nameOrSlug: string, vendors: EvidenceVendor[] = getAllVendors()): EvidenceVendor | null {
  const q = nameOrSlug.trim().toLowerCase();
  if (q.length < 3) return null;
  const bySlug = vendors.find((v) => v.slug === q);
  if (bySlug) return bySlug;
  const exact = vendors.find((v) => v.name.toLowerCase() === q);
  if (exact) return exact;
  // Substring either way ("Cato" -> Cato Networks; "BT Business / BT Global" typed as "BT Business").
  const contains = vendors.filter(
    (v) => v.name.toLowerCase().includes(q) || q.includes(v.name.toLowerCase()),
  );
  return contains.length === 1 ? contains[0] : null;
}

function draftFor(vendor: EvidenceVendor, featureName: string, status: string, evaluated: string): { draft: string; needs_input: boolean; note: string } {
  const prov = (grade: string, instruction: string) =>
    ` [Netify evidence draft, grade ${grade}, public-evidence evaluation last verified ${evaluated}. ${instruction}]`;
  switch (status) {
    case "yes":
      return {
        draft:
          `${vendor.name} supports ${featureName}. ${STATUS_DESCRIPTIONS.yes}` +
          prov("Yes", "Confirm, then add how it is delivered, limitations, geography and dependencies, plus the evidence requested."),
        needs_input: false,
        note: "",
      };
    case "partial":
      return {
        draft:
          `${vendor.name} has partial public evidence for ${featureName}. ${STATUS_DESCRIPTIONS.partial}` +
          prov("Partial", "State precisely what is and is not supported, and attach the evidence requested."),
        needs_input: false,
        note: "",
      };
    case "partner_integrated":
      return {
        draft:
          `${vendor.name} delivers ${featureName} via a partner or integrated platform per public evidence.` +
          prov("Via partner", "Name the partner or platform, describe the delivery model, and attach the evidence requested."),
        needs_input: false,
        note: "",
      };
    case "managed_service_dependent":
      return {
        draft:
          `${vendor.name} provides ${featureName} through its managed service per public evidence.` +
          prov("Via managed service", "Describe the managed delivery, dependencies and boundaries, and attach the evidence requested."),
        needs_input: false,
        note: "",
      };
    case "not_primary":
      return {
        draft: "",
        needs_input: true,
        note: `Netify's evaluation grades ${featureName} as not primary for ${vendor.name}. If you do support it, answer with evidence; otherwise state the exception explicitly rather than omitting it.`,
      };
    default:
      return {
        draft: "",
        needs_input: true,
        note: "Not confirmed by Netify's public-evidence review. This answer needs your input.",
      };
  }
}

export function buildEvidenceDraft(project: ProjectDetails, vendorRef: string, vendors?: EvidenceVendor[]): EvidenceDraft {
  const vendor = resolveVendor(vendorRef, vendors);
  if (!vendor) {
    return {
      available: false,
      reason:
        "No Netify evidence profile matches that organisation name, so there is nothing to pre-draft. Answer directly; your response is evaluated on its own evidence.",
    };
  }
  const evaluated = vendor.last_verified;
  const caps = vendor.capabilities as Record<string, string>;

  const answers: EvidenceDraftAnswer[] = [];
  for (const section of project.rfp_sections) {
    if (!section.included) continue;
    for (const q of section.questions) {
      if (q.priority === "optional") continue;
      if (isCommercial(section.category, q.text)) {
        answers.push({
          question_id: q.id,
          feature_id: q.feature_id,
          status: null,
          draft: "",
          needs_input: true,
          note: "Pricing and commercial answers are yours alone. Netify never pre-drafts them.",
        });
        continue;
      }
      const feature = FEATURE_BY_ID.get(q.feature_id);
      const status = feature ? (caps[q.feature_id] ?? "unknown") : null;
      if (!feature || status === null) {
        answers.push({
          question_id: q.id,
          feature_id: q.feature_id,
          status: null,
          draft: "",
          needs_input: true,
          note: "This question sits outside Netify's graded capability matrix, so there is no evidence to draft from. It needs your answer.",
        });
        continue;
      }
      const d = draftFor(vendor, feature.name, status, evaluated);
      answers.push({ question_id: q.id, feature_id: q.feature_id, status, ...d });
    }
  }

  const drafted = answers.filter((a) => !a.needs_input).length;
  const company_note =
    `${vendor.evidence_summary ?? vendor.shortlist_summary} Key differentiators per Netify's evaluation: ${vendor.key_differentiators.join(" ")}`.trim();

  return {
    available: true,
    vendor_slug: vendor.slug,
    vendor_name: vendor.name,
    evaluated,
    coverage: { drafted, needs_input: answers.length - drafted, total: answers.length },
    answers,
    company_note,
    provenance: [
      `Drafted by Netify from its public-evidence evaluation of ${vendor.name} (last verified ${evaluated}), grades only; nothing is invented.`,
      "Grades below Yes are drafted with their qualifier stated. Not-primary and unconfirmed capabilities are left blank for you.",
      "Pricing and commercial questions are never pre-drafted.",
      "Review and edit every answer before submitting; the draft is a starting point, not a submission.",
    ],
  };
}
