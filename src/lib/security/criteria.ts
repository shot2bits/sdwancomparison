/**
 * Netify Security Sourcing: the criteria map (Phase B step 3).
 * Adapter-side selection ONLY: maps rulebook capabilities to question bank
 * v2026.1 sections and returns questions in the EXISTING RfpQuestion shape.
 * It authors nothing: texts come from the canonical bank; evidence and
 * rationale enrichment comes from the extended bank's own why_it_matters
 * and evidence_required fields (acceptance check 6: traceability).
 *
 * The bank is SASE-centred, so where its coverage of a capability is thin
 * (endpoint) the mapping says so honestly via the capability's own scope
 * statement in generate-rfp rather than pretending coverage exists here.
 */

import { QUESTION_BANK, BANK_VERSION, SASE_EXTENDED_BANK, type ExtendedSaseQuestion } from "@/lib/rfp-question-bank";
import type { CapabilityId } from "@/lib/security/rulebook";
import type { RfpQuestion, RfpSection } from "@/lib/rfp-types";

const EXTENDED: ExtendedSaseQuestion[] = SASE_EXTENDED_BANK.questions;

/** Canonical bank category names, from rfp-question-bank v2026.1. */
export const CAPABILITY_BANK_MAP: Record<CapabilityId, string[]> = {
  endpoint: ["FWaaS / Threat"],
  mdr_soc: ["FWaaS / Threat", "Logging / SIEM", "Service Model"],
  sse: ["Identity / ZTNA", "SWG / CASB / DLP"],
  siem_logging: ["Logging / SIEM", "Data Residency"],
  managed_firewall: ["FWaaS / Threat", "Deployment"],
  awareness: [],            // service, no bank section; statement-only
  email_security: [],       // declined category; never mapped
  backup_resilience: [],    // buyer-side; never mapped
};

/** Core sections every service-path document carries regardless of mix. */
export const SERVICE_PATH_CORE_CATEGORIES = ["Service Model", "Commercials", "Vendor Evidence"];

const CATEGORY_TO_EXTENDED_ID: Record<string, string> = {
  "Identity / ZTNA": "identity_ztna",
  "SWG / CASB / DLP": "swg_casb_dlp",
  "FWaaS / Threat": "fwaas_threat",
  "SD-WAN Integration": "sdwan_integration",
  "Logging / SIEM": "logging_siem",
  "Data Residency": "data_residency",
  "Service Model": "service_model",
  "Deployment": "deployment",
  "Commercials": "commercials",
  "Vendor Evidence": "vendor_evidence",
};

/** What drives a question into the document: the strongest need among the
 *  capabilities that wanted its category. required outranks recommended. */
export type CategoryNeed = "required" | "recommended";

function enrich(
  q: { id: string; category: string; text: string },
  need: CategoryNeed,
  drivers: string[],
): RfpQuestion {
  const extCat = CATEGORY_TO_EXTENDED_ID[q.category];
  const ext = EXTENDED.find(
    (e) => e.category_id === extCat && e.question.trim().toLowerCase() === q.text.trim().toLowerCase(),
  ) ?? EXTENDED.find((e) => e.category_id === extCat);
  const provenance = `${need === "required" ? "Required" : "Conditional (recommended)"} capability: ${drivers.join(", ")}. Question bank v${BANK_VERSION}.`;
  const evidence = ext?.evidence_required?.length
    ? ext.evidence_required.join("; ")
    : "State how this is delivered and evidence it.";
  return {
    id: q.id,
    feature_id: q.category,
    text: q.text,
    evidence_requested: evidence,
    rationale: ext?.why_it_matters ? `${ext.why_it_matters} ${provenance}` : provenance,
    priority: need,
    source: "bank",
    buyer_lens: "",
    supplier_lens: "",
    mandatory: false,          // the buyer's flag to raise, never the engine's
    weight: need === "required" ? 4 : 3,
  };
}

export type CapabilityNeed = { id: CapabilityId; needed: "required" | "recommended" };

/**
 * Bank sections for the assessed capabilities: deterministic (bank order),
 * de-duplicated, every question enriched and traceable to the capability
 * that drove it. Where a category is wanted by both a required and a
 * recommended capability, required wins the question priority.
 */
export function bankSectionsFor(capabilities: CapabilityNeed[], servicePath: boolean): RfpSection[] {
  const need = new Map<string, { level: CategoryNeed; drivers: string[] }>();
  const want = (cat: string, level: CategoryNeed, driver: string) => {
    const cur = need.get(cat);
    if (!cur) { need.set(cat, { level, drivers: [driver] }); return; }
    if (!cur.drivers.includes(driver)) cur.drivers.push(driver);
    if (level === "required" && cur.level !== "required") cur.level = "required";
  };
  for (const cap of capabilities) {
    for (const cat of CAPABILITY_BANK_MAP[cap.id] ?? []) want(cat, cap.needed, cap.id);
  }
  if (servicePath) for (const cat of SERVICE_PATH_CORE_CATEGORIES) want(cat, "required", "service model");

  const byCategory = new Map<string, RfpQuestion[]>();
  for (const q of QUESTION_BANK.canonical) {
    const n = need.get(q.category);
    if (!n) continue;
    const list = byCategory.get(q.category) ?? [];
    list.push(enrich(q, n.level, n.drivers));
    byCategory.set(q.category, list);
  }
  // Bank order preserved for determinism.
  const ordered = [...new Set(QUESTION_BANK.canonical.map((q) => q.category))].filter((c) => byCategory.has(c));
  return ordered.map((category) => ({ category, included: true, questions: byCategory.get(category)! }));
}

export { BANK_VERSION };
