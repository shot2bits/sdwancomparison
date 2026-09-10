import { SASE_EXTENDED_BANK } from "@/lib/rfp-question-bank";
import { validateRfpText, RFP_VALIDATION_VERSION } from "@/lib/workspace/rfp-validator";

export const SASE_DEMO_URL = "https://netify.co.uk/sase/examples/sase-rfp/";
export const SASE_DEMO_INPUT = "We are a manufacturing company with 15 sites: 10 in the UK and five in Germany. We have 600 users, including 30 remote users. We want a managed SASE solution to replace our existing VPN and protect access to cloud applications. Please provide a proposal and pricing.";
export const SASE_DEMO_DISCLOSURE = "Fictional manufacturing example. No customer project, supplier response or procurement outcome is represented. Nothing in this demonstration is published to the Opportunity Board.";
export const SASE_DEMO_DECISIONS = [
  "Example buyer decision: use the existing Entra ID directory for identity, MFA and device posture. Require ZTNA, SWG, CASB, FWaaS and DLP, with logging exported to the existing SIEM. Suppliers must identify unsupported devices and application dependencies.",
  "Example buyer decision: protect production continuity with an IT/OT segmentation boundary. Contractor access must be individually approved, time-bound and audited. SASE must not be assumed to replace plant safety controls.",
  "Example buyer decision: request regional PoP coverage, availability SLA and latency evidence, plus a failover test. Exact bandwidths and maximum tolerable outage remain to be confirmed by each plant; suppliers must state assumptions separately.",
  "Example buyer decision: require a managed service, 24/7 incident support, escalation contacts and a RACI defining policy ownership. Request data residency, retention and sub-processor details for UK and German operations; retention periods remain a buyer decision.",
  "Example buyer decision: plan phased migration within six months, with a pilot, approved cutover windows, rollback and training. The dates and acceptance thresholds require buyer confirmation before contract award.",
  "Example buyer decision: compare a 36-month contract term in GBP using one pricing table for one-off and recurring charges, licences, total cost, exclusions and exit/data-return terms. This is an illustrative evaluation basis, not a supplier quote.",
  "Example evaluation rule: mandatory identity integration, the IT/OT boundary and a rollback plan are pass/fail. Score compliant bids on security fit (30%), resilience (25%), operations (20%), implementation (10%) and total cost (15%). Require dated evidence within the last 12 months, current certificates and expiry dates. Buyers must adapt these example weights and evidence periods.",
  "Response format: answer each question by ID with compliance, delivery method, limitations, evidence reference and price impact. Separate confirmed capability from roadmap commitments. These supplier answers have not been provided in this demonstration.",
];
export const SASE_DEMO_BESPOKE = {
  question_id: "BUYER-OT-001", question: "How will you revoke a maintenance contractor’s access to a legacy production application during an identity outage without disrupting production or bypassing the IT/OT boundary?",
  evidence_required: ["Proposed test procedure, access-revocation behaviour, audit trail and rollback plan"],
  why_it_matters: "This buyer-specific question tests the interaction between access control and production continuity. A product checklist alone cannot settle it.",
};
const GROUPS = [
  { title: "Identity and private application access", categories: ["identity_ztna"] },
  { title: "Web, SaaS and threat protection", categories: ["swg_casb_dlp", "fwaas_threat"] },
  { title: "Branch integration and resilience", categories: ["sdwan_integration"] },
  { title: "Logging and data residency", categories: ["logging_siem", "data_residency"] },
  { title: "Managed service and responsibilities", categories: ["service_model"] },
  { title: "Migration and acceptance", categories: ["deployment"] },
  { title: "Pricing and contractual terms", categories: ["commercials"] },
  { title: "Supplier evidence", categories: ["vendor_evidence"] },
];
export function saseDemoSections(depth: "short" | "detailed") {
  return GROUPS.map(group => {
    const questions = SASE_EXTENDED_BANK.questions.filter(q => group.categories.includes(q.category_id));
    return { title: group.title, questions: depth === "short" ? questions.slice(0, 1) : questions };
  });
}
export function saseDemoDocument(depth: "short" | "detailed") {
  return [`# ${depth === "short" ? "Short" : "Detailed"} SASE RFP — fictional manufacturing example`, SASE_DEMO_DISCLOSURE,
    "## Original buyer brief", SASE_DEMO_INPUT, "## Example buyer decisions and response instructions", ...SASE_DEMO_DECISIONS,
    ...saseDemoSections(depth).flatMap(s => [`## ${s.title}`, ...s.questions.map(q => `${q.question_id}\n${q.question}\nEvidence requested: ${q.evidence_required.join("; ")}\nReason: ${q.why_it_matters}`)]),
    "## Bespoke buyer question", `${SASE_DEMO_BESPOKE.question_id}\n${SASE_DEMO_BESPOKE.question}\nEvidence requested: ${SASE_DEMO_BESPOKE.evidence_required.join("; ")}`,
    "## Still to confirm", "Site bandwidths, application inventory, outage tolerances, retention periods, acceptance thresholds and approved migration dates. This coverage check does not resolve those decisions or certify technical correctness."
  ].join("\n\n");
}
export function saseDemoData() {
  return { synthetic: true, version: "1.0", dateCreated: "2026-09-06", disclosure: SASE_DEMO_DISCLOSURE, input: SASE_DEMO_INPUT,
    buyerDecisions: SASE_DEMO_DECISIONS, bespokeQuestion: SASE_DEMO_BESPOKE,
    methodology: { validator: RFP_VALIDATION_VERSION, questionBank: SASE_EXTENDED_BANK.question_bank_version },
    initialAssessment: validateRfpText(SASE_DEMO_INPUT),
    documents: Object.fromEntries((["short", "detailed"] as const).map(depth => { const text = saseDemoDocument(depth); return [depth, { text, assessment: validateRfpText(text) }]; })),
  };
}
