import { BANK_VERSION, QUESTION_BANK, SASE_EXTENDED_BANK } from "@/lib/rfp-question-bank";
import { getAllVendors } from "@/lib/vendors";

export type RfpValidationSection = {
  key: string;
  title: string;
  score: number;
  covered: string[];
  missing: string[];
};

export type RfpValidationQuestion = {
  id: string;
  category: string;
  text: string;
  reason: string;
};

export type RfpValidationReport = {
  assessmentVersion: string;
  score: number;
  label: "Needs work" | "Usable foundation" | "Strong" | "Procurement-ready";
  wordCount: number;
  questionCount: number;
  missingRequirementCount: number;
  validBaseline: boolean;
  sections: RfpValidationSection[];
  strengths: string[];
  gaps: string[];
  recommendedQuestions: RfpValidationQuestion[];
  sector: { detected: string | null; label: string | null; gaps: string[] };
  comparabilityWarnings: string[];
  vendorNeutralityWarnings: string[];
  bank: { version: string; totalQuestions: number; extendedQuestions: number };
};

export const RFP_VALIDATION_VERSION = "2026.2";
export const RFP_VALIDATION_REVIEWED = "2026-08-26";

type Check = { label: string; pattern: RegExp };
type SectionDefinition = { key: string; title: string; checks: Check[] };

const SECTIONS: SectionDefinition[] = [
  { key: "organisation_scale", title: "Organisation and scale", checks: [
    { label: "sector or operating context", pattern: /\b(health|nhs|clinic|hospital|manufactur|factory|retail|store|financial|bank|insurance|education|government|sector|industry)\w*/i },
    { label: "sites, users or devices", pattern: /\b\d[\d,]*\s*(sites?|locations?|branches?|stores?|offices?|users?|employees?|devices?)\b/i },
    { label: "regions or countries", pattern: /\b(uk|united kingdom|europe|emea|global|region|countr|geograph|location)\w*/i },
  ] },
  { key: "solution_scope", title: "Solution scope", checks: [
    { label: "SASE, SSE or SD-WAN scope", pattern: /\b(sase|sse|sd[ -]?wan|secure access service edge)\b/i },
    { label: "required security components", pattern: /\b(ztna|zero trust|casb|swg|secure web gateway|dlp|fwaa?s|firewall as a service|rbi|dns security)\b/i },
    { label: "business outcomes or use cases", pattern: /\b(objective|outcome|use case|driver|remote access|branch|cloud access|consolidat|transform)\w*/i },
  ] },
  { key: "current_estate", title: "Current estate", checks: [
    { label: "existing WAN or underlay", pattern: /\b(current|existing|legacy|incumbent|mpls|leased line|ethernet|broadband|internet|4g|5g|underlay)\b/i },
    { label: "cloud, SaaS or application estate", pattern: /\b(azure|aws|gcp|microsoft 365|m365|saas|cloud|application|data centre|datacenter)\b/i },
    { label: "identity, security or operational tooling", pattern: /\b(idp|entra|okta|active directory|siem|soc|firewall|security stack|monitoring|tooling)\b/i },
  ] },
  { key: "resilience_availability", title: "Resilience and availability", checks: [
    { label: "availability or SLA targets", pattern: /\b(availability|uptime|sla|service level|restoration|rto|rpo)\b/i },
    { label: "failover or access diversity", pattern: /\b(failover|redundan|diverse|dual circuit|backup link|active[ -]active|active[ -]passive)\w*/i },
    { label: "performance requirements", pattern: /\b(latency|jitter|packet loss|throughput|performance|application-aware|path selection)\b/i },
  ] },
  { key: "security_identity_data", title: "Security, identity and data", checks: [
    { label: "identity and access controls", pattern: /\b(identity|idp|saml|oidc|scim|mfa|least privilege|device posture|zero trust|ztna)\b/i },
    { label: "threat and data controls", pattern: /\b(casb|swg|dlp|ips|ids|malware|sandbox|tls inspection|dns security|fwaa?s|threat)\b/i },
    { label: "logging, compliance or data residency", pattern: /\b(siem|logging|audit|retention|data residency|gdpr|pci|iso 27001|soc 2|compliance|regulat)\w*/i },
  ] },
  { key: "operating_model_support", title: "Operating model and support", checks: [
    { label: "managed, co-managed or self-managed model", pattern: /\b(fully managed|managed service|co-managed|self-managed|operating model)\b/i },
    { label: "support and service management", pattern: /\b(service desk|support|incident|problem management|change request|noc|soc|24\/7|escalation)\b/i },
    { label: "roles, reporting or governance", pattern: /\b(raci|responsib|governance|reporting|service review|account management|roles?)\w*/i },
  ] },
  { key: "migration_implementation", title: "Migration and implementation", checks: [
    { label: "deployment or migration approach", pattern: /\b(deploy|migration|implementation|rollout|transition|onboard)\w*/i },
    { label: "timeline, phases or milestones", pattern: /\b(timeline|target date|deadline|phase|milestone|weeks?|months?|quarter|go-live)\b/i },
    { label: "pilot, cutover, rollback or training", pattern: /\b(pilot|proof of concept|poc|cutover|rollback|training|knowledge transfer|handover)\b/i },
  ] },
  { key: "commercial_contractual", title: "Commercial and contractual", checks: [
    { label: "pricing or total cost", pattern: /\b(pricing|price|cost|tco|commercial|per user|per site|bill of materials|bom)\b/i },
    { label: "licensing or contract term", pattern: /\b(licen[cs]|contract term|term length|subscription|minimum commit|renewal|indexation)\w*/i },
    { label: "exit, liability or contractual protections", pattern: /\b(exit|termination|liability|indemn|insurance|service credit|benchmark|data return)\w*/i },
  ] },
];

const CATEGORY_FOR_SECTION: Record<string, string[]> = {
  solution_scope: ["SD-WAN Integration", "Identity / ZTNA", "SWG / CASB / DLP"],
  current_estate: ["SD-WAN Integration", "Logging / SIEM"],
  resilience_availability: ["SD-WAN Integration", "Service Model"],
  security_identity_data: ["Identity / ZTNA", "SWG / CASB / DLP", "FWaaS / Threat", "Logging / SIEM", "Data Residency", "Vendor Evidence"],
  operating_model_support: ["Service Model"],
  migration_implementation: ["Deployment"],
  commercial_contractual: ["Commercials"],
};

const SECTOR_RULES = [
  { key: "healthcare", label: "Healthcare", pattern: /\b(healthcare|nhs|hospital|clinic|patient)\b/i, checks: [
    { label: "patient-data and clinical-system protection", pattern: /\b(patient data|clinical system|ehr|electronic health|nhs data|medical device)\b/i },
    { label: "clinical-service continuity and critical-site resilience", pattern: /\b(clinical continuity|critical site|hospital resilience|patient safety|life safety)\b/i },
  ] },
  { key: "financial_services", label: "Financial services", pattern: /\b(financial services|banking|bank|insurer|insurance|fintech)\b/i, checks: [
    { label: "operational-resilience and regulated-service obligations", pattern: /\b(dora|operational resilience|important business service|impact tolerance|fca|pra)\b/i },
    { label: "auditability and third-party risk", pattern: /\b(third.party risk|supplier risk|audit trail|regulatory reporting)\b/i },
  ] },
  { key: "retail", label: "Retail", pattern: /\b(retail|retailer|stores?|point of sale|pos)\b/i, checks: [
    { label: "PCI DSS and payment-environment segmentation", pattern: /\b(pci(?: dss)?|cardholder data|payment environment|pos segmentation)\b/i },
    { label: "store continuity, guest access or seasonal demand", pattern: /\b(store continuity|guest wi.?fi|seasonal peak|peak trading|point of sale continuity)\b/i },
  ] },
  { key: "manufacturing", label: "Manufacturing", pattern: /\b(manufactur|factory|plant|warehouse|industrial)\w*/i, checks: [
    { label: "IT/OT segmentation and industrial security", pattern: /\b(ot|operational technology|ics|scada|iec 62443|industrial security)\b/i },
    { label: "plant, production or warehouse continuity", pattern: /\b(production continuity|plant resilience|factory uptime|warehouse connectivity|industrial site)\b/i },
  ] },
] as const;

function countQuestions(text: string): number {
  const marks = text.match(/\?/g)?.length ?? 0;
  const imperativeLines = text.split(/\r?\n/).filter((line) => /^\s*(?:\d+[.)]|[-*•])?\s*(describe|explain|provide|confirm|detail|demonstrate|state|identify|outline|which|what|how)\b/i.test(line)).length;
  return Math.max(marks, imperativeLines);
}

function bankTotal(): number {
  return QUESTION_BANK.canonical.length + Object.values(QUESTION_BANK.sector_packs).reduce((sum, pack) => sum + pack.count, 0);
}

export function validateRfpText(raw: string): RfpValidationReport {
  const text = raw.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(/\s+/).length : 0;
  const questionCount = countQuestions(raw);
  const sections = SECTIONS.map((section) => {
    const covered = section.checks.filter((check) => check.pattern.test(text)).map((check) => check.label);
    const missing = section.checks.filter((check) => !check.pattern.test(text)).map((check) => check.label);
    return { key: section.key, title: section.title, score: Math.round((covered.length / section.checks.length) * 100), covered, missing };
  });

  const evidenceNoun = "evidence|certificat(?:e|ion)s?|reference customers?|test results?|audit reports?|sample reports?|proof|assurance reports?|penetration test(?:ing)?";
  const evidence = new RegExp(`\\b(?:${evidenceNoun})\\b`, "i").test(text)
    || new RegExp(`\\b(?:provide|attach|submit|demonstrate)\\b.{0,80}\\b(?:${evidenceNoun})\\b`, "i").test(text);
  const evaluation = /\b(weight|scor|evaluation criteria|pass\/fail|mandatory|must have|priority|disqualif|red flag)\w*/i.test(text);
  const responseStructure = /\b(response format|response template|word limit|yes\/no|compliance matrix|pricing table|complete the table)\b/i.test(text);
  const mandatoryClarity = /\b(mandatory|must|shall|minimum requirement|pass\/fail|disqualif)\w*/i.test(text);
  const pricingStructure = /\b(pricing table|price schedule|bill of materials|bom|one.off|recurring charge|tco|total cost)\b/i.test(text);
  const evidenceCurrency = /\b(dated evidence|within the last|no older than|current certificate|expiry date|valid until)\b/i.test(text);
  const namedVendors = getAllVendors().filter((vendor) => new RegExp(`\\b${vendor.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  const equivalentAllowed = /\b(or equivalent|equivalent solution|outcome.based|vendor.neutral|technology agnostic)\b/i.test(text);
  const buyerContext = sections[0].score >= 67 && sections[1].score >= 67;
  const sectionAverage = sections.reduce((sum, section) => sum + section.score, 0) / sections.length;
  const score = Math.max(0, Math.min(100, Math.round(sectionAverage * 0.7 + (evidence ? 10 : 0) + (evaluation ? 10 : 0) + (responseStructure ? 5 : 0) + (buyerContext ? 5 : 0))));
  const label = score >= 85 ? "Procurement-ready" : score >= 70 ? "Strong" : score >= 45 ? "Usable foundation" : "Needs work";
  const coreKeys = ["organisation_scale", "solution_scope", "current_estate", "resilience_availability", "security_identity_data", "operating_model_support", "migration_implementation"];
  const validBaseline = wordCount >= 150 && questionCount >= 5 && coreKeys.every((key) => (sections.find((section) => section.key === key)?.score ?? 0) >= 34);

  const strengths = [
    ...(buyerContext ? ["Buyer context and solution scope are stated"] : []),
    ...(evidence ? ["Suppliers are asked for supporting evidence"] : []),
    ...(evaluation ? ["Evaluation or mandatory criteria are defined"] : []),
    ...(responseStructure ? ["A comparable supplier response format is specified"] : []),
    ...sections.filter((section) => section.score === 100).slice(0, 3).map((section) => `${section.title} has broad coverage`),
  ];
  const gaps = [
    ...sections.filter((section) => section.score < 67).map((section) => `${section.title}: add ${section.missing.join(", ")}`),
    ...(!evidence ? ["Ask suppliers for dated evidence, certificates, reports or comparable customer references"] : []),
    ...(!evaluation ? ["Define mandatory requirements, scoring or evaluation weightings"] : []),
    ...(!responseStructure ? ["Specify a common response and pricing format so bids can be compared"] : []),
  ];

  const detectedSector = SECTOR_RULES.find((sector) => sector.pattern.test(text)) ?? null;
  const sectorGaps = detectedSector
    ? detectedSector.checks.filter((check) => !check.pattern.test(text)).map((check) => `${detectedSector.label}: add ${check.label}`)
    : ["State the buyer's sector so Netify can apply sector-specific procurement checks"];
  gaps.splice(Math.min(2, gaps.length), 0, ...sectorGaps);

  const comparabilityWarnings = [
    ...(!mandatoryClarity ? ["Mandatory and desirable requirements are not clearly separated"] : []),
    ...(!responseStructure ? ["Suppliers are not given one common response structure"] : []),
    ...(!pricingStructure ? ["Pricing is not requested in a common one-off, recurring and total-cost structure"] : []),
    ...(!evidenceCurrency ? ["Evidence requests do not state how current the evidence must be"] : []),
  ];
  const vendorNeutralityWarnings = namedVendors.length && !equivalentAllowed
    ? [`Named provider${namedVendors.length === 1 ? "" : "s"} (${namedVendors.slice(0, 3).map((vendor) => vendor.name).join(", ")}) ${namedVendors.length === 1 ? "appears" : "appear"} without an “or equivalent” or outcome-based alternative`]
    : [];
  const missingRequirementCount = sections.reduce((sum, section) => sum + section.missing.length, 0)
    + Number(!evidence) + Number(!evaluation) + Number(!responseStructure)
    + sectorGaps.length + comparabilityWarnings.length + vendorNeutralityWarnings.length;

  const weakCategories = new Set(sections.filter((section) => section.score < 67).flatMap((section) => CATEGORY_FOR_SECTION[section.key] ?? []));
  const recommendedQuestions = QUESTION_BANK.canonical
    .filter((question) => weakCategories.has(question.category) && !text.toLowerCase().includes(question.text.toLowerCase().slice(0, 45)))
    .filter((question, index, all) => all.findIndex((candidate) => candidate.category === question.category) === index)
    .slice(0, 8)
    .map((question) => ({ id: question.id, category: question.category, text: question.text, reason: `Closes a gap in ${question.category}.` }));

  return {
    assessmentVersion: RFP_VALIDATION_VERSION,
    score,
    label,
    wordCount,
    questionCount,
    missingRequirementCount,
    validBaseline,
    sections,
    strengths: strengths.length ? strengths : ["The original wording has been preserved for review"],
    gaps: gaps.slice(0, 14),
    recommendedQuestions,
    sector: { detected: detectedSector?.key ?? null, label: detectedSector?.label ?? null, gaps: sectorGaps },
    comparabilityWarnings,
    vendorNeutralityWarnings,
    bank: { version: BANK_VERSION, totalQuestions: bankTotal(), extendedQuestions: SASE_EXTENDED_BANK.questions.length },
  };
}
