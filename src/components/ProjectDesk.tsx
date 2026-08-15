"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { assessSecurityRequirement, type SecurityScopeVerdict, type SecurityRequirementInput } from "@/lib/security/rulebook";
import {
  deriveInstrumentLadder,
  deriveRfiQuestionSet,
  instrumentNotesLine,
  earnedInstrument,
} from "@/lib/workspace/instrument";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { ACCEPT_GAP_PREFIX } from "@/components/GapActions";
import {
  statedObjectivesIn,
  LIST_FACT_PATHS,
  WORKSPACE_SECTORS,
  notesWithSourceTurns,
  type AllowedPath,
  type BuyingId,
  type FieldUpdate,
  type FieldRemoval,
} from "@/lib/workspace/extract";
import type { SourceLedgerEntry, SourceLedgerVia } from "@/lib/workspace/source-ledger";
import type { RfpStatus } from "@/lib/rfp-types";
import { captureRawSourceEntry, hydrateSourceTurns, mergeSourceLedger, resumeStateFromProject } from "@/lib/workspace/source-ledger";
import { parseCommand, type Command } from "@/lib/workspace/commands";
import {
  briefModel,
  buyingOf,
  builderCompliance,
  factId,
  factLabel,
  mergeUpdates,
  meterOf,
  mergeRequirementBase,
  operatingModelOf,
  productScopeFor,
  requirementFrom,
  standing,
  usersBandLabel,
  wizardRegions,
  wizardSectorKey,
  COMPLIANCE_LABELS,
  regionStandalone,
  humaniseWorkspaceValue,
  dropListFact,
  resolveDropTarget,
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
import { hasPublished } from "@/lib/project-machine";
/** Living Procurement OS · Phase 3 Stage A (14 Aug 2026): wires the
 *  existing, pure `compileProcurementDocument()` compiler into this real
 *  production interface -- see LivingProcurementCanvas's own doc comment
 *  for the render-side half of this. Nothing here changes what the
 *  compiler does; this file only supplies its inputs from the desk's own
 *  already-standing state (facts/requirement/verdict/noted/rfiSet/
 *  instrument/receipts/sourceTurns -- all pre-existing) and renders its
 *  output. No second fact store: `compiledDocument` is derived, never
 *  independently mutated. */
import {
  compileProcurementDocument,
  factSnapshotOf,
  resolveGovernedRevision,
  INITIAL_GOVERNED_REVISION_STATE,
  type LivingProcurementDocument,
  type CompilerRevision,
  type GovernedEvent,
} from "@/lib/workspace/procurement-document";
import LivingProcurementCanvas, { type ProcurementView } from "@/components/procurement/LivingProcurementCanvas";
/** Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug 2026):
 *  the canonical NextQuestion projection and section-outline projection
 *  -- both pure, both layered over data this file already computes
 *  (earnedQuestions/visibleSuggestions/compiledDocument.openDecisions).
 *  See each module's own header comment for why they are separate files
 *  from the compiler rather than folded into it. */
import { rankNextQuestions, materialDecisionCount, type NextQuestion } from "@/lib/workspace/procurement-next-questions";
import { buildSectionOutline, type OutlineRow } from "@/lib/workspace/procurement-outline";

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
/** Living Procurement Canvas Phase 2 correction (14 Aug 2026): `GET
 *  /api/workspace/fit` now strips `suppliers`/`directory`/`count` from
 *  every response (see that route's own doc comment) -- vendor identity
 *  AND this project's own match count never reach the browser pre-
 *  publication. All three fields are therefore ALWAYS absent on this
 *  client type now (never populated, not merely optional-and-sometimes-
 *  present), so every reader must treat them as unavailable rather than
 *  fall back to an old cached shape. `total` stays: it is the whole
 *  evaluated market, never narrowed by this project's own scope. */
export type FitState = {
  mode: "graded" | "compiled"; total?: number; note?: string;
  checks?: Array<{ id: string; label: string }>;
};

/** `own` marks an answer the buyer typed: kept verbatim, theirs (1f). */
type NotedItem = { id: string; label: string; section: string; own?: boolean };
type Receipt = { id: number; text: string };
/** Reliability gate, third amendment (13 Aug 2026, Codex's third review,
 *  item 1): "persist every non-command buyer entry verbatim as an
 *  immutable source turn... preservation of buyer wording must not
 *  depend on successful semantic segmentation." A `Receipt` above is
 *  scoped, deliberately, to CLAUSES the extractor could not place --
 *  buyer content that still needs a human's review. A `SourceTurn` is
 *  broader and unconditional: the exact raw text of every non-command
 *  message the buyer typed, pasted or dropped, recorded the moment it
 *  arrives and never rewritten afterward, whether extraction later
 *  places every clause perfectly or none at all. Nothing here is ever
 *  edited or removed once added -- an immutable log, not a working
 *  list.
 *
 *  FOURTH amendment (13 Aug 2026): `id` is now a stable STRING, generated
 *  once at capture time (newSourceTurnId() below) and never regenerated --
 *  the third amendment's numeric ref-counter id reset to 0 on every page
 *  load, so it could never survive as a real merge key across separate
 *  saves. This shape is exactly source-ledger.ts's SourceLedgerEntry
 *  (that module is the canonical, persisted form; this is its client-side
 *  working copy) plus `via`, which the third amendment's version dropped
 *  on the floor even though every call site already knew it.
 *
 *  FIFTH amendment (13 Aug 2026): now a plain type alias, not a separate
 *  shape -- the two were already field-for-field identical, and
 *  hydrateSourceTurns() (the function that bridges them) has moved to
 *  source-ledger.ts for testability, so keeping a distinct local type here
 *  would just be a cast with extra steps. The `SourceTurn` name stays, for
 *  readability at this file's own call sites. */
type SourceTurn = SourceLedgerEntry;

/** Matches rfp-store.ts's server-side newId() exactly (time-based prefix +
 *  a few random base-36 characters) -- that helper lives in a Node-only
 *  module this client component cannot import, so it is duplicated here
 *  at the one call site that needs a client-generated stable id. */
function newSourceTurnId(): string {
  return `st_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* hydrateSourceTurns() -- the client-side half of "rehydrate the ledger
 * when an existing project is reopened" -- now lives in
 * workspace/source-ledger.ts (imported above), for the same reason
 * captureRawSourceEntry does: so a fixture can call the exact function this
 * component's arrival effect calls, against real persisted data, rather
 * than a hand-rolled stand-in that could silently drift from production.
 * See that module's doc comment for the fourth/fifth amendment history and
 * the "Minimal resume link" scope ruling (source_ledger only, not
 * facts/receipts/requirement). The one real entry point into this resume
 * path is the project dashboard's "Add more detail" link
 * (project/[id]/page.tsx). */

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
  "requirements.bespoke": "Additional requirements",
};

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
/** Sixth amendment (13 Aug 2026), Robert's item 3: shown while a resume
 *  fetch is in flight, so the composer visibly explains why it is
 *  temporarily disabled rather than just looking broken. */
const PLACEHOLDER_RESUMING = "Loading your saved project…";

/** The thread (round 6, Robert's ruling: the small persistent chat
 *  window stays). User messages echo verbatim; every Netify line is a
 *  TEMPLATE composed from the diff, never model prose, so the thread
 *  can only ever describe what actually landed in the statement. */
type ThreadMsg = { who: "you" | "netify"; text: string };
const THREAD_WELCOME =
  "Describe what you are buying, in your own words. Every sentence you write fills in the statement below, or answer any open line in it directly.";
/** Phase 3 Stage A correction round (Robert, 14 Aug 2026), defect #3
 *  reproduction: send()'s final branch below keeps the message as a
 *  receipt EVERY time it is reached (either per-unplaced-clause, or this
 *  constant's own whole-message fallback) -- and the deterministic
 *  compiler (buildCandidateClauses, procurement-templates.ts) reads
 *  those same receipts and, in the ordinary case, DOES derive a real
 *  testable requirement clause from them (a named template match, or the
 *  generic Additional-Requirement fallback for anything left over). The
 *  previous message here ("I did not catch anything new in that...")
 *  was therefore false whenever that happened -- most visibly for
 *  Prompt C's UK-residency sentence, which lands no structured FACT (no
 *  site count, no deadline) but plainly IS caught as a new, named,
 *  mandatory clause with its own gate and open decision. This message
 *  only ever claims what is unconditionally true: the words were kept,
 *  and where to look for the result -- never "nothing new," which
 *  requires knowing the compiler's own downstream template match and
 *  this callback cannot see that synchronously. */
const THREAD_KEPT_UNPLACED =
  "Kept in your own words -- see the statement below for how it landed. Try naming a number of sites, a deadline, what you run today, or who should operate it, or answer any open line in the statement.";

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

/** Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug 2026):
 *  a compiler open decision (procurement-readiness.ts's `buildOpenDecisions`)
 *  that already has a real, existing click-answer path -- an existing
 *  `TWIN_SLOTS` entry -- renders THAT slot's own options in its
 *  NextQuestion card rather than a fabricated new answer control. Only
 *  the two open decisions with an unambiguous 1:1 slot are mapped;
 *  conflict/ambiguity/legal-basis decisions (which need explanation, not
 *  a button) render with a link into the existing "Project details"
 *  sheet instead -- see ProcurementNextQuestions.tsx. */
const OPEN_DECISION_SLOT: Record<string, string> = {
  "OD-operating-model-unstated": "model",
  "OD-operating-model-conflict": "model",
  "OD-operating-model-ambiguous-correction": "model",
  "OD-timeline-unstated": "timeline",
};

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

/* Command and parseCommand() moved to @/lib/workspace/commands.ts (Phase 1
 * checkpoint correction, item 3, 13 Aug 2026) -- see that module's own
 * header comment for why (fixture testability) and for the multi-clause-
 * correction fix (isSingleCommandTarget()) it now carries. */

/* ================================================================== */
/* The component                                                       */
/* ================================================================== */

/** afterPrompt: the page slots the journey strip and the capability
 *  block beneath the twin; they render on the door only. */
export default function ProjectDesk({
  afterPrompt,
  /** Fourth amendment, item 4: seeds the source-turn log from an existing
   *  project's persisted `source_ledger` when a caller has one to offer.
   *  Still unused by both real callers -- the fifth amendment's "Minimal
   *  resume link" (see the arrival effect below, and
   *  workspace/source-ledger.ts's hydrateSourceTurns doc comment) hydrates
   *  via a URL-driven fetch and setSourceTurns() directly, not through this
   *  prop, since neither real caller has the project loaded ahead of time
   *  to pass one in. Kept as a lower-level seam for a future caller that
   *  DOES already have the data (e.g. a server-rendered resume page). */
  initialSourceLedger,
}: { afterPrompt?: ReactNode; initialSourceLedger?: SourceLedgerEntry[] }) {
  const [phase, setPhase] = useState<"live" | "fits">("live");
  const [market, setMarket] = useState<Market | null>(null);
  const [facts, setFacts] = useState<WorkspaceFact[]>([]);
  const [noted, setNoted] = useState<NotedItem[]>([]);
  /** Living Procurement UK Decision-Maker Blueprint: an earned question
   *  the buyer explicitly dismissed from the primary flow ("Not needed"/
   *  "Undecided") -- mirrors the pack law's "declining is permanent and
   *  stays on the record" for sector suggestions, applied to earned
   *  questions too, so a dismissed question does not reappear every
   *  render. In-memory only for this Stage checkpoint (not yet persisted
   *  to the saved project record) -- a deliberate, named scope decision,
   *  not a silent gap; see the checkpoint report's assumptions section. */
  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<string[]>([]);
  /** A sector suggestion the buyer explicitly declined -- permanent, per
   *  the pack law (sector/packs.ts's own header comment): "a declined
   *  suggestion never returns." */
  const [declinedSuggestionIds, setDeclinedSuggestionIds] = useState<string[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  /** The immutable source-turn log (see the SourceTurn type comment). */
  const [sourceTurns, setSourceTurns] = useState<SourceTurn[]>(() => hydrateSourceTurns(initialSourceLedger));
  /** Sixth amendment (13 Aug 2026), Robert's item 3: true from the instant
   *  the arrival effect decides a resume attempt is worth making, false
   *  once that attempt has either succeeded or visibly failed. Gates
   *  typing, Save and Publish (see send()/saveNow()/signAndPublish()'s own
   *  guards and signLocked below) so nothing can act on a half-loaded
   *  project. Stays false for the overwhelmingly common non-resumed
   *  session (nothing here ever runs). */
  const [resuming, setResuming] = useState(false);
  /** Sixth amendment, Robert's items 1/2: the resumed project's persisted
   *  `engine_data.requirement`, set ONCE (immutably) when a resume
   *  succeeds, never overwritten again. See draft.ts's
   *  mergeRequirementBase() for why this is kept separate from `facts`
   *  rather than converted into fabricated WorkspaceFacts, and how the two
   *  combine into the `requirement` this component actually sends. State
   *  (not a bare ref) so the requirement memo below re-derives the instant
   *  resume finishes, even if `facts` itself hasn't changed yet. */
  const [resumeRequirementBase, setResumeRequirementBase] = useState<SecurityRequirementInput | null>(null);
  const resumeRequirementBaseRef = useRef<SecurityRequirementInput | null>(null);
  useEffect(() => { resumeRequirementBaseRef.current = resumeRequirementBase; }, [resumeRequirementBase]);
  /** Seventh amendment (13 Aug 2026), Robert's finding on the sixth
   *  amendment above: unioning `resumeRequirementBase` against this
   *  session's own facts means a buyer can add a new list value but can
   *  never retract one the base already holds ("we no longer use MPLS"
   *  correctly avoided ADDING mpls as a false positive, but nothing ever
   *  told the merge to actually drop the base's own pre-existing mpls
   *  either). This is the set of `factId(path, value)` tombstones this
   *  session has explicitly retracted -- from a deterministic "no longer
   *  use X" style correction (see applyRemovals below) or the existing
   *  drop/remove command reaching a value that lives only in the resumed
   *  base, never in `facts` -- so mergeRequirementBase() can strip them
   *  out of the base before it unions in whatever this session adds. See
   *  that function's own doc comment for why the tombstone is applied to
   *  the BASE only, never to `addition`: a later restatement in the same
   *  sitting must still be able to bring a value back, the same
   *  resurrection rule a struck WorkspaceFact already follows. Empty for
   *  the overwhelmingly common non-resumed session (mergeRequirementBase
   *  ignores it entirely whenever there is no base to subtract from). */
  const [resumeRemovals, setResumeRemovals] = useState<Set<string>>(() => new Set());
  const resumeRemovalsRef = useRef<Set<string>>(new Set());
  useEffect(() => { resumeRemovalsRef.current = resumeRemovals; }, [resumeRemovals]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SecurityScopeVerdict | null>(null);
  const [fit, setFit] = useState<FitState | null>(null);
  const [added, setAdded] = useState<string[]>([]);
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
  /** Living Procurement Canvas Phase 2 correction (14 Aug 2026): carries
   *  exactly what the publish response itself returned -- real invited
   *  suppliers (name + credential link) -- so post-publish rendering below
   *  reads the frozen result, never a fresh `workspaceFit()` recompute
   *  (see the fits-panel replacement and the "Your matches" block for
   *  where this is consumed).
   *
   *  Round 4 correction (14 Aug 2026), Robert's findings 3-5: `matched`
   *  used to be `market_report.matched` (count/names/total). That figure
   *  comes from `matchSuppliers()`, a DIFFERENT, simpler ranking than the
   *  `buildShortlist()` call that actually selected `invited` above --
   *  they can genuinely diverge, so an invited vendor could silently be
   *  absent from the rendered "matched" list (proven live: Fortinet was
   *  invited but outside `matchSuppliers()`'s capped top-8 names).
   *  `matchedVendors` now carries the REAL matched set (the publish
   *  route's own `matched_vendors`, or on resume the report route's
   *  `matched_vendor_ids`/`matched_vendors`) -- the same source `invited`
   *  is drawn from. `totalEvaluatedMarket` is the aggregate figure alone
   *  (still fine from `market_report.matched.total_evaluated_market`,
   *  since that number names no vendor and isn't project-specific
   *  ranking). `frozen`/`namesFrozen` distinguish three real provenance
   *  states so the JSX below can word each honestly instead of always
   *  claiming "exactly as published": a live publish is always both
   *  (frozen=true, namesFrozen=true); a resumed already-published project
   *  with a snapshot written after this round's schema addition is also
   *  both true; an older snapshot has frozen=true but namesFrozen=false
   *  (names resolved from the live directory); a legacy published record
   *  with no snapshot at all has frozen=false (a fresh recompute). */
  const [published, setPublished] = useState<{
    invited: { slug: string; name: string; supplier_url: string }[];
    boardId?: string;
    matchedVendors: { slug: string; name: string }[];
    totalEvaluatedMarket: number;
    frozen: boolean;
    namesFrozen: boolean;
  } | null>(null);
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
  const sourceTurnsRef = useRef<SourceTurn[]>([]);
  /** Phase 3 Stage A: the last compiled document, used ONLY so the next
   *  compile can attribute a real added/updated/removed change set
   *  against it (`compileProcurementDocument`'s own `previousDocument`
   *  parameter) -- never read for anything else, and never itself the
   *  source of truth (that's still `facts`/`requirement`/etc. below).
   *  Updated in an effect AFTER the compile it came from has committed
   *  (see `compiledDocument` below), not mutated inside the memo itself,
   *  so a StrictMode double-invoke of the memo never sees a half-updated
   *  ref. */
  const previousProcurementDocumentRef = useRef<LivingProcurementDocument | null>(null);
  /** Phase 3 Stage A correction round (Robert, 14 Aug 2026): explicit
   *  governed-revision wiring, replacing the legacy fallback that bumped
   *  `compiledDocument.version` once per genuine facts-or-receipts diff.
   *  The bug that fix produced: ONE buyer submission (e.g. typing Prompt
   *  A) triggers SEVERAL distinct `applyMerge()`/`applyRemovals()` calls
   *  across a few React renders -- the main extraction's own merge, then
   *  the sector-pack effect's own follow-up merge (reacting to the
   *  just-changed facts), sometimes more -- each producing a genuinely
   *  different facts snapshot, so legacy-fallback mode bumped the version
   *  once per call instead of once per buyer action ("V4 after one
   *  prompt").
   *
   *  THE FIX. A short settle-debounce window, opened by the FIRST
   *  applyMerge()/applyRemovals() call since the last settle and extended
   *  by every subsequent one, closes after 400ms of quiet (comfortably
   *  longer than the synchronous sector-pack effect's own follow-up
   *  render and the async verdict-assessment microtask, both of which
   *  resolve far faster than that) and resolves EXACTLY ONE
   *  `resolveGovernedRevision()` event for the whole burst -- regardless
   *  of how many individual merge/removal calls happened inside it. Tab
   *  switches, renders, hydration and identical recompilation never call
   *  `beginOrExtendSubmission()` at all, so they can never open a window
   *  or consume a revision. `governedRevisionRef`/`submissionSeqRef`
   *  start at their module-level zero state on every fresh mount (a new
   *  project, or "Start again", both fully reload the page -- see the
   *  "Start again" button below), so a new project never inherits a
   *  revision count from a previous one. */
  const governedRevisionRef = useRef(INITIAL_GOVERNED_REVISION_STATE);
  const [currentRevision, setCurrentRevision] = useState<CompilerRevision | null>(null);
  const pendingSubmissionRef = useRef<{ eventId: string; factsBefore: Record<string, unknown> } | null>(null);
  const submissionSeqRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [procurementView, setProcurementView] = useState<ProcurementView>("document");
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
  useEffect(() => { sourceTurnsRef.current = sourceTurns; }, [sourceTurns]);

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

  /** Opens the settle window (capturing `factsBefore` from the CURRENT,
   *  pre-mutation `factsRef`) only if none is already open -- a second,
   *  third, ... call inside the same burst extends the window without
   *  overwriting the original `factsBefore`, so the eventual settle diffs
   *  the WHOLE burst against its true starting point, not just its last
   *  leg. Must be called BEFORE the caller mutates `factsRef.current`. */
  const beginOrExtendSubmission = useCallback(() => {
    if (!pendingSubmissionRef.current) {
      submissionSeqRef.current += 1;
      pendingSubmissionRef.current = { eventId: `submission:${submissionSeqRef.current}`, factsBefore: factSnapshotOf(factsRef.current) };
    }
  }, []);

  /** (Re)starts the 400ms quiet-period timer. When it finally fires with
   *  no further activity, the whole burst resolves as EXACTLY ONE
   *  governed event -- "one buyer submission equals one revision,
   *  regardless of how many React state updates it causes." 400ms
   *  comfortably covers the synchronous sector-pack follow-up effect and
   *  the async (but non-blocking, no real I/O) verdict-assessment
   *  microtask, both of which settle far faster in practice. */
  const scheduleSettle = useCallback(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      const pending = pendingSubmissionRef.current;
      pendingSubmissionRef.current = null;
      settleTimerRef.current = null;
      if (!pending) return;
      const event: GovernedEvent = {
        eventId: pending.eventId,
        kind: "prompt_cycle",
        seq: submissionSeqRef.current,
        factsBefore: pending.factsBefore,
        factsAfter: factSnapshotOf(factsRef.current),
      };
      const result = resolveGovernedRevision(governedRevisionRef.current, event);
      governedRevisionRef.current = result.state;
      if (result.applied) setCurrentRevision(result.revision);
    }, 400);
  }, []);

  const applyMerge = useCallback((updates: FieldUpdate[], source: "extract" | "answer" | "link") => {
    const allowed = updates.filter((u) => !(u.provenance === "inferred" && neverReinfer.current.has(nrKey(u.path, u.value))));
    beginOrExtendSubmission();
    cycleRef.current += 1;
    const m = mergeUpdates(factsRef.current, allowed, cycleRef.current, source);
    factsRef.current = m.facts;
    setFacts(m.facts);
    if (m.changed.length) setSaveDirty(true);
    scheduleSettle();
    return m;
  }, [beginOrExtendSubmission, scheduleSettle]);

  /** Seventh amendment (13 Aug 2026): the counterpart to applyMerge above,
   *  for explicit retractions rather than additions. Two effects, always
   *  both applied, because a retracted value can be live in either place
   *  (or both): (1) if THIS session's own ledger already carries a
   *  standing fact for the exact same path+value -- landed earlier this
   *  same sitting, resumed or not -- it is struck, precisely the way
   *  dropFact() already strikes a fact the buyer clicks "drop" on; (2) the
   *  value's factId is tombstoned into `resumeRemovals` regardless, which
   *  only ever has any effect when a resumed base is set (see
   *  mergeRequirementBase()'s doc comment) -- harmless, not a no-op check
   *  needed here, for the ordinary non-resumed session. Returns the
   *  labels actually struck/tombstoned so callers can tell the buyer what
   *  happened, the same honesty applyMerge's own caller already gives
   *  landed facts. */
  const applyRemovals = useCallback((removals: FieldRemoval[]): string[] => {
    if (!removals.length) return [];
    beginOrExtendSubmission();
    const labels: string[] = [];
    let struckAny = false;
    const ids = new Set(removals.map((r) => factId(r.path, r.value)));
    factsRef.current = factsRef.current.map((f) => {
      if (!f.struck && ids.has(f.id)) {
        struckAny = true;
        return { ...f, struck: true };
      }
      return f;
    });
    if (struckAny) setFacts(factsRef.current);
    setResumeRemovals((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    for (const r of removals) labels.push(humaniseWorkspaceValue(r.path, r.value).toLowerCase());
    setSaveDirty(true);
    scheduleSettle();
    return [...new Set(labels)];
  }, [beginOrExtendSubmission, scheduleSettle]);

  /* ---- Derivations off the ledger ---- */
  /** Sixth amendment: merges the resumed project's immutable requirement
   *  base (null for every non-resumed session) with whatever THIS
   *  session's own facts derive -- see mergeRequirementBase()'s doc
   *  comment in draft.ts. This is the ONE `requirement` value the verdict
   *  assessment, the brief, and every create/save/publish payload below
   *  all read (all already close over this same variable) -- so fixing it
   *  here, once, fixes every one of them together. Seventh amendment: now
   *  also carries `resumeRemovals`, the tombstones applyRemovals above
   *  maintains, so an explicit retraction actually leaves the base. */
  const requirement = useMemo(
    () => mergeRequirementBase(resumeRequirementBase, requirementFrom(facts), resumeRemovals),
    [facts, resumeRequirementBase, resumeRemovals],
  );
  const buying = buyingOf(facts);
  const opModel = operatingModelOf(facts);
  const securityScope = buying === "managed_security" || buying === null;
  const live = standing(facts);
  const started = facts.length > 0 || noted.length > 0;
  /** Phase 3 Stage A correction round (Robert, 14 Aug 2026), item 8: a
   *  small, undirected signal for the marketing hero (a SIBLING
   *  component under the same Server Component page, not a child of
   *  this one -- see CollapsibleHero.tsx's own doc comment) to compact
   *  itself once a project has genuinely started, without lifting
   *  `started` into the Server Component page or threading a prop across
   *  an unrelated boundary. Fires once, the first time `started` becomes
   *  true (never on the reverse transition -- `started` never reverts
   *  within a session; "Start again" fully reloads the page instead). */
  useEffect(() => {
    if (started) window.dispatchEvent(new Event("pd:project-started"));
  }, [started]);
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
       for what the link itself carries.

       Fifth amendment (13 Aug 2026), Robert's ruling on rehydration's
       scope: a Security Sourcing project reopened with its id on the URL
       restores its source ledger -- the SAME `?manage=` convention every
       other owner-gated link in this app already uses when a manage token
       is actually held (rfp-builder/{id}?manage=, and this component's
       own post-creation redirect to /project/{id}?manage=).

       Sixth amendment (13 Aug 2026), Robert's items 1, 2 and 4:
         1/2. Facts are not restored (there is nothing to restore them
              FROM, structurally -- see resumeStateFromProject()'s doc
              comment), but the project's persisted `engine_data.requirement`
              now is, as an immutable base every subsequent extraction,
              Save and Publish merges over (mergeRequirementBase(), the
              `requirement` memo above, and the extract-cycle POST body
              below all read it) -- so a resumed session's own new facts
              can never again silently replace the project's whole earlier
              scope.
         3. Resume is now GATED, not fire-and-forget: `resuming` is set
            true before this fetch starts and stays true (blocking typing,
            Save and Publish -- see signLocked, sendReady, send() and
            saveNow()'s own guards above) until this attempt has either
            succeeded or visibly failed (every exit path below either
            calls `say()` to explain what happened or leaves the success
            message from a completed resume) -- never silently, and never
            left permanently locked either (the `finally` always clears
            `resuming`, including on a thrown error).
         4. A manage token is no longer required to attempt resume: a
            signed-in owner's session travels automatically on this
            same-origin fetch (the server's requireRfpOwner() already
            accepts a session-authorised owner with no token at all, same
            as every other RFP route) -- ?manage= is now optional, present
            only for a token-carrying link (project/[id]/page.tsx's
            "Add more detail", when the visitor actually holds one).
         6. The source-ledger hydration below MERGES with whatever this
            session may have already captured locally during this fetch's
            own async gap (mergeSourceLedger, existing+incoming by stable
            id) instead of replacing it outright -- so a turn the buyer
            manages to type before this resolves is never discarded, even
            though `resuming` should already have prevented that turn from
            being typed at all. Belt and braces: two independent guards
            against the same race, not one relied on alone. */
    const resumeId = p.get("id");
    const resumeManage = p.get("manage");
    if (resumeId) {
      setResuming(true);
      void (async () => {
        try {
          const url = resumeManage
            ? `/sase/api/rfp/${encodeURIComponent(resumeId)}?manage=${encodeURIComponent(resumeManage)}`
            : `/sase/api/rfp/${encodeURIComponent(resumeId)}`;
          const res = await fetch(url);
          if (!res.ok) {
            say("That project link didn't load, so this is starting fresh instead.");
            return;
          }
          const proj = (await res.json()) as {
            engine?: string;
            test?: boolean;
            source_ledger?: SourceLedgerEntry[];
            engine_data?: { requirement?: unknown } | null;
            // Living Procurement Canvas Phase 2, round 3 correction (14 Aug
            // 2026), Robert's item 6: `status`/`invited_vendors` were
            // previously omitted from this type -- not because the route
            // doesn't return them (GET /api/rfp/[id] returns the full
            // owner-gated project), but because nothing here read them.
            // Resuming an ALREADY-PUBLISHED project therefore left
            // `published` at its initial `null` (it is only ever set by
            // signAndPublish()'s own response handler), so a returning
            // buyer saw the pre-publish locked outcome panel again instead
            // of their frozen matches -- not an identity leak (the fit API
            // redaction below is unconditional regardless of this gap),
            // but a real durability gap in "display the frozen matched and
            // invited suppliers from the published snapshot".
            status?: string;
            invited_vendors?: string[];
          };
          const resumeState = resumeStateFromProject(proj);
          if (!resumeState) {
            // Scoped to Security Sourcing this round (see
            // resumeStateFromProject()'s doc comment): a non-engine/wizard
            // project's Save path is the wizard PUT route, which this
            // resume flow does not yet drive, so resuming into one here
            // would silently misroute the next save.
            say("This project isn't a Security Sourcing engagement yet, so it can't be reopened here -- starting fresh instead.");
            return;
          }
          // Merge, not replace (item 6): preserves anything this session
          // already captured locally during the fetch's own async gap.
          setSourceTurns((current) => mergeSourceLedger(resumeState.sourceLedger, current));
          setResumeRequirementBase(resumeState.requirementBase);
          // Marks this session as "already saved" under this id/manage, so
          // saveNow()/signAndPublish() take the refreshRecord() (update)
          // path, not createRecord() (which would mint a second project) --
          // and records the scope this project was saved under, so an
          // unrelated later scope change is still detected correctly.
          setCreated({ id: resumeId, manage: resumeManage ?? "", test: Boolean(proj.test) });
          savedSecurity.current = true;
          /* Round 3 correction, item 6: rehydrate `published` durably for
           * an already-published project, from the SAME frozen sources the
           * report route and every export already read from -- never a
           * fresh recompute. The report route is an owner-gated GET route
           * already proven correct at this exact publish boundary
           * (report/route.ts's own doc comment). Best-effort throughout:
           * any failure leaves `published` at null (today's behaviour),
           * never blocking the resume itself.
           *
           * Round 4 correction (14 Aug 2026), Robert's findings 1, 2, 4, 5:
           *   1. Gated on `hasPublished()`, not `status === "published"` --
           *      that equality undercounted every project that has since
           *      moved into QA or evaluation (STATUS_FOR_PHASE maps every
           *      phase from "published" onward onto one of exactly those
           *      three legacy statuses).
           *   2/4/5. The report route now says, honestly, whether a real
           *      snapshot backs this read (`frozen`) and whether the
           *      vendor NAMES it returned are themselves frozen
           *      (`matched_vendors`/`invited_vendors` present) or resolved
           *      from the live directory as a fallback for an older
           *      snapshot (`matched_vendor_ids`/`invited_vendor_ids`
           *      only) -- three real provenance states, carried through to
           *      `published.frozen`/`namesFrozen` so the JSX renders each
           *      honestly instead of always claiming "exactly as
           *      published". `matched_vendor_ids` (the REAL buildShortlist()
           *      selection) replaces `market_report.matched.names` (a
           *      different, simpler matchSuppliers() ranking that could
           *      silently omit an invited vendor) as the source of the
           *      matched vendor SET; `market_report.matched` is now read
           *      only for its aggregate `total_evaluated_market` figure. */
          // Tracks whether `published` was ACTUALLY rehydrated below, not
          // merely whether the project's own status crossed publication --
          // the message that follows must never claim matches are showing
          // when the best-effort fetches beneath it came back empty.
          let rehydratedPublished = false;
          if (proj.status && hasPublished(proj.status as RfpStatus)) {
            try {
              const reportUrl = resumeManage
                ? `/sase/api/rfp/${encodeURIComponent(resumeId)}/report?manage=${encodeURIComponent(resumeManage)}`
                : `/sase/api/rfp/${encodeURIComponent(resumeId)}/report`;
              const reportRes = await fetch(reportUrl);
              const reportBody = reportRes.ok
                ? ((await reportRes.json()) as {
                    ok?: boolean;
                    frozen?: boolean;
                    market_report?: { matched?: { total_evaluated_market: number } };
                    matched_vendor_ids?: string[] | null;
                    invited_vendor_ids?: string[];
                    matched_vendors?: { slug: string; name: string }[] | null;
                    invited_vendors?: { slug: string; name: string; supplier_url: string }[] | null;
                  })
                : null;
              if (reportBody?.ok) {
                const frozen = reportBody.frozen === true;
                const totalEvaluatedMarket = Number(reportBody.market_report?.matched?.total_evaluated_market ?? 0);
                const namesFrozen = Boolean(reportBody.matched_vendors && reportBody.invited_vendors);
                let matchedVendors: { slug: string; name: string }[] = reportBody.matched_vendors ?? [];
                let invited: { slug: string; name: string; supplier_url: string }[] = reportBody.invited_vendors ?? [];
                if (!namesFrozen) {
                  const matchedIds = reportBody.matched_vendor_ids ?? [];
                  const invitedIds = reportBody.invited_vendor_ids ?? [];
                  if (matchedIds.length || invitedIds.length) {
                    let namesBySlug = new Map<string, string>();
                    try {
                      const mRes = await fetch("/sase/api/workspace/market");
                      const mBody = mRes.ok ? ((await mRes.json()) as { vendors?: Array<{ slug: string; name: string }> }) : null;
                      namesBySlug = new Map((mBody?.vendors ?? []).map((v) => [v.slug, v.name]));
                    } catch {
                      /* names degrade to the slug itself below; never blocks resume */
                    }
                    matchedVendors = matchedIds.map((slug) => ({ slug, name: namesBySlug.get(slug) ?? slug }));
                    invited = invitedIds.map((slug) => ({ slug, name: namesBySlug.get(slug) ?? slug, supplier_url: "" }));
                  }
                }
                // Only actually hydrate when there is something real to
                // show: a genuine snapshot (frozen), or at least a real
                // matched/invited id set to resolve (a legacy no-snapshot
                // record can still carry `project.invited_vendors`). A
                // record with truly nothing leaves `published` at null,
                // same as today.
                if (frozen || matchedVendors.length > 0 || invited.length > 0) {
                  setPublished({ invited, boardId: undefined, matchedVendors, totalEvaluatedMarket, frozen, namesFrozen });
                  // The post-publish matches section lives inside the same
                  // `phase === "fits"` block as the pre-publish locked
                  // panel (see that block's own doc comment); `phase`
                  // defaults to "live" and is otherwise only switched by
                  // the `whoFits` command, so without this a rehydrated
                  // `published` would sit correctly in state but never
                  // actually render until the buyer happened to trigger
                  // that command again.
                  setPhase("fits");
                  rehydratedPublished = true;
                }
              }
            } catch {
              /* a durability nicety, never a reason to fail the resume itself */
            }
          }
          say(
            rehydratedPublished
              ? "Reopened your published project. Your matched and invited vendors and service providers are below."
              : "Reopened your saved project. Everything you had is still here -- add more, or save or publish when ready.",
          );
        } catch {
          say("That project link didn't load, so this is starting fresh instead.");
        } finally {
          setResuming(false);
        }
      })();
    }
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
  /** Living Procurement UK Decision-Maker Blueprint: the LIVE (render-
   *  time) visible-suggestion list, distinct from the auto-assert
   *  effect's own one-shot `sugs` snapshot below (which only ever fires
   *  once per newly-active pack, to write compliance-only suggestions in
   *  as inferred rules). This memo re-derives on every relevant state
   *  change so the primary-flow suggestion cards (NextQuestion
   *  projection) and the section outline always show the CURRENT visible
   *  set, honouring an explicit decline the instant it happens. */
  const visibleSectorSuggestions = useMemo(
    () => (pack ? visibleSuggestions(pack, packFlavours, facts, noted.map((n) => n.id), declinedSuggestionIds) : []),
    [pack, packFlavours, facts, noted, declinedSuggestionIds],
  );
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

  /* ---- The market card: derived, never decorative.
     Living Procurement Canvas Phase 2 correction (14 Aug 2026): `fit` no
     longer ever carries `suppliers`/`directory` (the API redacts them --
     see the fit route's own doc comment), so nothing here derives a
     per-vendor identity, ranking or evidence badge from it any more.
     `marketTotal` is the whole evaluated market (`fit.total`, dataset-
     wide, never narrowed by this project's own match) -- the one figure
     the product rule says is safe to show pre-publish.
     A second pass on this same round's fixtures (below) caught a sibling
     leak the first pass missed: this file used to also derive
     `fittingCount` from `fit.count` -- the server-computed COUNT of
     vendors that match THIS project's scope -- and render it in the
     "understanding band" ("{fittingCount} of {marketTotal} still fit"),
     unconditionally, in every phase, not just the retired ranked panel.
     A project-specific match COUNT is exactly what the product rule
     prohibits pre-publish ("...rankings, match counts, positions...."),
     independent of whether any vendor NAME is attached to it, so
     `fittingCount` is retired outright, not merely hidden; the band below
     now shows only `marketTotal`.
     `pins` -- the vendors persisted onto the draft as buyer-selected
     input -- comes ONLY from `added` (vendors the buyer arrived with via
     a `?vendors=` link, e.g. from an earlier public shortlist selection,
     genuinely the buyer's own prior intent) and NEVER folds in survivors
     of Netify's own computed ranking, which is exactly the "invitation
     selections" the product rule says must not be exposed or persisted
     before publication. `keptFits`/`fitSlugs`/`partnerDependent` are
     retired along with the ranked panel they existed to serve; see the
     locked pre-publish outcome panel and the command handlers below for
     the corresponding removal. */
  const marketTotal = fit?.total ?? market?.counts.vendors ?? null;
  const pins = [...new Set(added)].slice(0, 5);

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
    resuming || !started || facts.length === 0 || Boolean(published) || !coreFiveComplete || (securityScope && (!verdict || verdict.confidence === "low")) || (!securityScope && !buying);
  const lockLine = resuming
    ? "Loading your saved project…"
    : !started
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

  /** Phase 3 Stage A correction round (Robert, 14 Aug 2026): the single
   *  compiled object every projection below (Living document / Supplier
   *  pack / Evaluation) reads -- REAL compiler output over this session's
   *  own live state, never mockup content. `revision: currentRevision`
   *  wires the EXPLICIT `resolveGovernedRevision()` event contract
   *  (`beginOrExtendSubmission()`/`scheduleSettle()` above), replacing
   *  Stage A's original legacy-fallback mode: `compileProcurementDocument`
   *  now bumps `version` exactly once per settled `currentRevision.cycle`
   *  change, not once per intermediate facts-or-receipts diff -- see
   *  `resolveVersion()`'s own `revision !== undefined` branch
   *  (procurement-document.ts). A render, a tab switch, hydration or an
   *  identical recompile never changes `currentRevision` at all (nothing
   *  here calls `setCurrentRevision` outside `scheduleSettle()`'s own
   *  settle callback), so none of them can consume a revision. */
  const compiledDocument = useMemo<LivingProcurementDocument>(
    () =>
      compileProcurementDocument({
        facts,
        requirement,
        verdict,
        noted,
        rfiSet,
        instrument,
        receipts,
        sourceTurns,
        previousDocument: previousProcurementDocumentRef.current,
        revision: currentRevision,
      }),
    [facts, requirement, verdict, noted, rfiSet, instrument, receipts, sourceTurns, currentRevision],
  );
  /** Freezes `previousProcurementDocumentRef` until a NAMED revision
   *  actually lands (Robert: "the change ribbon compares complete
   *  buyer-event snapshots, not intermediate renders"). Without this
   *  guard, this effect would run after EVERY compile -- including the
   *  intermediate, still-settling renders inside an open submission
   *  window -- so the next real revision's own change-ribbon diff would
   *  compare against the LAST INTERMEDIATE render rather than the last
   *  NAMED version. Content still updates live during settling (the
   *  document itself is always the freshest compile); only the
   *  change-ribbon's own comparison baseline holds until a cycle change
   *  actually lands. */
  useEffect(() => {
    const prevCycle = previousProcurementDocumentRef.current?.lastRevision?.cycle ?? null;
    const thisCycle = compiledDocument.lastRevision?.cycle ?? null;
    /* Correction (14 Aug 2026, found via the real-UI Playwright fixture
       added for defect #1): the ref must stay null -- never freeze on the
       phantom pre-event compile that runs on mount before any buyer
       action (facts=[], revision=null, lastRevision=null). That compile
       is legitimately version 1 (resolveVersion's `!previousDocument`
       branch), but freezing it as a "previousDocument" baseline meant the
       FIRST REAL governed event (Prompt A's own cycle 1) then saw a
       non-null previousDocument whose own version was already 1, so
       resolveVersion's `revision !== undefined` branch computed
       version+1 = 2 for Prompt A -- violating "Prompt A -> V1, B -> V2,
       C -> V3." Only freeze once a REAL cycle (thisCycle !== null) has
       landed and differs from whatever was last frozen; before that, the
       ref stays null, so every compile prior to the first real event
       keeps taking the `!previousDocument` branch and correctly stays at
       version 1 until an actual buyer submission consumes it. */
    if (thisCycle !== null && thisCycle !== prevCycle) {
      previousProcurementDocumentRef.current = compiledDocument;
    }
  }, [compiledDocument]);

  /* ---- Corrections: the drop that never returns ---- */
  /** Round 9 (13 Aug 2026), Robert's third finding on the seventh
   *  amendment: dropping a fact used to strike it (dropListFact below)
   *  but never tombstone it, so a value that existed in BOTH this
   *  session's own facts AND a resumed project's persisted base came
   *  straight back on the next save -- the live copy stayed struck, but
   *  mergeRequirementBase() never learned the base's own copy should be
   *  stripped too. dropFact now runs the SAME pure strike-and-tombstone
   *  primitive (draft.ts's dropListFact) every removal surface uses --
   *  the row button (via dropRow below), the typed drop/remove command
   *  (via resolveDropTarget's "fact" match, handleCommand below) and any
   *  fixture proving either -- so all three are provably one code path,
   *  not three copies that happen to agree today. */
  const dropFact = useCallback((id: string) => {
    const f = factsRef.current.find((x) => x.id === id);
    if (!f || f.struck) return;
    if (f.provenance === "inferred") neverReinfer.current.add(nrKey(f.path, f.value));
    const result = dropListFact(factsRef.current, resumeRemovalsRef.current, f);
    factsRef.current = result.facts;
    setFacts(factsRef.current);
    setResumeRemovals(result.removals);
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

  /** Reliability gate, third amendment (13 Aug 2026), item 1: appends one
   *  immutable source turn. Called for every non-command entry BEFORE
   *  extraction runs, so preservation of the buyer's own wording never
   *  depends on what the extractor later manages to place -- unlike
   *  `keepReceipt`, this always fires, whether the message lands every
   *  clause cleanly or none at all. Never edited or removed afterward.
   *  FOURTH amendment: takes `via` now (typed/paste/drop), and the id is
   *  generated once here with newSourceTurnId() -- stable across every
   *  later save of this same turn, unlike the third amendment's numeric
   *  ref counter (see the SourceTurn type comment). */
  const keepSourceTurn = useCallback((text: string, via: SourceLedgerVia) => {
    setSourceTurns((ts) => [...ts, { id: newSourceTurnId(), text, at: Date.now(), via }]);
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
        /** Stage checkpoint fix (Living Procurement UK Decision-Maker
         *  Blueprint, 15 Aug 2026): a note-only landed option previously
         *  never called `beginOrExtendSubmission()`/`scheduleSettle()`,
         *  so `currentRevision` never changed and `document.version`
         *  stayed frozen for a note-only buyer answer -- silently
         *  violating "one buyer submission must produce one governed
         *  document revision" for every note-kind TwinOption (Resilience,
         *  Term, Support, ...), not just the new NextQuestion cards.
         *  `factsBefore === factsAfter` here (no fact changed), which
         *  `resolveGovernedRevision()`'s own contract already treats as a
         *  legitimate, honestly-empty `changedFactIds` -- see that
         *  function's doc comment (procurement-document.ts). */
        beginOrExtendSubmission();
        setNoted((ns) => (ns.some((n) => n.id === l.id) ? ns : [...ns, { id: l.id, label: l.text, section: l.section, own: true }]));
        setChangedSlots([slot.id]);
        setSaveDirty(true);
        scheduleSettle();
        ev("workspace_earned_answered", { q: l.id, kind: "note" });
      }
      say(`${slot.label} set to “${opt.label}”.`);
      setEdit(null);
    },
    [applyMerge, markChanged, say, beginOrExtendSubmission, scheduleSettle],
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
        // Stage checkpoint fix (see landOption's identical comment above):
        // a note-only chip (no factLands) must still open/settle a
        // governed-revision submission itself; a chip WITH factLands is
        // already governed by the applyMerge() call above, so this only
        // needs to fire for the pure-note case.
        if (!factLands.length) beginOrExtendSubmission();
        for (const l of noteLands) {
          setNoted((ns) => (ns.some((n) => n.id === l.id) ? ns : [...ns, { id: l.id, label: l.text, section: l.section, own: true }]));
          ev("workspace_earned_answered", { q: l.id, kind: "note" });
        }
        if (!factLands.length) setChangedSlots(["people"]);
        setSaveDirty(true);
        if (!factLands.length) scheduleSettle();
        if (!landedSlots.includes("People")) landedSlots.push("People");
      }
      const sectorLand = factLands.find((l) => l.path === "organisation.sector");
      say(
        sectorLand
          ? `Sector set to “${String(sectorLand.value)}”.`
          : `${listJoin(landedSlots)} written from “${chip.label}”.`,
      );
    },
    [applyMerge, markChanged, say, beginOrExtendSubmission, scheduleSettle],
  );

  /** Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug
   *  2026): answers a `NextQuestion` (an earned question or a sector
   *  suggestion; compiler open decisions with an existing TWIN_SLOTS
   *  answer path render that slot's own options instead and land through
   *  `landOption` unchanged -- see `OPEN_DECISION_SLOT` and the render
   *  side in LivingProcurementCanvas/ProcurementNextQuestions).
   *
   *  Every branch below lands through the SAME `applyMerge`/`setNoted`
   *  machinery `landOption`/`pickChip` already use, tagged `source:
   *  "answer"` and quoted with the OPTION'S OWN LABEL -- never the
   *  underlying question text -- and NEVER calls `keepSourceTurn()`.
   *  That is what makes this compliant with the blueprint's two hardest
   *  rules at once: "Do not insert Netify-authored question text into
   *  the buyer's source ledger. Only the buyer's answer may become buyer
   *  wording" and "Question selection is UI context, not a source turn."
   *  A "dismiss" answer never writes anything; it only remembers the
   *  dismissal so the question does not reappear (earned questions) or
   *  is permanently declined (sector suggestions, per the pack law). */
  const answerNextQuestion = useCallback(
    (nq: NextQuestion, optionIndex: number) => {
      const opt = nq.options?.[optionIndex];
      if (!opt) return;
      const answer = opt.answer;
      if (answer.kind === "dismiss") {
        if (nq.source === "sector_suggestion") {
          const suggestionId = nq.id.replace(/^sector:/, "");
          setDeclinedSuggestionIds((ids) => (ids.includes(suggestionId) ? ids : [...ids, suggestionId]));
          ev("workspace_pack_suggestion", { id: suggestionId, verdict: "declined" });
        } else {
          setDismissedQuestionIds((ids) => (ids.includes(nq.id) ? ids : [...ids, nq.id]));
          ev("workspace_earned_answered", { q: nq.id, kind: "dismiss" });
        }
        say(`Noted: "${nq.question}" set aside for now.`);
        return;
      }
      if (answer.kind === "items") {
        const updates: FieldUpdate[] = [];
        for (const itemId of answer.itemIds) {
          const e = ITEM_BY_ID[itemId];
          if (!e) continue;
          updates.push({ path: e.item.path as AllowedPath, value: e.item.value, provenance: "stated", quote: opt.label });
        }
        if (updates.length) {
          const m = applyMerge(updates, "answer");
          markChanged(m.changed.length ? m.changed : updates.map((u) => factId(u.path, u.value)), m.facts);
        }
        ev("workspace_earned_answered", { q: nq.id, kind: "items" });
      } else if (answer.kind === "note") {
        const noteId = nq.source === "sector_suggestion" ? `ps-${nq.id.replace(/^sector:/, "")}` : `${nq.id}:${optionIndex}`;
        beginOrExtendSubmission();
        setNoted((ns) => (ns.some((n) => n.id === noteId) ? ns : [...ns, { id: noteId, label: answer.text, section: nq.target, own: true }]));
        setChangedSlots([noteId]);
        setSaveDirty(true);
        scheduleSettle();
        ev("workspace_earned_answered", { q: nq.id, kind: "note" });
      } else if (answer.kind === "path") {
        // Free-text answers (root sector/scope, contract end) open the
        // existing edit sheet for the matching slot rather than a new
        // inline control -- reusing the established, already-fixtured
        // typed-answer path instead of inventing a parallel one.
        const sid = SLOT_BY_PATH[answer.path];
        if (sid) setEdit(sid);
        return;
      }
      say(`${nq.question} — "${opt.label}".`);
    },
    [applyMerge, markChanged, say, beginOrExtendSubmission, scheduleSettle],
  );

  /* ---- The extraction cycle (the same organ). Round 6: the cycle
     reports which slots it changed so the thread can say exactly that,
     a template line composed from the diff and nothing else. ---- */
  type CycleResult = { landed: number; labels: string[]; rules: number; error: boolean; unplaced: string[]; removed: string[] };
  const runCycle = useCallback(
    async (text: string): Promise<CycleResult> => {
      const trimmed = text.trim();
      if (trimmed.length < 3 || busy) return { landed: 0, labels: [], rules: 0, error: false, unplaced: [], removed: [] };
      if (looksLikeAnotherNetify(trimmed)) setWrongCompany(true);
      setBusy(true);
      setCycleError(null);
      try {
        const res = await fetch("/sase/api/workspace/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Sixth amendment: the model's own extraction context must see
          // the full picture too (item 1's "every subsequent extraction ...
          // starts from the project's existing engine_data.requirement"),
          // not just this resumed session's own facts so far -- same merge
          // the `requirement` memo above applies, via the ref so this
          // callback never closes over a stale value. Seventh amendment:
          // also carries resumeRemovalsRef so the model's own context
          // never sees a value this session has already retracted.
          body: JSON.stringify({
            text: trimmed,
            requirement: mergeRequirementBase(resumeRequirementBaseRef.current, requirementFrom(factsRef.current), resumeRemovalsRef.current),
          }),
        });
        if (!res.ok) throw new Error(`extract ${res.status}`);
        const data = (await res.json()) as { updates: FieldUpdate[]; engine: string; notes: string[]; unplacedClauses?: string[]; removals?: FieldRemoval[] };
        const merged = applyMerge(data.updates ?? [], "extract");
        /* Seventh amendment: applied AFTER the positive merge above, so a
           value this SAME message both states and retracts (a genuine
           contradiction, not the expected case) resolves as "retracted" --
           the more consequential of the two actions wins. In the ordinary
           case the two never overlap: the extractor's own negation window
           already keeps a negated mention from producing a positive
           update in the first place (see removalsIn()'s own comment in
           extract.ts), so `data.updates` and `data.removals` never name
           the same path+value together in practice. */
        const removedLabels = applyRemovals(data.removals ?? []);

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
        return { landed: merged.changed.length, labels, rules, error: false, unplaced: data.unplacedClauses ?? [], removed: removedLabels };
      } catch {
        setCycleError("The engine did not answer; your words are unchanged, say it again in a moment.");
        return { landed: 0, labels: [], rules: 0, error: true, unplaced: [], removed: [] };
      } finally {
        setBusy(false);
      }
    },
    [busy, applyMerge, applyRemovals, markChanged, say],
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
      /* Fourth amendment (13 Aug 2026), gap 1: the third amendment kept
         one source turn PER CHUNK -- so anything chunkForIngest's own
         honest, disclosed extraction budget (maxChunks * chunkMax, ~10,500
         characters) truncated for READING was, by construction, also
         missing from the ledger, even though the ledger's entire purpose
         is to survive independent of extraction. Fixed: the buyer's
         COMPLETE original entry is kept as ONE turn here, before any
         chunking, any extraction, and regardless of plan.truncated.

         Fifth amendment (13 Aug 2026), gap 1 continued: that fix still
         applied chunkForIngest's OWN normalisation (CRLF -> LF, outer
         trim) to the ledger's copy too -- silently rewriting line endings
         and dropping leading/trailing content the buyer actually typed.
         captureRawSourceEntry() (workspace/source-ledger.ts) is now the
         ONLY operation between the raw paste/drop string and what the
         ledger keeps: identity on the content, no trim, no CRLF rewrite.
         chunkForIngest(raw) below still receives the SAME untouched raw
         string and normalises its own internal copy exactly as before --
         the two copies are independent from here on. */
      keepSourceTurn(captureRawSourceEntry(raw), source);
      for (const chunk of plan.chunks) {
        // Sequential on purpose: each cycle merges before the next reads.
        const r = await runCycle(chunk);
        /* Reliability gate amendment (13 Aug 2026), blocker 2 (Codex's
           review): send() already keeps every unplaced clause as a
           receipt (see that function's own comment above); the paste/drop
           path called runCycle() per chunk but threw its result away, so
           a clause the extractor couldn't place in a PASTED chunk still
           vanished silently, even though the identical clause typed by
           hand would have survived. Same fix, same place in the flow: */
        for (const clause of r.unplaced) keepReceipt(clause);
      }
      const landed = Math.max(0, factsRef.current.filter((f) => !f.struck).length - factsBefore);
      const kept = Math.max(0, receiptsRef.current.length - receiptsBefore);
      setPasteSummary(ingestSummary(landed, kept, plan));
    },
    [runCycle, keepReceipt, keepSourceTurn],
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
    // Sixth amendment, item 3: blocks typing from acting while a resume
    // fetch is still in flight (the composer is also disabled/hidden
    // behind `resuming` in the JSX below; this is the same guard's
    // non-UI half, since Enter-to-send calls send() directly and does not
    // go through the button's `disabled` attribute at all).
    if (!text || busy || resuming) return;
    setDraft("");
    if (!firstKeyAt.current) firstKeyAt.current = Date.now();
    sayYou(text);

    const cmd = parseCommand(text);
    if (cmd) {
      handleCommand(cmd);
      return;
    }

    /* Reliability gate, third amendment (13 Aug 2026), item 1: a
       recognised command is an instruction, not buyer content, so it is
       never kept as a source turn (the early return above already skips
       this line for one). Everything else -- kept the moment it's known
       not to be a command, before extraction runs -- is preserved
       verbatim regardless of what runCycle() below manages to place. */
    keepSourceTurn(text, "typed");

    const r = await runCycle(text);
    if (r.error) return; /* the caption carries the engine error; the words stay in the prompt's history */

    /* Fact Ledger Reliability Gate (13 Aug 2026): keep EVERY clause the
       extractor could not place, even when OTHER clauses in the same
       message landed real facts. This is the actual bug: before this,
       a receipt was only ever kept when the WHOLE message landed
       nothing (see the old fallback this replaces, below) -- a message
       that landed four facts and missed a fifth sentence returned early
       right here and that fifth sentence's words were never kept
       anywhere. Runs before the landed/not-landed branch so both paths
       below share it, once. */
    for (const clause of r.unplaced) keepReceipt(clause);

    /* Seventh amendment: a retraction alone (e.g. "We no longer use
       MPLS.", nothing else in the same message) must not fall through to
       the "nothing landed" branch below and say THREAD_KEPT_UNPLACED --
       that would misreport a real change to the statement as merely
       kept, unplaced. Checked alongside r.landed so both a positive
       landing and a retraction, together or separately, take this
       branch. */
    if (r.landed > 0 || r.removed.length > 0) {
      const parts: string[] = [];
      if (r.labels.length) parts.push(`Written in: ${r.labels.join(", ")}.`);
      if (r.rules > 0) parts.push(`${cap(numWord(r.rules))} rule${r.rules === 1 ? "" : "s"} landed in the statement with your words as provenance.`);
      if (r.removed.length) parts.push(`Removed from the statement: ${r.removed.join(", ")}.`);
      if (r.unplaced.length) parts.push(`${cap(numWord(r.unplaced.length))} other line${r.unplaced.length === 1 ? "" : "s"} kept with your notes, unplaced.`);
      const miss = missingNow();
      parts.push(miss.length ? `Most useful next: ${miss.slice(0, 2).join(" and ")}.` : "Everything the statement tracks is in.");
      say(parts.join(" "));
      return;
    }

    /* Nothing landed as a structured fact. If the extractor split the
       message into clauses and kept some individually above, don't ALSO
       keep the whole message as a second, overlapping receipt -- only
       fall back to the old whole-message receipt when there was no
       clause structure to keep in the first place (e.g. a short aside,
       or a glossary question, which never reaches coverDeclarativeClauses
       at all). Either way, said once in the thread. */
    if (!r.unplaced.length) keepReceipt(text);
    say(THREAD_KEPT_UNPLACED);
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
        // Living Procurement Canvas Phase 2 correction (14 Aug 2026): this
        // command used to drop ranked-list rows whose evidence graded as
        // partner/integrated -- it operated entirely on the pre-publish
        // ranked fit list, which no longer exists as identifying data in
        // this component (see the fit route's own doc comment). There is
        // no per-vendor detail to act on before publication, so this is
        // now an honest refusal rather than a silent no-op that would
        // otherwise misleadingly read as "nobody relies on a partner."
        say("Which vendors and service providers are matched, and how each is evidenced, is part of what publishing unlocks. Publish first, then this becomes something to act on.");
        return;
      }
      case "dropName":
      case "keepName": {
        /* Round 8 (2 Aug 2026, Robert: "if someone types... remove this...
           it should work"): "drop X"/"remove X" now reaches anything on
           the statement, not just a vendor or a guess — a stated fact, a
           noted multi-select item (Support, Change model, and so on), a
           kept-verbatim note, or a value that lives only in a resumed
           project's persisted base — matched the same way a vendor name
           is: against the words the page itself shows, either direction.
           Round 9 (13 Aug 2026), item 6: the matching itself now runs
           through draft.ts's resolveDropTarget(), the SAME pure function
           a fixture can call directly with synthetic data, so this
           handler and any test of it are provably exercising identical
           matching logic rather than two copies that merely look alike.
           Each removal still fires the exact same function its own row's
           own button calls (dropRow -> dropFact -> dropListFact, item 4/5
           above), so the thread reads exactly as if the buyer had
           clicked it, with the correct "dropped"/"cleared" wording for
           whether it was netify's guess or the buyer's own stated word. */
        if (cmd.kind === "dropName") {
          const match = resolveDropTarget(cmd.name, {
            liveFacts: factsRef.current.filter((x) => !x.struck),
            noted,
            receipts,
            resumeRequirementBase,
            resumeRemovals: resumeRemovalsRef.current,
          });
          if (match) {
            switch (match.kind) {
              case "fact":
                dropRow(match.fact);
                return;
              case "note":
                clearNote(match.id);
                say(`Cleared: ${match.label}. It is an open line in the statement again.`);
                return;
              case "receipt":
                dropReceipt(match.id);
                say(`Cleared: “${match.text}”. It will not come back unless you say it yourself.`);
                return;
              case "resumeBase":
                applyRemovals([{ path: match.path, value: match.value, quote: match.display }]);
                say(`Cleared: ${match.display}. It will not come back unless you say it yourself.`);
                return;
            }
          }
        }
        say(`I could not find “${cmd.name}” in the list or among the guesses. Say the name as the page shows it.`);
        return;
      }
      case "why": {
        // Living Procurement Canvas Phase 2 correction (14 Aug 2026): "why
        // <vendor>" used to open a ranked-list row's evidence working --
        // that per-vendor detail is exactly what the product rule reserves
        // for after publication (see the fit route's own doc comment and
        // the locked outcome panel below). No pre-publish path can answer
        // this any more; an honest refusal replaces the old lookup.
        ev("workspace_command", { kind: "why_vendor" });
        say(`Why a specific vendor or service provider matched, with evidence and dates, is part of what publishing unlocks — “${cap(cmd.name)}” included, if they are among the matches. Publish to see the working.`);
        return;
      }
    }
  }

  /** Fourth amendment (13 Aug 2026), gaps 2 & 3: the ONE shape every
   *  save/create/re-scope call sends the source ledger in, on the wire --
   *  used by rfpPayload() below AND by createRecord/refreshRecord's
   *  security-scope branches, which (unlike the wizard path) don't share
   *  one payload builder. Sending the SAME entries (same stable ids) on
   *  every call is exactly what makes the server's mergeSourceLedger()
   *  idempotent: a repeated save changes nothing, a save with new turns
   *  appends only the new ones. */
  function sourceTurnsPayload(): Array<{ id: string; text: string; at: number; via: SourceLedgerVia }> {
    return sourceTurns.map((t) => ({ id: t.id, text: t.text, at: t.at, via: t.via }));
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
      /* Reliability gate, third amendment (13 Aug 2026), item 6: the full
         immutable source-turn log (see the SourceTurn type comment)
         flows into the persisted record here -- not merely the
         transient chat thread -- so every original requirement stays
         available in the saved/published output even for a turn the
         extractor placed perfectly, not only the ones flagged above as
         still needing review. */
      notesWithSourceTurns("", sourceTurns.map((t) => t.text)),
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
      /* Fourth amendment, gaps 2 & 3: the structured ledger, alongside the
         flattened `notes` projection above -- the server merges this into
         `source_ledger` (rfp-types.ts), the canonical store, on every
         create AND every refresh (this payload is shared by both, see
         createRecord/refreshRecord below), not only the first save. */
      source_turns: sourceTurnsPayload(),
    };
  }

  async function createRecord(withSubmitConsent: boolean): Promise<{ id: string; manage: string; test: boolean }> {
    if (securityScope) {
      const res = await fetch("/sase/api/security-sourcing/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requirement,
          consent: true,
          preferred_vendors: pins,
          /* Reliability gate, third amendment (13 Aug 2026), item 6: this
             was the one save/publish path with NO route for the buyer's
             own wording to reach the persisted record at all -- the
             wizard's rfpPayload() above already carried it, this branch
             never did. FOURTH amendment: sends the structured ledger
             (source_turns), not a flattened string array (source_notes,
             now retired everywhere) -- see sourceTurnsPayload() above. */
          ...(sourceTurns.length ? { source_turns: sourceTurnsPayload() } : {}),
          ...(testMode ? { test: true } : {}),
        }),
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
      // Gap 2 fix (round 5): this is the ONLY save path a Security Sourcing
      // project ever takes after its first save — saveNow() calls this on
      // every subsequent Save, and signAndPublish() calls this as the
      // pre-publish refresh. Round 4 threaded source turns into
      // createRecord()'s first-save POST but never into this route, so any
      // wording typed after that first save was silently never persisted.
      // Sending the full current ledger here and merging idempotently by id
      // server-side (rescope-project.ts) is what makes "save twice" and
      // "type more, then publish" both durable.
      const res = await fetch(`/sase/api/security-sourcing/project/${proj.id}/rescope`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manage_token: proj.manage, requirement, consent: true, source_turns: sourceTurnsPayload() }),
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
    // Sixth amendment, item 3: same non-UI guard as send() above.
    if (!started || saveBusy || resuming) return;
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
      // Living Procurement Canvas Phase 2 correction (14 Aug 2026):
      // `excluded_vendors` used to carry the buyer's pre-publish "drop
      // from direct invites" selections (the removed WHO FITS panel's
      // checkboxes) -- that curation depended on displaying Netify's
      // computed ranking before publication, which the product rule now
      // forbids, so there is no longer a pre-publish signal to send. The
      // publish route's own `excluded_vendors` option still exists
      // server-side for a future consented mechanism; this call simply
      // no longer has anything honest to populate it with.
      const res = await fetch(`/sase/api/rfp/${proj.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manage_token: proj.manage,
          list_on_board: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Living Procurement Canvas Phase 2 correction (14 Aug 2026): keep
        // the FULL invited records (name, credential link) the route
        // returned rather than discarding them down to bare slugs -- this
        // is what lets the post-publish panel render the real, frozen
        // result instead of recomputing anything client-side.
        //
        // Round 4 correction (14 Aug 2026), Robert's findings 3-5:
        // `matchedVendors` now reads `data.matched_vendors` -- the REAL
        // buildShortlist() selection the publish route now also returns
        // (same source `invited` is drawn from) -- never
        // `data.market_report.matched.names` (a different, simpler
        // matchSuppliers() ranking that can genuinely omit an invited
        // vendor). A fresh, live publish is always fully frozen: this
        // exact response IS what the snapshot just wrote.
        const invited: { slug: string; name: string; supplier_url: string }[] = Array.isArray(data.invited) ? data.invited : [];
        const matchedVendors: { slug: string; name: string }[] = Array.isArray(data.matched_vendors) ? data.matched_vendors : [];
        const totalEvaluatedMarket = Number(data.market_report?.matched?.total_evaluated_market ?? 0);
        ev("board_listed", { board_id: data.board?.opportunity_id ?? "" });
        setPublished({ invited, boardId: data.board?.opportunity_id, matchedVendors, totalEvaluatedMarket, frozen: true, namesFrozen: true });
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
    return earnedQuestions(requirement, buying, opModel, notedIds, dismissedQuestionIds, corpus);
  }, [requirement, buying, opModel, noted, corpus, dismissedQuestionIds]);

  /** Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug
   *  2026): the ONE canonical NextQuestion projection (implementation
   *  step 5) -- open decisions, earned questions and visible sector
   *  suggestions, ranked and deduplicated. `rankedNextQuestions` is the
   *  FULL list (used for the section outline's resolved/unresolved
   *  checks and the readiness "material decisions remain" count);
   *  `topThreeQuestions` is the UI-capped slice the primary flow renders
   *  ("no more than three prioritised next decisions"). */
  const rankedNextQuestions = useMemo(
    () => rankNextQuestions({ openDecisions: compiledDocument.openDecisions, earned: earnedAll, suggestions: visibleSectorSuggestions }),
    [compiledDocument.openDecisions, earnedAll, visibleSectorSuggestions],
  );
  const topThreeQuestions = useMemo(() => rankedNextQuestions.slice(0, 3), [rankedNextQuestions]);
  const materialDecisionsRemaining = useMemo(
    () => materialDecisionCount({ openDecisions: compiledDocument.openDecisions, earned: earnedAll, suggestions: visibleSectorSuggestions }),
    [compiledDocument.openDecisions, earnedAll, visibleSectorSuggestions],
  );

  /** The section outline (implementation step 10): a coarser, buyer-
   *  facing read of the SAME state already computed above -- never a
   *  second fact store. The sector row only appears while `pack` is
   *  active (blueprint: "do not display irrelevant sections merely
   *  because a static template contains them"). */
  const sectionOutline: OutlineRow[] = useMemo(() => {
    const hasFact = (path: string) => facts.some((f) => !f.struck && f.path === path);
    const rankedIds = new Set(rankedNextQuestions.map((q) => q.id));
    const declinedCount = pack ? declinedSuggestionIds.filter((id) => pack.suggestions.some((s) => s.id === id) || Object.values(pack.flavourSuggestions).flat().some((s) => s.id === id)).length : 0;
    const acceptedNotedCount = noted.filter((n) => n.id.startsWith("ps-")).length;
    return buildSectionOutline({
      orgScaleComplete: coreFive.sector && coreFive.sites && coreFive.regions && hasFact("estate.users"),
      orgScaleDetail: coreFive.sector && coreFive.sites ? `${cap(String(standingAt("organisation.sector")[0]?.value ?? ""))}, ${standingAt("estate.sites").slice(-1)[0]?.value ?? "?"} sites` : "Sector, sites and regions not yet all stated.",
      scopeComplete: coreFive.scope,
      scopeDetail: buying ? `Buying: ${buying === "sase" ? "SASE" : buying === "sdwan" ? "SD-WAN" : buying === "sse" ? "SSE" : "managed security"}.` : "What is being bought is not yet stated.",
      estateSignal: hasFact("estate.existingNetwork") || hasFact("estate.cloud") || hasFact("estate.existingSecurity"),
      estateDetail: hasFact("estate.existingNetwork") || hasFact("estate.cloud") || hasFact("estate.existingSecurity") ? "Existing estate stated." : "Network, cloud and security estate today not yet stated.",
      resilienceResolved: !rankedIds.has("q-resilience") && !rankedIds.has("OD-operating-model-conflict"),
      resilienceDetail: rankedIds.has("q-resilience") ? "Dual-circuit resilience per site not yet decided." : "Resilience requirement stated or not applicable.",
      securityResolved: !rankedIds.has("q-sse-scope"),
      securityDetail: rankedIds.has("q-sse-scope") ? "Which security controls are in scope is not yet decided." : "Security control scope stated.",
      sector: pack
        ? { title: pack.id === "manufacturing" ? "Manufacturing and OT" : pack.id === "healthcare" ? "Healthcare and clinical systems" : `${pack.label} intelligence`, pendingSuggestions: visibleSectorSuggestions.length, acceptedOrDismissed: acceptedNotedCount + declinedCount }
        : null,
      operatingModelResolved: Boolean(opModel) && !rankedIds.has("OD-support-coverage-ambiguous"),
      operatingModelDetail: opModel ? `Operating model stated.` : "Who runs it day to day is not yet stated.",
      migrationSignal: noted.some((n) => n.id.startsWith("twin-services")),
      migrationDetail: noted.some((n) => n.id.startsWith("twin-services")) ? "Migration/delivery scope stated." : "Migration and implementation scope not yet stated.",
      commercialSignal: noted.some((n) => n.id.startsWith("twin-term") || n.id.startsWith("twin-commercial")),
      commercialDetail: noted.some((n) => n.id.startsWith("twin-term") || n.id.startsWith("twin-commercial")) ? "Commercial preference stated." : "Material once pricing starts; not needed to publish a comparable enquiry.",
      successSignal: noted.some((n) => n.id.startsWith("twin-success")),
      successDetail: noted.some((n) => n.id.startsWith("twin-success")) ? "Success criteria stated." : "Add once the core scope and decisions above are settled.",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts, noted, coreFive, buying, opModel, pack, visibleSectorSuggestions, declinedSuggestionIds, rankedNextQuestions, standingAt]);

  /** Resolves each of the top-3 NextQuestion cards into concrete,
   *  clickable buttons -- done here (not inside the presentational
   *  LivingProcurementCanvas) because the answer path for a compiler
   *  open decision reuses an EXISTING `TWIN_SLOTS` entry's own options
   *  via `landOption`, which is local to this component. The canvas
   *  receives only `{ nq, buttons, hint }`, never TWIN_SLOTS itself, so
   *  it stays a pure presentational layer, per its own header comment. */
  const nextQuestionCards = useMemo(
    () =>
      topThreeQuestions.map((nq) => {
        if (nq.source === "compiler_open_decision") {
          const slotId = OPEN_DECISION_SLOT[nq.id];
          const slot = slotId ? SLOT_BY_ID[slotId] : null;
          return {
            nq,
            buttons: slot ? slot.options.map((o) => ({ label: o.label, onClick: () => landOption(slot, o) })) : [],
            hint: slot ? null : "See “Project details” below for the full context.",
          };
        }
        return {
          nq,
          buttons: (nq.options ?? []).map((o, i) => ({ label: o.label, onClick: () => answerNextQuestion(nq, i) })),
          hint: null,
        };
      }),
    [topThreeQuestions, landOption, answerNextQuestion],
  );

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

  const sendReady = draft.trim().length > 0 && !busy && !resuming;
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
              derived, never decorative.
              Living Procurement Canvas Phase 2 correction (14 Aug 2026):
              this used to show "{fittingCount} of {marketTotal} still fit"
              -- a project-specific matched-vendor COUNT, computed pre-
              publish, unconditionally, in every phase (not just the
              retired ranked panel). A match count is exactly what the
              product rule prohibits before publication, vendor names
              attached or not; see the doc comment on `marketTotal` above.
              Now shows only the safe, non-project-specific evaluated-
              market total. */}
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
                <span className="text-[22px] font-semibold leading-none" style={{ ...mono, letterSpacing: "-0.02em" }}>{marketTotal ?? "…"}</span>
                <span className="text-[12.5px] text-[#8C8A85]">evaluated marketplace</span>
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
              placeholder={resuming ? PLACEHOLDER_RESUMING : started ? PLACEHOLDER_LIVE : PLACEHOLDER_EMPTY}
              disabled={resuming}
              rows={1}
              className="min-h-[24px] max-h-[160px] flex-1 resize-none overflow-y-auto border-0 bg-transparent py-1 text-[16px] leading-[1.45] text-[#141414] outline-none placeholder:text-[#A3A099] disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* ── LIVING PROCUREMENT CANVAS (Phase 3 Stage A, 14 Aug 2026) ──
          The compiled projection of the SAME fact ledger the editable
          statement below still owns: title/summary, readiness, the
          fact-strip counts, the Living document / Supplier pack /
          Evaluation view-switch, the architecture, the numbered
          testable-clause list and open decisions -- all real
          `compileProcurementDocument()` output, never mockup content.
          Deliberately placed ABOVE the existing statement rather than
          replacing it: this IS the primary visible surface the brief
          calls for, while the slot-by-slot statement panel below remains
          the exact, already-working correction/edit affordance for
          individual facts (drop/clear/edit buttons, sector packs, notes)
          -- nothing about that panel's own behaviour changes here. Only
          shown once a project has started, same as the statement it
          sits above; hidden once locked (`phase === "fits"`), the same
          gate the statement uses, so this never renders anywhere near
          the pre-publication vendor-redaction panel below. */}
      {phase === "live" && started && (
        <div className="mx-auto w-full max-w-[1000px] px-[26px] pb-2 pt-[6px]">
          <LivingProcurementCanvas
            document={compiledDocument}
            view={procurementView}
            onViewChange={setProcurementView}
            factsKept={live.length}
            factsStruck={Math.max(0, facts.length - live.length)}
            sourceTurnCount={sourceTurns.length}
            nextQuestionCards={nextQuestionCards}
            outline={sectionOutline}
            materialDecisionsRemaining={materialDecisionsRemaining}
          />
        </div>
      )}

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
      {/* Phase 3 Stage A correction round (Robert, 14 Aug 2026), item 8:
          "do not render two complete procurement documents consecutively
          ... There must remain one authoritative record." The Living
          Procurement Canvas above is now the primary, always-visible
          record; this slot-by-slot editable statement -- every control,
          the fact ledger, drop/clear, sector packs -- is completely
          UNCHANGED, just moved behind a native, clearly labelled
          disclosure rather than rendering as its own second full
          document immediately below the canvas. Collapsed by default
          (native `<details>`, no JS needed to open/close, keyboard- and
          screen-reader-accessible for free). */}
      {phase === "live" && (
        <details className="mx-auto w-full max-w-[1000px] px-[26px] pb-6 pt-[10px]">
          <summary className="cursor-pointer select-none rounded-[9px] px-3 py-2.5 text-[13px] font-medium text-[#6E6C67] hover:bg-[#F4F2ED] hover:text-[#141414]" style={mono}>
            Project details / edit source facts
          </summary>
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
                {/* Mid-funnel sell reinforcement (10 Aug 2026, Robert's
                    standing goal: "the goal is to get a publish so that last
                    step must be clear what the user gets out of the
                    publish"). The sell case previously only lived at the
                    hero and the publish panel itself; this is the one
                    natural point in between, readiness just crossing
                    threshold, so the payoff stays in view on the way there. */}
                <div className="mt-[6px] max-w-[38em] text-[13px] leading-[1.5] text-[#8A4D08]">
                  Next: see what publishing unlocks, then publish to get bids, pricing and vetted responses.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCommand({ kind: "whoFits" })}
                className="flex-none cursor-pointer rounded-full border-0 bg-[#F5A21B] px-[21px] py-3 text-[15px] font-semibold text-[#141414] hover:bg-[#E5940F]"
              >
                See what publishing unlocks
              </button>
            </div>
          )}
          </div>
        </details>
      )}

      {/* ── LOCKED OUTCOME (was "WHO FITS") ── Living Procurement Canvas
          Phase 2 correction (14 Aug 2026): the product rule is that
          publication is the boundary that unlocks a project's matched
          vendors and service providers, not a UI event -- before
          publication this panel MUST NOT reveal a project-specific ranked
          match result: no matched vendor names, rankings, match counts,
          positions, evidence badges, invitation selections or supplier
          links (see /api/workspace/fit/route.ts's own doc comment, which
          now enforces the identical boundary server-side so this panel
          cannot be bypassed by a differently-shaped client). What remains
          honest to show pre-publish: the general evaluated-market size,
          this project's own document readiness, and what remains open --
          never a result computed against this specific requirement's
          vendor match. */}
      {phase === "fits" && (
        <div className="mx-auto w-full max-w-[1000px] px-[26px] pb-6">
          <button
            type="button"
            onClick={() => { setPhase("live"); scrollToWorkspace(); }}
            className="mb-5 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[#8C8A85] hover:text-[#141414]"
          >
            Back to the statement
          </button>
          <div className="overflow-hidden rounded-[14px] border border-[#E5E1D9] bg-[#FBFAF8] p-6">
            <h2 className="m-0 mb-2.5 max-w-[26em] text-[27px] font-semibold leading-[1.25]" style={{ letterSpacing: "-0.022em" }}>
              Publish to match this project against Netify&apos;s evaluated vendors and service providers, invite the strongest fits, and unlock your project documents.
            </h2>
            <p className="m-0 mb-5 max-w-[38em] text-[15.5px] leading-[1.6] text-[#5F5D59]">
              Publishing is free. Who matches, why, and who is invited unlock together, the moment you publish — never before.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[10px] border border-[#E5E1D9] bg-white p-4">
                <div className="text-[22px] font-semibold" style={mono}>{marketTotal ?? "…"}</div>
                <div className="mt-1 text-[12.5px] leading-[1.5] text-[#8C8A85]">
                  Vendors and service providers Netify has evaluated. The whole market, never narrowed by what anyone pays — this project&apos;s own matches are computed at publish.
                </div>
              </div>
              <div className="rounded-[10px] border border-[#E5E1D9] bg-white p-4">
                <div className="text-[22px] font-semibold" style={mono}>{pct}%</div>
                <div className="mt-1 text-[12.5px] leading-[1.5] text-[#8C8A85]">
                  Document readiness. {pctNote}
                </div>
              </div>
              <div className="rounded-[10px] border border-[#E5E1D9] bg-white p-4">
                <div className="text-[22px] font-semibold" style={mono}>{unansweredGaps.length}</div>
                <div className="mt-1 text-[12.5px] leading-[1.5] text-[#8C8A85]">
                  {unansweredGaps.length === 1 ? "Open decision" : "Open decisions"} remaining. Resolve or accept as a stated assumption before you publish.
                </div>
              </div>
            </div>
            <p className="m-0 mt-5 max-w-[38em] text-[13px] leading-[1.6] text-[#8C8A85]">
              What publishing unlocks: your matched vendors and service providers, why each matched with evidence and dates, which were invited directly, the complete market report, and your Word and PDF documents.
            </p>
          </div>

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
                {/* Living Procurement Canvas Phase 2 correction (14 Aug
                    2026): this list now renders ONLY what the publish
                    response itself returned -- `invited` (the real invited
                    suppliers `executePublish()` selected) -- never a
                    freshly recalculated `workspaceFit()` result, which is
                    exactly what the product rule (and Robert's own
                    instruction, 14 Aug 2026) requires post-publish: "the
                    frozen matched and invited suppliers from the published
                    snapshot, not a freshly recalculated workspace fit."
                    Round 4 correction (14 Aug 2026), Robert's findings
                    3-5: `matchedVendors` is now sourced from
                    `matched_vendor_ids`/`matched_vendors` -- the REAL
                    `buildShortlist()` selection, the SAME one `invited` is
                    drawn from -- never `market_report.matched.names` (a
                    different, simpler `matchSuppliers()` ranking that
                    could silently omit an invited vendor; proven live
                    with Fortinet). The "invited" badge below now matches
                    by SLUG, not name (name equality silently failed for
                    any vendor whose display name differs even slightly).
                    A buyer-pinned vendor can still be invited without
                    being part of Netify's own ranked match (pins are the
                    buyer's own selection, not a computed match) -- such
                    entries are rendered in a second "also invited" list
                    below rather than silently vanishing, matching
                    Robert's suggestion of a stable union rather than one
                    list that can quietly drop an invitee. Wording is
                    conditional on `published.frozen`/`namesFrozen`
                    (round 4, finding 2): "exactly as published" is only
                    claimed when a real snapshot backs this read, and
                    "frozen at the moment of publication" only when the
                    NAMES themselves are frozen, not resolved from
                    whatever the live marketplace directory says today. */}
                {(published.matchedVendors.length > 0 || published.invited.length > 0) && (
                  <div className="mt-3">
                    <p className="m-0 mb-1 text-[10px] font-semibold uppercase text-[#B4650B]" style={{ ...mono, letterSpacing: ".12em" }}>Your matches</p>
                    <p className="m-0 mb-2 max-w-[38em] text-[13px] leading-[1.6] text-[#5F5D59]">
                      {published.matchedVendors.length} matched out of {published.totalEvaluatedMarket} evaluated
                      {published.frozen ? ", from this publish's own frozen match" : ", recomputed today — no frozen snapshot exists for this project from before publication tracking began"}.{" "}
                      {cap(numWord(published.invited.length))} invited directly.
                      {published.frozen && !published.namesFrozen && " Vendor names below are resolved from the current marketplace directory, not frozen at the moment of publication."}
                    </p>
                    {published.matchedVendors.length > 0 && (
                      <ol className="m-0 list-none p-0">
                        {published.matchedVendors.map((v, i) => {
                          const inv = published.invited.some((iv) => iv.slug === v.slug);
                          return (
                            <li key={`${v.slug}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-[#F5F3EE] py-2.5 first:border-t-0 first:pt-0">
                              <span className="text-[11px] text-[#8C8A85]" style={mono}>{String(i + 1).padStart(2, "0")}</span>
                              <span className="text-[14px] font-semibold text-[#141414]">{v.name}</span>
                              {inv && (
                                <span className="rounded-full bg-[#FFF7E8] px-1.5 py-[1px] text-[10px] font-semibold uppercase text-[#8A4D08]" style={{ ...mono, letterSpacing: ".08em" }}>invited</span>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    {(() => {
                      const matchedSlugs = new Set(published.matchedVendors.map((v) => v.slug));
                      const invitedOnly = published.invited.filter((v) => !matchedSlugs.has(v.slug));
                      if (invitedOnly.length === 0) return null;
                      return (
                        <div className="mt-2">
                          <p className="m-0 mb-1 text-[11px] text-[#8C8A85]">
                            Also invited (your own pinned {invitedOnly.length === 1 ? "vendor" : "vendors"}, not part of the ranked match):
                          </p>
                          <ol className="m-0 list-none p-0">
                            {invitedOnly.map((v, i) => (
                              <li key={`${v.slug}-invited-only-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-[#F5F3EE] py-2 first:border-t-0 first:pt-0">
                                <span className="text-[14px] font-semibold text-[#141414]">{v.name}</span>
                                <span className="rounded-full bg-[#FFF7E8] px-1.5 py-[1px] text-[10px] font-semibold uppercase text-[#8A4D08]" style={{ ...mono, letterSpacing: ".08em" }}>invited</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      );
                    })()}
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
                {/* Sell block (Robert's ask, 10 Aug 2026, tightened same day
                    on his "more concise and harder hitting" feedback): the
                    mechanics/trust copy below this earns confidence, but
                    nothing on the panel made the case for WHY to publish.
                    One headline stating exactly what this gets you + a row
                    of plain benefit chips; the old separate closing line is
                    folded into the headline so there's one less text block.
                    No new colours, same tokens as the diagram and chips
                    elsewhere in this panel. */}
                <p className="m-0 max-w-[36em] text-[17px] font-semibold leading-[1.5] text-[#141414]">
                  Get bids. Get pricing. Get vetted responses. Send messages. Request demos. No salesperson required.
                </p>
                <div className="mt-2.5 flex max-w-[36em] flex-wrap gap-1.5">
                  {["Get bids", "Get pricing", "Get vetted responses", "Send messages", "Request demos"].map((chip) => (
                    <span key={chip} className="rounded-full border border-[#F5A21B]/40 bg-[#FFF7E8] px-2.5 py-1 text-[12.5px] font-medium text-[#8A4D08]">
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="mt-4 max-w-[36em] text-[16px] leading-[1.6]">
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
        published={published ? { invited: published.invited.map((v) => v.slug) } : null}
        buying={buying}
        added={added}
        namedSlugs={namedSlugs}
        started={started}
        // Living Procurement Canvas Phase 2 correction (14 Aug 2026): the
        // "kept/ranked" signal the Constellation positions vendors by is
        // now the REAL, frozen invited-vendor slugs from the publish
        // response -- the same "matched and invited from the published
        // snapshot" data the rest of the post-publish panel reads --
        // never a live, still-recomputing workspaceFit() result (which
        // this used to be, via the now-retired keptFits/fitSlugs).
        fitSlugs={published?.invited.map((v) => v.slug) ?? []}
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
                {resuming && <p className="m-0 mb-2 text-[12.5px] leading-relaxed text-[#8C8A85]">Loading your saved project…</p>}
                <button
                  type="button"
                  onClick={() => void saveNow()}
                  disabled={saveBusy || resuming || (securityScope && !consentSave)}
                  className="cursor-pointer rounded-full border-0 bg-[#F5A21B] px-[20px] py-[11px] text-[14.5px] font-semibold text-[#141414] hover:bg-[#E5940F] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saveBusy ? "Saving…" : resuming ? "Loading…" : created ? "Save changes" : "Save"}
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
