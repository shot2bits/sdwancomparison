/**
 * SEC-RULES-2026.1: the Netify Security Sourcing rulebook.
 * Approved by Robert Sturt on 21 July 2026 (review pack:
 * docs/netify-sec-rules-2026-1-review-pack.md in the project folder), with
 * his amendments encoded: the MDR-1 split (audit never over-prescribes),
 * the semantic SASE-escalation trigger (thresholds are implementation
 * detail, the rule is meaning), required-only path derivation, and the
 * summary block ("why we didn't recommend") as first-class output.
 *
 * THE NOTARY CONTRACT. This file is a rulebook, not a heuristic: every
 * verdict carries the rules that fired, the evidence behind them, labelled
 * assumptions, labelled gaps, and structured againstInterest entries where
 * the rules route away from Netify-monetised options. Certainty is never
 * claimed past the evidence (cannot_assess and the confidence caps are
 * structural). The verdict envelope is the Netify Notary standard: future
 * rulebooks (connectivity, SASE, UC and so on) emit the SAME envelope with
 * different capability vocabularies. Change the envelope only by versioned
 * evolution, never per-domain.
 *
 * POLICY BIND: BT partner-context material (segment sizings from partner
 * briefings) never appears here. Public thresholds only: BT's own SMB
 * positioning and the published 50-user BT Managed EDR marker.
 *
 * ONE TRUTH: the page advisor and the assess_security_requirement MCP tool
 * both call assessSecurityRequirement below. No client/server forks. Pure
 * module: no server-only import, no I/O; inputDigest uses WebCrypto, which
 * exists in both runtimes.
 */

export const RULEBOOK_VERSION = "SEC-RULES-2026.1";

/** Implementation detail of the semantic SSE-4 rule (Robert, 21 July: the
 *  rule is "the requirement has become a network-plus-security
 *  transformation"; the number may move between rulebook versions). */
const TRANSFORMATION_MIN_SITES = 3;

export type SecurityDriver =
  | "incident"
  | "audit"
  | "compliance"
  | "renewal"
  | "growth"
  | "consolidation"
  | "ransomware_concern";

export type SocCapacity = "none" | "business_hours" | "twenty_four_seven";

export type CapabilityId =
  | "endpoint"
  | "mdr_soc"
  | "sse"
  | "siem_logging"
  | "managed_firewall"
  | "awareness"
  | "email_security"
  | "backup_resilience";

export type Needed = "required" | "recommended" | "not_indicated" | "cannot_assess";

export type Route =
  | "bt_product"
  | "marketplace_service"
  | "other_bt"
  | "either"
  | "out_of_scope"
  | "escalate_sase"
  | null;

export interface SecurityRequirementInput {
  organisation?: {
    sector?: string;
    sizeBand?: "small" | "medium" | "large";
    regions?: string[];
  };
  estate?: {
    users?: number;
    sites?: number;
    devices?: { computers?: number; mobiles?: number; servers?: number };
    specialDevices?: Array<"chromebook" | "epos">;
    cloud?: string[];
    existingSecurity?: string[];
    existingNetwork?: string[];
  };
  drivers?: SecurityDriver[];
  constraints?: {
    complianceRequirements?: string[];
    inHouseSocCapacity?: SocCapacity;
    budgetBand?: string;
    timeline?: string;
  };
}

export interface CapabilityVerdict {
  id: CapabilityId;
  needed: Needed;
  reasoning: string;
  evidence: Array<{ source: string; claim: string }>;
  route: Route;
  routeDetail?: string;
  firedRules: string[];
}

export interface AgainstInterestEntry {
  capabilityId: CapabilityId;
  routeDenied: "bt_product" | "marketplace_service";
  statement: string;
  evidence?: string;
}

export interface SecurityScopeVerdict {
  rulebookVersion: typeof RULEBOOK_VERSION;
  questionBankVersion?: string;
  generatedAt: string;
  inputDigest: string;
  capabilities: CapabilityVerdict[];
  serviceModel: "fully_managed" | "co_managed" | "product_only" | null;
  pathRecommendation: "product_path" | "service_path" | "hybrid" | "escalate_sase" | null;
  againstInterest: AgainstInterestEntry[];
  assumptions: string[];
  gaps: Array<{ field: string; whyItMatters?: string; question: string }>;
  /** The doctor's explanation (approved amendment): what we recommended,
   *  what is conditional, and why we did NOT recommend things. Every
   *  rendering must show all three. */
  summary: {
    recommended: CapabilityId[];
    conditional: CapabilityId[];
    not_recommended: Array<{ capabilityId: CapabilityId; reason: string; alternative?: string }>;
  };
  confidence: "high" | "medium" | "low";
  nextSteps: Array<{ action: string; tool?: string; page?: string }>;
}

/* ------------------------------------------------------------------ */
/* Evidence sources, named once                                        */
/* ------------------------------------------------------------------ */

const EV = {
  claims: "Netify BT Endpoint Threat Protect claim set (public claims, reviewed 20 July 2026)",
  coverage: "Netify threat coverage matrix (the Threat Protect advisor rulebook)",
  edrMarker: "Public claim: BT Managed EDR sits above Endpoint Threat Protect for estates over 50 users (Netify editorial, fact-checked)",
  exclusions: "Public claim: Chromebooks and EPOS systems are not supported by Endpoint Threat Protect",
  suite: "BT SMB security suite public claims (Web Threat Protect, Cloud Threat Protect; renamed 20 May 2026)",
  fwOptions: "Published BT Fortinet and Meraki managed options; BTnet Security attach prices (£100/£200 per month)",
  grades: "Netify marketplace vendor evidence grades (SSE, SASE, MDR depth)",
  gradesLimit: "Netify dataset boundary: vendor grading is deepest in network security; managed SIEM shortlists are compiled per project",
  bank: "Netify question bank v2026.1, security and monitoring sections",
  amendment: "Approved amendment, Robert Sturt, 21 July 2026",
  precedence: "Existing-control precedence: never replace a graded control without a consolidation driver",
} as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const lc = (s: string) => s.toLowerCase();

function hasEdr(existing: string[]): string | null {
  const KNOWN = ["defender", "crowdstrike", "sentinelone", "sentinel one"];
  for (const item of existing) {
    const l = lc(item);
    for (const k of KNOWN) if (l.includes(k)) return item;
  }
  return null;
}

function wanInPlay(existingNetwork: string[]): boolean {
  return existingNetwork.some((n) => {
    const l = lc(n);
    return l.includes("mpls") || l.includes("sd-wan") || l.includes("sdwan");
  });
}

function btEstate(existingNetwork: string[]): boolean {
  return existingNetwork.some((n) => lc(n).includes("bt"));
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonicalise(v);
    }
    return out;
  }
  return value;
}

async function digest(input: SecurityRequirementInput): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(canonicalise(input)));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------------ */
/* The rulebook                                                        */
/* ------------------------------------------------------------------ */

export async function assessSecurityRequirement(
  input: SecurityRequirementInput,
): Promise<SecurityScopeVerdict> {
  const est = input.estate ?? {};
  const devices = est.devices ?? {};
  const users = typeof est.users === "number" && est.users > 0 ? est.users : undefined;
  const sites = typeof est.sites === "number" ? est.sites : undefined;
  const deviceTotal =
    (devices.computers ?? 0) + (devices.mobiles ?? 0) + (devices.servers ?? 0);
  const special = est.specialDevices ?? [];
  const cloud = est.cloud ?? [];
  const existingSecurityProvided = Array.isArray(est.existingSecurity);
  const existingSecurity = est.existingSecurity ?? [];
  const existingNetwork = est.existingNetwork ?? [];
  const driversProvided = Array.isArray(input.drivers) && input.drivers.length > 0;
  const drivers = input.drivers ?? [];
  const compliance = input.constraints?.complianceRequirements ?? [];
  const soc = input.constraints?.inHouseSocCapacity;

  const assumptions: string[] = [];
  const gaps: SecurityScopeVerdict["gaps"] = [];
  const againstInterest: AgainstInterestEntry[] = [];
  let confidenceCap: "high" | "medium" | "low" = "high";
  const cap = (level: "medium" | "low") => {
    if (level === "low" || confidenceCap === "low") confidenceCap = level === "low" ? "low" : confidenceCap;
    else confidenceCap = "medium";
  };

  /* Core-four presence and G-rules */
  const corePresent = [
    users !== undefined || deviceTotal > 0,
    driversProvided,
    existingSecurityProvided,
    soc !== undefined,
  ].filter(Boolean).length;

  if (!driversProvided) {
    assumptions.push("No stated driver: nothing is inferred, and incident is never assumed (G-2).");
    gaps.push({
      field: "drivers",
      whyItMatters: "Drivers decide whether detection and response is required or merely sensible.",
      question: "What is prompting this: an incident, an audit, compliance, a renewal, growth, or consolidation?",
    });
  }
  if (!existingSecurityProvided) {
    assumptions.push("No existing controls declared: keep-what-you-have rules are suspended (G-4).");
    gaps.push({
      field: "estate.existingSecurity",
      whyItMatters: "Existing graded controls change verdicts from buy to keep.",
      question: "What security tooling do you already run (for example Defender P2, CrowdStrike, an MSP service)?",
    });
    cap("medium");
  }
  if (users === undefined && deviceTotal === 0) {
    gaps.push({
      field: "estate.users",
      whyItMatters: "Scale decides the product-versus-managed-service boundary.",
      question: "How many staff, and roughly how many computers, mobiles and servers?",
    });
    cap("medium");
  }
  if (soc === undefined) {
    gaps.push({
      field: "constraints.inHouseSocCapacity",
      whyItMatters: "Detection without someone to respond is shelfware; this decides the service model.",
      question: "Do you have in-house security operations cover: none, business hours, or 24/7?",
    });
  }
  if (compliance.length === 0) {
    gaps.push({
      field: "constraints.complianceRequirements",
      whyItMatters: "Compliance regimes decide logging and evidence obligations (G-3 caps SIEM without it).",
      question: "Which compliance regimes apply (ISO 27001, PCI DSS, Cyber Essentials Plus, FCA, NHS DSPT, none)?",
    });
  }

  const insufficient = corePresent < 2; // G-5

  /* SSE-4: the semantic transformation test (approved amendment: the rule is
     meaning; the thresholds are the 2026.1 implementation of it). */
  const transformation =
    !insufficient &&
    (sites ?? 0) >= TRANSFORMATION_MIN_SITES &&
    wanInPlay(existingNetwork) &&
    (drivers.includes("renewal") || drivers.includes("consolidation"));

  const capabilities: CapabilityVerdict[] = [];
  const add = (v: CapabilityVerdict) => capabilities.push(v);

  const cannot = (id: CapabilityId, why: string): CapabilityVerdict => ({
    id,
    needed: "cannot_assess",
    reasoning: why,
    evidence: [],
    route: null,
    firedRules: ["G-5"],
  });

  if (insufficient) {
    /* G-5: honest degradation. Only the universally safe baseline survives. */
    const why =
      "Fewer than two of the core inputs (scale, drivers, existing controls, SOC capacity) were provided; assessing this capability would be guessing.";
    add(cannot("endpoint", why));
    add(cannot("mdr_soc", why));
    add(cannot("sse", why));
    add(cannot("siem_logging", why));
    add(cannot("managed_firewall", why));
    add({
      id: "awareness",
      needed: "recommended",
      reasoning:
        "Security awareness training is the one baseline safe to recommend with minimal context: people are in scope in every organisation.",
      evidence: [{ source: EV.coverage, claim: "Staff phishing is partly mitigated by tooling; training is the control." }],
      route: "either",
      firedRules: ["AWA-1"],
    });
    add(cannot("email_security", why));
    add(cannot("backup_resilience", why));
    cap("low");
  } else {
    /* ---------------- endpoint ---------------- */
    const incumbentEdr = existingSecurityProvided ? hasEdr(existingSecurity) : null;
    if (incumbentEdr && !drivers.includes("consolidation")) {
      add({
        id: "endpoint",
        needed: "not_indicated",
        reasoning: `You already run ${incumbentEdr}, a graded endpoint control. Replacing it without a consolidation driver buys nothing.`,
        evidence: [{ source: EV.precedence, claim: "Existing graded controls take precedence over new purchases." }],
        route: null,
        firedRules: ["END-2"],
      });
      againstInterest.push({
        capabilityId: "endpoint",
        routeDenied: "bt_product",
        statement: `You already run ${incumbentEdr}; endpoint replacement is not indicated. Spend nothing here.`,
        evidence: EV.precedence,
      });
    } else if (users === undefined && deviceTotal === 0) {
      add({
        id: "endpoint",
        needed: "required",
        reasoning: "Devices exist in every operating business; scale is needed before a route can be recommended (G-1).",
        evidence: [{ source: EV.claims, claim: "NGAV endpoint protection is the baseline control." }],
        route: "either",
        firedRules: ["END-1", "G-1"],
      });
    } else {
      const excluded = special.length > 0;
      const smallEnough = (users ?? 0) <= 50;
      if (smallEnough) {
        /* END-5 at SMB scale flags the exclusion honestly but keeps the
           product route (per pack F3): the covered devices are covered. */
        add({
          id: "endpoint",
          needed: "required",
          reasoning: excluded
            ? `Every declared device needs endpoint protection; at this scale BT Endpoint Threat Protect fits the computers and mobiles, but the declared ${special.join(" and ")} devices are not supported and would sit outside it. That exclusion is stated, not hidden.`
            : "Every declared device needs endpoint protection; at this scale BT Endpoint Threat Protect fits and can be ordered on the page.",
          evidence: [
            { source: EV.claims, claim: "Publicly priced at £4.99 per device per month; Windows, Mac, Linux, Android 9+, iOS 15+; servers supported." },
            ...(excluded ? [{ source: EV.exclusions, claim: "Chromebooks and EPOS are excluded from the SMB product." }] : []),
          ],
          route: "bt_product",
          routeDetail: excluded
            ? "BT Endpoint Threat Protect at £4.99 per device per month for the supported estate; the excluded devices are flagged as an unprotected remainder"
            : "BT Endpoint Threat Protect at £4.99 per device per month; complete and sign the order at netify.co.uk/bt-endpoint-threat-protect/",
          firedRules: excluded ? ["END-1", "END-3", "END-5"] : ["END-1", "END-3"],
        });
      } else {
        const detail: string[] = [
          "Above the 50-user marker BT Managed EDR sits over the SMB product (via a Netify consult), and full detection needs weigh towards managed service",
        ];
        if (excluded)
          detail.push(
            `Declared ${special.join(" and ")} devices are not supported by the SMB product and would sit unprotected on that route`,
          );
        const route: Route = drivers.includes("incident") || soc === "none" ? "marketplace_service" : "other_bt";
        add({
          id: "endpoint",
          needed: "required",
          reasoning: `Endpoint protection is required. ${detail.join(". ")}.`,
          evidence: [
            { source: EV.edrMarker, claim: "BT Managed EDR positioned above the product for 50+ user estates." },
            ...(excluded ? [{ source: EV.exclusions, claim: "Chromebooks and EPOS are excluded from the SMB product." }] : []),
          ],
          route,
          routeDetail:
            route === "other_bt"
              ? "BT Managed EDR via a Netify written consult"
              : "Endpoint within a managed detection service from marketplace vendors",
          firedRules: ["END-1", "END-4", ...(excluded ? ["END-5"] : [])],
        });
      }
    }

    /* ---------------- mdr_soc (approved MDR-1 split) ---------------- */
    if (soc === "twenty_four_seven") {
      add({
        id: "mdr_soc",
        needed: "not_indicated",
        reasoning: "You already run a 24/7 SOC; buying another one is waste. SIEM tooling to support it is the better question.",
        evidence: [{ source: EV.precedence, claim: "Existing capability precedence." }],
        route: null,
        firedRules: ["MDR-4"],
      });
      againstInterest.push({
        capabilityId: "mdr_soc",
        routeDenied: "marketplace_service",
        statement: "You have a 24/7 SOC; a managed detection service would duplicate it. Not recommended.",
        evidence: EV.precedence,
      });
    } else if (drivers.includes("incident")) {
      add({
        id: "mdr_soc",
        needed: "required",
        reasoning: "An active or recent incident is direct evidence of detection and response need.",
        evidence: [{ source: EV.amendment, claim: "Incident always indicates MDR (MDR-1a)." }],
        route: "marketplace_service",
        routeDetail: "24/7 managed detection and response from marketplace vendors",
        firedRules: ["MDR-1a"],
      });
    } else if (compliance.length > 0 && soc === "none") {
      add({
        id: "mdr_soc",
        needed: "required",
        reasoning: "Compliance monitoring obligations without any SOC capacity cannot be met unmanaged.",
        evidence: [{ source: EV.bank, claim: "Monitoring and response obligations in the compliance sections." }],
        route: "marketplace_service",
        routeDetail: "Managed detection aligned to the declared compliance regimes",
        firedRules: ["MDR-1b"],
      });
    } else if (drivers.includes("audit") && soc === "none") {
      add({
        id: "mdr_soc",
        needed: "recommended",
        reasoning:
          "An audit prompt with no SOC capacity makes managed detection sensible, but an audit is not itself evidence of 24/7 SOC need. Not over-prescribed.",
        evidence: [{ source: EV.amendment, claim: "Audit prompts recommend, never require (MDR-1c)." }],
        route: "marketplace_service",
        routeDetail: "Consider co-managed or light-touch MDR; an MSP arrangement may serve at smaller scale",
        firedRules: ["MDR-1c"],
      });
    } else if (drivers.includes("ransomware_concern") && soc === "none") {
      add({
        id: "mdr_soc",
        needed: "recommended",
        reasoning: "Ransomware concern with no response capacity: detection without someone to act on it at any hour leaves the gap the concern is about.",
        evidence: [{ source: EV.coverage, claim: "SOC and MDR marked beyond the SMB product; marketplace route." }],
        route: "marketplace_service",
        routeDetail: "Managed detection sized to the estate; co-managed or MSP arrangements may serve at smaller scale",
        firedRules: ["MDR-1d"],
      });
    } else if (soc === "business_hours" && driversProvided) {
      add({
        id: "mdr_soc",
        needed: "recommended",
        reasoning: "Business-hours cover leaves the out-of-hours gap that most incidents use.",
        evidence: [{ source: EV.coverage, claim: "SOC and MDR marked beyond the SMB product; marketplace route." }],
        route: "marketplace_service",
        firedRules: ["MDR-2"],
      });
    } else {
      add({
        id: "mdr_soc",
        needed: "not_indicated",
        reasoning: "No driver or capacity signal indicates managed detection at this time.",
        evidence: [],
        route: null,
        firedRules: [],
      });
    }

    /* ---------------- sse ---------------- */
    if (transformation) {
      add({
        id: "sse",
        needed: "recommended",
        reasoning:
          "This requirement has become a network-plus-security transformation, not a security procurement: multiple sites, a WAN in play and a renewal or consolidation driver. Security choices should be made inside the SASE evaluation, not before it.",
        evidence: [{ source: EV.coverage, claim: "Multi-site SASE consolidation marked bigger than any single product." }],
        route: "escalate_sase",
        routeDetail: "Route to the SASE RFP path; the security sections travel with it",
        firedRules: ["SSE-4"],
      });
    } else if (cloud.length > 0 && ((sites ?? 0) === 0 || drivers.includes("consolidation"))) {
      const smb = (users ?? 0) <= 50 && (sites ?? 0) <= 1;
      add({
        id: "sse",
        needed: drivers.includes("consolidation") ? "required" : "recommended",
        reasoning: smb
          ? "Cloud apps with remote working: web and cloud protection fits at SMB scale through the BT suite."
          : "Cloud apps with a distributed or consolidating estate point to a secure service edge from graded vendors.",
        evidence: [
          smb
            ? { source: EV.suite, claim: "Web Threat Protect and Cloud Threat Protect cover web and cloud app protection for SMBs." }
            : { source: EV.grades, claim: "Evidence-graded SSE vendors on the marketplace." },
        ],
        route: smb ? "bt_product" : "marketplace_service",
        routeDetail: smb ? "BT Web Threat Protect and Cloud Threat Protect" : "Evidence-graded SSE vendors; ZTNA and CASB assessed in the criteria",
        firedRules: ["SSE-1", smb ? "SSE-2" : "SSE-3"],
      });
    } else if (cloud.length > 0) {
      add({
        id: "sse",
        needed: "recommended",
        reasoning: "Cloud apps in use; secure access controls are sensible as the estate distributes.",
        evidence: [{ source: EV.grades, claim: "SSE evidence base." }],
        route: (users ?? 0) <= 50 && (sites ?? 0) <= 1 ? "bt_product" : "marketplace_service",
        firedRules: ["SSE-1", (users ?? 0) <= 50 && (sites ?? 0) <= 1 ? "SSE-2" : "SSE-3"],
      });
    } else {
      add({
        id: "sse",
        needed: "not_indicated",
        reasoning: "No declared cloud estate; SSE has nothing to protect here yet.",
        evidence: [],
        route: null,
        firedRules: [],
      });
    }

    /* ---------------- siem_logging ---------------- */
    if (compliance.length > 0 || (soc !== undefined && soc !== "none")) {
      add({
        id: "siem_logging",
        needed: compliance.length > 0 ? "required" : "recommended",
        reasoning:
          compliance.length > 0
            ? `Declared compliance (${compliance.join(", ")}) carries log retention and audit-evidence obligations.`
            : "In-house security operations need the tooling to see with.",
        evidence: [
          { source: EV.bank, claim: "Monitoring and reporting obligations in the security sections." },
          { source: EV.gradesLimit, claim: "SIEM vendor shortlists are compiled per project; grading depth is honest." },
        ],
        route: "marketplace_service",
        routeDetail: "Managed SIEM shortlist compiled with you; Netify's grading is deepest in network security, so confidence is capped (SIEM-2)",
        firedRules: ["SIEM-1", "SIEM-2"],
      });
      cap("medium");
    } else {
      add({
        id: "siem_logging",
        needed: "not_indicated",
        reasoning: "No compliance regime or SOC capacity declared to generate logging obligations (G-3 also caps this without compliance answers).",
        evidence: [],
        route: null,
        firedRules: ["G-3"],
      });
    }

    /* ---------------- managed_firewall ---------------- */
    const cloudFirst = (sites ?? 0) === 0;
    if (cloudFirst) {
      add({
        id: "managed_firewall",
        needed: "not_indicated",
        reasoning: "No premises: there is no perimeter to manage, and buying one would obsolete immediately. The spend belongs in SSE.",
        evidence: [{ source: EV.grades, claim: "Cloud-delivered security replaces the premises perimeter in cloud-first estates." }],
        route: null,
        firedRules: ["FW-4"],
      });
      againstInterest.push({
        capabilityId: "managed_firewall",
        routeDenied: "bt_product",
        statement: "No premises and a cloud-first estate: do not buy firewall management you would immediately obsolete; put the budget into SSE.",
        evidence: EV.grades,
      });
    } else if ((sites ?? 0) >= 1 && !transformation) {
      const bt = btEstate(existingNetwork);
      add({
        id: "managed_firewall",
        needed: "recommended",
        reasoning: "On-premises estate without cloud-delivered perimeter controls; managed firewall covers the office edge.",
        evidence: [{ source: EV.fwOptions, claim: "BT Fortinet and Meraki managed options; BTnet Security attach at published prices." }],
        route: bt ? "bt_product" : "either",
        routeDetail: bt
          ? "BT Fortinet or Meraki managed options alongside the existing BT estate; BTnet Security attach at the published £100/£200 monthly where BTnet is the circuit"
          : "Both the BT managed options and marketplace vendors genuinely satisfy this; the service path puts matched vendors in competition for it, with the BT option assessed alongside (COMPETE-1)",
        firedRules: ["FW-1", bt ? "FW-2" : "FW-3"],
      });
    } else {
      add({
        id: "managed_firewall",
        needed: transformation ? "recommended" : "not_indicated",
        reasoning: transformation
          ? "Perimeter decisions belong inside the SASE evaluation this requirement escalates to."
          : "No premises estate declared.",
        evidence: [],
        route: transformation ? "escalate_sase" : null,
        firedRules: transformation ? ["SSE-4"] : [],
      });
    }

    /* ---------------- awareness ---------------- */
    add({
      id: "awareness",
      needed: drivers.includes("incident") || compliance.length > 0 ? "required" : "recommended",
      reasoning:
        drivers.includes("incident") || compliance.length > 0
          ? "Incident or compliance context makes staff training a required control, not a nice-to-have."
          : "People are in scope in every estate; training is the control tooling cannot replace.",
      evidence: [{ source: EV.coverage, claim: "Staff phishing partly mitigated by tooling; Security Awareness Training is the BT route." }],
      route: "bt_product",
      routeDetail: "BT Security Awareness Training, or an equivalent; this never blocks a path",
      firedRules: ["AWA-1", "AWA-2"],
    });

    /* ---------------- email_security (category we decline) ---------------- */
    const emailRelevant = drivers.includes("incident");
    add({
      id: "email_security",
      needed: emailRelevant ? "recommended" : "not_indicated",
      reasoning: emailRelevant
        ? "Incident context makes email controls relevant. Baseline: native Microsoft 365 or Google controls plus awareness training. For a dedicated gateway, Netify does not maintain graded supplier evidence and declines to recommend blind."
        : "No indicator in the declared drivers. Baseline native controls plus awareness cover the ordinary case.",
      evidence: [{ source: EV.gradesLimit, claim: "We recommend only what we can evaluate." }],
      route: "out_of_scope",
      routeDetail: "Native platform controls plus awareness; dedicated gateways via your MSP or direct (EML-2)",
      firedRules: emailRelevant ? ["EML-1", "EML-2"] : ["EML-2"],
    });
    if (emailRelevant) {
      againstInterest.push({
        capabilityId: "email_security",
        routeDenied: "marketplace_service",
        statement: "Netify does not maintain graded evidence for dedicated email security vendors, so we decline the category rather than recommend blind. Source via your MSP or direct.",
        evidence: EV.gradesLimit,
      });
    }

    /* ---------------- backup_resilience (flagged, not sold) ---------------- */
    const ransom = drivers.includes("ransomware_concern") || drivers.includes("incident");
    add({
      id: "backup_resilience",
      needed: ransom ? "required" : "recommended",
      reasoning: ransom
        ? "Recovery capability decides ransomware outcomes; this is a prerequisite, stated plainly. Netify sells nothing here; it is carried into any RFP as a buyer-side requirement."
        : "Tested recovery is baseline hygiene; outside Netify's categories, flagged for completeness.",
      evidence: [{ source: EV.gradesLimit, claim: "Outside Netify's graded categories; flagged honestly, never sold." }],
      route: "out_of_scope",
      routeDetail: "Buyer-side requirement; carried into generated RFP documents as a stated line (BCK-2)",
      firedRules: [ransom ? "BCK-1" : "BCK-2", "BCK-2"],
    });
  }

  /* ---------------- service model and path (required-only, per amendment).
     Awareness never blocks or forces a path (AWA-2), and out_of_scope routes
     (the declined categories) are carried, never path-driving. */
  const required = capabilities.filter((c) => c.needed === "required");
  const pathDriving = required.filter((c) => c.id !== "awareness" && c.route !== "out_of_scope");
  const requiredProduct = pathDriving.filter((c) => c.route === "bt_product");
  const requiredService = pathDriving.filter(
    (c) => c.route === "marketplace_service" || c.route === "other_bt",
  );

  let pathRecommendation: SecurityScopeVerdict["pathRecommendation"] = null;
  if (insufficient) {
    pathRecommendation = null;
  } else if (transformation) {
    pathRecommendation = "escalate_sase";
  } else if (requiredService.length > 0 && requiredProduct.length > 0) {
    pathRecommendation = "hybrid";
  } else if (requiredService.length > 0) {
    pathRecommendation = "service_path";
  } else if (requiredProduct.length > 0) {
    pathRecommendation = "product_path";
  }

  let serviceModel: SecurityScopeVerdict["serviceModel"] = null;
  if (!insufficient && soc !== undefined) {
    if (requiredService.length === 0 && requiredProduct.length > 0) serviceModel = "product_only";
    else if (soc === "none") serviceModel = "fully_managed";
    else if (soc === "business_hours") serviceModel = "co_managed";
    else serviceModel = "co_managed";
  }

  /* ---------------- summary: the doctor's explanation ---------------- */
  const ALTERNATIVES: Partial<Record<CapabilityId, string>> = {
    managed_firewall: "Allocate the spend to SSE instead.",
    endpoint: "Keep the incumbent EDR; revisit only with a consolidation driver.",
    mdr_soc: "Support the existing SOC with SIEM tooling instead.",
    email_security: "Native platform controls plus awareness training.",
  };
  const summary: SecurityScopeVerdict["summary"] = {
    recommended: required.map((c) => c.id),
    conditional: capabilities.filter((c) => c.needed === "recommended").map((c) => c.id),
    not_recommended: capabilities
      .filter((c) => c.needed === "not_indicated")
      .map((c) => ({
        capabilityId: c.id,
        reason: c.reasoning,
        ...(ALTERNATIVES[c.id] && c.firedRules.length > 0 ? { alternative: ALTERNATIVES[c.id] } : {}),
      })),
  };

  /* ---------------- next steps ---------------- */
  const nextSteps: SecurityScopeVerdict["nextSteps"] = [];
  if (insufficient) {
    nextSteps.push({
      action: "Answer the gap questions above, then reassess; no route is offered on guesswork.",
      tool: "assess_security_requirement",
    });
  } else if (pathRecommendation === "escalate_sase") {
    nextSteps.push({
      action: "This is a network-plus-security transformation: build the SASE RFP with the security sections included.",
      page: "https://netify.co.uk/sase/rfp-builder/",
    });
  } else {
    if (requiredProduct.length > 0 || capabilities.some((c) => c.route === "bt_product")) {
      nextSteps.push({
        action: "Product path: BT Endpoint Threat Protect can be quoted and ordered, with a signed contract, on the page.",
        page: "https://netify.co.uk/bt-endpoint-threat-protect/",
      });
    }
    if (requiredService.length > 0 || pathRecommendation === "service_path" || pathRecommendation === "hybrid") {
      nextSteps.push({
        action: "Service path: build the security requirement into an RFP and publish it to matched vendors.",
        page: "https://netify.co.uk/sase/rfp-builder/new/",
      });
    }
  }

  const confidence: SecurityScopeVerdict["confidence"] =
    insufficient ? "low" : confidenceCap;

  return {
    rulebookVersion: RULEBOOK_VERSION,
    generatedAt: new Date().toISOString(),
    inputDigest: await digest(input),
    capabilities,
    serviceModel,
    pathRecommendation,
    againstInterest,
    assumptions,
    gaps,
    summary,
    confidence,
    nextSteps,
  };
}
