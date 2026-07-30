"use client";

/**
 * The Living Statement of Requirements (P3.1, spec v1.5 section 13,
 * Robert's sign-off 22 July 2026): the desk.
 *
 * The product is a living Statement of Requirements; everything else
 * responds to it. This surface renders the COMPLETE framework from second
 * zero: every section a buyer will need, on screen, in the example state,
 * becoming theirs as they speak or touch. The document is the hero; the
 * market, the estate figure, the We Noticed card and the crew ledger are
 * the responding organs in the rail.
 *
 * Four truth classes, rendered distinctly forever (13.3): example (grey,
 * never publishes, never counts, never feeds the verdict, fit or diagram;
 * retires when its section holds a real fact), stated (the buyer said it
 * or clicked it; solid ink, solid underline), inferred (dotted underline,
 * reason attached, one tap strikes), verified (a dated tick; earned by
 * evidence, today the supplier evaluations).
 *
 * The receipt rule (13.6): no clause vanishes silently. What extraction
 * cannot place lands verbatim under "Notes, unplaced", and unpathed
 * selections are recorded as stated notes rather than pretending to feed
 * the engine.
 *
 * The machinery is untouched: the same extraction cycle, ledger, rulebook,
 * fit, create, accept-gap and publish organs W0 shipped and P2 proved
 * live. PositionWorkspace remains in-tree as this surface's ancestor.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { assessSecurityRequirement, type SecurityScopeVerdict } from "@/lib/security/rulebook";
import {
  deriveInstrumentLadder,
  deriveRfiQuestionSet,
  earnedInstrument,
  instrumentNotesLine,
} from "@/lib/workspace/instrument";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { ACCEPT_GAP_PREFIX } from "@/components/GapActions";
import { statedObjectivesIn, LIST_FACT_PATHS, type AllowedPath, type BuyingId, type FieldUpdate } from "@/lib/workspace/extract";
import {
  briefModel,
  briefText,
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
  REGION_LABELS,
  regionStandalone,
  type BriefGap,
  type WorkspaceFact,
} from "@/lib/workspace/draft";
import { ORGANISATION_EXAMPLES, TAXONOMY, sectionForGapKey, sectionForPath, unlandedMentions, type TaxonomyItem } from "@/lib/workspace/taxonomy";
import { earnedQuestions, type EarnedQuestion, type QuestionAnswer } from "@/lib/workspace/questions";
import { activePack, activeFlavours, visibleSuggestions, declinedOnRecord, packRiskNotes } from "@/lib/sector/derive";
import { chunkForIngest, ingestSummary } from "@/lib/workspace/ingest";
import { PACKS_VERSION, type PackSuggestion } from "@/lib/sector/packs";
import { deriveAreaState, refineConfirmed } from "@/lib/workspace/areas";
import { diagramModel } from "@/lib/workspace/diagram";
import { BAND, capabilityRing, constellation, labelOffsets, vendorHue } from "@/lib/workspace/constellation";
import { siteFigureIsIdentifying, siteBandLabelFor } from "@/lib/notice-options";
import WorkspaceDiagram from "@/components/WorkspaceDiagram";
import JourneyRail, { type RailStep, type RailStepId } from "@/components/JourneyRail";
import SignIn from "@/components/SignIn";
import { fireNetifyEvent } from "@/components/NetifyEvents";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/* R2, Robert's ruling 30 Jul 2026: NO PERSISTENCE. The draft key, the
 * seven-day restore, the save-lite prompt and the claim-at-sign-in are
 * all gone. A project is one sitting, from the first sentence to the
 * publish, and the refresh risk is accepted deliberately: a saved draft
 * that nobody returns to was 447 drafts in ninety days and one publish.
 * Nothing on this desk writes to localStorage. */

const WORKSPACE_AGREEMENT_TEXT =
  "Publish this requirement: Netify lists an anonymous notice visible to signed-in vendors and service providers, and invites the best-fit evaluated vendors and service providers, who respond through the app. My identity and contact details stay private until I choose to reply, and pricing stays private to me.";

/* The intent blocks (Robert's 24 Jul restructure): a sector and a goal
 * compose a sentence in the input, in the buyer's own editable words; the
 * desk's ordinary pause-debounce then reads it. No emojis (his own audit
 * law), no rigid pre-written profiles: the blocks are fragments, the
 * sentence stays the buyer's. */
const SECTOR_CHIPS: Array<{ label: string; text: string }> = [
  { label: "Healthcare", text: "We are a healthcare provider" },
  { label: "Retail", text: "We are a retailer" },
  { label: "Manufacturing", text: "We are a manufacturer" },
  { label: "Financial services", text: "We are a financial services firm" },
];
const GOAL_CHIPS: Array<{ label: string; text: string }> = [
  { label: "Replace MPLS", text: "replacing legacy MPLS with managed SD-WAN" },
  { label: "PCI DSS compliance", text: "needing a PCI DSS compliant network" },
  { label: "Zero trust SASE", text: "consolidating security into zero trust SASE" },
];

/* The wrong-company guard (R9, Robert's ruling 30 Jul 2026). The
 * disambiguation sentence used to stand in the sign-in box, where it
 * planted a doubt in somebody who had already decided who we are. It
 * belongs at the desk instead, and only for a person whose own words say
 * they came for one of the other companies. Deliberately narrow: every
 * pattern here is a phrase a SASE or SD-WAN buyer would not write. */
const OTHER_NETIFY = [
  /netlify/i,
  /netify\.ai/i,
  /\bjamstack\b/i,
  /\bstatic site\b/i,
  /\bweb(site)? hosting\b/i,
  /\bdeploy (my|our) (site|website)\b/i,
];
const looksLikeAnotherNetify = (text: string) => OTHER_NETIFY.some((r) => r.test(text));

/** The blocks compose one editable sentence; the buyer owns every word. */
function composeIntent(sector: string | null, goals: string[]): string {
  const s = SECTOR_CHIPS.find((c) => c.label === sector)?.text ?? "We are";
  const g = goals.map((l) => GOAL_CHIPS.find((c) => c.label === l)?.text ?? "").filter(Boolean).join(" and ");
  return g ? `${s} ${g}.` : `${s}.`;
}

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

/** `own` marks an answer the buyer typed: kept verbatim, rendered as their
 *  words, with the technical wording beneath it and never over it (1f). */
type NotedItem = { id: string; label: string; section: string; own?: boolean };
type Receipt = { id: number; text: string };

/** Article 14 (spec 13.13): every visible movement answers "what changed".
 *  The latest movement per supplier, and the append-only session log. */
type Move = { dir: "up" | "down" | "hold"; places: number; label: string; grade: string; date: string };
type MoveLogEntry = { slug: string; at: string; dir: "up" | "down" | "hold"; text: string };

/** The dataset's grade words, humanised for the movement line. */
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

/** Item lookup for earned-question answers: an answer lands through the
 *  desk's own click machinery, never a parallel write path. */
const ITEM_BY_ID: Record<string, { item: TaxonomyItem; section: string }> = (() => {
  const out: Record<string, { item: TaxonomyItem; section: string }> = {};
  for (const s of TAXONOMY) for (const i of s.items) out[i.id] = { item: i, section: s.key };
  return out;
})();

/* ------------------------------------------------------------------ */
/* The selector (1a, 1b, 1f): one list, ranked, typed, sayable in your   */
/* own words. Presentation only. The taxonomy, the question set, the     */
/* ledger and the four truth classes are untouched by everything below.  */
/* ------------------------------------------------------------------ */

/** Section headings as the buyer reads them. The taxonomy keeps its own
 *  internal wording; nothing on this desk renders "supplier". */
const SECTION_TITLES: Record<string, string> = { suppliers: "Vendor requirements" };
const sectionTitle = (key: string, fallback: string): string => SECTION_TITLES[key] ?? fallback;

/** 1b: the candidates most likely for the buyer's sector come first, each
 *  with the one line that says why. A candidate that is not ranked is never
 *  hidden by ranking, only ordered after the ones that are. */
type Lead = { id: string; reason: string };

const SECTOR_FAMILIES: Array<{ match: RegExp; key: string; word: string }> = [
  { match: /health|pharma|nhs/i, key: "healthcare", word: "healthcare" },
  { match: /financ|bank|insur/i, key: "financial", word: "financial services" },
  { match: /retail|commerce/i, key: "retail", word: "retail" },
  { match: /manufactur|industr/i, key: "manufacturing", word: "manufacturing" },
];

const LEADS: Record<string, Record<string, Lead[]>> = {
  retail: {
    compliance: [
      { id: "c-pci", reason: "Card payments in store put PCI DSS in scope." },
      { id: "c-gdpr", reason: "Customer data sits across the whole estate." },
      { id: "c-cep", reason: "Often required by your own customers." },
    ],
    security: [
      { id: "sse-fwaas", reason: "PCI DSS asks for segmentation you can evidence." },
      { id: "sse-dlp", reason: "Card and customer data leaving the estate." },
      { id: "sse-ztna", reason: "Store staff and third parties, scoped access only." },
    ],
    estate: [
      { id: "net-cell", reason: "Keeps tills trading when a line drops." },
      { id: "net-bandwidth", reason: "Per-store bandwidth is what vendors price on." },
    ],
    support: [
      { id: "s-247", reason: "Stores trade outside office hours." },
      { id: "s-uk", reason: "A UK desk for a UK estate." },
    ],
  },
  healthcare: {
    compliance: [
      { id: "c-dspt", reason: "Patient data brings NHS DSPT with it." },
      { id: "c-gdpr", reason: "Patient records are special category data." },
      { id: "c-iso", reason: "Asked for in most NHS procurement." },
    ],
    security: [
      { id: "sse-ztna", reason: "Clinical systems, scoped access per role." },
      { id: "sse-email", reason: "Clinical mailboxes carry patient data." },
      { id: "sse-dlp", reason: "Patient data leaving the trust." },
    ],
    estate: [
      { id: "net-dc", reason: "Clinical systems still sit in data centres." },
      { id: "net-remote", reason: "Community and home-visiting staff." },
    ],
    support: [
      { id: "s-247", reason: "Clinical services run around the clock." },
      { id: "s-uk", reason: "A UK desk for UK patient data." },
    ],
  },
  financial: {
    compliance: [
      { id: "c-fca", reason: "FCA obligations follow the regulated activity." },
      { id: "c-nis2", reason: "NIS2 reaches financial infrastructure." },
      { id: "c-iso", reason: "Standard evidence in financial tenders." },
    ],
    security: [
      { id: "sse-dlp", reason: "Client data leaving the firm." },
      { id: "sse-ztna", reason: "Least privilege on client systems." },
      { id: "sse-casb", reason: "Sanctioned cloud apps, watched." },
    ],
    support: [
      { id: "s-247", reason: "Trading and payment hours." },
      { id: "s-engineer", reason: "A named contact for regulated change." },
    ],
  },
  manufacturing: {
    compliance: [
      { id: "c-nis2", reason: "NIS2 reaches industrial operators." },
      { id: "c-iso", reason: "Standard evidence in manufacturing tenders." },
      { id: "c-cep", reason: "Often required by your own customers." },
    ],
    security: [
      { id: "sse-fwaas", reason: "Plant networks segmented from IT." },
      { id: "sse-ztna", reason: "Third-party engineers, scoped access only." },
    ],
    estate: [
      { id: "net-cell", reason: "Keeps a plant connected when a line drops." },
      { id: "net-dc", reason: "Production systems still sit in data centres." },
    ],
    support: [
      { id: "s-247", reason: "Production runs outside office hours." },
      { id: "s-engineer", reason: "A named contact for planned downtime." },
    ],
  },
};

/** 1b: whether a question takes one answer or many, stated plainly. Display
 *  only; the question set is not touched. Anything unlisted is derived. */
const ANSWER_COUNT: Record<string, "one" | "any"> = {
  "q-root-sector": "one",
  "q-root-scope": "one",
  "q-sase-shape": "one",
  "q-mpls-keep": "one",
  "q-fca": "one",
  "q-dspt": "one",
  "q-azure-vwan": "one",
  "q-residency": "one",
  "q-resilience": "one",
  "q-contract-end": "one",
  "q-support": "any",
  "q-sse-scope": "any",
  "q-hc-mdr": "one",
  "q-hc-iam": "one",
  "q-hc-clinical": "one",
  "q-nhs-hscn": "one",
};

/** How many answers an earned question takes, when it is not listed above:
 *  options that all land on one scalar ledger path are alternatives. */
function answerCountOf(q: EarnedQuestion): "one" | "any" {
  const listed = ANSWER_COUNT[q.id];
  if (listed) return listed;
  const adding = q.options.filter((o) => o.answer.kind !== "dismiss");
  if (adding.length <= 1) return "one";
  const ids = adding.flatMap((o) => (o.answer.kind === "items" ? o.answer.itemIds : []));
  const paths = ids.map((id) => ITEM_BY_ID[id]?.item.path).filter(Boolean) as string[];
  if (ids.length && paths.length === ids.length && paths.every((p) => !LIST_FACT_PATHS.has(p))) return "one";
  return ids.length === 0 ? "one" : "any";
}

/** 1f: what vendors and service providers are actually asked in this part of
 *  the requirement. It sits beneath the buyer's own words, never over them. */
const SECTION_TECH: Record<string, string> = {
  organisation: "the size and shape of the estate the service has to cover",
  drivers: "what is driving the project, and what it has to fix",
  objectives: "the service being bought and the architecture it has to fit",
  estate: "sites, circuits, cloud platforms and what stays through migration",
  security: "the controls in scope, and the evidence for each one",
  compliance: "the regimes in scope, and the evidence they have to produce",
  model: "who runs the service day to day, and how duties are split",
  change: "change classes, the approval route, and the windows changes run in",
  support: "cover hours, response times, and where the desk sits",
  commercial: "contract term, price basis, and what the quote includes",
  services: "the professional services in scope, and how they are priced",
  success: "the targets the service is judged against, and the reporting",
  suppliers: "who may respond, and the evidence they carry",
};

/** What a tap on a candidate line does. Described, not closed over, so the
 *  list can be built in the render body without carrying handlers with it. */
type CandAction =
  | { kind: "item"; item: TaxonomyItem }
  | { kind: "gap"; gap: BriefGap; value: string; label: string }
  | { kind: "earned"; q: EarnedQuestion; answer: QuestionAnswer }
  | { kind: "note"; id: string };

/** Validator notes, humanised for the crew (Harry's 22 Jul finding: raw
 *  "Dropped estate.users: not a sensible number" is not buyer copy).
 *  Display-side only; the API's notes stay verbatim. */
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

/** One line of evidence for the question's quiet provenance tooltip. */
const evidenceLine = (q: EarnedQuestion): string =>
  q.evidence
    .map((e) => ("citations" in e ? `"${e.query}" · ${e.citations} AI citations` : `"${e.query}"`))
    .join(" · ");

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
const stamp = () => new Date().toTimeString().slice(0, 8);
const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

type CrewLine = { t: string; text: string; cls?: "you" | "em" };

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

/** afterPrompt (the v6 Perplexity ruling, 26 Jul 2026): the pages slot
 *  the hero blocks and roster directly beneath the prompt card, above
 *  the procurement spine; nothing else about the desk changes. */
export default function ProjectDesk({ afterPrompt }: { afterPrompt?: ReactNode }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [facts, setFacts] = useState<WorkspaceFact[]>([]);
  const [noted, setNoted] = useState<NotedItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  /** 1b: sections whose "+N more" has been opened. Display state only. */
  const [openedSecs, setOpenedSecs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SecurityScopeVerdict | null>(null);
  const [fit, setFit] = useState<FitState | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [crew, setCrew] = useState<CrewLine[]>([]);
  const [vendorCard, setVendorCard] = useState<MarketVendor | null>(null);
  const [artefactOpen, setArtefactOpen] = useState(false);
  /* The constellation's reading key (Robert's R3 on Harry's Section 1 ask,
   * 28 Jul 2026): a quiet toggle, granular detail, no marketing modal. */
  const [constellationKey, setConstellationKey] = useState(false);
  /** True once the mount effect has decided between draft, link and the
   *  pristine example, so pre-start controls never flash before a
   *  restore (Robert, 23 Jul: the button flashed then vanished). */
  const [booted, setBooted] = useState(false);
  const [testMode, setTestMode] = useState(false);
  /* The three ruled steps (R5, 30 Jul 2026): Requirement, Who fits,
   * Generate and publish. Publish is the only exit. Step state is
   * session-local like everything else on this desk now (R2). */
  const [step, setStep] = useState<RailStepId>(1);
  /* The furthest step reached. Harry's read, 30 Jul 2026: he never found
   * anywhere showing which suppliers fit, and the reason is that the rail
   * made every step clickable, so a buyer could go straight from the
   * requirement to publishing and never see Who fits at all. Going BACK is
   * always free, which is CTM's pencil; going FORWARD happens through the
   * step's own control, so nobody skips the proof. */
  const [maxStep, setMaxStep] = useState<RailStepId>(1);
  const [wrongCompany, setWrongCompany] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  /* The applied-changes strip (F2, 29 Jul 2026, adopted from the mockup
   * review Robert approved): after a machine pass the desk names what it
   * placed or revised and offers one Undo. The staleness gate is
   * reference equality on the facts array: ANY later mutation (a strike,
   * an answer, another pass, a restore) produces a new array, so a stale
   * undo can never fire. Undo reverts the LEDGER only: receipts (your
   * verbatim words) and noted items (your stated objectives) are the
   * buyer's own and are never machine-undone. Session-local by design;
   * an undo across a reload would revert work the buyer can no longer
   * see the shape of. */
  const [lastPass, setLastPass] = useState<{
    source: "extract" | "link";
    changes: Array<{ id: string; label: string; provenance: WorkspaceFact["provenance"]; kind: "placed" | "revised" }>;
    prevFacts: WorkspaceFact[];
    factsAtSet: WorkspaceFact[];
  } | null>(null);
  /* What changed, pass by pass: newest first, capped at ten, persisted
   * with the draft so the history survives a reload. */
  const [passLog, setPassLog] = useState<Array<{ at: string; text: string; changes: number; undone?: boolean }>>([]);
  const [passLogOpen, setPassLogOpen] = useState(false);

  const [moveNow, setMoveNow] = useState<Record<string, Move>>({});
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [dismissedQ, setDismissedQ] = useState<string[]>([]);
  /* Sector pack suggestions: declined is permanent, on the record. */
  const [declinedSug, setDeclinedSug] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState<string>("");
  /** Sections the buyer has weighted high for scoring (wave two: the
   *  full RFP's priorities). Persisted with the draft. */
  const [weights, setWeights] = useState<string[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);

  const [signedIn, setSignedIn] = useState(false);
  // Who the signature will publish as (29 Jul 2026, Robert's mockup
  // review: the buyer sees their verification state at the decision, not
  // at the refusal). Read from the session endpoint: the address, whether
  // it can publish (work_address, the same static list the chain checks
  // first), and the company as Netify derives it from the domain.
  const [sessId, setSessId] = useState<{ email: string; work: boolean; company: string | null } | null>(null);

  const [consentCreate, setConsentCreate] = useState(false);
  const [consentGaps, setConsentGaps] = useState(false);
  const [consentPublish, setConsentPublish] = useState(false);
  const [signStage, setSignStage] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [created, setCreated] = useState<{ id: string; manage: string; test: boolean } | null>(null);
  const [published, setPublished] = useState<{ invited: string[]; boardId?: string } | null>(null);
  /** Live board proof (v7): open-notice count and up to two latest titles,
   *  read from the board's public JSON twin. Never typed, never faked: on
   *  any failure or an empty board the line simply does not render. */
  const [boardProof, setBoardProof] = useState<{ open: number; latest: { id: string; title: string; full: boolean }[] } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const firstKeyAt = useRef<number | null>(null);
  const firstVerdictSent = useRef(false);
  /** preview_rendered fires once per mount (v7 funnel step two). */
  const previewFired = useRef(false);
  const lastRunText = useRef("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptedGaps = useRef<Set<string>>(new Set());
  const cycleRef = useRef(0);
  const receiptId = useRef(0);
  /** 1f: identity for an answer given in the buyer's own words. */
  const ownWordsId = useRef(0);
  const factsRef = useRef<WorkspaceFact[]>([]);
  const receiptsRef = useRef<Receipt[]>([]);
  const prevFitRef = useRef<{ order: string[]; matched: Map<string, Set<string>>; checkIds: Set<string>; checkLabels: Map<string, string> } | null>(null);
  const notedRef = useRef<NotedItem[]>([]);
  useEffect(() => { notedRef.current = noted; }, [noted]);

  const crewLog = useCallback((text: string, cls?: "you" | "em") => {
    setCrew((c) => [...c.slice(-11), { t: stamp(), text, cls }]);
  }, []);

  const applyMerge = useCallback((updates: FieldUpdate[], source: "extract" | "answer" | "link") => {
    cycleRef.current += 1;
    const m = mergeUpdates(factsRef.current, updates, cycleRef.current, source);
    factsRef.current = m.facts;
    setFacts(m.facts);
    if (m.changed.length) {
      setFlash((f) => new Set([...f, ...m.changed]));
      setTimeout(() => setFlash((f) => {
        const n = new Set(f);
        for (const id of m.changed) n.delete(id);
        return n;
      }), 1100);
    }
    return m;
  }, []);

  const requirement = useMemo(() => requirementFrom(facts), [facts]);
  const buying = buyingOf(facts);
  const opModel = operatingModelOf(facts);
  const securityScope = buying === "managed_security" || buying === null;
  const live = standing(facts);
  const started = facts.length > 0 || noted.length > 0;
  const meter = meterOf(facts, verdict);

  /* ---- preview_rendered (v7 funnel, step two): the desk first holds
   * structure. Fires once per mount, whatever route started it: typing,
   * a chip, a paste or a ?q= arrival. ---- */
  useEffect(() => {
    if (!started || previewFired.current) return;
    previewFired.current = true;
    ev("preview_rendered", { facts: facts.length });
  }, [started, facts.length]);
  const brief = useMemo(() => briefModel({ facts, verdict }), [facts, verdict]);
  const diagram = useMemo(() => diagramModel(requirement, verdict, buying), [requirement, verdict, buying]);

  /* ---- Arrival: market, params, session ---- */
  useEffect(() => {
    fetch("/sase/api/workspace/market")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Market | null) => {
        if (!d) return;
        setMarket(d);
        setCrew([
          { t: "today", text: `Scout: ${d.counts.vendors} vendors and service providers evaluated · latest ${fmtDate(d.latest_evaluation)}` },
          { t: "now", text: `Registrar: ${d.counts.notices} notice${d.counts.notices === 1 ? "" : "s"} open on the board` },
          { t: "now", text: "holding, honestly. grey is example content and never publishes." },
        ]);
      })
      .catch(() => {});
    fetch("/sase/api/auth/session")
      .then((r) => r.json())
      .then((s: { authenticated?: boolean }) => setSignedIn(Boolean(s.authenticated)))
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
        reason: "from the link you arrived on; strike it out if wrong",
      });
    }
    const q = p.get("q");
    /* The Continuation contract (DEF wave one, 23 Jul): ?vendors= names
       suppliers that arrive pinned into invitations alongside ?q=. Applied
       only on a ?q= arrival, so a stray parameter can never overwrite
       pins the buyer chose themselves. Sanitised, capped at five. */
    const vendorsParam = (p.get("vendors") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z0-9-]{2,60}$/.test(s))
      .slice(0, 5);
    /* R2: nothing is restored. The desk starts empty every time except
       for what the link itself carries. */
    if (seedFacts.length) applyMerge(seedFacts, "link");
    if (q) {
      setInput(q);
      firstKeyAt.current = Date.now();
      if (vendorsParam.length) setAdded(vendorsParam);
      void runCycle(q, { fromLink: true });
    }
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Autofocus, pointer-fine only (v7): on a desktop the caret waits
   * in the field like any search engine's. Touch devices are exempt so
   * the keyboard never leaps over the page. ---- */
  useEffect(() => {
    try {
      if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
    } catch { /* focus is a courtesy, never a dependency */ }
  }, []);

  /* ---- The live proof (v7): one read of the board's public JSON twin.
   * The same document agents read; the titles render from it verbatim,
   * so the line self-corrects the moment the board changes. ---- */
  useEffect(() => {
    let cancelled = false;
    fetch("/sase/opportunities/board/data.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { opportunities?: { id?: string; title?: string; status?: string; has_full_rfp?: boolean }[] } | null) => {
        if (cancelled || !data?.opportunities) return;
        const open = data.opportunities.filter((o) => o.id && o.title && (o.status ?? "open") === "open");
        if (!open.length) return;
        setBoardProof({
          open: open.length,
          latest: open.slice(0, 2).map((o) => ({ id: String(o.id), title: String(o.title), full: Boolean(o.has_full_rfp) })),
        });
      })
      .catch(() => { /* the proof line is optional by design */ });
    return () => { cancelled = true; };
  }, []);

  /* ---- The extraction cycle (the same organ), now with the receipt ---- */
  const runCycle = useCallback(
    async (text: string, opts: { fromEnter?: boolean; fromLink?: boolean } = {}) => {
      const trimmed = text.trim();
      if (trimmed.length < 3 || busy) return;
      if (looksLikeAnotherNetify(trimmed)) setWrongCompany(true);
      lastRunText.current = trimmed;
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
        const updates = data.updates ?? [];
        // Snapshot BEFORE the merge for the Undo strip: applyMerge
        // reassigns factsRef, so this reference IS the pre-pass ledger
        // (mergeUpdates copies, it never mutates its input).
        const factsBefore = factsRef.current;
        const merged = applyMerge(updates, "extract");
        if (merged.changed.length) {
          const beforeIds = new Set(factsBefore.map((f) => f.id));
          const byId = new Map(merged.facts.map((f) => [f.id, f]));
          const changes = merged.changed
            .map((id) => {
              const f = byId.get(id);
              return f
                ? { id, label: factLabel(f), provenance: f.provenance, kind: (beforeIds.has(id) ? "revised" : "placed") as "placed" | "revised" }
                : null;
            })
            .filter((c): c is NonNullable<typeof c> => c !== null)
            .slice(0, 12);
          setLastPass({ source: opts.fromLink ? "link" : "extract", changes, prevFacts: factsBefore, factsAtSet: merged.facts });
          setPassLog((l) => [{ at: stamp(), text: trimmed.slice(0, 90), changes: merged.changed.length }, ...l].slice(0, 10));
        }

        for (const u of updates.slice(0, 4)) {
          crewLog(
            u.provenance === "stated"
              ? `Listener: your words: "${(u.quote ?? String(u.value)).slice(0, 60)}"`
              : `Listener: inference, named: ${(u.reason ?? String(u.value)).slice(0, 60)}`,
            u.provenance === "stated" ? "you" : undefined,
          );
        }
        for (const n of (data.notes ?? []).slice(0, 2)) crewLog(`Listener: ${humaniseNote(n)}`);

        // Stated objectives note themselves (Harry, 24 July 2026: "best of
        // breed services", written near-verbatim, was raised back as an
        // open question). The phrase is in THIS cycle's words, so the note
        // is solid ink, the buyer's own statement; removing it later stays
        // removed unless they say it again. questions.ts sees the id and
        // keeps the shape question suppressed.
        for (const o of statedObjectivesIn(trimmed)) {
          setNoted((ns) => {
            if (ns.some((n) => n.id === o.id)) return ns;
            crewLog(`Listener: your words: ${o.label} · kept with your position as a stated note`, "you");
            return [...ns, { id: o.id, label: o.label, section: "objectives" }];
          });
        }

        // The receipt rule (13.6): no clause vanishes silently. A clause no
        // update evidently touched is kept verbatim under Notes, unplaced.
        // Commas split too (P3.1.1): Robert's own rich sentence is one long
        // comma list, and "5 global sites" must not hide inside a sentence
        // its neighbours got credit for. Matching is normalised to letters
        // and digits so quote-form drift (24x7 vs 24/7) never fakes a miss.
        const norm = (s: unknown) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
        const clauses = trimmed.split(/(?<=[.;!?])\s+|,\s+/).map((c) => c.trim()).filter((c) => c.length > 10);
        // Landed labels for the mention guard (Harry's NIS2 finding): an
        // on-desk item named in a clause must itself have landed, or the
        // clause keeps its receipt regardless of what its neighbours earned.
        const landedLabels = new Set<string>();
        for (const s of TAXONOMY) {
          for (const i of s.items) {
            if (!i.path) continue;
            const id = factId(i.path, i.value);
            if (factsRef.current.some((f) => f.id === id && !f.struck && String(f.value) === String(i.value))) landedLabels.add(i.label);
          }
        }
        for (const n of notedRef.current) landedLabels.add(n.label);
        const touched = (clause: string) => {
          if (unlandedMentions(clause, landedLabels).length > 0) return false;
          const c = norm(clause);
          return updates.some((u) => {
            if (u.quote && norm(u.quote).length > 2 && c.includes(norm(u.quote))) return true;
            const vals = Array.isArray(u.value) ? u.value : [u.value];
            return vals.some((v) => norm(v).length > 1 && c.includes(norm(v)));
          });
        };
        const unplaced = clauses.filter((c) => !touched(c));
        // Supersede stale snapshots before adding fresh ones (Harry's
        // Section 1 finding, 28 Jul 2026: a mid-word fragment, "We are a
        // retailer loo", outlived the finished sentence). The desk derives
        // while you type, so a cycle can run on a half-typed sentence and
        // keep its fragment as a receipt. When this cycle's input carries a
        // receipt's words as a leading fragment of something longer, that
        // receipt was an earlier photo of the same words, not words with no
        // home: it is removed, and the finished clause is judged fresh.
        // Runs even when nothing is unplaced, so the final sentence that
        // places every word also clears its own stale fragments.
        setReceipts((rs) => {
          const wholeNorm = norm(trimmed);
          const clauseNorms = clauses.map((c) => norm(c));
          const pruned = rs.filter((r) => {
            const rn = norm(r.text);
            if (!rn) return false;
            const grewInto = clauseNorms.some((cn) => cn.length > rn.length && cn.startsWith(rn));
            const opensThisInput = wholeNorm.length > rn.length && wholeNorm.startsWith(rn);
            return !(grewInto || opensThisInput);
          });
          const have = new Set(pruned.map((r) => r.text.toLowerCase()));
          const fresh = unplaced.filter((c) => !have.has(c.toLowerCase()));
          if (!fresh.length && pruned.length === rs.length) return rs;
          return [...pruned, ...fresh.map((text) => ({ id: ++receiptId.current, text }))].slice(-12);
        });
        if (unplaced.length) {
          crewLog(`Listener: heard, no home yet · ${unplaced.length} clause${unplaced.length === 1 ? "" : "s"} kept verbatim in Notes, unplaced`);
        }

        setEngineUsed(data.engine);
        ev("workspace_cycle", {
          cycle: cycleRef.current,
          fields: standing(factsRef.current).length,
          engine: data.engine,
          scope: buyingOf(factsRef.current) ?? "undetected",
          from: opts.fromLink ? "link" : "typed",
        });
        if (opts.fromEnter) setInput("");
      } catch {
        setCycleError("The extraction service could not be reached. Your words are kept; press Enter to try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, applyMerge, crewLog],
  );

  /* ---- Voice, real (Robert's pick, 24 Jul; overhauled on his front-door
   * test the same day): the browser's own speech recognition. The mic
   * renders only where the engine exists; the wave marks only GENUINE
   * capture (the listening state waits for the audio channel to open, so
   * the indicator can never claim a microphone that is not yet live); a
   * continuous session survives the natural pause after tapping, one
   * silent no-speech timeout restarts quietly, and the words land in the
   * input as they are heard. A settled final result ends the session on
   * its own and runs the cycle exactly as if typed. Nothing pretends. ---- */
  const [voiceState, setVoiceState] = useState<"idle" | "starting" | "listening">("idle");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  /* The Threshold (25 Jul): the read summary after a paste or drop. */
  const [pasteSummary, setPasteSummary] = useState<string | null>(null);
  const voiceRec = useRef<{ stop: () => void } | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    if (w.SpeechRecognition || w.webkitSpeechRecognition) setVoiceSupported(true);
    return () => { try { voiceRec.current?.stop(); } catch { /* gone */ } };
  }, []);
  const stopVoice = () => {
    try { voiceRec.current?.stop(); } catch { /* already stopped */ }
  };
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
      setInput((finalText + interim).replace(/\s+/g, " ").trim());
      if (settleTimer) clearTimeout(settleTimer);
      if (finalText.trim() && !interim) {
        /* A settled sentence ends the session by itself after a beat. */
        settleTimer = setTimeout(() => { try { rec.stop(); } catch { /* gone */ } }, 1600);
      }
    };
    rec.onerror = (e) => { lastError = e?.error ?? "unknown"; };
    rec.onend = () => {
      opened = true;
      if (watchdog) clearTimeout(watchdog);
      if (settleTimer) clearTimeout(settleTimer);
      const said = finalText.trim();
      /* Silence after the tap is human: restart once, quietly, inside the
       * 30 second window the tap consented to. */
      if (!said && lastError === "no-speech" && restarts < 1 && Date.now() < deadline) {
        restarts += 1;
        try { rec.start(); return; } catch { /* fall through to idle */ }
      }
      setVoiceState("idle");
      voiceRec.current = null;
      if (said.length >= 3) {
        ev("workspace_voice", { chars: said.length });
        void runCycle(said, { fromEnter: true });
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
    /* The watchdog (Harry's Section 1 finding, 28 Jul 2026): a denied or
     * dismissed permission prompt can leave some browsers firing neither
     * onaudiostart nor onend, and the button then read "Opening the
     * microphone" forever. Eight quiet seconds, then back to idle with the
     * blocked-microphone guidance; a browser never re-opens a denied
     * prompt, so honest guidance is the only correct behaviour. */
    watchdog = setTimeout(() => {
      if (opened || voiceRec.current !== rec) return;
      try { rec.stop(); } catch { /* gone */ }
      voiceRec.current = null;
      setVoiceState("idle");
      setVoiceError("The microphone did not open; it may be blocked. Allow it in the address bar, or type instead.");
    }, 8000);
    try { rec.start(); } catch { if (watchdog) clearTimeout(watchdog); setVoiceState("idle"); voiceRec.current = null; }
  };

  /* ---- The Threshold, stage one (25 Jul): a paste or a dropped text file
   * runs through the SAME cycles a sentence runs, chunked on paragraph
   * boundaries, so provenance, guards and receipts hold unchanged. The
   * summary line says honestly what landed, what the Notes kept, and
   * whether the read budget truncated. ---- */
  const ingestText = useCallback(
    async (raw: string, source: "paste" | "drop") => {
      const plan = chunkForIngest(raw);
      if (!plan.chunks.length) return;
      setPasteSummary(null);
      const factsBefore = factsRef.current.filter((f) => !f.struck).length;
      const receiptsBefore = receipts.length;
      ev("workspace_ingest", { source, chunks: plan.chunks.length, chars: plan.readChars, truncated: plan.truncated ? 1 : 0 });
      if (!firstKeyAt.current) firstKeyAt.current = Date.now();
      for (const chunk of plan.chunks) {
        // Sequential on purpose: each cycle merges before the next reads.
        // eslint-disable-next-line no-await-in-loop
        await runCycle(chunk, { fromEnter: true });
      }
      const landed = Math.max(0, factsRef.current.filter((f) => !f.struck).length - factsBefore);
      const kept = Math.max(0, receiptsRef.current.length - receiptsBefore);
      setPasteSummary(ingestSummary(landed, kept, plan));
      crewLog(`Listener: ${ingestSummary(landed, kept, plan)}`, "you");
    },
    [runCycle, crewLog, receipts.length],
  );

  /* ---- The intent blocks and the claimed example (24 Jul): a sector and
   * any goals compose one editable sentence in the input; the ordinary
   * pause-debounce reads it. Make this yours now answers visibly: focus,
   * one amber ring on the call-out, and a worked example as placeholder. */
  const [selSector, setSelSector] = useState<string | null>(null);
  const [selGoals, setSelGoals] = useState<string[]>([]);
  const [yoursHint, setYoursHint] = useState(false);
  const [yoursRing, setYoursRing] = useState(false);
  const tapSector = (label: string) => {
    const next = selSector === label ? null : label;
    setSelSector(next);
    setInput(next || selGoals.length ? composeIntent(next, selGoals) : "");
    if (!firstKeyAt.current) firstKeyAt.current = Date.now();
    ev("workspace_intent_chip", { kind: "sector", label });
    inputRef.current?.focus();
  };
  const tapGoal = (label: string) => {
    const next = selGoals.includes(label) ? selGoals.filter((g) => g !== label) : [...selGoals, label];
    setSelGoals(next);
    setInput(selSector || next.length ? composeIntent(selSector, next) : "");
    if (!firstKeyAt.current) firstKeyAt.current = Date.now();
    ev("workspace_intent_chip", { kind: "goal", label });
    inputRef.current?.focus();
  };
  const makeThisYours = () => {
    ev("workspace_make_yours", {});
    setYoursHint(true);
    setYoursRing(true);
    setTimeout(() => setYoursRing(false), 1500);
    inputRef.current?.focus();
  };

  /* ---- Debounce per pause ---- */
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const text = input.trim();
    if (text.length < 12 || text === lastRunText.current) return;
    debounceTimer.current = setTimeout(() => void runCycle(input), 900);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [input, runCycle]);

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
      crewLog(`Assessor: ${v.rulebookVersion} recomputed · confidence ${v.confidence} · ${v.summary.recommended.length} required`);
      if (!firstVerdictSent.current && firstKeyAt.current) {
        firstVerdictSent.current = true;
        ev("workspace_first_verdict", { ms: Date.now() - firstKeyAt.current, confidence: v.confidence });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirement, securityScope, live.length]);

  /* ---- Fit (evidence-dated, the same organ) ---- */
  const sseSignal = Boolean(
    verdict?.capabilities.some((c) => c.id === "sse" && (c.needed === "required" || c.needed === "recommended")) ||
      verdict?.pathRecommendation === "escalate_sase",
  );
  const fitBuying: string | null = !started ? null : buying && buying !== "managed_security" ? buying : sseSignal ? "sse" : "managed_security";
  const fitParams = useMemo(() => {
    if (!fitBuying) return null;
    const regions = (requirement.organisation?.regions ?? []).join(".");
    // P3.3: the requirement specifics the dataset genuinely grades become
    // named checks; noted items with a want id re-rank the market for real.
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
          if (!d || !d.ok) return;
          setFit(d as FitState);

          /* Article 14: movement only ever renders with its truthful reason.
             A supplier is a MOVER only when its own reality against the
             requirement changed (a check it matches or misses was added or
             withdrawn); suppliers displaced by others' movement carry no
             marker, because nothing about them changed. First result is the
             baseline: an initial layout is not a movement. */
          if (d.mode === "graded") {
            const newOrder = d.suppliers.map((s) => s.slug);
            const newMatched = new Map(d.suppliers.map((s) => [s.slug, new Set(s.matched.map((m) => m.id))]));
            const newCheckIds = new Set((d.checks ?? []).map((c) => c.id));
            const prev = prevFitRef.current;
            if (prev) {
              const addedChecks = [...newCheckIds].filter((id) => !prev.checkIds.has(id));
              const removedChecks = [...prev.checkIds].filter((id) => !newCheckIds.has(id));
              if (addedChecks.length || removedChecks.length) {
                const nowMoves: Record<string, Move> = {};
                const log: MoveLogEntry[] = [];
                let evidencedQuietly = 0;
                for (const s of d.suppliers) {
                  const gained = s.matched.filter((m) => addedChecks.includes(m.id));
                  const failed = s.missed.filter((m) => addedChecks.includes(m.id));
                  const lost = [...(prev.matched.get(s.slug) ?? [])].filter((id) => removedChecks.includes(id));
                  if (!gained.length && !failed.length && !lost.length) continue;
                  const pRank = prev.order.indexOf(s.slug);
                  const nRank = newOrder.indexOf(s.slug);
                  const delta = pRank < 0 ? 0 : pRank - nRank;
                  const ev = failed[0] ?? gained[0];
                  const dir: Move["dir"] = delta > 0 ? "up" : delta < 0 ? "down" : "hold";
                  // A hold with the new check simply evidenced is not a
                  // movement: it stays quiet per row (the crew states the
                  // aggregate once). A hold that MISSES the new check is
                  // signal and renders.
                  if (dir === "hold" && !failed.length && !lost.length) {
                    evidencedQuietly += 1;
                    continue;
                  }
                  // F-E: a withdrawal names WHAT was withdrawn (Article 14:
                  // "requirement withdrawn" is not an explanation; "UK-based
                  // support desk no longer required" is).
                  const withdrawnLabel = !ev && lost.length ? (prev.checkLabels.get(lost[0]) ?? "a requirement") : null;
                  nowMoves[s.slug] = {
                    dir,
                    places: Math.abs(delta),
                    label: ev ? ev.label : withdrawnLabel ?? "a requirement",
                    grade: ev ? ev.grade : "",
                    date: s.last_verified,
                  };
                  log.push({ slug: s.slug, at: stamp(), dir, text: ev ? `${ev.label}: ${gradeWord(ev.grade)}` : `${withdrawnLabel ?? "a requirement"}: no longer required` });
                }
                setMoveNow(nowMoves);
                if (log.length) setMoveLog((l) => [...l, ...log].slice(-40));
                const riser = d.suppliers.find((s) => nowMoves[s.slug]?.dir === "up");
                const faller = d.suppliers.find((s) => nowMoves[s.slug]?.dir === "down");
                if (riser) {
                  const m = nowMoves[riser.slug];
                  crewLog(`Scout: ${riser.name} rises · ${m.label} ${gradeWord(m.grade)} · evaluated ${fmtDate(riser.last_verified)}`);
                }
                if (faller) {
                  const m = nowMoves[faller.slug];
                  crewLog(`Scout: ${faller.name} falls · ${m.label} ${gradeWord(m.grade)}`);
                }
                if (!riser && !faller && addedChecks.length && evidencedQuietly > 0) {
                  // The quiet day, stated plainly: the check ran and the
                  // order genuinely stood.
                  const label = (d.checks ?? []).find((c) => c.id === addedChecks[0])?.label ?? "the new requirement";
                  crewLog(`Scout: ${label} checked · ${evidencedQuietly} vendors and service providers evidence it · the order stands`);
                }
              }
            } else {
              crewLog(`Scout: ${d.count} of ${d.total} evaluated vendors and service providers fit this scope · order is evidence against your checks`);
            }
            prevFitRef.current = {
              order: newOrder,
              matched: newMatched,
              checkIds: newCheckIds,
              checkLabels: new Map((d.checks ?? []).map((c) => [c.id, c.label])),
            };
          }
        })
        .catch(() => {});
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitParams]);

  /* ---- Save-lite trigger ---- */
  // The desk must actually KNOW whether the visitor is signed in (Harry,
  // 24 July 2026: this flag was declared and checked but never set, so
  // the save prompt asked an already-verified buyer to sign in again,
  // straight after the signature, below a Crew log saying the notice was
  // live). One session read on mount wires it to the truth.
  useEffect(() => {
    fetch("/sase/api/auth/session")
      .then((r) => r.json())
      .then((d: { authenticated?: boolean; email?: string; work_address?: boolean; company_hint?: string | null }) => {
        setSignedIn(Boolean(d?.authenticated));
        setSessId(d?.authenticated ? { email: d.email ?? "", work: Boolean(d.work_address), company: d.company_hint ?? null } : null);
      })
      .catch(() => {});
  }, []);
  /* The save-lite prompt stood here and is gone with R2. It asked for an
     email in the middle of the work, which is the "give us your address
     and we will give you the value" pitch Robert banned outright. The
     work email is now the signature inside the publish act and nowhere
     else. */

  /* ---- Corrections: strike, answer, click ---- */
  const toggleFact = useCallback(
    (id: string) => {
      const f = factsRef.current.find((x) => x.id === id);
      factsRef.current = factsRef.current.map((x) => (x.id === id ? { ...x, struck: !x.struck } : x));
      setFacts(factsRef.current);
      if (f && !f.struck) crewLog(`Registrar: struck out: ${factLabel(f).slice(0, 40)} · dependants recompute`, "you");
      if (f) ev("workspace_fact_struck", { path: f.path, provenance: f.provenance, undo: f.struck ? "1" : "0" });
    },
    [crewLog],
  );

  const answerGap = useCallback(
    (gap: BriefGap, value: string, label?: string) => {
      if (!gap.path) return;
      const v = gap.control === "number" ? Number(value) : value;
      if (gap.control === "number" && (!Number.isFinite(v as number) || (v as number) < 0)) return;
      applyMerge([{ path: gap.path as AllowedPath, value: v, provenance: "stated", quote: label ?? String(value) }], "answer");
      crewLog(`Listener: your answer, in your words: "${label ?? String(value)}"`, "you");
      ev("workspace_gap_answered", { field: gap.key });
    },
    [applyMerge, crewLog],
  );

  /** A click on a framework item IS a stated fact (13.3). Pathed items land
   *  in the ledger; unpathed items are recorded as stated notes (13.5),
   *  never silently dropped, never pretending to feed the engine. */
  const clickItem = useCallback(
    (item: TaxonomyItem, sectionKey: string) => {
      if (published) return;
      if (item.path) {
        const id = factId(item.path, item.value);
        const existing = factsRef.current.find((f) => f.id === id && (item.value === undefined || String(f.value) === String(item.value)));
        if (existing && !existing.struck && String(existing.value) === String(item.value ?? existing.value)) {
          toggleFact(existing.id);
          return;
        }
        applyMerge([{ path: item.path, value: item.value, provenance: "stated", quote: item.label }], "answer");
        crewLog(`Listener: you chose this: ${item.label}`, "you");
        ev("workspace_item_clicked", { path: item.path, value: String(item.value) });
        return;
      }
      setNoted((ns) => {
        const has = ns.some((n) => n.id === item.id);
        if (has) {
          crewLog(`Registrar: removed from your notes: ${item.label}`, "you");
          return ns.filter((n) => n.id !== item.id);
        }
        crewLog(`Listener: you chose this: ${item.label} · kept with your position as a stated note`, "you");
        ev("workspace_item_noted", { item: item.id });
        return [...ns, { id: item.id, label: item.label, section: sectionKey }];
      });
    },
    [published, applyMerge, crewLog, toggleFact],
  );

  /** Remove a note the buyer placed (their own words, or an answer to a
   *  question that had no ledger home). One tap, same as a strike. */
  const removeNote = useCallback(
    (id: string) => {
      if (published) return;
      const n = notedRef.current.find((x) => x.id === id);
      setNoted((ns) => ns.filter((x) => x.id !== id));
      if (n) crewLog(`Registrar: removed from your notes: ${n.label.slice(0, 60)}`, "you");
    },
    [published, crewLog],
  );

  useEffect(() => { receiptsRef.current = receipts; }, [receipts]);

  const dismissReceipt = useCallback((id: number) => {
    setReceipts((rs) => rs.filter((r) => r.id !== id));
  }, []);

  /** Undo the last machine pass (F2). Only reachable while the ledger is
   *  byte-for-byte the array that pass produced; the strip hides itself
   *  the moment anything else touches the facts. */
  const undoPass = () => {
    const u = lastPass;
    if (!u || busy || facts !== u.factsAtSet) return;
    factsRef.current = u.prevFacts;
    setFacts(u.prevFacts);
    setLastPass(null);
    setPassLog((l) => (l.length ? [{ ...l[0], undone: true }, ...l.slice(1)] : l));
    crewLog(`Registrar: undone · this pass's ${u.changes.length} change${u.changes.length === 1 ? "" : "s"} reverted, your words stay yours to re-run`, "em");
    ev("workspace_pass_undone", { changes: u.changes.length });
  };

  /* ---- The rail's sub-steps: the core five (R7) and nothing else.
          Every tick is a fact standing in the ledger, so the percentage
          the rail prints can only move when the requirement moves. ---- */
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
  /** What a notice still needs, in the buyer's language, for the footers. */
  const missingCore = useMemo(() => {
    const out: string[] = [];
    if (!coreFive.sector) out.push("your sector");
    if (!coreFive.sites) out.push("how many sites");
    if (!coreFive.regions) out.push("which regions");
    if (!coreFive.scope) out.push("what you are buying");
    if (!coreFive.timeline) out.push("your timeline");
    return out;
  }, [coreFive]);

  /* ---- Fit sets, pins, readiness ---- */
  const fitSlugs = (fit?.mode === "graded" ? fit.suppliers.map((s) => s.slug) : []).filter((s) => !removed.includes(s));
  const shownFit = new Set([...fitSlugs, ...added].slice(0, 8));
  const pins = [...new Set([...added, ...fitSlugs])].slice(0, 5);
  const unansweredGaps = brief.openGaps;

  /* What publishing generated: the SAME fit engine, in its own ranked
   * order, with the reason each supplier is in. Pre-publish this order is
   * the half of the coke the buyer does not drink (R1b); once published it
   * is the thing they published to get. Exclusions the buyer made are
   * honoured here exactly as they are in the invite list. */
  const payoutRows = useMemo(() => {
    const invited = new Set(published?.invited ?? []);
    return (fit?.mode === "graded" ? fit.suppliers : [])
      .filter((sup) => !removed.includes(sup.slug))
      .map((sup) => ({
        slug: sup.slug,
        name: sup.name,
        category: sup.category,
        graded: sup.last_verified,
        invited: invited.has(sup.slug),
        matched: sup.matched.map((m) => m.label),
        missed: sup.missed.map((m) => m.label),
        yes: sup.yes_count,
      }));
  }, [fit, removed, published]);

  /* The suppliers your requirement reaches, A to Z (R1b): named, with
   * the date each record was graded, and nothing that implies an order.
   * A pinned supplier the fit set never reached still belongs here,
   * because the buyer put it there. */
  const clusterRows = useMemo(() => {
    const byMarket = new Map((market?.vendors ?? []).map((v) => [v.slug, v]));
    const rows = new Map<string, { slug: string; name: string; category: string; graded: string; pinned: boolean }>();
    for (const sup of fit?.mode === "graded" ? fit.suppliers : []) {
      if (removed.includes(sup.slug)) continue;
      rows.set(sup.slug, {
        slug: sup.slug, name: sup.name, category: sup.category,
        graded: sup.last_verified, pinned: added.includes(sup.slug),
      });
    }
    for (const slug of added) {
      if (rows.has(slug) || removed.includes(slug)) continue;
      const v = byMarket.get(slug);
      if (v) rows.set(slug, { slug, name: v.name, category: v.category, graded: v.last_verified, pinned: true });
    }
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [fit, market, added, removed]);

  /* ---- The instrument ladder (the consolidation, wave two): the
          position's covered areas summon their question set from the
          curated bank; priorities and a commercial claim earn the full
          RFP. All derived, all fixtured in validate-instruments. ---- */
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
        prioritiesSet: weights.length,
        commercialClaims,
      }),
    [started, live.length, unansweredGaps.length, rfiSet, weights.length, commercialClaims],
  );
  const instrument = earnedInstrument(instrumentLadder);

  /* R7 MADE REAL (Robert's ruling; Harry's round two, 30 Jul 2026). He
   * stripped a project back to almost nothing, saw 14 per cent and 1 of 7
   * filled, and still found "Published" sitting in the stage list with no
   * distinction, so the page read as somewhere between not ready and
   * published at once. The five details a notice cannot publish without
   * now genuinely hold the signature shut, and the refusal names them.
   * Safe to enforce only since the timeline question became earnable by
   * every project earlier today; before that this would have locked out
   * anyone who never mentioned a renewal. */
  const coreFiveComplete = missingCore.length === 0;
  const signLocked =
    !started || facts.length === 0 || Boolean(published) || !coreFiveComplete || (securityScope && (!verdict || verdict.confidence === "low")) || (!securityScope && !buying);
  const lockReason = !started
    ? null
    : facts.length === 0
      ? "Selections alone are notes so far: say one sentence about the organisation and the engine takes over."
      : !coreFiveComplete
        ? `A notice cannot publish without five details, and ${missingCore.length} ${missingCore.length === 1 ? "is" : "are"} still open: ${missingCore.join(", ")}. Say it in the box at the top, or answer the open questions on the document.`
        : securityScope && verdict?.confidence === "low"
          ? "Answer the open questions on the position first: nothing is recorded on guesswork."
          : null;
  const consentsOk = securityScope ? consentCreate && consentPublish && (unansweredGaps.length === 0 || consentGaps) : consentCreate;
  const ready = !signLocked && started && (securityScope ? Boolean(verdict) : true);
  /* The publish bar names the first real lock in the gate's own order;
   * it never invents a percentage (the conversion pass, 23 Jul). */
  const publishBarLock =
    facts.length === 0
      ? "Say one sentence about the organisation and publishing unlocks."
      : !coreFiveComplete
        ? `Still open before you can publish: ${missingCore.join(", ")}.`
      : securityScope && (!verdict || verdict.confidence === "low")
        ? "Answer the open questions on the position first: nothing publishes on guesswork."
        : !securityScope && !buying
          ? "Choose what you are buying (SASE, SD-WAN, SSE or managed security) and publishing unlocks."
          : "It unlocks when the position holds enough truth to stand on.";

  /* ---- The rail (P1): three steps, seven ticks, no formula. Sub-steps
          come straight from coreFive; steps two and three each hold the
          one real thing that can happen there. ---- */
  const railSteps: RailStep[] = useMemo(
    () => [
      {
        id: 1,
        title: "Your requirement",
        detail: "One sentence starts it. The details below fill themselves from your words, and you can correct any of them.",
        checks: [
          { id: "sentence", label: "Your project, in your own words", done: facts.length > 0 },
          { id: "sector", label: "Sector", done: coreFive.sector, goesTo: "sec-organisation" },
          { id: "sites", label: "Sites and regions", done: coreFive.sites && coreFive.regions, goesTo: "sec-organisation" },
          { id: "scope", label: "Scope", done: coreFive.scope, goesTo: "sec-objectives" },
          { id: "timeline", label: "Timeline", done: coreFive.timeline, goesTo: "sec-commercial" },
        ],
      },
      {
        id: 2,
        title: "Who fits",
        detail: "The evaluated vendors and service providers your requirement reaches, named, with the date each record was graded.",
        checks: [{ id: "matched", label: "Vendors matched to your requirement", done: clusterRows.length > 0 }],
      },
      {
        id: 3,
        title: "Generate and publish",
        /* The detail carries the gate, so a stripped-back project cannot
           read as though publishing is one click away (Harry, round two). */
        detail: published
          ? "Live on the board. Your shortlist and the responses are below."
          : missingCore.length > 0
            ? `Not available yet. A notice needs five details and ${missingCore.length} ${missingCore.length === 1 ? "is" : "are"} still open: ${missingCore.join(", ")}.`
            : "Publishing generates the shortlist, the price band and your document, and posts your notice anonymously.",
        checks: [{ id: "published", label: published ? "Published" : "Not published yet", done: Boolean(published) }],
      },
    ],
    [facts.length, coreFive, clusterRows.length, published, missingCore],
  );
  const goToStep = useCallback((id: RailStepId) => {
    setStep(id);
    setMaxStep((m) => (id > m ? id : m));
    ev("journey_step", { to: id });
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* scrolling is a courtesy */ }
  }, []);
  /* A publish is the exit, so the desk shows the step the result lives on
   * whichever step the buyer signed from. Derived, not pushed: an effect
   * that set state after publish would re-render for no reason and read
   * as two sources of truth for one fact. */
  const shownStep: RailStepId = published ? 3 : step;

  /* ---- The artefact, with the notes appended honestly ---- */
  const artefactText = useCallback(() => {
    let text = briefText(brief);
    const chosen = noted.filter((n) => !n.own);
    const inTheirWords = noted.filter((n) => n.own);
    if (chosen.length) {
      text += `\n\n## Buyer selections (structured fields pending)\n${chosen.map((n) => `- ${n.label} [stated by selection]`).join("\n")}`;
    }
    if (inTheirWords.length) {
      text += `\n\n## In the buyer's own words (kept verbatim)\n${inTheirWords.map((n) => `- "${n.label}" [stated]`).join("\n")}`;
    }
    if (receipts.length) {
      text += `\n\n## Notes, unplaced (kept verbatim)\n${receipts.map((r) => `- "${r.text}"`).join("\n")}`;
    }
    /* Wave two: the artefact IS the instrument. The ladder's states, the
       summoned question set verbatim from the bank, and the buyer's own
       priorities print with the position. */
    if (instrumentLadder) {
      text += `\n\n## Instrument\n- Statement of Requirements: live\n- RFI: ${instrumentLadder.rfi.note}\n- Full RFP: ${instrumentLadder.rfp.note}`;
      if (rfiSet && instrumentLadder.rfi.state === "ready") {
        text += `\n\n## RFI question set · bank v${rfiSet.version} · ${rfiSet.total} questions`;
        for (const c of rfiSet.canonical) {
          text += `\n\n### ${c.category}\n${c.questions.map((q) => `- ${q.text}`).join("\n")}`;
        }
        if (rfiSet.sectorPack) {
          text += `\n\n### ${rfiSet.sectorPack.label} pack · ${rfiSet.sectorPack.count} questions\n${rfiSet.sectorPack.sections.map((s) => `- ${s}`).join("\n")}`;
        }
      }
      if (weights.length) {
        text += `\n\n## Scoring priorities (weighted high)\n${weights.map((k) => `- ${sectionTitle(k, TAXONOMY.find((s) => s.key === k)?.title ?? k)}`).join("\n")}`;
      }
    }
    return text;
  }, [brief, noted, receipts, instrumentLadder, rfiSet, weights]);

  /* ---- The signature chain (identical organs to W0/P2) ---- */
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
            body: JSON.stringify({ requirement, consent: true, preferred_vendors: pins, ...(customTitle.trim() ? { custom_title: customTitle.trim() } : {}), ...(testMode ? { test: true } : {}) }),
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
            /* Wave two: the earned instrument declares itself to suppliers,
               verbatim from the same derivation the rail renders. */
            instrumentNotesLine({
              instrument,
              set: rfiSet,
              weightedHigh: weights.map((k) => TAXONOMY.find((s) => s.key === k)?.title ?? k),
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
              /* The bank-set bridge (Robert's ruling, 28 Jul 2026): the desk
                 names which sections hold standing claims; the server
                 re-derives the earned question set through the same pure
                 rulebook, so the published document carries what the RFI
                 chip promised. Names only, never question content. */
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
        crewLog("Registrar: consent recorded verbatim · the position is on the record", "em");
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
          // F3: the buyer's exclusions ride the publish; the server's ranked
          // fill honours them and backfills from the next best evidenced.
          ...(removed.length ? { excluded_vendors: removed.slice(0, 40) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const invited: string[] = Array.isArray(data.invited) ? data.invited.map((i: { slug: string }) => i.slug) : [];
        ev("board_listed", { board_id: data.board?.opportunity_id ?? "" });
        setPublished({ invited, boardId: data.board?.opportunity_id });
        setNeedAuth(false);
        // Harry's 22 Jul finding: your own publish is a real event, so the
        // market's notice count must move with it. Refetch past the cache.
        fetch("/sase/api/workspace/market", { cache: "reload" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d: Market | null) => { if (d) setMarket(d); })
          .catch(() => {});
        crewLog(`Registrar: signature recorded, verbatim · notice live on the board`, "em");
        crewLog(`Scout: ${invited.length} vendor${invited.length === 1 ? "" : "s"} invited directly · responses arrive against your position`);
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

  const startAfresh = () => {
    /* Nothing to clear (R2): a reload IS a fresh desk. */
    window.location.assign(window.location.pathname);
  };

  /* ------------------------------------------------------------------ */
  /* Desk derivations                                                    */
  /* ------------------------------------------------------------------ */

  const factsBySection = useMemo(() => {
    const map = new Map<string, WorkspaceFact[]>();
    for (const f of facts) {
      const s = sectionForPath(f.path);
      map.set(s, [...(map.get(s) ?? []), f]);
    }
    return map;
  }, [facts]);

  const gapsBySection = useMemo(() => {
    const map = new Map<string, BriefGap[]>();
    for (const g of unansweredGaps) {
      const s = sectionForGapKey(g.key);
      map.set(s, [...(map.get(s) ?? []), g]);
    }
    return map;
  }, [unansweredGaps]);

  /* ---- P3.4: the earned questions (13.14/13.16). The desk shows at most
     two at once (minimum necessary); weight decides which two. ---- */
  /* The buyer's own words, for pack flavour detection only (conservative:
     example content never reaches this, so the example never wears NHS). */
  const corpus = useMemo(
    () =>
      [
        customTitle,
        ...facts.filter((f) => !f.struck).flatMap((f) => [f.quote ?? "", f.reason ?? "", String(f.value ?? "")]),
        ...receipts.map((r) => r.text),
      ].join(" "),
    [facts, receipts, customTitle],
  );

  /* ---- The sector pack (24 Jul): unlocked by the standing sector fact,
     influence everywhere, authority nowhere. The pack law is fixtured:
     packs never write facts; only the buyer's touch or words do. ---- */
  const pack = useMemo(() => activePack(requirement), [requirement]);
  const packFlavours = useMemo(() => (pack ? activeFlavours(pack, corpus) : []), [pack, corpus]);
  const packSugs = useMemo(
    () => (pack ? visibleSuggestions(pack, packFlavours, facts, noted.map((n) => n.id), declinedSug) : []),
    [pack, packFlavours, facts, noted, declinedSug],
  );
  const packSugsBySection = useMemo(() => {
    const map = new Map<string, PackSuggestion[]>();
    for (const sg of packSugs) map.set(sg.section, [...(map.get(sg.section) ?? []), sg]);
    return map;
  }, [packSugs]);
  const packDeclinedBySection = useMemo(() => {
    const map = new Map<string, PackSuggestion[]>();
    if (!pack) return map;
    for (const sg of declinedOnRecord(pack, packFlavours, declinedSug)) map.set(sg.section, [...(map.get(sg.section) ?? []), sg]);
    return map;
  }, [pack, packFlavours, declinedSug]);
  const packNotes = useMemo(() => (pack ? packRiskNotes(pack, packFlavours) : []), [pack, packFlavours]);

  const earnedShown = useMemo(() => {
    const notedIds = noted.map((n) => n.id);
    return earnedQuestions(requirement, buying, opModel, notedIds, dismissedQ, corpus).slice(0, 2);
  }, [requirement, buying, opModel, noted, dismissedQ, corpus]);
  const earnedBySection = useMemo(() => {
    const map = new Map<string, EarnedQuestion[]>();
    for (const q of earnedShown) map.set(q.section, [...(map.get(q.section) ?? []), q]);
    return map;
  }, [earnedShown]);
  /** Readiness (the reference concept, live): open questions are the real
   *  gaps plus the earned questions currently standing, nothing invented. */
  const openQuestionCount = unansweredGaps.length + earnedShown.length;


  const answerEarned = useCallback(
    (q: EarnedQuestion, answer: QuestionAnswer, value?: string) => {
      if (answer.kind === "items") {
        for (const id of answer.itemIds) {
          const e = ITEM_BY_ID[id];
          if (e) clickItem(e.item, e.section);
        }
      } else if (answer.kind === "note") {
        setNoted((ns) => (ns.some((n) => n.id === `qn-${q.id}`) ? ns : [...ns, { id: `qn-${q.id}`, label: answer.text, section: q.section }]));
        crewLog(`Listener: your answer, kept with your position: ${answer.text}`, "you");
      } else if (answer.kind === "path" && value && value.trim()) {
        applyMerge([{ path: answer.path, value: value.trim(), provenance: "stated", quote: value.trim() }], "answer");
        crewLog(`Listener: your answer, in your words: "${value.trim()}"`, "you");
      }
      setDismissedQ((d) => (d.includes(q.id) ? d : [...d, q.id]));
      ev("workspace_earned_answered", { q: q.id, kind: answer.kind });
    },
    [clickItem, applyMerge, crewLog],
  );

  /* ---- 1f: answer in your own words. The list is never the only way
     through. Where the open question in a section has a ledger home for
     free text, the typed words land there as a stated fact and the quote
     IS the buyer's sentence. Where it has none, the words are kept
     verbatim as a stated note in that section, the same receipt rule the
     desk already runs, and the technical wording sits beneath them. ---- */
  const ownWordsBySection = useMemo(() => {
    const map = new Map<string, { question: string; placeholder: string; q: EarnedQuestion; answer: QuestionAnswer }>();
    for (const q of earnedShown) {
      if (map.has(q.section)) continue;
      const opt = q.options.find((o) => o.answer.kind === "path");
      if (!opt || opt.answer.kind !== "path") continue;
      map.set(q.section, { question: q.question, placeholder: opt.answer.placeholder, q, answer: opt.answer });
    }
    return map;
  }, [earnedShown]);

  const answerInOwnWords = useCallback(
    (sectionKey: string, text: string) => {
      const words = text.trim();
      if (!words || published) return;
      const target = ownWordsBySection.get(sectionKey);
      if (target) {
        answerEarned(target.q, target.answer, words);
      } else {
        const id = `own-${++ownWordsId.current}`;
        setNoted((ns) => [...ns, { id, label: words, section: sectionKey, own: true }]);
        crewLog(`Listener: your answer, in your words: "${words}"`, "you");
      }
      ev("workspace_own_words", { section: sectionKey, routed: target ? "field" : "note" });
    },
    [published, ownWordsBySection, answerEarned, crewLog],
  );

  /** One tap on one candidate line, whatever kind of answer it carries.
   *  Every route is the desk's existing machinery, unchanged. */
  const runCandidate = useCallback(
    (a: CandAction, sectionKey: string) => {
      if (a.kind === "item") clickItem(a.item, sectionKey);
      else if (a.kind === "gap") answerGap(a.gap, a.value, a.label);
      else if (a.kind === "earned") answerEarned(a.q, a.answer);
      else removeNote(a.id);
    },
    [clickItem, answerGap, answerEarned, removeNote],
  );

  const dismissQuestion = useCallback((id: string) => {
    setDismissedQ((d) => (d.includes(id) ? d : [...d, id]));
    ev("workspace_earned_dismissed", { q: id });
  }, []);

  /* Accepting a suggestion lands through the SAME machinery an earned
     question uses (the buyer's touch, never the pack's hand); declining is
     permanent and stays on the record. */
  const acceptSuggestion = useCallback(
    (sg: PackSuggestion) => {
      if (sg.accept.kind === "items") {
        for (const id of sg.accept.itemIds) {
          const e = ITEM_BY_ID[id];
          if (e) clickItem(e.item, e.section);
        }
      } else {
        setNoted((ns) => (ns.some((n) => n.id === `ps-${sg.id}`) ? ns : [...ns, { id: `ps-${sg.id}`, label: sg.accept.kind === "note" ? sg.accept.text : sg.label, section: sg.section }]));
      }
      crewLog(`Sector pack: added on your acceptance: ${sg.label} (${sg.reason})`, "you");
      ev("workspace_pack_suggestion", { id: sg.id, verdict: "accepted" });
    },
    [clickItem, crewLog],
  );
  const declineSuggestion = useCallback(
    (sg: PackSuggestion) => {
      setDeclinedSug((d) => (d.includes(sg.id) ? d : [...d, sg.id]));
      crewLog(`Sector pack: declined, kept on the record: ${sg.label}`, "you");
      ev("workspace_pack_suggestion", { id: sg.id, verdict: "declined" });
    },
    [crewLog],
  );

  const notedBySection = useMemo(() => {
    const map = new Map<string, NotedItem[]>();
    for (const n of noted) map.set(n.section, [...(map.get(n.section) ?? []), n]);
    return map;
  }, [noted]);

  /** The areas (slice four): one derived state per section from actual
   *  position data (the fixtured derivation), never presentation logic. */
  const areaStates = useMemo(() => {
    return TAXONOMY.map((sec) => {
      const secFacts = factsBySection.get(sec.key) ?? [];
      const oq = (gapsBySection.get(sec.key)?.length ?? 0) + (earnedBySection.get(sec.key)?.length ?? 0);
      const notedN = (notedBySection.get(sec.key) ?? []).length;
      const base = deriveAreaState({ facts: secFacts, openQuestions: oq, noted: notedN });
      const state = refineConfirmed(sec.key, base, secFacts);
      const standingN = secFacts.filter((f) => !f.struck).length;
      const latestCycle = secFacts.reduce((m, f) => Math.max(m, f.cycle ?? 0), 0);
      return { key: sec.key, title: sectionTitle(sec.key, sec.title), state, standingN, openQ: oq, notedN, latestCycle };
    });
  }, [factsBySection, gapsBySection, earnedBySection, notedBySection]);
  const [areaDetail, setAreaDetail] = useState<string | null>(null);

  const sectionLive = useCallback(
    (key: string) =>
      (factsBySection.get(key)?.length ?? 0) > 0 ||
      (notedBySection.get(key)?.length ?? 0) > 0 ||
      (gapsBySection.get(key)?.length ?? 0) > 0,
    [factsBySection, notedBySection, gapsBySection],
  );

  /* Micro-reactivity (the conversion pass, 23 Jul): when a section first
   * turns live (example ink giving way to stated or inferred), one amber
   * ring breathes out around it, once. The first computation only records
   * the baseline, so an arrival never fires a page of rings. */
  const prevLiveRef = useRef<Set<string> | null>(null);
  const [liveRing, setLiveRing] = useState<Set<string>>(() => new Set());
  const ringTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const now = new Set(TAXONOMY.filter((s) => sectionLive(s.key)).map((s) => s.key));
    if (prevLiveRef.current === null) {
      prevLiveRef.current = now;
      return;
    }
    const prev = prevLiveRef.current;
    const fresh = [...now].filter((k) => !prev.has(k));
    prevLiveRef.current = now;
    if (!fresh.length) return;
    setLiveRing((s) => new Set([...s, ...fresh]));
    const t = setTimeout(() => {
      setLiveRing((s) => {
        const n = new Set(s);
        for (const k of fresh) n.delete(k);
        return n;
      });
    }, 1500);
    ringTimers.current.push(t);
  }, [sectionLive]);
  useEffect(() => () => { for (const t of ringTimers.current) clearTimeout(t); }, []);

  const factFor = useCallback(
    (item: TaxonomyItem): WorkspaceFact | undefined => {
      if (!item.path) return undefined;
      const id = factId(item.path, item.value);
      return facts.find((f) => f.id === id && String(f.value) === String(item.value));
    },
    [facts],
  );

  /** 1b: the buyer's sector family, from the sector fact standing in the
   *  ledger. No sector, no ranking claim: the list stays in taxonomy order
   *  rather than pretending to know what is likely. */
  const sectorFamily = useMemo(() => {
    const s = facts.find((f) => !f.struck && f.path === "organisation.sector");
    if (!s) return null;
    return SECTOR_FAMILIES.find((fam) => fam.match.test(String(s.value))) ?? null;
  }, [facts]);

  /** Taxonomy item ids, for telling an item's note from a typed answer. */
  const taxonomyItemIds = useMemo(() => new Set(Object.keys(ITEM_BY_ID)), []);

  /* Market rows: order is fit (13.7 within today's honest coarseness). */
  const marketRows = useMemo(() => {
    const vendors = market?.vendors ?? [];
    const latest = market?.latest_evaluation ?? "";
    const byS = new Map(vendors.map((v) => [v.slug, v]));
    const ordered: MarketVendor[] = [];
    // Post-publish, invited suppliers float into view first (Harry's 22 Jul
    // check: "8 invited" must be verifiable without scrolling).
    for (const s of published?.invited ?? []) {
      const v = byS.get(s);
      if (v) { ordered.push(v); byS.delete(s); }
    }
    for (const s of fitSlugs) {
      const v = byS.get(s);
      if (v) { ordered.push(v); byS.delete(s); }
    }
    for (const s of added) {
      const v = byS.get(s);
      if (v) { ordered.push(v); byS.delete(s); }
    }
    const rest = [...byS.values()].sort((a, b) => (a.last_verified < b.last_verified ? 1 : -1));
    const all = [...ordered, ...rest];
    return { all, shown: all.slice(0, 12), latest, more: Math.max(0, all.length - 12) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, fitSlugs.join(","), added, published]);

  const invitedSet = new Set(published?.invited ?? []);

  /* The Netify SASE Constellation (Robert, 23 Jul: promoted to a named
   * band on the main page). Geometry and colour are pure and shared with
   * the fixtures: angle is a stable function of the slug (movement is
   * radial only, Article 14), distance is fit rank when named checks
   * exist, one honest ring before; colour follows the vendor, never its
   * rank, from the validated palette that keeps amber (the market,
   * invited) and emerald (advice) reserved. Capability nodes are the
   * buyer's own named checks; evidence lines exist only where the dataset
   * grades them. Ink recency, amber and breath stay this component's
   * channels. */
  const SCENE = { w: 760, h: 440, cx: 380, cy: 210 };
  const sceneRanked = Boolean(started && fitBuying && fitSlugs.length > 0);
  const sceneBodies = useMemo(() => {
    const items = marketRows.shown.map((v) => {
      const idx = fitSlugs.indexOf(v.slug);
      return { slug: v.slug, rank: sceneRanked && idx >= 0 ? idx : null };
    });
    return constellation(items, sceneRanked, SCENE.cx, SCENE.cy, 34, BAND);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketRows, sceneRanked, fitSlugs.join(",")]);
  const fitBySlug = useMemo(
    () => new Map((fit?.suppliers ?? []).map((s) => [s.slug, s])),
    [fit],
  );
  /** The buyer's named checks as capability nodes on the inner ring. */
  const capNodes = useMemo(
    () => capabilityRing(sceneRanked ? fit?.checks ?? [] : [], SCENE.cx, SCENE.cy, 92, 0.78),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sceneRanked, fit],
  );
  const capById = useMemo(() => new Map(capNodes.map((c) => [c.id, c])), [capNodes]);
  /** Names are the identity, so they may never overlap anything: one
   *  deterministic pass where every label (vendor and capability) avoids
   *  every other label AND every body, diamond and the centre. Bodies
   *  never move for labels: positions are the truth, names the furniture. */
  const sceneLabels = useMemo(() => {
    const byS = new Map(marketRows.shown.map((v) => [v.slug, v]));
    const obstacles = [
      { id: "__you", x: SCENE.cx, y: SCENE.cy, half: 12 },
      ...sceneBodies.map((b) => ({ id: b.slug, x: b.x, y: b.y, half: 9 })),
      ...capNodes.map((c) => ({ id: c.id, x: c.x, y: c.y, half: 6 })),
    ];
    const capItems = capNodes.map((c) => {
      const above = c.y <= SCENE.cy;
      const label = c.label.length > 30 ? `${c.label.slice(0, 29)}…` : c.label;
      return { slug: c.id, x: c.x, y: above ? c.y - 11 : c.y + 11, anchor: "middle" as const, len: label.length };
    });
    const vendorItems = sceneBodies.map((b) => {
      const v = byS.get(b.slug);
      const name = v ? (v.name.length > 22 ? `${v.name.slice(0, 21)}…` : v.name) : b.slug;
      const anchorEnd = b.x > SCENE.w - 120 ? true : b.x < 120 ? false : Math.cos((b.angle * Math.PI) / 180) < 0;
      return { slug: b.slug, x: b.x, y: b.y, anchor: (anchorEnd ? "end" : "start") as "end" | "start", len: name.length, gap: 10 };
    });
    return labelOffsets([...capItems, ...vendorItems], obstacles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneBodies, capNodes, marketRows]);
  /** Hover focus: a vendor slug or a capability id isolates its evidence. */
  const [focusV, setFocusV] = useState<string | null>(null);
  const [focusC, setFocusC] = useState<string | null>(null);

  const autoTitle = started && facts.length > 0 ? brief.title : "Your project";
  const title = customTitle.trim() || autoTitle;
  /** The title that publishes (Harry's rename gap): the buyer's own name
   *  when given, the derived one otherwise. */
  const publishTitle = customTitle.trim() || brief.title;

  /** Suppliers the buyer has NAMED in their own retained words (quotes,
   *  receipts). A tag, never a rank change: naming is not evidence. */
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

  /* ------------------------------------------------------------------ */
  /* Render: the desk                                                    */
  /* ------------------------------------------------------------------ */

  return (
    <div className="pd-root mt-10">
      <style>{`
        @keyframes pdink{0%{background:rgba(245,162,27,.16)}100%{background:transparent}}
        .pd-ink{animation:pdink 1.1s ease forwards}
        @keyframes pdbreath{0%,100%{opacity:.45}50%{opacity:1}}
        .pd-breath{animation:pdbreath 3.4s ease-in-out infinite}
        .pd-move{transition:transform .6s cubic-bezier(.34,1.56,.64,1)}
        @keyframes pdemerge{from{opacity:0}}
        .pd-emerge{animation:pdemerge .9s ease}
        @media(prefers-reduced-motion:reduce){.pd-move{transition:none}.pd-emerge{animation:none}.pd-breath{animation:none}.pd-live-in{animation:none}}
        .pd-cols{column-count:1;column-gap:2.5rem}
        @media(min-width:768px){.pd-cols{column-count:2}}
        .pd-sec{break-inside:avoid}
        @keyframes pdlivein{0%{box-shadow:0 0 0 2px rgba(245,158,11,.55)}100%{box-shadow:0 0 0 2px rgba(245,158,11,0)}}
        .pd-live-in{animation:pdlivein 1.4s ease forwards;border-radius:8px}
        @keyframes pdwave{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
        .pd-wave rect{transform-origin:center;animation:pdwave 1s ease-in-out infinite}
        .pd-wave rect:nth-child(2){animation-delay:.15s}
        .pd-wave rect:nth-child(3){animation-delay:.3s}
        .pd-wave rect:nth-child(4){animation-delay:.45s}
        @media(prefers-reduced-motion:reduce){.pd-wave rect{animation:none}}
      `}</style>

      {/* ---- The one line in: the page's one control, framed as such ---- */}
      <div className="mx-auto w-[min(760px,100%)]">
        <section
          id="describe"
          aria-label="Describe your project"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            if (published) return;
            const f = e.dataTransfer?.files?.[0];
            if (f && (f.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(f.name))) {
              void f.text().then((t) => ingestText(t, "drop"));
              return;
            }
            const t = e.dataTransfer?.getData("text/plain");
            if (t && t.trim().length > 0) void ingestText(t, "drop");
          }}
          className={`rounded-[18px] border border-[#EAE7E1] bg-white px-7 pb-5 pt-6 text-center shadow-[0_2px_14px_rgba(20,20,20,.04)] sm:px-8${yoursRing ? " pd-live-in" : ""}`}>
        {/* Robert's heading ruling, 26 Jul 2026, stays word for word as
            the caption; the field itself now reads as a field (v7: one
            hero start from fifteen thousand visitors said the card read
            as a brochure). */}
        <p className="m-0 mb-2 text-[10.5px] font-mono font-semibold uppercase tracking-[.12em] text-[#8C8A85]">Your first sentence becomes your Statement of Requirements</p>
        {/* Focus is a border change alone (instrument-grade law, 28 Jul:
            no glow ring; the field is alive because words land in it). */}
        <div className="relative rounded-xl border-[1.5px] border-[#E3E0DA] bg-white px-3 py-3 text-left shadow-[inset_0_1px_2px_rgba(15,23,42,.04)] focus-within:border-[#F5A21B]">
          {/* Safari AutoFill defence (Robert's catch, 29 Jul: private-window
              Safari offered his saved netify.co.uk username in this box).
              An anonymous, nameless text input on a domain with saved
              credentials gets classified as a login field; the explicit
              non-credential identity + autoComplete off + the password
              manager ignore attributes stop the username sheet. If Safari
              ever regresses, the escalation is a rows-1 textarea. */}
          <input
            ref={inputRef}
            type="text"
            name="project-brief"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            value={input}
            onChange={(e) => {
              if (!firstKeyAt.current) {
                firstKeyAt.current = Date.now();
                ev("hero_typed", {});
              }
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runCycle(input, { fromEnter: true });
              }
            }}
            onPaste={(e) => {
              const t = e.clipboardData?.getData("text/plain") ?? "";
              /* A sentence pastes into the input as ever; a document (long,
                 or carrying line breaks) reads through the cycles instead. */
              if (t.length > 300 || /\n/.test(t.trim())) {
                e.preventDefault();
                void ingestText(t, "paste");
              }
            }}
            placeholder={
              started
                ? "Add or correct anything about your project…"
                : "Describe your project. One sentence is enough."
            }
            disabled={Boolean(published)}
            className="w-full bg-transparent pl-1 pr-20 text-left text-[16.5px] text-[#141414] outline-none placeholder:text-[#A3A099]"
            aria-label="Describe your project"
          />
          {voiceSupported && !published && (
            <button
              type="button"
              onClick={() => (voiceState !== "idle" ? stopVoice() : startVoice())}
              disabled={busy}
              aria-label={voiceState !== "idle" ? "Stop listening" : "Speak your requirement"}
              title={voiceState !== "idle" ? "Stop listening" : "Speak instead of typing"}
              className={`absolute right-1 top-1/2 -translate-y-1/2 rounded-full border p-[7px] transition-colors disabled:opacity-40 ${
                voiceState !== "idle"
                  ? "border-[#F5A21B] bg-[#FFF7E8] text-[#B4650B]"
                  : "border-[#EAE7E1] text-[#8C8A85] hover:border-[#141414] hover:text-[#33302C]"
              }`}
            >
              {voiceState === "listening" ? (
                <svg className="pd-wave" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <rect x="1" y="3" width="2" height="8" rx="1" fill="currentColor" />
                  <rect x="4.7" y="3" width="2" height="8" rx="1" fill="currentColor" />
                  <rect x="8.4" y="3" width="2" height="8" rx="1" fill="currentColor" />
                  <rect x="12.1" y="3" width="2" height="8" rx="1" fill="currentColor" transform="translate(-1.1 0)" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="5" y="1.2" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3 6.5v.5a4 4 0 0 0 8 0v-.5M7 11.2v1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
          {/* The way in, visible (Concept A): presentation of the existing
              Enter behaviour, nothing more. Amber because it is a primary
              action under the colour law; appears only once words exist. */}
          {!published && !busy && input.trim().length > 0 && (
            <button
              type="button"
              onClick={() => void runCycle(input, { fromEnter: true })}
              aria-label="Read this into your project"
              title="Read this into your project (or press Enter)"
              className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-[#F5A21B] p-[7px] text-[#141414] transition-colors hover:bg-[#E5940F] ${voiceSupported ? "right-10" : "right-1"}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 11.5 V3 M3.4 6.6 L7 3 l3.6 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px] text-[#6E6C67]">
          {busy && <span aria-live="polite" className="text-[#33302C]">Reading…</span>}
          {voiceState === "starting" && !busy && (
            <span aria-live="polite" className="text-[#6E6C67]">Opening the microphone…</span>
          )}
          {voiceState === "listening" && !busy && (
            <span aria-live="polite" className="text-[#B4650B]">Listening… your words land as you speak.</span>
          )}
          {voiceError && !busy && voiceState === "idle" && <span aria-live="polite" className="text-[#6E6C67]">{voiceError}</span>}
          {pasteSummary && !busy && <span aria-live="polite" className="text-[#33302C]">{pasteSummary}</span>}
          {/* The wrong-company guard (R9): quiet, once, and only for words
              that say the person came for Netlify or netify.ai. */}
          {wrongCompany && (
            <span aria-live="polite" className="text-[#6E6C67]">
              Netify here is the SASE and SD-WAN procurement marketplace. Netlify website hosting (netlify.com) and
              Netify network intelligence (netify.ai) are separate companies.{" "}
              <button type="button" onClick={() => setWrongCompany(false)} className="underline hover:text-[#141414]">Got it</button>
            </span>
          )}
          {!busy && started && engineUsed === "deterministic_fallback" && <span>Read without the model this turn; everything still works.</span>}
          {cycleError && <span className="text-red-600">{cycleError}</span>}
          {booted && !started && !busy && (
            <>
              {/* The two-state primary (v7): before words it names the
                  price of entry; once three characters exist it names the
                  outcome and runs the first cycle itself. The old
                  "Make this yours" asked the visitor to decode a metaphor;
                  one hero start from fifteen thousand visitors was the
                  verdict on that. */}
              <button
                type="button"
                onClick={() => {
                  if (input.trim().length >= 3) {
                    ev("hero_draft_click", { typed: 1 });
                    void runCycle(input, { fromEnter: true });
                  } else {
                    makeThisYours();
                  }
                }}
                className="rounded-full bg-[#F5A21B] px-5 py-2 text-[13.5px] font-semibold text-[#141414] transition-colors hover:bg-[#E5940F]"
              >
                {input.trim().length >= 3 ? (
                  <>Structure my requirement <span aria-hidden="true">&rarr;</span></>
                ) : (
                  "Draft my project (free, no sign-in)"
                )}
              </button>
              <span className="text-[#8C8A85]">type it, speak it, or drop any document onto this card. Or start from a sector:</span>
              <span className="flex w-full flex-wrap items-center justify-center gap-1.5">
                {SECTOR_CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => tapSector(c.label)}
                    aria-pressed={selSector === c.label}
                    className={`rounded-full border px-3 py-1 transition-colors ${
                      selSector === c.label
                        ? "border-[#F5A21B] bg-[#FFF7E8] text-[#141414]"
                        : "border-[#EAE7E1] bg-white text-[#5F5D59] hover:border-[#141414] hover:text-[#141414]"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
                <span aria-hidden="true" className="text-[#A3A099]">+</span>
                {GOAL_CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => tapGoal(c.label)}
                    aria-pressed={selGoals.includes(c.label)}
                    className={`rounded-full border px-3 py-1 transition-colors ${
                      selGoals.includes(c.label)
                        ? "border-[#F5A21B] bg-[#FFF7E8] text-[#141414]"
                        : "border-[#EAE7E1] bg-white text-[#5F5D59] hover:border-[#141414] hover:text-[#141414]"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </span>
            </>
          )}
          {testMode && <span className="font-medium text-[#B4650B]">Test mode: signing creates a self-expiring test position and never touches the live board.</span>}
        </div>
        {/* The applied-changes strip (F2): what the last pass did, with one
            Undo. Renders only while the ledger is exactly the array that
            pass produced, so it can never offer a stale revert. */}
        {lastPass && facts === lastPass.factsAtSet && !published && (
          <div className="mx-auto mt-2 flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md bg-[#FFF7E8]/80 px-3 py-1.5 text-[11.5px] text-[#5F5D59]">
            <span className="font-medium text-[#33302C]">
              This pass: {lastPass.changes.filter((c) => c.kind === "placed").length} placed
              {lastPass.changes.some((c) => c.kind === "revised") ? `, ${lastPass.changes.filter((c) => c.kind === "revised").length} revised` : ""}
              {lastPass.source === "link" ? " · from the link you arrived on" : ""}
            </span>
            {lastPass.changes.slice(0, 5).map((c) => (
              <span
                key={c.id}
                title={`${c.kind === "placed" ? "placed" : "revised"} this pass · ${c.provenance}`}
                className={`rounded-full border bg-white px-2 py-[1px] text-[11px] ${c.provenance === "stated" ? "border-[#E3E0DA] text-[#33302C]" : "border-dashed border-[#E3E0DA] text-[#6E6C67]"}`}
              >
                {c.label.slice(0, 34)}
              </span>
            ))}
            {lastPass.changes.length > 5 && <span className="text-[#8C8A85]">+{lastPass.changes.length - 5} more</span>}
            <button type="button" onClick={undoPass} className="font-semibold text-[#8A4D08] underline hover:text-[#8A4D08]">Undo</button>
            <button type="button" onClick={() => setLastPass(null)} className="text-[#8C8A85] hover:text-[#33302C]" title="Keep these changes">✕</button>
          </div>
        )}
        {passLog.length > 0 && !published && (
          <p className="m-0 mt-1.5 text-center text-[11px] text-[#8C8A85]">
            <button type="button" onClick={() => setPassLogOpen((v) => !v)} className="underline hover:text-[#33302C]">
              What changed, pass by pass ({passLog.length})
            </button>
          </p>
        )}
        {passLogOpen && passLog.length > 0 && !published && (
          <div className="mx-auto mt-1 max-w-2xl rounded-md bg-[#FBFAF8] px-3 py-2">
            {passLog.map((p, i) => (
              <p key={i} className={`m-0 py-[2px] text-[11px] leading-snug ${p.undone ? "text-[#8C8A85] line-through" : "text-[#5F5D59]"}`}>
                {p.at} · &ldquo;{p.text}&rdquo; · {p.changes} change{p.changes === 1 ? "" : "s"}{p.undone ? " · undone" : ""}
              </p>
            ))}
            <p className="m-0 pt-1 text-[10px] text-[#8C8A85]">Every pass logs what it changed. Undo reverts the ledger only; your verbatim notes stay yours.</p>
          </div>
        )}
        {/* The gate, the live proof and the machine line (v7): the three
            doubts a first visitor holds, answered where the doubt sits.
            The gate states the true flow: draft and preview are free of
            any account; a human signs in only to publish (never "when
            responses arrive"; the feedback's wording failed the truth
            law). The proof renders from the live board JSON, never typed,
            and only when the board genuinely has open notices. The
            machine line names the two frozen MCP tool ids. All three
            retire once the visitor starts: the draft is the proof then. */}
        {!started && !published && (
          <div className="mt-4 border-t border-[#EAE7E1] pt-3">
            <p className="m-0 text-center text-[11.5px] text-[#6E6C67]">
              Draft and preview without an account. Sign in only to publish, anonymously, with pricing private to you.
              Only vetted vendors and service providers can respond, and you choose who receives your contact details.
            </p>
            {boardProof && boardProof.open > 0 && (
              <p className="m-0 mt-2 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1.5 text-center text-[12px] text-[#5F5D59]">
                <span>
                  <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#2E9E52] align-middle" />
                  {boardProof.open === 1 ? "1 project open to vendors now" : `${boardProof.open} projects open to vendors now`}
                </span>
                {boardProof.latest.map((o) => (
                  <a
                    key={o.id}
                    href={`/sase/opportunities/${o.id}`}
                    className="rounded-[7px] border border-[#EAE7E1] bg-[#FBFAF8] px-2 py-0.5 text-[11.5px] text-[#33302C] no-underline transition-colors hover:border-[#141414] hover:text-[#141414]"
                  >
                    {o.title}
                    {o.full && <span className="ml-1.5 text-[9px] font-mono font-bold tracking-[.08em] text-[#B4650B]">FULL RFP</span>}
                  </a>
                ))}
              </p>
            )}
            {/* The two-buyer line (Robert's ruling, 28 Jul): outcome
                language on the consumer surface; the tool ids moved to
                the connection details (llms.txt, the agents' door). */}
            <p className="m-0 mt-2 text-center text-[11px] text-[#6E6C67]">
              Use Netify directly, or connect your organisation&rsquo;s approved AI agent through MCP. Agents research,
              draft, compare and monitor. Your team publishes, selects and awards.
            </p>
            <p className="m-0 mt-1 text-center text-[10.5px] text-[#8C8A85]">
              Connecting an agent? <a href="/llms.txt" className="underline hover:text-[#5F5D59]">View agent connection details</a>
            </p>
          </div>
        )}
        </section>
        {published && (
          <p className="m-0 mt-3 text-[13px] text-[#33302C]">
            <span className="text-[15px] italic">Live. The market answers here.</span>{" "}
            {published.boardId && (
              <a href={`/sase/opportunities/${published.boardId}`} className="underline">your notice on the board</a>
            )}
            {" · "}
            <a href={`/sase/project/${created?.id}${created?.manage ? `?manage=${encodeURIComponent(created.manage)}` : ""}`} className="underline">your position&rsquo;s record</a>
          </p>
        )}
      </div>

      {/* One strip only (Robert's R1 ruling on Harry's Section 1 test,
          28 Jul 2026): the door's server-rendered journey strip stands
          down once a project exists; the state-aware strip below takes
          over with the same ruled labels. */}
      {!started && !published ? afterPrompt : null}

      {/* The door recut (Robert's build ruling, 28 Jul, the sourcing
          engine): before a project exists the page is the door and
          nothing else renders below the journey strip. The spine, the
          example listing, the framework sections, the crew and the
          below-fold explanations appear only for a started or published
          project, where they continue unchanged until the interview
          face (slice two) reshapes them. */}
      {(started || Boolean(published)) && (<>

      {/* ---- The guide strip (the ZIP recut, Robert's ruling 30 Jul eve:
              the handoff's ink band, step-aware, under the site nav). Pure
              presentation: the step titles are the three ruled steps, the
              body lines state only what the desk already does, and the one
              control scrolls to the journey map that already renders below
              the document. No count appears unless it is live data. ---- */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[10px] bg-[#141414] px-5 py-2.5 text-white">
        <span className="font-mono text-[10.5px] uppercase tracking-[.11em] text-[#9C9A94]">
          Step 0{shownStep} of 03
        </span>
        <span className="text-[13.5px] font-semibold">
          {shownStep === 1 ? "Build the requirement" : shownStep === 2 ? "See who fits" : "Publish to the board"}
        </span>
        <span className="min-w-0 flex-1 basis-64 text-[12.5px] leading-snug text-[#C7C4BE]">
          {shownStep === 1
            ? "Prompt or add by hand. Netify writes it in vendor language and asks only for what is missing. Nothing is sent from this screen."
            : shownStep === 2
              ? "The evaluated vendors and service providers your requirement reaches, named with dated grades. The ranked order and fit reasons generate at publish."
              : "Verify once from your work email, then sign. The public listing stays anonymous; vetted vendors and service providers who sign in see the detail."}
        </span>
        <button
          type="button"
          onClick={() => {
            if (shownStep !== 1) goToStep(1);
            requestAnimationFrame(() => {
              document.getElementById("how-this-goes")?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
          className="rounded-full border border-[#3A3A3A] px-3 py-1 text-[11.5px] text-white transition-colors hover:border-white"
        >
          How it works
        </button>
      </div>

      {/* ---- The journey rail (P1 of the CTM pivot, Robert's rulings
              30 Jul 2026; reference netify-ctm-p1-reference). Compare the
              Market's journey sidebar, adapted to the three ruled steps. The
              sub-steps are the core five (R7) and nothing else, so the
              percentage beside them cannot move unless something true moves
              first, and one sentence can tick several of them at once where
              the buyer can watch it happen. ---- */}
      <div className="mx-auto mt-6 w-[min(760px,100%)]">
        <JourneyRail steps={railSteps} current={shownStep} onGoTo={goToStep} published={Boolean(published)} maxStep={published ? 3 : maxStep} />
      </div>

      {shownStep === 1 && (<>

      {/* ---- Readiness: three things first, from real state only ---- */}
      {started && (
        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2">
          <span><span className="font-mono text-[19px] font-semibold tracking-tight text-[#141414]">{meter.confirmed}</span>
            <span className="ml-1.5 text-[11px] text-[#6E6C67]">requirement{meter.confirmed === 1 ? "" : "s"} in your words</span></span>
          {meter.inferred > 0 && (
            <span><span className="font-mono text-[19px] font-semibold tracking-tight text-[#B4650B]">{meter.inferred}</span>
              <span className="ml-1.5 text-[11px] text-[#6E6C67]">inferred, yours to confirm or strike</span></span>
          )}
          {openQuestionCount > 0 && (
            <span><span className="font-mono text-[19px] font-semibold tracking-tight text-[#B4650B]">{openQuestionCount}</span>
              <span className="ml-1.5 text-[11px] text-[#6E6C67]">open question{openQuestionCount === 1 ? "" : "s"} waiting below</span></span>
          )}
          <span className="ml-auto text-right text-[11px] leading-relaxed text-[#8C8A85]">
            {receipts.length > 0 ? `${receipts.length} note${receipts.length === 1 ? "" : "s"} kept verbatim in Notes below · ` : ""}
            {market ? `${market.counts.vendors} vendors and service providers evaluated against this position` : ""}
          </span>
        </div>
      )}

      {/* ---- The areas: a second view of the same position (slice four).
              Every state derives from the fixtured module, never styling. ---- */}
      {started && (
        <div className="mt-4 xl:hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {areaStates.map((a) => {
              const dot =
                a.state === "confirmed" ? "bg-[#141414]" :
                a.state === "stated" ? "border-[1.5px] border-[#5F5D59] bg-white" :
                a.state === "suggested" ? "border-[1.5px] border-dotted border-[#E5940F] bg-white" :
                a.state === "needs_attention" ? "bg-[#F5A21B]" :
                a.state === "excluded" ? "border border-[#E3E0DA] bg-white" :
                "border border-[#EAE7E1] bg-white";
              const ink =
                a.state === "example" ? "text-[#A3A099]" :
                a.state === "needs_attention" || a.state === "suggested" ? "text-[#33302C]" :
                a.state === "excluded" ? "text-[#8C8A85] line-through" : "text-[#33302C]";
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    setAreaDetail(areaDetail === a.key ? null : a.key);
                    document.getElementById(`sec-${a.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={`flex items-center gap-1.5 text-[11px] ${ink} hover:text-[#141414]`}
                  aria-label={`${a.title}: ${a.state.replace("_", " ")}`}
                >
                  <span className={`inline-block h-[8px] w-[8px] rounded-full ${dot}`} />
                  {a.title}
                </button>
              );
            })}
          </div>
          {areaDetail && (() => {
            const a = areaStates.find((x) => x.key === areaDetail);
            if (!a) return null;
            const infl: Record<string, string> = {
              compliance: "shapes the security requirements and limits who is eligible to bid",
              opmodel: "decides managed service suitability across the market",
              estate: "drives the migration plan and the coverage checks",
              security: "becomes evidence checks for every vendor and service provider",
              commercial: "its open decisions hold publication",
              organisation: "sets the scale band vendors and service providers are matched at",
            };
            return (
              <p className="m-0 mt-1.5 border-t border-[#F5F3EE] pt-1.5 text-[11px] leading-relaxed text-[#6E6C67]" role="status">
                <span className="font-semibold text-[#33302C]">{a.title}</span>: {a.state.replace("_", " ")} ·{" "}
                {a.standingN} standing fact{a.standingN === 1 ? "" : "s"}
                {a.notedN > 0 ? `, ${a.notedN} noted` : ""}
                {a.openQ > 0 ? `, ${a.openQ} unresolved` : ", nothing unresolved"}
                {a.latestCycle > 0 ? ` · last changed cycle ${a.latestCycle}` : ""}
                {infl[a.key] ? ` · this area ${infl[a.key]}` : ""}
                {a.state === "needs_attention" && a.key === "commercial" ? " · answering here unblocks the gate" : ""}
              </p>
            );
          })()}
        </div>
      )}

      {/* ---- The desk: the document and the responding organs. At xl the
              ZIP's third column appears: a section index on the left, the
              same areaStates the chip row shows below xl, one organ in two
              responsive presentations, never two organs. ---- */}
      <div className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_336px] xl:grid-cols-[188px_minmax(0,1fr)_320px]">

        {/* ---- The section index (xl only; the ZIP's left rail). Every row
                is the same navigation the area chips carry: scroll to the
                section that holds it. Counts are standing facts; the orange
                dot is an open question waiting in that section. ---- */}
        {started ? (
          <nav aria-label="Sections of your requirement" className="hidden xl:sticky xl:top-6 xl:block">
            <p className="m-0 mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-[#8C8A85]">Your requirement</p>
            <ul className="m-0 list-none space-y-[2px] p-0">
              {areaStates.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById(`sec-${a.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`flex w-full items-baseline justify-between gap-2 rounded-[6px] px-1.5 py-[5px] text-left text-[13px] transition-colors hover:bg-[#FDFCFA] hover:text-[#141414] ${
                      a.state === "example" ? "text-[#A3A099]" : "text-[#5F5D59]"
                    }`}
                  >
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      {a.openQ > 0 && <span aria-hidden="true" className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-[#F5A21B]" />}
                      <span className="truncate">{a.title}</span>
                    </span>
                    <span className="font-mono text-[10.5px] text-[#A3A099]">{a.standingN > 0 ? a.standingN : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="m-0 mt-4 border-t border-[#F0EEE9] pt-3 text-[11.5px] leading-snug text-[#8C8A85]">
              Netify holds the regulation, benchmarks and vendor evidence that matter in your sector.
            </p>
          </nav>
        ) : (
          <div className="hidden xl:block" aria-hidden="true" />
        )}

        {/* ============ THE PROJECT: the living Statement of Requirements ============ */}
        <div>
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-[#141414] pb-2">
            {editingTitle && !published ? (
              <input
                autoFocus
                defaultValue={customTitle || (facts.length ? brief.title : "")}
                onBlur={(e) => { setCustomTitle(e.target.value); setEditingTitle(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { setCustomTitle((e.target as HTMLInputElement).value); setEditingTitle(false); ev("workspace_renamed", {}); }
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                placeholder="Name your project"
                className="m-0 w-full border-b border-dashed border-[#141414] bg-transparent tracking-tight outline-none focus:border-[#F5A21B]"
                style={{ fontSize: "19px", lineHeight: 1.3, fontWeight: 600, color: "#09090b" }}
                aria-label="Project title"
              />
            ) : (
              <span className="flex min-w-0 items-baseline gap-2">
                <h2
                  className={`m-0 tracking-tight ${published ? "" : "cursor-text"}`}
                  style={{ fontSize: "19px", lineHeight: 1.3, fontWeight: 600, color: facts.length || customTitle.trim() ? "#09090b" : "#8C8A85" }}
                  onClick={() => !published && setEditingTitle(true)}
                  title={published ? undefined : "Click to name your project"}
                >{title}</h2>
                {/* The rename affordance made visible (Harry's Section 1
                    finding, 28 Jul 2026: nothing said the title was the
                    project's name or that it could change). Same edit
                    underneath; one quiet word beside the title. */}
                {!published && (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="shrink-0 text-[10px] uppercase tracking-[.08em] text-[#8C8A85] underline decoration-dotted underline-offset-2 hover:text-[#33302C]"
                    aria-label="Rename this project"
                  >rename</button>
                )}
              </span>
            )}
            <span className="whitespace-nowrap text-[10px] uppercase tracking-[.12em] text-[#8C8A85]">Statement of Requirements · living</span>
          </div>
          <p className="m-0 mb-4 mt-1.5 text-[11px] text-[#6E6C67]">
            {facts.length === 0 && noted.length === 0
              ? "Empty, honestly. Grey is example content: it shows the destination, never publishes, never counts."
              : <>
                  {meter.total} fact{meter.total === 1 ? "" : "s"} · {meter.confirmed} stated · {meter.inferred} inferred
                  {/* The struck counter earns its explanation (Harry's
                      Section 1 question, 28 Jul 2026: struck or decrement?
                      Both: the stated count drops AND the strike stays on
                      the record, because nothing is silently dropped). */}
                  {meter.struck > 0 ? <> · <span className="cursor-help underline decoration-dotted underline-offset-2" title="Struck items stay on the record and never publish; the stated count already excludes them. Nothing is silently dropped.">{meter.struck} struck</span></> : ""}
                  {unansweredGaps.length > 0 ? <> · <span className="text-[#B4650B]">{unansweredGaps.length} question{unansweredGaps.length === 1 ? "" : "s"} open</span></> : ""}
                  {noted.length > 0 ? ` · ${noted.length} noted` : ""}
                  {" · "}
                  <button type="button" className="underline hover:text-[#141414]" onClick={() => setArtefactOpen((o) => !o)}>
                    {artefactOpen ? "close the artefact" : "view the artefact"}
                  </button>
                </>}
          </p>

          {/* ---- The instrument rail (the consolidation, waves one and
                  two): one desk, three instruments. Derived from the
                  position's own state or absent entirely; every note is a
                  fact about THIS position. Earned instruments wear the
                  market's colour; horizons stay quiet and name what they
                  need. ---- */}
          {instrumentLadder && (
            <div data-instrument-rail className="-mt-2.5 mb-3 flex flex-wrap items-center gap-1.5">
              {/* "SOR · LIVE" before anything was published read as a claim
                  of publication (Harry's Section 1 finding, 28 Jul 2026).
                  Forming until the signature; live on the board after. */}
              <span className="rounded-full border border-[#F5A21B] bg-white px-2.5 py-[2px] text-[10px] font-mono font-semibold uppercase tracking-[.08em] text-[#8A4D08]">{published ? "SoR · live on the board" : "SoR · forming"}</span>
              <span
                data-instrument-rfi={instrumentLadder.rfi.state}
                className={`rounded-full px-2.5 py-[2px] text-[10px] uppercase tracking-[.08em] ${
                  instrumentLadder.rfi.state === "ready"
                    ? "border border-[#F5A21B] bg-white font-semibold text-[#8A4D08]"
                    : "border border-[#EAE7E1] bg-[#FBFAF8] text-[#8C8A85]"
                }`}
              >
                RFI · <span className="normal-case tracking-normal">{instrumentLadder.rfi.note}</span>
              </span>
              <span
                data-instrument-rfp={instrumentLadder.rfp.state}
                className={`rounded-full px-2.5 py-[2px] text-[10px] uppercase tracking-[.08em] ${
                  instrumentLadder.rfp.state === "ready"
                    ? "border border-[#F5A21B] bg-white font-semibold text-[#8A4D08]"
                    : "border border-[#EAE7E1] bg-[#FBFAF8] text-[#8C8A85]"
                }`}
              >
                Full RFP · <span className="normal-case tracking-normal">{instrumentLadder.rfp.note}</span>
              </span>
            </div>
          )}

          {/* ---- Scoring priorities (wave two): the covered areas become
                  weightable once the RFI stands ready. The buyer weights;
                  nothing weights itself. ---- */}
          {instrumentLadder && instrumentLadder.rfi.state === "ready" && !published && (
            <div data-priorities className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#8C8A85]">Scoring weights</span>
              <span className="text-[10.5px] text-[#8C8A85]">weight the sections that matter most when scoring vendors and service providers:</span>
              {coveredSections
                .map((k) => TAXONOMY.find((s) => s.key === k))
                .filter((s): s is (typeof TAXONOMY)[number] => Boolean(s))
                .map((sec) => {
                  const on = weights.includes(sec.key);
                  return (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => {
                        setWeights((w) => (on ? w.filter((k) => k !== sec.key) : [...w, sec.key]));
                        ev("workspace_priority_weighted", { section: sec.key, high: on ? 0 : 1 });
                      }}
                      className={`rounded-full border px-2.5 py-[2px] text-[10.5px] transition-colors ${
                        on
                          ? "border-[#F5A21B] bg-[#FFF7E8] font-semibold text-[#8A4D08]"
                          : "border-[#EAE7E1] bg-white text-[#6E6C67] hover:border-[#141414] hover:text-[#33302C]"
                      }`}
                    >
                      {sectionTitle(sec.key, sec.title)}{on ? " · high" : ""}
                    </button>
                  );
                })}
            </div>
          )}

          {artefactOpen && (
            <div className="mb-4 rounded-lg border border-[#EAE7E1] bg-white p-3">
              <p className="m-0 mb-1.5 flex items-baseline justify-between gap-3 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#8C8A85]">
                <span>The artefact · a printout of your position as it stands</span>
                {published && (
                  <button
                    type="button"
                    onClick={() => {
                      const name = instrument === "rfp" ? "RFP" : instrument === "rfi" ? "RFI" : "SoR";
                      const blob = new Blob([artefactText()], { type: "text/markdown;charset=utf-8" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `netify-${name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                      ev("workspace_document_downloaded", { instrument });
                    }}
                    className="rounded-full border border-[#F5A21B] bg-white px-2.5 py-[2px] text-[10px] font-mono font-semibold uppercase tracking-[.08em] text-[#8A4D08] transition-colors hover:bg-[#FFF7E8]"
                  >
                    Download your {instrument === "rfp" ? "RFP" : instrument === "rfi" ? "RFI" : "SoR"}
                  </button>
                )}
              </p>
              {/* Rendered for reading (Harry's Section 1 finding, 28 Jul
                  2026: the printout showed raw markdown). The markdown
                  stays the machine and download form; humans get type. */}
              <ArtefactPrint text={artefactText()} />
              {!published && (
                <p data-download-law className="m-0 mt-2 border-t border-[#F5F3EE] pt-2 text-[10.5px] leading-relaxed text-[#6E6C67]">
                  Your {instrument === "rfp" ? "RFP" : instrument === "rfi" ? "RFI" : "SoR"} downloads once it is published
                  to the opportunity board: the notice goes out anonymous, signed-in vendors and service providers see it,
                  public visitors never do.
                </p>
              )}
            </div>
          )}

          <div className="pd-cols">
            {TAXONOMY.map((sec) => {
              const isLive = sectionLive(sec.key);
              const secFacts = factsBySection.get(sec.key) ?? [];
              const secGaps = gapsBySection.get(sec.key) ?? [];
              const secNotes = notedBySection.get(sec.key) ?? [];
              const secNoted = new Set(secNotes.map((n) => n.id));
              const secEarned = earnedBySection.get(sec.key) ?? [];
              const optionValueIds = new Set(sec.items.filter((i) => i.path).map((i) => factId(i.path as AllowedPath, i.value)));
              const looseFacts = secFacts.filter((f) => !optionValueIds.has(f.id));

              /* 1a: THE LIST IS THE SELECTOR. One list of candidate lines,
                 each one the tap target for its own answer. The chip cloud
                 that used to repeat these same candidates under the question
                 is gone; an option that only ever lived in that cloud is a
                 line here instead, so nothing was lost with it. */
              type Cand = {
                key: string;
                label: string;
                state: "example" | "exampleStruck" | "option" | "stated" | "inferred" | "struck" | "noted";
                fact?: WorkspaceFact;
                flashing: boolean;
                title: string;
                trailing?: string;
                quote?: string;
                act: CandAction;
              };
              const cands: Cand[] = [];
              const seenValue = new Set<string>();

              for (const item of sec.items) {
                const f = factFor(item);
                const isNoted = secNoted.has(item.id);
                if (item.path) seenValue.add(`${item.path}:${String(item.value)}`);
                cands.push({
                  key: item.id,
                  label: item.label,
                  state: f ? (f.struck ? "struck" : f.provenance === "stated" ? "stated" : "inferred")
                    : isNoted ? "noted"
                    : item.exampleTick && !isLive ? "example"
                    : item.exampleStruck && !isLive ? "exampleStruck"
                    : "option",
                  fact: f,
                  flashing: Boolean(f && flash.has(f.id)),
                  title: item.why,
                  trailing: item.exampleStruck,
                  act: { kind: "item", item },
                });
              }

              /* Candidates the open question carried that the framework does
                 not already hold: they join the same list rather than living
                 in a second one. */
              const chipGaps = secGaps.filter((g) => g.path && g.control === "chips" && (g.options?.length ?? 0) > 0);
              const inlineGaps = secGaps.filter((g) => !chipGaps.includes(g));
              for (const g of chipGaps) {
                for (const o of g.options ?? []) {
                  if (seenValue.has(`${g.path}:${o.value}`)) continue;
                  seenValue.add(`${g.path}:${o.value}`);
                  cands.push({
                    key: `gap-${g.key}-${o.value}`,
                    label: o.label,
                    state: "option",
                    flashing: false,
                    title: `Choose this · answers: ${g.question}`,
                    act: { kind: "gap", gap: g, value: o.value, label: o.label },
                  });
                }
              }
              for (const q of secEarned) {
                for (const o of q.options) {
                  if (o.answer.kind !== "note") continue;
                  cands.push({
                    key: `q-${q.id}-${o.label}`,
                    label: o.label,
                    state: "option",
                    flashing: false,
                    title: `Choose this · answers: ${q.question}`,
                    act: { kind: "earned", q, answer: o.answer },
                  });
                }
              }
              /* Answers already given that have no framework line of their
                 own: an answer to a question, or the buyer's own words. */
              for (const n of secNotes) {
                if (taxonomyItemIds.has(n.id)) continue;
                cands.push({
                  key: `note-${n.id}`,
                  label: n.label,
                  state: "noted",
                  flashing: false,
                  title: n.own ? "Your words, kept as you said them. One tap removes" : "One tap removes",
                  trailing: n.own ? undefined : "your answer, kept with your position",
                  quote: n.own ? n.label : undefined,
                  act: { kind: "note", id: n.id },
                });
              }

              /* 1b: ranked. The candidates the sector pack says are likely
                 come first, slightly larger, each with the line that says
                 why. Nothing is reordered by what is already chosen, so a
                 tap never moves the row under the finger. */
              const leads = (sectorFamily && LEADS[sectorFamily.key]?.[sec.key]) || [];
              const reasonOf = new Map(leads.map((l) => [l.id, l.reason]));
              const leadCands = leads.map((l) => cands.find((c) => c.key === l.id)).filter(Boolean) as Cand[];
              /* A candidate the open question is actually asking about stays
                 on screen while the question stands: a question whose answers
                 sit behind a count is a question nobody can answer. It keeps
                 its own place in the list rather than being promoted, so
                 answering the question never moves a line. */
              const askedKeys = new Set<string>();
              for (const g of chipGaps) for (const o of g.options ?? []) askedKeys.add(`gap-${g.key}-${o.value}`);
              for (const q of secEarned) {
                for (const o of q.options) {
                  if (o.answer.kind === "items") for (const id of o.answer.itemIds) askedKeys.add(id);
                  if (o.answer.kind === "note") askedKeys.add(`q-${q.id}-${o.label}`);
                }
              }
              for (const g of chipGaps) {
                for (const o of g.options ?? []) {
                  const twin = cands.find((c) => c.act.kind === "item" && c.act.item.path === g.path && String(c.act.item.value) === o.value);
                  if (twin) askedKeys.add(twin.key);
                }
              }
              const leadKeys = new Set(leadCands.map((c) => c.key));
              const ordered = [...leadCands, ...cands.filter((c) => !leadKeys.has(c.key))];

              /* 1b: the rest collapse behind a count. Everything the buyer
                 has touched stays on screen, the questions' own answers stay
                 with it, and the example lines stay too. */
              const budget = Math.max(6, leadCands.length + 4);
              const lastTouched = ordered.reduce((m, c, i) => (c.state === "option" ? m : i), -1);
              const lastAsked = ordered.reduce((m, c, i) => (askedKeys.has(c.key) ? i : m), -1);
              const opened = openedSecs.includes(sec.key);
              const cut = opened ? ordered.length : Math.max(budget, lastTouched + 1, lastAsked + 1);
              const hidden = Math.max(0, ordered.length - cut);
              const shown = hidden > 1 ? ordered.slice(0, cut) : ordered;

              /* The question, above the list it is asking about. */
              const heads: Array<{ key: string; question: string; count: "one" | "any"; evidence?: string; dismissId?: string }> = [
                ...chipGaps.map((g) => ({
                  key: `g-${g.key}`,
                  question: g.question,
                  count: (LIST_FACT_PATHS.has(String(g.path)) ? "any" : "one") as "one" | "any",
                })),
                ...secEarned.map((q) => ({
                  key: q.id,
                  question: q.question,
                  count: answerCountOf(q),
                  evidence: evidenceLine(q),
                  dismissId: q.id,
                })),
              ];
              const negatives = secEarned.flatMap((q) =>
                q.options.filter((o) => o.answer.kind === "dismiss").map((o) => ({ key: `${q.id}-${o.label}`, label: o.label, q, answer: o.answer })),
              );
              const ownWords = ownWordsBySection.get(sec.key);

              return (
                <section key={sec.key} id={`sec-${sec.key}`} className={`pd-sec mb-5${liveRing.has(sec.key) ? " pd-live-in" : ""}`} style={{ scrollMarginTop: "70px" }}>
                  <h3
                    className="mb-1.5 flex items-baseline justify-between border-b border-[#141414] pb-1 font-mono uppercase"
                    style={{ fontSize: "11px", lineHeight: 1.3, fontWeight: 600, letterSpacing: ".11em", color: "#141414" }}
                  >
                    {sectionTitle(sec.key, sec.title)}
                    <span className={`text-[10px] font-normal normal-case tracking-normal ${isLive ? "invisible" : "text-[#A3A099]"}`}>{sec.exampleNote}</span>
                  </h3>

                  {/* Organisation renders as fields */}
                  {sec.key === "organisation" && (
                    <OrganisationFields facts={facts} isLive={isLive} flash={flash} onStrike={toggleFact} />
                  )}

                  {/* The open question sits above the list that answers it */}
                  {heads.map((h, i) => (
                    <OpenQuestion
                      key={h.key}
                      question={h.question}
                      count={h.count}
                      hint={i === 0 && shown.length > 0
                        ? `${h.count === "any" ? "Tap any line below that applies." : "Tap the line below that applies."}${leadCands.length && sectorFamily ? ` Ordered by what applies to ${sectorFamily.word}.` : ""} These are the usual answers, not a fixed list.`
                        : undefined}
                      evidence={h.evidence}
                      onDismiss={published || !h.dismissId ? undefined : () => dismissQuestion(String(h.dismissId))}
                    />
                  ))}

                  {/* The list: every candidate is its own tap target */}
                  {shown.map((c) => (
                    <ItemLine
                      key={c.key}
                      label={c.label}
                      state={c.state}
                      fact={c.fact}
                      quote={c.quote}
                      trailing={c.trailing}
                      lead={reasonOf.has(c.key)}
                      reason={reasonOf.get(c.key)}
                      flashing={c.flashing}
                      disabled={Boolean(published)}
                      title={c.title}
                      onClick={() => runCandidate(c.act, sec.key)}
                    />
                  ))}
                  {shown.length < ordered.length && (
                    <button
                      type="button"
                      onClick={() => setOpenedSecs((s) => [...s, sec.key])}
                      className="mt-1 rounded-[8px] border border-dashed border-[#E3E0DA] px-2.5 py-1 text-[12px] text-[#8C8A85] transition-colors hover:border-[#141414] hover:text-[#141414]"
                    >
                      + {ordered.length - shown.length} more
                    </button>
                  )}

                  {/* Facts with no matching option (free values) render in place */}
                  {sec.key !== "organisation" && looseFacts.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={Boolean(published)}
                      onClick={() => toggleFact(f.id)}
                      title={f.struck ? "Restore" : "Strike out"}
                      className={`block w-full rounded-[6px] py-[3px] text-left text-[13px] leading-snug hover:bg-[#FDFCFA] ${flash.has(f.id) ? "pd-ink" : ""} ${f.struck ? "text-[#A3A099] line-through" : "text-[#141414]"}`}
                    >
                      <span className={`mr-2 inline-block w-3 text-center text-[11px] ${f.struck ? "text-[#A3A099]" : f.provenance === "stated" ? "text-[#F5A21B]" : "text-[#33302C]"}`}>{f.struck ? "×" : "✓"}</span>
                      <span className={f.struck ? "" : f.provenance === "stated" ? "border-b border-[#F5A21B]" : "border-b border-dotted border-[#A3A099]"}>{factLabel(f)}</span>
                      {!f.struck && (
                        <span className="ml-2 text-[11px] text-[#6E6C67]">
                          {f.provenance === "stated" ? <em>&ldquo;{f.quote ?? String(f.value)}&rdquo;</em> : (f.reason ?? "inferred")}
                        </span>
                      )}
                    </button>
                  ))}

                  {/* A question with a figure of its own keeps its own field:
                      it is not a choice between candidates, so it never had a
                      chip cloud to lose. */}
                  {inlineGaps.map((g) => (
                    <GapLine key={g.key} gap={g} onAnswer={answerGap} />
                  ))}

                  {/* The plain negative: an answer, not a dismissal */}
                  {!published && negatives.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {negatives.map((n) => (
                        <button
                          key={n.key}
                          type="button"
                          onClick={() => answerEarned(n.q, n.answer)}
                          className="text-[12px] font-semibold text-[#B4650B] underline underline-offset-2 hover:text-[#8A4D08]"
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 1f: the list is never the only way through */}
                  {!published && (
                    <OwnWordsRow
                      sectionKey={sec.key}
                      question={ownWords?.question}
                      placeholder={ownWords?.placeholder ?? "Say it in your own words"}
                      tech={SECTION_TECH[sec.key] ?? "the requirement in this section"}
                      onCommit={(text) => answerInOwnWords(sec.key, text)}
                    />
                  )}

                  {/* Sector pack suggestions (24 Jul): offered clauses under
                      the pack law. The pack never writes; the buyer's touch
                      does. Declining is permanent and stays on the record. */}
                  {!published && (packSugsBySection.get(sec.key) ?? []).map((sg) => (
                    <div key={sg.id} className="my-1.5 rounded-md border border-dashed border-[#E3E0DA] bg-[#FBFAF8]/80 px-2.5 py-2">
                      <p className="m-0 text-[13px] leading-snug text-[#33302C]">
                        <span className="mr-1.5 inline-block rounded-sm bg-[#EAE7E1] px-1 py-[1px] align-[1px] text-[10px] font-mono font-semibold uppercase tracking-[.08em] text-[#5F5D59]">Suggested · {pack?.label.toLowerCase()}</span>
                        {sg.label}
                      </p>
                      <p className="m-0 mt-0.5 text-[11px] leading-snug text-[#6E6C67]">{sg.reason}</p>
                      <div className="mt-1.5 flex gap-2">
                        <button type="button" onClick={() => acceptSuggestion(sg)} className="rounded-full border border-[#33302C] bg-[#141414] px-2.5 py-[3px] text-[11px] font-semibold text-white transition-colors hover:bg-black">
                          Add to the record
                        </button>
                        <button type="button" onClick={() => declineSuggestion(sg)} className="rounded-full border border-[#E3E0DA] bg-white px-2.5 py-[3px] text-[11px] text-[#5F5D59] transition-colors hover:border-[#A3A099] hover:text-[#141414]">
                          Decline, keep on record
                        </button>
                      </div>
                    </div>
                  ))}
                  {(packDeclinedBySection.get(sec.key) ?? []).map((sg) => (
                    <p key={`dec-${sg.id}`} className="m-0 py-[3px] text-[13px] leading-snug text-[#A3A099]">
                      <span className="mr-2 inline-block w-3 text-center text-[11px]">×</span>
                      <span className="line-through">{sg.label}</span>
                      <span className="ml-2 text-[10px] no-underline">suggested for {pack?.label.toLowerCase()}, declined; kept on the record</span>
                    </p>
                  ))}
                </section>
              );
            })}

            {/* Notes, unplaced: the receipt (13.6) */}
            {receipts.length > 0 && (
              <section className="pd-sec mb-5">
                <h3
                  className="mb-1.5 flex items-baseline justify-between border-b border-[#EAE7E1] pb-1 uppercase"
                  style={{ fontSize: "10px", lineHeight: 1.3, fontWeight: 600, letterSpacing: ".12em", color: "#8C8A85" }}
                >
                  Notes, unplaced
                  <span className="text-[10px] font-normal normal-case tracking-normal text-[#8C8A85]">heard, no home yet</span>
                </h3>
                {receipts.map((r) => (
                  <div key={r.id} className="flex items-baseline gap-2 py-[3px] text-[13px] leading-snug text-[#5F5D59]">
                    <span className="text-[#8C8A85]">•</span>
                    <span className="italic">&ldquo;{r.text}&rdquo;</span>
                    <button type="button" onClick={() => dismissReceipt(r.id)} className="ml-auto text-[11px] text-[#8C8A85] hover:text-[#141414]" title="Remove this note">✕</button>
                  </div>
                ))}
                <p className="m-0 mt-1 text-[11px] leading-snug text-[#8C8A85]">Kept verbatim with your position. Nothing you say is silently dropped.</p>
              </section>
            )}
          </div>


          {/* The document's own legend stays with the document. The
              signature that used to sit under it is step three now. */}
          <div className="mt-6 border-t border-[#EAE7E1] pt-5">
            {/* The four truth classes, stated once */}
            <p className="m-0 mt-3 text-[11px] leading-relaxed text-[#8C8A85]">
              <span className="text-[#A3A099]">grey</span> example, never publishes · <span className="italic text-[#5F5D59]">&ldquo;quoted&rdquo;</span> captured, awaiting interpretation ·{" "}
              <span className="border-b border-[#F5A21B] text-[#141414]">solid ink</span> stated, your words or your touch ·{" "}
              <span className="border-b border-dotted border-[#A3A099] text-[#5F5D59]">dotted</span> inferred, reason attached, one tap strikes ·{" "}
              <span className="text-[#256B3E]">✓ dated</span> verified, evidence stands behind it. Strike anything; a strike is never overridden by re-inference, only by your own words. Nothing on this desk moves without saying what changed.
            </p>
          </div>
        </div>

        {/* ============ THE RESPONDING ORGANS ============ */}
        <div className="space-y-7 lg:sticky lg:top-6 lg:rounded-[14px] lg:border lg:border-[#EAE7E1] lg:bg-white lg:p-5">

          {/* Your estate */}
          <div>
            <p className="m-0 mb-2 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-[#5F5D59]">
              Your estate <span className="text-right font-normal text-[#8C8A85]">{diagram.empty ? "example plan · becomes yours as you speak" : "drawn from your words only"}</span>
            </p>
            {diagram.empty ? (
              <svg viewBox="0 0 300 120" className="block w-full" role="img" aria-label="Example estate plan">
                <rect x="103" y="8" width="94" height="18" rx="4" fill="none" stroke="#EAE7E1" />
                <text x="150" y="20" textAnchor="middle" fontSize="8.5" fill="#d4d4d8">Internet</text>
                <line x1="150" y1="26" x2="150" y2="50" stroke="#EAE7E1" />
                <rect x="85" y="50" width="130" height="30" rx="5" fill="none" stroke="#EAE7E1" />
                <text x="150" y="63" textAnchor="middle" fontSize="8.5" fill="#d4d4d8">12 sites · example</text>
                <g fill="none" stroke="#EAE7E1">
                  {Array.from({ length: 8 }, (_, i) => <rect key={i} x={94 + i * 14} y={68} width={9} height={7} />)}
                </g>
                <text x="150" y="104" textAnchor="middle" fontSize="7.5" fill="#d4d4d8">example content · never publishes</text>
              </svg>
            ) : (
              <WorkspaceDiagram model={diagram} />
            )}
            <p className="m-0 mt-1 text-[11px] leading-snug text-[#6E6C67]">Redraws on every correction; never invents topology.</p>
          </div>

          {/* We noticed: emerald, only advice that costs Netify */}
          {verdict && verdict.againstInterest.length > 0 && started && (
            <div className="rounded-lg border border-[#BFE0CB] bg-[#EAF6EE] p-3">
              <p className="m-0 mb-1 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#256B3E]">We noticed · against Netify&rsquo;s own interest</p>
              <p className="m-0 text-[13px] leading-relaxed text-[#3A5A44]">{verdict.againstInterest[0].statement}</p>
              {verdict.againstInterest.length > 1 && (
                <p className="m-0 mt-1 text-[11px] text-[#256B3E]/80">{verdict.againstInterest.length - 1} more ruling{verdict.againstInterest.length === 2 ? "" : "s"} on your record.</p>
              )}
            </div>
          )}

          {/* Sector notes (24 Jul): the pack's advice with its provenance.
              Evidence and advice, never requirements; nothing here publishes
              or feeds verdict or fit. Grey, not emerald: this advice costs
              Netify nothing and earns the buyer caution. */}
          {pack && packNotes.length > 0 && (
            <div>
              <p className="m-0 mb-1.5 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-[#5F5D59]">
                Sector notes · {pack.label}{packFlavours.length ? ` · ${packFlavours.map((f) => pack.flavours.find((x) => x.id === f)?.label ?? f).join(" · ")}` : ""}
                <span className="font-normal text-[#8C8A85]">{pack.version}</span>
              </p>
              {packNotes.map((n) => (
                <p key={n.id} className="m-0 mb-1.5 text-[11px] leading-relaxed text-[#5F5D59]">{n.text}</p>
              ))}
              <p className="m-0 text-[10px] leading-snug text-[#8C8A85]">Advice with provenance, never requirements; nothing here publishes.</p>
            </div>
          )}

          {/* The crew */}
          <div>
            <p className="m-0 mb-1.5 text-[11px] font-semibold text-[#5F5D59]">The crew · the activity log · completed work only</p>
            <div className="space-y-0.5 font-mono text-[11px] leading-relaxed text-[#6E6C67]" style={{ fontFamily: "'SF Mono',ui-monospace,Menlo,monospace" }}>
              {crew.slice(-6).map((l, i) => (
                <div key={i}>
                  <span className="mr-2 text-[#A3A099]">{l.t}</span>
                  <span className={l.cls === "em" ? "text-[#256B3E]" : l.cls === "you" ? "text-[#141414]" : undefined}>{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- The destination: where the finished position goes (below the desk so the document stays the hero, Robert 23 Jul)
              (the reference concept made live, Robert's word, 23 Jul; every
              claim renders from real data and no em dashes anywhere). ---- */}
      <div id="how-this-goes" className="mt-20 scroll-mt-24">
        <h2 className="m-0" style={{ fontSize: "19px", lineHeight: 1.2, fontWeight: 700, color: "#141414", letterSpacing: "-0.015em" }}>
          Publish to our SASE Opportunities Board
        </h2>
        <p className="m-0 mt-3 max-w-2xl text-[13px] leading-relaxed text-[#5F5D59]">
          Your completed Statement of Requirements becomes a live opportunity in a curated SASE marketplace, where
          leading vendors and managed service providers can compete for your business. The public listing remains
          anonymous, while the private procurement view is made available only to suitable vendors and service providers from
          Netify&rsquo;s curated community of {market ? market.counts.vendors : "evaluated"} UK, North American and
          global SASE partners.
        </p>
        <svg viewBox="0 0 1060 150" className="mt-4 hidden w-full sm:block" role="img"
          aria-label="The journey: a living Statement of Requirements becomes an anonymous published opportunity in a curated marketplace; responses return for comparison and a decision you sign.">
          <line x1="30" y1="62" x2="1030" y2="62" stroke="#EAE7E1" strokeWidth="1" />
          <g>
            <rect x="52" y="44" width="28" height="36" rx="3" fill="#fff" stroke="#33302C" strokeWidth="1.2" />
            <line x1="58" y1="54" x2="74" y2="54" stroke="#33302C" strokeWidth="1" />
            <line x1="58" y1="61" x2="74" y2="61" stroke="#8C8A85" strokeWidth="1" />
            <line x1="58" y1="68" x2="68" y2="68" stroke="#8C8A85" strokeWidth="1" />
            <text x="66" y="104" textAnchor="middle" fontSize="10.5" fill="#141414" fontWeight="600">Living Statement</text>
            <text x="66" y="117" textAnchor="middle" fontSize="9" fill="#8C8A85">yours, word for word</text>
          </g>
          <g>
            <circle cx="240" cy="62" r="7" fill="#F5A21B" />
            <text x="240" y="104" textAnchor="middle" fontSize="10.5" fill="#141414" fontWeight="600">Published opportunity</text>
            <text x="240" y="117" textAnchor="middle" fontSize="9" fill="#8C8A85">anonymous, to signed-in vendors</text>
          </g>
          <g>
            <circle cx="455" cy="36" r="4.5" fill="#2a78d6" /><circle cx="486" cy="28" r="4.5" fill="#e34948" />
            <circle cx="516" cy="36" r="4.5" fill="#0891b2" /><circle cx="470" cy="52" r="4.5" fill="#7c3aed" />
            <circle cx="501" cy="50" r="4.5" fill="#1d4ed8" /><circle cx="440" cy="50" r="4.5" fill="#be123c" />
            <circle cx="530" cy="52" r="4.5" fill="#4a3aa7" /><circle cx="458" cy="66" r="4.5" fill="#d946ef" />
            <circle cx="490" cy="68" r="4.5" fill="#e87ba4" />
            <text x="512" y="70" fontSize="9.5" fill="#52525b">and more</text>
            <text x="485" y="104" textAnchor="middle" fontSize="10.5" fill="#141414" fontWeight="600">Curated SASE marketplace</text>
            <text x="485" y="117" textAnchor="middle" fontSize="9" fill="#8C8A85">{market ? `${market.counts.vendors} evaluated partners` : "evaluated partners"} · UK · North America · Global</text>
            <text x="485" y="129" textAnchor="middle" fontSize="8.5" fill="#c4c2bc">quality over quantity, never a directory</text>
          </g>
          <g>
            <path d="M 700 48 L 686 62 L 700 76" fill="none" stroke="#33302C" strokeWidth="1.3" />
            <path d="M 716 48 L 702 62 L 716 76" fill="none" stroke="#8C8A85" strokeWidth="1.1" />
            <text x="706" y="104" textAnchor="middle" fontSize="10.5" fill="#141414" fontWeight="600">Vendor responses</text>
            <text x="706" y="117" textAnchor="middle" fontSize="9" fill="#8C8A85">answering your requirements</text>
          </g>
          <g>
            <line x1="856" y1="48" x2="856" y2="76" stroke="#33302C" strokeWidth="2" />
            <line x1="866" y1="54" x2="866" y2="76" stroke="#8C8A85" strokeWidth="2" />
            <line x1="876" y1="60" x2="876" y2="76" stroke="#8C8A85" strokeWidth="2" />
            <text x="866" y="104" textAnchor="middle" fontSize="10.5" fill="#141414" fontWeight="600">Comparison</text>
            <text x="866" y="117" textAnchor="middle" fontSize="9" fill="#8C8A85">side by side, evidence first</text>
          </g>
          <g>
            <path d="M 985 64 L 991 71 L 1003 52" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
            <text x="994" y="104" textAnchor="middle" fontSize="10.5" fill="#141414" fontWeight="600">Decision</text>
            <text x="994" y="117" textAnchor="middle" fontSize="9" fill="#8C8A85">you sign; agents never do</text>
          </g>
        </svg>
        <p className="m-0 mt-2 text-[11px] leading-relaxed text-[#8C8A85] sm:mt-1">
          <span className="font-semibold text-[#6E6C67]">You stay in control throughout:</span> public listings are
          anonymous · detailed procurement information is restricted to approved vendors and service providers · their access and
          invitations remain under your control · every response stays connected to this workspace.
        </p>
      </div>

      {/* ---- The way on. Publish is the only exit (R5), so each step but
              the last carries one forward control and the plain truth about
              what is still missing. The old fixed publish card that floated
              over this page has gone with it: a card that follows you down
              the screen is the last piece of 2005 behaviour here (R1b). ---- */}
      <div className="mt-14 border-t border-[#EAE7E1] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="m-0 max-w-xl text-[12px] leading-relaxed text-[#6E6C67]">
            {missingCore.length === 0
              ? "All five details a notice needs are standing. You can keep correcting any of them right up to the moment you publish."
              : `Still open: ${missingCore.join(", ")}. Say it in the box at the top and it lands in the document itself.`}
          </p>
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="rounded-full bg-[#141414] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#33302C]"
          >
            See who fits
          </button>
        </div>
      </div>

      </>)}


      {shownStep === 2 && (<>

      {/* ---- Who fits (step two; R1b, the half-a-coke rule, Robert 30 Jul
              2026). The matched suppliers are NAMED, each with the date its
              record was graded, in alphabetical order. Alphabetical is not a
              ranking and this panel never implies that it is. The ranked
              order, the scores and the per-supplier reasons are the half of
              the coke a buyer does not drink for free: they generate at
              publish. That is written here as a calm fact in the desk's own
              evidence language, with no blur, no padlock and no teaser. ---- */}
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_336px]">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b-2 border-[#141414] pb-2">
            <h2 className="m-0" style={{ fontSize: "19px", lineHeight: 1.2, fontWeight: 700, color: "#141414", letterSpacing: "-0.015em" }}>
              Who fits
            </h2>
            <p className="m-0 text-[11px] text-[#6E6C67]">
              {clusterRows.length > 0
                ? `${clusterRows.length} evaluated ${clusterRows.length === 1 ? "vendor or service provider reaches" : "vendors and service providers reach"} your requirement`
                : market
                  ? `${market.counts.vendors} vendors and service providers evaluated; none matched yet`
                  : "the evaluated market"}
            </p>
          </div>

          {clusterRows.length === 0 ? (
            <p className="m-0 mt-4 max-w-xl text-[13px] leading-relaxed text-[#6E6C67]">
              Nothing has matched yet. Vendors and service providers arrive here as your requirement names things the Netify dataset grades them
              on, so the fastest way to fill this is to go back and say more about what you need.
            </p>
          ) : (
            <>
              <p className="m-0 mt-3 max-w-xl text-[12.5px] leading-relaxed text-[#5F5D59]">
                These are the vendors and service providers your requirement reaches, listed A to Z. The order on this page carries no meaning.
              </p>
              <ul className="m-0 mt-4 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 sm:gap-x-4">
                {clusterRows.map((r) => (
                  <li key={r.slug} className="rounded-[11px] border border-[#E3E0DA] bg-white px-4 py-3 transition-colors hover:bg-[#FDFCFA]">
                    <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-[#EAE7E1] bg-[#FBFAF8] font-mono text-[11.5px] font-semibold text-[#5F5D59]">
                      {r.name.split(/[\s/]+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <a href={`/sase/vendors/${r.slug}/`} className="truncate text-[14.5px] font-semibold leading-snug text-[#141414] underline decoration-[#C9C5BC] underline-offset-2 hover:decoration-[#141414]">
                          {r.name}
                        </a>
                        {r.pinned && (
                          <span className="shrink-0 rounded-full bg-[#FFF7E8] px-1.5 py-[1px] font-mono text-[10px] font-semibold uppercase tracking-[.08em] text-[#8A4D08]">pinned</span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[#A3A099]">graded {fmtDate(r.graded)}</span>
                    </div>
                    <p className="m-0 mt-[2px] font-mono text-[10.5px] uppercase tracking-[.06em] leading-snug text-[#8C8A85]">
                      {r.category}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      {!published && (r.pinned ? (
                        <button type="button" onClick={() => setAdded((x) => x.filter((s) => s !== r.slug))} className="text-[#6E6C67] underline hover:text-[#141414]">
                          Unpin
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAdded((x) => (x.includes(r.slug) ? x : [...x, r.slug]));
                            setRemoved((x) => x.filter((s) => s !== r.slug));
                            ev("workspace_supplier_added", { slug: r.slug });
                            crewLog(`Registrar: pinned to your direct invitations: ${r.name}`, "you");
                          }}
                          className="text-[#6E6C67] underline hover:text-[#141414]"
                        >
                          Pin to my invitations
                        </button>
                      ))}
                      {!published && (
                        <button
                          type="button"
                          onClick={() => {
                            setRemoved((x) => (x.includes(r.slug) ? x : [...x, r.slug]));
                            setAdded((x) => x.filter((s) => s !== r.slug));
                            ev("workspace_supplier_excluded", { slug: r.slug });
                            crewLog(`Registrar: left out of direct invites at your word: ${r.name} · the public notice is unaffected`, "you");
                          }}
                          className="text-[#8C8A85] underline hover:text-[#33302C]"
                        >
                          Leave out of direct invites
                        </button>
                      )}
                    </div>
                    </div>
                    </div>
                  </li>
                ))}
              </ul>
              {removed.length > 0 && (
                <p className="m-0 mt-3 text-[11px] leading-relaxed text-[#6E6C67]">
                  {removed.length} left out of your direct invitations at your word. The anonymous notice on the board is unaffected,
                  and a left-out seat is filled by the next best evidenced vendor or service provider.
                </p>
              )}
            </>
          )}

          {/* What publish generates from this set. Stated, not teased: the
              machinery is real and named, and the buyer can read exactly what
              the act produces before deciding to perform it (R1a, R1b). */}
          {!published && clusterRows.length > 0 && (
            <div className="mt-6 border-t border-[#EAE7E1] pt-4">
              <p className="m-0 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#8C8A85]">Generates at publish</p>
              <ul className="m-0 mt-1.5 list-none space-y-1 p-0 text-[12.5px] leading-relaxed text-[#5F5D59]">
                <li>The ranked order of these {clusterRows.length} vendors and service providers against your requirement.</li>
                <li>The reason each one is in or out, named requirement by named requirement.</li>
                <li>Your indicative price band, computed under the Netify TCO methodology.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-7 lg:sticky lg:top-6 lg:rounded-[14px] lg:border lg:border-[#EAE7E1] lg:bg-white lg:p-5">

          {/* The market, live */}
          <div>
            <p className="m-0 mb-1.5 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-[#5F5D59]">
              The market, live <span className="text-right font-normal text-[#8C8A85]">movement is written</span>
            </p>
            <p className="m-0 mb-2 text-[11px] text-[#6E6C67]">
              {market ? (
                <>
                  {market.counts.notices > 0 && <span className="pd-breath mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-[#F5A21B] align-[0px]" />}
                  {market.counts.vendors} vendors and service providers evaluated{market.latest_evaluation ? `, latest ${fmtDate(market.latest_evaluation)}` : ""} · {market.counts.notices} notice{market.counts.notices === 1 ? "" : "s"} open ·{" "}
                  <a href="/sase/opportunities/board/" className="underline hover:text-[#141414]">the board</a>
                </>
              ) : "Reaching the market…"}
            </p>
            {/* Article 14: the movement explains itself beside the movement,
                written, naming the supplier. The scene itself is the Netify
                SASE Constellation band above the document; this pane is its
                written ledger. */}
            {marketRows.shown.some((v) => moveNow[v.slug]) && (
              <div className="mt-1 border-t border-[#F5F3EE] pt-1">
                {marketRows.shown.filter((v) => moveNow[v.slug]).map((v) => {
                  const mv = moveNow[v.slug];
                  return (
                    <p key={v.slug} className={`m-0 mb-0.5 text-[11px] leading-snug ${mv.dir === "down" ? "text-[#8C8A85]" : "text-[#5F5D59]"}`}>
                      {mv.dir === "up" ? `▲${mv.places > 0 ? ` +${mv.places}` : ""}` : mv.dir === "down" ? `▼${mv.places > 0 ? ` −${mv.places}` : ""}` : "· holds"}{" "}
                      {v.name} · {mv.label}: {gradeWord(mv.grade) || "no longer required"}
                      {mv.grade === "yes" || mv.grade === "partial" ? ` · evaluated ${fmtDate(mv.date)}` : ""}
                    </p>
                  );
                })}
              </div>
            )}
            {marketRows.more > 0 && (
              <p className="m-0 mt-1 text-[11px] text-[#8C8A85]">and {marketRows.more} more evaluated vendors and service providers, all in the running.</p>
            )}
            <p className="m-0 mt-1.5 text-[10px] leading-snug text-[#8C8A85]">
              {published
                ? "Every movement in the Constellation is written here the moment it happens, with its evidence and date. Nothing moves without a truthful answer to \u201cwhat changed?\u201d. Touch any vendor or service provider in the scene for its record."
                : "Every movement is written here the moment it happens, with its evidence and date. Nothing moves without a truthful answer to \u201cwhat changed?\u201d. The Constellation, which places these vendors and service providers by evidence against your requirement, is one of the things publishing generates."}
            </p>
            {vendorCard && (
              <div className="mt-2 rounded-md border border-[#EAE7E1] bg-[#FBFAF8] p-2.5">
                <button type="button" onClick={() => setVendorCard(null)} className="float-right text-[#8C8A85] hover:text-[#141414]">✕</button>
                <p className="m-0 text-[13px] font-semibold text-[#141414]">
                  {vendorCard.name}
                  {namedSlugs.has(vendorCard.slug) && <span className="ml-1.5 rounded-full bg-[#EAE7E1] px-1.5 text-[10px] font-normal text-[#5F5D59]">named in your position</span>}
                </p>
                <p className="m-0 mt-0.5 text-[11px] text-[#6E6C67]">{vendorCard.category}</p>
                <p className="m-0 mt-1 text-[11px] leading-relaxed text-[#5F5D59]">
                  Evaluated {fmtDate(vendorCard.last_verified)} · {vendorCard.yes_count} of 40 capabilities fully met.
                </p>
                {(() => {
                  /* Evidence language, never a score (the reference concept,
                     live): counts come straight from the graded checks. */
                  const fs = fitBySlug.get(vendorCard.slug);
                  if (!fs || !sceneRanked) return null;
                  const full = fs.matched.filter((m) => m.grade === "yes").length;
                  const part = fs.matched.length - full;
                  return (
                    <p className="m-0 mt-1 text-[11px] leading-relaxed text-[#5F5D59]">
                      Against your named requirements: {full} evidenced
                      {part > 0 ? `, ${part} partially evidenced` : ""}
                      {fs.missed.length > 0 ? `, ${fs.missed.length} without evidence on file` : ""}.
                      Missing evidence is a gap in the record, never a verdict.
                    </p>
                  );
                })()}
                {/* Article 14, the four answers: what changed, why it moved,
                    what evidence, and the challenge. */}
                {(() => {
                  const fs = fit?.suppliers.find((s) => s.slug === vendorCard.slug);
                  const mv = moveNow[vendorCard.slug];
                  const hist = moveLog.filter((l) => l.slug === vendorCard.slug).slice(-4).reverse();
                  return (
                    <>
                      {mv && (
                        <div className="mt-1.5 border-t border-[#EAE7E1] pt-1.5 text-[11px] leading-relaxed text-[#5F5D59]">
                          <p className="m-0"><b className="text-[#33302C]">What changed:</b> your requirement {mv.grade ? "gained" : "withdrew"} {mv.label}.</p>
                          <p className="m-0"><b className="text-[#33302C]">Why it moved:</b> {mv.label} is {gradeWord(mv.grade) || "no longer checked"} for {vendorCard.name}.</p>
                          <p className="m-0"><b className="text-[#33302C]">Evidence:</b> evaluated {fmtDate(vendorCard.last_verified)}.</p>
                        </div>
                      )}
                      {fs && (fs.matched.length > 0 || fs.missed.length > 0) && (
                        <div className="mt-1.5 text-[11px] leading-relaxed text-[#6E6C67]">
                          {fs.matched.length > 0 && <p className="m-0">Evidences: {fs.matched.map((m) => m.label).join(", ")}.</p>}
                          {fs.missed.length > 0 && <p className="m-0 text-[#8C8A85]">Not evidenced: {fs.missed.map((m) => m.label).join(", ")}.</p>}
                        </div>
                      )}
                      {hist.length > 0 && (
                        <div className="mt-1.5 text-[10px] leading-relaxed text-[#8C8A85]">
                          {hist.map((h, i) => (
                            <p key={i} className="m-0">{h.at} · {h.dir === "up" ? "rose" : h.dir === "down" ? "fell" : "held"} · {h.text}</p>
                          ))}
                        </div>
                      )}
                      <a href={`/sase/${vendorCard.slug}/`} className="mt-1 inline-block text-[11px] text-[#33302C] underline">
                        Challenge it: compare the evidence
                      </a>
                    </>
                  );
                })()}
                {!published && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {added.includes(vendorCard.slug) ? (
                      <button
                        type="button"
                        onClick={() => { setAdded((x) => x.filter((s) => s !== vendorCard.slug)); setVendorCard(null); }}
                        className="rounded-full border border-[#E3E0DA] px-2.5 py-1 text-[11px] text-[#5F5D59] hover:border-[#A3A099]"
                      >
                        Unpin
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAdded((x) => (x.includes(vendorCard.slug) ? x : [...x, vendorCard.slug]));
                          setRemoved((x) => x.filter((r) => r !== vendorCard.slug));
                          ev("workspace_supplier_added", { slug: vendorCard.slug });
                          setVendorCard(null);
                        }}
                        className="rounded-full border border-[#F5A21B] px-2.5 py-1 text-[11px] text-[#B4650B] hover:border-[#E5940F]"
                      >
                        Pin into invitations (up to five)
                      </button>
                    )}
                    {/* The distribution list is the buyer's (F3, 29 Jul 2026,
                        from the mockup review Robert approved): leaving a
                        supplier out governs the DIRECT invites only. The
                        anonymous public notice, the grading and this record
                        are untouched: an exclusion is distribution control,
                        never a judgement on the supplier. */}
                    {removed.includes(vendorCard.slug) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRemoved((x) => x.filter((s) => s !== vendorCard.slug));
                          ev("workspace_supplier_included", { slug: vendorCard.slug });
                          crewLog(`Registrar: back in the running for direct invites: ${vendorCard.name}`, "you");
                          setVendorCard(null);
                        }}
                        className="rounded-full border border-[#E3E0DA] px-2.5 py-1 text-[11px] text-[#5F5D59] hover:border-[#A3A099]"
                      >
                        Include again
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRemoved((x) => (x.includes(vendorCard.slug) ? x : [...x, vendorCard.slug]));
                          setAdded((x) => x.filter((s) => s !== vendorCard.slug));
                          ev("workspace_supplier_excluded", { slug: vendorCard.slug });
                          crewLog(`Registrar: left out of direct invites at your word: ${vendorCard.name} · the public notice is unaffected`, "you");
                          setVendorCard(null);
                        }}
                        className="rounded-full border border-[#E3E0DA] px-2.5 py-1 text-[11px] text-[#6E6C67] hover:border-[#A3A099] hover:text-[#33302C]"
                      >
                        Leave out of direct invites
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        {/* The Constellation is the ranked view, and a ranked view is the
            half of the coke that generates at publish (R1b). So it renders
            here once the notice is live and not before: distance IS fit, and
            showing it early would answer for free the question publishing is
            the route to. Nothing is hidden behind a padlock; it simply does
            not exist yet. */}
        {Boolean(published) && (<>

        {/* ---- The Netify SASE Constellation: the market takes position ---- */}
        <div className={`mx-auto mt-16 w-full ${started ? "" : "max-w-[880px]"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="m-0 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#6E6C67]">
              The Netify SASE Constellation
            </p>
            <p className="m-0 text-[11px] text-[#8C8A85]">
              distance is fit · every position computed from graded evidence · nothing moves except on its own evidence
              {" · "}
              <button type="button" onClick={() => setConstellationKey((o) => !o)} className="underline hover:text-[#5F5D59]">
                {constellationKey ? "close the key" : "how to read this"}
              </button>
            </p>
          </div>
          {/* The reading key (Harry's Section 1 ask, Robert's R3, 28 Jul 2026):
              every sentence traces to this component's own laws; nothing here
              promises what the map does not do. */}
          {constellationKey && (
            <div className="mt-2 rounded-md border border-[#EAE7E1] bg-white p-4 text-[11.5px] leading-relaxed text-[#5F5D59]">
              <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">You</span> are the dot at the centre. Everything on the map positions itself against your stated requirements.</p>
              <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Diamonds</span> are requirements created from your own words. Each one exists because you said it; strike the fact and its diamond goes with it.</p>
              <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Circles</span> are technology vendors. <span className="font-semibold text-[#33302C]">Squares</span> are managed service providers.</p>
              <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Distance is fit.</span> A vendor or service provider sits closer when its graded evidence against your named requirements is stronger. Before you name requirements, they all hold one honest ring, because there is nothing yet to rank them against.</p>
              <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Lines are evidence.</span> A line exists only where the Netify dataset grades that vendor or service provider for that requirement: solid means evidenced, dashed means partial. No line means no graded evidence, never a guess.</p>
              <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Movement.</span> A vendor or service provider moves only when its own evidence changes, and only towards or away from you. Nothing shuffles for effect.</p>
              <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Colour</span> follows the vendor or service provider, never its rank. Amber marks your market activity, such as who you invited. Emerald is reserved for advice given against Netify&rsquo;s own interest.</p>
              <p className="m-0"><span className="font-semibold text-[#33302C]">Hover</span> a vendor, a service provider or a requirement to isolate its evidence. The evidence source and its latest evaluation date sit beneath the map.</p>
            </div>
          )}
          {marketRows.shown.length === 0 && (
            <p className="m-0 mt-1 text-[11px] leading-relaxed text-[#8C8A85]">
              Empty until you describe your project. Then the evaluated market takes position around your words: the
              closest fit sits nearest, each vendor and service provider keeps its own fixed place and colour, and evidence draws the lines.
            </p>
          )}
          {marketRows.shown.length > 0 && (
            <svg
              viewBox={`0 0 ${SCENE.w} ${SCENE.h}`}
              className="mt-1 block w-full"
              role="img"
              aria-label="The Netify SASE Constellation: vendors and service providers positioned by evidence against your named requirements, capability lines where the dataset grades them"
              onMouseLeave={() => { setFocusV(null); setFocusC(null); }}
            >
              {/* Evidence lines: vendor to capability, only where a grade exists.
                  Re-keyed on the fit order so a re-rank fades the layer in while
                  bodies glide (no line ever points at a stale position for long). */}
              <g key={`lines:${fitSlugs.join(",")}:${capNodes.length}`} className="pd-emerge">
                {capNodes.length > 0 && sceneBodies.map((b) => {
                  const fs = fitBySlug.get(b.slug);
                  if (!fs) return null;
                  const hue = vendorHue(b.slug);
                  return fs.matched.map((m) => {
                    const cap = capById.get(m.id);
                    if (!cap) return null;
                    const focused = focusV === b.slug || focusC === m.id;
                    const faded = (focusV !== null || focusC !== null) && !focused;
                    const full = m.grade === "yes";
                    return (
                      <line
                        key={`${b.slug}:${m.id}`}
                        x1={b.x} y1={b.y} x2={cap.x} y2={cap.y}
                        stroke={hue}
                        strokeWidth={focused ? (full ? 1.9 : 1.5) : full ? 1.25 : 1}
                        strokeDasharray={full ? undefined : "5 4"}
                        opacity={faded ? 0.05 : focused ? 0.9 : 0.24}
                        style={{ transition: "opacity .25s" }}
                      />
                    );
                  });
                })}
              </g>
  
              {/* Your position, the centre. Breath only on a genuinely open notice. */}
              <circle
                cx={SCENE.cx} cy={SCENE.cy} r={7}
                className={published ? "pd-breath" : undefined}
                fill={started ? "#141414" : "none"}
                stroke={started ? "none" : "#8C8A85"}
                strokeDasharray={started ? undefined : "3 3"}
              />
              <text x={SCENE.cx} y={SCENE.cy + 20} fontSize={7.5} textAnchor="middle" fill="#8C8A85" style={{ letterSpacing: ".12em" }}>YOU</text>
  
              {/* Capability nodes: the requirements your own words created. */}
              {capNodes.map((c) => {
                const faded = (focusV !== null && !(fitBySlug.get(focusV)?.matched.some((m) => m.id === c.id))) || (focusC !== null && focusC !== c.id);
                const above = c.y <= SCENE.cy;
                return (
                  <g
                    key={c.id}
                    className="pd-emerge"
                    style={{ opacity: faded ? 0.22 : 1, transition: "opacity .25s", cursor: "default" }}
                    onMouseEnter={() => { setFocusC(c.id); setFocusV(null); }}
                  >
                    <rect x={c.x - 3.2} y={c.y - 3.2} width={6.4} height={6.4} transform={`rotate(45 ${c.x} ${c.y})`} fill="#141414" />
                    <text
                      x={c.x} y={(above ? c.y - 8 : c.y + 14) + (sceneLabels[c.id] ?? 0)}
                      fontSize={8}
                      textAnchor="middle"
                      fill="#33302C"
                    >{c.label.length > 30 ? `${c.label.slice(0, 29)}…` : c.label}</text>
                  </g>
                );
              })}
  
              {/* The suppliers: hue is the vendor, ink of the name is recency,
                  shape is what they are (circle a technology vendor, square a
                  managed provider), amber ring is invited. */}
              {sceneBodies.map((b) => {
                const v = marketRows.shown.find((s) => s.slug === b.slug);
                if (!v) return null;
                const isFit = shownFit.has(v.slug);
                const bright = v.last_verified === marketRows.latest && marketRows.latest !== "";
                const recent = !bright && marketRows.latest && daysBetween(v.last_verified, marketRows.latest) < 60;
                const dim = started && fitBuying && !isFit;
                const invited = invitedSet.has(v.slug);
                const hue = vendorHue(v.slug);
                const labelInk = bright ? "#141414" : recent ? "#52525b" : "#a8a29e";
                const size = bright || invited ? 5.5 : 4.8;
                const provider = /provider/i.test(v.category);
                const faded = (focusV !== null && focusV !== b.slug) || (focusC !== null && !(fitBySlug.get(b.slug)?.matched.some((m) => m.id === focusC)));
                const anchorEnd = b.x > SCENE.w - 120 ? true : b.x < 120 ? false : Math.cos((b.angle * Math.PI) / 180) < 0;
                const name = v.name.length > 22 ? `${v.name.slice(0, 21)}…` : v.name;
                return (
                  <g
                    key={b.slug}
                    className="pd-move pd-emerge"
                    style={{ transform: `translate(${b.x}px, ${b.y}px)`, cursor: "pointer", opacity: faded ? 0.16 : dim ? 0.38 : 1, transition: "transform .6s cubic-bezier(.34,1.56,.64,1), opacity .25s" }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${v.name}, evaluated ${fmtDate(v.last_verified)}`}
                    onClick={() => setVendorCard(v)}
                    onKeyDown={(e) => { if (e.key === "Enter") setVendorCard(v); }}
                    onMouseEnter={() => { setFocusV(b.slug); setFocusC(null); }}
                  >
                    {invited && (
                      <>
                        <line x1={0} y1={0} x2={SCENE.cx - b.x} y2={SCENE.cy - b.y} stroke="#F5A21B" strokeWidth={1.3} opacity={0.5} />
                        <circle r={size + 3.2} fill="none" stroke="#F5A21B" strokeWidth={1.4} className={published ? "pd-breath" : undefined} />
                      </>
                    )}
                    {added.includes(v.slug) && <circle r={size + 3} fill="none" stroke="#8C8A85" strokeWidth={0.8} />}
                    {provider ? (
                      <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={1.5} fill={hue} />
                    ) : (
                      <circle r={size} fill={hue} />
                    )}
                    <text
                      x={anchorEnd ? -(size + 5) : size + 5}
                      y={3 + (sceneLabels[b.slug] ?? 0)}
                      fontSize={9}
                      textAnchor={anchorEnd ? "end" : "start"}
                      fill={labelInk}
                      style={namedSlugs.has(v.slug) ? { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" } : undefined}
                    >{name}</text>
                  </g>
                );
              })}
            </svg>
          )}
          <p className="m-0 mt-1 text-[11px] leading-snug text-[#8C8A85]">
            {capNodes.length > 0 ? (
              <>Diamonds are the requirements your own words created; a line exists only where Netify&rsquo;s dataset grades that vendor or service provider for that requirement (solid evidenced, dashed partial). Hover any of them, or a requirement, to isolate its evidence. Circles are technology vendors, squares managed providers.</>
            ) : (
              <>Name what you need and the market takes position around it: your requirements appear here as points of gravity, with a line from every vendor and service provider the evidence supports. Circles are technology vendors, squares managed providers; nothing sits closer than the evidence puts it.</>
            )}
            {market?.latest_evaluation ? ` Evidence: Netify vendor dataset, live · latest evaluation ${fmtDate(market.latest_evaluation)}.` : ""}
          </p>
        </div>
        </>)}

        </div>
      </div>

      <div className="mt-14 border-t border-[#EAE7E1] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="m-0 max-w-xl text-[12px] leading-relaxed text-[#6E6C67]">
            {ready ? "Your requirement holds enough to stand on." : publishBarLock}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => goToStep(1)} className="text-[12px] text-[#6E6C67] underline hover:text-[#141414]">
              Back to your requirement
            </button>
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="rounded-full bg-[#141414] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#33302C]"
            >
              Continue to publish
            </button>
          </div>
        </div>
      </div>

      </>)}


      {shownStep === 3 && (<>

      {/* ---- Step three, the glass front. The notice preview stands first
              as Compare the Market's "check your answers" does: it is the
              buyer's own content, public by design once live, so it is fully
              visible before publish (R1b). The value list, the core-five gate
              and the GDPR acceptance line arrive with P2. ---- */}

      {/* ---- The listing in formation (Robert, 23 Jul: the opportunity
              listing returns to the top): the notice as the market will see
              it, updating with every sentence. Example-labelled until the
              buyer starts; anonymous always; never publishes by itself. ---- */}
      <div className="mx-auto mt-5 w-[min(760px,100%)]">
        <section aria-label="Your opportunity, as the market will see it" className={`rounded-xl border p-5 ${published ? "border-[#F2DFB6] bg-[#FFFDF7]" : "border-[#EAE7E1] bg-white"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="m-0 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#8C8A85]">
              {published ? (<><span className="pd-breath mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-[#F5A21B] align-[0px]" />Published · live on the board</>) : started ? "Your opportunity · as the market will see it" : "Example listing"}
            </p>
            <span className={`rounded-full px-2 py-[1px] text-[10px] font-mono font-semibold uppercase tracking-[.08em] ${published ? "border border-[#F2DFB6] bg-[#FFF7E8] text-[#8A4D08]" : started ? "bg-[#F0EEE9] text-[#6E6C67]" : "border border-[#EAE7E1] bg-white text-[#6E6C67]"}`}>
              {published ? "open on the board" : started ? "updating as you speak" : "make it yours"}
            </span>
          </div>
          <p className={`m-0 mt-1.5 text-[15px] font-semibold leading-snug ${started ? "text-[#141414]" : "text-[#8C8A85]"}`}>
            {started ? publishTitle : "SASE and SD-WAN transformation · UK retailer"}
          </p>
          {/* The facts as chips (the 24 Jul translation of "tag nodes"): each
              carries its real provenance in the ink language (solid border
              stated, dotted inferred) and opens its own section on touch. No
              emojis, no confidence numbers: provenance IS the confidence. */}
          {(() => {
            const B = { sase: "SASE", sdwan: "SD-WAN", sse: "SSE", managed_security: "managed security" } as Record<string, string>;
            const chips: { v: string; paths: string[]; sec: string }[] = started
              ? ([
                  { v: requirement.organisation?.sector ?? "", paths: ["organisation.sector"], sec: "organisation" },
                  { v: usersBandLabel(requirement.estate?.users) ?? "", paths: ["estate.users"], sec: "organisation" },
                  { v: typeof requirement.estate?.sites === "number" ? `${requirement.estate.sites} sites` : "", paths: ["estate.sites"], sec: "organisation" },
                  { v: buying ? B[buying] ?? buying : "", paths: ["procurement.buying"], sec: "objectives" },
                  { v: opModel === "managed" ? "Fully managed" : opModel === "co_managed" ? "Co-managed" : "", paths: ["procurement.operatingModel"], sec: "model" },
                  { v: (requirement.organisation?.regions ?? []).map((r) => regionStandalone(r)).join(", "), paths: ["organisation.regions"], sec: "organisation" },
                  { v: (requirement.constraints?.complianceRequirements ?? []).map((c) => COMPLIANCE_LABELS[c] ?? c).join(", "), paths: ["constraints.complianceRequirements"], sec: "compliance" },
                ].filter((c) => c.v))
              : [
                  { v: "Retail", paths: [], sec: "organisation" },
                  { v: "1,900 users", paths: [], sec: "organisation" },
                  { v: "42 sites", paths: [], sec: "organisation" },
                  { v: "UK", paths: [], sec: "organisation" },
                  { v: "SASE and SD-WAN", paths: [], sec: "objectives" },
                  { v: "Fully managed", paths: [], sec: "model" },
                  { v: "PCI DSS", paths: [], sec: "compliance" },
                ];
            if (!chips.length) {
              return <p className="m-0 mt-1 text-[11px] leading-relaxed text-[#5F5D59]">your first sentence starts this listing</p>;
            }
            return (
              <p className="m-0 mt-1.5 leading-loose">
                {chips.map((c) => {
                  const pf = c.paths.length ? facts.find((f) => !f.struck && c.paths.includes(f.path)) : undefined;
                  const prov = pf?.provenance;
                  const cls = !started
                    ? "border-[#EAE7E1] text-[#8C8A85]"
                    : prov === "stated"
                      ? "border-[#141414] text-[#33302C]"
                      : prov === "inferred"
                        ? "border-dotted border-[#141414] text-[#33302C]"
                        : "border-[#EAE7E1] text-[#5F5D59]";
                  return (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => {
                        ev("workspace_card_chip", { sec: c.sec });
                        document.getElementById(`sec-${c.sec}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      title={
                        !started
                          ? "Example content · opens the section it lives in"
                          : prov === "stated"
                            ? "Your words · opens the section it lives in"
                            : prov === "inferred"
                              ? "Inferred, reason attached · opens the section it lives in"
                              : "Opens the section it lives in"
                      }
                      className={`mr-1.5 inline-block rounded-full border bg-white px-2.5 py-[2px] text-[11px] transition-colors hover:border-[#F5A21B] ${cls}`}
                    >
                      {c.v}
                    </button>
                  );
                })}
              </p>
            );
          })()}
          <p className="m-0 mt-1.5 text-[11px] text-[#8C8A85]">
            {published && published.boardId
              ? (<>published: signed-in vendors and service providers can now see your anonymous notice · <a href={`/sase/opportunities/${published.boardId}`} className="underline">see it on the board</a></>)
              : started
              ? "anonymous on publish: no name, no contacts · signed-in vendors and service providers see it, never public visitors · nothing is sent without your signature"
              : "a worked example · it becomes yours the moment you speak, paste or touch the document below · never publishes"}
          </p>
        </section>
      </div>

          {/* ---- The signature: where the document ends ---- */}
          <div id="pd-signature" className="mt-6 border-t border-[#EAE7E1] pt-5" style={{ scrollMarginTop: "70px" }}>
            {/* ---- What publishing generated (Harry's read, 30 Jul 2026:
                    "no visible place to see which suppliers Netify considers
                    a fit"). He was right, and it was worse than a gap: once
                    published, this whole block rendered NOTHING, so the
                    ranked shortlist the front page and step two both promise
                    did not exist on any screen. This is the promise kept.
                    The order is the fit engine's own ranking, the reason is
                    the named requirements each supplier is evidenced
                    against, and the invited list is what the publish route
                    actually returned, never a claim. ---- */}
            {published && (
              <div className="rounded-lg border-2 border-[#F2DFB6] bg-white p-5">
                <p className="m-0 mb-1 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#B4650B]">Your shortlist</p>
                {payoutRows.length > 0 ? (
                  <>
                    <p className="m-0 mb-3 text-[14px] leading-relaxed text-[#141414]">
                      {payoutRows.length} evaluated {payoutRows.length === 1 ? "vendor or service provider" : "vendors and service providers"} ranked against your requirement
                      {published.invited.length > 0
                        ? <>, and {published.invited.length} invited directly.</>
                        : <>. Signed in approved vendors and service providers see your notice on the board.</>}
                    </p>
                    <ol className="m-0 list-none p-0">
                      {payoutRows.map((r, i) => (
                        <li key={r.slug} className="border-t border-[#F5F3EE] py-2.5 first:border-t-0 first:pt-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="font-mono text-[11px] text-[#8C8A85]">{String(i + 1).padStart(2, "0")}</span>
                            <a href={`/sase/vendors/${r.slug}/`} className="text-[14px] font-semibold text-[#141414] underline decoration-[#C9C5BC] underline-offset-2 hover:decoration-[#141414]">
                              {r.name}
                            </a>
                            <span className="text-[11px] text-[#6E6C67]">{r.category} · graded {fmtDate(r.graded)}</span>
                            {r.invited && (
                              <span className="rounded-full bg-[#FFF7E8] px-1.5 py-[1px] text-[10px] font-mono font-semibold uppercase tracking-[.08em] text-[#8A4D08]">invited</span>
                            )}
                          </div>
                          {r.matched.length > 0 ? (
                            <details className="group mt-0.5 pl-6">
                              <summary className="cursor-pointer list-none text-[11.5px] leading-relaxed text-[#5F5D59] marker:hidden hover:text-[#8A4D08]">
                                Evidenced for {r.matched.slice(0, 3).join(", ")}
                                {r.matched.length > 3 ? ` and ${r.matched.length - 3} more` : ""}.{" "}
                                <span className="text-[#8C8A85] underline group-open:hidden">why this position</span>
                              </summary>
                              {/* Why it ranks HERE, in the engine's own terms
                                  (Harry asked for the rationale, not just the
                                  evidence line). Counts are the fit engine's,
                                  never a narrative. */}
                              <p className="m-0 mt-1 text-[11.5px] leading-relaxed text-[#5F5D59]">
                                Position {i + 1} of {payoutRows.length}. Ranked on {r.matched.length} of your named requirement
                                {r.matched.length === 1 ? "" : "s"} met with graded evidence
                                {r.missed.length > 0 ? `, and ${r.missed.length} not evidenced` : ""}. Across the whole dataset this
                                record fully meets {r.yes} of 40 capabilities. Its record was graded {fmtDate(r.graded)}.
                              </p>
                              <p className="m-0 mt-1 text-[11.5px] leading-relaxed text-[#5F5D59]">
                                <span className="font-semibold text-[#33302C]">Evidenced for:</span> {r.matched.join(", ")}.
                              </p>
                              {r.missed.length > 0 && (
                                <p className="m-0 mt-1 text-[11.5px] leading-relaxed text-[#6E6C67]">
                                  <span className="font-semibold text-[#5F5D59]">Not evidenced for:</span> {r.missed.join(", ")}.
                                </p>
                              )}
                              <p className="m-0 mt-1 text-[11.5px]">
                                <a href={`/sase/vendors/${r.slug}/`} className="text-[#33302C] underline hover:text-[#8A4D08]">
                                  Read the full record, with every source behind these grades
                                </a>
                              </p>
                            </details>
                          ) : (
                            <p className="m-0 mt-0.5 pl-6 text-[11.5px] leading-relaxed text-[#6E6C67]">
                              On the curated market for this scope. No graded evidence against your named requirements yet.
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                    <p className="m-0 mt-3 text-[11px] leading-relaxed text-[#6E6C67]">
                      Ranked by graded evidence against the requirements your own words created. Every grade carries its
                      date and its source on the vendor record.
                    </p>
                  </>
                ) : (
                  <p className="m-0 text-[13px] leading-relaxed text-[#5F5D59]">
                    Your notice is live on the board. Nothing has been graded against these requirements yet, so
                    there is no ranking to show rather than a ranking built on nothing.
                  </p>
                )}
                {created?.id && (
                  <p className="m-0 mt-3 text-[12px] leading-relaxed text-[#33302C]">
                    <a className="underline hover:text-[#8A4D08]" href={`/sase/project/${created.id}${created.manage ? `?manage=${encodeURIComponent(created.manage)}` : ""}`}>
                      Open your project record
                    </a>{" "}
                    to see responses as they arrive.
                  </p>
                )}
              </div>
            )}

            {!published && !created?.test && (
              <div className={ready ? "rounded-lg border-2 border-[#F2DFB6] bg-white p-5" : ""}>
                {ready ? (
                  <>
                    {/* Plain heading, countable sentence (Harry's Section 1
                        finding, 28 Jul 2026: "ready to meet the market" read
                        as AI flourish; the copy law counts before it claims). */}
                    <p className="m-0 mb-1 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#B4650B]">Sign and publish</p>
                    <p className="m-0 mb-2 text-[15px] leading-relaxed text-[#141414]">Signing publishes the anonymous notice and sends your position, {live.length} claim{live.length === 1 ? "" : "s"}, to matched vendors and service providers.</p>
                    {/* The four promises beside the publish control (Robert's
                        Ruling Three, 29 Jul 2026: a promise made after the
                        decision is worthless, so it stands at the decision).
                        One quiet shield, the ruled wording from
                        lib/publish-promises (PROVISIONAL pending Harry), the
                        notice-specific read-back kept beneath it, and the
                        vetting claim linked to the published standard so it
                        is checkable, not asserted. */}
                    <div className="mb-2 flex items-start gap-2 rounded-md bg-[#FBFAF8] px-3 py-2.5">
                      <svg width="14" height="16" viewBox="0 0 14 16" className="mt-[1px] shrink-0" aria-hidden="true">
                        <path d="M7 1 L13 3.2 V8 C13 11.8 10.4 14.2 7 15 C3.6 14.2 1 11.8 1 8 V3.2 Z" fill="none" stroke="#a16207" strokeWidth="1.3" />
                        <path d="M4.6 8 L6.4 9.8 L9.6 6.2" fill="none" stroke="#a16207" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      <p className="m-0 text-[11px] leading-relaxed text-[#5F5D59]">
                        <span className="font-semibold text-[#33302C]">Your project publishes anonymously.</span>{" "}
                        Nobody browsing Netify, and no search engine, sees your company name or your contact details
                        {requirement.organisation?.sector || usersBandLabel(requirement.estate?.users)
                          ? ` (the notice reads ${[requirement.organisation?.sector, usersBandLabel(requirement.estate?.users)].filter(Boolean).join(", ")}, nothing more)`
                          : ""}
                        . Only vendors and service providers we have <a href="/sase/supplier-vetting-standard/" className="underline" target="_blank" rel="noreferrer">vetted</a> can respond, and your details are never shared with anyone we have not vetted. You choose which of them receive your contact details, and when. Assumptions publish labelled as assumptions; example content never publishes at all.
                      </p>
                    </div>
                    {/* Three facts about where this goes, each from live data,
                        none invented. */}
                    <div className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <div className="rounded-md bg-[#FBFAF8] px-3 py-2.5">
                        <p className="m-0 text-[15px] font-bold leading-tight tracking-tight text-[#141414]">
                          {fitSlugs.length > 0 ? fitSlugs.length : market?.counts.vendors ?? "Evaluated"}
                        </p>
                        <p className="m-0 mt-0.5 text-[11px] leading-snug text-[#6E6C67]">
                          {fitSlugs.length > 0
                            ? `evaluated ${fitSlugs.length === 1 ? "vendor or service provider" : "vendors and service providers"} currently in the running, evidence graded with dates${removed.length ? `; ${removed.length} left out at your word` : ""}`
                            : "vendors and service providers on the curated market, evidence graded with dates"}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#FBFAF8] px-3 py-2.5">
                        <p className="m-0 text-[15px] font-bold leading-tight tracking-tight text-[#141414]">Anonymous</p>
                        <p className="m-0 mt-0.5 text-[11px] leading-snug text-[#6E6C67]">sector and size only; your identity and contacts never publish</p>
                      </div>
                      <div className="rounded-md bg-[#FBFAF8] px-3 py-2.5">
                        <p className="m-0 text-[15px] font-bold leading-tight tracking-tight text-[#141414]">Yours to close</p>
                        <p className="m-0 mt-0.5 text-[11px] leading-snug text-[#6E6C67]">the notice closes from your project record whenever you choose</p>
                      </div>
                    </div>
                    {/* Slice three (the reference concept): the notice inherits
                        your standing facts exactly as written, shown before you
                        sign, with what stays private beside it. */}
                    {/* Renamed from "The notice inherits" (Harry's Section 1
                        finding, 28 Jul 2026: the heading hid its point). The
                        point: these words carry onto the public notice
                        exactly as written. */}
                    <p className="m-0 mb-1 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#8C8A85]">What the notice carries</p>
                    {/* The sites chip shows what the PUBLIC notice will show
                        (exact unless identifying, Robert's ruling 29 Jul
                        2026): when sector plus a single region would make an
                        exact count identifying, the chip carries the range
                        the notice will carry, and the caption says so.
                        Everything else carries exactly as written. */}
                    <p className="m-0 mb-1.5 text-[11px] leading-loose">
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
                        <span key={String(chip)} className="mr-1.5 inline-block rounded-full border border-[#EAE7E1] bg-white px-2 py-[1px] text-[11px] text-[#33302C]">{chip}</span>
                      ))}
                      <span className="text-[11px] text-[#8C8A85]">
                        {typeof requirement.estate?.sites === "number" && siteFigureIsIdentifying({ buyer_sector: requirement.organisation?.sector ?? "", regions: requirement.organisation?.regions ?? [] })
                          ? "as written, except the site count: sector plus one region could identify you, so the notice shows the range, and the exact count is seen only after the gate"
                          : "exactly as written, nothing retyped"}
                      </span>
                    </p>
                    <p className="m-0 mb-2 text-[11px] leading-relaxed text-[#8C8A85]">
                      <span className="font-semibold text-[#6E6C67]">Stays private:</span> your identity and contacts, your notes,
                      {unansweredGaps.length > 0 ? ` ${unansweredGaps.length} unanswered question${unansweredGaps.length === 1 ? "" : "s"} (published only as labelled assumptions if you accept them),` : ""}
                      {" "}and anything you have struck from the record.
                    </p>
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
                      disabled={!consentsOk || Boolean(signStage) || (testMode && !securityScope)}
                      className="mt-1 w-full rounded-full bg-[#F5A21B] px-5 py-2.5 text-[13px] font-bold text-[#141414] transition-colors hover:bg-[#E5940F] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                    >
                      {signStage ?? (testMode ? "Sign · create the test position" : "Generate and publish")}
                    </button>
                    {/* A disabled control must say why it is disabled. Until
                        30 Jul 2026 this button was live for a network
                        requirement under ?test=1, did nothing at all on
                        click, and only then wrote the reason into signError.
                        The reason now stands beside the button instead. */}
                    {testMode && !securityScope && (
                      <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-[#B4650B]">
                        Test mode covers the security engine today, and this is a network requirement. Drop{" "}
                        <span className="font-mono">?test=1</span> from the address to publish it for real.
                      </p>
                    )}
                    {signError && <p className="m-0 mt-1.5 text-[11px] text-red-600">{signError}</p>}
                    {/* The identity read-back (29 Jul 2026, from the mockup
                        review's two adopted pieces: the identity chip and the
                        resolve-the-company card, fused into one quiet line).
                        A work address shows who the publish will verify as
                        and the company Netify derives from the domain, so
                        nobody types a name we cannot check. A personal
                        address hears the refusal HERE, before the click,
                        with the ruled reassurance that nothing is lost.
                        Advisory only: the publish chain remains the gate. */}
                    {signedIn && sessId && (
                      sessId.work ? (
                        <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-[#6E6C67]">
                          Publishing as <span className="font-medium text-[#33302C]">{sessId.email}</span>
                          {sessId.company ? <> · {sessId.company}, resolved from your email domain. Nobody types a company name we cannot check.</> : "."}
                        </p>
                      ) : (
                        <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-[#B4650B]">
                          Signed in as {sessId.email}, a personal address. Publishing needs a work email; everything here stays saved while you switch.
                        </p>
                      )
                    )}
                    {removed.length > 0 && (
                      <p className="m-0 mt-1 text-[11px] leading-relaxed text-[#6E6C67]">
                        Direct invites leave out {removed.length} {removed.length === 1 ? "vendor or service provider" : "vendors and service providers"} at your word; the ranked fill tops back up
                        from the next best evidenced. The anonymous public notice is unaffected.
                      </p>
                    )}
                    {needAuth && (
                      <div className="mt-2 rounded-md bg-[#FBFAF8] p-3">
                        <p className="m-0 mb-1 text-[11px] text-[#5F5D59]">
                          One step first: publishing reaches named vendors and service providers, so it needs a verified sign-in. Your position is untouched.
                        </p>
                        <SignIn
                          role="buyer"
                          prompt="Verify yourself to publish."
                          onAuthed={() => {
                            // Their signature press already happened and the
                            // consents are still ticked; verification was the
                            // only gap, so publishing continues by itself.
                            setSignedIn(true);
                            setNeedAuth(false);
                            // Refresh the identity read-back with who just
                            // signed in, so the line under the button is
                            // true for the session that will publish.
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
                  </>
                ) : (
                  <div className="rounded-lg border border-[#E3E0DA] bg-[#FBFAF8] p-5">
                  <p className="m-0 mb-1 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#6E6C67]">Not ready to publish</p>
                  <p className="m-0 text-[13px] leading-relaxed text-[#5F5D59]">
                    <span className="font-semibold text-[#33302C]">A person signs here.</span> One signature publishes an anonymous notice to the open board and the full position to matched vendors and service providers.{" "}
                    {lockReason ?? "It unlocks when the position holds enough truth to stand on."}
                  </p>
                  </div>
                )}
              </div>
            )}
            {created?.test && !published && (
              <div className="rounded-lg border border-[#F5A21B] bg-[#FFF7E8] p-4">
                <p className="m-0 text-[13px] font-semibold text-[#8A4D08]">Test position created; publishing stayed off</p>
                <p className="m-0 mt-1 text-[11px] leading-relaxed text-[#8A4D08]">
                  It self-expires in two hours, touched no live board and contacted no vendor or service provider.{" "}
                  <a href={`/sase/project/${created.id}?manage=${encodeURIComponent(created.manage)}`} className="underline">Inspect it</a> or{" "}
                  <button type="button" onClick={startAfresh} className="underline">start a real one</button>.
                </p>
              </div>
            )}

          </div>

      </>)}

      </>)}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces (top-level, so focus survives re-renders)                    */
/* ------------------------------------------------------------------ */

/** One line of the framework, and the tap target for its own answer (1a).
 *  The four truth classes still render distinctly: example grey, stated the
 *  buyer's touch in solid ink, inferred dotted with its reason, struck out.
 *  What a CHOICE adds is the Orange rule beneath it. The border never
 *  thickens and no state changes the line's height, so choosing something
 *  never moves the line under the finger. */
function ItemLine(props: {
  label: string;
  state: "example" | "exampleStruck" | "option" | "stated" | "inferred" | "struck" | "noted";
  fact?: WorkspaceFact;
  /** The buyer's own words, where this line is the words themselves (1f). */
  quote?: string;
  /** A quiet note after the label (an example's history, an answer's home). */
  trailing?: string;
  /** 1b: ranked first for this sector, one size up, with the reason. */
  lead?: boolean;
  reason?: string;
  flashing: boolean;
  disabled: boolean;
  title: string;
  onClick: () => void;
}) {
  const { label, state, fact, lead } = props;
  const chosen = state === "stated" || state === "noted";
  const mark = chosen || state === "inferred" ? "✓" : state === "struck" || state === "exampleStruck" ? "×" : state === "example" ? "✓" : "·";
  const markCls =
    chosen ? "text-[#F5A21B]"
    : state === "inferred" ? "text-[#33302C]"
    : state === "struck" || state === "exampleStruck" ? "text-[#A3A099]"
    : state === "example" ? "text-[#A3A099]"
    : "text-[#A3A099] group-hover:text-[#F5A21B]";
  const labelCls =
    chosen ? "border-b border-[#F5A21B] text-[#141414]"
    : state === "inferred" ? "border-b border-dotted border-[#A3A099] text-[#33302C]"
    : state === "struck" || state === "exampleStruck" ? "text-[#A3A099] line-through"
    : state === "example" ? "text-[#A3A099]"
    : "text-[#A3A099] group-hover:text-[#141414]";
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.title}
      className={`group block w-full rounded-[6px] py-[3px] text-left leading-snug hover:bg-[#FDFCFA] ${lead ? "text-[14px]" : "text-[13px]"} ${props.flashing ? "pd-ink" : ""}`}
    >
      <span className={`mr-2 inline-block w-3 text-center text-[11px] ${markCls}`}>{mark}</span>
      <span className={labelCls}>{label}</span>
      {state === "example" && <span className="ml-2 text-[10px] text-[#A3A099]">example</span>}
      {state === "exampleStruck" && <span className="ml-2 text-[10px] text-[#A3A099]">example · {props.trailing}</span>}
      {state === "noted" && (
        <span className="ml-2 text-[11px] text-[#6E6C67]">
          {props.quote ? "your words, kept as you said them" : (props.trailing ?? "noted with your position")}
        </span>
      )}
      {state === "stated" && fact && (
        <span className="ml-2 text-[11px] text-[#6E6C67]"><em>&ldquo;{fact.quote ?? label}&rdquo;</em></span>
      )}
      {state === "inferred" && fact && (
        <span className="ml-2 text-[11px] text-[#6E6C67]">{fact.reason ?? "inferred"}</span>
      )}
      {lead && props.reason && (
        <span className="mt-[1px] block pl-5 text-[11.5px] leading-snug text-[#8C8A85]">{props.reason}</span>
      )}
    </button>
  );
}

/** The open question, above the list that answers it (1a), saying plainly
 *  whether it takes one answer or several (1b). It carries no options of
 *  its own: the candidate lines below ARE the options. */
function OpenQuestion(props: {
  question: string;
  count: "one" | "any";
  hint?: string;
  evidence?: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="mb-1 mt-1.5" title={props.evidence}>
      <div className="flex items-baseline gap-2">
        <span className="inline-block w-3 flex-none text-center text-[11px] font-bold text-[#B4650B]">?</span>
        <span className="flex-1 text-[13.5px] leading-snug text-[#B4650B]">{props.question}</span>
        <span className="flex-none rounded-[4px] bg-[#FFF7E8] px-[6px] py-[2px] font-mono text-[10px] uppercase tracking-[.07em] text-[#8A4D08]">
          {props.count === "one" ? "Pick one" : "Pick any"}
        </span>
        {props.onDismiss && (
          <button type="button" onClick={props.onDismiss} className="flex-none text-[11px] text-[#8C8A85] hover:text-[#141414]" title="Not relevant to this project">✕</button>
        )}
      </div>
      {props.hint && <p className="m-0 ml-5 mt-[2px] text-[11.5px] leading-snug text-[#A3A099]">{props.hint}</p>}
    </div>
  );
}

/** 1f: answer in your own words. The typing sits with the candidates, not
 *  behind them. What is typed is kept exactly as it was typed; Netify's
 *  technical wording sits beneath it and never over it. */
function OwnWordsRow(props: {
  sectionKey: string;
  /** The open question this row answers, where there is one. */
  question?: string;
  placeholder: string;
  tech: string;
  onCommit: (text: string) => void;
}) {
  const [val, setVal] = useState("");
  const commit = () => {
    if (!val.trim()) return;
    props.onCommit(val);
    setVal("");
  };
  return (
    <div className="mt-1.5 border-t border-[#F0EEE9] pt-1.5">
      <div className="flex items-center gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          placeholder={props.placeholder}
          aria-label={props.question ?? `Answer in your own words: ${props.sectionKey}`}
          className="min-w-0 flex-1 border-b border-dashed border-[#E3E0DA] bg-transparent py-[2px] text-[13px] text-[#141414] outline-none placeholder:text-[#A3A099] focus:border-[#F5A21B]"
        />
        <button
          type="button"
          onClick={commit}
          className="flex-none rounded-[7px] border border-[#E3E0DA] bg-white px-2.5 py-[3px] text-[12px] font-semibold text-[#141414] transition-colors hover:border-[#141414]"
        >
          Add
        </button>
      </div>
      <p className="m-0 mt-[3px] text-[11px] leading-snug text-[#8C8A85]">
        Kept in your words. Vendors and service providers are asked to answer on {props.tech}.
      </p>
    </div>
  );
}

/** The Organisation section: fields, example values retiring on real facts. */
function OrganisationFields(props: {
  facts: WorkspaceFact[];
  isLive: boolean;
  flash: Set<string>;
  onStrike: (id: string) => void;
}) {
  const { facts, isLive } = props;
  const one = (path: AllowedPath) => {
    const xs = facts.filter((f) => f.path === path);
    return xs[xs.length - 1];
  };
  const regions = facts.filter((f) => f.path === "organisation.regions");
  const rows: Array<{ k: string; fact?: WorkspaceFact; facts?: WorkspaceFact[]; ex: string; was?: string }> = [
    { k: "Industry", fact: one("organisation.sector"), ex: ORGANISATION_EXAMPLES[0].v },
    { k: "Users", fact: one("estate.users"), ex: ORGANISATION_EXAMPLES[1].v },
    { k: "Sites", fact: one("estate.sites"), ex: ORGANISATION_EXAMPLES[2].v, was: ORGANISATION_EXAMPLES[2].was },
    { k: "Countries", facts: regions, ex: ORGANISATION_EXAMPLES[3].v },
  ];
  return (
    <div>
      {rows.map((r) => {
        const fs = r.facts ?? (r.fact ? [r.fact] : []);
        return (
          <div key={r.k} className="flex items-baseline gap-2 py-[3px] text-[13px] leading-snug">
            <span className="w-[72px] flex-none text-[11px] text-[#6E6C67]">{r.k}</span>
            {fs.length === 0 ? (
              <span className={isLive ? "text-[11px] text-[#A3A099]" : "text-[#A3A099]"}>
                {isLive ? "not stated" : r.ex}
                {!isLive && r.was && <span className="ml-2 text-[10px] text-[#A3A099]">example · {r.was}</span>}
              </span>
            ) : (
              <span className="flex flex-wrap items-baseline gap-x-2">
                {fs.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => props.onStrike(f.id)}
                    title={f.struck ? "Restore" : "One tap strikes"}
                    className={`${props.flash.has(f.id) ? "pd-ink" : ""} ${
                      f.struck
                        ? "text-[#A3A099] line-through"
                        : f.provenance === "stated"
                          ? "border-b border-[#F5A21B] text-[#141414]"
                          : "border-b border-dotted border-[#A3A099] text-[#33302C]"
                    }`}
                  >
                    {f.path === "organisation.regions" ? regionStandalone(String(f.value)) : String(f.value)}
                  </button>
                ))}
                {fs[0] && !fs[0].struck && (
                  <span className="text-[11px] text-[#6E6C67]">
                    {fs[0].provenance === "stated" ? <em>&ldquo;{fs[0].quote ?? String(fs[0].value)}&rdquo;</em> : (fs[0].reason ?? "inferred")}
                  </span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A question with a figure of its own: a site count, a date, a band. It is
 *  not a choice between candidates, so it keeps its own field and never had
 *  a chip cloud to lose. Choices are answered by the list above it (1a). */
function GapLine(props: { gap: BriefGap; onAnswer: (gap: BriefGap, value: string, label?: string) => void }) {
  const { gap } = props;
  const [val, setVal] = useState("");
  return (
    <div className="py-[3px]">
      <div className="flex items-baseline gap-2 text-[13px] leading-snug text-[#B4650B]">
        <span className="inline-block w-3 flex-none text-center text-[11px] font-bold">?</span>
        <span>{gap.question}</span>
      </div>
      {gap.path ? (
        <div className="ml-5 mt-1 flex items-center gap-2">
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && val.trim() && props.onAnswer(gap, val.trim())}
            inputMode={gap.control === "number" ? "numeric" : undefined}
            placeholder={gap.control === "number" ? "0" : "type it"}
            className="w-28 border-b border-dashed border-[#E3E0DA] bg-transparent px-1 py-0.5 text-[13px] text-[#141414] outline-none focus:border-[#F5A21B]"
            aria-label={gap.question}
          />
          <button
            type="button"
            onClick={() => val.trim() && props.onAnswer(gap, val.trim())}
            className="rounded-[7px] border border-[#E3E0DA] bg-white px-2.5 py-[3px] text-[12px] font-semibold text-[#141414] transition-colors hover:border-[#141414]"
          >
            Add
          </button>
        </div>
      ) : (
        <p className="m-0 ml-5 mt-0.5 text-[11px] text-[#6E6C67]">Accepted at the signature; publishes as a stated assumption.</p>
      )}
    </div>
  );
}


/** The artefact, rendered for reading (Harry's Section 1 finding, 28 Jul
 *  2026: the printout rendered raw markdown in a pre). The generator's
 *  markdown is untouched, and stays what the download button saves and
 *  what machines read; this renderer only gives the same lines type:
 *  headings as headings, list rows as rows, and the provenance marks
 *  ([stated], [inferred], [stated by selection]) as small chips. */
function ArtefactPrint({ text }: { text: string }) {
  const mark = (s: string, i: number) => {
    const parts = s.split(/(\[(?:stated(?: by selection)?|inferred)\])/g);
    return parts.map((p, j) =>
      /^\[(?:stated(?: by selection)?|inferred)\]$/.test(p) ? (
        <span key={`${i}-${j}`} className="mx-0.5 inline-block rounded-full border border-[#E3E0DA] bg-[#FBFAF8] px-1.5 text-[9px] uppercase tracking-[.06em] text-[#6E6C67] align-[1.5px]">{p.slice(1, -1)}</span>
      ) : (
        <span key={`${i}-${j}`}>{p}</span>
      ),
    );
  };
  return (
    <div className="max-h-72 overflow-auto text-[12px] leading-relaxed text-[#33302C]">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("### ")) return <p key={i} className="m-0 mb-0.5 mt-2.5 text-[11px] font-semibold text-[#33302C]">{line.slice(4)}</p>;
        if (line.startsWith("## ")) return <p key={i} className="m-0 mb-1 mt-3.5 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#6E6C67]">{line.slice(3)}</p>;
        if (line.startsWith("# ")) return <p key={i} className="m-0 text-[13px] font-semibold text-[#141414]">{line.slice(2)}</p>;
        if (line.startsWith("- ")) return <p key={i} className="m-0 pl-3.5">{mark(line.slice(2), i)}</p>;
        if (!line.trim()) return null;
        return <p key={i} className="m-0">{mark(line, i)}</p>;
      })}
    </div>
  );
}
