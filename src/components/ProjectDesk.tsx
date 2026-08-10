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
import { statedObjectivesIn, LIST_FACT_PATHS, WORKSPACE_SECTORS, type AllowedPath, type BuyingId, type FieldUpdate } from "@/lib/workspace/extract";
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
import ConstellationScene from "@/components/ConstellationScene";

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

/* ================================================================== */
/* THE LIVING STATEMENT OF REQUIREMENTS (round 6, 31 Jul 2026).        */
/*                                                                     */
/* Robert's handoff (design_handoff_living_sor) keeps the twin's law   */
/* and organs and moves the face: the prompt lives at the TOP of the   */
/* surface under the understanding band, and a BOUNDED conversation    */
/* thread returns beneath it (his ruling, 31 Jul eve: "small           */
/* persistent chat window with history"). The reference is             */
/* netify-living-sor-standalone.html. His six rulings on the gate:     */
/* 1. Same mount, organs retained whole: extraction, ledger,           */
/*    tombstones, packs, fit, publish chain, doors, voice, ingest.     */
/* 2. The thread stays: user messages echo, replies are TEMPLATE       */
/*    lines composed from the diff, never model prose. The law         */
/*    holds: everything important lands in the statement; the thread   */
/*    is feedback, not the record.                                     */
/* 3. The header never lies about persistence. An OPT-IN SAVE with a   */
/*    verified work email creates the real project record early        */
/*    (existing create machinery, unpublished); until then the truth   */
/*    stays "nothing leaves this page". This amends R2 by his word:    */
/*    still no browser storage, ever; the record is the save.          */
/* 4. No letter grades: n-of-checks and dated evaluation stand.        */
/* 5. NINE sector quick-start chips (Regulated industries removed);    */
/*    every chip writes a real value through the same machinery a      */
/*    click-answer uses, never an invented fact.                       */
/* 6. No em dashes, no filler, and no example answers anywhere: no     */
/*    placeholder or control carries a specific number of sites, a     */
/*    date, or a named product. Placeholders ask open questions.       */
/* ================================================================== */

/* R2 (Robert, 30 Jul 2026): NO BROWSER PERSISTENCE. Nothing here      */
/* writes to localStorage or sessionStorage. Amended 31 Jul: the       */
/* buyer may opt in to saving as a real project record with a          */
/* verified work email; without that, a project is one sitting.       */

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

export type MarketVendor = { slug: string; name: string; category: string; last_verified: string; yes_count: number; scopes: string[] };
type MarketNotice = { id: string; title: string; scope: string[]; sites: number | null; created: number };
export type Market = { rulebook_version: string; vendors: MarketVendor[]; latest_evaluation: string; notices: MarketNotice[]; counts: { vendors: number; notices: number } };

export type FitEvidence = { id: string; label: string; grade: string };
export type FitSupplier = {
  slug: string; name: string; category: string; last_verified: string;
  evidence_coverage_pct: number; yes_count: number; coverage: Record<string, string>;
  matched: FitEvidence[]; missed: FitEvidence[];
  /** Fix, 10 Aug 2026: mirrors the API's own new field, see fit.ts. Optional
   *  here (unlike the server type) since this is parsed from a fetch response
   *  and should degrade gracefully rather than throw on an older cached
   *  response shape. */
  marketplace_url?: string | null;
};
export type FitState = {
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

/* NO EXAMPLE OPENERS (Robert's live ruling, 31 Jul 2026, overriding the
 * reference's empty state): nobody's estate matches a fictional sentence,
 * so three oddly specific cards read as nonsense at first contact, and
 * clicking one wrote invented facts into the ledger as "your words".
 * The empty state is THE PROJECT ITSELF: every slot visible, dashed and
 * clickable at zero, the whole evaluated market beside a 0% meter. The
 * first thing a buyer meets is their own project's shape, not someone
 * else's sentence. Before anything lands, the dock placeholder instructs
 * rather than demonstrates. */

/* Placeholders ask open questions only (round 6 law: no example
 * answers anywhere; the old rotating examples carried a site count, a
 * named standard and a named product, and they are dead). */
const PLACEHOLDER_EMPTY = "Describe what you are buying, in your own words…";
const PLACEHOLDER_LIVE = "Say what changed, add a rule, or correct anything in the statement…";

/** The thread (round 6, Robert's ruling: the small persistent chat
 *  window stays). User messages echo verbatim; every Netify line is a
 *  TEMPLATE composed from the diff, never model prose, so the thread
 *  can only ever describe what actually landed in the statement. */
type ThreadMsg = { who: "you" | "netify"; text: string };
const THREAD_WELCOME =
  "Describe what you are buying, in your own words. Every sentence you write fills in the statement below, or answer any open line in it directly.";
const THREAD_NO_CATCH =
  "I did not catch anything new in that; your words are kept with your notes. Try naming a number of sites, a deadline, what you run today, or who should operate it, or answer any open line in the statement.";

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
/** sectorOnly (round 7, restore): an option that only earns its place once
 *  the buyer's own standing sector matches — the same "influence, never a
 *  second ledger" law the sector packs already keep (Robert, 1 Aug 2026:
 *  "we only need Healthcare compliance questions if the user selects
 *  Healthcare"). Undefined means the option applies to every sector. */
type TwinOption = { label: string; effect: string; land: TwinLand; sectorOnly?: RegExp };
type TwinSlot = {
  id: string;
  group: "org" | "estate" | "why" | "buying" | "change" | "support" | "commercial" | "services" | "success" | "suppliers" | "compliance";
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
  { id: "change", title: "Change model", note: "how changes will run once it is live" },
  { id: "support", title: "Support", note: "what good looks like, day to day" },
  { id: "commercial", title: "Commercial preferences", note: "how you would rather pay" },
  { id: "services", title: "Professional services", note: "the delivery work around the platform" },
  { id: "success", title: "Success criteria", note: "resiliency, uptime and how this will be judged" },
  { id: "suppliers", title: "Vendor requirements", note: "who may respond" },
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
    why: "Volume changes cost per site more than any other single number. Type the exact figure, or pick the range it falls in; correct it any time.",
    path: "estate.sites",
    /* Robert, 1 Aug 2026: "About" read as a guess dressed up as a
     * question. "Up to N" is an honest range label for the same landed
     * value; the edit sheet also carries a manual number entry now
     * (round the site count itself never changed, only the words). */
    options: [10, 25, 50, 100, 250, 500, 1000].map((n) => ({
      label: `Up to ${n.toLocaleString("en-GB")}`, effect: "", land: fact("estate.sites", n),
    })),
  },
  {
    id: "people", group: "org", label: "People", w: 1, cta: "How many staff?", q: "Roughly how many people?",
    why: "Cloud security is licensed per user, so the user count drives a large part of any quote. Type the exact figure, or pick the range it falls in.",
    path: "estate.users",
    /* The Mid-market chip lands here as a noted band: the ledger holds
     * real counts only, and a band is not a count. A stated number
     * always wins the line. */
    notePrefix: "chip-mid",
    options: [50, 100, 250, 500, 1000, 2500, 5000].map((n) => ({
      label: `Up to ${n.toLocaleString("en-GB")}`, effect: "", land: fact("estate.users", n),
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
  /* ---- Round 7 (1 Aug 2026): restoring the categories the pre-31-Jul
     three-column workspace carried and the current design dropped
     (Robert: "compliance, regulation, security, resiliency and uptime,
     managed services, co-managed.. I could go on"). Built INTO today's
     architecture — one multi-select slot per taxonomy section, the same
     note()+notePrefix+"Held now" mechanism Term and Resilience already
     use — not a reversion to the old three-column layout. Each option
     lands into its taxonomy `section` key, so the existing sheetSections
     side panel picks it up without any change there. */
  {
    id: "change", group: "change", label: "How changes run", w: 1, cta: "How should changes be handled?", q: "How should changes to the live service run?",
    why: "It sets the change process vendors and service providers are quoted against, and it is a common source of disputes once live.",
    notePrefix: "twin-change",
    options: [
      { label: "Standard changes", effect: "", land: note("twin-change-std", "Standard, pre-approved changes required", "change") },
      { label: "Emergency changes", effect: "", land: note("twin-change-emg", "Emergency change process required", "change") },
      { label: "CAB approval", effect: "", land: note("twin-change-cab", "Changes require CAB approval", "change") },
      { label: "Out-of-hours windows", effect: "", land: note("twin-change-ooh", "Changes restricted to out-of-hours windows", "change") },
    ],
  },
  {
    id: "support", group: "support", label: "Support", w: 1, cta: "What support do you need?", q: "What does good support look like?",
    why: "It decides who can bid at all: not every provider staffs 24x7 or a UK desk.",
    notePrefix: "twin-support",
    options: [
      { label: "24x7 support", effect: "", land: note("twin-support-247", "24x7 support required", "support") },
      { label: "UK-based support", effect: "", land: note("twin-support-uk", "UK-based support desk required", "support") },
      { label: "Named engineer", effect: "", land: note("twin-support-eng", "A named engineer or TAM required", "support") },
      { label: "Service reviews", effect: "", land: note("twin-support-rev", "Regular service reviews required", "support") },
    ],
  },
  {
    id: "commercial", group: "commercial", label: "How you would rather pay", w: 1, cta: "Any commercial preference?", q: "Is there a commercial shape you would rather buy under?",
    why: "OPEX, subscription and evergreen terms rule some providers' commercial models in or out before price is even discussed.",
    notePrefix: "twin-commercial",
    options: [
      { label: "OPEX preferred", effect: "", land: note("twin-commercial-opex", "OPEX commercial model preferred", "commercial") },
      { label: "Subscription", effect: "", land: note("twin-commercial-sub", "Subscription pricing preferred", "commercial") },
      { label: "Evergreen refresh", effect: "", land: note("twin-commercial-ever", "Evergreen refresh (no forklift renewals) preferred", "commercial") },
    ],
  },
  {
    id: "services", group: "services", label: "Professional services", w: 1, cta: "What delivery work is in scope?", q: "What professional services should be in scope?",
    why: "Migration, project management and training are commonly quoted separately; naming them keeps quotes comparable.",
    notePrefix: "twin-services",
    options: [
      { label: "Migration", effect: "", land: note("twin-services-mig", "Migration services in scope", "services") },
      { label: "Project management", effect: "", land: note("twin-services-pm", "Project management in scope", "services") },
      { label: "Training", effect: "", land: note("twin-services-trn", "Training in scope", "services") },
      { label: "Change requests", effect: "", land: note("twin-services-chg", "Ongoing change requests in scope", "services") },
    ],
  },
  {
    id: "success", group: "success", label: "Success criteria", w: 2, cta: "How will this be judged?", q: "How should success be measured once this is live?",
    why: "Resiliency and uptime targets are the most commonly lost questions; stating them here is what makes vendor SLAs comparable.",
    notePrefix: "twin-success",
    options: [
      { label: "Availability target", effect: "", land: note("twin-success-avail", "A stated availability target is required", "success") },
      { label: "Latency targets", effect: "", land: note("twin-success-lat", "Latency targets are required", "success") },
      { label: "Support SLA", effect: "", land: note("twin-success-sla", "A stated support SLA is required", "success") },
      { label: "Reporting", effect: "", land: note("twin-success-rpt", "Regular reporting is required", "success") },
      { label: "Migration timeline", effect: "", land: note("twin-success-mig", "A stated migration timeline is required", "success") },
    ],
  },
  {
    id: "suppliers", group: "suppliers", label: "Vendor requirements", w: 1, cta: "Any requirements of who may respond?", q: "Are there requirements of who may respond?",
    why: "UK references, framework status and financial standing decide who is even eligible to bid.",
    notePrefix: "twin-suppliers",
    options: [
      { label: "UK references", effect: "", land: note("twin-suppliers-ref", "UK references required", "suppliers") },
      { label: "Framework agreements", effect: "", land: note("twin-suppliers-fw", "Must hold relevant framework agreements", "suppliers") },
      { label: "Partner or direct", effect: "", land: note("twin-suppliers-pd", "Must state whether responding as partner or direct", "suppliers") },
      { label: "Financial standing", effect: "", land: note("twin-suppliers-fin", "Evidence of financial standing required", "suppliers") },
    ],
  },
  /* Compliance (round 7): the clickable UI the extractor and sector packs
     always had a ledger home for (`constraints.complianceRequirements`,
     already multi-value: see estate.cloud/estate.existingNetwork for the
     same pattern) but never had a manual way in. Rendered as a "+" inside
     the existing "Rules you are held to" group, NOT as its own generic
     group, so applied-rule rows never show twice. NHS DSPT and FCA are
     sector-shaped: they only earn a place once the buyer's own standing
     sector matches (Robert: "we only need Healthcare compliance questions
     if the user selects Healthcare as an example"). */
  {
    id: "compliance", group: "compliance", label: "Compliance", w: 2, cta: "Add a compliance requirement", q: "What compliance requirements should bidders meet?",
    why: "It rules bidders in or out before price is even discussed, and it is what your sector's rule pack cannot assert on its own.",
    path: "constraints.complianceRequirements",
    options: [
      { label: "ISO 27001", effect: "", land: fact("constraints.complianceRequirements", "iso27001") },
      { label: "Cyber Essentials Plus", effect: "", land: fact("constraints.complianceRequirements", "cyber_essentials_plus") },
      { label: "PCI DSS", effect: "", land: fact("constraints.complianceRequirements", "pci_dss") },
      { label: "NHS DSPT", effect: "", land: fact("constraints.complianceRequirements", "nhs_dspt"), sectorOnly: /health|pharma/i },
      { label: "FCA obligations", effect: "", land: fact("constraints.complianceRequirements", "fca"), sectorOnly: /financial/i },
      { label: "NIS2", effect: "", land: fact("constraints.complianceRequirements", "nis2") },
      { label: "UK GDPR", effect: "", land: fact("constraints.complianceRequirements", "uk_gdpr") },
    ],
  },
];

const SLOT_BY_ID: Record<string, TwinSlot> = Object.fromEntries(TWIN_SLOTS.map((s) => [s.id, s]));
const SLOT_BY_PATH: Record<string, string> = Object.fromEntries(TWIN_SLOTS.filter((s) => s.path).map((s) => [s.path as string, s.id]));

/** The nine sector quick-start chips (round 6; the reference's ten,
 *  Regulated industries removed by Robert's ruling because it cannot
 *  write a value honestly). Shown until a sector stands. Every chip
 *  writes a real value through the same machinery a click-answer uses,
 *  tagged as the buyer's own choice with the chip's words as the quote;
 *  the slot mapping is the reference's, the values are the ledger's own.
 *  Mid-market has no honest numeric home, so it lands as a noted band
 *  and the People line carries it until a real count is said. */
type ChipDef = { label: string; lands: TwinLand[] };
const SECTOR_CHIPS: ChipDef[] = [
  { label: "Multinational / global enterprise", lands: [fact("organisation.regions", "uk"), fact("organisation.regions", "eu"), fact("organisation.regions", "us")] },
  { label: "Financial services", lands: [fact("organisation.sector", "Financial services")] },
  { label: "Mid-market", lands: [note("chip-mid-band", "500 to 2,000 people", "estate")] },
  { label: "Healthcare", lands: [fact("organisation.sector", "Healthcare & pharma")] },
  { label: "Hybrid / remote workforces", lands: [fact("procurement.buying", "sse")] },
  { label: "Manufacturing", lands: [fact("organisation.sector", "Manufacturing")] },
  { label: "Retail", lands: [fact("organisation.sector", "Retail & e-commerce")] },
  { label: "Professional services", lands: [fact("organisation.sector", "Professional services")] },
  { label: "Education", lands: [fact("organisation.sector", "Education")] },
];
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
  const [phase, setPhase] = useState<"live" | "fits">("live");
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
  /** The thread (round 6): the buyer's messages verbatim and Netify's
   *  template lines, bounded on screen, persistent for the sitting.
   *  Nothing important lives only here; the statement is the record. */
  const [msgs, setMsgs] = useState<ThreadMsg[]>([{ who: "netify", text: THREAD_WELCOME }]);
  const [edit, setEdit] = useState<string | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [expandedFit, setExpandedFit] = useState<string | null>(null);
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
  /** The early save (round 6, Robert's ruling: an option to save when a
   *  verified work email is given). Saving creates the real project
   *  record through the existing create machinery, unpublished; edits
   *  after a save mark the record stale until the next save or publish. */
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDirty, setSaveDirty] = useState(false);
  const [consentSave, setConsentSave] = useState(false);

  const [voiceState, setVoiceState] = useState<"idle" | "starting" | "listening">("idle");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceRec = useRef<{ stop: () => void } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const firstKeyAt = useRef<number | null>(null);
  const firstVerdictSent = useRef(false);
  const previewFired = useRef(false);
  const cycleRef = useRef(0);
  const receiptId = useRef(0);
  const factsRef = useRef<WorkspaceFact[]>([]);
  const receiptsRef = useRef<Receipt[]>([]);
  const assertedPacks = useRef<Set<string>>(new Set());
  const acceptedGaps = useRef<Set<string>>(new Set());
  /** Which scope class the saved record was created under: a class flip
   *  after a save means the next save or publish creates a fresh record
   *  rather than rescoping across engines. */
  const savedSecurity = useRef<boolean | null>(null);
  /** Dropped inferences never return (rule 7): once a guess is dropped,
   *  the extractor may not re-infer the same path and value. A later
   *  STATED assertion still lands: saying it is the buyer's own act. */
  const neverReinfer = useRef<Set<string>>(new Set());
  const nrKey = (path: string, value: unknown) => `${path}::${String(value)}`;

  useEffect(() => { receiptsRef.current = receipts; }, [receipts]);

  /** Netify's voice is a thread line now (round 6): one template
   *  sentence per event, appended, never model prose, never a summary
   *  the statement does not already show. */
  const say = useCallback((text: string) => {
    setMsgs((ms) => [...ms, { who: "netify", text }]);
  }, []);
  /** The buyer's words echo verbatim (Robert's ruling: messages stay). */
  const sayYou = useCallback((text: string) => {
    setMsgs((ms) => [...ms, { who: "you", text }]);
  }, []);
  /** The thread keeps its newest line in view. */
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  /** The composer grows with what you type, like ChatGPT/Gemini's input,
   *  instead of a fixed one-line box (round 9, 2 Aug 2026, Robert: "style
   *  it exactly the same as a ChatGPT input or gemini"). Keyed on `draft`
   *  rather than only the onChange handler so a programmatic clear after
   *  send() also collapses the box back down, not just typing. */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

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
    if (m.changed.length) setSaveDirty(true);
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
    // Fix, 10 Aug 2026 (Harry's Test 5.9 misattribution -- the actual gap
    // it surfaced): NoticeBuilder's handoff links now carry the wizard's
    // sector choice as ?sector=<label>, matching a WORKSPACE_SECTORS entry
    // exactly (checked by hand against notice-options.ts's SECTORS). Seed
    // it the same way scope is seeded above -- inferred, so it reads as a
    // starting point the buyer can strike, not a claim they stated it here.
    const sectorParam = p.get("sector");
    if (sectorParam && (WORKSPACE_SECTORS as readonly string[]).includes(sectorParam)) {
      seedFacts.push({
        path: "organisation.sector",
        value: sectorParam,
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
      if (m.changed.length) markChanged(m.changed, m.facts);
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

  /* Round 6: the prompt lives at the TOP of the surface, sticky under
   * the understanding band, so the round-4 bottom-dock architecture
   * (position:fixed, body padding, visualViewport translate) is retired
   * whole. A top-stuck prompt cannot sink under the mobile keyboard and
   * the estate footer needs no clearance reservation. */

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
    /* The change carries the marker AND one thread line (round 6): the
       rules are already written in when the line appears. */
    setChangedSlots((prev) => [...new Set([...prev, ...merged.changed.map((id) => `rule:${id}`)])]);
    const n = merged.changed.length;
    say(`Your sector writes ${numWord(n)} rule${n === 1 ? "" : "s"} into the statement; they are in already, each with its reason, and any one can be dropped.`);
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
      Boolean(
        (s.path && standingAt(s.path).length > 0) ||
          (s.notePrefix && noted.some((n) => n.id.startsWith(s.notePrefix as string))),
      ),
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
  const pctNote = !started
    ? "Nothing yet. Say one sentence, or answer any open line in the statement."
    : pct >= 78
      ? "Complete enough to price. What is left will not stop anyone quoting."
      : topMissing.length
        ? `Still needed: ${topMissing.join(", ")}.`
        : "Everything the statement tracks is in.";

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

  /** Vendors the buyer has NAMED in their own retained words (quotes,
   *  receipts). A tag for the Constellation, never a rank change: naming
   *  is not evidence. Restored 1 Aug 2026 alongside the Constellation
   *  itself (see ConstellationScene.tsx). */
  const namedSlugs = useMemo(() => {
    const text = [
      ...facts.map((f) => `${f.quote ?? ""} ${f.reason ?? ""}`),
      ...receipts.map((r) => r.text),
    ].join(" ").toLowerCase();
    const out = new Set<string>();
    if (text.trim())
      for (const v of market?.vendors ?? []) {
        const full = v.name.toLowerCase();
        const first = full.split(/[\s/]+/)[0];
        const hit = text.includes(full) || (first.length >= 4 && !["check", "orange"].includes(first) && new RegExp(`\\b${first}\\b`).test(text));
        if (hit) out.add(v.slug);
      }
    return out;
  }, [facts, receipts, market]);
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
        ? `A notice cannot publish without five details, and ${numWord(missingCore.length)} ${missingCore.length === 1 ? "is" : "are"} still open: ${missingCore.join(", ")}. Say it in the prompt, or answer the open lines in the statement.`
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
    setSaveDirty(true);
    ev("workspace_fact_struck", { path: f.path, provenance: f.provenance, undo: "0" });
  }, []);

  /** A row control's drop, with its thread line (the command path says
   *  its own line, so it calls dropFact directly). */
  const dropRow = useCallback(
    (f: WorkspaceFact) => {
      const inferred = f.provenance === "inferred";
      const label = cap(factLabel(f));
      dropFact(f.id);
      say(
        inferred
          ? `Dropped: ${label}. It will not come back unless you say it yourself.`
          : `Cleared: ${label}. It is an open line in the statement again.`,
      );
    },
    [dropFact, say],
  );

  /** Clears exactly one held note by id (round 8, 2 Aug 2026 bug found in
   *  QA): the genuinely multi-select slots restored in round 7 (Support,
   *  Change model, and so on) can hold several notes under one prefix at
   *  once. The "Held now" list's per-row clear button was calling
   *  clearNotes(prefix) and wiping every note in the slot, not just the
   *  one the buyer clicked clear on. This is the correct per-item form. */
  const clearNote = useCallback((id: string) => {
    setNoted((ns) => ns.filter((n) => n.id !== id));
    setChangedSlots([]);
    setSaveDirty(true);
  }, []);

  const keepReceipt = useCallback((text: string) => {
    setReceipts((rs) => [...rs, { id: ++receiptId.current, text }]);
    setSaveDirty(true);
  }, []);

  /** Drops one kept-verbatim note (round 8): the same removal every other
   *  row on the statement already has, now that receipts render as their
   *  own "Other requirements" group instead of only in the side sheet. */
  const dropReceipt = useCallback((id: number) => {
    setReceipts((rs) => rs.filter((r) => r.id !== id));
    setSaveDirty(true);
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
        setSaveDirty(true);
        ev("workspace_earned_answered", { q: l.id, kind: "note" });
      }
      say(`${slot.label} set to “${opt.label}”.`);
      setEdit(null);
    },
    [applyMerge, markChanged, say],
  );

  /** A sector chip lands real values through the same machinery a
   *  click-answer uses (round 6, ruling 5): stated provenance, the
   *  chip's words as the quote, never an invented fact. */
  const pickChip = useCallback(
    (chip: ChipDef) => {
      const factLands = chip.lands.filter((l): l is Extract<TwinLand, { kind: "fact" }> => l.kind === "fact");
      const noteLands = chip.lands.filter((l): l is Extract<TwinLand, { kind: "note" }> => l.kind === "note");
      const landedSlots: string[] = [];
      if (factLands.length) {
        const m = applyMerge(
          factLands.map((l) => ({ path: l.path, value: l.value, provenance: "stated" as const, quote: chip.label })),
          "answer",
        );
        markChanged(m.changed.length ? m.changed : factLands.map((l) => factId(l.path, l.value)), m.facts);
        for (const l of factLands) {
          ev("workspace_gap_answered", { field: l.path });
          const sid = SLOT_BY_PATH[l.path];
          if (sid && !landedSlots.includes(SLOT_BY_ID[sid].label)) landedSlots.push(SLOT_BY_ID[sid].label);
        }
      }
      if (noteLands.length) {
        for (const l of noteLands) {
          setNoted((ns) => (ns.some((n) => n.id === l.id) ? ns : [...ns, { id: l.id, label: l.text, section: l.section, own: true }]));
          ev("workspace_earned_answered", { q: l.id, kind: "note" });
        }
        if (!factLands.length) setChangedSlots(["people"]);
        setSaveDirty(true);
        if (!landedSlots.includes("People")) landedSlots.push("People");
      }
      const sectorLand = factLands.find((l) => l.path === "organisation.sector");
      say(
        sectorLand
          ? `Sector set to “${String(sectorLand.value)}”.`
          : `${listJoin(landedSlots)} written from “${chip.label}”.`,
      );
    },
    [applyMerge, markChanged, say],
  );

  /* ---- The extraction cycle (the same organ). Round 6: the cycle
     reports which slots it changed so the thread can say exactly that,
     a template line composed from the diff and nothing else. ---- */
  type CycleResult = { landed: number; labels: string[]; rules: number; error: boolean };
  const runCycle = useCallback(
    async (text: string): Promise<CycleResult> => {
      const trimmed = text.trim();
      if (trimmed.length < 3 || busy) return { landed: 0, labels: [], rules: 0, error: false };
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

        /* Engine notes reach the buyer only in buyer words, one thread
           line; everything else stays off the surface entirely. */
        const notes = (data.notes ?? [])
          .filter((n) => /^Dropped /.test(n))
          .slice(0, 2)
          .map(humaniseNote);
        if (notes.length) say(cap(notes.join("; ") + "."));

        /* The diff, named for the thread: slot labels for slot facts,
           a count for rule facts. */
        const byId = new Map(merged.facts.map((f) => [f.id, f]));
        const labels: string[] = [];
        let rules = 0;
        for (const id of merged.changed) {
          const f = byId.get(id);
          if (!f) continue;
          if (f.path === "constraints.complianceRequirements") { rules += 1; continue; }
          const sid = SLOT_BY_PATH[f.path];
          const lbl = (sid ? SLOT_BY_ID[sid].label : PATH_LABELS[f.path] ?? f.path).toLowerCase();
          if (!labels.includes(lbl)) labels.push(lbl);
        }
        return { landed: merged.changed.length, labels, rules, error: false };
      } catch {
        setCycleError("The engine did not answer; your words are unchanged, say it again in a moment.");
        return { landed: 0, labels: [], rules: 0, error: true };
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
    [runCycle],
  );

  /** What is most useful next, computed off the fresh refs so the reply
   *  after a cycle names the right gaps. */
  const missingNow = useCallback((): string[] => {
    const factsLive = factsRef.current.filter((f) => !f.struck);
    const has = (p: string) => factsLive.some((f) => f.path === p);
    return TWIN_SLOTS.filter(
      (s) => !((s.path && has(s.path)) || (s.notePrefix && noted.some((n) => n.id.startsWith(s.notePrefix as string)))),
    )
      .sort((a, b) => b.w - a.w)
      .map((s) => s.label.toLowerCase());
  }, [noted]);

  /* ---- The send: one entry for everything typed, spoken or clicked
     through. Commands first; the extractor for the rest. Round 6: the
     buyer's words echo in the thread, and the reply is a template line
     composed from the diff, exactly what was written in and what is
     most useful next. A sentence that lands nothing is kept verbatim
     with the notes and the thread says so once. ---- */
  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setDraft("");
    if (!firstKeyAt.current) firstKeyAt.current = Date.now();
    sayYou(text);

    const cmd = parseCommand(text);
    if (cmd) {
      handleCommand(cmd);
      return;
    }

    const r = await runCycle(text);
    if (r.landed > 0) {
      const parts: string[] = [];
      if (r.labels.length) parts.push(`Written in: ${r.labels.join(", ")}.`);
      if (r.rules > 0) parts.push(`${cap(numWord(r.rules))} rule${r.rules === 1 ? "" : "s"} landed in the statement with your words as provenance.`);
      const miss = missingNow();
      parts.push(miss.length ? `Most useful next: ${miss.slice(0, 2).join(" and ")}.` : "Everything the statement tracks is in.");
      say(parts.join(" "));
      return;
    }
    if (r.error) return; /* the caption carries the engine error; the words stay in the prompt's history */

    /* Nothing landed: kept verbatim, said once in the thread. */
    keepReceipt(text);
    say(THREAD_NO_CATCH);
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
        if (topMissing.length) lines.push(`The open lines in the statement name the rest: ${topMissing.join(", ")}.`);
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
        /* Round 8 (2 Aug 2026, Robert: "if someone types... remove this...
           it should work"): "drop X"/"remove X" now reaches anything on
           the statement, not just a vendor or a guess — a stated fact, a
           noted multi-select item (Support, Change model, and so on), or
           a kept-verbatim note, matched the same way a vendor name is:
           against the words the page itself shows, either direction. Each
           removal fires the exact same function its own row's own button
           calls, so the thread reads exactly as if the buyer had clicked
           it, with the correct "dropped"/"cleared" wording for whether it
           was netify's guess or the buyer's own stated word. */
        if (cmd.kind === "dropName") {
          const liveFacts = factsRef.current.filter((x) => !x.struck);
          const f = liveFacts.find((x) => {
            const l = norm(factLabel(x));
            return l.length > 0 && (l.includes(target) || target.includes(l));
          });
          if (f) { dropRow(f); return; }
          const n = noted.find((x) => {
            const l = norm(x.label);
            return l.length > 0 && (l.includes(target) || target.includes(l));
          });
          if (n) { clearNote(n.id); say(`Cleared: ${n.label}. It is an open line in the statement again.`); return; }
          const rcpt = receipts.find((x) => {
            const l = norm(x.text);
            return l.length > 0 && (l.includes(target) || target.includes(l));
          });
          if (rcpt) { dropReceipt(rcpt.id); say(`Cleared: “${rcpt.text}”. It will not come back unless you say it yourself.`); return; }
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

  /* ---- The create step, shared by the early save and the publish
     chain (round 6): the same payloads, the same records, unpublished.
     The wizard-store payload only carries the submit-agreement consent
     when the publish chain is running; a save records no agreement the
     buyer has not ticked. ---- */
  function rfpPayload(withSubmitConsent: boolean) {
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
    return {
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
      ...(withSubmitConsent
        ? { consent: { version: "submit-agreement v3, 17 July 2026", agreed_at: Date.now(), flow: "workspace" } }
        : {}),
      position: {
        covered_sections: coveredSections,
        sector: (requirement.organisation?.sector as string | undefined) ?? null,
      },
    };
  }

  async function createRecord(withSubmitConsent: boolean): Promise<{ id: string; manage: string; test: boolean }> {
    if (securityScope) {
      const res = await fetch("/sase/api/security-sourcing/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirement, consent: true, preferred_vendors: pins, ...(testMode ? { test: true } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.project?.id) throw new Error(data.error || "Could not create the project; try again.");
      return { id: data.project.id, manage: data.project.manage_token || "", test: testMode || Boolean(data.project.test) };
    }
    const res = await fetch("/sase/api/rfp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rfpPayload(withSubmitConsent)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) throw new Error(data.error || "Could not create the requirement; try again.");
    return { id: data.id, manage: data.manage_token ?? "", test: false };
  }

  /** Bring a saved record up to the statement as it stands: the wizard
   *  store through its own PUT, the engine through its own re-scope. */
  async function refreshRecord(proj: { id: string; manage: string; test: boolean }) {
    if (securityScope) {
      const res = await fetch(`/sase/api/security-sourcing/project/${proj.id}/rescope`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manage_token: proj.manage, requirement, consent: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not refresh the saved record; try again.");
      return;
    }
    const res = await fetch(`/sase/api/rfp/${proj.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manage_token: proj.manage, ...rfpPayload(false), regenerate: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not refresh the saved record; try again.");
  }

  /* ---- The early save (round 6, Robert's ruling): a verified work
     email may create the real project record before any publish. The
     header stays honest either way; nothing is invited and nothing is
     listed until the signature chain runs. ---- */
  async function saveNow() {
    if (!started || saveBusy) return;
    if (securityScope && !consentSave) return;
    setSaveBusy(true);
    setSaveError(null);
    try {
      const scopeChanged = created !== null && savedSecurity.current !== null && savedSecurity.current !== securityScope;
      if (!created || scopeChanged) {
        const proj = await createRecord(false);
        setCreated(proj);
        savedSecurity.current = securityScope;
        setSaveDirty(false);
        ev("workspace_saved", { scope: buying ?? "security", id: proj.id });
        say(
          scopeChanged
            ? "What you are buying changed class, so saving made a fresh record; the earlier draft stays yours from its own link."
            : "Saved. Your project record now holds this statement; open it from the header any time. Nothing is published and nobody has been invited.",
        );
      } else {
        await refreshRecord(created);
        setSaveDirty(false);
        ev("workspace_saved", { scope: buying ?? "security", id: created.id });
        say("Saved again: your project record matches the statement.");
      }
      setSaveOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save; nothing has left this page.");
    } finally {
      setSaveBusy(false);
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
      const scopeChanged = proj !== null && savedSecurity.current !== null && savedSecurity.current !== securityScope;
      if (!proj || scopeChanged) {
        setSignStage("Creating your position on the record…");
        proj = await createRecord(true);
        setCreated(proj);
        savedSecurity.current = securityScope;
        setSaveDirty(false);
        ev(proj.test ? "workspace_created_test" : "workspace_created", { scope: buying ?? "security", id: proj.id });
      } else if (saveDirty) {
        /* Saved earlier, edited since: the record must match the
           statement before anything publishes from it. */
        setSignStage("Refreshing your saved record…");
        await refreshRecord(proj);
        setSaveDirty(false);
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
  /* The document names itself from the sector (the reference's title,
     the estate's punctuation). */
  const docTitle = `Statement of requirements${sectorShort ? `, ${sectorShort}` : ""}`;

  /* Round 6: the shortcut chips are dead. Two carried example answers
     (a named standard, a specific site count), which the no-example law
     forbids, and the reference carries no chips once a sector is set.
     Every advertised sentence still works typed; the surface copy
     advertises them where they apply. */

  const sendReady = draft.trim().length > 0 && !busy;
  const readyToFit = pct >= 62 && Boolean(fitBuying) && !published;

  if (!booted) return <div className="pd-root mt-10" />;

  const mono: React.CSSProperties = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' };
  const editSlot = edit ? SLOT_BY_ID[edit] ?? null : null;

  /* ---- Slot row renderers (round 6: the reference's document rows,
     label on the left, value with its provenance, tag, one control) ---- */
  const slotCell = (s: TwinSlot) => {
    const isNew = changedSlots.includes(s.id);
    const rowCls = "flex items-start gap-3.5 border-b border-dotted border-[#EFECE5] py-[9px]";
    const rowStyle: React.CSSProperties = isNew ? { background: "#FFFCF3", boxShadow: "inset 2px 0 0 #F5A21B", paddingLeft: 10, marginLeft: -10 } : {};
    const labCls = "w-[92px] flex-none pt-[2px] text-[13px] text-[#8C8A85] sm:w-[150px]";
    const tagBase: React.CSSProperties = { ...mono, fontSize: "9.5px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", borderRadius: "4px", padding: "3px 5px", flex: "none" };
    const ctlCls = "flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[9.5px] uppercase text-[#A3A099]";

    const fs = s.path ? standingAt(s.path) : [];
    if (s.path && fs.length) {
      const anyInferred = fs.some((f) => f.provenance === "inferred");
      const latest = fs[fs.length - 1];
      const value = fs.length === 1
        ? cap(factLabel(latest))
        : `${fs.slice(0, 3).map((f) => cap(factLabel(f))).join(", ")}${fs.length > 3 ? ` and ${numWord(fs.length - 3)} more` : ""}`;
      const meta = latest.provenance === "stated"
        ? (latest.source === "answer" ? "you chose this" : latest.quote ? `“${latest.quote}”` : "your words")
        : latest.reason ?? "netify guessed";
      /* Fix, 10 Aug 2026 (Harry's E2E, Test 1.6): Cloud held one value with
         no visible way to add a second, though estate.cloud (like the
         twelve other LIST_FACT_PATHS -- regions, existing network,
         compliance, and so on) genuinely accumulates multiple facts at the
         data layer. The gap was purely this row's own control: at exactly
         one held value it showed only "clear", never "edit" -- "edit" only
         appeared once a second value already existed some other way, so
         there was nothing telling a buyer that clicking the value text
         itself (already wired to setEdit two lines up) reopens the same
         picker to add another. A genuinely single-value path (Sector,
         Sites) keeps "clear": there is no second value to add, so "edit"
         would be a picker with nothing new to offer. */
      const single = fs.length === 1 && !LIST_FACT_PATHS.has(s.path as string);
      return (
        <div key={s.id} className={rowCls} style={rowStyle}>
          <span className={labCls}>{s.label}</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <button
              type="button"
              onClick={() => setEdit(s.id)}
              title={s.q}
              className="cursor-pointer border-0 bg-transparent p-0 text-left text-[16px] font-medium leading-[1.4] text-[#141414]"
              style={{ textWrap: "pretty" }}
            >
              {value}
            </button>
            <span className="text-[12px] italic text-[#A3A099]">{meta}</span>
          </div>
          <span style={{ ...tagBase, ...(anyInferred ? { background: "#F1EFE9", color: "#7A7770" } : { background: "#EAF6EE", color: "#256B3E" }) }}>
            {anyInferred ? "netify guessed" : "your words"}
          </span>
          {single ? (
            <button type="button" onClick={() => dropRow(latest)} className={`${ctlCls} hover:border-[#B4650B] hover:text-[#B4650B]`} style={{ ...mono, letterSpacing: "0.07em" }}>
              {latest.provenance === "inferred" ? "drop" : "clear"}
            </button>
          ) : (
            <button type="button" onClick={() => setEdit(s.id)} className={`${ctlCls} hover:border-[#141414] hover:text-[#141414]`} style={{ ...mono, letterSpacing: "0.07em" }}>
              edit
            </button>
          )}
        </div>
      );
    }
    const ns = s.notePrefix ? noted.filter((n) => n.id.startsWith(s.notePrefix as string)) : [];
    if (ns.length) {
      /* Round 7: several notes can hold under one prefix (a buyer can pick
         both "24x7 support" and "Named engineer"); show every held label,
         not just the first, mirroring the multi-fact case above. */
      const labelFor = (n: (typeof ns)[number]) => s.options.find((o) => o.land.kind === "note" && o.land.id === n.id)?.label ?? n.label;
      const value = ns.length === 1
        ? labelFor(ns[0])
        : `${ns.slice(0, 3).map(labelFor).join(", ")}${ns.length > 3 ? ` and ${numWord(ns.length - 3)} more` : ""}`;
      return (
        <div key={s.id} className={rowCls} style={rowStyle}>
          <span className={labCls}>{s.label}</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <button
              type="button"
              onClick={() => setEdit(s.id)}
              className="cursor-pointer border-0 bg-transparent p-0 text-left text-[16px] font-medium leading-[1.4] text-[#141414]"
              style={{ textWrap: "pretty" }}
            >
              {value}
            </button>
            <span className="text-[12px] italic text-[#A3A099]">you chose this</span>
          </div>
          <span style={{ ...tagBase, background: "#EAF6EE", color: "#256B3E" }}>your words</span>
          {/* Fix, 10 Aug 2026 (Harry's E2E, Test 1.6 -- same root cause as
              the fact-based row above): every note-based slot here is
              multi-select by design (round-7 comment above `ns`: "a buyer
              can pick both 24x7 support and Named engineer"), so showing
              only "clear" at exactly one held note wrongly implied there
              was nothing left to add. Always "edit"; clearing one note (or
              the whole prefix) still happens from inside the edit sheet. */}
          <button type="button" onClick={() => setEdit(s.id)} className={`${ctlCls} hover:border-[#141414] hover:text-[#141414]`} style={{ ...mono, letterSpacing: "0.07em" }}>
            edit
          </button>
        </div>
      );
    }

    /* Empty: visible, dashed, directly actionable, and an open question
       only (round 6 law: no example answers in the buyer's mouth). */
    return (
      <div key={s.id} className={rowCls} style={rowStyle}>
        <span className={`${labCls} pt-[10px]`}>{s.label}</span>
        <button
          type="button"
          onClick={() => setEdit(s.id)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[9px] border border-dashed border-[#D3CFC6] bg-transparent px-3 py-[9px] text-left text-[13.5px] text-[#8C8A85] hover:border-[#141414] hover:bg-white hover:text-[#141414]"
        >
          <span className="text-[12px] text-[#C4C0B8]" style={mono}>+</span>
          {s.cta}
        </button>
      </div>
    );
  };

  /* ================================================================ */
  /* Render (round 6): the prompt rides sticky at the top under the    */
  /* estate nav with the band and the bounded thread; the statement    */
  /* is one document card scrolling beneath it.                        */
  /* ================================================================ */
  return (
    <div
      className="pd-root mt-8"
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#141414" }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer?.files?.[0]); }}
    >
      {/* ── THE TOP BLOCK (round 6, thread moved out round 7) ── sticky
          under the estate MegaNav: the identity row, the always-visible
          understanding band with the live market count, the prompt, and
          the sector chips until a sector stands. The thread now scrolls
          in its own panel below (round 7: a Claude/ChatGPT-sized panel
          cannot live in a permanently pinned dock). The prompt never
          leaves the screen.

          Round 11 catch (2 Aug 2026, Robert, second screenshot: "still
          not 1 section as requested"). Round 10 removed the conversation
          panel's own border/card/shadow, but this dock was still painted
          its own solid colour (#F4F2EE, a warm beige) -- a real seam,
          but the first attempt at the fix (this comment, initially)
          mis-cited the page's colour: globals.css's --paper-base is
          #ffffff, but that is not what actually paints this page. Both
          src/app/home/page.tsx and src/app/workspace/page.tsx wrap their
          entire route in `<div className="relative bg-[#fbfaf8]">` --
          an explicit override, so the true page background under the
          dock, the conversation thread and the statement of requirements
          is #fbfaf8, a warm off-white, never pure white. Setting the
          dock to #fff (the first attempt) actually painted a NEW seam,
          a white island on a cream page, in the opposite direction.
          Caught live on production, not assumed: the dock now matches
          #fbfaf8, the colour every other inch of this route already
          uses. It stays opaque (scrolled content still needs to
          disappear cleanly behind it, being sticky).

          Round 14 catch (2 Aug 2026, Robert, re-testing this exact
          screenshot after round 13 shipped: "no different"). Rounds
          11-13 closed every colour and border seam on this route, but
          the dock's own soft drop shadow -- kept deliberately through
          all three of those rounds as a depth cue for a sticky element
          -- was itself still reading as a boxed card: box-shadow with
          blur exceeding its negative spread doesn't stay confined to
          the bottom edge, it feathers out a few px on every side, which
          is exactly the rounded-corner-card impression a zoomed
          screenshot of the live page showed. The dock's background and
          border were already proven identical to the page (verified
          via computed style, not assumed) -- the shadow was the one
          remaining thing drawing a boundary around it. It's gone. The
          dock is still sticky and still opaque, so scrolled content
          still disappears behind it cleanly; it just no longer looks
          like a card floating over the page it's part of. */}
      <div data-dock="1" className="sticky z-30" style={{ top: 52, background: "#fbfaf8" }}>
        <div className="mx-auto w-full max-w-[1000px] px-[26px] pb-3 pt-1">
          {started && (
            <div className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 pb-2">
              <span className="text-[14.5px] font-medium text-[#33302C]">{projectName}</span>
              {created ? (
                <a
                  href={`/sase/project/${created.id}${created.manage ? `?manage=${encodeURIComponent(created.manage)}` : ""}`}
                  className="text-[11.5px] text-[#256B3E] underline decoration-[#BCD9C6] underline-offset-2 hover:decoration-[#256B3E]"
                  style={mono}
                >
                  {saveDirty ? "saved, edits since" : "saved"} · open your project record
                </a>
              ) : (
                <span className="text-[11.5px] text-[#A3A099]" style={mono}>nothing leaves this page</span>
              )}
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => { setReqOpen(true); ev("workspace_command", { kind: "sheet_open" }); }}
                className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[13.5px] text-[#6E6C67] hover:text-[#141414]"
              >
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#2E9E52]" aria-hidden="true" />
                {understood} {understood === 1 ? "thing" : "things"} understood · see the requirement
              </button>
              {(!created || saveDirty) && (
                <button
                  type="button"
                  onClick={() => { setSaveOpen(true); setSaveError(null); }}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#6E6C67] underline decoration-[#C9C5BC] underline-offset-2 hover:text-[#141414]"
                >
                  {created ? "Save changes" : "Save this project"}
                </button>
              )}
              <button
                type="button"
                onClick={() => window.location.assign(window.location.pathname)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#A3A099] hover:text-[#141414]"
              >
                Start again
              </button>
            </div>
          )}

          {/* The understanding band and the market count: always visible,
              derived, never decorative. */}
          <div className="flex flex-wrap items-end gap-x-[22px] gap-y-2 pb-2.5">
            <div className="min-w-[220px] flex-1">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[10.5px] uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: "0.1em" }}>Requirement understood</span>
                <span className="text-[15px] font-semibold" style={mono}>{pct}%</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#A3A099]">{pctNote}</span>
              </div>
              <div className="mt-2 flex gap-[3px]">
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className="h-[6px] flex-1 rounded-[2px]" style={{ background: (i * 100) / 12 < pct ? "#F5A21B" : "#E8E4DC" }} />
                ))}
              </div>
            </div>
            <div className="flex-none border-l border-[#E5E1D9] pl-[22px]">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-semibold leading-none" style={{ ...mono, letterSpacing: "-0.02em" }}>{fittingCount ?? "…"}</span>
                <span className="text-[12.5px] text-[#8C8A85]">of {marketTotal ?? "…"} still fit</span>
              </div>
              <div className="mt-1 max-w-[250px] text-[11.5px] leading-[1.45] text-[#A3A099]">{marketNote}</div>
            </div>
          </div>

          {/* The prompt (the input method, never the subject). Styled as a
              real chat composer (round 9, 2 Aug 2026, Robert: "style it
              exactly the same as a ChatGPT input or gemini"), not a form
              row: one growing textarea, one primary round send button
              carrying the arrow (the icon a chat app's send button is
              actually supposed to mean), attach/mic as smaller secondary
              icons beside it. The old layout had this backwards — the
              up-arrow triggered a file picker, and the real send action
              was a separate text-labelled pill button ("Apply") to its
              right, which is not how any chat surface reads. */}
          <div className="flex items-end gap-2 rounded-[24px] border border-[#DDD9D1] bg-white py-2 pl-[18px] pr-2" style={{ boxShadow: "0 4px 18px rgba(20,20,20,.06)" }}>
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
              placeholder={started ? PLACEHOLDER_LIVE : PLACEHOLDER_EMPTY}
              rows={1}
              className="min-h-[24px] max-h-[160px] flex-1 resize-none overflow-y-auto border-0 bg-transparent py-1 text-[16px] leading-[1.45] text-[#141414] outline-none placeholder:text-[#A3A099]"
            />
            <div className="flex flex-none items-center gap-1.5">
              {voiceSupported && (
                <button
                  type="button"
                  onClick={() => (voiceState === "idle" ? startVoice() : voiceRec.current?.stop())}
                  title={voiceState === "idle" ? "Say it out loud" : "Stop listening"}
                  className={`flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-full border bg-white ${voiceState === "listening" ? "border-[#B4650B] text-[#B4650B]" : "border-transparent text-[#8C8A85] hover:border-[#E3E0DA] hover:text-[#141414]"}`}
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
                title="Drop or choose a plain-text document and it will be read into the statement"
                className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-full border border-transparent text-[#8C8A85] hover:border-[#E3E0DA] hover:text-[#141414]"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M11.5 5.5 6 11a2.5 2.5 0 1 0 3.54 3.54L15 9.08a4 4 0 1 0-5.66-5.66L4 8.76" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,text/plain" className="hidden" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
              <button
                type="button"
                onClick={() => void send(draft)}
                disabled={!sendReady}
                title={busy ? "Reading…" : started ? "Send" : "Start"}
                aria-label={busy ? "Reading" : started ? "Send" : "Start"}
                className={`flex h-[36px] w-[36px] flex-none cursor-pointer items-center justify-center rounded-full border-0 transition-colors ${sendReady ? "bg-[#F5A21B] text-[#141414] hover:bg-[#E5940F]" : "bg-[#F0EEE9] text-[#C7C3BA]"} disabled:cursor-not-allowed`}
              >
                {busy ? (
                  <span className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {/* Robert, 10 Aug 2026 (screenshot of this exact empty state):
              it isn't obvious the box above fills in the statement fields
              below automatically. That instruction already existed
              further down (THREAD_WELCOME, and the statement's own
              intro paragraph) but both sit well below the fold here and
              were being missed. This is the same sentence, moved to
              where the eye actually is: directly under the box, only
              before the first fact lands. Round-6 law (no example
              answers in copy) still holds -- this describes the
              mechanism, it does not demonstrate an answer. */}
          {!started && (
            <p className="m-0 px-1 pt-1.5 text-[12.5px] leading-relaxed text-[#8C8A85]">
              Answers below fill in automatically as you describe your requirement above.
            </p>
          )}
          {wrongCompany && (
            <p className="m-0 px-1 pt-1.5 text-[12.5px] leading-relaxed text-[#8C8A85]">
              Looking for website hosting? That is Netlify, a different company. This is Netify, the SASE and SD-WAN procurement marketplace; carry on if the network is what you came for.
            </p>
          )}
          {pasteSummary && <p className="m-0 px-1 pt-1.5 text-[12.5px] leading-relaxed text-[#8C8A85]">{pasteSummary}</p>}
          {cycleError && <p className="m-0 px-1 pt-1.5 text-[12.5px] leading-relaxed text-[#B4650B]">{cycleError}</p>}
          {voiceError && <p className="m-0 px-1 pt-1.5 text-[12.5px] leading-relaxed text-[#8C8A85]">{voiceError}</p>}

          {/* The nine sector quick-start chips: shown until a sector
              stands; one scrollable row on small screens. */}
          {!coreFive.sector && (
            <div className="flex items-center gap-[7px] overflow-x-auto pt-2.5 sm:flex-wrap sm:overflow-visible" style={{ scrollbarWidth: "none" }}>
              <span className="flex-none text-[12.5px] text-[#A3A099]">Or start from your sector:</span>
              {SECTOR_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => pickChip(c)}
                  className="flex-none cursor-pointer whitespace-nowrap rounded-full border border-[#E0DCD3] bg-[#FBFAF8] px-3.5 py-[7px] text-[13px] text-[#33302C] hover:border-[#141414] hover:bg-white"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── THE THREAD (round 7, 1 Aug 2026: Robert — "the idea was
          this section had a memory and users could keep typing to
          generate the living statement, so there would be a scrolling
          window as per Claude, ChatGPT interface etc"). The memory was
          already unbounded (say/sayYou only ever append, nothing is
          dropped) — the gap was purely visual: a 110-150px sliver from
          his 31 Jul ruling ("small persistent chat window"). Chose a
          large panel (his pick, ~600px+) but pulled it OUT of the sticky
          dock rather than growing the dock itself: the dock stays pinned
          to the viewport top on every scroll position, so a Claude-sized
          panel living inside it would permanently cover most of the
          screen. Here it scrolls with the page like the statement below
          it, and scrolls internally once its own history outgrows the
          panel, the same way a real chat column does.

          Round 10 catch (2 Aug 2026, Robert, pointing at the screenshot:
          "I said I wanted a single chat as per ChatGPT, there's 2
          separate sections"). Round 9 restyled the input to look like a
          chat composer but this panel kept its own rounded border, card
          background and drop shadow, so the composer and the thread
          still read as two framed boxes with a visible seam between
          them — no chat app boxes its input separately from its own
          history. The fix is visual only: this panel no longer carries
          a border, card background or shadow of its own, so it reads as
          the same continuous surface the sticky composer sits on, one
          chat column rather than two stacked cards. Nothing about the
          data, the memory, or the scroll behaviour changes. */}
      <div className="mx-auto w-full max-w-[1000px] px-[26px] pt-3">
        {msgs.length > 0 && (
          <p className="m-0 mb-2 px-1 text-[11.5px] leading-[1.5] text-[#A3A099]">
            Feedback only, kept for this sitting — the statement below is the record.
          </p>
        )}
        <div ref={threadRef} className="flex max-h-[420px] flex-col gap-[11px] overflow-y-auto px-1 sm:max-h-[620px]">
          {msgs.map((m, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span
                className="w-[52px] flex-none pt-[3px] text-[10px] font-semibold uppercase"
                style={{ ...mono, letterSpacing: "0.08em", color: m.who === "you" ? "#A3A099" : "#B4650B" }}
              >
                {m.who === "you" ? "You" : "Netify"}
              </span>
              <span className="max-w-[56em] text-[13.5px] leading-[1.55]" style={{ textWrap: "pretty", color: m.who === "you" ? "#141414" : "#5F5D59" }}>
                {m.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── THE LIVING STATEMENT ── one document card, five ruled
          sections of labelled rows, from the very first paint (Robert's
          ruling: the empty project IS the door): every empty line
          visible, dashed and clickable at zero. Change is shown in the
          rows; the thread above only ever repeats the diff.

          Round 13 catch (2 Aug 2026, Robert, a ChatGPT screenshot: "does
          this look like ChatGPT? I want it in one section"). Rounds
          10-12 closed the seam between the composer and the conversation
          thread, but this document was still its own bordered, shadowed
          card -- a third box on the page, the exact thing the ChatGPT
          reference never does (one continuous canvas, no boxes at all).
          Asked directly rather than guessed, since this panel had been
          ruled a deliberately distinct "document" earlier in the
          project: his answer was to drop the boundary here too. The
          card's own background was already #FBFAF8, the same value as
          the page's #fbfaf8 (round 12) -- only the border and the drop
          shadow were drawing a line that color alone no longer needed
          to. Both are gone; the padding stays, so the document still
          reads as its own paragraph, just without a frame around it. */}
      {phase === "live" && (
        <div className="mx-auto w-full max-w-[1000px] px-[26px] pb-6 pt-[22px]">
          <div className="px-6 pb-7 pt-7 sm:px-[46px] sm:pb-[34px] sm:pt-[38px]">
          <div className="text-[10.5px] uppercase text-[#B4650B]" style={{ ...mono, letterSpacing: "0.11em" }}>Statement of requirements · living</div>
          <h2 className="mb-1.5 mt-2.5 text-[26px] font-semibold leading-[1.2] sm:text-[29px]" style={{ letterSpacing: "-0.025em" }}>{docTitle}</h2>
          <p className="m-0 mb-[26px] max-w-[44em] text-[14px] leading-[1.6] text-[#8C8A85]">
            This document is the project. It fills in as you talk, every line shows where it came from, and vendors and service providers bid against exactly what is on this page.
          </p>

          {TWIN_GROUPS.map((g) => {
            if (g.id === "rules") {
              const rows = ruleFacts;
              const state = coreFive.sector ? (rows.length ? `${rows.length} applied` : "none yet") : "waiting";
              return (
                <div key={g.id} className="border-t border-[#EFECE5] pb-4 pt-[18px]">
                  <div className="mb-2 flex items-baseline gap-[11px]">
                    <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>{g.title}</span>
                    <span className="min-w-0 flex-1 text-[12.5px] text-[#A3A099]">{g.note}</span>
                    <span className="flex-none text-[11px] text-[#A3A099]" style={mono}>{state}</span>
                  </div>
                  <div className="flex flex-col">
                    {rows.length > 0 ? (
                      rows.map((f) => {
                        const isNew = changedSlots.includes(`rule:${f.id}`);
                        return (
                          <div
                            key={f.id}
                            className="flex items-start gap-3.5 border-b border-dotted border-[#EFECE5] py-[9px]"
                            style={isNew ? { background: "#FFFCF3", boxShadow: "inset 2px 0 0 #F5A21B", paddingLeft: 10, marginLeft: -10 } : {}}
                          >
                            <span className="w-[92px] flex-none pt-[2px] text-[13px] text-[#8C8A85] sm:w-[150px]">Applied</span>
                            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                              <span className="text-[16px] font-medium leading-[1.4]" style={{ textWrap: "pretty" }}>
                                {COMPLIANCE_LABELS[String(f.value)] ?? String(f.value)}
                              </span>
                              <span className="text-[12px] italic text-[#A3A099]">
                                {f.provenance === "inferred" ? f.reason ?? "asserted by your sector pack" : f.quote ? `“${f.quote}”` : "your words"}
                              </span>
                            </div>
                            <span
                              className="flex-none rounded-[4px] px-[5px] py-[3px] text-[9.5px] font-semibold uppercase"
                              style={{ ...mono, letterSpacing: "0.07em", ...(f.provenance === "inferred" ? { background: "#FFF3DC", color: "#8A4D08" } : { background: "#EAF6EE", color: "#256B3E" }) }}
                            >
                              {f.provenance === "inferred" ? "from your sector" : "your words"}
                            </span>
                            <button
                              type="button"
                              onClick={() => dropRow(f)}
                              className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[9.5px] uppercase text-[#A3A099] hover:border-[#B4650B] hover:text-[#B4650B]"
                              style={{ ...mono, letterSpacing: "0.07em" }}
                            >
                              {f.provenance === "inferred" ? "drop" : "clear"}
                            </button>
                          </div>
                        );
                      })
                    ) : coreFive.sector ? (
                      <div className="py-[9px] text-[13.5px] leading-[1.55] text-[#8C8A85]">
                        No asserted rule pack for this sector yet. Any rule you state lands here with your words as its provenance.
                      </div>
                    ) : (
                      <div className="flex items-start gap-3.5 py-[9px]">
                        <span className="w-[92px] flex-none pt-[10px] text-[13px] text-[#8C8A85] sm:w-[150px]">Sector rules</span>
                        <button
                          type="button"
                          onClick={() => setEdit("sector")}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[9px] border border-dashed border-[#D3CFC6] bg-transparent px-3 py-[9px] text-left text-[13.5px] text-[#8C8A85] hover:border-[#141414] hover:bg-white hover:text-[#141414]"
                        >
                          <span className="text-[12px] text-[#C4C0B8]" style={mono}>+</span>
                          Set your sector to load these
                        </button>
                      </div>
                    )}
                    {/* Round 7 restore: the sector pack can only offer or
                        assert; a compliance requirement the buyer knows
                        outright (an auditor named it, a client mandates
                        it) needs a manual way in. Same click-to-fact
                        machinery every other slot uses; sector-shaped
                        options (NHS DSPT, FCA) only appear once the
                        standing sector matches. */}
                    <div className="flex items-start gap-3.5 py-[9px]">
                      <span className="w-[92px] flex-none pt-[10px] text-[13px] text-[#8C8A85] sm:w-[150px]">Compliance</span>
                      <button
                        type="button"
                        onClick={() => setEdit("compliance")}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[9px] border border-dashed border-[#D3CFC6] bg-transparent px-3 py-[9px] text-left text-[13.5px] text-[#8C8A85] hover:border-[#141414] hover:bg-white hover:text-[#141414]"
                      >
                        <span className="text-[12px] text-[#C4C0B8]" style={mono}>+</span>
                        Add a compliance requirement
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            const slots = TWIN_SLOTS.filter((s) => s.group === g.id);
            const filled = slots.filter(slotFilled).length;
            return (
              <div key={g.id} className="border-t border-[#EFECE5] pb-4 pt-[18px]">
                <div className="mb-2 flex items-baseline gap-[11px]">
                  <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>{g.title}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] text-[#A3A099]">{g.note}</span>
                  <span className="flex-none text-[11px] text-[#A3A099]" style={mono}>{filled} of {slots.length}</span>
                </div>
                <div className="flex flex-col">{slots.map(slotCell)}</div>
              </div>
            );
          })}

          {/* Round 8 (2 Aug 2026, Robert: "the AI Prompt should allow
              users to add sections and areas to the statement that don't
              exist in placeholder format"). This IS the placeholder: any
              sentence that lands nowhere else was already being kept
              verbatim (the receipts array, unchanged), but only surfaced
              in the side "See the requirement" sheet under "Your notes" —
              never as a real, always-visible line on the statement
              itself. It now renders here as its own group, same shape as
              every other one, present and dashed even at zero so it reads
              as an open door rather than something that only appears
              after the fact. Nothing new is invented: still the buyer's
              own words, still kept, still feeding the published document
              exactly as it already did. */}
          <div className="border-t border-[#EFECE5] pb-4 pt-[18px]">
            <div className="mb-2 flex items-baseline gap-[11px]">
              <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>Other requirements</span>
              <span className="min-w-0 flex-1 text-[12.5px] text-[#A3A099]">anything the statement above has no line for</span>
              <span className="flex-none text-[11px] text-[#A3A099]" style={mono}>{receipts.length ? `${receipts.length} kept` : "none yet"}</span>
            </div>
            <div className="flex flex-col">
              {receipts.length > 0 ? (
                receipts.map((r) => (
                  <div key={r.id} className="flex items-start gap-3.5 border-b border-dotted border-[#EFECE5] py-[9px]">
                    <span className="w-[92px] flex-none pt-[2px] text-[13px] text-[#8C8A85] sm:w-[150px]">Noted</span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="text-[16px] font-medium leading-[1.4]" style={{ textWrap: "pretty" }}>{r.text}</span>
                      <span className="text-[12px] italic text-[#A3A099]">kept verbatim</span>
                    </div>
                    <span style={{ ...mono, fontSize: "9.5px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", borderRadius: "4px", padding: "3px 5px", flex: "none", background: "#EAF6EE", color: "#256B3E" }}>
                      your words
                    </span>
                    <button
                      type="button"
                      onClick={() => { dropReceipt(r.id); say(`Cleared: “${r.text}”. It will not come back unless you say it yourself.`); }}
                      className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[9.5px] uppercase text-[#A3A099] hover:border-[#B4650B] hover:text-[#B4650B]"
                      style={{ ...mono, letterSpacing: "0.07em" }}
                    >
                      clear
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3.5 py-[9px]">
                  <span className="w-[92px] flex-none pt-[10px] text-[13px] text-[#8C8A85] sm:w-[150px]">Anything else</span>
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-dashed border-[#D3CFC6] bg-transparent px-3 py-[9px] text-left text-[13.5px] text-[#8C8A85]">
                    Say it in the prompt above. Anything that doesn&apos;t fit a line elsewhere is kept here, word for word.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Readiness: once weighted completeness passes the threshold,
              the action into the vendor list, inside the document. */}
          {readyToFit && (
            <div className="flex flex-wrap items-center gap-4 border-t border-[#EFECE5] pt-5">
              <div className="min-w-[240px] flex-1">
                <div className="text-[16px] font-semibold leading-[1.4]">Complete enough to be priced consistently.</div>
                <div className="mt-[3px] max-w-[38em] text-[13.5px] leading-[1.55] text-[#5F5D59]">
                  {created
                    ? "The gaps left are ones vendors and service providers can quote around."
                    : "The gaps left are ones vendors and service providers can quote around. Nothing has left this page."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCommand({ kind: "whoFits" })}
                className="flex-none cursor-pointer rounded-full border-0 bg-[#F5A21B] px-[21px] py-3 text-[15px] font-semibold text-[#141414] hover:bg-[#E5940F]"
              >
                Show the {fittingCount ?? ""} that fit
              </button>
            </div>
          )}
          </div>
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
            Back to the statement
          </button>
          {rankedFits.length === 0 ? (
            <div className="max-w-[36em] text-[16px] leading-[1.6] text-[#6E6C67]">
              The market has not scored yet: say what you are buying and where it runs, and the evaluated vendors and service providers rank against it here.
            </div>
          ) : (
            <>
              <h2 className="m-0 mb-2.5 max-w-[24em] text-[27px] font-semibold leading-[1.25]" style={{ letterSpacing: "-0.022em" }}>
                {rankedFits.length} of {fit?.total ?? rankedFits.length} fit the requirement as it stands.
              </h2>
              <p className="m-0 mb-2 max-w-[38em] text-[15.5px] leading-[1.6] text-[#5F5D59]">
                Scored against the statement, never against what anyone pays. Change anything in it and this list changes with it.
              </p>
              <p className="m-0 mb-6 max-w-[38em] text-[14px] leading-[1.6] text-[#8C8A85]">
                {cap(numWord(keptFits.length))} of {numWord(rankedFits.length)} kept for direct invites. Untick anyone you do not want to hear from
                {partnerDependent.length ? <>, or say <em>drop the ones that need a partner</em>.</> : "."}
              </p>
              {/* Fix, 10 Aug 2026 (Harry's E2E, Test 1.8): "Your named
                  checks" used to sit below the WHOLE list, so with 8+
                  vendors the badge's meaning was scrolled past long before
                  anyone read it -- same prominence problem as the empty-
                  state hint fixed this morning, copy existed but wasn't
                  where the eye was. Moved above the list, before the first
                  badge appears, and each badge now also carries the same
                  line as a hover title. */}
              {checksCount > 0 && fit?.checks && (
                <p className="m-0 mb-3 max-w-[38em] text-[13px] leading-relaxed text-[#8C8A85]">
                  Your named checks: {fit.checks.map((c) => c.label).join(", ")}. Each badge below counts the checks met with graded evidence out of {checksCount}.
                </p>
              )}
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
                              title={`Meets ${s.matched.length} of your ${checksCount} named checks, with graded evidence`}
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
                          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                            <a href={`/sase/vendors/${s.slug}/`} className="text-[13.5px]">Read the full record, with every source behind these grades</a>
                            {/* Fix, 10 Aug 2026 (Harry's E2E, Test 4.4): this
                                panel had no vendor-contact route at all --
                                the vendor's own page (one click further)
                                already carries this button, everywhere else
                                it's expected does too (compare, best/ranked
                                list); this was the one surface without it. */}
                            <a
                              href={s.marketplace_url ?? "https://netify.co.uk/marketplace/"}
                              target="_blank"
                              rel="noopener"
                              className="text-[13.5px]"
                            >
                              Contact {s.name} via Netify ↗
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
                  Publishing lists your project anonymously on the Netify opportunity board and notifies matched vendors. Only <a href="/sase/supplier-vetting-standard/" className="underline" target="_blank" rel="noreferrer">vetted</a> vendors and service providers can view the opportunity in full or respond. Everyone else, including search engines, sees only the anonymous notice and can register to become vetted first.
                </div>

                {/* Publish-mechanics diagram (Robert's ask, 10 Aug 2026): the
                    board/notify/vetted-view structure stated in prose above,
                    shown as a shape so it reads in one glance. Same colour
                    tokens as the rest of this panel; no new palette. */}
                <div className="my-4 max-w-[38em] rounded-md border border-[#EAE7E1] bg-[#F5F3EE] p-4 text-[12px] leading-snug">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="rounded-full border border-[#EAE7E1] bg-white px-3 py-1 font-semibold text-[#33302C]">Your project</div>
                    <div className="text-[#8C8A85]" style={mono}>publish ↓</div>
                    <div className="rounded-md border border-[#F5A21B] bg-[#FFF7E8] px-3 py-1.5 text-center">
                      <p className="m-0 font-semibold text-[#8A4D08]">Opportunity board</p>
                      <p className="m-0 text-[11px] text-[#6E6C67]">Anonymous notice: sector, size band. No name, no contact details.</p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-3 pt-1">
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-[#8C8A85]" style={mono}>↓ notified</div>
                        <div className="w-full rounded-md border border-[#EAE7E1] bg-white p-2 text-center">
                          <p className="m-0 font-semibold text-[#33302C]">Matched, vetted vendors</p>
                          <p className="m-0 mt-1 text-[11px] text-[#5F5D59]">See the opportunity in full. Can respond directly.</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-[#8C8A85]" style={mono}>↓ can find it</div>
                        <div className="w-full rounded-md border border-[#EAE7E1] bg-white p-2 text-center">
                          <p className="m-0 font-semibold text-[#33302C]">Everyone else</p>
                          <p className="m-0 mt-1 text-[11px] text-[#5F5D59]">Public web, search engines, unvetted vendors. Sees the notice only. Can register to become vetted.</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-[#8C8A85]" style={mono}>↓</div>
                    <div className="rounded-full border border-[#EAE7E1] bg-white px-3 py-1 text-center font-semibold text-[#33302C]">
                      You choose who gets your contact details, and when
                    </div>
                  </div>
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

      {/* Until the first real fact lands, the page's journey strip and
          capability block sit beneath the empty project; the working
          surface never carries them. */}
      {phase === "live" && !started && afterPrompt}

      {/* ── THE CONSTELLATION ── restored 1 Aug 2026. R1b (30 Jul,
          Robert's half-a-coke rule): distance is fit, and a ranked view
          is the half that generates at publish, so it renders here, at
          the bottom of the page, once the notice is live and not
          before. Nothing is hidden behind a padlock; it simply does not
          exist yet. */}
      <ConstellationScene
        market={market}
        fit={fit}
        published={published}
        buying={buying}
        added={added}
        namedSlugs={namedSlugs}
        started={started}
        fitSlugs={fitSlugs}
      />

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
              const pathHeld = editSlot.path
                ? standingAt(editSlot.path).map((f) => ({
                    key: f.id,
                    label: cap(factLabel(f)),
                    meta: f.provenance === "stated" ? (f.source === "answer" ? "you chose this" : f.quote ? `“${f.quote}”` : "your words") : f.reason ?? "netify guessed",
                    kind: f.provenance === "inferred" ? "drop" : "clear",
                    act: () => dropRow(f),
                  }))
                : [];
              const noteHeld = editSlot.notePrefix
                ? noted.filter((n) => n.id.startsWith(editSlot.notePrefix as string)).map((n) => ({
                    key: n.id,
                    label: n.label,
                    meta: "you chose this",
                    kind: "clear",
                    /* Round 8 fix: clear THIS note only, not every note the
                       slot holds — a multi-select slot (Support, Change
                       model, and so on) can hold several at once. */
                    act: () => { clearNote(n.id); say(`Cleared: ${n.label}. It is an open line in the statement again.`); },
                  }))
                : [];
              const held = pathHeld.length ? pathHeld : noteHeld;
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
            {/* Manual exact-number entry (Robert, 1 Aug 2026): the ranges
                below are a fast pick, not the only path. Count-type slots
                (Sites, People) get a real number field so a known figure
                never has to be approximated into a bucket. */}
            {(editSlot.path === "estate.sites" || editSlot.path === "estate.users") && (
              <form
                className="mb-2.5 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem("manualCount") as HTMLInputElement;
                  const n = Math.round(Number(input.value));
                  if (!Number.isFinite(n) || n <= 0) return;
                  landOption(editSlot, { label: n.toLocaleString("en-GB"), effect: "", land: fact(editSlot.path as AllowedPath, n) });
                }}
              >
                <input
                  key={editSlot.id}
                  name="manualCount"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="Type the exact number"
                  className="w-full rounded-[11px] border border-[#E3E0DA] bg-white px-[15px] py-[13px] text-[15.5px] outline-none focus:border-[#141414]"
                />
                <button
                  type="submit"
                  className="flex-none cursor-pointer rounded-[11px] border-0 bg-[#141414] px-[18px] py-[13px] text-[14px] font-semibold text-white hover:bg-[#2b2b2b]"
                >
                  Set
                </button>
              </form>
            )}
            <div className="flex flex-col gap-[7px]">
              {(() => {
                /* Round 7: a sector-shaped option (NHS DSPT, FCA) only
                   earns its place once the buyer's own standing sector
                   matches — the same influence-not-authority law the
                   sector packs keep. No sector stated yet, no sector-only
                   option shown; nothing invented ahead of the buyer's
                   own answer. */
                const sectorVal = String(standingAt("organisation.sector").slice(-1)[0]?.value ?? "");
                return editSlot.options.filter((o) => !o.sectorOnly || o.sectorOnly.test(sectorVal));
              })().map((o) => (
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
              Or close this and say it in your own words in the prompt above. These are only the answers heard most.
            </div>
          </div>
        </div>
      )}

      {/* ── THE SAVE SHEET (round 6) ── the opt-in early save: a
          verified work email creates the real project record from this
          statement, unpublished. Nothing is invited, nothing is listed,
          and the header link opens the record from then on. */}
      {saveOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center px-[26px] pb-[26px]"
          style={{ background: "rgba(20,20,20,.3)" }}
          onClick={() => setSaveOpen(false)}
        >
          <div
            className="w-full max-w-[560px] rounded-[18px] border border-[#DDD9D1] bg-white px-6 pb-5 pt-[22px]"
            style={{ boxShadow: "0 14px 44px rgba(20,20,20,.18)", maxHeight: "min(76vh, 640px)", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 text-[19px] font-semibold leading-[1.35]">Save this project</span>
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="flex-none cursor-pointer border-0 bg-transparent text-[13.5px] text-[#A3A099] hover:text-[#141414]"
              >
                Close
              </button>
            </div>
            {!signedIn || !sessId?.work ? (
              <div>
                <p className="m-0 mb-2 mt-[7px] max-w-[40em] text-[13.5px] leading-[1.55] text-[#6E6C67]">
                  Saving creates your private project record from this statement. It needs a verified work email; vendors and service
                  providers respond to verified work emails, so saving uses one too. Nothing is published and nobody is invited by saving.
                </p>
                {signedIn && sessId && !sessId.work && (
                  <p className="m-0 mb-2 text-[12.5px] leading-relaxed text-[#B4650B]">
                    Signed in as {sessId.email}, a personal address. Saving needs a work email; everything here stays as it is while you switch.
                  </p>
                )}
                <SignIn
                  role="buyer"
                  prompt="Verify your work email to save. Everything here stays on this page until you choose to publish."
                  onAuthed={() => {
                    setSignedIn(true);
                    fetch("/sase/api/auth/session")
                      .then((r) => r.json())
                      .then((d: { authenticated?: boolean; email?: string; work_address?: boolean; company_hint?: string | null }) => {
                        setSessId(d?.authenticated ? { email: d.email ?? "", work: Boolean(d.work_address), company: d.company_hint ?? null } : null);
                      })
                      .catch(() => {});
                  }}
                />
              </div>
            ) : (
              <div>
                <p className="m-0 mb-2 mt-[7px] max-w-[40em] text-[13.5px] leading-[1.55] text-[#6E6C67]">
                  Saving creates your private project record from this statement, owned by{" "}
                  <span className="font-medium text-[#33302C]">{sessId.email}</span>. It is not published, nobody is invited, and you can
                  open or continue it any time from the link in the header.
                </p>
                {securityScope && (
                  <label className="mb-2 flex items-start gap-2 text-[13px] leading-relaxed text-[#5F5D59]">
                    <input type="checkbox" checked={consentSave} onChange={(e) => setConsentSave(e.target.checked)} className="mt-0.5" />
                    <span>{CREATE_CONSENT_TEXT}</span>
                  </label>
                )}
                {saveError && <p className="m-0 mb-2 text-[12.5px] text-red-600">{saveError}</p>}
                <button
                  type="button"
                  onClick={() => void saveNow()}
                  disabled={saveBusy || (securityScope && !consentSave)}
                  className="cursor-pointer rounded-full border-0 bg-[#F5A21B] px-[20px] py-[11px] text-[14.5px] font-semibold text-[#141414] hover:bg-[#E5940F] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saveBusy ? "Saving…" : created ? "Save changes" : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
