/**
 * Live Sourcing Workspace: the draft model (W0 slice 2, spec v1.3 sections
 * 3 and 4). PURE: no I/O, no React, usable identically by the page and by
 * the MCP loop, so a person and an agent hold the same object (Mandate).
 *
 * The model is a FACT LEDGER. Every extracted or answered value is one
 * fact carrying its provenance (stated with the buyer's quote, or inferred
 * with the inference named: truth rule 2). The requirement the engine
 * assesses is DERIVED from the standing facts; striking a fact out removes
 * it from the derivation, which is what makes corrections ripple: verdict,
 * brief, diagram and fit are all downstream of the ledger.
 *
 * Resurrection rule: a struck fact returns only when the buyer STATES it
 * again; a model re-inference never overrides a buyer's strike-out.
 */

import type { SecurityRequirementInput, SecurityScopeVerdict } from "@/lib/security/rulebook";
import { humaniseSecurityCodes } from "@/lib/security/labels";
import {
  applyUpdates,
  LIST_FACT_PATHS,
  WORKSPACE_SECTORS,
  type AllowedPath,
  type BuyingId,
  type FieldUpdate,
  type OperatingModelId,
} from "@/lib/workspace/extract";

/* ------------------------------------------------------------------ */
/* Facts                                                               */
/* ------------------------------------------------------------------ */

export type FactSource = "extract" | "answer" | "link";

export interface WorkspaceFact extends FieldUpdate {
  /** Stable identity: the path for scalars, path plus value for lists. */
  id: string;
  struck: boolean;
  source: FactSource;
  /** The cycle that produced or last changed this fact (ripple display). */
  cycle: number;
}

/** Paths that accumulate values; everything else holds one value (one
 *  truth with the extraction layer's union merge). */
const LIST_PATHS = LIST_FACT_PATHS;

const norm = (v: unknown) => String(v).trim().toLowerCase();

export function factId(path: AllowedPath, value: unknown): string {
  return LIST_PATHS.has(path) ? `${path}:${norm(value)}` : path;
}

/** Split a validated update into per-value facts (lists arrive as arrays). */
function explode(u: FieldUpdate): Array<{ update: FieldUpdate; id: string }> {
  if (LIST_PATHS.has(u.path) && Array.isArray(u.value)) {
    return u.value.map((v) => ({ update: { ...u, value: v }, id: factId(u.path, v) }));
  }
  return [{ update: u, id: factId(u.path, u.value) }];
}

export interface MergeResult {
  facts: WorkspaceFact[];
  /** Fact ids created or changed by this merge, for the ripple highlight. */
  changed: string[];
}

export function mergeUpdates(
  prev: WorkspaceFact[],
  updates: FieldUpdate[],
  cycle: number,
  source: FactSource = "extract",
): MergeResult {
  const facts = prev.map((f) => ({ ...f }));
  const byId = new Map(facts.map((f) => [f.id, f]));
  const changed: string[] = [];

  for (const raw of updates) {
    for (const { update, id } of explode(raw)) {
      const existing = byId.get(id);
      if (!existing) {
        const fact: WorkspaceFact = { ...update, id, struck: false, source, cycle };
        facts.push(fact);
        byId.set(id, fact);
        changed.push(id);
        continue;
      }
      const sameValue = norm(existing.value) === norm(update.value);
      if (existing.struck) {
        // The buyer struck this out. Only their own words bring it back.
        if (update.provenance === "stated" || source === "answer") {
          Object.assign(existing, update, { id, struck: false, source, cycle });
          changed.push(id);
        }
        continue;
      }
      if (!sameValue) {
        // Scalar correction: the new value replaces the old, visibly.
        Object.assign(existing, update, { id, source, cycle });
        changed.push(id);
      } else if (existing.provenance === "inferred" && update.provenance === "stated") {
        // The buyer has now said in words what was only inferred: upgrade.
        Object.assign(existing, update, { id, source, cycle });
        changed.push(id);
      }
    }
  }
  return { facts, changed };
}

export const standing = (facts: WorkspaceFact[]): WorkspaceFact[] => facts.filter((f) => !f.struck);

/** The engine's requirement, derived from the standing facts only. */
export function requirementFrom(facts: WorkspaceFact[]): SecurityRequirementInput {
  const updates: FieldUpdate[] = standing(facts).map((f) =>
    LIST_PATHS.has(f.path) ? { ...f, value: [f.value] } : { ...f },
  );
  return applyUpdates({}, updates);
}

const lastStanding = (facts: WorkspaceFact[], path: AllowedPath): WorkspaceFact | undefined => {
  const xs = standing(facts).filter((f) => f.path === path);
  return xs[xs.length - 1];
};

export const buyingOf = (facts: WorkspaceFact[]): BuyingId | null =>
  (lastStanding(facts, "procurement.buying")?.value as BuyingId | undefined) ?? null;

export const operatingModelOf = (facts: WorkspaceFact[]): OperatingModelId | null =>
  (lastStanding(facts, "procurement.operatingModel")?.value as OperatingModelId | undefined) ?? null;

/* ------------------------------------------------------------------ */
/* Vocabulary labels (display only; internal values never change)      */
/* ------------------------------------------------------------------ */

export const BUYING_LABELS: Record<BuyingId, string> = {
  managed_security: "managed security services",
  sase: "a SASE service",
  sdwan: "an SD-WAN service",
  sse: "an SSE (secure service edge) service",
};

export const BUYING_SHORT: Record<BuyingId, string> = {
  managed_security: "Managed security",
  sase: "SASE",
  sdwan: "SD-WAN",
  sse: "SSE",
};

export const OPERATING_MODEL_LABELS: Record<OperatingModelId, string> = {
  managed: "fully managed",
  co_managed: "co-managed",
  diy: "self-managed",
};

export const CLOUD_LABELS: Record<string, string> = {
  m365: "Microsoft 365",
  google: "Google Workspace",
  aws: "AWS",
  azure: "Azure",
  other_saas: "other SaaS",
};

export const NETWORK_LABELS: Record<string, string> = {
  btnet: "BTnet",
  bt_broadband: "BT Broadband",
  mpls: "MPLS",
  sdwan: "SD-WAN",
  vpn: "VPN",
  leased_line: "leased lines",
  broadband: "broadband",
};

export const REGION_LABELS: Record<string, string> = {
  uk: "the UK",
  ie: "Ireland",
  eu: "Europe",
  us: "North America",
  apac: "Asia Pacific",
  me: "the Middle East",
};

/** Standalone forms for chips, table rows and the notice-inherits row:
 *  "the UK" reads right inside a sentence ("across the UK") and wrong as
 *  a freestanding value (Harry's Section 1 finding, 28 Jul 2026: the
 *  Countries row showed "the UK"). Sentences keep REGION_LABELS; anything
 *  freestanding renders through regionStandalone(). */
export const REGION_LABELS_STANDALONE: Record<string, string> = {
  uk: "UK",
  ie: "Ireland",
  eu: "Europe",
  us: "North America",
  apac: "Asia Pacific",
  me: "Middle East",
};
export function regionStandalone(id: string): string {
  return REGION_LABELS_STANDALONE[id] ?? REGION_LABELS[id] ?? id;
}

export const COMPLIANCE_LABELS: Record<string, string> = {
  iso27001: "ISO 27001",
  pci_dss: "PCI DSS",
  cyber_essentials_plus: "Cyber Essentials Plus",
  fca: "FCA obligations",
  nhs_dspt: "NHS DSPT",
  nis2: "NIS2",
  uk_gdpr: "UK GDPR",
};

export const DRIVER_PHRASES: Record<string, string> = {
  incident: "a security incident, had or ongoing",
  audit: "an audit",
  compliance: "compliance obligations",
  renewal: "a contract renewal",
  growth: "growth or change",
  consolidation: "consolidating point tools",
  ransomware_concern: "ransomware concern",
};

export const SOC_LABELS: Record<string, string> = {
  none: "no out-of-hours security cover",
  business_hours: "security cover during business hours only",
  twenty_four_seven: "24/7 in-house security operations",
};

/**
 * Authoritative path+value -> buyer-facing text formatter (Milestone 1,
 * Commit 9B prerequisite): the same switch that used to live directly
 * inside factLabel(), extracted unchanged so a caller that has a path and
 * a value — but not a full WorkspaceFact (id/struck/source/cycle) — can
 * still reach the one true formatting rule instead of either fabricating
 * those missing fact fields or standing up a second, independently
 * maintained copy of this dispatch (see the Commit 9B-prep stop report).
 *
 * Behaviour-preserving extraction only: every branch, every table
 * reference and the default `String(value)` fallback are identical to
 * factLabel()'s pre-Commit-9B-prerequisite body. Nothing here is new
 * formatting, and no label table was copied, altered or added — every
 * case still reads from the same exported tables above.
 */
export function humaniseWorkspaceValue(path: AllowedPath, value: unknown): string {
  const v = String(value);
  switch (path) {
    case "estate.cloud": return CLOUD_LABELS[v] ?? v;
    case "estate.existingNetwork": return NETWORK_LABELS[v] ?? v;
    case "organisation.regions": return REGION_LABELS[v] ?? v;
    case "constraints.complianceRequirements": return COMPLIANCE_LABELS[v] ?? v;
    case "drivers": return DRIVER_PHRASES[v] ?? v;
    case "constraints.inHouseSocCapacity": return SOC_LABELS[v] ?? v;
    case "procurement.buying": return BUYING_LABELS[v as BuyingId] ?? v;
    case "procurement.operatingModel": return OPERATING_MODEL_LABELS[v as OperatingModelId] ?? v;
    default: return v;
  }
}

/** The single buyer-facing value voice (ProjectDesk.tsx's own description
 *  of this function, unchanged): delegates every path/value decision to
 *  humaniseWorkspaceValue() above, reading only fact.path and fact.value —
 *  no other WorkspaceFact field (id/struck/source/cycle/provenance/quote/
 *  reason) has ever been part of this function's output. */
export function factLabel(f: WorkspaceFact): string {
  return humaniseWorkspaceValue(f.path, f.value);
}

/* ------------------------------------------------------------------ */
/* Bridges into the existing publish machinery (one vocabulary, mapped */
/* at the boundary; the workspace never invents a parallel schema)     */
/* ------------------------------------------------------------------ */

/** Workspace region ids to the marketplace's canonical REGION_KEYS. */
const REGION_BRIDGE: Record<string, string> = {
  uk: "uk_ireland",
  ie: "uk_ireland",
  eu: "europe",
  us: "north_america",
  apac: "asia_pacific",
  me: "middle_east_africa",
};

export function wizardRegions(regions: string[]): string[] {
  return [...new Set(regions.map((r) => REGION_BRIDGE[r]).filter(Boolean))];
}

/** Engine compliance ids to the builder's keys where an equivalent exists
 *  (the same bridge create-project.ts applies for engine records). */
const COMPLIANCE_BRIDGE: Record<string, string> = { iso27001: "iso_27001" };
export function builderCompliance(list: string[]): string[] {
  return list.map((c) => COMPLIANCE_BRIDGE[c] ?? c);
}

export function productScopeFor(buying: BuyingId): "full_sase" | "sdwan_only" | "sse_only" | "not_stated" {
  // managed_security states a service need, not a technology scope: it
  // records not_stated instead of implying Full SASE (intake-truth ruling,
  // 28 Jul 2026). SASE, SD-WAN and SSE remain the buyer's own words.
  return buying === "sdwan" ? "sdwan_only" : buying === "sse" ? "sse_only" : buying === "sase" ? "full_sase" : "not_stated";
}

/** Workspace sector labels to the wizard's SECTOR_KEYS. */
const SECTOR_KEY_BRIDGE: Record<string, string> = {
  "Healthcare & pharma": "healthcare",
  "Financial services": "financial_services",
  "Retail & e-commerce": "retail_ecommerce",
  "Manufacturing": "manufacturing",
  "Energy & utilities": "energy_utilities",
  "Government & public sector": "government_public_sector",
  "Education": "education",
  "Transport & logistics": "transport_logistics",
  "Professional services": "professional_services",
  "Hospitality & leisure": "hospitality_leisure",
};
export function wizardSectorKey(label: string | undefined): string | null {
  return (label && SECTOR_KEY_BRIDGE[label]) || null;
}

/** Coarse public band for the anonymous board card; never the raw number
 *  (same banding the requirement page's dual-state preview uses). */
export function usersBandLabel(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  if (n < 50) return "Under 50 users";
  if (n < 250) return "50 to 250 users";
  if (n < 500) return "250 to 500 users";
  if (n < 1000) return "500 to 1,000 users";
  if (n < 5000) return "1,000 to 5,000 users";
  return "Over 5,000 users";
}

/* ------------------------------------------------------------------ */
/* The confirmation meter                                              */
/* ------------------------------------------------------------------ */

export interface Meter {
  confirmed: number;   // facts in the buyer's own words (stated or answered)
  inferred: number;    // standing inferences, published labelled as assumptions
  struck: number;
  total: number;       // standing facts
  percent: number;     // confirmed / total
  engineAssumptions: number; // the verdict's own labelled assumptions
}

export function meterOf(facts: WorkspaceFact[], verdict: SecurityScopeVerdict | null): Meter {
  const live = standing(facts);
  const confirmed = live.filter((f) => f.provenance === "stated").length;
  const inferred = live.length - confirmed;
  const struck = facts.length - live.length;
  return {
    confirmed,
    inferred,
    struck,
    total: live.length,
    percent: live.length === 0 ? 0 : Math.round((confirmed / live.length) * 100),
    engineAssumptions: verdict?.assumptions.length ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* The living brief: document model                                    */
/* ------------------------------------------------------------------ */

export type Seg =
  | { kind: "text"; text: string }
  | { kind: "fact"; fact: WorkspaceFact; text: string }
  | { kind: "gap"; gap: BriefGap };

export interface BriefGap {
  key: string;
  question: string;
  /** null: not answerable inline; it can only be accepted at signature. */
  path: AllowedPath | null;
  control: "number" | "chips" | "text";
  options?: Array<{ value: string; label: string }>;
  whyItMatters?: string;
}

export interface MarginNote {
  title: string;
  body: string;
  tone: "reasoning" | "against_interest" | "note";
}

export interface BriefBlock {
  key: string;
  heading?: string;
  paras: Seg[][];
  margin?: MarginNote[];
}

export interface BriefModel {
  title: string;
  blocks: BriefBlock[];
  /** The verdict's labelled assumptions, rendered as a document section. */
  assumptions: string[];
  /** Gap keys already answerable inline (for the sign gate's count). */
  openGaps: BriefGap[];
}

const t = (text: string): Seg => ({ kind: "text", text });
const fs = (fact: WorkspaceFact, text?: string): Seg => ({ kind: "fact", fact, text: text ?? factLabel(fact) });

/** Join fact segments into prose: "a, b and c". */
function joinSegs(segs: Seg[], conj = "and"): Seg[] {
  const out: Seg[] = [];
  segs.forEach((s, i) => {
    if (i > 0) out.push(t(i === segs.length - 1 ? ` ${conj} ` : ", "));
    out.push(s);
  });
  return out;
}

const CAP_LABEL: Record<string, string> = {
  endpoint: "endpoint protection",
  mdr_soc: "managed detection and response",
  sse: "secure service edge",
  siem_logging: "SIEM and logging",
  managed_firewall: "managed firewall",
  awareness: "security awareness training",
  email_security: "email security",
  backup_resilience: "backup and resilience",
};
export const capLabel = (id: string): string => CAP_LABEL[id] ?? id.replace(/_/g, " ");

const SOC_OPTIONS = [
  { value: "none", label: "None" },
  { value: "business_hours", label: "Business hours" },
  { value: "twenty_four_seven", label: "24/7" },
];

const BUYING_OPTIONS = (Object.keys(BUYING_SHORT) as BuyingId[]).map((v) => ({ value: v, label: BUYING_SHORT[v] }));

const MODEL_OPTIONS = (Object.keys(OPERATING_MODEL_LABELS) as OperatingModelId[]).map((v) => ({
  value: v,
  label: OPERATING_MODEL_LABELS[v].replace(/^./, (c) => c.toUpperCase()),
}));

/** Map a verdict gap onto an inline answer control. */
function gapControl(field: string, question: string, whyItMatters?: string): BriefGap | null {
  const base = { key: field, question, whyItMatters };
  if (field === "estate.users" || field === "estate.sites") {
    return { ...base, path: field as AllowedPath, control: "number" };
  }
  if (field === "constraints.inHouseSocCapacity") {
    return { ...base, path: field as AllowedPath, control: "chips", options: SOC_OPTIONS };
  }
  if (field === "organisation.sector") {
    return {
      ...base,
      path: "organisation.sector",
      control: "chips",
      options: WORKSPACE_SECTORS.map((s) => ({ value: s, label: s })),
    };
  }
  if (field === "drivers") {
    return {
      ...base,
      path: "drivers",
      control: "chips",
      options: Object.entries(DRIVER_PHRASES).map(([value, label]) => ({ value, label })),
    };
  }
  if (field === "estate.cloud") {
    return {
      ...base,
      path: "estate.cloud",
      control: "chips",
      options: Object.entries(CLOUD_LABELS).map(([value, label]) => ({ value, label })),
    };
  }
  if (field === "estate.existingSecurity" || field === "estate.existingNetwork") {
    return { ...base, path: field as AllowedPath, control: "text" };
  }
  if (field.startsWith("constraints.")) {
    const p = field as AllowedPath;
    if (p === "constraints.timeline" || p === "constraints.budgetBand" || p === "constraints.complianceRequirements") {
      if (p === "constraints.complianceRequirements") {
        return { ...base, path: p, control: "chips", options: Object.entries(COMPLIANCE_LABELS).map(([value, label]) => ({ value, label })) };
      }
      return { ...base, path: p, control: "text" };
    }
  }
  return null; // a gap the page cannot answer inline stays a listed question
}

export function briefModel(opts: {
  facts: WorkspaceFact[];
  verdict: SecurityScopeVerdict | null;
}): BriefModel {
  const { facts, verdict } = opts;
  const all = facts; // struck facts stay visible, struck, until un-struck
  const live = standing(facts);
  const at = (path: AllowedPath) => all.filter((f) => f.path === path);
  const one = (path: AllowedPath) => at(path)[at(path).length - 1];
  const liveOne = (path: AllowedPath) => live.filter((f) => f.path === path).slice(-1)[0];

  const buying = buyingOf(facts);
  const opModel = operatingModelOf(facts);
  const securityScope = buying === "managed_security" || buying === null;
  const networkScope = buying === "sase" || buying === "sdwan" || buying === "sse";

  const gapByField = new Map<string, BriefGap>();
  if (verdict && securityScope) {
    for (const g of verdict.gaps) {
      const c = gapControl(g.field, g.question, g.whyItMatters);
      if (c) gapByField.set(g.field, c);
    }
  }
  const consumedGaps = new Set<string>();
  const gapSeg = (field: string): Seg | null => {
    const g = gapByField.get(field);
    if (!g) return null;
    consumedGaps.add(field);
    return { kind: "gap", gap: g };
  };

  const blocks: BriefBlock[] = [];

  /* ---- The organisation ---- */
  {
    const paras: Seg[][] = [];
    const p: Seg[] = [t("The buyer is a ")];
    const sector = one("organisation.sector");
    if (sector) p.push(fs(sector), t(" organisation"));
    else {
      const g = gapSeg("organisation.sector");
      if (g) p.push(t("company ("), g, t(")"));
      else p.push(t("company"));
    }
    const sites = one("estate.sites");
    const users = one("estate.users");
    if (sites) p.push(t(" operating "), fs(sites), t(Number(sites.value) === 1 ? " site" : " sites"));
    else {
      const g = gapSeg("estate.sites");
      if (g) p.push(t(" operating "), g, t(" sites"));
    }
    if (users) p.push(t(sites ? " with " : " with "), fs(users), t(" staff"));
    else {
      const g = gapSeg("estate.users");
      if (g) p.push(t(" with "), g, t(" staff"));
    }
    const regions = at("organisation.regions");
    if (regions.length) p.push(t(" across "), ...joinSegs(regions.map((r) => fs(r))));
    p.push(t("."));
    paras.push(p);

    // What is being bought: the sentence that steers the whole surface.
    const buyFact = one("procurement.buying");
    const modelFact = one("procurement.operatingModel");
    const b: Seg[] = [t("It is buying ")];
    if (buyFact) b.push(fs(buyFact));
    else b.push({ kind: "gap", gap: { key: "procurement.buying", question: "What are you buying?", path: "procurement.buying", control: "chips", options: BUYING_OPTIONS } });
    if (modelFact) b.push(t(", delivered "), fs(modelFact));
    else if (buyFact) b.push(t(", delivered "), { kind: "gap", gap: { key: "procurement.operatingModel", question: "Delivered how?", path: "procurement.operatingModel", control: "chips", options: MODEL_OPTIONS } });
    b.push(t("."));
    paras.push(b);

    blocks.push({ key: "organisation", heading: "The organisation", paras });
  }

  /* ---- Estate and current position ---- */
  {
    const paras: Seg[][] = [];
    const clouds = at("estate.cloud");
    if (clouds.length) paras.push([t("The estate runs on "), ...joinSegs(clouds.map((c) => fs(c))), t(".")]);
    const sec = at("estate.existingSecurity");
    if (sec.length) paras.push([t("Security tooling already in place: "), ...joinSegs(sec.map((s) => fs(s))), t(".")]);
    const net = at("estate.existingNetwork");
    if (net.length) paras.push([t("The network estate today: "), ...joinSegs(net.map((n) => fs(n))), t(".")]);
    const cloudGap = gapSeg("estate.cloud");
    if (!clouds.length && cloudGap) paras.push([t("Cloud platforms: "), cloudGap]);
    if (paras.length) blocks.push({ key: "estate", heading: "Estate and current position", paras });
  }

  /* ---- Providers and vendors (PKM extension) ---- */
  {
    const paras: Seg[][] = [];
    const tech = at("estate.namedTechnologies");
    if (tech.length) paras.push([t("Named technologies already in place: "), ...joinSegs(tech.map((f) => fs(f))), t(".")]);
    const providers = at("estate.existingProviders");
    if (providers.length) paras.push([t("Existing providers: "), ...joinSegs(providers.map((f) => fs(f))), t(".")]);
    const considering = at("procurement.vendorsUnderConsideration");
    // "Under consideration, not yet selected" is hard-coded into the
    // projection's own prose, not derived from the buyer's words: the
    // document itself carries the same guarantee the path name carries,
    // so a mention here can never read as a selection.
    if (considering.length) paras.push([t("Under consideration, not yet selected: "), ...joinSegs(considering.map((f) => fs(f))), t(".")]);
    if (paras.length) blocks.push({ key: "vendors", heading: "Providers and vendors", paras });
  }

  /* ---- Locations and site resilience (PKM extension) ---- */
  {
    const paras: Seg[][] = [];
    const locations = at("estate.namedLocations");
    if (locations.length) paras.push([t("Named locations: "), ...joinSegs(locations.map((f) => fs(f))), t(".")]);
    // Each criticality clause and each resilience clause renders as its own
    // paragraph, in the order captured: nothing here joins a criticality
    // clause to a resilience clause, or infers that a resilience clause
    // applies to a location named in a different clause.
    for (const f of at("estate.locationCriticality")) paras.push([fs(f), t(".")]);
    for (const f of at("estate.siteResilience")) paras.push([fs(f), t(".")]);
    if (paras.length) blocks.push({ key: "locations", heading: "Locations and site resilience", paras });
  }

  /* ---- Why now ---- */
  {
    const paras: Seg[][] = [];
    const drivers = at("drivers");
    if (drivers.length) paras.push([t("This project is prompted by "), ...joinSegs(drivers.map((d) => fs(d))), t(".")]);
    else {
      const g = gapSeg("drivers");
      if (g) paras.push([t("What is prompting it: "), g]);
    }
    const timeline = one("constraints.timeline");
    if (timeline) paras.push([t("Timeline: "), fs(timeline), t(".")]);
    if (paras.length) blocks.push({ key: "drivers", heading: "Why now", paras });
  }

  /* ---- Compliance and operations ---- */
  {
    const paras: Seg[][] = [];
    const comp = at("constraints.complianceRequirements");
    if (comp.length) paras.push([t("The service must support "), ...joinSegs(comp.map((c) => fs(c))), t(".")]);
    const soc = one("constraints.inHouseSocCapacity");
    if (soc) paras.push([t("In-house operations: "), fs(soc), t(".")]);
    else {
      const g = gapSeg("constraints.inHouseSocCapacity");
      if (g) paras.push([t("Out-of-hours security cover: "), g]);
    }
    const budget = one("constraints.budgetBand");
    if (budget) paras.push([t("Budget position: "), fs(budget), t(".")]);
    if (paras.length) blocks.push({ key: "operations", heading: "Compliance and operations", paras });
  }

  /* ---- Services required (the verdict as prose, security scope) ---- */
  if (verdict && securityScope && live.length > 0) {
    const paras: Seg[][] = [];
    const margin: MarginNote[] = [];
    const req = verdict.summary.recommended;
    const cond = verdict.summary.conditional;
    if (req.length) {
      paras.push([t("The requirement covers "), ...joinSegs(req.map((c) => t(capLabel(c)))), t(", under the Netify rulebook "), t(verdict.rulebookVersion), t(` at ${verdict.confidence} confidence.`)]);
      for (const capId of req) {
        const cap = verdict.capabilities.find((c) => c.id === capId);
        // Working render points read like the chips (Harry's retest NF1):
        // codes humanise at display; the verdict itself is never rewritten.
        if (cap) margin.push({ title: capLabel(capId), body: humaniseSecurityCodes(cap.reasoning), tone: "reasoning" });
      }
    }
    if (cond.length) {
      paras.push([t("Worth including, kept or dropped at your review: "), ...joinSegs(cond.map((c) => t(capLabel(c)))), t(".")]);
    }
    for (const n of verdict.summary.not_recommended) {
      paras.push([t(`Not recommended: ${capLabel(n.capabilityId)}. ${humaniseSecurityCodes(n.reason)}`), ...(n.alternative ? [t(` ${humaniseSecurityCodes(n.alternative)}`)] : [])]);
    }
    for (const a of verdict.againstInterest) {
      margin.push({ title: "Against Netify's own interest", body: humaniseSecurityCodes(a.statement), tone: "against_interest" });
    }
    if (paras.length) blocks.push({ key: "services", heading: "Services required", paras, margin });
  }

  /* ---- Scope of supply (network scope) ---- */
  if (networkScope && buying) {
    const paras: Seg[][] = [];
    const scopeSentence: Record<string, string> = {
      sase: "A single requirement covering secure access and the wide-area network: SASE, with SD-WAN as its network component.",
      sdwan: "An SD-WAN service: the network component of a SASE architecture, scoped here without the security service edge.",
      sse: "A secure service edge (SSE): the security half of SASE, running over the existing network.",
    };
    paras.push([t(scopeSentence[buying])]);
    paras.push([
      t("Publishing issues the Netify question set for this scope under methodology v2026.1, matched to the sector and compliance stated above, and invites the best-fit evaluated vendors alongside any you pin below."),
    ]);
    blocks.push({ key: "scope", heading: "Scope of supply", paras });
  }

  /* ---- Additional requirements (PKM extension bespoke catch-all) ---- */
  {
    const bespoke = at("requirements.bespoke");
    if (bespoke.length) {
      blocks.push({
        key: "bespoke",
        heading: "Additional requirements",
        paras: bespoke.map((f) => [fs(f), t(".")]),
      });
    }
  }

  const openGaps = [...gapByField.entries()].filter(([f]) => !consumedGaps.has(f)).map(([, g]) => g);

  /* ---- Remaining gaps as open blanks ---- */
  if (openGaps.length) {
    blocks.push({
      key: "gaps",
      heading: "Only you can answer these",
      paras: openGaps.map((g) => [{ kind: "gap", gap: g } as Seg]),
    });
  }

  /* ---- Title ---- */
  const sector = liveOne("organisation.sector");
  const sites = liveOne("estate.sites");
  const titleParts = [buying ? BUYING_SHORT[buying] : "Sourcing", "requirement"];
  const titleTail: string[] = [];
  if (sector) titleTail.push(String(sector.value));
  if (sites) titleTail.push(`${sites.value} sites`);
  const title = `${titleParts.join(" ")}${titleTail.length ? ": " + titleTail.join(", ") : ""}`;

  // The verdict recomputes from the standing facts every cycle, so its gap
  // list IS the open-gap list: answering a gap removes it at the source.
  const allOpenGaps =
    verdict && securityScope
      ? verdict.gaps.map(
          (g) =>
            gapByField.get(g.field) ?? {
              key: g.field,
              question: g.question,
              path: null, // answerable only by acceptance at the signature
              control: "text" as const,
            },
        )
      : [];

  return {
    title,
    blocks,
    assumptions: verdict && securityScope ? verdict.assumptions.map(humaniseSecurityCodes) : [],
    openGaps: allOpenGaps,
  };
}

/**
 * The living brief flattened to plain text: the SAME composed document the
 * page renders, for agents reading over MCP (Mandate: a person and an
 * agent hold the same artefact). Provenance survives flattening: each fact
 * carries [stated] or [inferred], struck facts render struck, and blanks
 * render as the questions they are.
 */
export function briefText(model: BriefModel): string {
  const lines: string[] = [`# ${model.title}`, ""];
  for (const b of model.blocks) {
    if (b.heading) lines.push(`## ${b.heading}`);
    for (const p of b.paras) {
      const text = p
        .map((s) => {
          if (s.kind === "text") return s.text;
          if (s.kind === "fact") {
            const mark = s.fact.provenance === "stated" ? "stated" : "inferred";
            return s.fact.struck ? `~~${s.text}~~ [struck out]` : `${s.text} [${mark}]`;
          }
          return `____ (${s.gap.question})`;
        })
        .join("");
      lines.push(text);
    }
    for (const m of b.margin ?? []) {
      lines.push(`> ${m.tone === "against_interest" ? "Against Netify's own interest: " : `${m.title}: `}${m.body}`);
    }
    lines.push("");
  }
  if (model.assumptions.length) {
    lines.push("## Working assumptions (published labelled as assumptions)");
    for (const a of model.assumptions) lines.push(`- ${a} [assumed]`);
    lines.push("");
  }
  if (model.openGaps.length) {
    lines.push("## Open questions only the buyer can answer");
    for (const g of model.openGaps) lines.push(`- ${g.question}`);
  }
  return lines.join("\n").trim();
}
