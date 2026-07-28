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
import { statedObjectivesIn, type AllowedPath, type BuyingId, type FieldUpdate } from "@/lib/workspace/extract";
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
import WorkspaceDiagram from "@/components/WorkspaceDiagram";
import SignIn from "@/components/SignIn";
import { fireNetifyEvent, firstTouch } from "@/components/NetifyEvents";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DRAFT_KEY = "netify_workspace_draft_v1";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const WORKSPACE_AGREEMENT_TEXT =
  "Publish this requirement: Netify lists an anonymous notice visible to signed-in suppliers and invites the best-fit evaluated suppliers, who respond through the app. My identity and contact details stay private until I choose to reply, and pricing stays private to me.";

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

type NotedItem = { id: string; label: string; section: string };
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
  const [restored, setRestored] = useState(false);
  /** True once the mount effect has decided between draft, link and the
   *  pristine example, so pre-start controls never flash before a
   *  restore (Robert, 23 Jul: the button flashed then vanished). */
  const [booted, setBooted] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());

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

  const [saveLite, setSaveLite] = useState<"hidden" | "shown" | "sent" | "dismissed">("hidden");
  const [saveLiteSentTo, setSaveLiteSentTo] = useState("");
  const [signedIn, setSignedIn] = useState(false);

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
   * a chip, a paste, a ?q= arrival or a restored draft. ---- */
  useEffect(() => {
    if (!started || previewFired.current) return;
    previewFired.current = true;
    ev("preview_rendered", { facts: facts.length });
  }, [started, facts.length]);
  const brief = useMemo(() => briefModel({ facts, verdict }), [facts, verdict]);
  const diagram = useMemo(() => diagramModel(requirement, verdict, buying), [requirement, verdict, buying]);

  /* ---- Arrival: market, params, restored draft, session ---- */
  useEffect(() => {
    fetch("/sase/api/workspace/market")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Market | null) => {
        if (!d) return;
        setMarket(d);
        setCrew([
          { t: "today", text: `Scout: ${d.counts.vendors} suppliers evaluated · latest ${fmtDate(d.latest_evaluation)}` },
          { t: "now", text: `Registrar: ${d.counts.notices} notice${d.counts.notices === 1 ? "" : "s"} genuinely open on the board` },
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
       only on a ?q= arrival so a restored draft's own pins are never
       overwritten by a stray parameter. Sanitised, capped at five. */
    const vendorsParam = (p.get("vendors") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z0-9-]{2,60}$/.test(s))
      .slice(0, 5);
    let base: WorkspaceFact[] = [];
    if (!q) {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            facts?: WorkspaceFact[]; added?: string[]; removed?: string[];
            noted?: NotedItem[]; receipts?: Receipt[]; moveLog?: MoveLogEntry[]; dismissedQ?: string[]; declinedSug?: string[]; customTitle?: string; weights?: string[]; ts?: number;
          };
          if (saved.ts && Date.now() - saved.ts < DRAFT_MAX_AGE_MS && ((saved.facts?.length ?? 0) > 0 || (saved.noted?.length ?? 0) > 0)) {
            base = saved.facts ?? [];
            setAdded(saved.added ?? []);
            setRemoved(saved.removed ?? []);
            setNoted(saved.noted ?? []);
            setReceipts(saved.receipts ?? []);
            setMoveLog(saved.moveLog ?? []);
            setDismissedQ(saved.dismissedQ ?? []);
            setDeclinedSug(saved.declinedSug ?? []);
            setCustomTitle(saved.customTitle ?? "");
            setWeights(saved.weights ?? []);
            receiptId.current = Math.max(0, ...(saved.receipts ?? []).map((r) => r.id));
            setRestored(true);
          }
        }
      } catch { /* a broken draft never blocks the desk */ }
    }
    if (base.length) {
      factsRef.current = base;
      setFacts(base);
    }
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

  /* ---- Persist the draft ---- */
  useEffect(() => {
    if (!started || published) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ facts, added, removed, noted, receipts, moveLog, dismissedQ, declinedSug, customTitle, weights, ts: Date.now() }));
    } catch { /* best effort */ }
  }, [facts, added, removed, noted, receipts, moveLog, dismissedQ, declinedSug, customTitle, weights, started, published]);

  /* ---- The extraction cycle (the same organ), now with the receipt ---- */
  const runCycle = useCallback(
    async (text: string, opts: { fromEnter?: boolean; fromLink?: boolean } = {}) => {
      const trimmed = text.trim();
      if (trimmed.length < 3 || busy) return;
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
        applyMerge(updates, "extract");

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
        if (unplaced.length) {
          setReceipts((rs) => {
            const have = new Set(rs.map((r) => r.text.toLowerCase()));
            const fresh = unplaced.filter((c) => !have.has(c.toLowerCase()));
            if (!fresh.length) return rs;
            return [...rs, ...fresh.map((text) => ({ id: ++receiptId.current, text }))].slice(-12);
          });
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
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const deadline = Date.now() + 30000;
    rec.onstart = () => { lastError = ""; };
    rec.onaudiostart = () => setVoiceState("listening");
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
    try { rec.start(); } catch { setVoiceState("idle"); voiceRec.current = null; }
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
                  crewLog(`Scout: ${label} checked · ${evidencedQuietly} suppliers evidence it · the order stands`);
                }
              }
            } else {
              crewLog(`Scout: ${d.count} of ${d.total} evaluated suppliers fit this scope · order is evidence against your checks`);
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
      .then((d: { authenticated?: boolean }) => setSignedIn(Boolean(d?.authenticated)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (saveLite !== "hidden" || signedIn || published || created) return;
    if (started && (Boolean(verdict) || live.length >= 3)) {
      // Once per session (v7): a dismissed prompt that returns on the next
      // fact reads as nagging; the second sight of it costs more trust
      // than the email is worth.
      try {
        if (window.sessionStorage.getItem("netify_savelite_once")) return;
        window.sessionStorage.setItem("netify_savelite_once", "1");
      } catch { /* storage denied: show it, never crash */ }
      setSaveLite("shown");
      ev("workspace_save_lite_shown", { facts: live.length });
    }
  }, [saveLite, signedIn, published, created, verdict, live.length, started]);
  // And the other half of Harry's catch: a prompt already on screen must
  // stand down the moment the person signs in, creates or publishes.
  // Asking someone to keep a position they have just signed for is the
  // single most confusing moment testing found.
  useEffect(() => {
    if ((saveLite === "shown" || saveLite === "sent") && (signedIn || published || created)) {
      setSaveLite("dismissed");
    }
  }, [saveLite, signedIn, published, created]);

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

  useEffect(() => { receiptsRef.current = receipts; }, [receipts]);

  const dismissReceipt = useCallback((id: number) => {
    setReceipts((rs) => rs.filter((r) => r.id !== id));
  }, []);

  /* ---- Fit sets, pins, readiness ---- */
  const fitSlugs = (fit?.mode === "graded" ? fit.suppliers.map((s) => s.slug) : []).filter((s) => !removed.includes(s));
  const shownFit = new Set([...fitSlugs, ...added].slice(0, 8));
  const pins = [...new Set([...added, ...fitSlugs])].slice(0, 5);
  const unansweredGaps = brief.openGaps;

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

  const signLocked =
    !started || facts.length === 0 || Boolean(published) || (securityScope && (!verdict || verdict.confidence === "low")) || (!securityScope && !buying);
  const lockReason = !started
    ? null
    : facts.length === 0
      ? "Selections alone are notes so far: say one sentence about the organisation and the engine takes over."
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
      : securityScope && (!verdict || verdict.confidence === "low")
        ? "Answer the open questions on the position first: nothing publishes on guesswork."
        : !securityScope && !buying
          ? "Choose what you are buying (SASE, SD-WAN, SSE or managed security) and publishing unlocks."
          : "It unlocks when the position holds enough truth to stand on.";

  /* ---- The artefact, with the notes appended honestly ---- */
  const artefactText = useCallback(() => {
    let text = briefText(brief);
    if (noted.length) {
      text += `\n\n## Buyer selections (structured fields pending)\n${noted.map((n) => `- ${n.label} [stated by selection]`).join("\n")}`;
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
        text += `\n\n## Scoring priorities (weighted high)\n${weights.map((k) => `- ${TAXONOMY.find((s) => s.key === k)?.title ?? k}`).join("\n")}`;
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
        body: JSON.stringify({ manage_token: proj.manage, list_on_board: true }),
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
        crewLog(`Scout: ${invited.length} supplier${invited.length === 1 ? "" : "s"} invited · responses arrive against your position`);
        ev("workspace_published", { scope: buying ?? "security", invited: invited.length });
        try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* done */ }
      } else if (data.auth_required) {
        setNeedAuth(true);
        ev("workspace_auth_required", { scope: buying ?? "security" });
      } else {
        throw new Error(data.error || "Could not publish; try again.");
      }
    } catch (e) {
      setSignError(e instanceof Error ? e.message : "Something failed; nothing has been sent to suppliers. Try again.");
    } finally {
      setSignStage(null);
    }
  }

  const startAfresh = () => {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* fine */ }
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
      return { key: sec.key, title: sec.title, state, standingN, openQ: oq, notedN, latestCycle };
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
   * the baseline, so a restored draft never fires a page of rings. */
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
        @keyframes pdink{0%{background:rgba(217,119,6,.14)}100%{background:transparent}}
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
          className={`rounded-[18px] border border-zinc-200 bg-white px-7 pb-5 pt-6 text-center shadow-[0_1px_0_rgba(24,24,27,.05),0_18px_44px_-20px_rgba(24,24,27,.25),0_2px_12px_-4px_rgba(180,83,9,.08)] sm:px-8${yoursRing ? " pd-live-in" : ""}`}>
        {/* Robert's heading ruling, 26 Jul 2026, stays word for word as
            the caption; the field itself now reads as a field (v7: one
            hero start from fifteen thousand visitors said the card read
            as a brochure). */}
        <p className="m-0 mb-2 text-[10.5px] font-semibold uppercase tracking-[.12em] text-zinc-400">Your first sentence becomes your Statement of Requirements</p>
        {/* Focus is a border change alone (instrument-grade law, 28 Jul:
            no glow ring; the field is alive because words land in it). */}
        <div className="relative rounded-xl border-[1.5px] border-zinc-300 bg-white px-3 py-3 text-left shadow-[inset_0_1px_2px_rgba(15,23,42,.04)] focus-within:border-amber-500">
          <input
            ref={inputRef}
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
            className="w-full bg-transparent pl-1 pr-20 text-left text-[16.5px] text-zinc-900 outline-none placeholder:text-zinc-500"
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
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-zinc-200 text-zinc-400 hover:border-zinc-400 hover:text-zinc-700"
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
              className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-amber-500 p-[7px] text-zinc-950 transition-colors hover:bg-amber-400 ${voiceSupported ? "right-10" : "right-1"}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 11.5 V3 M3.4 6.6 L7 3 l3.6 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px] text-zinc-500">
          {busy && <span aria-live="polite" className="text-zinc-700">Reading…</span>}
          {voiceState === "starting" && !busy && (
            <span aria-live="polite" className="text-zinc-500">Opening the microphone…</span>
          )}
          {voiceState === "listening" && !busy && (
            <span aria-live="polite" className="text-amber-700">Listening… your words land as you speak.</span>
          )}
          {voiceError && !busy && voiceState === "idle" && <span aria-live="polite" className="text-zinc-500">{voiceError}</span>}
          {pasteSummary && !busy && <span aria-live="polite" className="text-zinc-700">{pasteSummary}</span>}
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
                className="rounded-full bg-amber-500 px-5 py-2 text-[13.5px] font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
              >
                {input.trim().length >= 3 ? (
                  <>Structure my requirement <span aria-hidden="true">&rarr;</span></>
                ) : (
                  "Draft my project (free, no sign-in)"
                )}
              </button>
              <span className="text-zinc-400">type it, speak it, or drop any document onto this card. Or start from a sector:</span>
              <span className="flex w-full flex-wrap items-center justify-center gap-1.5">
                {SECTOR_CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => tapSector(c.label)}
                    aria-pressed={selSector === c.label}
                    className={`rounded-full border px-3 py-1 transition-colors ${
                      selSector === c.label
                        ? "border-amber-500 bg-amber-50 text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
                <span aria-hidden="true" className="text-zinc-300">+</span>
                {GOAL_CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => tapGoal(c.label)}
                    aria-pressed={selGoals.includes(c.label)}
                    className={`rounded-full border px-3 py-1 transition-colors ${
                      selGoals.includes(c.label)
                        ? "border-amber-500 bg-amber-50 text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </span>
            </>
          )}
          {restored && !published && (
            <span>
              Draft restored.{" "}
              <button type="button" onClick={startAfresh} className="underline hover:text-zinc-900">Start afresh</button>
            </span>
          )}
          {testMode && <span className="font-medium text-amber-700">Test mode: signing creates a self-expiring test position and never touches the live board.</span>}
        </div>
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
          <div className="mt-4 border-t border-zinc-200 pt-3">
            <p className="m-0 text-center text-[11.5px] text-zinc-500">
              Draft and preview without an account. Sign in only to publish, anonymously, with pricing private to you.
              A Netify analyst reviews every published RFP.
            </p>
            {boardProof && boardProof.open > 0 && (
              <p className="m-0 mt-2 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1.5 text-center text-[12px] text-zinc-600">
                <span>
                  <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-600 align-middle" />
                  {boardProof.open === 1 ? "1 project open to suppliers now" : `${boardProof.open} projects open to suppliers now`}
                </span>
                {boardProof.latest.map((o) => (
                  <a
                    key={o.id}
                    href={`/sase/opportunities/${o.id}`}
                    className="rounded-[7px] border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11.5px] text-zinc-700 no-underline transition-colors hover:border-zinc-400 hover:text-zinc-900"
                  >
                    {o.title}
                    {o.full && <span className="ml-1.5 text-[9px] font-bold tracking-[.08em] text-amber-700">FULL RFP</span>}
                  </a>
                ))}
              </p>
            )}
            {/* The two-buyer line (Robert's ruling, 28 Jul): outcome
                language on the consumer surface; the tool ids moved to
                the connection details (llms.txt, the agents' door). */}
            <p className="m-0 mt-2 text-center text-[11px] text-zinc-500">
              Use Netify directly, or connect your organisation&rsquo;s approved AI agent through MCP. Agents research,
              draft, compare and monitor. Your team publishes, selects and awards.
            </p>
            <p className="m-0 mt-1 text-center text-[10.5px] text-zinc-400">
              Connecting an agent? <a href="/llms.txt" className="underline hover:text-zinc-600">View agent connection details</a>
            </p>
          </div>
        )}
        </section>
        {published && (
          <p className="m-0 mt-3 text-[13px] text-zinc-700">
            <span className="text-[15px] italic">Live. The market answers here.</span>{" "}
            {published.boardId && (
              <a href={`/sase/opportunities/${published.boardId}`} className="underline">your notice on the board</a>
            )}
            {" · "}
            <a href={`/sase/project/${created?.id}${created?.manage ? `?manage=${encodeURIComponent(created.manage)}` : ""}`} className="underline">your position&rsquo;s record</a>
          </p>
        )}
      </div>

      {afterPrompt}

      {/* The door recut (Robert's build ruling, 28 Jul, the sourcing
          engine): before a project exists the page is the door and
          nothing else renders below the journey strip. The spine, the
          example listing, the framework sections, the crew and the
          below-fold explanations appear only for a started or published
          project, where they continue unchanged until the interview
          face (slice two) reshapes them. */}
      {(started || Boolean(published)) && (<>

      {/* ---- The procurement spine (the consolidation, Robert's word, 23
              Jul evening): the three-step journey grown to the canon's five
              acts, same seat, same quiet, never cards. States render only
              when true: act one carries the live position once it exists;
              act two prefers the live market number and only shows the
              approved 30+ line before the feed answers; unearned acts state
              their promise and never a count. ---- */}
      <div className="mx-auto mt-6 w-[min(860px,100%)]">
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px] leading-snug text-zinc-600 sm:flex-row sm:justify-center sm:gap-7">
          <li className="sm:max-w-[150px]">
            <span className="mr-2 font-semibold tabular-nums text-zinc-300">1</span>
            <span className="font-medium text-zinc-700">Describe</span>
            <span className="mt-0.5 block pl-[17px] text-[10.5px] leading-snug text-zinc-400">
              {started && live.length > 0
                ? <>SoR live · {live.length} claim{live.length === 1 ? "" : "s"} held</>
                : "one description of your project"}
            </span>
          </li>
          <li className="sm:max-w-[170px]">
            <span className="mr-2 font-semibold tabular-nums text-zinc-300">2</span>
            <span className="font-medium text-zinc-700">Publish</span>
            <span className="mt-0.5 block pl-[17px] text-[10.5px] leading-snug text-zinc-400">
              {published
                ? <span className="text-amber-700">live on the board{published.invited.length > 0 ? ` · ${published.invited.length} supplier${published.invited.length === 1 ? "" : "s"} invited` : " · anonymous"}</span>
                : <>SoR, RFI or full RFP · anonymous to {market ? `${market.counts.vendors}${market.counts.vendors >= 30 ? "+" : ""}` : "30+"} suppliers</>}
            </span>
          </li>
          <li className="sm:max-w-[160px]">
            <span className="mr-2 font-semibold tabular-nums text-zinc-300">3</span>
            <span className="font-medium text-zinc-700">Proposals</span>
            <span className="mt-0.5 block pl-[17px] text-[10.5px] leading-snug text-zinc-400">
              {published && created?.id
                ? <a className="underline hover:text-zinc-700" href={`/sase/project/${created.id}${created.manage ? `?manage=${encodeURIComponent(created.manage)}` : ""}`}>responses land in your record</a>
                : "competing responses land here"}
            </span>
          </li>
          <li className="sm:max-w-[160px]">
            <span className="mr-2 font-semibold tabular-nums text-zinc-300">4</span>
            <span className="font-medium text-zinc-700">Compare &amp; shortlist</span>
            <span className="mt-0.5 block pl-[17px] text-[10.5px] leading-snug text-zinc-400">
              {published && created?.id ? "side by side in your record, evidence lines" : "side by side, evidence lines"}
            </span>
          </li>
          <li className="sm:max-w-[140px]">
            <span className="mr-2 font-semibold tabular-nums text-zinc-300">5</span>
            <span className="font-medium text-zinc-700">Manage</span>
            <span className="mt-0.5 block pl-[17px] text-[10.5px] leading-snug text-zinc-400">one thread to award</span>
          </li>
        </ol>
      </div>

      {/* ---- The listing in formation (Robert, 23 Jul: the opportunity
              listing returns to the top): the notice as the market will see
              it, updating with every sentence. Example-labelled until the
              buyer starts; anonymous always; never publishes by itself. ---- */}
      <div className="mx-auto mt-5 w-[min(760px,100%)]">
        <section aria-label="Your opportunity, as the market will see it" className={`rounded-xl border p-5 ${published ? "border-amber-300 bg-amber-50/40" : "border-zinc-200 bg-white"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-400">
              {published ? (<><span className="pd-breath mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-amber-400 align-[0px]" />Live on the board</>) : started ? "Your opportunity · as the market will see it" : "Example listing"}
            </p>
            <span className={`rounded-full px-2 py-[1px] text-[10px] font-semibold uppercase tracking-[.08em] ${published ? "border border-amber-200 bg-amber-50 text-amber-800" : started ? "bg-zinc-100 text-zinc-500" : "border border-zinc-200 bg-white text-zinc-500"}`}>
              {published ? "genuinely open" : started ? "updating as you speak" : "make it yours"}
            </span>
          </div>
          <p className={`m-0 mt-1.5 text-[15px] font-semibold leading-snug ${started ? "text-zinc-900" : "text-zinc-400"}`}>
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
                  { v: opModel === "managed" ? "fully managed" : opModel === "co_managed" ? "co-managed" : "", paths: ["procurement.operatingModel"], sec: "model" },
                  { v: (requirement.organisation?.regions ?? []).map((r) => REGION_LABELS[r] ?? r).join(", "), paths: ["organisation.regions"], sec: "organisation" },
                  { v: (requirement.constraints?.complianceRequirements ?? []).map((c) => COMPLIANCE_LABELS[c] ?? c).join(", "), paths: ["constraints.complianceRequirements"], sec: "compliance" },
                ].filter((c) => c.v))
              : [
                  { v: "Retail", paths: [], sec: "organisation" },
                  { v: "1,900 users", paths: [], sec: "organisation" },
                  { v: "42 sites", paths: [], sec: "organisation" },
                  { v: "the UK", paths: [], sec: "organisation" },
                  { v: "SASE and SD-WAN", paths: [], sec: "objectives" },
                  { v: "fully managed", paths: [], sec: "model" },
                  { v: "PCI DSS", paths: [], sec: "compliance" },
                ];
            if (!chips.length) {
              return <p className="m-0 mt-1 text-[11px] leading-relaxed text-zinc-600">your first sentence starts this listing</p>;
            }
            return (
              <p className="m-0 mt-1.5 leading-loose">
                {chips.map((c) => {
                  const pf = c.paths.length ? facts.find((f) => !f.struck && c.paths.includes(f.path)) : undefined;
                  const prov = pf?.provenance;
                  const cls = !started
                    ? "border-zinc-200 text-zinc-400"
                    : prov === "stated"
                      ? "border-zinc-400 text-zinc-800"
                      : prov === "inferred"
                        ? "border-dotted border-zinc-400 text-zinc-700"
                        : "border-zinc-200 text-zinc-600";
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
                      className={`mr-1.5 inline-block rounded-full border bg-white px-2.5 py-[2px] text-[11px] transition-colors hover:border-amber-500 ${cls}`}
                    >
                      {c.v}
                    </button>
                  );
                })}
              </p>
            );
          })()}
          <p className="m-0 mt-1.5 text-[11px] text-zinc-400">
            {published && published.boardId
              ? (<>your notice is live: <a href={`/sase/opportunities/${published.boardId}`} className="underline">see it on the board</a></>)
              : started
              ? "anonymous on publish: no name, no contacts · signed-in suppliers see it, never public visitors · nothing is sent without your signature"
              : "a worked example · it becomes yours the moment you speak, paste or touch the document below · never publishes"}
          </p>
        </section>
      </div>

      {/* ---- The Netify SASE Constellation: the market takes position ---- */}
      <div className={`mx-auto mt-16 w-full ${started ? "" : "max-w-[880px]"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-500">
            The Netify SASE Constellation
          </p>
          <p className="m-0 text-[11px] text-zinc-400">
            distance is fit · every position computed from graded evidence · a supplier only moves on its own evidence
          </p>
        </div>
        {marketRows.shown.length === 0 && (
          <p className="m-0 mt-1 text-[11px] leading-relaxed text-zinc-400">
            Empty until you describe your project. Then the evaluated market takes position around your words: the
            closest fit sits nearest, each supplier keeps its own fixed place and colour, and evidence draws the lines.
          </p>
        )}
        {marketRows.shown.length > 0 && (
          <svg
            viewBox={`0 0 ${SCENE.w} ${SCENE.h}`}
            className="mt-1 block w-full"
            role="img"
            aria-label="The Netify SASE Constellation: suppliers positioned by evidence against your named requirements, capability lines where the dataset grades them"
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
              fill={started ? "#18181b" : "none"}
              stroke={started ? "none" : "#a1a1aa"}
              strokeDasharray={started ? undefined : "3 3"}
            />
            <text x={SCENE.cx} y={SCENE.cy + 20} fontSize={7.5} textAnchor="middle" fill="#a1a1aa" style={{ letterSpacing: ".12em" }}>YOU</text>

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
                  <rect x={c.x - 3.2} y={c.y - 3.2} width={6.4} height={6.4} transform={`rotate(45 ${c.x} ${c.y})`} fill="#18181b" />
                  <text
                    x={c.x} y={(above ? c.y - 8 : c.y + 14) + (sceneLabels[c.id] ?? 0)}
                    fontSize={8}
                    textAnchor="middle"
                    fill="#3f3f46"
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
              const labelInk = bright ? "#18181b" : recent ? "#52525b" : "#a8a29e";
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
                      <line x1={0} y1={0} x2={SCENE.cx - b.x} y2={SCENE.cy - b.y} stroke="#f59e0b" strokeWidth={1.3} opacity={0.5} />
                      <circle r={size + 3.2} fill="none" stroke="#f59e0b" strokeWidth={1.4} className={published ? "pd-breath" : undefined} />
                    </>
                  )}
                  {added.includes(v.slug) && <circle r={size + 3} fill="none" stroke="#a1a1aa" strokeWidth={0.8} />}
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
        <p className="m-0 mt-1 text-[11px] leading-snug text-zinc-400">
          {capNodes.length > 0 ? (
            <>Diamonds are the requirements your own words created; a line exists only where Netify&rsquo;s dataset grades that supplier for that requirement (solid evidenced, dashed partial). Hover a supplier or a requirement to isolate its evidence. Circles are technology vendors, squares managed providers.</>
          ) : (
            <>Name what you need and the market takes position around it: your requirements appear here as points of gravity, with a line from every supplier the evidence supports. Circles are technology vendors, squares managed providers; no supplier is closer than the evidence puts it.</>
          )}
          {market?.latest_evaluation ? ` Evidence: Netify vendor dataset, live · latest evaluation ${fmtDate(market.latest_evaluation)}.` : ""}
        </p>
      </div>

      {/* ---- Readiness: three things first, from real state only ---- */}
      {started && (
        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2">
          <span><span className="text-[19px] font-bold tracking-tight text-zinc-900">{meter.confirmed}</span>
            <span className="ml-1.5 text-[11px] text-zinc-500">requirement{meter.confirmed === 1 ? "" : "s"} in your words</span></span>
          {meter.inferred > 0 && (
            <span><span className="text-[19px] font-bold tracking-tight text-amber-700">{meter.inferred}</span>
              <span className="ml-1.5 text-[11px] text-zinc-500">inferred, yours to confirm or strike</span></span>
          )}
          {openQuestionCount > 0 && (
            <span><span className="text-[19px] font-bold tracking-tight text-amber-700">{openQuestionCount}</span>
              <span className="ml-1.5 text-[11px] text-zinc-500">open question{openQuestionCount === 1 ? "" : "s"} in place below</span></span>
          )}
          <span className="ml-auto text-right text-[11px] leading-relaxed text-zinc-400">
            {receipts.length > 0 ? `${receipts.length} of your words captured in Notes, unplaced · ` : ""}
            {market ? `${market.counts.vendors} suppliers evaluated against this position` : ""}
          </span>
        </div>
      )}

      {/* ---- The areas: a second view of the same position (slice four).
              Every state derives from the fixtured module, never styling. ---- */}
      {started && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {areaStates.map((a) => {
              const dot =
                a.state === "confirmed" ? "bg-zinc-900" :
                a.state === "stated" ? "border-[1.5px] border-zinc-600 bg-white" :
                a.state === "suggested" ? "border-[1.5px] border-dotted border-amber-600 bg-white" :
                a.state === "needs_attention" ? "bg-amber-500" :
                a.state === "excluded" ? "border border-zinc-300 bg-white" :
                "border border-zinc-200 bg-white";
              const ink =
                a.state === "example" ? "text-zinc-300" :
                a.state === "needs_attention" || a.state === "suggested" ? "text-zinc-700" :
                a.state === "excluded" ? "text-zinc-400 line-through" : "text-zinc-800";
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    setAreaDetail(areaDetail === a.key ? null : a.key);
                    document.getElementById(`sec-${a.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={`flex items-center gap-1.5 text-[11px] ${ink} hover:text-zinc-900`}
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
              compliance: "shapes the security requirements and limits which suppliers are eligible",
              opmodel: "decides managed service suitability across the market",
              estate: "drives the migration plan and the coverage checks",
              security: "becomes evidence checks for every supplier",
              commercial: "its open decisions hold publication",
              organisation: "sets the scale band suppliers are matched at",
            };
            return (
              <p className="m-0 mt-1.5 border-t border-zinc-100 pt-1.5 text-[11px] leading-relaxed text-zinc-500" role="status">
                <span className="font-semibold text-zinc-700">{a.title}</span>: {a.state.replace("_", " ")} ·{" "}
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

      {/* ---- The desk: the document and the responding organs ---- */}
      <div className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_336px]">

        {/* ============ THE PROJECT: the living Statement of Requirements ============ */}
        <div>
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-zinc-900 pb-2">
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
                className="m-0 w-full border-b border-dashed border-zinc-400 bg-transparent tracking-tight outline-none focus:border-amber-500"
                style={{ fontSize: "19px", lineHeight: 1.3, fontWeight: 600, color: "#09090b" }}
                aria-label="Project title"
              />
            ) : (
              <h2
                className={`m-0 tracking-tight ${published ? "" : "cursor-text"}`}
                style={{ fontSize: "19px", lineHeight: 1.3, fontWeight: 600, color: facts.length || customTitle.trim() ? "#09090b" : "#a1a1aa" }}
                onClick={() => !published && setEditingTitle(true)}
                title={published ? undefined : "Click to name your project"}
              >{title}</h2>
            )}
            <span className="whitespace-nowrap text-[10px] uppercase tracking-[.12em] text-zinc-400">Statement of Requirements · living</span>
          </div>
          <p className="m-0 mb-4 mt-1.5 text-[11px] text-zinc-500">
            {facts.length === 0 && noted.length === 0
              ? "Empty, honestly. Grey is example content: it shows the destination, never publishes, never counts."
              : <>
                  {meter.total} fact{meter.total === 1 ? "" : "s"} · {meter.confirmed} stated · {meter.inferred} inferred
                  {meter.struck > 0 ? ` · ${meter.struck} struck` : ""}
                  {unansweredGaps.length > 0 ? <> · <span className="text-amber-700">{unansweredGaps.length} question{unansweredGaps.length === 1 ? "" : "s"} open</span></> : ""}
                  {noted.length > 0 ? ` · ${noted.length} noted` : ""}
                  {" · "}
                  <button type="button" className="underline hover:text-zinc-900" onClick={() => setArtefactOpen((o) => !o)}>
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
              <span className="rounded-full border border-amber-400 bg-white px-2.5 py-[2px] text-[10px] font-semibold uppercase tracking-[.08em] text-amber-800">SoR · live</span>
              <span
                data-instrument-rfi={instrumentLadder.rfi.state}
                className={`rounded-full px-2.5 py-[2px] text-[10px] uppercase tracking-[.08em] ${
                  instrumentLadder.rfi.state === "ready"
                    ? "border border-amber-400 bg-white font-semibold text-amber-800"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-400"
                }`}
              >
                RFI · <span className="normal-case tracking-normal">{instrumentLadder.rfi.note}</span>
              </span>
              <span
                data-instrument-rfp={instrumentLadder.rfp.state}
                className={`rounded-full px-2.5 py-[2px] text-[10px] uppercase tracking-[.08em] ${
                  instrumentLadder.rfp.state === "ready"
                    ? "border border-amber-400 bg-white font-semibold text-amber-800"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-400"
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
              <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-400">Priorities</span>
              <span className="text-[10.5px] text-zinc-400">weight what matters for scoring:</span>
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
                          ? "border-amber-400 bg-amber-50 font-semibold text-amber-800"
                          : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
                      }`}
                    >
                      {sec.title}{on ? " · high" : ""}
                    </button>
                  );
                })}
            </div>
          )}

          {artefactOpen && (
            <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-3">
              <p className="m-0 mb-1.5 flex items-baseline justify-between gap-3 text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-400">
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
                    className="rounded-full border border-amber-400 bg-white px-2.5 py-[2px] text-[10px] font-semibold uppercase tracking-[.08em] text-amber-800 transition-colors hover:bg-amber-50"
                  >
                    Download your {instrument === "rfp" ? "RFP" : instrument === "rfi" ? "RFI" : "SoR"}
                  </button>
                )}
              </p>
              <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-700">{artefactText()}</pre>
              {!published && (
                <p data-download-law className="m-0 mt-2 border-t border-zinc-100 pt-2 text-[10.5px] leading-relaxed text-zinc-500">
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
              const secNoted = new Set((notedBySection.get(sec.key) ?? []).map((n) => n.id));
              const optionValueIds = new Set(sec.items.filter((i) => i.path).map((i) => factId(i.path as AllowedPath, i.value)));
              const looseFacts = secFacts.filter((f) => !optionValueIds.has(f.id));
              return (
                <section key={sec.key} id={`sec-${sec.key}`} className={`pd-sec mb-5${liveRing.has(sec.key) ? " pd-live-in" : ""}`} style={{ scrollMarginTop: "70px" }}>
                  <h3
                    className="mb-1.5 flex items-baseline justify-between border-b border-zinc-200 pb-1 uppercase"
                    style={{ fontSize: "10px", lineHeight: 1.3, fontWeight: 600, letterSpacing: ".12em", color: "#71717a" }}
                  >
                    {sec.title}
                    <span className={`text-[10px] font-normal normal-case tracking-normal ${isLive ? "invisible" : "text-zinc-300"}`}>{sec.exampleNote}</span>
                  </h3>

                  {/* Organisation renders as fields */}
                  {sec.key === "organisation" && (
                    <OrganisationFields facts={facts} isLive={isLive} flash={flash} onStrike={toggleFact} />
                  )}

                  {/* Options: example ticks, then the choices */}
                  {sec.items.map((item) => {
                    const f = factFor(item);
                    const isNoted = secNoted.has(item.id);
                    const state: "example" | "exampleStruck" | "option" | "stated" | "inferred" | "struck" | "noted" =
                      f ? (f.struck ? "struck" : f.provenance === "stated" ? "stated" : "inferred")
                        : isNoted ? "noted"
                        : item.exampleTick && !isLive ? "example"
                        : item.exampleStruck && !isLive ? "exampleStruck"
                        : "option";
                    return (
                      <ItemLine
                        key={item.id}
                        item={item}
                        state={state}
                        fact={f}
                        flashing={Boolean(f && flash.has(f.id))}
                        disabled={Boolean(published)}
                        onClick={() => clickItem(item, sec.key)}
                      />
                    );
                  })}

                  {/* Facts with no matching option (free values) render in place */}
                  {sec.key !== "organisation" && looseFacts.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={Boolean(published)}
                      onClick={() => toggleFact(f.id)}
                      title={f.struck ? "Restore" : "Strike out"}
                      className={`block w-full py-[3px] text-left text-[13px] leading-snug ${flash.has(f.id) ? "pd-ink" : ""} ${f.struck ? "text-zinc-300 line-through" : "text-zinc-900"}`}
                    >
                      <span className={`mr-2 inline-block w-3 text-center text-[11px] ${f.struck ? "text-zinc-300" : "text-zinc-900"}`}>{f.struck ? "×" : "✓"}</span>
                      <span className={f.struck ? "" : f.provenance === "stated" ? "border-b border-zinc-900" : "border-b border-dotted border-zinc-500"}>{factLabel(f)}</span>
                      {!f.struck && (
                        <span className="ml-2 text-[11px] text-zinc-500">
                          {f.provenance === "stated" ? <em>&ldquo;{f.quote ?? String(f.value)}&rdquo;</em> : (f.reason ?? "inferred")}
                        </span>
                      )}
                    </button>
                  ))}

                  {/* Questions render in place, inside the conversation they interrupt */}
                  {secGaps.map((g) => (
                    <GapLine key={g.key} gap={g} onAnswer={answerGap} />
                  ))}

                  {/* Earned questions (13.14): summoned only by the buyer's
                      own facts, each carrying the AI-search evidence that
                      earned its place. */}
                  {(earnedBySection.get(sec.key) ?? []).map((q) => (
                    <EarnedQuestionLine key={q.id} q={q} onAnswer={answerEarned} onDismiss={() => { setDismissedQ((d) => [...d, q.id]); ev("workspace_earned_dismissed", { q: q.id }); }} />
                  ))}

                  {/* Sector pack suggestions (24 Jul): offered clauses under
                      the pack law. The pack never writes; the buyer's touch
                      does. Declining is permanent and stays on the record. */}
                  {!published && (packSugsBySection.get(sec.key) ?? []).map((sg) => (
                    <div key={sg.id} className="my-1.5 rounded-md border border-dashed border-zinc-300 bg-zinc-50/60 px-2.5 py-2">
                      <p className="m-0 text-[13px] leading-snug text-zinc-800">
                        <span className="mr-1.5 inline-block rounded-sm bg-zinc-200 px-1 py-[1px] align-[1px] text-[10px] font-semibold uppercase tracking-[.08em] text-zinc-600">Suggested · {pack?.label.toLowerCase()}</span>
                        {sg.label}
                      </p>
                      <p className="m-0 mt-0.5 text-[11px] leading-snug text-zinc-500">{sg.reason}</p>
                      <div className="mt-1.5 flex gap-2">
                        <button type="button" onClick={() => acceptSuggestion(sg)} className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-[3px] text-[11px] font-semibold text-white transition-colors hover:bg-black">
                          Add to the record
                        </button>
                        <button type="button" onClick={() => declineSuggestion(sg)} className="rounded-full border border-zinc-300 bg-white px-2.5 py-[3px] text-[11px] text-zinc-600 transition-colors hover:border-zinc-500 hover:text-zinc-900">
                          Decline, keep on record
                        </button>
                      </div>
                    </div>
                  ))}
                  {(packDeclinedBySection.get(sec.key) ?? []).map((sg) => (
                    <p key={`dec-${sg.id}`} className="m-0 py-[3px] text-[13px] leading-snug text-zinc-300">
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
                  className="mb-1.5 flex items-baseline justify-between border-b border-zinc-200 pb-1 uppercase"
                  style={{ fontSize: "10px", lineHeight: 1.3, fontWeight: 600, letterSpacing: ".12em", color: "#71717a" }}
                >
                  Notes, unplaced
                  <span className="text-[10px] font-normal normal-case tracking-normal text-zinc-400">heard, no home yet</span>
                </h3>
                {receipts.map((r) => (
                  <div key={r.id} className="flex items-baseline gap-2 py-[3px] text-[13px] leading-snug text-zinc-600">
                    <span className="text-zinc-400">•</span>
                    <span className="italic">&ldquo;{r.text}&rdquo;</span>
                    <button type="button" onClick={() => dismissReceipt(r.id)} className="ml-auto text-[11px] text-zinc-400 hover:text-zinc-900" title="Remove this note">✕</button>
                  </div>
                ))}
                <p className="m-0 mt-1 text-[11px] leading-snug text-zinc-400">Kept verbatim with your position. Nothing you say is silently dropped.</p>
              </section>
            )}
          </div>

          {/* ---- The signature: where the document ends ---- */}
          <div id="pd-signature" className="mt-6 border-t border-zinc-200 pt-5" style={{ scrollMarginTop: "70px" }}>
            {!published && !created?.test && (
              <div className={ready ? "rounded-lg border-2 border-amber-300 bg-white p-5" : ""}>
                {ready ? (
                  <>
                    <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-amber-700">The signature</p>
                    <p className="m-0 mb-2 text-[15px] italic leading-relaxed text-zinc-900">This position is ready to meet the market.</p>
                    {/* The privacy strip (the conversion pass, 23 Jul): the same
                        facts the old paragraph carried, under one quiet shield. */}
                    <div className="mb-2 flex items-start gap-2 rounded-md bg-zinc-50 px-3 py-2.5">
                      <svg width="14" height="16" viewBox="0 0 14 16" className="mt-[1px] shrink-0" aria-hidden="true">
                        <path d="M7 1 L13 3.2 V8 C13 11.8 10.4 14.2 7 15 C3.6 14.2 1 11.8 1 8 V3.2 Z" fill="none" stroke="#a16207" strokeWidth="1.3" />
                        <path d="M4.6 8 L6.4 9.8 L9.6 6.2" fill="none" stroke="#a16207" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      <p className="m-0 text-[11px] leading-relaxed text-zinc-600">
                        <span className="font-semibold text-zinc-800">The public notice is anonymous.</span> It carries no name and no contacts
                        {requirement.organisation?.sector || usersBandLabel(requirement.estate?.users)
                          ? ` (it reads ${[requirement.organisation?.sector, usersBandLabel(requirement.estate?.users)].filter(Boolean).join(", ")}, nothing more)`
                          : ""}
                        , shows only to signed-in vendors and service providers (public visitors never see it), and the full position goes only to matched suppliers. Assumptions publish labelled as assumptions; example content never publishes at all.
                      </p>
                    </div>
                    {/* Three facts about where this goes, each from live data,
                        none invented. */}
                    <div className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <div className="rounded-md bg-zinc-50 px-3 py-2.5">
                        <p className="m-0 text-[15px] font-bold leading-tight tracking-tight text-zinc-900">
                          {fitSlugs.length > 0 ? fitSlugs.length : market?.counts.vendors ?? "Evaluated"}
                        </p>
                        <p className="m-0 mt-0.5 text-[11px] leading-snug text-zinc-500">
                          {fitSlugs.length > 0
                            ? `evaluated supplier${fitSlugs.length === 1 ? "" : "s"} currently in the running, evidence graded with dates`
                            : "suppliers on the curated market, evidence graded with dates"}
                        </p>
                      </div>
                      <div className="rounded-md bg-zinc-50 px-3 py-2.5">
                        <p className="m-0 text-[15px] font-bold leading-tight tracking-tight text-zinc-900">Anonymous</p>
                        <p className="m-0 mt-0.5 text-[11px] leading-snug text-zinc-500">sector and size only; your identity and contacts never publish</p>
                      </div>
                      <div className="rounded-md bg-zinc-50 px-3 py-2.5">
                        <p className="m-0 text-[15px] font-bold leading-tight tracking-tight text-zinc-900">Yours to close</p>
                        <p className="m-0 mt-0.5 text-[11px] leading-snug text-zinc-500">the notice closes from your project record whenever you choose</p>
                      </div>
                    </div>
                    {/* Slice three (the reference concept): the notice inherits
                        your standing facts exactly as written, shown before you
                        sign, with what stays private beside it. */}
                    <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-400">The notice inherits</p>
                    <p className="m-0 mb-1.5 text-[11px] leading-loose">
                      {[
                        typeof requirement.estate?.sites === "number" ? `${requirement.estate.sites} sites` : null,
                        typeof requirement.estate?.users === "number" ? `${requirement.estate.users} users` : null,
                        buying ? ({ sase: "SASE", sdwan: "SD-WAN", sse: "SSE", managed_security: "managed security" } as Record<string, string>)[buying] ?? buying : null,
                        opModel === "managed" ? "fully managed" : opModel === "co_managed" ? "co-managed" : null,
                        (requirement.organisation?.regions ?? []).length ? `coverage: ${(requirement.organisation?.regions ?? []).map((r) => REGION_LABELS[r] ?? r).join(", ")}` : null,
                        (requirement.constraints?.complianceRequirements ?? []).length ? (requirement.constraints?.complianceRequirements ?? []).map((c) => COMPLIANCE_LABELS[c] ?? c).join(", ") : null,
                      ].filter(Boolean).map((chip) => (
                        <span key={String(chip)} className="mr-1.5 inline-block rounded-full border border-zinc-200 bg-white px-2 py-[1px] text-[11px] text-zinc-700">{chip}</span>
                      ))}
                      <span className="text-[11px] text-zinc-400">exactly as written, nothing retyped</span>
                    </p>
                    <p className="m-0 mb-2 text-[11px] leading-relaxed text-zinc-400">
                      <span className="font-semibold text-zinc-500">Stays private:</span> your identity and contacts, your notes,
                      {unansweredGaps.length > 0 ? ` ${unansweredGaps.length} unanswered question${unansweredGaps.length === 1 ? "" : "s"} (published only as labelled assumptions if you accept them),` : ""}
                      {" "}and anything you have struck from the record.
                    </p>
                    <label className="mb-1.5 flex items-start gap-2 text-[13px] leading-relaxed text-zinc-600">
                      <input type="checkbox" checked={consentCreate} onChange={(e) => setConsentCreate(e.target.checked)} className="mt-0.5" />
                      <span>{securityScope ? CREATE_CONSENT_TEXT : WORKSPACE_AGREEMENT_TEXT}</span>
                    </label>
                    {securityScope && unansweredGaps.length > 0 && (
                      <label className="mb-1.5 flex items-start gap-2 text-[13px] leading-relaxed text-zinc-600">
                        <input type="checkbox" checked={consentGaps} onChange={(e) => setConsentGaps(e.target.checked)} className="mt-0.5" />
                        <span>
                          {ACCEPT_GAP_PREFIX}
                          {unansweredGaps.map((g) => g.question).join(" ")} Accepted gaps publish as stated assumptions.
                        </span>
                      </label>
                    )}
                    {securityScope && (
                      <label className="mb-1.5 flex items-start gap-2 text-[13px] leading-relaxed text-zinc-600">
                        <input type="checkbox" checked={consentPublish} onChange={(e) => setConsentPublish(e.target.checked)} className="mt-0.5" />
                        <span>{ENGINE_PUBLISH_CONSENT_TEXT}</span>
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => void signAndPublish()}
                      disabled={!consentsOk || Boolean(signStage)}
                      className="mt-1 w-full rounded-full bg-amber-500 px-5 py-2.5 text-[13px] font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                    >
                      {signStage ?? (testMode ? "Sign · create the test position" : "Sign and publish your opportunity to the board")}
                    </button>
                    {signError && <p className="m-0 mt-1.5 text-[11px] text-red-600">{signError}</p>}
                    {needAuth && (
                      <div className="mt-2 rounded-md bg-zinc-50 p-3">
                        <p className="m-0 mb-1 text-[11px] text-zinc-600">
                          One step first: publishing reaches named suppliers, so it needs a verified sign-in. Your position is untouched.
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
                            void signAndPublish();
                          }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="m-0 text-[13px] leading-relaxed text-zinc-500">
                    <span className="font-semibold text-zinc-700">A person signs here.</span> One signature publishes an anonymous notice to the open board and the full position to matched suppliers.{" "}
                    {lockReason ?? "It unlocks when the position holds enough truth to stand on."}
                  </p>
                )}
              </div>
            )}
            {created?.test && !published && (
              <div className="rounded-lg border border-amber-400 bg-amber-50 p-4">
                <p className="m-0 text-[13px] font-semibold text-amber-900">Test position created; publishing stayed off</p>
                <p className="m-0 mt-1 text-[11px] leading-relaxed text-amber-900">
                  It self-expires in two hours, touched no live board and contacted no supplier.{" "}
                  <a href={`/sase/project/${created.id}?manage=${encodeURIComponent(created.manage)}`} className="underline">Inspect it</a> or{" "}
                  <button type="button" onClick={startAfresh} className="underline">start a real one</button>.
                </p>
              </div>
            )}

            {/* The four truth classes, stated once */}
            <p className="m-0 mt-3 text-[11px] leading-relaxed text-zinc-400">
              <span className="text-zinc-300">grey</span> example, never publishes · <span className="italic text-zinc-600">&ldquo;quoted&rdquo;</span> captured, awaiting interpretation ·{" "}
              <span className="border-b border-zinc-900 text-zinc-900">solid ink</span> stated, your words or your touch ·{" "}
              <span className="border-b border-dotted border-zinc-500 text-zinc-600">dotted</span> inferred, reason attached, one tap strikes ·{" "}
              <span className="text-emerald-700">✓ dated</span> verified, evidence stands behind it. Strike anything; a strike is never overridden by re-inference, only by your own words. Nothing on this desk moves without saying what changed.
            </p>
          </div>
        </div>

        {/* ============ THE RESPONDING ORGANS ============ */}
        <div className="space-y-7 lg:sticky lg:top-6 lg:border-l lg:border-zinc-200 lg:pl-6">

          {/* Your estate */}
          <div>
            <p className="m-0 mb-2 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-zinc-600">
              Your estate <span className="text-right font-normal text-zinc-400">{diagram.empty ? "example plan · becomes yours as you speak" : "drawn from your words only"}</span>
            </p>
            {diagram.empty ? (
              <svg viewBox="0 0 300 120" className="block w-full" role="img" aria-label="Example estate plan">
                <rect x="103" y="8" width="94" height="18" rx="4" fill="none" stroke="#e4e4e7" />
                <text x="150" y="20" textAnchor="middle" fontSize="8.5" fill="#d4d4d8">Internet</text>
                <line x1="150" y1="26" x2="150" y2="50" stroke="#e4e4e7" />
                <rect x="85" y="50" width="130" height="30" rx="5" fill="none" stroke="#e4e4e7" />
                <text x="150" y="63" textAnchor="middle" fontSize="8.5" fill="#d4d4d8">12 sites · example</text>
                <g fill="none" stroke="#e4e4e7">
                  {Array.from({ length: 8 }, (_, i) => <rect key={i} x={94 + i * 14} y={68} width={9} height={7} />)}
                </g>
                <text x="150" y="104" textAnchor="middle" fontSize="7.5" fill="#d4d4d8">example content · never publishes</text>
              </svg>
            ) : (
              <WorkspaceDiagram model={diagram} />
            )}
            <p className="m-0 mt-1 text-[11px] leading-snug text-zinc-500">Redraws on every correction; never invents topology.</p>
          </div>

          {/* The market, live */}
          <div>
            <p className="m-0 mb-1.5 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-zinc-600">
              The market, live <span className="text-right font-normal text-zinc-400">movement is written</span>
            </p>
            <p className="m-0 mb-2 text-[11px] text-zinc-500">
              {market ? (
                <>
                  {market.counts.notices > 0 && <span className="pd-breath mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-amber-400 align-[0px]" />}
                  {market.counts.vendors} suppliers evaluated{market.latest_evaluation ? `, latest ${fmtDate(market.latest_evaluation)}` : ""} · {market.counts.notices} notice{market.counts.notices === 1 ? "" : "s"} genuinely open ·{" "}
                  <a href="/sase/opportunities/board/" className="underline hover:text-zinc-900">the board</a>
                </>
              ) : "Reaching the market…"}
            </p>
            {/* Article 14: the movement explains itself beside the movement,
                written, naming the supplier. The scene itself is the Netify
                SASE Constellation band above the document; this pane is its
                written ledger. */}
            {marketRows.shown.some((v) => moveNow[v.slug]) && (
              <div className="mt-1 border-t border-zinc-100 pt-1">
                {marketRows.shown.filter((v) => moveNow[v.slug]).map((v) => {
                  const mv = moveNow[v.slug];
                  return (
                    <p key={v.slug} className={`m-0 mb-0.5 text-[11px] leading-snug ${mv.dir === "down" ? "text-zinc-400" : "text-zinc-600"}`}>
                      {mv.dir === "up" ? `▲${mv.places > 0 ? ` +${mv.places}` : ""}` : mv.dir === "down" ? `▼${mv.places > 0 ? ` −${mv.places}` : ""}` : "· holds"}{" "}
                      {v.name} · {mv.label}: {gradeWord(mv.grade) || "no longer required"}
                      {mv.grade === "yes" || mv.grade === "partial" ? ` · evaluated ${fmtDate(mv.date)}` : ""}
                    </p>
                  );
                })}
              </div>
            )}
            {marketRows.more > 0 && (
              <p className="m-0 mt-1 text-[11px] text-zinc-400">and {marketRows.more} more evaluated suppliers, all in the running.</p>
            )}
            <p className="m-0 mt-1.5 text-[10px] leading-snug text-zinc-400">
              Every movement in the Constellation is written here the moment it happens, with its evidence and date.
              Nothing moves without a truthful answer to &ldquo;what changed?&rdquo;. Touch any supplier in the scene for its record.
            </p>
            {vendorCard && (
              <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
                <button type="button" onClick={() => setVendorCard(null)} className="float-right text-zinc-400 hover:text-zinc-900">✕</button>
                <p className="m-0 text-[13px] font-semibold text-zinc-900">
                  {vendorCard.name}
                  {namedSlugs.has(vendorCard.slug) && <span className="ml-1.5 rounded-full bg-zinc-200 px-1.5 text-[10px] font-normal text-zinc-600">named in your position</span>}
                </p>
                <p className="m-0 mt-0.5 text-[11px] text-zinc-500">{vendorCard.category}</p>
                <p className="m-0 mt-1 text-[11px] leading-relaxed text-zinc-600">
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
                    <p className="m-0 mt-1 text-[11px] leading-relaxed text-zinc-600">
                      Against your named requirements: {full} evidenced
                      {part > 0 ? `, ${part} partially evidenced` : ""}
                      {fs.missed.length > 0 ? `, ${fs.missed.length} without evidence on file` : ""}.
                      Missing evidence is a supplier gap, never a verdict.
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
                        <div className="mt-1.5 border-t border-zinc-200 pt-1.5 text-[11px] leading-relaxed text-zinc-600">
                          <p className="m-0"><b className="text-zinc-800">What changed:</b> your requirement {mv.grade ? "gained" : "withdrew"} {mv.label}.</p>
                          <p className="m-0"><b className="text-zinc-800">Why it moved:</b> {mv.label} is {gradeWord(mv.grade) || "no longer checked"} for {vendorCard.name}.</p>
                          <p className="m-0"><b className="text-zinc-800">Evidence:</b> evaluated {fmtDate(vendorCard.last_verified)}.</p>
                        </div>
                      )}
                      {fs && (fs.matched.length > 0 || fs.missed.length > 0) && (
                        <div className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                          {fs.matched.length > 0 && <p className="m-0">Evidences: {fs.matched.map((m) => m.label).join(", ")}.</p>}
                          {fs.missed.length > 0 && <p className="m-0 text-zinc-400">Not evidenced: {fs.missed.map((m) => m.label).join(", ")}.</p>}
                        </div>
                      )}
                      {hist.length > 0 && (
                        <div className="mt-1.5 text-[10px] leading-relaxed text-zinc-400">
                          {hist.map((h, i) => (
                            <p key={i} className="m-0">{h.at} · {h.dir === "up" ? "rose" : h.dir === "down" ? "fell" : "held"} · {h.text}</p>
                          ))}
                        </div>
                      )}
                      <a href={`/sase/${vendorCard.slug}/`} className="mt-1 inline-block text-[11px] text-zinc-700 underline">
                        Challenge it: compare the evidence
                      </a>
                    </>
                  );
                })()}
                {!published && (
                  added.includes(vendorCard.slug) ? (
                    <button
                      type="button"
                      onClick={() => { setAdded((x) => x.filter((s) => s !== vendorCard.slug)); setVendorCard(null); }}
                      className="mt-1.5 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] text-zinc-600 hover:border-zinc-500"
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
                      className="mt-1.5 rounded-full border border-amber-400 px-2.5 py-1 text-[11px] text-amber-700 hover:border-amber-600"
                    >
                      Pin into invitations (up to five)
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* We noticed: emerald, only advice that costs Netify */}
          {verdict && verdict.againstInterest.length > 0 && started && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
              <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-emerald-700">We noticed · against Netify&rsquo;s own interest</p>
              <p className="m-0 text-[13px] leading-relaxed text-emerald-900">{verdict.againstInterest[0].statement}</p>
              {verdict.againstInterest.length > 1 && (
                <p className="m-0 mt-1 text-[11px] text-emerald-700/80">{verdict.againstInterest.length - 1} more ruling{verdict.againstInterest.length === 2 ? "" : "s"} on your record.</p>
              )}
            </div>
          )}

          {/* Save-lite */}
          {saveLite === "shown" && (
            <div className="rounded-lg bg-zinc-50 p-3">
              <p className="m-0 mb-1.5 text-[13px] font-medium text-zinc-800">Want to keep this position?</p>
              <SaveLiteInline
                facts={meter.total}
                onDone={(email) => {
                  setSaveLite("sent");
                  setSaveLiteSentTo(email);
                  ev("workspace_save_lite_sent", { facts: meter.total });
                }}
                onDismiss={() => {
                  setSaveLite("dismissed");
                  ev("workspace_save_lite_dismissed", {});
                }}
              />
            </div>
          )}
          {saveLite === "sent" && (
            <p className="m-0 text-[11px] text-emerald-700">
              Sign-in link sent to {saveLiteSentTo}. The position stays right here; the link signs you in on any device.
            </p>
          )}

          {/* Sector notes (24 Jul): the pack's advice with its provenance.
              Evidence and advice, never requirements; nothing here publishes
              or feeds verdict or fit. Grey, not emerald: this advice costs
              Netify nothing and earns the buyer caution. */}
          {pack && packNotes.length > 0 && (
            <div>
              <p className="m-0 mb-1.5 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-zinc-600">
                Sector notes · {pack.label}{packFlavours.length ? ` · ${packFlavours.map((f) => pack.flavours.find((x) => x.id === f)?.label ?? f).join(" · ")}` : ""}
                <span className="font-normal text-zinc-400">{pack.version}</span>
              </p>
              {packNotes.map((n) => (
                <p key={n.id} className="m-0 mb-1.5 text-[11px] leading-relaxed text-zinc-600">{n.text}</p>
              ))}
              <p className="m-0 text-[10px] leading-snug text-zinc-400">Advice with provenance, never requirements; nothing here publishes.</p>
            </div>
          )}

          {/* The crew */}
          <div>
            <p className="m-0 mb-1.5 text-[11px] font-semibold text-zinc-600">The crew · the activity log · completed work only</p>
            <div className="space-y-0.5 font-mono text-[11px] leading-relaxed text-zinc-500" style={{ fontFamily: "'SF Mono',ui-monospace,Menlo,monospace" }}>
              {crew.slice(-6).map((l, i) => (
                <div key={i}>
                  <span className="mr-2 text-zinc-300">{l.t}</span>
                  <span className={l.cls === "em" ? "text-emerald-700" : l.cls === "you" ? "text-zinc-900" : undefined}>{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- The publish bar (the conversion pass, 23 Jul): the same gate
              the signature enforces, carried with you as you work. It names
              the first real lock in the gate's own words, counts only the
              suppliers the live fit actually holds, and never invents a
              percentage. Amber is the market's colour; nothing pulses here
              because nothing here is a live notice. ---- */}
      {booted && started && !published && !created?.test && (
        <div className="fixed bottom-3 left-3 right-3 z-50 sm:bottom-5 sm:left-auto sm:right-5 sm:w-[330px]">
          <div className={`rounded-xl border bg-white/95 p-3 shadow-[0_8px_30px_-12px_rgba(24,24,27,.35)] backdrop-blur ${ready ? "border-amber-400" : "border-zinc-200"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="m-0 text-[13px] font-semibold text-zinc-900">
                {ready
                  ? instrument === "rfp" ? "Ready to issue your full RFP" : instrument === "rfi" ? "Ready to issue your RFI" : "Ready to publish your SoR notice"
                  : "Not ready to publish yet"}
              </p>
              {ready && <span className="rounded-full bg-amber-100 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[.08em] text-amber-800">unlocked</span>}
            </div>
            <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              {ready
                ? instrument === "rfp"
                  ? "The RFP goes out anonymous with your priorities and question set declared: no name, no contacts. Signed-in vendors and service providers see it; public visitors never do."
                  : instrument === "rfi"
                    ? "The RFI goes out anonymous with your question set declared: no name, no contacts. Signed-in vendors and service providers see it; public visitors never do."
                    : "The SoR notice goes out anonymous: no name, no contacts. Signed-in vendors and service providers see it; public visitors never do."
                : publishBarLock}
            </p>
            {(fitSlugs.length > 0 || market) && (
              <p className="m-0 mt-1 text-[11px] text-zinc-600">
                {fitSlugs.length > 0
                  ? `${fitSlugs.length} evaluated supplier${fitSlugs.length === 1 ? "" : "s"} currently in the running`
                  : `${market?.counts.vendors} evaluated suppliers on the curated market`}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                ev("workspace_publish_bar_cta", { ready: ready ? 1 : 0 });
                document.getElementById("pd-signature")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className={`mt-2 w-full rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
                ready
                  ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
                  : "border border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
              }`}
            >
              {ready ? (instrument === "rfp" ? "Issue your full RFP" : instrument === "rfi" ? "Issue the RFI" : "Publish the SoR notice") : "See what remains"}
            </button>
          </div>
        </div>
      )}

      {/* ---- The destination: where the finished position goes (below the desk so the document stays the hero, Robert 23 Jul)
              (the reference concept made live, Robert's word, 23 Jul; every
              claim renders from real data and no em dashes anywhere). ---- */}
      <div className="mt-20">
        <h2 className="m-0" style={{ fontSize: "19px", lineHeight: 1.2, fontWeight: 700, color: "#18181b", letterSpacing: "-0.015em" }}>
          Publish to our SASE Opportunities Board
        </h2>
        <p className="m-0 mt-3 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
          Your completed Statement of Requirements becomes a live opportunity in a curated SASE marketplace, where
          leading vendors and managed service providers can compete for your business. The public listing remains
          anonymous, while the private procurement view is made available only to suitable suppliers from
          Netify&rsquo;s curated community of {market ? market.counts.vendors : "evaluated"} UK, North American and
          global SASE partners.
        </p>
        <svg viewBox="0 0 1060 150" className="mt-4 hidden w-full sm:block" role="img"
          aria-label="The journey: a living Statement of Requirements becomes an anonymous published opportunity in a curated marketplace; supplier responses return for comparison and a decision you sign.">
          <line x1="30" y1="62" x2="1030" y2="62" stroke="#e4e4e7" strokeWidth="1" />
          <g>
            <rect x="52" y="44" width="28" height="36" rx="3" fill="#fff" stroke="#3f3f46" strokeWidth="1.2" />
            <line x1="58" y1="54" x2="74" y2="54" stroke="#3f3f46" strokeWidth="1" />
            <line x1="58" y1="61" x2="74" y2="61" stroke="#a1a1aa" strokeWidth="1" />
            <line x1="58" y1="68" x2="68" y2="68" stroke="#a1a1aa" strokeWidth="1" />
            <text x="66" y="104" textAnchor="middle" fontSize="10.5" fill="#18181b" fontWeight="600">Living Statement</text>
            <text x="66" y="117" textAnchor="middle" fontSize="9" fill="#a1a1aa">yours, word for word</text>
          </g>
          <g>
            <circle cx="240" cy="62" r="7" fill="#f59e0b" />
            <text x="240" y="104" textAnchor="middle" fontSize="10.5" fill="#18181b" fontWeight="600">Published opportunity</text>
            <text x="240" y="117" textAnchor="middle" fontSize="9" fill="#a1a1aa">anonymous, to signed-in suppliers</text>
          </g>
          <g>
            <circle cx="455" cy="36" r="4.5" fill="#2a78d6" /><circle cx="486" cy="28" r="4.5" fill="#e34948" />
            <circle cx="516" cy="36" r="4.5" fill="#0891b2" /><circle cx="470" cy="52" r="4.5" fill="#7c3aed" />
            <circle cx="501" cy="50" r="4.5" fill="#1d4ed8" /><circle cx="440" cy="50" r="4.5" fill="#be123c" />
            <circle cx="530" cy="52" r="4.5" fill="#4a3aa7" /><circle cx="458" cy="66" r="4.5" fill="#d946ef" />
            <circle cx="490" cy="68" r="4.5" fill="#e87ba4" />
            <text x="512" y="70" fontSize="9.5" fill="#52525b">and more</text>
            <text x="485" y="104" textAnchor="middle" fontSize="10.5" fill="#18181b" fontWeight="600">Curated SASE marketplace</text>
            <text x="485" y="117" textAnchor="middle" fontSize="9" fill="#a1a1aa">{market ? `${market.counts.vendors} evaluated partners` : "evaluated partners"} · UK · North America · Global</text>
            <text x="485" y="129" textAnchor="middle" fontSize="8.5" fill="#c4c2bc">quality over quantity, never a directory</text>
          </g>
          <g>
            <path d="M 700 48 L 686 62 L 700 76" fill="none" stroke="#3f3f46" strokeWidth="1.3" />
            <path d="M 716 48 L 702 62 L 716 76" fill="none" stroke="#a1a1aa" strokeWidth="1.1" />
            <text x="706" y="104" textAnchor="middle" fontSize="10.5" fill="#18181b" fontWeight="600">Supplier responses</text>
            <text x="706" y="117" textAnchor="middle" fontSize="9" fill="#a1a1aa">answering your requirements</text>
          </g>
          <g>
            <line x1="856" y1="48" x2="856" y2="76" stroke="#3f3f46" strokeWidth="2" />
            <line x1="866" y1="54" x2="866" y2="76" stroke="#71717a" strokeWidth="2" />
            <line x1="876" y1="60" x2="876" y2="76" stroke="#a1a1aa" strokeWidth="2" />
            <text x="866" y="104" textAnchor="middle" fontSize="10.5" fill="#18181b" fontWeight="600">Comparison</text>
            <text x="866" y="117" textAnchor="middle" fontSize="9" fill="#a1a1aa">side by side, evidence first</text>
          </g>
          <g>
            <path d="M 985 64 L 991 71 L 1003 52" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
            <text x="994" y="104" textAnchor="middle" fontSize="10.5" fill="#18181b" fontWeight="600">Decision</text>
            <text x="994" y="117" textAnchor="middle" fontSize="9" fill="#a1a1aa">you sign; agents never do</text>
          </g>
        </svg>
        <p className="m-0 mt-2 text-[11px] leading-relaxed text-zinc-400 sm:mt-1">
          <span className="font-semibold text-zinc-500">You stay in control throughout:</span> public listings are
          anonymous · detailed procurement information is restricted to approved suppliers · supplier access and
          invitations remain under your control · every response stays connected to this workspace.
        </p>
      </div>

      </>)}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces (top-level, so focus survives re-renders)                    */
/* ------------------------------------------------------------------ */

/** One line of the framework: the four truth classes as ink. */
function ItemLine(props: {
  item: TaxonomyItem;
  state: "example" | "exampleStruck" | "option" | "stated" | "inferred" | "struck" | "noted";
  fact?: WorkspaceFact;
  flashing: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { item, state, fact } = props;
  const mark = state === "stated" || state === "inferred" || state === "noted" ? "✓" : state === "struck" || state === "exampleStruck" ? "×" : state === "example" ? "✓" : "·";
  const markCls =
    state === "stated" || state === "noted" ? "text-zinc-900"
    : state === "inferred" ? "text-zinc-700"
    : state === "struck" || state === "exampleStruck" ? "text-zinc-300"
    : state === "example" ? "text-zinc-300"
    : "text-zinc-300 group-hover:text-zinc-500";
  const labelCls =
    state === "stated" || state === "noted" ? "border-b border-zinc-900 text-zinc-900"
    : state === "inferred" ? "border-b border-dotted border-zinc-500 text-zinc-800"
    : state === "struck" || state === "exampleStruck" ? "text-zinc-300 line-through"
    : state === "example" ? "text-zinc-300"
    : "text-zinc-400 group-hover:text-zinc-700";
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      title={state === "option" || state === "example" ? `Choose this · ${item.why}` : state === "struck" ? "Restore" : `One tap strikes · ${item.why}`}
      className={`group block w-full py-[3px] text-left text-[13px] leading-snug ${props.flashing ? "pd-ink" : ""}`}
    >
      <span className={`mr-2 inline-block w-3 text-center text-[11px] ${markCls}`}>{mark}</span>
      <span className={labelCls}>{item.label}</span>
      {state === "example" && <span className="ml-2 text-[10px] text-zinc-300">example</span>}
      {state === "exampleStruck" && <span className="ml-2 text-[10px] text-zinc-300">example · {item.exampleStruck}</span>}
      {state === "noted" && <span className="ml-2 text-[11px] text-zinc-500">noted with your position</span>}
      {state === "stated" && fact && (
        <span className="ml-2 text-[11px] text-zinc-500"><em>&ldquo;{fact.quote ?? item.label}&rdquo;</em></span>
      )}
      {state === "inferred" && fact && (
        <span className="ml-2 text-[11px] text-zinc-500">{fact.reason ?? "inferred"}</span>
      )}
    </button>
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
            <span className="w-[72px] flex-none text-[11px] text-zinc-500">{r.k}</span>
            {fs.length === 0 ? (
              <span className={isLive ? "text-[11px] text-zinc-300" : "text-zinc-300"}>
                {isLive ? "not stated" : r.ex}
                {!isLive && r.was && <span className="ml-2 text-[10px] text-zinc-300">example · {r.was}</span>}
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
                        ? "text-zinc-300 line-through"
                        : f.provenance === "stated"
                          ? "border-b border-zinc-900 text-zinc-900"
                          : "border-b border-dotted border-zinc-500 text-zinc-800"
                    }`}
                  >
                    {f.path === "organisation.regions" ? (REGION_LABELS[String(f.value)] ?? String(f.value)) : String(f.value)}
                  </button>
                ))}
                {fs[0] && !fs[0].struck && (
                  <span className="text-[11px] text-zinc-500">
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

/** An earned question (13.14): amber, in place, with its evidence quietly
 *  attached. Answers land through the desk's own machinery. */
function EarnedQuestionLine(props: {
  q: EarnedQuestion;
  onAnswer: (q: EarnedQuestion, answer: QuestionAnswer, value?: string) => void;
  onDismiss: () => void;
}) {
  const { q } = props;
  const [val, setVal] = useState("");
  const textOpt = q.options.find((o) => o.answer.kind === "path");
  return (
    <div className="py-[3px]" title={evidenceLine(q)}>
      <div className="flex items-baseline gap-2 text-[13px] leading-snug text-amber-700">
        <span className="inline-block w-3 flex-none text-center text-[11px] font-bold">?</span>
        <span className="italic">{q.question}</span>
        <button type="button" onClick={props.onDismiss} className="ml-auto text-[11px] text-zinc-400 hover:text-zinc-900" title="Not relevant to this project">✕</button>
      </div>
      <div className="ml-5 mt-1 flex flex-wrap items-center gap-1.5">
        {q.options.filter((o) => o.answer.kind !== "path").map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => props.onAnswer(q, o.answer)}
            className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-[11px] text-zinc-600 hover:border-amber-500 hover:text-zinc-900"
          >
            {o.label}
          </button>
        ))}
        {textOpt && textOpt.answer.kind === "path" && (
          <>
            <input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && val.trim() && props.onAnswer(q, textOpt.answer, val)}
              placeholder={textOpt.answer.placeholder}
              className="w-36 border-b border-dashed border-zinc-400 bg-transparent px-1 py-0.5 text-[13px] text-zinc-900 outline-none focus:border-amber-500"
              aria-label={q.question}
            />
            <button
              type="button"
              onClick={() => val.trim() && props.onAnswer(q, textOpt.answer, val)}
              className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:border-amber-500"
            >
              Set
            </button>
          </>
        )}
        <span className="text-[10px] text-zinc-400">asked by real buyers · hover for the evidence</span>
      </div>
    </div>
  );
}

/** A question, in place: amber, answerable where it stands. */
function GapLine(props: { gap: BriefGap; onAnswer: (gap: BriefGap, value: string, label?: string) => void }) {
  const { gap } = props;
  const [val, setVal] = useState("");
  return (
    <div className="py-[3px]">
      <div className="flex items-baseline gap-2 text-[13px] leading-snug text-amber-700">
        <span className="inline-block w-3 flex-none text-center text-[11px] font-bold">?</span>
        <span className="italic">{gap.question}</span>
      </div>
      {gap.path && gap.control === "chips" && gap.options ? (
        <div className="ml-5 mt-1 flex flex-wrap gap-1.5">
          {gap.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => props.onAnswer(gap, o.value, o.label)}
              className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-[11px] text-zinc-600 hover:border-amber-500 hover:text-zinc-900"
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : gap.path ? (
        <div className="ml-5 mt-1 flex items-center gap-2">
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && val.trim() && props.onAnswer(gap, val.trim())}
            inputMode={gap.control === "number" ? "numeric" : undefined}
            placeholder={gap.control === "number" ? "0" : "type it"}
            className="w-28 border-b border-dashed border-zinc-400 bg-transparent px-1 py-0.5 text-[13px] text-zinc-900 outline-none focus:border-amber-500"
            aria-label={gap.question}
          />
          <button
            type="button"
            onClick={() => val.trim() && props.onAnswer(gap, val.trim())}
            className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:border-amber-500"
          >
            Set
          </button>
        </div>
      ) : (
        <p className="m-0 ml-5 mt-0.5 text-[11px] text-zinc-500">Accepted at the signature; publishes as a stated assumption.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Save-lite, inline (same machinery, same policy)                     */
/* ------------------------------------------------------------------ */

function SaveLiteInline({ facts, onDone, onDismiss }: { facts: number; onDone: (email: string) => void; onDismiss: () => void }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // LinkedIn lane availability (24 July 2026): the save moment is a sign-in
  // moment, and the buyer most likely to be here mid-evening has a personal
  // email the work-email lane refuses. One quiet alternative door.
  const [li, setLi] = useState(false);
  useEffect(() => {
    fetch("/sase/api/auth/session").then((r) => r.json()).then((d) => setLi(Boolean(d?.linkedin && !d?.authenticated))).catch(() => {});
  }, []);
  const send = async () => {
    if (busy || !email.includes("@")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/sase/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: "buyer", return_to: "/sase/workspace/", attribution: firstTouch() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send a link.");
      void fetch("/sase/api/workspace/save-lite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), company: company.trim(), facts }),
      }).catch(() => {});
      onDone(email.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send a link.");
    } finally {
      setBusy(false);
    }
  };
  const cls = "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-500";
  return (
    <div className="space-y-1.5">
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@yourcompany.com" className={cls} aria-label="Work email" />
      <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={cls} aria-label="Company" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void send()} disabled={busy || !email.includes("@")} className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-zinc-950 disabled:opacity-50">
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
        <button type="button" onClick={onDismiss} className="text-[11px] text-zinc-500 underline hover:text-zinc-900">Not now</button>
      </div>
      {li && (
        <button
          type="button"
          onClick={() => {
            const ret = window.location.pathname + window.location.search;
            window.location.href = `/sase/api/auth/linkedin/start?return=${encodeURIComponent(ret)}`;
          }}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[#0A66C2] hover:underline"
        >
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#0A66C2] text-[9px] font-bold leading-none text-white" aria-hidden="true">in</span>
          Or continue with LinkedIn, any email works
        </button>
      )}
      <p className="m-0 text-[11px] leading-snug text-zinc-400">The position stays right here either way. {li ? "We" : "Work email only; we"} only email you about your own projects.</p>
      {error && <p className="m-0 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
