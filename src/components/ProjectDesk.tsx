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
import { statedObjectivesIn, type AllowedPath, type BuyingId, type FieldUpdate } from "@/lib/workspace/extract";
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
  type BriefGap,
  type WorkspaceFact,
} from "@/lib/workspace/draft";
import { TAXONOMY, sectionForGapKey, sectionForPath, type TaxonomyItem } from "@/lib/workspace/taxonomy";
import { earnedQuestions, type EarnedQuestion, type QuestionAnswer } from "@/lib/workspace/questions";
import { activePack, activeFlavours, visibleSuggestions } from "@/lib/sector/derive";
import { type PackSuggestion } from "@/lib/sector/packs";
import { chunkForIngest, ingestSummary } from "@/lib/workspace/ingest";
import { siteFigureIsIdentifying, siteBandLabelFor } from "@/lib/notice-options";
import SignIn from "@/components/SignIn";
import { fireNetifyEvent } from "@/components/NetifyEvents";

/* ================================================================== */
/* THE PROMPT WORKSPACE (round 3, 31 Jul 2026).                        */
/*                                                                     */
/* Robert's 007 handoff (design_handoff_netify_prompt_workspace)       */
/* WITHDRAWS the three-column workspace of c36f148. The reference is   */
/* netify-prompt-workspace-standalone.html; where this file and that   */
/* one disagree, the reference is correct. The shape: one centred      */
/* 720px column, a prompt dock pinned to the bottom of the viewport,   */
/* exactly one focal question on screen at any moment, the requirement */
/* in a deliberately opened overlay sheet, and a typed command layer   */
/* so that EVERY action is achievable by typing. Clicking is a         */
/* shortcut, never a requirement.                                      */
/*                                                                     */
/* Two dry runs of the reference (one clicking only, one typing only,  */
/* Robert's instruction before any code was written) proved the        */
/* prototype dead-ends every phase transition when typed: "show me     */
/* who fits", "drop the ones that need a partner", "why is Cato        */
/* first" and "publish it" all landed as dead you-beats, and Enter     */
/* did not send. This build closes every one of those gaps: Enter      */
/* sends, and each sentence the surface advertises genuinely works.    */
/*                                                                     */
/* What survives unchanged underneath: the extraction cycle and its    */
/* provenance classes, the earned-question bank, the client rulebook   */
/* verdict, the evidence-dated fit engine, the R9 wrong-company        */
/* guard, ingest for pasted and dropped documents, voice, the ?q=      */
/* doors (R3), no persistence of any kind (R2), and the whole ruled    */
/* signature chain: consents recorded verbatim, core five holding the  */
/* signature shut (R7), business email only, publish as the only exit. */
/*                                                                     */
/* Divergences from the reference, each deliberate and flagged in the  */
/* handover rather than resolved quietly:                              */
/* - The dock is sticky at the end of the workspace container, not     */
/*   position:fixed, so the estate footer (Robert's 30 Jul EEAT        */
/*   ruling: the trust surface must be reachable) is never painted     */
/*   over. Pinned to the viewport bottom the whole working scroll,     */
/*   it releases only past the workspace's end.                        */
/* - The estate MegaNav and footer stay (his one-navigation and        */
/*   footer rulings); the workspace itself carries no chrome of its    */
/*   own beyond the understand link and Start again.                   */
/* - Option rows carry no invented "narrows to N" figures: a          */
/*   consequence renders only when an engine can genuinely count it.   */
/* - Dropping an inference removes the row (the README's rule; the     */
/*   reference's neutered filter keeps the text and looks like a       */
/*   leftover debug clause) and it is never re-inferred.               */
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

/* ---- The stream (the reference's four beat kinds, plus two honest
        additions: an info beat for a command's answer, and a working
        beat for "why is X first", both in the system's own voice). ---- */
type ReadItem = { factId: string; path: string; label: string; provenance: WorkspaceFact["provenance"]; meta: string | null };
type NoteItem = { factId: string | null; label: string; reason: string };
type Beat =
  | { k: "you"; text: string }
  | { k: "read"; lead: string; items: ReadItem[] }
  | { k: "note"; lead: string; items: NoteItem[] }
  | { k: "info"; text: string; lines?: string[] }
  | { k: "working"; title: string; lines: string[]; href?: string; hrefLabel?: string };

/** Field names for the read-back and the sheet: a bare "20" or "the UK"
 *  says nothing on its own (Robert's first live test, 31 Jul: the ledger
 *  values rendered raw and read as broken). Display side only; factLabel
 *  stays the single value voice. */
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
 *  always used; the working beat states evidence in these words). */
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

/** Item lookup: an earned answer lands through the desk's own machinery. */
const ITEM_BY_ID: Record<string, { item: TaxonomyItem; section: string }> = (() => {
  const out: Record<string, { item: TaxonomyItem; section: string }> = {};
  for (const s of TAXONOMY) for (const i of s.items) out[i.id] = { item: i, section: s.key };
  return out;
})();

/* ---- The three example openers (the reference's hero): plain text
        with a mono "try" prefix, and clicking one EXECUTES it, unlike
        the dock chips, which only populate. Each is a sentence the
        live extractor genuinely reads (drive-tested). ---- */
const EXAMPLES = [
  "We run 240 UK retail sites on MPLS and the contract ends March 2027",
  "We have 15 NHS clinic sites, 10 in the UK and 5 international, already on SD-WAN",
  "Our audit flagged remote access for 1,900 staff and we need SASE to fix it",
];

/* The dock placeholder rotates through correction and interrogation,
 * not instruction (the reference's rule); on the door it is the full
 * first example so the register is visible before anyone types. */
const PLACEHOLDERS = [
  "Tell me anything. “Add PCI DSS”, “actually 246 sites”, “who fits?”",
  "Say what you want changed and it changes here",
  "“Drop the users guess” · “we use CrowdStrike” · “show me who fits”",
];

/** Small counts in words, the reference's register ("Nine of thirty-four"). */
const NUM_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty",
  "thirty-one", "thirty-two", "thirty-three", "thirty-four", "thirty-five", "thirty-six", "thirty-seven", "thirty-eight", "thirty-nine", "forty",
];
const numWord = (n: number): string => NUM_WORDS[n] ?? String(n);
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

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
/* The typed command layer. Rule two of the handoff: every action must  */
/* be possible by typing. Each pattern here is a sentence the surface   */
/* itself advertises, so nothing is promised that does not work. The    */
/* parser is deliberately literal: anything it does not recognise goes  */
/* to the extractor, which is the older and wiser reader.               */
/* ================================================================== */

type Command =
  | { kind: "whoFits" }
  | { kind: "publish" }
  | { kind: "sheet"; open: boolean }
  | { kind: "reset" }
  | { kind: "back" }
  | { kind: "skip" }
  | { kind: "note"; open: boolean }
  | { kind: "missing" }
  | { kind: "cost" }
  | { kind: "dropPartner" }
  | { kind: "dropName"; name: string }
  | { kind: "keepName"; name: string }
  | { kind: "why"; name: string };

function parseCommand(raw: string): Command | null {
  const t = raw.trim().toLowerCase().replace(/[?.!]+$/, "").replace(/\s+/g, " ");
  if (!t) return null;
  if (/^(show me )?who fits$/.test(t) || /^show me who fits$/.test(t)) return { kind: "whoFits" };
  if (/^(publish( it| this| to the board)?|generate and publish)$/.test(t)) return { kind: "publish" };
  if (/^(see|show( me)?|open) the requirement( sheet)?$/.test(t) || t === "open the sheet") return { kind: "sheet", open: true };
  if (/^close the (requirement( sheet)?|sheet)$/.test(t)) return { kind: "sheet", open: false };
  if (/^(start (again|over|afresh)|reset)$/.test(t)) return { kind: "reset" };
  if (/^back( to the conversation)?$/.test(t)) return { kind: "back" };
  if (/^(not sure( yet)?|skip( it| this( one)?)?)$/.test(t)) return { kind: "skip" };
  const showN = /^show( me)? the (\w+)$/.exec(t);
  if (showN) return { kind: "note", open: true };
  if (/^hide( me)? the \w+$/.test(t)) return { kind: "note", open: false };
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

/** afterPrompt: the pages slot the journey strip and the capability
 *  block beneath the workspace; they render on the door only, so the
 *  working stream never carries a marketing block (the handoff's law). */
export default function ProjectDesk({ afterPrompt }: { afterPrompt?: ReactNode }) {
  const [phase, setPhase] = useState<"door" | "stream" | "fits">("door");
  const [beats, setBeats] = useState<Beat[]>([]);
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
  const [dismissedQ, setDismissedQ] = useState<string[]>([]);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fitsCard, setFitsCard] = useState<Beat | null>(null);
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
  const firstKeyAt = useRef<number | null>(null);
  const firstVerdictSent = useRef(false);
  const previewFired = useRef(false);
  const cycleRef = useRef(0);
  const receiptId = useRef(0);
  const factsRef = useRef<WorkspaceFact[]>([]);
  const receiptsRef = useRef<Receipt[]>([]);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertedPacks = useRef<Set<string>>(new Set());
  const acceptedGaps = useRef<Set<string>>(new Set());
  /** Dropped inferences never return (handoff rule six): once a guess is
   *  dropped, the extractor may not re-infer the same path and value. A
   *  later STATED assertion still lands: saying it is the buyer's own act. */
  const neverReinfer = useRef<Set<string>>(new Set());
  const nrKey = (path: string, value: unknown) => `${path}::${String(value)}`;

  useEffect(() => { receiptsRef.current = receipts; }, [receipts]);

  const pushBeat = useCallback((b: Beat) => setBeats((bs) => [...bs, b]), []);

  /* ---- Focus management (README section 8): after a commit, the one
     focal element is measured and the viewport repositioned so it sits
     clear of the dock. scrollTop written directly; smooth behaviour and
     requestAnimationFrame both proved unreliable in embedded documents. */
  const setTop = (top: number) => {
    const el = document.scrollingElement || document.documentElement;
    el.scrollTop = top;
    if (document.body) document.body.scrollTop = top;
  };
  /** Entering or leaving Who fits lands at the workspace's own top, not
   *  the page's: the door hero above is the estate's, not the journey's. */
  const scrollToWorkspace = useCallback(() => {
    setTimeout(() => {
      const root = document.querySelector(".pd-root");
      if (!root) { return; }
      const el = document.scrollingElement || document.documentElement;
      const top = root.getBoundingClientRect().top + el.scrollTop - 64;
      el.scrollTop = Math.max(0, top);
    }, 30);
  }, []);
  const afterCommit = useCallback((fixed: number | null) => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    const run = () => setTimeout(() => {
      if (fixed !== null) { setTop(fixed); return; }
      const card = document.querySelector("[data-focal]");
      if (!card) return;
      const el = document.scrollingElement || document.documentElement;
      const before = el.scrollTop;
      const r = card.getBoundingClientRect();
      const dock = document.querySelector("[data-dock]");
      const usable = (dock ? dock.getBoundingClientRect().top : window.innerHeight) - 90;
      let top = r.top + before - 90;
      if (r.height <= usable) top += Math.max(0, r.height - usable);
      setTop(Math.max(0, top));
    }, 0);
    run();
    scrollTimer.current = setTimeout(run, 140);
  }, []);
  useEffect(() => () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); }, []);

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
    /* R2: nothing is restored. The desk starts empty every time except
       for what the link itself carries. */
    if (seedFacts.length) applyMerge(seedFacts, "link");
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

  /* The rotating placeholder (5.2s, the reference's cadence). */
  useEffect(() => {
    const t = setInterval(() => setPh((n) => (n + 1) % PLACEHOLDERS.length), 5200);
    return () => clearInterval(t);
  }, []);

  /* The dock is position:fixed per the reference (Robert's first live test
   * proved the sticky compromise wrong: the dock floated mid-page the
   * moment the stream started, and a footer-visibility hide then stole
   * the dock during work on short pages). The EEAT ruling is honoured by
   * padding the document instead: the estate footer's last line scrolls
   * clear above the dock, so the whole trust surface stays readable and
   * the prompt never leaves the screen. Cleaned up on unmount. */
  useEffect(() => {
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "220px";
    return () => { document.body.style.paddingBottom = prev; };
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

  /* ---- Fit (evidence dated, the same organ, simplified surface) ---- */
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

  /* ---- The sector note (handoff rule seven: compliance is applied and
     explained, not offered as a checklist). When the sector pack wakes,
     its COMPLIANCE REQUIREMENTS, and only those, land in the requirement
     as inferences, each carrying the pack's own applicability reason, and
     the stream says so against the orange rule. A pack may add a
     requirement with a reason; it may never invent a fact about the
     buyer's estate, so nothing outside constraints.complianceRequirements
     is ever asserted. Every asserted row is individually droppable and a
     dropped one is never re-inferred. This supersedes, for compliance
     requirements only, the offered-suggestion presentation; flagged to
     Robert in the round-three handover rather than resolved quietly. ---- */
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
    pushBeat({
      k: "note",
      lead: `Because you are ${pack.label.toLowerCase()}, ${numWord(shown.length)} ${shown.length === 1 ? "thing is" : "things are"} now in your requirement whether or not you asked. Vendors and service providers will be asked to evidence each one, not claim it.`,
      items: shown.map(({ sg, item }) => ({
        factId: factId(item.path as AllowedPath, item.value),
        label: item.label,
        reason: sg.reason,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, packFlavours]);

  /* ---- The open questions: real gaps plus the earned bank, one focal
     at a time, in document order, deferred ones cycling to the end. ---- */
  const unansweredGaps = brief.openGaps;
  const earnedAll = useMemo(() => {
    const notedIds = noted.map((n) => n.id);
    return earnedQuestions(requirement, buying, opModel, notedIds, dismissedQ, corpus);
  }, [requirement, buying, opModel, noted, dismissedQ, corpus]);
  type Focal = { key: string; section: string; gap?: BriefGap; q?: EarnedQuestion };
  const openHeads = useMemo(() => {
    const gapsBySec = new Map<string, BriefGap[]>();
    for (const g of unansweredGaps) {
      const s = sectionForGapKey(g.key);
      gapsBySec.set(s, [...(gapsBySec.get(s) ?? []), g]);
    }
    const earnedBySec = new Map<string, EarnedQuestion[]>();
    for (const q of earnedAll) earnedBySec.set(q.section, [...(earnedBySec.get(q.section) ?? []), q]);
    const list: Focal[] = [];
    for (const sec of TAXONOMY) {
      for (const g of gapsBySec.get(sec.key) ?? []) list.push({ key: `gap:${g.key}`, section: sec.key, gap: g });
      for (const q of earnedBySec.get(sec.key) ?? []) list.push({ key: `q:${q.id}`, section: sec.key, q });
    }
    const head = list.filter((f) => !deferred.includes(f.key));
    const tail = deferred.map((k) => list.find((f) => f.key === k)).filter((f): f is Focal => Boolean(f));
    return [...head, ...tail];
  }, [unansweredGaps, earnedAll, deferred]);
  const focal = phase === "stream" && !published ? openHeads[0] ?? null : null;
  const focalRef = useRef<Focal | null>(null);
  useEffect(() => { focalRef.current = focal; }, [focal]);

  /* ---- Core five (R7): the five details a notice cannot publish
     without genuinely hold the signature shut, and the refusal names
     them. ---- */
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

  /* ---- The ranked fits (the reference's Who fits view) ---- */
  const rankedFits = useMemo(() => (fit?.mode === "graded" ? fit.suppliers : []), [fit]);
  const keptFits = useMemo(() => rankedFits.filter((s) => !removed.includes(s.slug)), [rankedFits, removed]);
  const fitSlugs = keptFits.map((s) => s.slug);
  const pins = [...new Set([...added, ...fitSlugs])].slice(0, 5);
  const checksCount = fit?.checks?.length ?? 0;
  const partnerDependent = useMemo(
    () => keptFits.filter((s) => s.matched.some((m) => m.grade === "partner_integrated")),
    [keptFits],
  );

  /* ---- The publish gate (identical law to round two) ---- */
  const signLocked =
    !started || facts.length === 0 || Boolean(published) || !coreFiveComplete || (securityScope && (!verdict || verdict.confidence === "low")) || (!securityScope && !buying);
  const lockLine = !started
    ? "Say one sentence about the organisation and the engine takes over."
    : facts.length === 0
      ? "Selections alone are notes so far: say one sentence about the organisation and the engine takes over."
      : !coreFiveComplete
        ? `A notice cannot publish without five details, and ${numWord(missingCore.length)} ${missingCore.length === 1 ? "is" : "are"} still open: ${missingCore.join(", ")}. Say it in the box below.`
        : securityScope && (!verdict || verdict.confidence === "low")
          ? "Answer the open questions first: nothing is recorded on guesswork."
          : !securityScope && !buying
            ? "Say what you are buying (SASE, SD-WAN, SSE or managed security) and publishing unlocks."
            : null;
  const consentsOk = securityScope ? consentCreate && consentPublish && (unansweredGaps.length === 0 || consentGaps) : consentCreate;

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

  /* ---- Corrections: the drop that never returns, answers, receipts ---- */
  const dropFact = useCallback((id: string) => {
    const f = factsRef.current.find((x) => x.id === id);
    if (!f || f.struck) return;
    if (f.provenance === "inferred") neverReinfer.current.add(nrKey(f.path, f.value));
    factsRef.current = factsRef.current.map((x) => (x.id === id ? { ...x, struck: true } : x));
    setFacts(factsRef.current);
    ev("workspace_fact_struck", { path: f.path, provenance: f.provenance, undo: "0" });
  }, []);

  const answerGap = useCallback(
    (gap: BriefGap, value: string, label?: string) => {
      if (!gap.path) return false;
      const v = gap.control === "number" ? Number(value) : value;
      if (gap.control === "number" && (!Number.isFinite(v as number) || (v as number) < 0)) return false;
      applyMerge([{ path: gap.path as AllowedPath, value: v, provenance: "stated", quote: label ?? String(value) }], "answer");
      ev("workspace_gap_answered", { field: gap.key });
      return true;
    },
    [applyMerge],
  );

  const answerEarned = useCallback(
    (q: EarnedQuestion, answer: QuestionAnswer, value?: string) => {
      if (answer.kind === "items") {
        for (const id of answer.itemIds) {
          const e = ITEM_BY_ID[id];
          if (!e) continue;
          if (e.item.path) {
            applyMerge([{ path: e.item.path as AllowedPath, value: e.item.value, provenance: "stated", quote: e.item.label }], "answer");
          } else {
            setNoted((ns) => (ns.some((n) => n.id === e.item.id) ? ns : [...ns, { id: e.item.id, label: e.item.label, section: e.section }]));
          }
        }
      } else if (answer.kind === "note") {
        setNoted((ns) => (ns.some((n) => n.id === `qn-${q.id}`) ? ns : [...ns, { id: `qn-${q.id}`, label: answer.text, section: q.section }]));
      } else if (answer.kind === "path" && value && value.trim()) {
        applyMerge([{ path: answer.path, value: value.trim(), provenance: "stated", quote: value.trim() }], "answer");
      }
      setDismissedQ((d) => (d.includes(q.id) ? d : [...d, q.id]));
      ev("workspace_earned_answered", { q: q.id, kind: answer.kind });
    },
    [applyMerge],
  );

  /** An option click on the focal card: the label lands as a you-beat,
   *  the answer through the same machinery a typed answer uses. */
  const pickOption = (q: EarnedQuestion, opt: { label: string; answer: QuestionAnswer }) => {
    pushBeat({ k: "you", text: opt.label });
    if (opt.answer.kind === "dismiss") setDismissedQ((d) => (d.includes(q.id) ? d : [...d, q.id]));
    else answerEarned(q, opt.answer);
    afterCommit(null);
  };

  const skipFocal = useCallback(() => {
    const f = focalRef.current;
    if (!f) return;
    if (f.q) {
      const qid = f.q.id;
      setDismissedQ((d) => (d.includes(qid) ? d : [...d, qid]));
      ev("workspace_earned_dismissed", { q: qid });
    } else if (f.gap) {
      setDeferred((d) => (d.includes(f.key) ? d : [...d, f.key]));
    }
    afterCommit(null);
  }, [afterCommit]);

  const keepReceipt = useCallback((text: string) => {
    setReceipts((rs) => [...rs, { id: ++receiptId.current, text }]);
  }, []);

  /* ---- The extraction cycle (the same organ, feeding the stream) ---- */
  const beatsHasRead = useRef(false);
  const runCycle = useCallback(
    async (text: string, opts: { quiet?: boolean } = {}): Promise<number> => {
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

        if (merged.changed.length && !opts.quiet) {
          const byId = new Map(merged.facts.map((f) => [f.id, f]));
          const items: ReadItem[] = merged.changed
            .map((id) => byId.get(id))
            .filter((f): f is WorkspaceFact => Boolean(f))
            .slice(0, 12)
            .map((f) => ({
              factId: f.id,
              path: f.path,
              label: factLabel(f),
              provenance: f.provenance,
              meta: f.provenance === "stated" ? (f.quote ? `“${f.quote}”` : null) : f.reason ?? "my inference",
            }));
          const firstRead = beatsHasRead.current === false;
          beatsHasRead.current = true;
          pushBeat({
            k: "read",
            lead: firstRead
              ? "Here is what I took from that. Anything marked as my guess, drop it and it will not come back."
              : "Taken. Here is what changed.",
            items,
          });
        }
        /* Engine notes reach the buyer only in buyer words: the two
           humanisable classes translate, everything else (key warnings,
           internal diagnostics) stays off the surface entirely. */
        const notes = (data.notes ?? [])
          .filter((n) => /^Dropped /.test(n))
          .slice(0, 2)
          .map(humaniseNote);
        if (notes.length && !opts.quiet) pushBeat({ k: "info", text: notes.join(" ") });
        return merged.changed.length;
      } catch {
        setCycleError("The engine did not answer; your words are unchanged, say it again in a moment.");
        return 0;
      } finally {
        setBusy(false);
      }
    },
    [busy, applyMerge, pushBeat],
  );

  /* ---- Ingest (The Threshold): a paste or a dropped text file runs
     through the same cycles a sentence runs, chunked on paragraph
     boundaries, so provenance, guards and receipts hold unchanged. ---- */
  const ingestText = useCallback(
    async (raw: string, source: "paste" | "drop") => {
      const plan = chunkForIngest(raw);
      if (!plan.chunks.length) return;
      setPasteSummary(null);
      if (phase === "door") setPhase("stream");
      const factsBefore = factsRef.current.filter((f) => !f.struck).length;
      const receiptsBefore = receiptsRef.current.length;
      ev("workspace_ingest", { source, chunks: plan.chunks.length, chars: plan.readChars, truncated: plan.truncated ? 1 : 0 });
      if (!firstKeyAt.current) firstKeyAt.current = Date.now();
      for (const chunk of plan.chunks) {
        // Sequential on purpose: each cycle merges before the next reads.
        await runCycle(chunk, {});
      }
      const landed = Math.max(0, factsRef.current.filter((f) => !f.struck).length - factsBefore);
      const kept = Math.max(0, receiptsRef.current.length - receiptsBefore);
      setPasteSummary(ingestSummary(landed, kept, plan));
      afterCommit(null);
    },
    [phase, runCycle, afterCommit],
  );

  /* ---- The send: one entry for everything typed, spoken or clicked
     through an example. Commands first; the extractor for the rest; a
     sentence that lands nothing becomes the focal question's own-words
     answer, or a receipt kept verbatim. ---- */
  async function send(raw: string) {
      const text = raw.trim();
      if (!text || busy) return;
      setDraft("");
      if (!firstKeyAt.current) firstKeyAt.current = Date.now();
      pushBeat({ k: "you", text });
      if (phase === "door") setPhase("stream");
      const say = (b: Beat) => { if (phase === "fits") setFitsCard(b); else pushBeat(b); };

      const cmd = parseCommand(text);
      if (cmd) {
        handleCommand(cmd);
        return;
      }

      const focalNow = focalRef.current;
      const landed = await runCycle(text);
      if (landed > 0) {
        if (phase === "fits") {
          setFitsCard({ k: "info", text: "Placed. The list re-scores against what you just said." });
        }
        afterCommit(null);
        return;
      }

      /* Nothing landed: the box takes anything (the card's own promise).
         The words become the focal question's answer in the buyer's own
         voice, or failing that a receipt kept verbatim. */
      if (focalNow?.q) {
        const q = focalNow.q;
        const pathOpt = q.options.find((o) => o.answer.kind === "path");
        if (pathOpt && pathOpt.answer.kind === "path") {
          answerEarned(q, pathOpt.answer, text);
        } else {
          setNoted((ns) => (ns.some((n) => n.id === `qn-${q.id}`) ? ns : [...ns, { id: `qn-${q.id}`, label: text, section: q.section }]));
          setDismissedQ((d) => (d.includes(q.id) ? d : [...d, q.id]));
        }
        ev("workspace_own_words", { section: focalNow.section, routed: pathOpt ? "field" : "note" });
        say({ k: "info", text: "Kept, in your words. The technical wording sits beneath them on the requirement." });
      } else if (focalNow?.gap) {
        const g = focalNow.gap;
        const numMatch = /(\d[\d,]*)/.exec(text.replace(/,/g, ""));
        const ok = g.control === "number"
          ? (numMatch ? answerGap(g, numMatch[1], text) : false)
          : answerGap(g, text, text);
        if (ok) {
          ev("workspace_own_words", { section: focalNow.section, routed: "field" });
          say({ k: "info", text: "Taken as your answer, in your words." });
        } else {
          keepReceipt(text);
          say({ k: "info", text: "Kept verbatim with your notes; I could not place it on a field." });
        }
      } else {
        keepReceipt(text);
        say({ k: "info", text: "Kept verbatim with your notes. Say “see the requirement” to read everything I am holding." });
      }
      afterCommit(null);
  }

  /* ---- The commands, each one true ---- */
  function handleCommand(cmd: Command) {
    const answer = (b: Beat) => { if (phase === "fits") setFitsCard(b); else pushBeat(b); afterCommit(null); };
    switch (cmd.kind) {
      case "whoFits": {
        if (!fitBuying) {
          answer({ k: "info", text: "Tell me what you are buying first, SASE, SD-WAN, SSE or managed security, and the evaluated market scores against it." });
          return;
        }
        ev("workspace_command", { kind: "who_fits" });
        setPhase("fits");
        setFitsCard(null);
        scrollToWorkspace();
        return;
      }
      case "publish": {
        ev("workspace_command", { kind: "publish" });
        if (signLocked && !published) {
          answer({ k: "info", text: lockLine ?? "Publishing is not open yet." });
          return;
        }
        setPhase("fits");
        setTimeout(() => {
          const el = document.querySelector("[data-publish]");
          if (el) el.scrollIntoView({ block: "start" });
        }, 60);
        setFitsCard({ k: "info", text: "The signature is yours, never mine: review what publishes, tick the consents and press Generate and publish." });
        return;
      }
      case "sheet":
        ev("workspace_command", { kind: cmd.open ? "sheet_open" : "sheet_close" });
        setSheetOpen(cmd.open);
        return;
      case "reset":
        window.location.assign(window.location.pathname);
        return;
      case "back":
        setPhase("stream");
        scrollToWorkspace();
        return;
      case "skip":
        skipFocal();
        return;
      case "note":
        setNoteOpen(cmd.open);
        afterCommit(null);
        return;
      case "missing": {
        const lines: string[] = [];
        lines.push(
          missingCore.length
            ? `Before it can publish, the notice needs ${missingCore.join(", ")}.`
            : "The five details a notice needs are all in.",
        );
        const openCount = openHeads.length;
        if (openCount) lines.push(`${cap(numWord(openCount))} question${openCount === 1 ? "" : "s"} ${openCount === 1 ? "is" : "are"} open on the document; answering them sharpens the scoring, and only the five above hold publishing shut.`);
        answer({ k: "info", text: lines.join(" ") });
        return;
      }
      case "cost":
        answer({ k: "info", text: "The price band computes at publish, under the Netify TCO methodology (v2026.1). Publishing generates it alongside your document and the anonymous notice; nothing here invents a number early." });
        return;
      case "dropPartner": {
        if (phase !== "fits") { answer({ k: "info", text: "Say “who fits” first and I will show the list this works on." }); return; }
        if (!partnerDependent.length) {
          answer({ k: "info", text: "Nobody in the list relies on a partner for what you asked: no row carries partner-or-integrated evidence against your checks." });
          return;
        }
        const names = partnerDependent.map((s) => s.name);
        setRemoved((r) => [...new Set([...r, ...partnerDependent.map((s) => s.slug)])]);
        ev("workspace_command", { kind: "drop_partner" });
        answer({ k: "info", text: `Dropped ${names.join(", ")}: their evidence for one or more of your checks is graded via partner or integrated.` });
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
            answer({ k: "info", text: `${inFits.name} dropped. Direct invites leave them out; the anonymous public notice is unaffected.` });
          } else {
            setRemoved((r) => r.filter((s) => s !== inFits.slug));
            answer({ k: "info", text: `${inFits.name} kept back in.` });
          }
          ev("workspace_command", { kind: cmd.kind === "dropName" ? "drop_vendor" : "keep_vendor" });
          return;
        }
        /* In the stream, "drop X" reaches a guess: the inference whose
           label carries the words is struck and never re-inferred. */
        if (cmd.kind === "dropName") {
          const f = factsRef.current.find(
            (x) => !x.struck && x.provenance === "inferred" && factLabel(x).toLowerCase().includes(cmd.name.toLowerCase()),
          );
          if (f) {
            dropFact(f.id);
            answer({ k: "info", text: `Dropped: ${factLabel(f)}. It will not come back unless you say it yourself.` });
            return;
          }
        }
        answer({ k: "info", text: `I could not find “${cmd.name}” in the list or among my inferences. Say the name as the list shows it.` });
        return;
      }
      case "why": {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const target = norm(cmd.name);
        const idx = rankedFits.findIndex((s) => norm(s.name).includes(target) || target.includes(norm(s.name)));
        if (idx < 0) { answer({ k: "info", text: `“${cap(cmd.name)}” is not in the scored list. Say “who fits” to see it.` }); return; }
        const s = rankedFits[idx];
        const lines: string[] = [];
        lines.push(`Position ${idx + 1} of ${rankedFits.length}, ordered by graded evidence against your named checks, never by what anyone pays.`);
        if (s.matched.length) lines.push(`Evidenced for: ${s.matched.map((m) => `${m.label} (${gradeWord(m.grade)})`).join(", ")}.`);
        if (s.missed.length) lines.push(`Not evidenced for: ${s.missed.map((m) => m.label).join(", ")}.`);
        lines.push(`Across the whole dataset this record fully meets ${s.yes_count} of 40 capabilities. Graded ${fmtDate(s.last_verified)}.`);
        ev("workspace_command", { kind: "why_vendor" });
        answer({ k: "working", title: `Why ${s.name} sits at ${idx + 1}`, lines, href: `/sase/vendors/${s.slug}/`, hrefLabel: "Read the full record, with every source behind these grades" });
        return;
      }
    }
  }

  /* ---- The signature chain (the same organs as round two; the desk
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
     on the dock does the same. ---- */
  const readFile = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) { setPasteSummary("That file is too large to read here; paste the part that matters."); return; }
    const reader = new FileReader();
    reader.onload = () => { void ingestText(String(reader.result ?? ""), "drop"); };
    reader.readAsText(f);
  };

  /* ---- Sheet sections: every row with its provenance (the core data
     concept; nothing renders without its origin). ---- */
  const sheetSections = useMemo(() => {
    const out: Array<{ key: string; title: string; rows: Array<{ text: string; meta: string | null; open?: boolean }> }> = [];
    for (const sec of TAXONOMY) {
      const rows: Array<{ text: string; meta: string | null; open?: boolean }> = [];
      for (const f of facts) {
        if (f.struck || sectionForPath(f.path) !== sec.key) continue;
        rows.push({
          text: PATH_LABELS[f.path] ? `${PATH_LABELS[f.path]}: ${factLabel(f)}` : factLabel(f),
          meta: f.provenance === "stated" ? (f.quote ? `“${f.quote}”` : "your words") : f.reason ?? "my inference",
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
  const factById = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts]);

  const queueRest = Math.max(0, openHeads.length - 1);
  const queueLabel =
    focal === null
      ? ""
      : queueRest === 0
        ? missingCore.length
          ? `The last open question. Still needed to publish: ${missingCore.join(", ")}.`
          : "The last open question, and it does not stop you publishing."
        : missingCore.length
          ? `${cap(numWord(queueRest))} more after this. Still needed to publish: ${missingCore.join(", ")}.`
          : `${cap(numWord(queueRest))} more after this, and none of them stop you publishing.`;

  const firstFit = rankedFits[0] ?? null;
  const shortcuts: string[] =
    phase === "fits"
      ? [
          ...(firstFit ? [`Why is ${firstFit.name} first?`] : []),
          partnerDependent.length ? "Drop the ones that need a partner" : rankedFits.length ? `Drop ${rankedFits[rankedFits.length - 1].name}` : "Back to the conversation",
          "What will this cost?",
        ]
      : ["Add PCI DSS", "Actually it is 250 sites", "What are you still missing?"];

  const sendReady = draft.trim().length > 0 && !busy;

  if (!booted) return <div className="pd-root mt-10" />;

  /* ================================================================ */
  /* Render: one centred 720px column at every width, no chrome of its */
  /* own beyond the understand link, the reference's tokens throughout. */
  /* ================================================================ */
  return (
    <div
      className="pd-root mt-8"
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#141414" }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer?.files?.[0]); }}
    >
      {/* The workspace's two text links (the reference's header, minus
          the logotype the estate header already carries). */}
      {started && (
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-end gap-4 px-[26px] pb-4">
          <button
            type="button"
            onClick={() => { setSheetOpen(true); ev("workspace_command", { kind: "sheet_open" }); }}
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
          paragraphs above; the workspace adds the three example openers
          (clicking one starts the project with that sentence, exactly as
          typing it would) and the dock waits below. */}
      {phase === "door" && (
        <div className="mx-auto w-full max-w-[720px] px-[26px] pb-10 pt-2">
          <div className="flex flex-col gap-[9px]">
            {EXAMPLES.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => void send(label)}
                className="flex cursor-pointer items-baseline gap-[11px] border-0 bg-transparent p-0 text-left text-[#8C8A85] hover:text-[#141414]"
              >
                <span className="flex-none text-[12px] text-[#C4C0B8]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>try</span>
                <span className="text-[16px] leading-normal">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── THE STREAM ── beats 28px apart, one focal question, answered
          material collapsed into prose above it. */}
      {phase === "stream" && (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7 px-[26px] pb-[250px]">
          {beats.map((b, i) => {
            if (b.k === "you") {
              return (
                <div key={i} className="flex flex-col items-end gap-[7px]">
                  <span className="text-[10.5px] uppercase text-[#A3A099]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: "0.09em" }}>You said</span>
                  <span className="max-w-[30em] rounded-[14px] bg-[#141414] px-[17px] py-[13px] text-[16px] leading-[1.55] text-white" style={{ textWrap: "pretty" }}>{b.text}</span>
                </div>
              );
            }
            if (b.k === "read") {
              const rows = b.items.filter((it) => !factById.get(it.factId)?.struck);
              if (!rows.length) return null;
              return (
                <div key={i}>
                  <div className="mb-4 max-w-[36em] text-[16.5px] leading-[1.6] text-[#141414]" style={{ textWrap: "pretty" }}>{b.lead}</div>
                  <div className="flex flex-col border-l-2 border-[#E3E0DA] pl-4">
                    {rows.map((it) => (
                      <div key={it.factId} className="flex items-baseline gap-2.5 py-[7px]">
                        <span className="min-w-0 flex-1 text-[15px] leading-normal text-[#22201D]" style={{ textWrap: "pretty" }}>
                          {PATH_LABELS[it.path] && <span className="font-medium text-[#8C8A85]">{PATH_LABELS[it.path]}: </span>}
                          {it.label}
                          {it.meta && <span className="ml-2 text-[12.5px] italic text-[#A3A099]">{it.meta}</span>}
                        </span>
                        {it.provenance === "inferred" && (
                          <button
                            type="button"
                            onClick={() => { dropFact(it.factId); afterCommit(null); }}
                            className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[10px] uppercase text-[#A3A099] hover:border-[#B4650B] hover:text-[#B4650B]"
                            style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: "0.07em" }}
                          >
                            my guess · drop it
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (b.k === "note") {
              const rows = b.items.filter((it) => !it.factId || !factById.get(it.factId)?.struck);
              return (
                <div key={i} className="border-l-2 border-[#F5A21B] pl-4">
                  <div className="max-w-[36em] text-[16px] leading-[1.6] text-[#141414]" style={{ textWrap: "pretty" }}>{b.lead}</div>
                  <button
                    type="button"
                    onClick={() => setNoteOpen((o) => !o)}
                    className="mt-[9px] cursor-pointer border-0 bg-transparent p-0 text-[14px] font-medium text-[#B4650B] underline"
                  >
                    {noteOpen ? `Hide the ${numWord(rows.length)}` : `Show me the ${numWord(rows.length)}`}
                  </button>
                  {noteOpen && (
                    <div className="mt-3 flex flex-col">
                      {rows.map((it, j) => (
                        <div key={j} className="flex items-baseline gap-2.5 border-t border-[#F0EEE9] py-[7px]">
                          <span className="min-w-0 flex-1 text-[14.5px] leading-normal">{it.label}</span>
                          <span className="min-w-0 flex-[1.2] text-[13px] leading-[1.45] text-[#8C8A85]">{it.reason}</span>
                          {it.factId && (
                            <button
                              type="button"
                              onClick={() => { dropFact(it.factId as string); afterCommit(null); }}
                              className="flex-none cursor-pointer rounded-[4px] border border-[#E8E4DC] bg-transparent px-[6px] py-[3px] text-[10px] uppercase text-[#A3A099] hover:border-[#B4650B] hover:text-[#B4650B]"
                              style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: "0.07em" }}
                            >
                              drop it
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            if (b.k === "working") {
              return (
                <div key={i} className="border-l-2 border-[#E3E0DA] pl-4">
                  <div className="mb-1.5 text-[15px] font-semibold">{b.title}</div>
                  {b.lines.map((l, j) => (
                    <p key={j} className="m-0 mb-1 max-w-[36em] text-[14.5px] leading-[1.55] text-[#5F5D59]">{l}</p>
                  ))}
                  {b.href && <a href={b.href} className="text-[13.5px]">{b.hrefLabel ?? b.href}</a>}
                </div>
              );
            }
            return (
              <div key={i} className="max-w-[36em] text-[15px] leading-[1.6] text-[#6E6C67]" style={{ textWrap: "pretty" }}>
                {b.text}
                {b.lines?.map((l, j) => <span key={j}><br />{l}</span>)}
              </div>
            );
          })}

          {/* The one focal question. Never two. */}
          {focal && (
            <div>
              <div data-focal="1" className="rounded-[18px] border border-[#E8E4DC] bg-white px-7 pb-[22px] pt-[26px]" style={{ boxShadow: "0 3px 18px rgba(20,20,20,.05)" }}>
                <div className="mb-2 max-w-[24em] text-[22px] font-semibold leading-[1.35]" style={{ letterSpacing: "-0.015em", textWrap: "pretty" }}>
                  {focal.q ? focal.q.question : focal.gap?.question}
                </div>
                {focal.q && (
                  <div className="mt-4 flex flex-col gap-2">
                    {focal.q.options.filter((o) => o.answer.kind !== "dismiss").map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => pickOption(focal.q as EarnedQuestion, o)}
                        className="flex w-full cursor-pointer items-center gap-3.5 rounded-[12px] border border-[#E3E0DA] bg-white px-[17px] py-[15px] hover:border-[#141414] hover:bg-[#FDFCFA]"
                      >
                        <span className="flex-1 text-left text-[16px] leading-[1.45]">{o.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-[18px] flex flex-wrap items-center gap-3">
                  <span className="min-w-[14em] flex-1 text-[14px] leading-normal text-[#8C8A85]">
                    {focal.q ? "Or just tell me in the box below. These are only the answers I hear most." : "Tell me in the box below, in your own words."}
                  </span>
                  <button
                    type="button"
                    onClick={skipFocal}
                    className="flex-none cursor-pointer border-0 bg-transparent text-[14px] text-[#A3A099] hover:text-[#141414]"
                  >
                    Not sure yet
                  </button>
                </div>
              </div>
              {queueLabel && <div className="mt-3.5 text-[14px] leading-normal text-[#A3A099]">{queueLabel}</div>}
            </div>
          )}

          {/* Ready: the green rule, only when nothing is open. */}
          {!focal && started && !published && (
            <div data-focal="1" className="border-l-2 border-[#2E9E52] pl-4">
              <div className="mb-[7px] max-w-[26em] text-[18px] font-semibold leading-[1.4]">That is everything I need to score the market.</div>
              <div className="mb-4 max-w-[36em] text-[15px] leading-[1.6] text-[#6E6C67]">
                Nothing has left this page. When you are ready I will score the
                {market?.counts.vendors ? ` ${market.counts.vendors}` : ""} evaluated vendors and service providers against what you have told me, and show why each one fits.
              </div>
              <button
                type="button"
                onClick={() => handleCommand({ kind: "whoFits" })}
                className="cursor-pointer rounded-full border-0 bg-[#F5A21B] px-6 py-3.5 text-[16px] font-semibold text-[#141414] hover:bg-[#E5940F]"
              >
                Show me who fits
              </button>
            </div>
          )}
          {focal && coreFiveComplete && (
            <div className="-mt-4 text-[13.5px] text-[#8C8A85]">
              The five details a notice needs are in. Say “who fits” whenever you want the scored market.
            </div>
          )}
        </div>
      )}

      {/* ── WHO FITS ── ranked by graded evidence, every date real, the
          publish organ at the end because publish is the only exit. */}
      {phase === "fits" && (
        <div className="mx-auto w-full max-w-[720px] px-[26px] pb-[250px]">
          <button
            type="button"
            onClick={() => { setPhase("stream"); scrollToWorkspace(); }}
            className="mb-[22px] cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[#8C8A85] hover:text-[#141414]"
          >
            Back to the conversation
          </button>
          {fitsCard && (
            <div className="mb-5 rounded-[12px] border border-[#E8E4DC] bg-white px-5 py-4">
              {fitsCard.k === "working" ? (
                <>
                  <div className="mb-1.5 text-[15px] font-semibold">{fitsCard.title}</div>
                  {fitsCard.lines.map((l, j) => (
                    <p key={j} className="m-0 mb-1 text-[14px] leading-[1.55] text-[#5F5D59]">{l}</p>
                  ))}
                  {fitsCard.href && <a href={fitsCard.href} className="text-[13.5px]">{fitsCard.hrefLabel ?? fitsCard.href}</a>}
                </>
              ) : (
                fitsCard.k === "info" && <p className="m-0 text-[14px] leading-[1.55] text-[#5F5D59]">{fitsCard.text}</p>
              )}
              <button type="button" onClick={() => setFitsCard(null)} className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-[#A3A099] hover:text-[#141414]">Dismiss</button>
            </div>
          )}
          {rankedFits.length === 0 ? (
            <div className="max-w-[36em] text-[16px] leading-[1.6] text-[#6E6C67]">
              The market has not scored yet: say what you are buying and where it runs, and the evaluated vendors and service providers rank against it here.
            </div>
          ) : (
            <>
              <h2 className="m-0 mb-2.5 max-w-[22em] text-[28px] font-semibold leading-[1.25]" style={{ letterSpacing: "-0.022em" }}>
                {cap(numWord(rankedFits.length))} of {numWord(fit?.total ?? rankedFits.length)} fit what you described.
              </h2>
              <p className="m-0 mb-2 max-w-[36em] text-[16px] leading-[1.6] text-[#6E6C67]">
                Ordered by graded evidence against your requirement, not by what anyone pays. Every grade is dated.
                {firstFit ? <> Say <em>why is {firstFit.name} first</em> and I will show the working.</> : null}
              </p>
              <p className="m-0 mb-[26px] max-w-[36em] text-[14.5px] leading-[1.6] text-[#8C8A85]">
                {cap(numWord(keptFits.length))} of {numWord(rankedFits.length)} kept. Untick anyone you do not want to hear from
                {partnerDependent.length ? <>, or say <em>drop the ones that need a partner</em>.</> : rankedFits.length ? <>, or say <em>drop {rankedFits[rankedFits.length - 1].name}</em>.</> : "."}
              </p>
              <div className="flex flex-col">
                {rankedFits.map((s) => {
                  const on = !removed.includes(s.slug);
                  const full = checksCount > 0 && s.matched.length === checksCount;
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => setRemoved((r) => (on ? [...r, s.slug] : r.filter((x) => x !== s.slug)))}
                      className="flex w-full cursor-pointer items-start gap-3.5 border-0 border-b border-solid border-[#F0EEE9] bg-transparent px-1 py-4 text-left hover:bg-[#FDFCFA]"
                    >
                      <span
                        className={`mt-[3px] flex h-[19px] w-[19px] flex-none items-center justify-center rounded-[5px] text-[11px] font-bold ${on ? "bg-[#141414] text-white" : "border border-[#DDD9D1] text-transparent"}`}
                        aria-hidden="true"
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                        <span className="flex flex-wrap items-baseline gap-2.5">
                          <span className="text-[17px] font-semibold">{s.name}</span>
                          <span className="text-[13px] text-[#A3A099]">{s.category}</span>
                        </span>
                        <span className="text-[14.5px] leading-[1.55] text-[#5F5D59]" style={{ textWrap: "pretty" }}>
                          {s.matched.length
                            ? `Evidenced for ${s.matched.slice(0, 3).map((m) => m.label).join(", ")}${s.matched.length > 3 ? ` and ${numWord(s.matched.length - 3)} more` : ""}.`
                            : "On the curated market for this scope; no graded evidence against your named checks yet."}
                        </span>
                      </span>
                      <span className="flex flex-none flex-col items-end gap-[5px]">
                        {checksCount > 0 && (
                          <span
                            className={`rounded-[6px] px-2 py-1 text-[12px] font-semibold ${full ? "bg-[#EAF6EE] text-[#256B3E]" : "bg-[#F2F0EB] text-[#5F5F5F]"}`}
                            style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
                          >
                            {s.matched.length} of {checksCount}
                          </span>
                        )}
                        <span className="text-[11px] text-[#A3A099]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
                          evaluated {fmtDate(s.last_verified)}
                        </span>
                      </span>
                    </button>
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
                    <p className="m-0 mb-1 text-[10px] font-semibold uppercase text-[#B4650B]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: ".12em" }}>Your shortlist</p>
                    <ol className="m-0 list-none p-0">
                      {keptFits.map((r, i) => (
                        <li key={r.slug} className="border-t border-[#F5F3EE] py-2.5 first:border-t-0 first:pt-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-[11px] text-[#8C8A85]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>{String(i + 1).padStart(2, "0")}</span>
                            <a href={`/sase/vendors/${r.slug}/`} className="text-[14px] font-semibold text-[#141414] underline decoration-[#C9C5BC] underline-offset-2 hover:decoration-[#141414]">{r.name}</a>
                            <span className="text-[12.5px] text-[#6E6C67]">{r.category} · graded {fmtDate(r.last_verified)}</span>
                            {published.invited.includes(r.slug) && (
                              <span className="rounded-full bg-[#FFF7E8] px-1.5 py-[1px] text-[10px] font-semibold uppercase text-[#8A4D08]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: ".08em" }}>invited</span>
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
                <p className="m-0 mb-1 mt-3 text-[10px] font-semibold uppercase text-[#8C8A85]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: ".12em" }}>What the notice carries</p>
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
                    Test mode covers the security engine today, and this is a network requirement. Drop <span style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>?test=1</span> from the address to publish it for real.
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
          beneath the workspace; the working stream never carries them. The
          spacer keeps their tail clear of the fixed dock until the footer
          takes over. */}
      {phase === "door" && afterPrompt}

      {/* ── THE PROMPT DOCK ── sticky at the end of the workspace, so it
          pins to the viewport bottom for the whole working scroll and
          releases before the estate footer (the EEAT ruling): opaque
          backdrop, matching feather, no backdrop-filter, no gradient. */}
      <div
        data-dock="1"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-[26px] pt-3.5"
        style={{ background: "#fbfaf8", boxShadow: "0 -18px 22px 10px #fbfaf8", paddingBottom: "max(22px, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto w-full max-w-[720px]">
          {phase !== "door" && (
            <div className="hidden flex-wrap gap-[7px] px-0.5 pb-[9px] sm:flex">
              {shortcuts.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setDraft(label); inputRef.current?.focus(); }}
                  className="cursor-pointer rounded-full border border-[#E3E0DA] bg-white px-[13px] py-[7px] text-[13.5px] text-[#5F5D59] hover:border-[#141414] hover:text-[#141414]"
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
          <div className="flex items-end gap-2.5 rounded-[16px] border border-[#DDD9D1] bg-white py-1.5 pl-[18px] pr-2" style={{ boxShadow: "0 6px 26px rgba(20,20,20,.09)" }}>
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
              placeholder={phase === "door" ? EXAMPLES[0] : PLACEHOLDERS[ph]}
              rows={1}
              className="h-[52px] flex-1 resize-none border-0 bg-transparent py-3.5 text-[17px] leading-[1.45] text-[#141414] outline-none placeholder:text-[#A3A099]"
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
              title="Drop or choose a plain-text document and I will read it"
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
              {busy ? "Reading…" : phase === "door" ? "Start" : "Send"}
            </button>
          </div>
          <p className="m-0 px-1 pb-0 pt-[9px] text-[13px] leading-normal text-[#A3A099]">
            Everything on this page can be done by saying it. Drop a plain-text document on the arrow and I will read it. Nothing is published without your signature.
          </p>
        </div>
      </div>

      {/* ── THE REQUIREMENT SHEET ── a deliberately opened overlay, never
          a column; every row carries its provenance. */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,20,20,.34)" }} onClick={() => setSheetOpen(false)}>
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
                onClick={() => setSheetOpen(false)}
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
                  <div className="border-b border-[#141414] pb-2 text-[11px] uppercase text-[#8C8A85]" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: "0.11em" }}>
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
