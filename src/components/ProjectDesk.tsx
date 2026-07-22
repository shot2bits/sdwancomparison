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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assessSecurityRequirement, type SecurityScopeVerdict } from "@/lib/security/rulebook";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { ACCEPT_GAP_PREFIX } from "@/components/GapActions";
import type { AllowedPath, BuyingId, FieldUpdate } from "@/lib/workspace/extract";
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
import { deriveAreaState, refineConfirmed } from "@/lib/workspace/areas";
import { diagramModel } from "@/lib/workspace/diagram";
import { BAND, capabilityRing, constellation, labelOffsets, vendorHue } from "@/lib/workspace/constellation";
import WorkspaceDiagram from "@/components/WorkspaceDiagram";
import SignIn from "@/components/SignIn";
import CodeEntry from "@/components/CodeEntry";
import { fireNetifyEvent, firstTouch } from "@/components/NetifyEvents";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DRAFT_KEY = "netify_workspace_draft_v1";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const WORKSPACE_AGREEMENT_TEXT =
  "Publish this requirement: Netify lists an anonymous notice visible to signed-in suppliers and invites the best-fit evaluated suppliers, who respond through the app. My identity and contact details stay private until I choose to reply, and pricing stays private to me.";

const SEEDS: Array<{ label: string; text: string }> = [
  { label: "Managed SIEM, UK", text: "We need a managed SIEM service in the UK. " },
  { label: "Managed SOC and MDR", text: "We are an SME looking for a managed SOC and MDR. " },
  { label: "MSSP for mid-market", text: "We are a mid-market business looking for an MSSP. " },
  { label: "SD-WAN with zero trust", text: "We need SD-WAN with zero trust integration. " },
];

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

export default function ProjectDesk() {
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
  const [testMode, setTestMode] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());

  const [moveNow, setMoveNow] = useState<Record<string, Move>>({});
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [dismissedQ, setDismissedQ] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState<string>("");
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

  const inputRef = useRef<HTMLInputElement | null>(null);
  const firstKeyAt = useRef<number | null>(null);
  const firstVerdictSent = useRef(false);
  const lastRunText = useRef("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptedGaps = useRef<Set<string>>(new Set());
  const cycleRef = useRef(0);
  const receiptId = useRef(0);
  const factsRef = useRef<WorkspaceFact[]>([]);
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
    let base: WorkspaceFact[] = [];
    if (!q) {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            facts?: WorkspaceFact[]; added?: string[]; removed?: string[];
            noted?: NotedItem[]; receipts?: Receipt[]; moveLog?: MoveLogEntry[]; dismissedQ?: string[]; customTitle?: string; ts?: number;
          };
          if (saved.ts && Date.now() - saved.ts < DRAFT_MAX_AGE_MS && ((saved.facts?.length ?? 0) > 0 || (saved.noted?.length ?? 0) > 0)) {
            base = saved.facts ?? [];
            setAdded(saved.added ?? []);
            setRemoved(saved.removed ?? []);
            setNoted(saved.noted ?? []);
            setReceipts(saved.receipts ?? []);
            setMoveLog(saved.moveLog ?? []);
            setDismissedQ(saved.dismissedQ ?? []);
            setCustomTitle(saved.customTitle ?? "");
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
      void runCycle(q, { fromLink: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Persist the draft ---- */
  useEffect(() => {
    if (!started || published) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ facts, added, removed, noted, receipts, moveLog, dismissedQ, customTitle, ts: Date.now() }));
    } catch { /* best effort */ }
  }, [facts, added, removed, noted, receipts, moveLog, dismissedQ, customTitle, started, published]);

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
  useEffect(() => {
    if (saveLite !== "hidden" || signedIn || published || created) return;
    if (started && (Boolean(verdict) || live.length >= 3)) {
      setSaveLite("shown");
      ev("workspace_save_lite_shown", { facts: live.length });
    }
  }, [saveLite, signedIn, published, created, verdict, live.length, started]);

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

  const dismissReceipt = useCallback((id: number) => {
    setReceipts((rs) => rs.filter((r) => r.id !== id));
  }, []);

  /* ---- Fit sets, pins, readiness ---- */
  const fitSlugs = (fit?.mode === "graded" ? fit.suppliers.map((s) => s.slug) : []).filter((s) => !removed.includes(s));
  const shownFit = new Set([...fitSlugs, ...added].slice(0, 8));
  const pins = [...new Set([...added, ...fitSlugs])].slice(0, 5);
  const unansweredGaps = brief.openGaps;

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

  /* ---- The artefact, with the notes appended honestly ---- */
  const artefactText = useCallback(() => {
    let text = briefText(brief);
    if (noted.length) {
      text += `\n\n## Buyer selections (structured fields pending)\n${noted.map((n) => `- ${n.label} [stated by selection]`).join("\n")}`;
    }
    if (receipts.length) {
      text += `\n\n## Notes, unplaced (kept verbatim)\n${receipts.map((r) => `- "${r.text}"`).join("\n")}`;
    }
    return text;
  }, [brief, noted, receipts]);

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
            "Drafted in the Live Sourcing Workspace.",
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

      setSignStage("Publishing to the board…");
      const res = await fetch(`/sase/api/rfp/${proj.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manage_token: proj.manage, list_on_board: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const invited: string[] = Array.isArray(data.invited) ? data.invited.map((i: { slug: string }) => i.slug) : [];
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
  const earnedShown = useMemo(() => {
    const notedIds = noted.map((n) => n.id);
    return earnedQuestions(requirement, buying, opModel, notedIds, dismissedQ).slice(0, 2);
  }, [requirement, buying, opModel, noted, dismissedQ]);
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
    <div className="pd-root mt-6">
      <style>{`
        @keyframes pdink{0%{background:rgba(217,119,6,.14)}100%{background:transparent}}
        .pd-ink{animation:pdink 1.1s ease forwards}
        @keyframes pdbreath{0%,100%{opacity:.45}50%{opacity:1}}
        .pd-breath{animation:pdbreath 3.4s ease-in-out infinite}
        .pd-move{transition:transform .9s cubic-bezier(.22,1,.36,1)}
        @keyframes pdemerge{from{opacity:0}}
        .pd-emerge{animation:pdemerge .9s ease}
        @media(prefers-reduced-motion:reduce){.pd-move{transition:none}.pd-emerge{animation:none}.pd-breath{animation:none}}
        .pd-cols{column-count:1;column-gap:2.5rem}
        @media(min-width:768px){.pd-cols{column-count:2}}
        .pd-sec{break-inside:avoid}
      `}</style>

      {/* ---- The one line in ---- */}
      <div className="mx-auto w-[min(720px,100%)] text-center">
        <div className="flex items-center gap-2 border-b-2 border-zinc-300 px-1 py-2 focus-within:border-amber-500">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              if (!firstKeyAt.current) firstKeyAt.current = Date.now();
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runCycle(input, { fromEnter: true });
              }
            }}
            placeholder={started ? "Add or correct anything: 'actually 45 sites', 'we already run Defender'…" : "Describe your project in one sentence, or touch anything below to begin"}
            disabled={Boolean(published)}
            className="w-full bg-transparent text-center text-[16.5px] italic text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-[17.5px]"
            aria-label="Describe your project"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11.5px] text-zinc-500">
          {busy && <span aria-live="polite" className="text-zinc-700">Reading…</span>}
          {!busy && started && engineUsed === "deterministic_fallback" && <span>Read without the model this turn; everything still works.</span>}
          {cycleError && <span className="text-red-600">{cycleError}</span>}
          {!started && !busy && (
            <>
              <button
                type="button"
                onClick={() => { ev("workspace_make_yours", {}); inputRef.current?.focus(); }}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
              >
                Make this yours
              </button>
              <span className="text-zinc-400">describe it in a sentence, or touch anything below to claim it · Try:</span>
              {SEEDS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setInput(s.text);
                    ev("workspace_seed", { seed: s.label });
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-zinc-600 transition-colors hover:border-amber-500 hover:text-zinc-900"
                >
                  {s.label}
                </button>
              ))}
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

      {/* ---- The Netify SASE Constellation: the market takes position ---- */}
      <div className="mt-7 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="m-0 text-[10.5px] font-semibold uppercase tracking-[.16em] text-zinc-900">
            The Netify SASE Constellation
          </p>
          <p className="m-0 text-[10px] text-zinc-400">
            distance is fit · every position computed from graded evidence · a supplier only moves on its own evidence
          </p>
        </div>
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
                  style={{ transform: `translate(${b.x}px, ${b.y}px)`, cursor: "pointer", opacity: faded ? 0.16 : dim ? 0.38 : 1, transition: "transform .9s cubic-bezier(.22,1,.36,1), opacity .25s" }}
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
        <p className="m-0 mt-1 text-[9.5px] leading-snug text-zinc-400">
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
        <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-2 rounded-lg border border-zinc-200 bg-white px-5 py-3">
          <span><span className="text-[20px] font-bold tracking-tight text-zinc-900">{meter.confirmed}</span>
            <span className="ml-1.5 text-[11px] text-zinc-500">requirement{meter.confirmed === 1 ? "" : "s"} in your words</span></span>
          {meter.inferred > 0 && (
            <span><span className="text-[20px] font-bold tracking-tight text-amber-700">{meter.inferred}</span>
              <span className="ml-1.5 text-[11px] text-zinc-500">inferred, yours to confirm or strike</span></span>
          )}
          {openQuestionCount > 0 && (
            <span><span className="text-[20px] font-bold tracking-tight text-amber-700">{openQuestionCount}</span>
              <span className="ml-1.5 text-[11px] text-zinc-500">open question{openQuestionCount === 1 ? "" : "s"} in place below</span></span>
          )}
          <span className="ml-auto text-right text-[10.5px] leading-relaxed text-zinc-400">
            {receipts.length > 0 ? `${receipts.length} of your words captured in Notes, unplaced · ` : ""}
            {market ? `${market.counts.vendors} suppliers evaluated against this position` : ""}
          </span>
        </div>
      )}

      {/* ---- The areas: a second view of the same position (slice four).
              Every state derives from the fixtured module, never styling. ---- */}
      {started && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-5 py-2.5">
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
              <p className="m-0 mt-1.5 border-t border-zinc-100 pt-1.5 text-[10.5px] leading-relaxed text-zinc-500" role="status">
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
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_336px]">

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
            <span className="whitespace-nowrap text-[9.5px] uppercase tracking-[.14em] text-zinc-400">Statement of Requirements · living</span>
          </div>
          <p className="m-0 mb-4 mt-1.5 text-[11.5px] text-zinc-500">
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

          {artefactOpen && (
            <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-3">
              <p className="m-0 mb-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-zinc-400">The artefact · a printout of your position as it stands</p>
              <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-zinc-700">{artefactText()}</pre>
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
                <section key={sec.key} id={`sec-${sec.key}`} className="pd-sec mb-5" style={{ scrollMarginTop: "70px" }}>
                  <h3
                    className="mb-1.5 flex items-baseline justify-between border-b border-zinc-200 pb-1 uppercase"
                    style={{ fontSize: "10.5px", lineHeight: 1.3, fontWeight: 600, letterSpacing: ".12em", color: "#71717a" }}
                  >
                    {sec.title}
                    <span className={`text-[9px] font-normal normal-case tracking-normal ${isLive ? "invisible" : "text-zinc-300"}`}>{sec.exampleNote}</span>
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
                        <span className="ml-2 text-[10px] text-zinc-500">
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
                </section>
              );
            })}

            {/* Notes, unplaced: the receipt (13.6) */}
            {receipts.length > 0 && (
              <section className="pd-sec mb-5">
                <h3
                  className="mb-1.5 flex items-baseline justify-between border-b border-zinc-200 pb-1 uppercase"
                  style={{ fontSize: "10.5px", lineHeight: 1.3, fontWeight: 600, letterSpacing: ".12em", color: "#71717a" }}
                >
                  Notes, unplaced
                  <span className="text-[9px] font-normal normal-case tracking-normal text-zinc-400">heard, no home yet</span>
                </h3>
                {receipts.map((r) => (
                  <div key={r.id} className="flex items-baseline gap-2 py-[3px] text-[12.5px] leading-snug text-zinc-600">
                    <span className="text-zinc-400">•</span>
                    <span className="italic">&ldquo;{r.text}&rdquo;</span>
                    <button type="button" onClick={() => dismissReceipt(r.id)} className="ml-auto text-[10px] text-zinc-400 hover:text-zinc-900" title="Remove this note">✕</button>
                  </div>
                ))}
                <p className="m-0 mt-1 text-[9.5px] leading-snug text-zinc-400">Kept verbatim with your position. Nothing you say is silently dropped.</p>
              </section>
            )}
          </div>

          {/* ---- The signature: where the document ends ---- */}
          <div className="mt-2 border-t border-zinc-200 pt-3">
            {!published && !created?.test && (
              <div className={ready ? "rounded-lg border-2 border-amber-300 bg-white p-4" : ""}>
                {ready ? (
                  <>
                    <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[.14em] text-amber-700">The signature</p>
                    <p className="m-0 mb-2 text-[14px] italic leading-relaxed text-zinc-900">This position is ready to meet the market.</p>
                    <p className="m-0 mb-2 text-[10.5px] leading-relaxed text-zinc-500">
                      One publish, two views: an anonymous notice visible to signed-in suppliers
                      {requirement.organisation?.sector ? ` (${requirement.organisation.sector}` : ""}
                      {usersBandLabel(requirement.estate?.users) ? `${requirement.organisation?.sector ? ", " : "("}${usersBandLabel(requirement.estate?.users)}` : ""}
                      {requirement.organisation?.sector || usersBandLabel(requirement.estate?.users) ? ", no name, no contacts)" : ""}
                      , and the full position to matched signed-in suppliers. Assumptions publish labelled as assumptions; example content never publishes at all.
                    </p>
                    {/* Slice three (the reference concept): the notice inherits
                        your standing facts exactly as written, shown before you
                        sign, with what stays private beside it. */}
                    <p className="m-0 mb-1 text-[9.5px] font-semibold uppercase tracking-[.12em] text-zinc-400">The notice inherits</p>
                    <p className="m-0 mb-1.5 text-[10.5px] leading-loose">
                      {[
                        typeof requirement.estate?.sites === "number" ? `${requirement.estate.sites} sites` : null,
                        typeof requirement.estate?.users === "number" ? `${requirement.estate.users} users` : null,
                        buying ? ({ sase: "SASE", sdwan: "SD-WAN", sse: "SSE", managed_security: "managed security" } as Record<string, string>)[buying] ?? buying : null,
                        opModel === "managed" ? "fully managed" : opModel === "co_managed" ? "co-managed" : null,
                        (requirement.organisation?.regions ?? []).length ? `coverage: ${(requirement.organisation?.regions ?? []).map((r) => REGION_LABELS[r] ?? r).join(", ")}` : null,
                        (requirement.constraints?.complianceRequirements ?? []).length ? (requirement.constraints?.complianceRequirements ?? []).map((c) => COMPLIANCE_LABELS[c] ?? c).join(", ") : null,
                      ].filter(Boolean).map((chip) => (
                        <span key={String(chip)} className="mr-1.5 inline-block rounded-full border border-zinc-200 bg-white px-2 py-[1px] text-[10px] text-zinc-700">{chip}</span>
                      ))}
                      <span className="text-[9.5px] text-zinc-400">exactly as written, nothing retyped</span>
                    </p>
                    <p className="m-0 mb-2 text-[9.5px] leading-relaxed text-zinc-400">
                      <span className="font-semibold text-zinc-500">Stays private:</span> your identity and contacts, your notes,
                      {unansweredGaps.length > 0 ? ` ${unansweredGaps.length} unanswered question${unansweredGaps.length === 1 ? "" : "s"} (published only as labelled assumptions if you accept them),` : ""}
                      {" "}and anything you have struck from the record.
                    </p>
                    <label className="mb-1.5 flex items-start gap-2 text-[10.5px] leading-relaxed text-zinc-600">
                      <input type="checkbox" checked={consentCreate} onChange={(e) => setConsentCreate(e.target.checked)} className="mt-0.5" />
                      <span>{securityScope ? CREATE_CONSENT_TEXT : WORKSPACE_AGREEMENT_TEXT}</span>
                    </label>
                    {securityScope && unansweredGaps.length > 0 && (
                      <label className="mb-1.5 flex items-start gap-2 text-[10.5px] leading-relaxed text-zinc-600">
                        <input type="checkbox" checked={consentGaps} onChange={(e) => setConsentGaps(e.target.checked)} className="mt-0.5" />
                        <span>
                          {ACCEPT_GAP_PREFIX}
                          {unansweredGaps.map((g) => g.question).join(" ")} Accepted gaps publish as stated assumptions.
                        </span>
                      </label>
                    )}
                    {securityScope && (
                      <label className="mb-1.5 flex items-start gap-2 text-[10.5px] leading-relaxed text-zinc-600">
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
                      {signStage ?? (testMode ? "Sign · create the test position" : "Sign · publish · let the market compete")}
                    </button>
                    {signError && <p className="m-0 mt-1.5 text-[11px] text-red-600">{signError}</p>}
                    {needAuth && (
                      <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                        <p className="m-0 mb-1 text-[10.5px] text-zinc-600">
                          One step first: publishing reaches named suppliers, so it needs a verified work email. Sign in, then press publish again; your position is untouched.
                        </p>
                        <SignIn role="buyer" prompt="Sign in with your work email to publish." />
                        <CodeEntry onVerified={() => setNeedAuth(false)} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="m-0 text-[11px] leading-relaxed text-zinc-400">
                    <span className="font-semibold text-zinc-500">A person signs here.</span> One signature publishes an anonymous notice to the open board and the full position to matched suppliers.{" "}
                    {lockReason ?? "It unlocks when the position holds enough truth to stand on."}
                  </p>
                )}
              </div>
            )}
            {created?.test && !published && (
              <div className="rounded-lg border border-amber-400 bg-amber-50 p-4">
                <p className="m-0 text-[12px] font-semibold text-amber-900">Test position created; publishing stayed off</p>
                <p className="m-0 mt-1 text-[10.5px] leading-relaxed text-amber-900">
                  It self-expires in two hours, touched no live board and contacted no supplier.{" "}
                  <a href={`/sase/project/${created.id}?manage=${encodeURIComponent(created.manage)}`} className="underline">Inspect it</a> or{" "}
                  <button type="button" onClick={startAfresh} className="underline">start a real one</button>.
                </p>
              </div>
            )}

            {/* The four truth classes, stated once */}
            <p className="m-0 mt-3 text-[10px] leading-relaxed text-zinc-400">
              <span className="text-zinc-300">grey</span> example, never publishes · <span className="italic text-zinc-600">&ldquo;quoted&rdquo;</span> captured, awaiting interpretation ·{" "}
              <span className="border-b border-zinc-900 text-zinc-900">solid ink</span> stated, your words or your touch ·{" "}
              <span className="border-b border-dotted border-zinc-500 text-zinc-600">dotted</span> inferred, reason attached, one tap strikes ·{" "}
              <span className="text-emerald-700">✓ dated</span> verified, evidence stands behind it. Strike anything; a strike is never overridden by re-inference, only by your own words. Nothing on this desk moves without saying what changed.
            </p>
          </div>
        </div>

        {/* ============ THE RESPONDING ORGANS ============ */}
        <div className="space-y-3.5 lg:sticky lg:top-4">

          {/* Your estate */}
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="m-0 mb-1.5 flex items-baseline justify-between text-[9px] font-semibold uppercase tracking-[.14em] text-zinc-400">
              Your estate <span className="font-normal normal-case tracking-normal">{diagram.empty ? "example plan · becomes yours as you speak" : "drawn from your words only"}</span>
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
            <p className="m-0 mt-1 text-[9.5px] leading-snug text-zinc-500">Redraws on every correction; never invents topology.</p>
          </div>

          {/* The market, live */}
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="m-0 mb-1 flex items-baseline justify-between text-[9px] font-semibold uppercase tracking-[.14em] text-zinc-400">
              The market, live <span className="font-normal normal-case tracking-normal">movement is written</span>
            </p>
            <p className="m-0 mb-2 text-[10.5px] text-zinc-500">
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
                    <p key={v.slug} className={`m-0 mb-0.5 text-[9.5px] leading-snug ${mv.dir === "down" ? "text-zinc-400" : "text-zinc-600"}`}>
                      {mv.dir === "up" ? `▲${mv.places > 0 ? ` +${mv.places}` : ""}` : mv.dir === "down" ? `▼${mv.places > 0 ? ` −${mv.places}` : ""}` : "· holds"}{" "}
                      {v.name} — {mv.label}: {gradeWord(mv.grade) || "no longer required"}
                      {mv.grade === "yes" || mv.grade === "partial" ? ` · evaluated ${fmtDate(mv.date)}` : ""}
                    </p>
                  );
                })}
              </div>
            )}
            {marketRows.more > 0 && (
              <p className="m-0 mt-1 text-[9.5px] text-zinc-400">and {marketRows.more} more evaluated suppliers, all in the running.</p>
            )}
            <p className="m-0 mt-1.5 text-[9px] leading-snug text-zinc-400">
              Every movement in the Constellation is written here the moment it happens, with its evidence and date.
              Nothing moves without a truthful answer to &ldquo;what changed?&rdquo;. Touch any supplier in the scene for its record.
            </p>
            {vendorCard && (
              <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
                <button type="button" onClick={() => setVendorCard(null)} className="float-right text-zinc-400 hover:text-zinc-900">✕</button>
                <p className="m-0 text-[12px] font-semibold text-zinc-900">
                  {vendorCard.name}
                  {namedSlugs.has(vendorCard.slug) && <span className="ml-1.5 rounded-full bg-zinc-200 px-1.5 text-[8.5px] font-normal text-zinc-600">named in your position</span>}
                </p>
                <p className="m-0 mt-0.5 text-[10px] text-zinc-500">{vendorCard.category}</p>
                <p className="m-0 mt-1 text-[10px] leading-relaxed text-zinc-600">
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
                    <p className="m-0 mt-1 text-[10px] leading-relaxed text-zinc-600">
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
                        <div className="mt-1.5 border-t border-zinc-200 pt-1.5 text-[10px] leading-relaxed text-zinc-600">
                          <p className="m-0"><b className="text-zinc-800">What changed:</b> your requirement {mv.grade ? "gained" : "withdrew"} {mv.label}.</p>
                          <p className="m-0"><b className="text-zinc-800">Why it moved:</b> {mv.label} is {gradeWord(mv.grade) || "no longer checked"} for {vendorCard.name}.</p>
                          <p className="m-0"><b className="text-zinc-800">Evidence:</b> evaluated {fmtDate(vendorCard.last_verified)}.</p>
                        </div>
                      )}
                      {fs && (fs.matched.length > 0 || fs.missed.length > 0) && (
                        <div className="mt-1.5 text-[9.5px] leading-relaxed text-zinc-500">
                          {fs.matched.length > 0 && <p className="m-0">Evidences: {fs.matched.map((m) => m.label).join(", ")}.</p>}
                          {fs.missed.length > 0 && <p className="m-0 text-zinc-400">Not evidenced: {fs.missed.map((m) => m.label).join(", ")}.</p>}
                        </div>
                      )}
                      {hist.length > 0 && (
                        <div className="mt-1.5 text-[9px] leading-relaxed text-zinc-400">
                          {hist.map((h, i) => (
                            <p key={i} className="m-0">{h.at} · {h.dir === "up" ? "rose" : h.dir === "down" ? "fell" : "held"} · {h.text}</p>
                          ))}
                        </div>
                      )}
                      <a href={`/sase/${vendorCard.slug}/`} className="mt-1 inline-block text-[10px] text-zinc-700 underline">
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
                      className="mt-1.5 rounded-full border border-zinc-300 px-2.5 py-1 text-[10px] text-zinc-600 hover:border-zinc-500"
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
                      className="mt-1.5 rounded-full border border-amber-400 px-2.5 py-1 text-[10px] text-amber-700 hover:border-amber-600"
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
              <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[.14em] text-emerald-700">We noticed · against Netify&rsquo;s own interest</p>
              <p className="m-0 text-[12px] leading-relaxed text-emerald-900">{verdict.againstInterest[0].statement}</p>
              {verdict.againstInterest.length > 1 && (
                <p className="m-0 mt-1 text-[10px] text-emerald-700/80">{verdict.againstInterest.length - 1} more ruling{verdict.againstInterest.length === 2 ? "" : "s"} on your record.</p>
              )}
            </div>
          )}

          {/* Save-lite */}
          {saveLite === "shown" && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <p className="m-0 mb-1.5 text-[12px] font-medium text-zinc-800">Want to keep this position?</p>
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
            <p className="m-0 text-[10.5px] text-emerald-700">
              Sign-in link sent to {saveLiteSentTo}. The position stays right here; the link signs you in on any device.
            </p>
          )}

          {/* The crew */}
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[.14em] text-zinc-400">The crew · completed work only</p>
            <div className="space-y-0.5 font-mono text-[10px] leading-relaxed text-zinc-500" style={{ fontFamily: "'SF Mono',ui-monospace,Menlo,monospace" }}>
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

      {/* ---- The destination: where the finished position goes (below the desk so the document stays the hero, Robert 23 Jul)
              (the reference concept made live, Robert's word, 23 Jul; every
              claim renders from real data and no em dashes anywhere). ---- */}
      <div className="mt-8">
        <h2 className="m-0" style={{ fontSize: "20px", lineHeight: 1.2, fontWeight: 700, color: "#18181b", letterSpacing: "-0.015em" }}>
          Publish to our SASE Opportunities Board
        </h2>
        <p className="m-0 mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
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
      {state === "example" && <span className="ml-2 text-[9px] text-zinc-300">example</span>}
      {state === "exampleStruck" && <span className="ml-2 text-[9px] text-zinc-300">example · {item.exampleStruck}</span>}
      {state === "noted" && <span className="ml-2 text-[9.5px] text-zinc-500">noted with your position</span>}
      {state === "stated" && fact && (
        <span className="ml-2 text-[10px] text-zinc-500"><em>&ldquo;{fact.quote ?? item.label}&rdquo;</em></span>
      )}
      {state === "inferred" && fact && (
        <span className="ml-2 text-[10px] text-zinc-500">{fact.reason ?? "inferred"}</span>
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
                {!isLive && r.was && <span className="ml-2 text-[9px] text-zinc-300">example · {r.was}</span>}
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
                  <span className="text-[10px] text-zinc-500">
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
      <div className="flex items-baseline gap-2 text-[12.5px] leading-snug text-amber-700">
        <span className="inline-block w-3 flex-none text-center text-[11px] font-bold">?</span>
        <span className="italic">{q.question}</span>
        <button type="button" onClick={props.onDismiss} className="ml-auto text-[10px] text-zinc-400 hover:text-zinc-900" title="Not relevant to this project">✕</button>
      </div>
      <div className="ml-5 mt-1 flex flex-wrap items-center gap-1.5">
        {q.options.filter((o) => o.answer.kind !== "path").map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => props.onAnswer(q, o.answer)}
            className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-[10.5px] text-zinc-600 hover:border-amber-500 hover:text-zinc-900"
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
              className="w-36 border-b border-dashed border-zinc-400 bg-transparent px-1 py-0.5 text-[12px] text-zinc-900 outline-none focus:border-amber-500"
              aria-label={q.question}
            />
            <button
              type="button"
              onClick={() => val.trim() && props.onAnswer(q, textOpt.answer, val)}
              className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 hover:border-amber-500"
            >
              Set
            </button>
          </>
        )}
        <span className="text-[9px] text-zinc-400">asked by real buyers · hover for the evidence</span>
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
      <div className="flex items-baseline gap-2 text-[12.5px] leading-snug text-amber-700">
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
              className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-[10.5px] text-zinc-600 hover:border-amber-500 hover:text-zinc-900"
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
            className="w-28 border-b border-dashed border-zinc-400 bg-transparent px-1 py-0.5 text-[12px] text-zinc-900 outline-none focus:border-amber-500"
            aria-label={gap.question}
          />
          <button
            type="button"
            onClick={() => val.trim() && props.onAnswer(gap, val.trim())}
            className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 hover:border-amber-500"
          >
            Set
          </button>
        </div>
      ) : (
        <p className="m-0 ml-5 mt-0.5 text-[10px] text-zinc-500">Accepted at the signature; publishes as a stated assumption.</p>
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
  const cls = "w-full rounded-sm border border-zinc-300 bg-white px-2 py-1.5 text-[11.5px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-500";
  return (
    <div className="space-y-1.5">
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@yourcompany.com" className={cls} aria-label="Work email" />
      <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={cls} aria-label="Company" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void send()} disabled={busy || !email.includes("@")} className="rounded-full bg-amber-500 px-3 py-1 text-[10.5px] font-semibold text-zinc-950 disabled:opacity-50">
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
        <button type="button" onClick={onDismiss} className="text-[10px] text-zinc-500 underline hover:text-zinc-900">Not now</button>
      </div>
      <p className="m-0 text-[9.5px] leading-snug text-zinc-400">The position stays right here either way. Work email only; we only email you about your own projects.</p>
      {error && <p className="m-0 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
