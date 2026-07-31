"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { assessSecurityRequirement, type SecurityScopeVerdict } from "@/lib/security/rulebook";
import {
  deriveInstrumentLadder,
  deriveRfiQuestionSet,
  instrumentNotesLine,
  earnedInstrument,
} from "@/lib/workspace/instrument";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { ACCEPT_GAP_PREFIX } from "@/components/GapActions";
import { statedObjectivesIn, WORKSPACE_SECTORS, type AllowedPath, type BuyingId, type FieldUpdate } from "@/lib/workspace/extract";
import {
  briefModel,
  buyingOf,
  builderCompliance,
  factId,
  factLabel,
  mergeUpdates,
  meterOf,
  operatingModelOf,
  productScopeFor,
  requirementFrom,
  standing,
  usersBandLabel,
  wizardRegions,
  wizardSectorKey,
  COMPLIANCE_LABELS,
  regionStandalone,
  type WorkspaceFact,
} from "@/lib/workspace/draft";
import { TAXONOMY, sectionForGapKey, sectionForPath, type TaxonomyItem } from "@/lib/workspace/taxonomy";
import { earnedQuestions } from "@/lib/workspace/questions";
import { activePack, activeFlavours, visibleSuggestions } from "@/lib/sector/derive";
import { type PackSuggestion } from "@/lib/sector/packs";
import { chunkForIngest, ingestSummary } from "@/lib/workspace/ingest";
import { siteFigureIsIdentifying, siteBandLabelFor } from "@/lib/notice-options";
import SignIn from "@/components/SignIn";
import { fireNetifyEvent } from "@/components/NetifyEvents";

/* ================================================================== */
/* THE REQUIREMENT TWIN (round 5, 31 Jul 2026).                        */
/*                                                                     */
/* Robert's handoff (design_handoff_requirement_twin) WITHDRAWS BOTH   */
/* previous designs: the three-column workspace of c36f148 AND the     */
/* scrolling prompt workspace of 7b74e0c/b2a4e1d. The reference is     */
/* netify-requirement-twin-standalone.html; where this file and that   */
/* one disagree, the reference is correct.                             */
/*                                                                     */
/* THE DESIGN LAW: the conversation is transient, the understanding is */
/* permanent. There is NO conversation log, no "you said", no read-back*/
/* beat, no message bubble anywhere. The screen IS the project: five   */
/* groups of labelled slots, filled slots carrying their value and     */
/* provenance, empty slots visible, dashed and clickable. A prompt     */
/* changes slots; the changed slots take a warm tint and a 2px orange  */
/* left edge, and that marker moves on the next change and never       */
/* accumulates. Understanding is a weighted percentage over twelve     */
/* ticks; the market card narrows live and states why, never by what   */
/* anyone pays. One focal question ever, in a bottom edit sheet with   */
/* its full option set. Both paths complete: click-only reaches        */
/* publish, and typing plus the send button reaches publish.           */
/*                                                                     */
/* What survives unchanged underneath: the extraction cycle and its    */
/* provenance classes, the fact ledger with tombstones (a dropped      */
/* guess never returns), the sector pack asserting COMPLIANCE          */
/* REQUIREMENTS ONLY (a pack adds a requirement with a reason; it      */
/* never invents a fact about the buyer's estate), the evidence-dated  */
/* fit organ, the R9 wrong-company guard, ingest for pasted and        */
/* dropped documents, voice, the ?q=/?scope=/?vendors=/?test=1 doors   */
/* (R3), no persistence of any kind (R2), and the whole ruled          */
/* signature chain: consents recorded verbatim, core five holding the  */
/* signature shut (R7), business email only, publish as the only exit. */
/*                                                                     */
/* Robert's go, 31 Jul ("you decide"): the eight open decisions and    */
/* their reasons are recorded in the netify-requirement-twin memory.   */
/* Divergences from the reference, each deliberate and flagged:        */
/* - The estate MegaNav, ruled door H1 and footer stay above and below */
/*   (his one-navigation and EEAT rulings beat the bare header).       */
/* - "Saved just now" would be false under R2 (no persistence), so the */
/*   header states the truth instead: nothing leaves this page.        */
/* - Option consequences render only when true by definition or        */
/*   genuinely computed; no invented "narrows to N" figures.           */
/* - The fixture's letter grades do not exist as data; rows carry the  */
/*   real n-of-checks tag and dated evaluation instead.                */
/* - Enter sends (the reference's newline-only Enter read as broken in */
/*   the 007 dry runs; Shift+Enter keeps the newline).                 */
/* - The fixture re-infers a dropped guess; rule 7 and done-check 5    */
/*   say never, so the ledger tombstones win.                          */
/* ================================================================== */

/* R2 (Robert, 30 Jul 2026): NO PERSISTENCE. Nothing here writes to    */
/* localStorage or sessionStorage. A project is one sitting.           */

const WORKSPACE_AGREEMENT_TEXT =
  "Publish this requirement: Netify lists an anonymous notice visible to signed-in vendors and service providers, and invites the best-fit evaluated vendors and service providers, who respond through the app. My identity and contact details stay private until I choose to reply, and pricing stays private to me.";

/* The wrong-company guard (R9, Robert's ruling 30 Jul 2026): only for a
 * person whose own words say they came for one of the other companies.
 * Every pattern is a phrase a SASE or SD-WAN buyer would not write. */
const OTHER_NETIFY = [
  /netlify/i,
  /netify\.ai/i,
  /\bjamstack\b/i,
  /\bstatic site\b/i,
  /\bweb(site)? hosting\b/i,
  /\bdeploy (my|our) (site|website)\b/i,
];
const looksLikeAnotherNetify = (text: string) => OTHER_NETIFY.some((r) => r.test(text));

type MarketVendor = { slug: string; name: string; category: string; last_verified: string; yes_count: number; scopes: string[] };
type MarketNotice = { id: string; title: string; scope: string[]; sites: number | null; created: number };
type Market = { rulebook_version: string; vendors: MarketVendor[]; latest_evaluation: string; notices: MarketNotice[]; counts: { vendors: number; notices: number } };

type FitEvidence = { id: string; label: string; grade: string };
type FitSupplier = {
  slug: string; name: string; category: string; last_verified: string;
  evidence_coverage_pct: number; yes_count: number; coverage: Record<string, string>;
  matched: FitEvidence[]; missed: FitEvidence[];
};
type FitState = {
  mode: "graded" | "compiled"; count?: number; total?: number; note?: string;
  suppliers: FitSupplier[]; directory: Array<{ slug: string; name: string }>;
  checks?: Array<{ id: string; label: string }>;
};

/** `own` marks an answer the buyer typed: kept verbatim, theirs (1f). */
type NotedItem = { id: string; label: string; section: string; own?: boolean };
type Receipt = { id: number; text: string };

/** Field names for the requirement sheet: a bare "20" or "the UK" says
 *  nothing on its own (Robert's first live test, 31 Jul). Display side
 *  only; factLabel stays the single value voice. */
const PATH_LABELS: Record<string, string> = {
  "organisation.sector": "Sector",
  "organisation.sizeBand": "Size",
  "organisation.regions": "Regions",
  "estate.users": "People",
  "estate.sites": "Sites",
  "estate.cloud": "Cloud",
  "estate.existingSecurity": "Existing security",
  "estate.existingNetwork": "Existing network",
  "drivers": "Driver",
  "constraints.complianceRequirements": "Compliance",
  "constraints.inHouseSocCapacity": "In-house SOC",
  "constraints.timeline": "Timeline",
  "constraints.budgetBand": "Budget",
  "procurement.buying": "Buying",
  "procurement.operatingModel": "Who runs it",
};

/** The dataset's grade words, humanised (the same table the desk has
 *  always used; the fit working states evidence in these words). */
const GRADE_WORDS: Record<string, string> = {
  yes: "evidenced yes",
  partial: "partial evidence",
  partner_integrated: "via partner or integrated",
  managed_service_dependent: "as a managed service",
  not_primary: "not primary",
  unknown: "not evidenced",
};
const gradeWord = (g: string) => GRADE_WORDS[g] ?? g;

/** Taxonomy items that carry a want id (a real home in the fit checks). */
const WANT_BY_ITEM: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const s of TAXONOMY) for (const i of s.items) if (i.want) out[i.id] = i.want;
  return out;
})();

/** Item lookup: pack asserts land through the desk's own machinery. */
const ITEM_BY_ID: Record<string, { item: TaxonomyItem; section: string }> = (() => {
  const out: Record<string, { item: TaxonomyItem; section: string }> = {};
  for (const s of TAXONOMY) for (const i of s.items) out[i.id] = { item: i, section: s.key };
  return out;
})();

/* ---- The three example openers (the reference's empty state): sector-
        tagged cards; clicking one EXECUTES it, exactly as typing it
        would. Each is a sentence the live extractor genuinely reads. ---- */
const EXAMPLE_CARDS = [
  { tag: "Retail", label: "We run 240 UK retail sites on MPLS and the contract ends March 2027" },
  { tag: "Healthcare", label: "We have 15 NHS clinic sites, 10 in the UK and 5 international, already on SD-WAN" },
  { tag: "Audit driven", label: "Our audit flagged remote access for 1,900 staff and we need SASE to fix it" },
];

/* The dock placeholder rotates through correction and interrogation,
 * not instruction; on the door it is the full first example so the
 * register is visible before anyone types. */
const PLACEHOLDERS = [
  "Change anything. “Add PCI DSS”, “actually 246 sites”, “who fits?”",
  "Say what you want changed and the project changes above",
  "“Drop the people guess” · “we use CrowdStrike” · “show me who fits”",
];

/** Small counts in words, the estate's register. */
const NUM_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty",
  "thirty-one", "thirty-two", "thirty-three", "thirty-four", "thirty-five", "thirty-six", "thirty-seven", "thirty-eight", "thirty-nine", "forty",
];
const numWord = (n: number): string => NUM_WORDS[n] ?? String(n);
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
const listJoin = (xs: string[]): string =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/** Validator notes, humanised (Harry's 22 Jul finding). Display only. */
const FIELD_PHRASES: Record<string, string> = {
  "estate.users": "a user count",
  "estate.sites": "a site count",
};
function humaniseNote(n: string): string {
  const m = /^Dropped ([\w.]+): (.*)$/.exec(n);
  if (m) {
    const what = FIELD_PHRASES[m[1]] ?? "one detail";
    return `couldn't read ${what} from that; say it plainly and I'll take your word`;
  }
  if (/^Dropped a proposal for unknown field/.test(n)) return "heard something without a home yet; kept in your notes";
  return n;
}

const ev = (name: string, data: Record<string, string | number> = {}) => {
  const flat: Record<string, string> = { surface: "desk" };
  for (const [k, v] of Object.entries(data)) flat[k] = String(v);
  fireNetifyEvent(name, flat);
};

const fmtDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
};

/* ================================================================== */
/* The twin's slot map: every slot is a labelled home the ledger (or    */
/* the noted tier) genuinely holds. Weights are the reference's: the    */
/* answers that decide who can bid weigh 3, refinements 2, detail 1,    */
/* and the sector's rule pack 3 on its own, so the percentage cannot    */
/* read 60 while the deciding questions are still open.                 */
/* ================================================================== */

type TwinLand =
  | { kind: "fact"; path: AllowedPath; value: string | number }
  | { kind: "note"; id: string; text: string; section: string };
type TwinOption = { label: string; effect: string; land: TwinLand };
type TwinSlot = {
  id: string;
  group: "org" | "estate" | "why" | "buying";
  label: string;
  w: number;
  cta: string;
  q: string;
  why: string;
  path?: AllowedPath;
  notePrefix?: string;
  options: TwinOption[];
};

/** Sector option consequences: computed from the live pack data, never
 *  typed. A sector with no pack gets no invented promise. */
const SECTOR_EFFECTS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const s of WORKSPACE_SECTORS) {
    const p = activePack({ organisation: { sector: s } });
    if (!p) { out[s] = ""; continue; }
    const n = p.suggestions.filter(
      (sg) => sg.accept.kind === "items" && sg.accept.itemIds.some((id) => ITEM_BY_ID[id]?.item.path === "constraints.complianceRequirements"),
    ).length;
    out[s] = n ? `asserts ${numWord(n)} ${p.label.toLowerCase()} rule${n === 1 ? "" : "s"}` : `loads the ${p.label.toLowerCase()} questions`;
  }
  if (!out["Financial services"]) out["Financial services"] = "earns the FCA obligations question";
  return out;
})();

const fact = (path: AllowedPath, value: string | number): TwinLand => ({ kind: "fact", path, value });
const note = (id: string, text: string, section: string): TwinLand => ({ kind: "note", id, text, section });

const TWIN_GROUPS: Array<{ id: TwinSlot["group"] | "rules"; title: string; note: string }> = [
  { id: "org", title: "Organisation", note: "who is buying, and at what scale" },
  { id: "estate", title: "Estate today", note: "what is being replaced or extended" },
  { id: "why", title: "Why now", note: "what vendors and service providers price against" },
  { id: "buying", title: "What you are buying", note: "the answers that decide who can bid" },
  { id: "rules", title: "Rules you are held to", note: "applied from your sector, evidenced not claimed" },
];

const TWIN_SLOTS: TwinSlot[] = [
  {
    id: "sector", group: "org", label: "Sector", w: 3, cta: "Which sector?", q: "Which sector are you in?",
    why: "It loads the rules and questions Netify holds for your sector, and it changes what vendors and service providers are asked.",
    path: "organisation.sector",
    options: WORKSPACE_SECTORS.map((s) => ({ label: s, effect: SECTOR_EFFECTS[s] ?? "", land: fact("organisation.sector", s) })),
  },
  {
    id: "region", group: "org", label: "Where", w: 2, cta: "Which countries?", q: "Where are the sites?",
    why: "Coverage and field engineering vary sharply by country, and where it runs filters who can serve it.",
    path: "organisation.regions",
    options: [
      { label: "United Kingdom", effect: "", land: fact("organisation.regions", "uk") },
      { label: "Ireland", effect: "", land: fact("organisation.regions", "ie") },
      { label: "Europe", effect: "", land: fact("organisation.regions", "eu") },
      { label: "North America", effect: "", land: fact("organisation.regions", "us") },
      { label: "Asia Pacific", effect: "", land: fact("organisation.regions", "apac") },
      { label: "Middle East", effect: "", land: fact("organisation.regions", "me") },
    ],
  },
  {
    id: "sites", group: "org", label: "Sites", w: 3, cta: "How many sites?", q: "How many sites are in scope?",
    why: "Volume changes cost per site more than any other single number. A round figure is fine; correct it any time.",
    path: "estate.sites",
    options: [10, 25, 50, 100, 250, 500, 1000].map((n) => ({
      label: `About ${n.toLocaleString("en-GB")}`, effect: "", land: fact("estate.sites", n),
    })),
  },
  {
    id: "people", group: "org", label: "People", w: 1, cta: "How many staff?", q: "Roughly how many people?",
    why: "Cloud security is licensed per user, so the user count drives a large part of any quote.",
    path: "estate.users",
    options: [50, 100, 250, 500, 1000, 2500, 5000].map((n) => ({
      label: `About ${n.toLocaleString("en-GB")}`, effect: "", land: fact("estate.users", n),
    })),
  },
  {
    id: "network", group: "estate", label: "Network today", w: 3, cta: "What is there now?", q: "What are you running today?",
    why: "A migration and a new build are priced and staged completely differently.",
    path: "estate.existingNetwork",
    options: [
      { label: "MPLS", effect: "a migration project", land: fact("estate.existingNetwork", "mpls") },
      { label: "SD-WAN already in place", effect: "a refresh or extension", land: fact("estate.existingNetwork", "sdwan") },
      { label: "Internet and VPN", effect: "", land: fact("estate.existingNetwork", "vpn") },
      { label: "Leased lines", effect: "", land: fact("estate.existingNetwork", "leased_line") },
      { label: "Broadband", effect: "", land: fact("estate.existingNetwork", "broadband") },
    ],
  },
  {
    id: "cloud", group: "estate", label: "Cloud", w: 2, cta: "Which cloud?", q: "Where do your applications sit?",
    why: "Cloud on-ramps and peering differ by vendor, and it changes the design.",
    path: "estate.cloud",
    options: [
      { label: "Microsoft 365", effect: "", land: fact("estate.cloud", "m365") },
      { label: "Azure", effect: "", land: fact("estate.cloud", "azure") },
      { label: "AWS", effect: "", land: fact("estate.cloud", "aws") },
      { label: "Google Workspace", effect: "", land: fact("estate.cloud", "google") },
      { label: "Mostly on premise", effect: "", land: fact("estate.cloud", "other_saas") },
    ],
  },
  {
    id: "security", group: "estate", label: "Security in place", w: 2, cta: "What do you already run?", q: "What security are you already paying for?",
    why: "It decides whether consolidation or an overlay scores higher, and it stops you buying twice.",
    path: "estate.existingSecurity",
    options: [
      { label: "Microsoft Defender", effect: "", land: fact("estate.existingSecurity", "Microsoft Defender") },
      { label: "CrowdStrike", effect: "", land: fact("estate.existingSecurity", "CrowdStrike") },
      { label: "Firewalls only", effect: "", land: fact("estate.existingSecurity", "firewalls only") },
      { label: "A provider runs it today", effect: "", land: fact("estate.existingSecurity", "a provider runs it today") },
    ],
  },
  {
    id: "driver", group: "why", label: "Driver", w: 2, cta: "What is pushing this?", q: "What is pushing this now?",
    why: "It decides what vendors and service providers lead with, and whether this is a migration or a refresh.",
    path: "drivers",
    options: [
      { label: "Contract ending", effect: "sets the timeline anchor", land: fact("drivers", "renewal") },
      { label: "An audit finding", effect: "adds evidence requirements", land: fact("drivers", "audit") },
      { label: "A security incident", effect: "reprioritises security scope", land: fact("drivers", "incident") },
      { label: "Compliance obligations", effect: "", land: fact("drivers", "compliance") },
      { label: "Growth or change", effect: "", land: fact("drivers", "growth") },
      { label: "Consolidating point tools", effect: "", land: fact("drivers", "consolidation") },
    ],
  },
  {
    id: "timeline", group: "why", label: "Deadline", w: 3, cta: "When must it land?", q: "When does this have to be live?",
    why: "A hard date rules out anyone who cannot stage your sites in time, and it anchors every quote.",
    path: "constraints.timeline",
    options: [
      { label: "Within 6 months", effect: "", land: fact("constraints.timeline", "within 6 months") },
      { label: "6 to 18 months", effect: "", land: fact("constraints.timeline", "6 to 18 months") },
      { label: "Over 18 months", effect: "", land: fact("constraints.timeline", "over 18 months") },
      { label: "No fixed date yet", effect: "", land: fact("constraints.timeline", "no fixed date yet") },
    ],
  },
  {
    id: "scope", group: "buying", label: "Scope", w: 3, cta: "What are you buying?", q: "What are you actually buying?",
    why: "It splits the market more cleanly than any other answer: one contract or several, one platform or parts.",
    path: "procurement.buying",
    options: [
      { label: "Full SASE, one platform", effect: "network and security in one contract", land: fact("procurement.buying", "sase") },
      { label: "SD-WAN only", effect: "the network layer; security stays as is", land: fact("procurement.buying", "sdwan") },
      { label: "SSE, cloud security only", effect: "the security half, over your network", land: fact("procurement.buying", "sse") },
      { label: "Managed security service", effect: "a service need; the engine scopes it", land: fact("procurement.buying", "managed_security") },
    ],
  },
  {
    id: "model", group: "buying", label: "Who runs it", w: 3, cta: "Who operates it?", q: "Who runs it day to day once it is live?",
    why: "The one answer that decides whether you buy from vendors, from service providers, or both.",
    path: "procurement.operatingModel",
    options: [
      { label: "A provider runs it", effect: "day two sits with a provider", land: fact("procurement.operatingModel", "managed") },
      { label: "We share it with a provider", effect: "shared operations, both markets", land: fact("procurement.operatingModel", "co_managed") },
      { label: "We run it ourselves", effect: "vendor direct; your team operates", land: fact("procurement.operatingModel", "diy") },
    ],
  },
  {
    id: "term", group: "buying", label: "Term", w: 1, cta: "What term?", q: "How long a term should they quote?",
    why: "Three and five years price differently at scale, and naming it makes the quotes comparable.",
    notePrefix: "twin-term",
    options: [
      { label: "3 years", effect: "", land: note("twin-term-3", "Quote a 3 year term", "commercial") },
      { label: "5 years", effect: "", land: note("twin-term-5", "Quote a 5 year term", "commercial") },
      { label: "Quote both", effect: "side-by-side pricing", land: note("twin-term-both", "Quote 3 and 5 year terms side by side", "commercial") },
    ],
  },
  {
    id: "resilience", group: "buying", label: "Cannot go down", w: 2, cta: "What must stay up?", q: "What must never go down?",
    why: "It sets the resilience design, and it is the most common reason quotes are not comparable.",
    notePrefix: "twin-res",
    options: [
      { label: "Everything", effect: "raises cost across the estate", land: note("twin-res-all", "Dual-circuit resilience per site required", "estate") },
      { label: "Critical sites only", effect: "", land: note("twin-res-crit", "Dual-circuit resilience at critical sites only", "estate") },
      { label: "Head office and data centre", effect: "", land: note("twin-res-hq", "Resilience at head office and data centre only", "estate") },
      { label: "Single circuits are fine", effect: "", land: note("twin-res-none", "Single-circuit sites acceptable", "estate") },
    ],
  },
];

const SLOT_BY_ID: Record<string, TwinSlot> = Object.fromEntries(TWIN_SLOTS.map((s) => [s.id, s]));
const SLOT_BY_PATH: Record<string, string> = Object.fromEntries(TWIN_SLOTS.filter((s) => s.path).map((s) => [s.path as string, s.id]));
/** Weighted completeness: slot weights plus 3 for the sector's rule state.
 *  Total is derived, never typed. */
const TOTAL_WEIGHT = TWIN_SLOTS.reduce((a, s) => a + s.w, 0) + 3;

/* ================================================================== */
/* The typed command layer. Every action is possible by typing; each    */
/* pattern is a sentence the surface itself advertises.                 */
/* ================================================================== */

type Command =
  | { kind: "whoFits" }
  | { kind: "publish" }
  | { kind: "sheet"; open: boolean }
  | { kind: "reset" }
  | { kind: "back" }
  | { kind: "closeEdit" }
  | { kind: "missing" }
  | { kind: "cost" }
  | { kind: "dropPartner" }
  | { kind: "dropName"; name: string }
  | { kind: "keepName"; name: string }
  | { kind: "why"; name: string };

function parseCommand(raw: string): Command | null {
  const t = raw.trim().toLowerCase().replace(/[?.!]+$/, "").replace(/\s+/g, " ");
  if (!t) return null;
  if (/^(show me )?who fits$/.test(t)) return { kind: "whoFits" };
  if (/^(publish( it| this| to the board)?|generate and publish)$/.test(t)) return { kind: "publish" };
  if (/^(see|show( me)?|open) the requirement( sheet)?$/.test(t) || t === "open the sheet") return { kind: "sheet", open: true };
  if (/^close the (requirement( sheet)?|sheet)$/.test(t)) return { kind: "sheet", open: false };
  if (/^(start (again|over|afresh)|reset)$/.test(t)) return { kind: "reset" };
  if (/^back( to the (conversation|project))?$/.test(t)) return { kind: "back" };
  if (/^(not sure( yet)?|skip( it| this( one)?)?)$/.test(t)) return { kind: "closeEdit" };
  if (/^what( am i| are we)? ?(am i |are we )?(still )?(missing|left|outstanding)$/.test(t) || /^what are you still missing$/.test(t)) return { kind: "missing" };
  if (/^what (will|would) (this|it) cost$/.test(t) || /^(price|cost)( it| this)?$/.test(t)) return { kind: "cost" };
  if (/^drop (the ones|anyone|those) (that need|needing) a partner$/.test(t)) return { kind: "dropPartner" };
  const drop = /^(?:drop|remove|untick) (.+)$/.exec(t);
  if (drop && !/guess|inference/.test(drop[1])) return { kind: "dropName", name: drop[1] };
  const keep = /^(?:keep|re-?add|tick) (.+)$/.exec(t);
  if (keep) return { kind: "keepName", name: keep[1] };
  const why = /^why is (.+?) (?:first|top|ranked (?:first|top|where it is)|there)$/.exec(t) ?? /^why (.+?) first$/.exec(t);
  if (why) return { kind: "why", name: why[1] };
  return null;
}

/* ================================================================== */
/* The component                                                       */
/* ================================================================== */

/** afterPrompt: the page slots the journey strip and the capability
 *  block beneath the twin; they render on the door only. */
export default function ProjectDesk({ afterPrompt }: { afterPrompt?: ReactNode }) {
  const [phase, setPhase] = useState<"door" | "live" | "fits">("door");
  const [market, setMarket] = useState<Market | null>(null);
  const [facts, setFacts] = useState<WorkspaceFact[]>([]);
  const [noted, setNoted] = useState<NotedItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SecurityScopeVerdict | null>(null);
  const [fit, setFit] = useState<FitState | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  /** THE CHANGE MARKER (reference rule 9): the slots changed by the most
   *  recent action only. REPLACED whole on every transition, never
   *  appended, so nothing accumulates and no history builds up. */
  const [changedSlots, setChangedSlots] = useState<string[]>([]);
  /** The one transient voice line, in the dock's caption position: a
   *  command's answer or a nothing-landed acknowledgment. One at a time,
   *  replaced by the next event, never a message, never echoing the
   *  buyer's words back. */
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [expandedFit, setExpandedFit] = useState<string | null>(null);
  const [ph, setPh] = useState(0);
  const [booted, setBooted] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [wrongCompany, setWrongCompany] = useState(false);
  const [pasteSummary, setPasteSummary] = useState<string | null>(null);

  const [signedIn, setSignedIn] = useState(false);
  const [sessId, setSessId] = useState<{ email: string; work: boolean; company: string | null } | null>(null);
  const [consentCreate, setConsentCreate] = useState(false);
  const [consentGaps, setConsentGaps] = useState(false);
  const [consentPublish, setConsentPublish] = useState(false);
  const [signStage, setSignStage] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [created, setCreated] = useState<{ id: string; manage: string; test: boolean } | null>(null);
  const [published, setPublished] = useState<{ invited: string[]; boardId?: string } | null>(null);

  const [voiceState, setVoiceState] = useState<"idle" | "starting" | "listening">("idle");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceRec = useRef<{ stop: () => void } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const firstKeyAt = useRef<number | null>(null);
  const firstVerdictSent = useRef(false);
  const previewFired = useRef(false);
  const cycleRef = useRef(0);
  const receiptId = useRef(0);
  const factsRef = useRef<WorkspaceFact[]>([]);
  const receiptsRef = useRef<Receipt[]>([]);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertedPacks = useRef<Set<string>>(new Set());
  const acceptedGaps = useRef<Set<string>>(new Set());
  /** Dropped inferences never return (rule 7): once a guess is dropped,
   *  the extractor may not re-infer the same path and value. A later
   *  STATED assertion still lands: saying it is the buyer's own act. */
  const neverReinfer = useRef<Set<string>>(new Set());
  const nrKey = (path: string, value: unknown) => `${path}::${String(value)}`;

  useEffect(() => { receiptsRef.current = receipts; }, [receipts]);

  /** The transient voice line: replaced whole, self-clearing. */
  const say = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  /** Phase transitions land at the twin's own top, not the page's: the
   *  door hero above is the estate's, not the journey's. */
  const scrollToWorkspace = useCallback(() => {
    setTimeout(() => {
      const root = document.querySelector(".pd-root");
      if (!root) { return; }
      const el = document.scrollingElement || document.documentElement;
      const top = root.getBoundingClientRect().top + el.scrollTop - 64;
      el.scrollTop = Math.max(0, top);
    }, 30);
  }, []);

  /** Map changed fact ids to twin slot ids (compliance facts mark their
   *  own rule cells). The marker set is REPLACED, never merged. */
  const markChanged = useCallback((changedFactIds: string[], allFacts: WorkspaceFact[]) => {
    const byId = new Map(allFacts.map((f) => [f.id, f]));
    const slots = new Set<string>();
    for (const id of changedFactIds) {
      const f = byId.get(id);
      if (!f) continue;
      if (f.path === "constraints.complianceRequirements") slots.add(`rule:${f.id}`);
      else {
        const sid = SLOT_BY_PATH[f.path];
        if (sid) slots.add(sid);
      }
    }
    setChangedSlots([...slots]);
  }, []);

  const applyMerge = useCallback((updates: FieldUpdate[], source: "extract" | "answer" | "link") => {
    const allowed = updates.filter((u) => !(u.provenance === "inferred" && neverReinfer.current.has(nrKey(u.path, u.value))));
    cycleRef.current += 1;
    const m = mergeUpdates(factsRef.current, allowed, cycleRef.current, source);
    factsRef.current = m.facts;
    setFacts(m.facts);
    return m;
  }, []);

  /* ---- Derivations off the ledger ---- */
  const requirement = useMemo(() => requirementFrom(facts), [facts]);
  const buying = buyingOf(facts);
  const opModel = operatingModelOf(facts);
  const securityScope = buying === "managed_security" || buying === null;
  const live = standing(facts);
  const started = facts.length > 0 || noted.length > 0;
  const meter = meterOf(facts, verdict);
  const brief = useMemo(() => briefModel({ facts, verdict }), [facts, verdict]);

  useEffect(() => {
    if (!started || previewFired.current) return;
    previewFired.current = true;
    ev("preview_rendered", { facts: facts.length });
  }, [started, facts.length]);

  /* ---- Arrival: market, session, the door parameters (R3 kept) ---- */
  useEffect(() => {
    fetch("/sase/api/workspace/market")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Market | null) => { if (d) setMarket(d); })
      .catch(() => {});
    fetch("/sase/api/auth/session")
      .then((r) => r.json())
      .then((d: { authenticated?: boolean; email?: string; work_address?: boolean; company_hint?: string | null }) => {
        setSignedIn(Boolean(d?.authenticated));
        setSessId(d?.authenticated ? { email: d.email ?? "", work: Boolean(d.work_address), company: d.company_hint ?? null } : null);
      })
      .catch(() => {});

    const p = new URLSearchParams(window.location.search);
    if (p.get("test") === "1") setTestMode(true);
    const scopeParam = p.get("scope");
    const seedFacts: FieldUpdate[] = [];
    if (scopeParam && ["security", "managed_security", "sase", "sdwan", "sse"].includes(scopeParam)) {
      seedFacts.push({
        path: "procurement.buying",
        value: scopeParam === "security" ? "managed_security" : scopeParam,
        provenance: "inferred",
        reason: "from the link you arrived on; drop it if wrong",
      });
    }
    const q = p.get("q");
    const vendorsParam = (p.get("vendors") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z0-9-]{2,60}$/.test(s))
      .slice(0, 5);
    /* R2: nothing is restored. The twin starts empty every time except
       for what the link itself carries. */
    if (seedFacts.length) {
      const m = applyMerge(seedFacts, "link");
      if (m.changed.length) { setPhase("live"); markChanged(m.changed, m.facts); }
    }
    if (q) {
      firstKeyAt.current = Date.now();
      if (vendorsParam.length) setAdded(vendorsParam);
      void send(q);
    }
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Autofocus, pointer-fine only: on a desktop the caret waits in the
     prompt like any search engine's; touch devices are exempt. */
  useEffect(() => {
    try {
      if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
    } catch { /* focus is a courtesy, never a dependency */ }
  }, []);

  /* The rotating placeholder (the reference's cadence). */
  useEffect(() => {
    const t = setInterval(() => setPh((n) => (n + 1) % PLACEHOLDERS.length), 5200);
    return () => clearInterval(t);
  }, []);

  /* The dock is position:fixed per the reference (round 4 proved the
   * sticky compromise wrong). The EEAT ruling is honoured by padding the
   * document instead: the estate footer's last line scrolls clear above
   * the dock, so the whole trust surface stays readable and the prompt
   * never leaves the screen. 240px is the reference's reservation. */
  useEffect(() => {
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "240px";
    return () => { document.body.style.paddingBottom = prev; };
  }, []);

  /* The mobile keyboard: iOS Safari keeps position:fixed elements pinned
   * to the LAYOUT viewport, so when the keyboard shrinks the visual
   * viewport the dock can sink beneath it. Translate the dock up by the
   * hidden gap so the prompt rides above the keyboard. No-op where the
   * visual viewport already behaves. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onChange = () => {
      const el = dockRef.current;
      if (!el) return;
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.transform = gap > 1 ? `translateY(-${gap}px)` : "";
    };
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    onChange();
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, []);

  /* ---- Assess (the rulebook, client side, one truth) ---- */
  useEffect(() => {
    if (!securityScope || live.length === 0) {
      setVerdict(null);
      return;
    }
    let cancelled = false;
    assessSecurityRequirement(requirement).then((v) => {
      if (cancelled) return;
      setVerdict(v);
      if (!firstVerdictSent.current && firstKeyAt.current) {
        firstVerdictSent.current = true;
        ev("workspace_first_verdict", { ms: Date.now() - firstKeyAt.current, confidence: v.confidence });
      }
    });
    return () => { cancelled = true; };
  }, [requirement, securityScope, live.length]);

  /* ---- Fit (evidence dated, the same organ) ---- */
  const sseSignal = Boolean(
    verdict?.capabilities.some((c) => c.id === "sse" && (c.needed === "required" || c.needed === "recommended")) ||
      verdict?.pathRecommendation === "escalate_sase",
  );
  const fitBuying: string | null = !started ? null : buying && buying !== "managed_security" ? buying : sseSignal ? "sse" : "managed_security";
  const fitParams = useMemo(() => {
    if (!fitBuying) return null;
    const regions = (requirement.organisation?.regions ?? []).join(".");
    const clouds = (requirement.estate?.cloud ?? []).filter((c) => ["aws", "azure", "google"].includes(c)).join(".");
    const mpls = (requirement.estate?.existingNetwork ?? []).includes("mpls") ? "1" : "0";
    const wants = [...new Set(noted.map((n) => WANT_BY_ITEM[n.id]).filter(Boolean))].sort().join(".");
    return `buying=${fitBuying}&regions=${regions}&model=${opModel ?? "any"}&include=${added.join(",")}&clouds=${clouds}&mpls=${mpls}&wants=${wants}`;
  }, [fitBuying, requirement, opModel, added, noted]);
  useEffect(() => {
    if (!fitParams) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/sase/api/workspace/fit?${fitParams}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: (FitState & { ok: boolean }) | null) => {
          if (d && d.ok) setFit(d as FitState);
        })
        .catch(() => {});
    }, 350);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [fitParams]);

  /* ---- The sector pack (rule 8: asserted, not offered). When the pack
     wakes, its COMPLIANCE REQUIREMENTS, and only those, land in the
     requirement as inferences, each carrying the pack's applicability
     reason. They appear as applied rows in "Rules you are held to" with
     the change marker on them; nothing is narrated. A pack may add a
     requirement with a reason; it may never invent a fact about the
     buyer's estate, so nothing outside constraints.complianceRequirements
     is ever asserted. Every asserted row is individually droppable and a
     dropped one is never re-inferred. ---- */
  const corpus = useMemo(
    () =>
      [
        ...facts.filter((f) => !f.struck).flatMap((f) => [f.quote ?? "", f.reason ?? "", String(f.value ?? "")]),
        ...receipts.map((r) => r.text),
      ].join(" "),
    [facts, receipts],
  );
  const pack = useMemo(() => activePack(requirement), [requirement]);
  const packFlavours = useMemo(() => (pack ? activeFlavours(pack, corpus) : []), [pack, corpus]);
  useEffect(() => {
    if (!pack || assertedPacks.current.has(pack.id)) return;
    assertedPacks.current = new Set([...assertedPacks.current, pack.id]);
    const sugs = visibleSuggestions(pack, packFlavours, factsRef.current, noted.map((n) => n.id), []);
    const compliance: Array<{ sg: PackSuggestion; item: TaxonomyItem }> = [];
    for (const sg of sugs) {
      if (sg.accept.kind !== "items") continue;
      for (const id of sg.accept.itemIds) {
        const e = ITEM_BY_ID[id];
        if (e && e.item.path === "constraints.complianceRequirements") compliance.push({ sg, item: e.item });
      }
    }
    if (!compliance.length) return;
    const updates: FieldUpdate[] = compliance.map(({ sg, item }) => ({
      path: item.path as AllowedPath,
      value: item.value,
      provenance: "inferred",
      reason: sg.reason,
    }));
    const merged = applyMerge(updates, "extract");
    if (!merged.changed.length) return;
    const landed = compliance.filter(({ item }) => merged.changed.includes(factId(item.path as AllowedPath, item.value)));
    const shown = landed.length ? landed : compliance;
    for (const { sg } of shown) ev("workspace_pack_suggestion", { id: sg.id, verdict: "asserted" });
    /* Change is shown, not narrated: the new rule rows carry the marker
       alongside whatever else this cycle changed. */
    setChangedSlots((prev) => [...new Set([...prev, ...merged.changed.map((id) => `rule:${id}`)])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, packFlavours]);

  /* ---- Core five (R7): the five details a notice cannot publish
     without genuinely hold the signature shut. ---- */
  const coreFive = useMemo(() => {
    const stands = (path: string) => facts.some((f) => !f.struck && f.path === path);
    return {
      sector: stands("organisation.sector"),
      sites: stands("estate.sites"),
      regions: stands("organisation.regions"),
      scope: stands("procurement.buying"),
      timeline: stands("constraints.timeline"),
    };
  }, [facts]);
  const missingCore = useMemo(() => {
    const out: string[] = [];
    if (!coreFive.sector) out.push("your sector");
    if (!coreFive.sites) out.push("how many sites");
    if (!coreFive.regions) out.push("which regions");
    if (!coreFive.scope) out.push("what you are buying");
    if (!coreFive.timeline) out.push("your timeline");
    return out;
  }, [coreFive]);
  const coreFiveComplete = missingCore.length === 0;

  /* ---- The twin derivations: filled slots, weighted understanding,
     the top gaps line ---- */
  const standingAt = useCallback((path: AllowedPath) => live.filter((f) => f.path === path), [live]);
  const slotFilled = useCallback(
    (s: TwinSlot): boolean =>
      s.path ? standingAt(s.path).length > 0 : s.notePrefix ? noted.some((n) => n.id.startsWith(s.notePrefix as string)) : false,
    [standingAt, noted],
  );
  const rulesResolved = coreFive.sector;
  const ruleFacts = useMemo(() => standingAt("constraints.complianceRequirements"), [standingAt]);
  const gotWeight = TWIN_SLOTS.reduce((a, s) => a + (slotFilled(s) ? s.w : 0), 0) + (rulesResolved ? 3 : 0);
  const pct = Math.round((gotWeight / TOTAL_WEIGHT) * 100);
  const topMissing = TWIN_SLOTS.filter((s) => !slotFilled(s))
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((s) => s.label.toLowerCase());
  const pctNote =
    pct >= 78
      ? "Complete enough to price. What is left will not stop anyone quoting."
      : topMissing.length
        ? `Still needed: ${topMissing.join(", ")}. Say it below, or fill it in above.`
        : "Everything the twin tracks is in.";

  /* ---- The market card: derived, never decorative. The count is the
     live fit organ's, scored against the project; before a scope is
     known it is the whole evaluated market. ---- */
  const rankedFits = useMemo(() => (fit?.mode === "graded" ? fit.suppliers : []), [fit]);
  const keptFits = useMemo(() => rankedFits.filter((s) => !removed.includes(s.slug)), [rankedFits, removed]);
  const fitSlugs = keptFits.map((s) => s.slug);
  const pins = [...new Set([...added, ...fitSlugs])].slice(0, 5);
  const checksCount = fit?.checks?.length ?? 0;
  const partnerDependent = useMemo(
    () => keptFits.filter((s) => s.matched.some((m) => m.grade === "partner_integrated")),
    [keptFits],
  );
  const marketTotal = fit?.total ?? market?.counts.vendors ?? null;
  const fittingCount = buying && fit?.mode === "graded" ? rankedFits.length : marketTotal;
  const narrowedBy = [
    buying ? "what you are buying" : null,
    opModel ? "who runs it" : null,
    buying && (requirement.organisation?.regions ?? []).length ? "where it runs" : null,
  ].filter((x): x is string => Boolean(x));
  const marketNote = narrowedBy.length
    ? `Narrowed by ${listJoin(narrowedBy)}. Never by what anyone pays.`
    : "The whole evaluated market, until you tell it more. Never narrowed by what anyone pays.";

  /* ---- The publish gate (identical law to every round) ---- */
  const signLocked =
    !started || facts.length === 0 || Boolean(published) || !coreFiveComplete || (securityScope && (!verdict || verdict.confidence === "low")) || (!securityScope && !buying);
  const lockLine = !started
    ? "Say one sentence about the organisation and the engine takes over."
    : facts.length === 0
      ? "Selections alone are notes so far: say one sentence about the organisation and the engine takes over."
      : !coreFiveComplete
        ? `A notice cannot publish without five details, and ${numWord(missingCore.length)} ${missingCore.length === 1 ? "is" : "are"} still open: ${missingCore.join(", ")}. Say it below, or click the open slots above.`
        : securityScope && (!verdict || verdict.confidence === "low")
          ? "Answer the open questions first: nothing is recorded on guesswork."
          : !securityScope && !buying
            ? "Say what you are buying (SASE, SD-WAN, SSE or managed security) and publishing unlocks."
            : null;
  const consentsOk = securityScope ? consentCreate && consentPublish && (unansweredGapsLenOk() || consentGaps) : consentCreate;
  function unansweredGapsLenOk() { return brief.openGaps.length === 0; }
  const unansweredGaps = brief.openGaps;

  /* ---- Instruments and the publish payload (unchanged wiring) ---- */
  const coveredSections = useMemo(() => {
    const s = new Set<string>();
    for (const f of facts) if (!f.struck) s.add(sectionForPath(f.path));
    return [...s];
  }, [facts]);
  const commercialClaims = useMemo(
    () => facts.filter((f) => !f.struck && sectionForPath(f.path) === "commercial").length,
    [facts],
  );
  const rfiSet = useMemo(
    () => deriveRfiQuestionSet({ coveredSections, sector: (requirement.organisation?.sector as string | undefined) ?? null }),
    [coveredSections, requirement],
  );
  const instrumentLadder = useMemo(
    () =>
      deriveInstrumentLadder({
        started,
        claims: live.length,
        openQuestions: unansweredGaps.length,
        rfiQuestions: rfiSet?.total ?? 0,
        prioritiesSet: 0,
        commercialClaims,
      }),
    [started, live.length, unansweredGaps.length, rfiSet, commercialClaims],
  );
  const instrument = earnedInstrument(instrumentLadder);
  const publishTitle = brief.title;

  /* ---- Corrections: the drop that never returns ---- */
  const dropFact = useCallback((id: string) => {
    const f = factsRef.current.find((x) => x.id === id);
    if (!f || f.struck) return;
    if (f.provenance === "inferred") neverReinfer.current.add(nrKey(f.path, f.value));
    factsRef.current = factsRef.current.map((x) => (x.id === id ? { ...x, struck: true } : x));
    setFacts(factsRef.current);
    setChangedSlots([]);
    ev("workspace_fact_struck", { path: f.path, provenance: f.provenance, undo: "0" });
  }, []);

  const clearNotes = useCallback((prefix: string) => {
    setNoted((ns) => ns.filter((n) => !n.id.startsWith(prefix)));
    setChangedSlots([]);
  }, []);

  const keepReceipt = useCallback((text: string) => {
    setReceipts((rs) => [...rs, { id: ++receiptId.current, text }]);
  }, []);

  /** An edit-sheet option lands through the same machinery a typed
   *  answer uses, tagged as the buyer's own choice. */
  const landOption = useCallback(
    (slot: TwinSlot, opt: TwinOption) => {
      if (opt.land.kind === "fact") {
        const m = applyMerge([{ path: opt.land.path, value: opt.land.value, provenance: "stated", quote: opt.label }], "answer");
        markChanged(m.changed.length ? m.changed : [factId(opt.land.path, opt.land.value)], m.facts);
        ev("workspace_gap_answered", { field: opt.land.path });
      } else {
        const l = opt.land;
        setNoted((ns) => (ns.some((n) => n.id === l.id) ? ns : [...ns, { id: l.id, label: l.text, section: l.section, own: true }]));
        setChangedSlots([slot.id]);
        ev("workspace_earned_answered", { q: l.id, kind: "note" });
      }
      setEdit(null);
      if (phase === "door") setPhase("live");
    },
    [applyMerge, markChanged, phase],
  );

  /* ---- The extraction cycle (the same organ; change is shown in the
     slots, never narrated back) ---- */
  const runCycle = useCallback(
    async (text: string): Promise<number> => {
      const trimmed = text.trim();
      if (trimmed.length < 3 || busy) return 0;
      if (looksLikeAnotherNetify(trimmed)) setWrongCompany(true);
      setBusy(true);
      setCycleError(null);
      try {
        const res = await fetch("/sase/api/workspace/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trimmed, requirement: requirementFrom(factsRef.current) }),
        });
        if (!res.ok) throw new Error(`extract ${res.status}`);
        const data = (await res.json()) as { updates: FieldUpdate[]; engine: string; notes: string[] };
        const merged = applyMerge(data.updates ?? [], "extract");

        /* Stated objectives note themselves (Harry, 24 Jul): the phrase is
           in this cycle's words, so the note is the buyer's own statement. */
        for (const obj of statedObjectivesIn(trimmed)) {
          setNoted((ns) => (ns.some((n) => n.id === obj.id) ? ns : [...ns, { id: obj.id, label: obj.label, section: "objectives" }]));
        }

        /* Change is shown, not narrated: the changed slots take the
           marker; nothing else appears. */
        markChanged(merged.changed, merged.facts);

        /* Engine notes reach the buyer only in buyer words, one transient
           line; everything else stays off the surface entirely. */
        const notes = (data.notes ?? [])
          .filter((n) => /^Dropped /.test(n))
          .slice(0, 2)
          .map(humaniseNote);
        if (notes.length) say(cap(notes.join("; ") + "."));
        return merged.changed.length;
      } catch {
        setCycleError("The engine did not answer; your words are unchanged, say it again in a moment.");
        return 0;
      } finally {
        setBusy(false);
      }
    },
    [busy, applyMerge, markChanged, say],
  );

  /* ---- Ingest (The Threshold): a paste or a dropped text file runs
     through the same cycles a sentence runs. ---- */
  const ingestText = useCallback(
    async (raw: string, source: "paste" | "drop") => {
      const plan = chunkForIngest(raw);
      if (!plan.chunks.length) return;
      setPasteSummary(null);
      if (phase === "door") setPhase("live");
      const factsBefore = factsRef.current.filter((f) => !f.struck).length;
      const receiptsBefore = receiptsRef.current.length;
      ev("workspace_ingest", { source, chunks: plan.chunks.length, chars: plan.readChars, truncated: plan.truncated ? 1 : 0 });
      if (!firstKeyAt.current) firstKeyAt.current = Date.now();
      for (const chunk of plan.chunks) {
        // Sequential on purpose: each cycle merges before the next reads.
        await runCycle(chunk);
      }
      const landed = Math.max(0, factsRef.current.filter((f) => !f.struck).length - factsBefore);
      const kept = Math.max(0, receiptsRef.current.length - receiptsBefore);
      setPasteSummary(ingestSummary(landed, kept, plan));
    },
    [phase, runCycle],
  );

  /* ---- The send: one entry for everything typed, spoken or clicked
     through an example. Commands first; the extractor for the rest. A
     sentence that lands nothing is kept verbatim with the notes, and
     the dock's caption says so once: no echo, no transcript. ---- */
  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setDraft("");
    if (!firstKeyAt.current) firstKeyAt.current = Date.now();
    if (phase === "door") setPhase("live");

    const cmd = parseCommand(text);
    if (cmd) {
      handleCommand(cmd);
      return;
    }

    const landed = await runCycle(text);
    if (landed > 0) return;

    /* Nothing landed: kept verbatim, said once, never echoed. */
    keepReceipt(text);
    say("Kept with your notes, word for word. Nothing else in that changed the project; say “see the requirement” to read everything held.");
  }

  /* ---- The commands, each one true ---- */
  function handleCommand(cmd: Command) {
    switch (cmd.kind) {
      case "whoFits": {
        if (!fitBuying) {
          say("Say what you are buying first, SASE, SD-WAN, SSE or managed security, and the evaluated market scores against it.");
          return;
        }
        ev("workspace_command", { kind: "who_fits" });
        setPhase("fits");
        setExpandedFit(null);
        scrollToWorkspace();
        return;
      }
      case "publish": {
        ev("workspace_command", { kind: "publish" });
        if (signLocked && !published) {
          say(lockLine ?? "Publishing is not open yet.");
          return;
        }
        setPhase("fits");
        setTimeout(() => {
          const el = document.querySelector("[data-publish]");
          if (el) el.scrollIntoView({ block: "start" });
        }, 60);
        say("The signature is yours, never mine: review what publishes, tick the consents and press Generate and publish.");
        return;
      }
      case "sheet":
        ev("workspace_command", { kind: cmd.open ? "sheet_open" : "sheet_close" });
        setReqOpen(cmd.open);
        return;
      case "reset":
        window.location.assign(window.location.pathname);
        return;
      case "back":
        setPhase("live");
        scrollToWorkspace();
        return;
      case "closeEdit":
        setEdit(null);
        return;
      case "missing": {
        const lines: string[] = [];
        lines.push(
          missingCore.length
            ? `Before it can publish, the notice needs ${missingCore.join(", ")}.`
            : "The five details a notice needs are all in.",
        );
        if (topMissing.length) lines.push(`The open slots above name the rest: ${topMissing.join(", ")}.`);
        ev("workspace_command", { kind: "missing" });
        say(lines.join(" "));
        return;
      }
      case "cost":
        ev("workspace_command", { kind: "cost" });
        say("The price band computes at publish, under the Netify TCO methodology (v2026.1). Publishing generates it alongside your document and the anonymous notice; nothing here invents a number early.");
        return;
      case "dropPartner": {
        if (phase !== "fits") { say("Say “who fits” first and I will show the list this works on."); return; }
        if (!partnerDependent.length) {
          say("Nobody in the list relies on a partner for what you asked: no row carries partner-or-integrated evidence against your checks.");
          return;
        }
        const names = partnerDependent.map((s) => s.name);
        setRemoved((r) => [...new Set([...r, ...partnerDependent.map((s) => s.slug)])]);
        ev("workspace_command", { kind: "drop_partner" });
        say(`Dropped ${names.join(", ")}: their evidence for one or more of your checks is graded via partner or integrated.`);
        return;
      }
      case "dropName":
      case "keepName": {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const target = norm(cmd.name);
        const inFits = rankedFits.find((s) => norm(s.name).includes(target) || target.includes(norm(s.name)));
        if (inFits) {
          if (cmd.kind === "dropName") {
            setRemoved((r) => (r.includes(inFits.slug) ? r : [...r, inFits.slug]));
            say(`${inFits.name} dropped. Direct invites leave them out; the anonymous public notice is unaffected.`);
          } else {
            setRemoved((r) => r.filter((s) => s !== inFits.slug));
            say(`${inFits.name} kept back in.`);
          }
          ev("workspace_command", { kind: cmd.kind === "dropName" ? "drop_vendor" : "keep_vendor" });
          return;
        }
        /* In the twin, "drop X" reaches a guess: the inference whose
           label carries the words is struck and never re-inferred. */
        if (cmd.kind === "dropName") {
          const f = factsRef.current.find(
            (x) => !x.struck && x.provenance === "inferred" && factLabel(x).toLowerCase().includes(cmd.name.toLowerCase()),
          );
          if (f) {
            dropFact(f.id);
            say(`Dropped: ${factLabel(f)}. It will not come back unless you say it yourself.`);
            return;
          }
        }
        say(`I could not find “${cmd.name}” in the list or among the guesses. Say the name as the page shows it.`);
        return;
      }
      case "why": {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const target = norm(cmd.name);
        const idx = rankedFits.findIndex((s) => norm(s.name).includes(target) || target.includes(norm(s.name)));
        if (idx < 0) { say(`“${cap(cmd.name)}” is not in the scored list. Say “who fits” to see it.`); return; }
        const s = rankedFits[idx];
        ev("workspace_command", { kind: "why_vendor" });
        setPhase("fits");
        setExpandedFit(s.slug);
        setTimeout(() => {
          const el = document.querySelector(`[data-fit="${s.slug}"]`);
          if (el) el.scrollIntoView({ block: "center" });
        }, 60);
        say(`${s.name}'s working is open in the list: position, evidence and dates, never what anyone pays.`);
        return;
      }
    }
  }

  /* ---- The signature chain (the same organs as every round; the twin
     changed its face, never its law: consents verbatim, humans sign,
     agents never, publish is the only exit). ---- */
  async function signAndPublish() {
    if (signLocked || !consentsOk || signStage) return;
    setSignError(null);
    if (testMode && !securityScope) {
      setSignError("Test mode covers the security engine today. Drop ?test=1 to publish a network requirement for real.");
      return;
    }
    ev("workspace_sign_click", { scope: buying ?? "security", facts: meter.total, inferred: meter.inferred, gaps_accepted: unansweredGaps.length });
    try {
      let proj = created;
      if (!proj) {
        setSignStage("Creating your position on the record…");
        if (securityScope) {
          const res = await fetch("/sase/api/security-sourcing/project", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requirement, consent: true, preferred_vendors: pins, ...(testMode ? { test: true } : {}) }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.project?.id) throw new Error(data.error || "Could not create the project; try again.");
          proj = { id: data.project.id, manage: data.project.manage_token || "", test: testMode || Boolean(data.project.test) };
        } else {
          const sectorKey = wizardSectorKey(requirement.organisation?.sector);
          const notesLine = [
            typeof requirement.estate?.users === "number" ? `Staff: ${requirement.estate.users}.` : "",
            requirement.estate?.existingSecurity?.length ? `Existing security tooling: ${requirement.estate.existingSecurity.join(", ")}.` : "",
            requirement.estate?.existingNetwork?.length ? `Network estate: ${requirement.estate.existingNetwork.join(", ")}.` : "",
            noted.length ? `Buyer selections (structured fields pending): ${noted.map((n) => n.label).join(", ")}.` : "",
            receipts.length ? `Buyer notes, kept verbatim: ${receipts.map((r) => r.text).join(" | ")}.` : "",
            instrumentNotesLine({
              instrument,
              set: rfiSet,
              weightedHigh: [],
              commercialClaims,
            }) ?? "",
            "Drafted on Netify, the SASE & SD-WAN procurement marketplace.",
          ].filter(Boolean).join(" ");
          const res = await fetch("/sase/api/rfp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: publishTitle,
              buyer: {
                sector: sectorKey,
                site_count: requirement.estate?.sites ?? null,
                regions: wizardRegions(requirement.organisation?.regions ?? []),
                compliance: builderCompliance(requirement.constraints?.complianceRequirements ?? []),
                operating_model: opModel ?? "any",
                product_scope: productScopeFor(buying as BuyingId),
                pinned_vendors: pins,
                notes: notesLine,
              },
              consent: { version: "submit-agreement v3, 17 July 2026", agreed_at: Date.now(), flow: "workspace" },
              position: {
                covered_sections: coveredSections,
                sector: (requirement.organisation?.sector as string | undefined) ?? null,
              },
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.id) throw new Error(data.error || "Could not create the requirement; try again.");
          proj = { id: data.id, manage: data.manage_token ?? "", test: false };
        }
        setCreated(proj);
        ev(proj.test ? "workspace_created_test" : "workspace_created", { scope: buying ?? "security", id: proj.id });
      }

      if (proj.test) {
        setSignStage(null);
        return; // test positions never touch the live board
      }

      if (securityScope && unansweredGaps.length) {
        setSignStage("Recording your gap acceptances…");
        for (const g of unansweredGaps) {
          if (acceptedGaps.current.has(g.key)) continue;
          const r = await fetch(`/sase/api/security-sourcing/project/${proj.id}/accept-gap`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ manage_token: proj.manage, gap_field: g.key, consent: true }),
          });
          if (r.ok) acceptedGaps.current.add(g.key);
        }
      }

      ev("publish_click", {});
      setSignStage("Publishing to the board…");
      const res = await fetch(`/sase/api/rfp/${proj.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manage_token: proj.manage,
          list_on_board: true,
          ...(removed.length ? { excluded_vendors: removed.slice(0, 40) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const invited: string[] = Array.isArray(data.invited) ? data.invited.map((i: { slug: string }) => i.slug) : [];
        ev("board_listed", { board_id: data.board?.opportunity_id ?? "" });
        setPublished({ invited, boardId: data.board?.opportunity_id });
        setNeedAuth(false);
        ev("workspace_published", { scope: buying ?? "security", invited: invited.length });
      } else if (data.auth_required) {
        setNeedAuth(true);
        ev("workspace_auth_required", { scope: buying ?? "security" });
      } else {
        throw new Error(data.error || "Could not publish; try again.");
      }
    } catch (e) {
      setSignError(e instanceof Error ? e.message : "Something failed; nothing has been sent to vendors or service providers. Try again.");
    } finally {
      setSignStage(null);
    }
  }

  /* ---- Voice (unchanged organ; a settled sentence goes through send,
     so a spoken command works exactly like a typed one). ---- */
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    if (w.SpeechRecognition || w.webkitSpeechRecognition) setVoiceSupported(true);
    return () => { try { voiceRec.current?.stop(); } catch { /* gone */ } };
  }, []);
  const startVoice = () => {
    type SRCtor = new () => {
      lang: string; interimResults: boolean; continuous: boolean;
      onstart: (() => void) | null;
      onaudiostart: (() => void) | null;
      onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
      onerror: ((e: { error?: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void; stop: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR || busy) return;
    setVoiceError(null);
    const rec = new SR();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = "";
    let lastError = "";
    let restarts = 0;
    let opened = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const deadline = Date.now() + 30000;
    rec.onstart = () => { lastError = ""; };
    rec.onaudiostart = () => { opened = true; setVoiceState("listening"); };
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      if (!firstKeyAt.current) firstKeyAt.current = Date.now();
      setDraft((finalText + interim).replace(/\s+/g, " ").trim());
      if (settleTimer) clearTimeout(settleTimer);
      if (finalText.trim() && !interim) {
        settleTimer = setTimeout(() => { try { rec.stop(); } catch { /* gone */ } }, 1600);
      }
    };
    rec.onerror = (e) => { lastError = e?.error ?? "unknown"; };
    rec.onend = () => {
      opened = true;
      if (watchdog) clearTimeout(watchdog);
      if (settleTimer) clearTimeout(settleTimer);
      const said = finalText.trim();
      if (!said && lastError === "no-speech" && restarts < 1 && Date.now() < deadline) {
        restarts += 1;
        try { rec.start(); return; } catch { /* fall through to idle */ }
      }
      setVoiceState("idle");
      voiceRec.current = null;
      if (said.length >= 3) {
        ev("workspace_voice", { chars: said.length });
        void send(said);
        return;
      }
      if (lastError === "not-allowed" || lastError === "service-not-allowed") {
        setVoiceError("The microphone was blocked; allow it in the address bar, or type instead.");
      } else if (lastError === "network") {
        setVoiceError("The browser speech service did not answer; type instead.");
      } else if (lastError === "audio-capture") {
        setVoiceError("No microphone was found; type instead.");
      } else if (lastError === "no-speech" || !said) {
        setVoiceError("Nothing heard. Tap the mic and speak when you are ready.");
      } else {
        setVoiceError("Voice did not catch that; type instead.");
      }
    };
    voiceRec.current = rec;
    setVoiceState("starting");
    watchdog = setTimeout(() => {
      if (opened || voiceRec.current !== rec) return;
      try { rec.stop(); } catch { /* gone */ }
      voiceRec.current = null;
      setVoiceState("idle");
      setVoiceError("The microphone did not open; it may be blocked. Allow it in the address bar, or type instead.");
    }, 8000);
    try { rec.start(); } catch { if (watchdog) clearTimeout(watchdog); setVoiceState("idle"); voiceRec.current = null; }
  };

  /* ---- Files: the arrow reads plain text documents; a drop anywhere
     on the twin does the same. ---- */
  const readFile = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) { setPasteSummary("That file is too large to read here; paste the part that matters."); return; }
    const reader = new FileReader();
    reader.onload = () => { void ingestText(String(reader.result ?? ""), "drop"); };
    reader.readAsText(f);
  };

  /* ---- The requirement sheet sections: every row with provenance ---- */
  const earnedAll = useMemo(() => {
    const notedIds = noted.map((n) => n.id);
    return earnedQuestions(requirement, buying, opModel, notedIds, [], corpus);
  }, [requirement, buying, opModel, noted, corpus]);
  const sheetSections = useMemo(() => {
    const out: Array<{ key: string; title: string; rows: Array<{ text: string; meta: string | null; open?: boolean }> }> = [];
    for (const sec of TAXONOMY) {
      const rows: Array<{ text: string; meta: string | null; open?: boolean }> = [];
      for (const f of facts) {
        if (f.struck || sectionForPath(f.path) !== sec.key) continue;
        rows.push({
          text: PATH_LABELS[f.path] ? `${PATH_LABELS[f.path]}: ${factLabel(f)}` : factLabel(f),
          meta: f.provenance === "stated" ? (f.source === "answer" ? "you chose this" : f.quote ? `“${f.quote}”` : "your words") : f.reason ?? "netify guessed",
        });
      }
      for (const n of noted) {
        if (n.section !== sec.key) continue;
        rows.push({ text: n.label, meta: n.own ? "your words, kept verbatim" : "kept with your position" });
      }
      for (const g of unansweredGaps) {
        if (sectionForGapKey(g.key) !== sec.key) continue;
        rows.push({ text: g.question, meta: "not yet answered", open: true });
      }
      for (const q of earnedAll) {
        if (q.section !== sec.key) continue;
        rows.push({ text: q.question, meta: "not yet answered", open: true });
      }
      if (rows.length) out.push({ key: sec.key, title: sec.key === "suppliers" ? "Vendor requirements" : sec.title, rows });
    }
    if (receipts.length) {
      out.push({ key: "receipts", title: "Your notes", rows: receipts.map((r) => ({ text: r.text, meta: "kept verbatim" })) });
    }
    return out;
  }, [facts, noted, unansweredGaps, earnedAll, receipts]);

  const understood = live.length + noted.length;

  /* ---- The header's derived name (the reference: the project names
     itself from what it holds) ---- */
  const sectorShort = (() => {
    const s = standingAt("organisation.sector")[0];
    if (!s) return null;
    return String(s.value).replace(/\s*&.*$/, "").toLowerCase();
  })();
  const sitesVal = standingAt("estate.sites").slice(-1)[0];
  const projectName = (sitesVal ? `${sitesVal.value} sites` : "New project") + (sectorShort ? `, ${sectorShort}` : "");

  const firstFit = rankedFits[0] ?? null;
  const shortcuts: string[] =
    phase === "fits"
      ? [
          ...(firstFit ? [`Why is ${firstFit.name} first?`] : []),
          partnerDependent.length ? "Drop the ones that need a partner" : rankedFits.length ? `Drop ${rankedFits[rankedFits.length - 1].name}` : "Back to the project",
          "What will this cost?",
        ]
      : ["Add PCI DSS", "Actually it is 250 sites", "What are you still missing?"];

  const sendReady = draft.trim().length > 0 && !busy;
  const readyToFit = pct >= 62 && Boolean(fitBuying) && !published;

  if (!booted) return <div className="pd-root mt-10" />;

  const mono: React.CSSProperties = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' };
  const editSlot = edit ? SLOT_BY_ID[edit] ?? null : null;

  /* ---- Slot cell renderers ---- */
  const slotCell = (s: TwinSlot) => {
    const isNew = changedSlots.includes(s.id);
    const cellCls = "flex flex-col px-5 py-[15px] border-b border-r border-[#EFECE5]";
    const cellStyle: React.CSSProperties = isNew ? { background: "#FFFCF3", boxShadow: "inset 2px 0 0 #F5A21B" } : {};
    const tagBase: React.CSSProperties = { ...mono, fontSize: "9.5px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", borderRadius: "4px", padding: "3px 5px", flex: "none" };

    if (s.path) {
      const fs = standingAt(s.path);
      if (fs.length) {
        const anyInferred = fs.some((f) => f.provenance === "inferred");
        const latest = fs[fs.length - 1];
        const value = fs.length === 1
          ? cap(factLabel(latest))
          : `${fs.slice(0, 3).map((f) => cap(factLabel(f))).join(", ")}${fs.length > 3 ? ` and ${numWord(fs.length - 3)} more` : ""}`;
        const meta = latest.provenance === "stated"
          ? (latest.source === "answer" ? "you chose this" : latest.quote ? `“${latest.quote}”` : "your words")
          : latest.reason ?? "netify guessed";
        const single = fs.length === 1;
        return (
          <div key={s.id} className={cellCls} style={cellStyle}>
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 text-[12.5px] text-[#8C8A85]">{s.label}</span>
              <span style={{ ...tagBase, ...(anyInferred ? { background: "#F1EFE9", color: "#7A7770" } : { background: "#EAF6EE", color: "#256B3E" }) }}>
                {anyInferred ? "netify guessed" : "your words"}
              </span>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <button
                type="button"
                onClick={() => setEdit(s.id)}
                className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-[16.5px] font-medium leading-[1.35] text-[#141414]"
                style={{ textWrap: "pretty" }}
                title={s.q}
              >
                {value}
              </button>
              {single ? (
                <button
                  type="button"
                  onClick={() => dropFact(latest.id)}
                  className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[9.5px] uppercase text-[#A3A099] hover:border-[#B4650B] hover:text-[#B4650B]"
                  style={{ ...mono, letterSpacing: "0.07em" }}
                >
                  {latest.provenance === "inferred" ? "drop" : "clear"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEdit(s.id)}
                  className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[9.5px] uppercase text-[#A3A099] hover:border-[#141414] hover:text-[#141414]"
                  style={{ ...mono, letterSpacing: "0.07em" }}
                >
                  edit
                </button>
              )}
            </div>
            <div className="mt-1.5 text-[12px] italic leading-[1.45] text-[#A3A099]">{meta}</div>
          </div>
        );
      }
    } else if (s.notePrefix) {
      const ns = noted.filter((n) => n.id.startsWith(s.notePrefix as string));
      if (ns.length) {
        const opt = s.options.find((o) => o.land.kind === "note" && o.land.id === ns[0].id);
        return (
          <div key={s.id} className={cellCls} style={cellStyle}>
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 text-[12.5px] text-[#8C8A85]">{s.label}</span>
              <span style={{ ...tagBase, background: "#EAF6EE", color: "#256B3E" }}>your words</span>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <button
                type="button"
                onClick={() => setEdit(s.id)}
                className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-[16.5px] font-medium leading-[1.35] text-[#141414]"
                style={{ textWrap: "pretty" }}
              >
                {opt ? opt.label : ns[0].label}
              </button>
              <button
                type="button"
                onClick={() => clearNotes(s.notePrefix as string)}
                className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[9.5px] uppercase text-[#A3A099] hover:border-[#B4650B] hover:text-[#B4650B]"
                style={{ ...mono, letterSpacing: "0.07em" }}
              >
                clear
              </button>
            </div>
            <div className="mt-1.5 text-[12px] italic leading-[1.45] text-[#A3A099]">you chose this</div>
          </div>
        );
      }
    }

    /* Empty: visible, dashed, directly actionable (rule 4). */
    return (
      <div key={s.id} className={cellCls} style={cellStyle}>
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-[12.5px] text-[#8C8A85]">{s.label}</span>
          <span style={{ ...tagBase, background: "transparent", color: "#B4650B", border: "1px solid #EBDCC0" }}>open</span>
        </div>
        <button
          type="button"
          onClick={() => setEdit(s.id)}
          className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-[9px] border border-dashed border-[#D3CFC6] bg-transparent px-3 py-[11px] text-left text-[14px] text-[#8C8A85] hover:border-[#141414] hover:bg-white hover:text-[#141414]"
        >
          <span className="text-[13px] text-[#C4C0B8]" style={mono}>+</span>
          {s.cta}
        </button>
      </div>
    );
  };

  /* ================================================================ */
  /* Render: the project occupies the screen; the prompt is fixed to   */
  /* the bottom and is the input method, not the subject.              */
  /* ================================================================ */
  return (
    <div
      className="pd-root mt-8"
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#141414" }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer?.files?.[0]); }}
    >
      {/* The twin's own header row (the estate MegaNav carries the
          logotype): the project names itself, the state line is true
          under R2, and Start again is always reachable. */}
      {started && (
        <div className="mx-auto flex w-full max-w-[1000px] flex-wrap items-baseline gap-x-4 gap-y-1 px-[26px] pb-4">
          <span className="text-[14.5px] font-medium text-[#33302C]">{projectName}</span>
          <span className="text-[11.5px] text-[#A3A099]" style={mono}>nothing leaves this page</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => { setReqOpen(true); ev("workspace_command", { kind: "sheet_open" }); }}
            className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[13.5px] text-[#6E6C67] hover:text-[#141414]"
          >
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#2E9E52]" aria-hidden="true" />
            {understood} {understood === 1 ? "thing" : "things"} understood · see the requirement
          </button>
          <button
            type="button"
            onClick={() => window.location.assign(window.location.pathname)}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#A3A099] hover:text-[#141414]"
          >
            Start again
          </button>
        </div>
      )}

      {/* ── THE DOOR ── the page renders the ruled H1, promise and trust
          paragraphs above; the twin adds the three sector-tagged example
          cards (clicking one starts the project with that sentence,
          exactly as typing it would) and the dock waits below. */}
      {phase === "door" && (
        <div className="mx-auto w-full max-w-[860px] px-[26px] pb-10 pt-2">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            {EXAMPLE_CARDS.map((e) => (
              <button
                key={e.tag}
                type="button"
                onClick={() => void send(e.label)}
                className="flex cursor-pointer flex-col gap-[7px] rounded-[12px] border border-[#E0DCD3] bg-[#FBFAF8] p-4 text-left hover:border-[#141414] hover:bg-white"
              >
                <span className="text-[10.5px] uppercase text-[#B4650B]" style={{ ...mono, letterSpacing: "0.09em" }}>{e.tag}</span>
                <span className="text-[14.5px] leading-[1.5] text-[#33302C]">{e.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── THE LIVE TWIN ── the project as a structured, living object:
          understanding and the market side by side, then the five groups
          of labelled slots. No log, no narration; change is shown. */}
      {phase === "live" && (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[18px] px-[26px] pb-6">
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <div className="rounded-[14px] border border-[#E5E1D9] bg-[#FBFAF8] px-[22px] py-5">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[11px] uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: "0.1em" }}>Project understanding</span>
                <span className="flex-1" />
                <span className="text-[26px] font-semibold leading-none" style={{ ...mono, letterSpacing: "-0.02em" }}>
                  {pct}<span className="text-[15px] text-[#A3A099]">%</span>
                </span>
              </div>
              <div className="mt-3.5 flex gap-[3px]">
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className="h-[7px] flex-1 rounded-[2px]" style={{ background: (i * 100) / 12 < pct ? "#F5A21B" : "#E8E4DC" }} />
                ))}
              </div>
              <div className="mt-3 text-[13.5px] leading-[1.55] text-[#5F5D59]">{pctNote}</div>
            </div>
            <div className="rounded-[14px] bg-[#141414] px-[22px] py-5 text-white">
              <div className="text-[11px] uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: "0.1em" }}>The market, narrowing</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[26px] font-semibold leading-none" style={{ ...mono, letterSpacing: "-0.02em" }}>
                  {fittingCount ?? "…"}
                </span>
                {marketTotal !== null && <span className="text-[13.5px] text-[#B8B5AF]">of {marketTotal} still fit</span>}
              </div>
              <div className="mt-[11px] text-[13px] leading-[1.5] text-[#B8B5AF]">{marketNote}</div>
            </div>
          </div>

          {TWIN_GROUPS.map((g) => {
            if (g.id === "rules") {
              const rows = ruleFacts;
              const state = coreFive.sector ? (rows.length ? `${rows.length} applied` : "none yet") : "waiting";
              return (
                <div key={g.id} className="overflow-hidden rounded-[14px] border border-[#E5E1D9] bg-[#FBFAF8]">
                  <div className="flex items-baseline gap-2.5 border-b border-[#EFECE5] px-5 py-3.5">
                    <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>{g.title}</span>
                    <span className="min-w-0 flex-1 text-[13px] text-[#A3A099]">{g.note}</span>
                    <span className="flex-none text-[11px] text-[#A3A099]" style={mono}>{state}</span>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))" }}>
                    {rows.length > 0 ? (
                      rows.map((f) => {
                        const isNew = changedSlots.includes(`rule:${f.id}`);
                        return (
                          <div
                            key={f.id}
                            className="flex flex-col border-b border-r border-[#EFECE5] px-5 py-[15px]"
                            style={isNew ? { background: "#FFFCF3", boxShadow: "inset 2px 0 0 #F5A21B" } : {}}
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="min-w-0 flex-1 text-[12.5px] text-[#8C8A85]">Applied</span>
                              <span
                                className="flex-none rounded-[4px] px-[5px] py-[3px] text-[9.5px] font-semibold uppercase"
                                style={{ ...mono, letterSpacing: "0.07em", ...(f.provenance === "inferred" ? { background: "#FFF3DC", color: "#8A4D08" } : { background: "#EAF6EE", color: "#256B3E" }) }}
                              >
                                {f.provenance === "inferred" ? "from your sector" : "your words"}
                              </span>
                            </div>
                            <div className="mt-2 flex items-start gap-2">
                              <span className="min-w-0 flex-1 text-[16.5px] font-medium leading-[1.35]" style={{ textWrap: "pretty" }}>
                                {COMPLIANCE_LABELS[String(f.value)] ?? String(f.value)}
                              </span>
                              <button
                                type="button"
                                onClick={() => dropFact(f.id)}
                                className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[9.5px] uppercase text-[#A3A099] hover:border-[#B4650B] hover:text-[#B4650B]"
                                style={{ ...mono, letterSpacing: "0.07em" }}
                              >
                                {f.provenance === "inferred" ? "drop" : "clear"}
                              </button>
                            </div>
                            <div className="mt-1.5 text-[12px] italic leading-[1.45] text-[#A3A099]">
                              {f.provenance === "inferred" ? f.reason ?? "asserted by your sector pack" : f.quote ? `“${f.quote}”` : "your words"}
                            </div>
                          </div>
                        );
                      })
                    ) : coreFive.sector ? (
                      <div className="border-b border-[#EFECE5] px-5 py-[15px] text-[13.5px] leading-[1.55] text-[#8C8A85]">
                        No asserted rule pack for this sector yet. Any rule you state, “Add PCI DSS”, lands here with your words as its provenance.
                      </div>
                    ) : (
                      <div className="flex flex-col border-b border-[#EFECE5] px-5 py-[15px]">
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 text-[12.5px] text-[#8C8A85]">Sector rules</span>
                          <span className="flex-none text-[9.5px] uppercase text-[#A3A099]" style={{ ...mono, letterSpacing: "0.07em" }}>waiting</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEdit("sector")}
                          className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-[9px] border border-dashed border-[#D3CFC6] bg-transparent px-3 py-[11px] text-left text-[14px] text-[#8C8A85] hover:border-[#141414] hover:bg-white hover:text-[#141414]"
                        >
                          <span className="text-[13px] text-[#C4C0B8]" style={mono}>+</span>
                          Set your sector to load these
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            const slots = TWIN_SLOTS.filter((s) => s.group === g.id);
            const filled = slots.filter(slotFilled).length;
            return (
              <div key={g.id} className="overflow-hidden rounded-[14px] border border-[#E5E1D9] bg-[#FBFAF8]">
                <div className="flex items-baseline gap-2.5 border-b border-[#EFECE5] px-5 py-3.5">
                  <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>{g.title}</span>
                  <span className="min-w-0 flex-1 text-[13px] text-[#A3A099]">{g.note}</span>
                  <span className="flex-none text-[11px] text-[#A3A099]" style={mono}>{filled} of {slots.length}</span>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))" }}>
                  {slots.map(slotCell)}
                </div>
              </div>
            );
          })}

          {/* Readiness: once weighted completeness passes the threshold,
              the action into the vendor list. */}
          {readyToFit && (
            <div className="border-l-2 border-[#2E9E52] pl-[17px]">
              <div className="mb-1.5 text-[18px] font-semibold leading-[1.4]">Enough to be priced consistently.</div>
              <div className="mb-[15px] max-w-[38em] text-[14.5px] leading-[1.6] text-[#5F5D59]">
                The gaps left are ones vendors and service providers can quote around. Nothing has left this page.
              </div>
              <button
                type="button"
                onClick={() => handleCommand({ kind: "whoFits" })}
                className="cursor-pointer rounded-full border-0 bg-[#F5A21B] px-[23px] py-[13px] text-[15.5px] font-semibold text-[#141414] hover:bg-[#E5940F]"
              >
                Show the {fittingCount ?? ""} that fit
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── WHO FITS ── the count, scored against the project and never
          against what anyone pays, then the ranked list with dated
          evidence and one reason per row; the publish organ at the end
          because publish is the only exit. */}
      {phase === "fits" && (
        <div className="mx-auto w-full max-w-[1000px] px-[26px] pb-6">
          <button
            type="button"
            onClick={() => { setPhase("live"); scrollToWorkspace(); }}
            className="mb-5 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[#8C8A85] hover:text-[#141414]"
          >
            Back to the project
          </button>
          {rankedFits.length === 0 ? (
            <div className="max-w-[36em] text-[16px] leading-[1.6] text-[#6E6C67]">
              The market has not scored yet: say what you are buying and where it runs, and the evaluated vendors and service providers rank against it here.
            </div>
          ) : (
            <>
              <h2 className="m-0 mb-2.5 max-w-[24em] text-[27px] font-semibold leading-[1.25]" style={{ letterSpacing: "-0.022em" }}>
                {rankedFits.length} of {fit?.total ?? rankedFits.length} fit the project as it stands.
              </h2>
              <p className="m-0 mb-2 max-w-[38em] text-[15.5px] leading-[1.6] text-[#5F5D59]">
                Scored against the project above, not against what anyone pays. Change anything in the project and this list changes with it.
              </p>
              <p className="m-0 mb-6 max-w-[38em] text-[14px] leading-[1.6] text-[#8C8A85]">
                {cap(numWord(keptFits.length))} of {numWord(rankedFits.length)} kept for direct invites. Untick anyone you do not want to hear from
                {partnerDependent.length ? <>, or say <em>drop the ones that need a partner</em>.</> : "."}
              </p>
              <div className="overflow-hidden rounded-[14px] border border-[#E5E1D9] bg-[#FBFAF8]">
                {rankedFits.map((s, i) => {
                  const on = !removed.includes(s.slug);
                  const full = checksCount > 0 && s.matched.length === checksCount;
                  const open = expandedFit === s.slug;
                  return (
                    <div key={s.slug} data-fit={s.slug} className="border-b border-[#EFECE5]">
                      <div className="flex w-full items-start gap-3.5 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setRemoved((r) => (on ? [...r, s.slug] : r.filter((x) => x !== s.slug)))}
                          aria-label={on ? `Drop ${s.name} from direct invites` : `Keep ${s.name} in direct invites`}
                          className={`mt-[3px] flex h-[19px] w-[19px] flex-none cursor-pointer items-center justify-center rounded-[5px] border-0 text-[11px] font-bold ${on ? "bg-[#141414] text-white" : "border border-solid border-[#DDD9D1] bg-transparent text-transparent"}`}
                        >
                          {on ? "✓" : ""}
                        </button>
                        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                          <span className="flex flex-wrap items-baseline gap-2.5">
                            <span className="text-[16.5px] font-semibold">{s.name}</span>
                            <span className="text-[12.5px] text-[#A3A099]">{s.category}</span>
                          </span>
                          <span className="text-[14px] leading-[1.55] text-[#5F5D59]" style={{ textWrap: "pretty" }}>
                            {s.matched.length
                              ? `Evidenced for ${s.matched.slice(0, 3).map((m) => m.label).join(", ")}${s.matched.length > 3 ? ` and ${numWord(s.matched.length - 3)} more` : ""}.`
                              : "On the curated market for this scope; no graded evidence against your named checks yet."}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedFit(open ? null : s.slug)}
                            className="cursor-pointer self-start border-0 bg-transparent p-0 text-[12.5px] text-[#B4650B] underline hover:text-[#8A4D08]"
                          >
                            {open ? "Close the working" : `Why position ${i + 1}`}
                          </button>
                        </div>
                        <div className="flex flex-none flex-col items-end gap-[5px]">
                          {checksCount > 0 && (
                            <span
                              className={`rounded-[6px] px-2 py-1 text-[12px] font-semibold ${full ? "bg-[#EAF6EE] text-[#256B3E]" : "bg-[#F2F0EB] text-[#5F5F5F]"}`}
                              style={mono}
                            >
                              {s.matched.length} of {checksCount}
                            </span>
                          )}
                          <span className="text-[11px] text-[#A3A099]" style={mono}>
                            evaluated {fmtDate(s.last_verified)}
                          </span>
                        </div>
                      </div>
                      {open && (
                        <div className="border-t border-[#F0EEE9] bg-white px-5 py-4 pl-[52px]">
                          <p className="m-0 mb-1 max-w-[40em] text-[14px] leading-[1.55] text-[#5F5D59]">
                            Position {i + 1} of {rankedFits.length}, ordered by graded evidence against your named checks, never by what anyone pays.
                          </p>
                          {s.matched.length > 0 && (
                            <p className="m-0 mb-1 max-w-[40em] text-[14px] leading-[1.55] text-[#5F5D59]">
                              Evidenced for: {s.matched.map((m) => `${m.label} (${gradeWord(m.grade)})`).join(", ")}.
                            </p>
                          )}
                          {s.missed.length > 0 && (
                            <p className="m-0 mb-1 max-w-[40em] text-[14px] leading-[1.55] text-[#5F5D59]">
                              Not evidenced for: {s.missed.map((m) => m.label).join(", ")}.
                            </p>
                          )}
                          <p className="m-0 mb-1.5 max-w-[40em] text-[14px] leading-[1.55] text-[#5F5D59]">
                            Across the whole dataset this record fully meets {s.yes_count} of 40 capabilities. Graded {fmtDate(s.last_verified)}.
                          </p>
                          <a href={`/sase/vendors/${s.slug}/`} className="text-[13.5px]">Read the full record, with every source behind these grades</a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {checksCount > 0 && fit?.checks && (
                <p className="m-0 mt-3 text-[13px] leading-relaxed text-[#8C8A85]">
                  Your named checks: {fit.checks.map((c) => c.label).join(", ")}. Each tag counts the checks met with graded evidence.
                </p>
              )}
            </>
          )}

          {/* ---- Generate and publish: the only exit (R5), the ruled
                  organs intact: what carries, what stays private, the
                  consents verbatim, the identity read-back, the vetting
                  standard linked so the claim is checkable. ---- */}
          <div data-publish="1" className="mt-9 border-l-2 border-[#F5A21B] pl-4" style={{ scrollMarginTop: "90px" }}>
            {published ? (
              <div>
                <div className="mb-2 max-w-[36em] text-[16px] leading-[1.6]">
                  Published. Signed-in vendors and service providers can now see your anonymous notice
                  {published.boardId ? <>: <a href={`/sase/opportunities/${published.boardId}`} className="underline">see it on the board</a></> : "."}
                  {published.invited.length > 0 && <> {cap(numWord(published.invited.length))} {published.invited.length === 1 ? "was" : "were"} invited directly.</>}
                </div>
                {keptFits.length > 0 && (
                  <div className="mt-3">
                    <p className="m-0 mb-1 text-[10px] font-semibold uppercase text-[#B4650B]" style={{ ...mono, letterSpacing: ".12em" }}>Your shortlist</p>
                    <ol className="m-0 list-none p-0">
                      {keptFits.map((r, i) => (
                        <li key={r.slug} className="border-t border-[#F5F3EE] py-2.5 first:border-t-0 first:pt-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-[11px] text-[#8C8A85]" style={mono}>{String(i + 1).padStart(2, "0")}</span>
                            <a href={`/sase/vendors/${r.slug}/`} className="text-[14px] font-semibold text-[#141414] underline decoration-[#C9C5BC] underline-offset-2 hover:decoration-[#141414]">{r.name}</a>
                            <span className="text-[12.5px] text-[#6E6C67]">{r.category} · graded {fmtDate(r.last_verified)}</span>
                            {published.invited.includes(r.slug) && (
                              <span className="rounded-full bg-[#FFF7E8] px-1.5 py-[1px] text-[10px] font-semibold uppercase text-[#8A4D08]" style={{ ...mono, letterSpacing: ".08em" }}>invited</span>
                            )}
                          </div>
                          {r.matched.length > 0 && (
                            <p className="m-0 mt-0.5 pl-6 text-[12.5px] leading-relaxed text-[#5F5D59]">
                              Evidenced for {r.matched.map((m) => m.label).join(", ")}.
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {created?.id && (
                  <p className="m-0 mt-3 text-[13px] leading-relaxed text-[#33302C]">
                    <a className="underline hover:text-[#8A4D08]" href={`/sase/project/${created.id}${created.manage ? `?manage=${encodeURIComponent(created.manage)}` : ""}`}>
                      Open your project record
                    </a>{" "}
                    to see responses as they arrive.
                  </p>
                )}
              </div>
            ) : created?.test ? (
              <div className="max-w-[36em] text-[15px] leading-[1.6] text-[#5F5D59]">
                Test position created, id {created.id}. Test positions never touch the live board; drop ?test=1 to publish for real.
              </div>
            ) : (
              <div>
                <div className="max-w-[36em] text-[16px] leading-[1.6]">
                  Publishing generates your document, sends the full requirement to the ones you keep, and lists it anonymously for the rest of the market. Nobody sees your name until you choose to reply, and vendors and service providers are <a href="/sase/supplier-vetting-standard/" className="underline" target="_blank" rel="noreferrer">vetted</a> before they can respond.
                </div>
                <p className="m-0 mt-2 max-w-[38em] text-[12.5px] leading-relaxed text-[#5F5D59]">
                  <span className="font-semibold text-[#33302C]">Your project publishes anonymously.</span>{" "}
                  Nobody browsing Netify, and no search engine, sees your company name or your contact details
                  {requirement.organisation?.sector || usersBandLabel(requirement.estate?.users)
                    ? ` (the notice reads ${[requirement.organisation?.sector, usersBandLabel(requirement.estate?.users)].filter(Boolean).join(", ")}, nothing more)`
                    : ""}
                  . You choose which of them receive your contact details, and when. Assumptions publish labelled as assumptions; example content never publishes at all.
                </p>
                <p className="m-0 mb-1 mt-3 text-[10px] font-semibold uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: ".12em" }}>What the notice carries</p>
                <p className="m-0 mb-1.5 text-[12.5px] leading-loose">
                  {[
                    typeof requirement.estate?.sites === "number"
                      ? (siteFigureIsIdentifying({ buyer_sector: requirement.organisation?.sector ?? "", regions: requirement.organisation?.regions ?? [] })
                        ? (siteBandLabelFor(requirement.estate.sites) ?? `${requirement.estate.sites} sites`)
                        : `${requirement.estate.sites} sites`)
                      : null,
                    typeof requirement.estate?.users === "number" ? `${requirement.estate.users} users` : null,
                    buying ? ({ sase: "SASE", sdwan: "SD-WAN", sse: "SSE", managed_security: "managed security" } as Record<string, string>)[buying] ?? buying : null,
                    opModel === "managed" ? "Fully managed" : opModel === "co_managed" ? "Co-managed" : null,
                    (requirement.organisation?.regions ?? []).length ? `coverage: ${(requirement.organisation?.regions ?? []).map((r) => regionStandalone(r)).join(", ")}` : null,
                    (requirement.constraints?.complianceRequirements ?? []).length ? (requirement.constraints?.complianceRequirements ?? []).map((c) => COMPLIANCE_LABELS[c] ?? c).join(", ") : null,
                  ].filter(Boolean).map((chip) => (
                    <span key={String(chip)} className="mr-1.5 inline-block rounded-full border border-[#EAE7E1] bg-white px-2 py-[1px] text-[12.5px] text-[#33302C]">{chip}</span>
                  ))}
                  <span className="text-[12.5px] text-[#8C8A85]">
                    {typeof requirement.estate?.sites === "number" && siteFigureIsIdentifying({ buyer_sector: requirement.organisation?.sector ?? "", regions: requirement.organisation?.regions ?? [] })
                      ? "as written, except the site count: sector plus one region could identify you, so the notice shows the range, and the exact count is seen only after the gate"
                      : "exactly as written, nothing retyped"}
                  </span>
                </p>
                <p className="m-0 mb-2 text-[12.5px] leading-relaxed text-[#8C8A85]">
                  <span className="font-semibold text-[#6E6C67]">Stays private:</span> your identity and contacts, your notes,
                  {unansweredGaps.length > 0 ? ` ${numWord(unansweredGaps.length)} unanswered question${unansweredGaps.length === 1 ? "" : "s"} (published only as labelled assumptions if you accept them),` : ""}
                  {" "}and anything you have dropped from the record.
                </p>
                {signLocked && lockLine && (
                  <p className="m-0 mb-2 text-[13px] leading-relaxed text-[#B4650B]">{lockLine}</p>
                )}
                <label className="mb-1.5 flex items-start gap-2 text-[13px] leading-relaxed text-[#5F5D59]">
                  <input type="checkbox" checked={consentCreate} onChange={(e) => setConsentCreate(e.target.checked)} className="mt-0.5" />
                  <span>{securityScope ? CREATE_CONSENT_TEXT : WORKSPACE_AGREEMENT_TEXT}</span>
                </label>
                {securityScope && unansweredGaps.length > 0 && (
                  <label className="mb-1.5 flex items-start gap-2 text-[13px] leading-relaxed text-[#5F5D59]">
                    <input type="checkbox" checked={consentGaps} onChange={(e) => setConsentGaps(e.target.checked)} className="mt-0.5" />
                    <span>
                      {ACCEPT_GAP_PREFIX}
                      {unansweredGaps.map((g) => g.question).join(" ")} Accepted gaps publish as stated assumptions.
                    </span>
                  </label>
                )}
                {securityScope && (
                  <label className="mb-1.5 flex items-start gap-2 text-[13px] leading-relaxed text-[#5F5D59]">
                    <input type="checkbox" checked={consentPublish} onChange={(e) => setConsentPublish(e.target.checked)} className="mt-0.5" />
                    <span>{ENGINE_PUBLISH_CONSENT_TEXT}</span>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => void signAndPublish()}
                  disabled={signLocked || !consentsOk || Boolean(signStage) || (testMode && !securityScope)}
                  className="mt-1 cursor-pointer rounded-full border-0 bg-[#F5A21B] px-[22px] py-[13px] text-[15.5px] font-semibold text-[#141414] hover:bg-[#E5940F] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {signStage ?? (testMode ? "Sign · create the test position" : "Generate and publish")}
                </button>
                {testMode && !securityScope && (
                  <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-[#B4650B]">
                    Test mode covers the security engine today, and this is a network requirement. Drop <span style={mono}>?test=1</span> from the address to publish it for real.
                  </p>
                )}
                {signError && <p className="m-0 mt-1.5 text-[12.5px] text-red-600">{signError}</p>}
                {signedIn && sessId && (
                  sessId.work ? (
                    <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-[#6E6C67]">
                      Publishing as <span className="font-medium text-[#33302C]">{sessId.email}</span>
                      {sessId.company ? <> · {sessId.company}, resolved from your email domain. Nobody types a company name we cannot check.</> : "."}
                    </p>
                  ) : (
                    <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-[#B4650B]">
                      Signed in as {sessId.email}, a personal address. Publishing needs a work email; everything here stays as it is while you switch.
                    </p>
                  )
                )}
                {removed.length > 0 && (
                  <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[#6E6C67]">
                    Direct invites leave out {numWord(removed.length)} {removed.length === 1 ? "vendor or service provider" : "vendors and service providers"} at your word; the ranked fill tops back up from the next best evidenced. The anonymous public notice is unaffected.
                  </p>
                )}
                {needAuth && (
                  <div className="mt-2 rounded-md bg-[#FBFAF8] p-3">
                    <p className="m-0 mb-1 text-[12.5px] text-[#5F5D59]">
                      One step first: publishing reaches named vendors and service providers, so it needs a verified sign-in. Your position is untouched.
                    </p>
                    <SignIn
                      role="buyer"
                      prompt="Verify yourself to publish."
                      onAuthed={() => {
                        setSignedIn(true);
                        setNeedAuth(false);
                        fetch("/sase/api/auth/session")
                          .then((r) => r.json())
                          .then((d: { authenticated?: boolean; email?: string; work_address?: boolean; company_hint?: string | null }) => {
                            setSessId(d?.authenticated ? { email: d.email ?? "", work: Boolean(d.work_address), company: d.company_hint ?? null } : null);
                          })
                          .catch(() => {});
                        void signAndPublish();
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* The door keeps the page's journey strip and capability block
          beneath the twin; the working surface never carries them. */}
      {phase === "door" && afterPrompt}

      {/* ── THE EDIT SHEET ── bottom-anchored, one focal question with
          its rationale and full option set; closing returns to the
          project. It contains no text input by design: the own-words
          path is the dock below. */}
      {editSlot && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center px-[26px] pb-[26px]"
          style={{ background: "rgba(20,20,20,.3)" }}
          onClick={() => setEdit(null)}
        >
          <div
            className="w-full max-w-[620px] rounded-[18px] border border-[#DDD9D1] bg-white px-6 pb-5 pt-[22px]"
            style={{ boxShadow: "0 14px 44px rgba(20,20,20,.18)", maxHeight: "min(76vh, 640px)", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 text-[19px] font-semibold leading-[1.35]" style={{ textWrap: "pretty" }}>{editSlot.q}</span>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="flex-none cursor-pointer border-0 bg-transparent text-[13.5px] text-[#A3A099] hover:text-[#141414]"
              >
                Close
              </button>
            </div>
            <div className="mb-4 mt-[7px] max-w-[40em] text-[13.5px] leading-[1.55] text-[#6E6C67]">{editSlot.why}</div>
            {(() => {
              const held = editSlot.path
                ? standingAt(editSlot.path).map((f) => ({
                    key: f.id,
                    label: cap(factLabel(f)),
                    meta: f.provenance === "stated" ? (f.source === "answer" ? "you chose this" : f.quote ? `“${f.quote}”` : "your words") : f.reason ?? "netify guessed",
                    kind: f.provenance === "inferred" ? "drop" : "clear",
                    act: () => dropFact(f.id),
                  }))
                : (editSlot.notePrefix
                    ? noted.filter((n) => n.id.startsWith(editSlot.notePrefix as string)).map((n) => ({
                        key: n.id,
                        label: n.label,
                        meta: "you chose this",
                        kind: "clear",
                        act: () => clearNotes(editSlot.notePrefix as string),
                      }))
                    : []);
              if (!held.length) return null;
              return (
                <div className="mb-4">
                  <div className="mb-1 text-[10px] font-semibold uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: ".11em" }}>Held now</div>
                  {held.map((h) => (
                    <div key={h.key} className="flex items-baseline gap-2.5 border-t border-[#F0EEE9] py-2">
                      <span className="min-w-0 flex-1 text-[14.5px]">{h.label}</span>
                      <span className="min-w-0 flex-[1.1] text-[12px] italic text-[#A3A099]">{h.meta}</span>
                      <button
                        type="button"
                        onClick={h.act}
                        className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[9.5px] uppercase text-[#A3A099] hover:border-[#B4650B] hover:text-[#B4650B]"
                        style={{ ...mono, letterSpacing: "0.07em" }}
                      >
                        {h.kind}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="flex flex-col gap-[7px]">
              {editSlot.options.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => landOption(editSlot, o)}
                  className="flex w-full cursor-pointer items-center gap-3.5 rounded-[11px] border border-[#E3E0DA] bg-white px-[15px] py-[13px] hover:border-[#141414] hover:bg-[#FDFCFA]"
                >
                  <span className="flex-1 text-left text-[15.5px] leading-[1.45]">{o.label}</span>
                  {o.effect && <span className="max-w-[15em] flex-none text-right text-[12.5px] leading-[1.4] text-[#8C8A85]">{o.effect}</span>}
                </button>
              ))}
            </div>
            <div className="mt-3.5 text-[13px] leading-[1.5] text-[#A3A099]">
              Or close this and say it in your own words below. These are only the answers heard most.
            </div>
          </div>
        </div>
      )}

      {/* ── THE PROMPT DOCK ── fixed to the viewport bottom: opaque
          backdrop, matching feather, no backdrop-filter, no gradient.
          The document's bottom padding keeps the estate footer clear. */}
      <div
        ref={dockRef}
        data-dock="1"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-[26px] pt-3.5"
        style={{ background: "#fbfaf8", boxShadow: "0 -18px 22px 10px #fbfaf8", paddingBottom: "max(22px, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto w-full max-w-[1000px]">
          {phase !== "door" && (
            <div className="flex gap-[7px] overflow-x-auto px-0.5 pb-[9px]" style={{ scrollbarWidth: "none" }}>
              {shortcuts.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setDraft(label); inputRef.current?.focus(); }}
                  className="flex-none cursor-pointer whitespace-nowrap rounded-full border border-[#E3E0DA] bg-white px-[13px] py-[7px] text-[13.5px] text-[#5F5D59] hover:border-[#141414] hover:text-[#141414]"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {wrongCompany && (
            <p className="m-0 px-1 pb-1.5 text-[12.5px] leading-relaxed text-[#8C8A85]">
              Looking for website hosting? That is Netlify, a different company. This is Netify, the SASE and SD-WAN procurement marketplace; carry on if the network is what you came for.
            </p>
          )}
          {pasteSummary && <p className="m-0 px-1 pb-1.5 text-[12.5px] leading-relaxed text-[#8C8A85]">{pasteSummary}</p>}
          {cycleError && <p className="m-0 px-1 pb-1.5 text-[12.5px] leading-relaxed text-[#B4650B]">{cycleError}</p>}
          {voiceError && <p className="m-0 px-1 pb-1.5 text-[12.5px] leading-relaxed text-[#8C8A85]">{voiceError}</p>}
          <div className="flex items-end gap-2.5 rounded-[15px] border border-[#DDD9D1] bg-white py-1.5 pl-[18px] pr-2" style={{ boxShadow: "0 6px 26px rgba(20,20,20,.09)" }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); if (!firstKeyAt.current) firstKeyAt.current = Date.now(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData?.getData("text") ?? "";
                if (text.length > 400) {
                  e.preventDefault();
                  void ingestText(text, "paste");
                }
              }}
              placeholder={phase === "door" ? EXAMPLE_CARDS[0].label : PLACEHOLDERS[ph]}
              rows={1}
              className="h-[52px] flex-1 resize-none border-0 bg-transparent py-3.5 text-[16.5px] leading-[1.45] text-[#141414] outline-none placeholder:text-[#A3A099]"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={() => (voiceState === "idle" ? startVoice() : voiceRec.current?.stop())}
                title={voiceState === "idle" ? "Say it out loud" : "Stop listening"}
                className={`mb-[7px] flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[10px] border bg-white ${voiceState === "listening" ? "border-[#B4650B] text-[#B4650B]" : "border-[#E3E0DA] text-[#8C8A85] hover:border-[#141414] hover:text-[#141414]"}`}
              >
                {voiceState === "listening" ? (
                  <span className="inline-block h-[10px] w-[10px] rounded-full bg-[#B4650B]" aria-hidden="true" />
                ) : (
                  <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true">
                    <rect x="4.5" y="1" width="5" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M1.5 8.5c0 3 2.4 5 5.5 5s5.5-2 5.5-5M7 13.5V17M4.5 17h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Drop or choose a plain-text document and it will be read into the project"
              className="mb-[7px] h-[38px] w-[38px] flex-none cursor-pointer rounded-[10px] border border-[#E3E0DA] bg-white text-[15px] text-[#8C8A85] hover:border-[#141414] hover:text-[#141414]"
            >
              ↑
            </button>
            <input ref={fileRef} type="file" accept=".txt,.md,.csv,text/plain" className="hidden" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button
              type="button"
              onClick={() => void send(draft)}
              disabled={!sendReady}
              className={`mb-[7px] flex-none cursor-pointer rounded-[11px] border-0 px-[18px] py-[11px] text-[15px] font-semibold ${sendReady ? "bg-[#F5A21B] text-[#141414] hover:bg-[#E5940F]" : "bg-[#F0EEE9] text-[#A3A099]"} disabled:cursor-not-allowed`}
            >
              {busy ? "Reading…" : phase === "door" ? "Start" : "Apply"}
            </button>
          </div>
          <p className="m-0 px-1 pb-0 pt-[9px] text-[12.5px] leading-normal text-[#A3A099]">
            {notice ??
              "Type to change the project above; everything on this page can be done by saying it. Drop a plain-text document on the arrow and it will be read in. Nothing publishes without your signature."}
          </p>
        </div>
      </div>

      {/* ── THE REQUIREMENT SHEET ── a deliberately opened overlay, never
          a column; every row carries its provenance. */}
      {reqOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,20,20,.34)" }} onClick={() => setReqOpen(false)}>
          <div
            className="flex h-full flex-col bg-white"
            style={{ width: "min(660px, 100%)", boxShadow: "-14px 0 44px rgba(20,20,20,.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-none items-start gap-3.5 border-b border-[#EAE7E1] px-7 pb-4 pt-[22px]">
              <div className="min-w-0 flex-1">
                <div className="text-[20px] font-semibold" style={{ letterSpacing: "-0.015em" }}>{publishTitle}</div>
                <div className="mt-[5px] text-[13.5px] leading-normal text-[#8C8A85]">
                  This is what vendors and service providers would be answering. Say anything you want changed and it changes here.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReqOpen(false)}
                className="flex-none cursor-pointer border-0 bg-transparent text-[15px] text-[#8C8A85] hover:text-[#141414]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto px-7 pb-10 pt-[22px]">
              {sheetSections.length === 0 && (
                <p className="m-0 text-[14.5px] leading-relaxed text-[#8C8A85]">Nothing yet. Say one sentence about the organisation and the requirement starts here.</p>
              )}
              {sheetSections.map((sec) => (
                <div key={sec.key} className="pb-6">
                  <div className="border-b border-[#141414] pb-2 text-[11px] uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: "0.11em" }}>
                    {sec.title}
                  </div>
                  {sec.rows.map((r, j) => (
                    <div key={j} className="border-b border-[#F5F3EE] py-2.5">
                      <div className={`text-[15px] leading-normal ${r.open ? "text-[#8C8A85]" : ""}`} style={{ textWrap: "pretty" }}>{r.text}</div>
                      {r.meta && <div className="mt-1 text-[13px] italic leading-[1.45] text-[#A3A099]">{r.meta}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
