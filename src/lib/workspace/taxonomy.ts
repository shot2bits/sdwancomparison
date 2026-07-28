/**
 * The Living Statement of Requirements: the taxonomy (P3.1, spec v1.5
 * section 13.5). PURE data: the sections and items that stand on the desk
 * before the buyer arrives, each mapped to the fact ledger where a home
 * already exists.
 *
 * Two tiers, honestly separated (13.5 and the slice-1 lesson: never
 * stretch a meaning to fit a field):
 *  - Items with `path` land in the ledger as real stated facts on a click
 *    and flow into the verdict, diagram, fit and publish unchanged.
 *  - Items with `path: null` are conversations whose structured field
 *    arrives in P3.2; a click records them as a stated NOTE, kept with the
 *    draft and shown in the artefact, never silently dropped and never
 *    pretending to feed the engine.
 *
 * Every item carries its own provenance (`why`): the reason the line
 * exists at all. The furniture has receipts too (13.5).
 */

import type { AllowedPath } from "@/lib/workspace/extract";

export type TaxonomyItem = {
  id: string;
  label: string;
  /** Ledger home; null = noted tier until its path lands (P3.2). */
  path: AllowedPath | null;
  value?: string;
  /** Why this line exists: the item's own provenance. */
  why: string;
  /** Renders as a grey example demonstration tick until its section holds
   *  a real fact (the example law, 13.3/13.9). */
  exampleTick?: boolean;
  /** The evidence law (13.19): the example shows its history. Renders as a
   *  struck grey example line with this note until the section is live,
   *  proving that rejected suggestions stay on the record. Never counts,
   *  never publishes, retires with the section like every example. */
  exampleStruck?: string;
  /** P3.3: a stable check id in the fit organ's WANT_CHECKS. A noted item
   *  carrying a want genuinely re-ranks the market with its reason and
   *  evidence date, because the 40-feature grid grades it. */
  want?: string;
};

export type TaxonomySection = {
  key: string;
  title: string;
  /** The one quiet example label for the section (never per line). */
  exampleNote: string;
  /** Ledger paths whose facts belong to (and render in) this section. */
  paths: AllowedPath[];
  items: TaxonomyItem[];
};

const RULEBOOK = "in the Netify security rulebook vocabulary";
const FEATURES = "graded across Netify's 40-feature supplier evaluations";
const SEARCH = "asked repeatedly in AI search evidence (Bing AI grounding, Jul 2026)";
const ENGINE = "an engine field the workspace already extracts";

export const TAXONOMY: TaxonomySection[] = [
  {
    key: "organisation",
    title: "Organisation",
    exampleNote: "example content",
    paths: ["organisation.sector", "estate.users", "estate.sites", "organisation.regions", "organisation.sizeBand"],
    items: [], // rendered as fields, not options
  },
  {
    key: "drivers",
    title: "Business drivers",
    exampleNote: "why projects start",
    paths: ["drivers"],
    items: [
      { id: "renewal", label: "Contract renewal", path: "drivers", value: "renewal", why: ENGINE },
      { id: "incident", label: "A security incident", path: "drivers", value: "incident", why: ENGINE },
      { id: "compliance", label: "Compliance obligations", path: "drivers", value: "compliance", why: ENGINE },
      { id: "audit", label: "An audit", path: "drivers", value: "audit", why: ENGINE },
      { id: "growth", label: "Growth or change", path: "drivers", value: "growth", why: ENGINE },
      { id: "consolidation", label: "Consolidating point tools", path: "drivers", value: "consolidation", why: ENGINE },
      { id: "ransomware", label: "Ransomware concern", path: "drivers", value: "ransomware_concern", why: ENGINE },
      { id: "cost", label: "Cost reduction", path: null, why: SEARCH },
      { id: "cloudmig", label: "Cloud migration", path: null, why: SEARCH },
      { id: "transformation", label: "Digital transformation", path: null, why: SEARCH },
    ],
  },
  {
    key: "objectives",
    title: "Objectives",
    exampleNote: "what you are buying",
    paths: ["procurement.buying"],
    items: [
      { id: "buy-sase", label: "Buying SASE", path: "procurement.buying", value: "sase", why: ENGINE },
      { id: "buy-sdwan", label: "Buying SD-WAN", path: "procurement.buying", value: "sdwan", why: ENGINE },
      { id: "buy-sse", label: "Buying SSE", path: "procurement.buying", value: "sse", why: ENGINE },
      { id: "buy-sec", label: "Buying managed security", path: "procurement.buying", value: "managed_security", why: ENGINE },
      { id: "obj-mpls", label: "Replace legacy MPLS", path: null, why: SEARCH, exampleTick: true , want: "mplsmig" },
      { id: "obj-remote", label: "Improve remote user experience", path: null, why: SEARCH, exampleTick: true , want: "remote" },
      { id: "obj-overhead", label: "Reduce operational overhead", path: null, why: SEARCH },
      { id: "obj-zt", label: "Zero trust access", path: null, why: SEARCH , want: "ztna" },
      { id: "obj-cloudfirst", label: "Cloud-first networking", path: null, why: SEARCH },
      { id: "obj-unified", label: "Single-vendor SASE platform", path: null, why: FEATURES, want: "unified" },
      { id: "obj-bob", label: "Best-of-breed stack", path: null, why: FEATURES, want: "bob" },
    ],
  },
  {
    key: "estate",
    title: "Network estate",
    exampleNote: "what you run today",
    paths: ["estate.existingNetwork", "estate.cloud"],
    items: [
      { id: "net-mpls", label: "MPLS", path: "estate.existingNetwork", value: "mpls", why: ENGINE, exampleTick: true },
      { id: "net-sdwan", label: "SD-WAN already in place", path: "estate.existingNetwork", value: "sdwan", why: ENGINE },
      { id: "net-vpn", label: "VPN", path: "estate.existingNetwork", value: "vpn", why: ENGINE },
      { id: "net-leased", label: "Leased lines", path: "estate.existingNetwork", value: "leased_line", why: ENGINE },
      { id: "net-broadband", label: "Broadband", path: "estate.existingNetwork", value: "broadband", why: ENGINE },
      { id: "cl-m365", label: "Microsoft 365", path: "estate.cloud", value: "m365", why: ENGINE, exampleTick: true },
      { id: "cl-azure", label: "Azure", path: "estate.cloud", value: "azure", why: ENGINE, exampleTick: true },
      { id: "cl-aws", label: "AWS", path: "estate.cloud", value: "aws", why: ENGINE },
      { id: "cl-google", label: "Google Workspace", path: "estate.cloud", value: "google", why: ENGINE },
      { id: "net-cell", label: "4G or 5G backup", path: null, why: FEATURES , want: "cellular" },
      { id: "net-dc", label: "Data centres", path: null, why: SEARCH },
      { id: "net-remote", label: "Remote users", path: null, why: SEARCH , want: "remote" },
      { id: "net-bandwidth", label: "Bandwidth per site", path: null, why: SEARCH },
      { id: "net-circuits", label: "Circuit types", path: null, why: SEARCH },
    ],
  },
  {
    key: "security",
    title: "Security",
    exampleNote: "the SASE people actually buy",
    paths: ["estate.existingSecurity"],
    items: [
      { id: "sse-ztna", label: "ZTNA", path: null, why: FEATURES , want: "ztna", exampleTick: true },
      { id: "sse-swg", label: "SWG", path: null, why: FEATURES , want: "swg" },
      { id: "sse-casb", label: "CASB", path: null, why: FEATURES , want: "casb", exampleStruck: "suggested, then declined; kept on the record" },
      /* "FWaaS / NGFW" (Harry's Section 1 ask, 28 Jul 2026): buyers name
       * this control by either word; one row answers both. */
      { id: "sse-fwaas", label: "FWaaS / NGFW", path: null, why: FEATURES , want: "fwaas" },
      { id: "sse-dlp", label: "DLP", path: null, why: FEATURES , want: "dlp" },
      { id: "sse-dns", label: "DNS security", path: null, why: FEATURES },
      { id: "sse-email", label: "Email security", path: null, why: FEATURES },
    ],
  },
  {
    key: "compliance",
    title: "Compliance",
    exampleNote: "example content",
    paths: ["constraints.complianceRequirements"],
    items: [
      { id: "c-iso", label: "ISO 27001", path: "constraints.complianceRequirements", value: "iso27001", why: RULEBOOK },
      { id: "c-cep", label: "Cyber Essentials Plus", path: "constraints.complianceRequirements", value: "cyber_essentials_plus", why: RULEBOOK },
      { id: "c-dspt", label: "NHS DSPT", path: "constraints.complianceRequirements", value: "nhs_dspt", why: RULEBOOK },
      { id: "c-pci", label: "PCI DSS", path: "constraints.complianceRequirements", value: "pci_dss", why: RULEBOOK, exampleTick: true },
      { id: "c-fca", label: "FCA obligations", path: "constraints.complianceRequirements", value: "fca", why: RULEBOOK },
      { id: "c-nis2", label: "NIS2", path: "constraints.complianceRequirements", value: "nis2", why: RULEBOOK },
      { id: "c-gdpr", label: "GDPR", path: "constraints.complianceRequirements", value: "uk_gdpr", why: RULEBOOK },
    ],
  },
  {
    key: "model",
    title: "Operating model",
    exampleNote: "one will be yours",
    paths: ["procurement.operatingModel"],
    items: [
      { id: "m-managed", label: "Fully managed", path: "procurement.operatingModel", value: "managed", why: ENGINE },
      { id: "m-co", label: "Co-managed", path: "procurement.operatingModel", value: "co_managed", why: ENGINE },
      { id: "m-diy", label: "Self-managed (DIY)", path: "procurement.operatingModel", value: "diy", why: ENGINE },
    ],
  },
  {
    key: "change",
    title: "Change model",
    exampleNote: "how changes will run",
    paths: [],
    items: [
      { id: "ch-std", label: "Standard changes", path: null, why: SEARCH },
      { id: "ch-emg", label: "Emergency changes", path: null, why: SEARCH },
      { id: "ch-cab", label: "CAB approval", path: null, why: SEARCH },
      { id: "ch-ooh", label: "Out-of-hours windows", path: null, why: SEARCH },
    ],
  },
  {
    key: "support",
    title: "Support",
    exampleNote: "what good looks like",
    paths: ["constraints.inHouseSocCapacity"],
    items: [
      { id: "s-247", label: "24x7 support", path: null, why: FEATURES, exampleTick: true , want: "s247" },
      { id: "s-uk", label: "UK-based support", path: null, why: SEARCH , want: "ukdesk" },
      { id: "s-engineer", label: "Named engineer", path: null, why: SEARCH , want: "tam" },
      { id: "s-reviews", label: "Service reviews", path: null, why: SEARCH },
    ],
  },
  {
    key: "commercial",
    title: "Commercial",
    exampleNote: "example content",
    paths: ["constraints.budgetBand", "constraints.timeline"],
    items: [
      { id: "com-opex", label: "OPEX preferred", path: null, why: SEARCH },
      { id: "com-sub", label: "Subscription", path: null, why: SEARCH },
      { id: "com-evergreen", label: "Evergreen", path: null, why: SEARCH },
      { id: "com-term", label: "Term length", path: null, why: SEARCH },
    ],
  },
  {
    key: "services",
    title: "Professional services",
    exampleNote: "example content",
    paths: [],
    items: [
      { id: "ps-migration", label: "Migration", path: null, why: FEATURES , want: "migration" },
      { id: "ps-pm", label: "Project management", path: null, why: SEARCH },
      { id: "ps-training", label: "Training", path: null, why: SEARCH },
      { id: "ps-changes", label: "Change requests", path: null, why: SEARCH },
    ],
  },
  {
    key: "success",
    title: "Success criteria",
    exampleNote: "how this will be judged",
    paths: [],
    items: [
      { id: "sc-availability", label: "Availability target", path: null, why: SEARCH },
      { id: "sc-latency", label: "Latency targets", path: null, why: SEARCH },
      { id: "sc-sla", label: "Support SLA", path: null, why: SEARCH },
      { id: "sc-reporting", label: "Reporting", path: null, why: SEARCH },
      { id: "sc-migration", label: "Migration timeline", path: null, why: SEARCH },
    ],
  },
  {
    key: "suppliers",
    title: "Supplier requirements",
    exampleNote: "who may respond",
    paths: [],
    items: [
      { id: "sr-ukref", label: "UK references", path: null, why: SEARCH },
      { id: "sr-framework", label: "Framework agreements", path: null, why: SEARCH },
      { id: "sr-direct", label: "Partner or direct", path: null, why: SEARCH },
      { id: "sr-financial", label: "Financial standing", path: null, why: SEARCH },
    ],
  },
];

/** Example field values for the Organisation section: the destination shown
 *  before the journey. NEVER enter the ledger; retire when the section holds
 *  a real fact (the example law). */
export const ORGANISATION_EXAMPLES: Array<{ k: string; v: string; was?: string }> = [
  { k: "Industry", v: "Retail" },
  { k: "Users", v: "1,900" },
  { k: "Sites", v: "42", was: "corrected from 40; the assumption and the fix both kept" },
  { k: "Countries", v: "UK" },
];

/** Which section an open question (gap) belongs to: questions render in
 *  place, inside the conversation they interrupt (13.6). */
export function sectionForGapKey(key: string): string {
  if (key.startsWith("organisation.") || key === "estate.users" || key === "estate.sites") return "organisation";
  if (key === "drivers") return "drivers";
  if (key === "procurement.buying") return "objectives";
  if (key === "procurement.operatingModel") return "model";
  if (key === "estate.cloud" || key === "estate.existingNetwork") return "estate";
  if (key === "estate.existingSecurity") return "security";
  if (key === "constraints.complianceRequirements") return "compliance";
  if (key === "constraints.inHouseSocCapacity") return "support";
  if (key === "constraints.budgetBand" || key === "constraints.timeline") return "commercial";
  return "success";
}

/** Which section a ledger fact renders in. */
export function sectionForPath(path: AllowedPath): string {
  for (const s of TAXONOMY) if (s.paths.includes(path)) return s.key;
  return "organisation";
}

/** Harry's 22 July finding, generalised (the NIS2 class): a clause that
 *  names an on-desk item which did NOT land must never be credited away
 *  by its neighbours. Single-token labels only, matched on word
 *  boundaries; multiword labels are too loose to claim. */
export function unlandedMentions(clause: string, landedLabels: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const s of TAXONOMY) {
    for (const i of s.items) {
      if (i.label.includes(" ") || i.label.length < 3) continue;
      if (landedLabels.has(i.label)) continue;
      if (new RegExp("\\b" + i.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(clause)) out.push(i.label);
    }
  }
  return [...new Set(out)];
}
