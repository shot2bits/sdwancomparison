"use client";

/**
 * The Live Sourcing Workspace surface (W0 slice 2, spec v1.3 sections 3 and
 * 10, built to the definitive combined mockup of 21 July 2026).
 *
 * The three concepts combined, as decided: the INVERSION is the spine (one
 * sentence in, a finished draft out, the buyer corrects rather than
 * creates), the LIVING BRIEF is the skin (the draft is a prose statement of
 * requirements with provenance underlines: solid = the buyer's words,
 * dotted = Netify inference, tap either to strike it out), and the TABLE is
 * the figure (the deterministic network diagram drawn with the brief).
 * No panels, no tabs, no wizard steps, no visible section skeleton.
 *
 * Truth rules: nothing on this page simulates liveness, and every claim
 * carries provenance. The extraction cycle, the rulebook, the diagram and
 * the fit list are all real computations over the fact ledger; when the
 * model is unavailable the deterministic parsers carry on and say so.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assessSecurityRequirement, type SecurityScopeVerdict } from "@/lib/security/rulebook";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { ACCEPT_GAP_PREFIX } from "@/components/GapActions";
import type { AllowedPath, BuyingId, FieldUpdate } from "@/lib/workspace/extract";
import {
  briefModel,
  buyingOf,
  builderCompliance,
  mergeUpdates,
  meterOf,
  operatingModelOf,
  productScopeFor,
  requirementFrom,
  standing,
  usersBandLabel,
  wizardRegions,
  wizardSectorKey,
  BUYING_SHORT,
  capLabel,
  type BriefGap,
  type Seg,
  type WorkspaceFact,
} from "@/lib/workspace/draft";
import { diagramModel } from "@/lib/workspace/diagram";
import WorkspaceDiagram from "@/components/WorkspaceDiagram";
import SignIn from "@/components/SignIn";
import CodeEntry from "@/components/CodeEntry";
import { fireNetifyEvent, firstTouch } from "@/components/NetifyEvents";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

// Intent seeds: the actual top grounding queries from Bing AI Performance,
// 21 July 2026 (spec section 3 point 1), phrased as sentence starters the
// buyer completes in their own words. Nothing is extracted until they type
// or pause: adopting a seed makes the words theirs.
const SEEDS: Array<{ label: string; text: string }> = [
  { label: "Managed SIEM, UK", text: "We need a managed SIEM service in the UK. " },
  { label: "Managed SOC and MDR", text: "We are an SME looking for a managed SOC and MDR. " },
  { label: "MSSP for mid-market", text: "We are a mid-market business looking for an MSSP. " },
  { label: "SD-WAN with zero trust", text: "We need SD-WAN with zero trust integration. " },
];

const DRAFT_KEY = "netify_workspace_draft_v1";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const WORKSPACE_AGREEMENT_TEXT =
  "Publish this requirement: Netify lists an anonymous notice on the open board and invites the best-fit evaluated vendors and service providers, who respond through the app. My identity and contact details stay private until I choose to reply, and pricing stays private to me.";

type FitSupplier = {
  slug: string;
  name: string;
  category: string;
  last_verified: string;
  evidence_coverage_pct: number;
  yes_count: number;
  coverage: Record<string, string>;
};

type FitState = {
  mode: "graded" | "compiled";
  count?: number;
  total?: number;
  note?: string;
  suppliers: FitSupplier[];
  directory: Array<{ slug: string; name: string }>;
};

const ev = (name: string, data: Record<string, string | number> = {}) => {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) flat[k] = String(v);
  fireNetifyEvent(name, flat);
};

const REGION_KEY_LABELS: Record<string, string> = {
  uk_ireland: "UK & Ireland",
  europe: "Europe",
  north_america: "North America",
  asia_pacific: "Asia Pacific",
  middle_east_africa: "Middle East & Africa",
};

const fmtDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
};

/* ------------------------------------------------------------------ */
/* Inline pieces (top level, so their state and focus survive parent   */
/* re-renders: the draft recomputes on every cycle)                    */
/* ------------------------------------------------------------------ */

/** A provenance-underlined fact span. Keyed by id + cycle where rendered,
 *  so a changed fact remounts and the ripple animation replays exactly
 *  when a real recomputation touched it. */
function FactSpan({ fact, text, onToggle }: { fact: WorkspaceFact; text: string; onToggle: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(fact.id)}
      title={
        fact.struck
          ? "Struck out. Tap to restore."
          : fact.provenance === "stated"
            ? `Your words: "${fact.quote ?? text}". Tap to strike out.`
            : `Netify inference: ${fact.reason ?? "derived from your description"}. Tap to strike out.`
      }
      className={
        "ws-ripple inline rounded-[2px] px-0 text-left align-baseline transition-colors hover:bg-amber-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 " +
        (fact.struck
          ? "text-[var(--ink-300,#a1a1aa)] line-through decoration-[1.5px] "
          : fact.provenance === "stated"
            ? "border-b-2 border-[var(--ink-700,#3f3f46)] "
            : "border-b-2 border-dotted border-[var(--ink-500,#71717a)] ")
      }
    >
      {text}
    </button>
  );
}

/** Save-lite (spec section 4): appears once the draft first becomes
 *  useful. Email and company, one line, the existing magic-link machinery;
 *  the draft stays exactly where it is. Company never enters a project
 *  object in W0 (published notices are anonymous); it rides only on the
 *  lead capture. */
function SaveLite({ facts, onDone, onDismiss }: { facts: number; onDone: (email: string) => void; onDismiss: () => void }) {
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
      // Capture rides behind the successful link, best effort.
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
  return (
    <div className="mt-4 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-raised,#f4f4f5)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--ink-700)]">Want to keep this draft?</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="you@yourcompany.com"
          className="w-52 rounded-sm border border-[var(--ink-300,#ccc)] bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
          aria-label="Work email"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          className="w-40 rounded-sm border border-[var(--ink-300,#ccc)] bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
          aria-label="Company"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !email.includes("@")}
          className="rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
        <button type="button" onClick={onDismiss} className="text-xs text-[var(--ink-500)] underline hover:text-[var(--ink-900)]">
          Not now
        </button>
      </div>
      <p className="m-0 mt-1.5 text-xs text-[var(--ink-500)]">
        The draft stays right here either way; the link signs you in on any device so publishing later is one click.
        Work email only, and we only email you about your own projects.
      </p>
      {error && <p className="m-0 mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** An open blank: the one thing only the buyer can answer, answerable in
 *  place. Chips for vocabularies, a small input for numbers and text. */
function GapControl({ gap, onAnswer }: { gap: BriefGap; onAnswer: (gap: BriefGap, value: string, label?: string) => void }) {
  const [val, setVal] = useState("");
  if (!gap.path) return <span className="text-sm italic text-[var(--ink-500)]">{gap.question}</span>;
  if (gap.control === "chips" && gap.options) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-1.5 align-baseline">
        <span className="text-sm italic text-[var(--ink-500)]">{gap.question}</span>
        {gap.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onAnswer(gap, o.value, o.label)}
            className="rounded-full border border-[var(--ink-300,#ccc)] px-2.5 py-0.5 text-xs text-[var(--ink-700)] transition-colors hover:border-amber-500 hover:bg-amber-50"
          >
            {o.label}
          </button>
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1.5 align-baseline">
      <span className="text-sm italic text-[var(--ink-500)]">{gap.question}</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim()) onAnswer(gap, val.trim());
        }}
        inputMode={gap.control === "number" ? "numeric" : undefined}
        placeholder={gap.control === "number" ? "0" : "type it"}
        className="w-24 border-b border-dashed border-[var(--ink-500,#71717a)] bg-transparent px-1 text-sm focus:border-amber-500 focus:outline-none"
        aria-label={gap.question}
      />
      <button
        type="button"
        onClick={() => val.trim() && onAnswer(gap, val.trim())}
        className="rounded-full border border-[var(--ink-300,#ccc)] px-2 py-0.5 text-xs hover:border-amber-500"
      >
        Set
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

export default function LiveWorkspace() {
  const [facts, setFacts] = useState<WorkspaceFact[]>([]);
  const [input, setInput] = useState("");
  const [cycle, setCycle] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [engineUsed, setEngineUsed] = useState<string | null>(null);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SecurityScopeVerdict | null>(null);
  const [fit, setFit] = useState<FitState | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [saveLite, setSaveLite] = useState<"hidden" | "shown" | "sent" | "dismissed">("hidden");
  const [saveLiteSentTo, setSaveLiteSentTo] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  // Signature state
  const [consentCreate, setConsentCreate] = useState(false);
  const [consentGaps, setConsentGaps] = useState(false);
  const [consentPublish, setConsentPublish] = useState(false);
  const [signStage, setSignStage] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [created, setCreated] = useState<{ id: string; manage: string; test: boolean } | null>(null);
  const [published, setPublished] = useState<{ invited: number; boardId?: string } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const firstKeyAt = useRef<number | null>(null);
  const firstVerdictSent = useRef(false);
  const lastRunText = useRef("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptedGaps = useRef<Set<string>>(new Set());
  const cycleRef = useRef(0);

  // One writer for the ledger: reads the ref (always current, even while a
  // cycle is in flight), merges, writes ref and state together. Events fire
  // from the caller with the merge result, never inside a state updater.
  const factsRef = useRef<WorkspaceFact[]>([]);
  const applyMerge = useCallback((updates: FieldUpdate[], source: "extract" | "answer" | "link") => {
    cycleRef.current += 1;
    const m = mergeUpdates(factsRef.current, updates, cycleRef.current, source);
    factsRef.current = m.facts;
    setFacts(m.facts);
    setCycle(cycleRef.current);
    return m;
  }, []);

  const requirement = useMemo(() => requirementFrom(facts), [facts]);
  const buying = buyingOf(facts);
  const opModel = operatingModelOf(facts);
  const securityScope = buying === "managed_security" || buying === null;
  const live = standing(facts);
  const started = facts.length > 0;

  /* ---- Arrival: query params and the restored draft ---- */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("test") === "1") setTestMode(true);
    const scope = p.get("scope");
    const seedFacts: FieldUpdate[] = [];
    if (scope && ["security", "managed_security", "sase", "sdwan", "sse"].includes(scope)) {
      seedFacts.push({
        path: "procurement.buying",
        value: scope === "security" ? "managed_security" : scope,
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
          const saved = JSON.parse(raw) as { facts?: WorkspaceFact[]; added?: string[]; removed?: string[]; ts?: number };
          if (saved.ts && Date.now() - saved.ts < DRAFT_MAX_AGE_MS && Array.isArray(saved.facts) && saved.facts.length) {
            base = saved.facts;
            setAdded(saved.added ?? []);
            setRemoved(saved.removed ?? []);
            setRestored(true);
          }
        }
      } catch { /* a broken draft never blocks the page */ }
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

  /* ---- Persist the draft locally; save-lite adds the account claim ---- */
  useEffect(() => {
    if (!started || published) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ facts, added, removed, ts: Date.now() }));
    } catch { /* best effort */ }
  }, [facts, added, removed, started, published]);

  /* ---- Session check: the signed-in never see save-lite ---- */
  useEffect(() => {
    fetch("/sase/api/auth/session")
      .then((r) => r.json())
      .then((s: { authenticated?: boolean }) => setSignedIn(Boolean(s.authenticated)))
      .catch(() => {});
  }, []);

  /* ---- Save-lite trigger: the draft's first useful moment ---- */
  useEffect(() => {
    if (saveLite !== "hidden" || signedIn || published || created) return;
    const useful = Boolean(verdict) || standing(facts).length >= 3;
    if (started && useful) {
      setSaveLite("shown");
      ev("workspace_save_lite_shown", { facts: standing(facts).length });
    }
  }, [saveLite, signedIn, published, created, verdict, facts, started]);

  /* ---- The extraction cycle ---- */
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
        const m = applyMerge(data.updates ?? [], "extract");
        ev("workspace_cycle", {
          cycle: cycleRef.current,
          fields: standing(m.facts).length,
          engine: data.engine,
          scope: buyingOf(m.facts) ?? "undetected",
          from: opts.fromLink ? "link" : "typed",
        });
        setEngineUsed(data.engine);
        setNotes(data.notes ?? []);
        if (opts.fromEnter) setInput("");
      } catch {
        setCycleError("The extraction service could not be reached. Your words are kept; press Enter to try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, applyMerge],
  );

  /* ---- Debounce: a cycle per pause, not per keystroke ---- */
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const text = input.trim();
    if (text.length < 12 || text === lastRunText.current) return;
    debounceTimer.current = setTimeout(() => void runCycle(input), 900);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [input, runCycle]);

  /* ---- Assess: the rulebook recomputes on every correction ---- */
  useEffect(() => {
    if (!securityScope || live.length === 0) {
      setVerdict(null);
      return;
    }
    let cancelled = false;
    assessSecurityRequirement(requirement).then((v) => {
      if (!cancelled) {
        setVerdict(v);
        if (!firstVerdictSent.current && firstKeyAt.current) {
          firstVerdictSent.current = true;
          ev("workspace_first_verdict", { ms: Date.now() - firstKeyAt.current, confidence: v.confidence });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [requirement, securityScope, live.length]);

  /* ---- Fit: evidence-graded suppliers for the current scope ---- */
  const sseSignal = Boolean(
    verdict?.capabilities.some((c) => c.id === "sse" && (c.needed === "required" || c.needed === "recommended")) ||
      verdict?.pathRecommendation === "escalate_sase",
  );
  const fitBuying: string | null = !started ? null : buying && buying !== "managed_security" ? buying : sseSignal ? "sse" : "managed_security";
  const fitParams = useMemo(() => {
    if (!fitBuying) return null;
    const regions = (requirement.organisation?.regions ?? []).join(".");
    return `buying=${fitBuying}&regions=${regions}&model=${opModel ?? "any"}&include=${added.join(",")}`;
  }, [fitBuying, requirement, opModel, added]);
  useEffect(() => {
    if (!fitParams) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/sase/api/workspace/fit?${fitParams}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.ok) setFit(d as FitState);
        })
        .catch(() => {});
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [fitParams]);

  /* ---- Corrections ---- */
  const toggleFact = useCallback(
    (id: string) => {
      const f = factsRef.current.find((x) => x.id === id);
      factsRef.current = factsRef.current.map((x) => (x.id === id ? { ...x, struck: !x.struck } : x));
      setFacts(factsRef.current);
      if (f) ev("workspace_fact_struck", { path: f.path, provenance: f.provenance, undo: f.struck ? "1" : "0" });
    },
    [],
  );

  const answerGap = useCallback(
    (gap: BriefGap, value: string, label?: string) => {
      if (!gap.path) return;
      const v = gap.control === "number" ? Number(value) : value;
      if (gap.control === "number" && (!Number.isFinite(v as number) || (v as number) < 0)) return;
      applyMerge([{ path: gap.path, value: v, provenance: "stated", quote: label ?? String(value) }], "answer");
      ev("workspace_gap_answered", { field: gap.key });
    },
    [applyMerge],
  );

  /* ---- Derived rendering models ---- */
  const brief = useMemo(() => briefModel({ facts, verdict }), [facts, verdict]);
  const diagram = useMemo(() => diagramModel(requirement, verdict, buying), [requirement, verdict, buying]);
  const meter = meterOf(facts, verdict);

  const shownSuppliers = (fit?.suppliers ?? []).filter((s) => !removed.includes(s.slug));
  const pins = [...new Set([...added, ...shownSuppliers.map((s) => s.slug)])].slice(0, 5);

  const unansweredGaps = brief.openGaps;
  const signLocked =
    !started ||
    Boolean(published) ||
    (securityScope && (!verdict || verdict.confidence === "low")) ||
    (!securityScope && !buying);
  const lockReason = !started
    ? null
    : securityScope && verdict?.confidence === "low"
      ? "Answer the open questions above first: a project is not recorded on guesswork."
      : null;

  const consentsOk = securityScope
    ? consentCreate && consentPublish && (unansweredGaps.length === 0 || consentGaps)
    : consentCreate;

  /* ---- Sign to publish ---- */
  async function signAndPublish() {
    if (signLocked || !consentsOk || signStage) return;
    setSignError(null);
    if (testMode && !securityScope) {
      // The engine's test mode self-expires and never notifies; the wizard
      // path has no equivalent, so a network test would leave a durable
      // draft. Refused rather than half-simulated.
      setSignError("Test mode covers the security engine today. Drop ?test=1 to publish a network requirement for real.");
      return;
    }
    ev("workspace_sign_click", { scope: buying ?? "security", facts: meter.total, inferred: meter.inferred, gaps_accepted: unansweredGaps.length });
    try {
      let proj = created;
      if (!proj) {
        setSignStage("Creating your project…");
        if (securityScope) {
          const res = await fetch("/sase/api/security-sourcing/project", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              requirement,
              consent: true,
              preferred_vendors: pins,
              ...(testMode ? { test: true } : {}),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.project?.id) throw new Error(data.error || "Could not create the project; try again.");
          proj = { id: data.project.id, manage: data.project.manage_token || "", test: testMode || Boolean(data.project.test) };
        } else {
          const title = brief.title;
          const sectorKey = wizardSectorKey(requirement.organisation?.sector);
          const notesLine = [
            typeof requirement.estate?.users === "number" ? `Staff: ${requirement.estate.users}.` : "",
            requirement.estate?.existingSecurity?.length ? `Existing security tooling: ${requirement.estate.existingSecurity.join(", ")}.` : "",
            requirement.estate?.existingNetwork?.length ? `Network estate: ${requirement.estate.existingNetwork.join(", ")}.` : "",
            "Drafted in the Live Sourcing Workspace.",
          ].filter(Boolean).join(" ");
          const res = await fetch("/sase/api/rfp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title,
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
        ev(proj.test ? "workspace_created_test" : "workspace_created", { scope: buying ?? "security", id: proj.id });
      }

      if (proj.test) {
        setSignStage(null);
        return; // test projects stop before the live board, always
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

      setSignStage("Publishing to the marketplace…");
      const res = await fetch(`/sase/api/rfp/${proj.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manage_token: proj.manage, list_on_board: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPublished({ invited: Array.isArray(data.invited) ? data.invited.length : 0, boardId: data.board?.opportunity_id });
        setNeedAuth(false);
        ev("workspace_published", { scope: buying ?? "security", invited: Array.isArray(data.invited) ? data.invited.length : 0 });
        try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* done with it */ }
      } else if (data.auth_required) {
        setNeedAuth(true);
        ev("workspace_auth_required", { scope: buying ?? "security" });
      } else {
        throw new Error(data.error || "Could not publish; try again.");
      }
    } catch (e) {
      setSignError(e instanceof Error ? e.message : "Something failed; nothing has been sent to vendors. Try again.");
    } finally {
      setSignStage(null);
    }
  }

  const startAfresh = () => {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* fine */ }
    window.location.assign(window.location.pathname);
  };

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  const renderSeg = (s: Seg, i: number) => {
    if (s.kind === "text") return <span key={i}>{s.text}</span>;
    if (s.kind === "fact")
      // Keyed by id AND cycle: a fact changed by a real recomputation
      // remounts, replaying the ripple animation at exactly that moment.
      return <FactSpan key={`${s.fact.id}@${s.fact.cycle}${s.fact.struck ? "s" : ""}`} fact={s.fact} text={s.text} onToggle={toggleFact} />;
    return <GapControl key={s.gap.key + i} gap={s.gap} onAnswer={answerGap} />;
  };

  const band = usersBandLabel(requirement.estate?.users);
  const previewChips = securityScope
    ? (verdict?.summary.recommended ?? []).map(capLabel)
    : buying
      ? [BUYING_SHORT[buying]]
      : [];

  return (
    <div className="ws-root">
      <style>{`
        @keyframes wsflash { 0% { background-color: #fef3c7; } 100% { background-color: transparent; } }
        .ws-ripple { animation: wsflash 1.4s ease-out 1; }
      `}</style>

      {/* ---- The one persistent input ---- */}
      <div className={started ? "mt-6" : "mt-10"}>
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={(e) => {
            if (!firstKeyAt.current) firstKeyAt.current = Date.now();
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void runCycle(input, { fromEnter: true });
            }
          }}
          placeholder={
            started
              ? "Add or correct anything: 'actually 45 sites', 'we already run Defender', 'no budget agreed yet'…"
              : "Start describing your requirement…"
          }
          disabled={Boolean(published)}
          className="w-full resize-none overflow-hidden border-0 border-b-2 border-[var(--ink-200,#e5e5e5)] bg-transparent px-0 py-2 text-lg leading-relaxed text-[var(--ink-900,#111)] placeholder:text-[var(--ink-300,#a1a1aa)] focus:border-amber-500 focus:outline-none sm:text-xl"
          aria-label="Describe your requirement"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--ink-500)]">
          {busy && <span aria-live="polite">Reading…</span>}
          {!busy && started && engineUsed === "deterministic_fallback" && (
            <span>Read without the model this turn (deterministic parsing); everything still works.</span>
          )}
          {cycleError && <span className="text-red-700">{cycleError}</span>}
          {notes.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
          {started && !published && <span>Press Enter to commit a thought; the draft also updates when you pause.</span>}
        </div>
      </div>

      {/* ---- Empty state: seeds and the ten-second explanation ---- */}
      {!started && (
        <div className="mt-6">
          <div className="flex flex-wrap gap-2">
            {SEEDS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setInput(s.text);
                  ev("workspace_seed", { seed: s.label });
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-[var(--ink-300,#ccc)] px-3.5 py-1.5 text-sm text-[var(--ink-700)] transition-colors hover:border-amber-500 hover:bg-amber-50"
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--ink-500)]">
            Type one sentence and a draft statement of requirements assembles itself: solid underlines are your words,
            dotted underlines are Netify&rsquo;s inferences, and tapping either strikes it out. Your network draws
            itself beside the brief, evaluated vendors appear with their evidence dates, and when the draft says what
            you mean, one signature publishes it: an anonymous notice on the open board, the full brief to matched
            signed-in vendors and service providers. Free to draft, no sign-in until you publish.
          </p>
        </div>
      )}

      {restored && !published && (
        <p className="mt-3 text-xs text-[var(--ink-500)]">
          Draft restored from this browser.{" "}
          <button type="button" onClick={startAfresh} className="underline hover:text-[var(--ink-900)]">
            Start afresh
          </button>
        </p>
      )}

      {/* ---- Save-lite: email, company, continue ---- */}
      {saveLite === "shown" && (
        <SaveLite
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
      )}
      {saveLite === "sent" && (
        <p className="mt-3 text-xs text-emerald-700">
          Sign-in link sent to {saveLiteSentTo}. The draft stays right here; opening the link signs you in on any
          device.
        </p>
      )}

      {testMode && (
        <p className="mt-3 max-w-2xl rounded-sm border border-amber-400 bg-amber-50 p-2.5 text-xs text-amber-900">
          Test mode: signing creates a self-expiring test project and never publishes to the live board or contacts any
          vendor.
        </p>
      )}

      {/* ---- The living brief ---- */}
      {started && (
        <article className="mt-10">
          <p className="eyebrow mb-1">Statement of requirements · draft</p>
          <h2 className="mb-6 text-2xl leading-snug">{brief.title}</h2>

          {brief.blocks.map((b) => (
            <section key={b.key} className="mb-7 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:gap-8">
              <div>
                {b.heading && (
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">{b.heading}</h3>
                )}
                {b.paras.map((p, i) => (
                  <p key={i} className="mb-2.5 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-900,#18181b)]">
                    {p.map(renderSeg)}
                  </p>
                ))}
              </div>
              {b.margin && b.margin.length > 0 && (
                <aside className="mt-2 border-l-2 border-[var(--ink-100,#f4f4f5)] pl-3 lg:mt-6 lg:border-l lg:pl-4">
                  {b.margin.map((m, i) => (
                    <p
                      key={i}
                      className={
                        "mb-2.5 text-xs leading-relaxed " +
                        (m.tone === "against_interest" ? "text-emerald-800" : "text-[var(--ink-500)]")
                      }
                    >
                      <span className={"font-semibold " + (m.tone === "against_interest" ? "" : "text-[var(--ink-700)]")}>
                        {m.title}.
                      </span>{" "}
                      {m.body}
                    </p>
                  ))}
                </aside>
              )}
            </section>
          ))}

          {/* ---- The figure: deterministic network diagram ---- */}
          {!diagram.empty && (
            <figure className="mb-8 max-w-xl border-y border-[var(--ink-200,#e5e5e5)] py-4">
              <WorkspaceDiagram model={diagram} />
              <figcaption className="mt-1 text-xs text-[var(--ink-500)]">
                Figure: drawn only from the estate as stated or inferred above; it redraws on every correction and never
                invents topology.
              </figcaption>
            </figure>
          )}

          {/* ---- Working assumptions ---- */}
          {brief.assumptions.length > 0 && (
            <section className="mb-8 max-w-2xl">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                Working assumptions
              </h3>
              {brief.assumptions.map((a, i) => (
                <p key={i} className="mb-1.5 text-sm italic leading-relaxed text-[var(--ink-500)]">
                  {a} <span className="not-italic text-[11px] text-amber-700">assumed</span>
                </p>
              ))}
            </section>
          )}

          {/* ---- Likely best fit ---- */}
          {fit && started && (
            <section className="mb-8 max-w-2xl">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                Likely best fit{fitBuying && fitBuying !== "managed_security" ? `: ${BUYING_SHORT[fitBuying as BuyingId] ?? fitBuying}` : ""}
              </h3>
              {fit.mode === "compiled" ? (
                <p className="mb-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-700)]">{fit.note}</p>
              ) : (
                <p className="mb-3 text-sm text-[var(--ink-500)]">
                  {fit.count} of {fit.total} evaluated vendors fit this scope
                  {(requirement.organisation?.regions ?? []).length ? " in your regions" : ""}; the strongest coverage
                  leads. Grades and dates come from the Netify evaluation dataset, never from marketing.
                </p>
              )}
              <ul className="m-0 list-none divide-y divide-[var(--ink-100,#f4f4f5)] p-0">
                {shownSuppliers.map((s) => (
                  <li key={s.slug} className="flex items-baseline justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[var(--ink-900,#111)]">{s.name}</span>
                      <span className="ml-2 text-xs text-[var(--ink-500)]">{s.category}</span>
                      <p className="m-0 mt-0.5 text-xs text-[var(--ink-500)]">
                        Evaluated {fmtDate(s.last_verified)}
                        {s.yes_count > 0 && ` · ${s.yes_count} of 40 capabilities fully met`}
                        {Object.entries(s.coverage)
                          .filter(([, g]) => g && g !== "unknown")
                          .map(([r, g]) => ` · ${REGION_KEY_LABELS[r] ?? r}: ${g.replace(/_/g, " ")}`)
                          .join("")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemoved((x) => [...x, s.slug])}
                      className="shrink-0 text-xs text-[var(--ink-500)] underline hover:text-[var(--ink-900)]"
                      title="Remove from your working list"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {removed.length > 0 && (
                <p className="mt-1.5 text-xs text-[var(--ink-500)]">
                  Removed: {removed.join(", ")}.{" "}
                  <button type="button" onClick={() => setRemoved([])} className="underline hover:text-[var(--ink-900)]">
                    Restore
                  </button>
                </p>
              )}
              {fit.directory.length > 0 && (
                <AddSupplier
                  directory={fit.directory.filter((d) => !shownSuppliers.some((s) => s.slug === d.slug))}
                  onAdd={(slug) => {
                    setAdded((x) => (x.includes(slug) ? x : [...x, slug]));
                    setRemoved((x) => x.filter((r) => r !== slug));
                    ev("workspace_supplier_added", { slug });
                  }}
                />
              )}
              <p className="mt-2 text-xs text-[var(--ink-500)]">
                Vendors you add are pinned into the invitation list at publish (up to five, always invited). The
                published shortlist itself is graded automatically, and you control final invitations from your project.
              </p>
            </section>
          )}

          {/* ---- Signature ---- */}
          <section className="mt-10 max-w-2xl border-t-2 border-[var(--ink-900,#111)] pt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
              Sign to publish
            </h3>

            {/* The confirmation meter */}
            <div className="mb-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ink-100,#f4f4f5)]">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${meter.percent}%` }} />
              </div>
              <p className="m-0 mt-1.5 text-xs text-[var(--ink-500)]">
                {meter.confirmed} of {meter.total} facts in your own words ({meter.percent}%)
                {meter.inferred > 0 && ` · ${meter.inferred} inference${meter.inferred === 1 ? "" : "s"} standing, published labelled as assumptions`}
                {meter.engineAssumptions > 0 && ` · ${meter.engineAssumptions} engine assumption${meter.engineAssumptions === 1 ? "" : "s"}`}
                {meter.struck > 0 && ` · ${meter.struck} struck out`}
              </p>
            </div>

            {published ? (
              <div className="rounded-sm border-2 border-emerald-300 bg-emerald-50 p-4">
                <p className="m-0 text-sm font-semibold text-emerald-900">This requirement is live on the Netify board</p>
                <p className="m-0 mt-1 text-sm text-emerald-900">
                  {published.invited} vendor{published.invited === 1 ? "" : "s"} invited. Your identity and contact
                  details stay private until you reply. Responses, clarifications and comparison now continue in your
                  project workspace; corrections after publish arrive there with the next phase of this page.
                </p>
                <p className="m-0 mt-2 text-sm">
                  {published.boardId && (
                    <>
                      <a href={`/sase/opportunities/${published.boardId}`} className="font-medium underline">
                        View your live board listing
                      </a>
                      <span className="mx-2 text-emerald-700/40">·</span>
                    </>
                  )}
                  <a href={`/sase/project/${created?.id}${created?.manage ? `?manage=${encodeURIComponent(created.manage)}` : ""}`} className="underline">
                    Open your project workspace
                  </a>
                </p>
              </div>
            ) : created?.test ? (
              <div className="rounded-sm border border-amber-400 bg-amber-50 p-4">
                <p className="m-0 text-sm font-semibold text-amber-900">Test project created; publishing stayed off</p>
                <p className="m-0 mt-1 text-sm text-amber-900">
                  It self-expires in two hours, touched no live board and contacted no vendor.{" "}
                  <a href={`/sase/project/${created.id}?manage=${encodeURIComponent(created.manage)}`} className="underline">
                    Inspect the test project
                  </a>{" "}
                  or{" "}
                  <button type="button" onClick={startAfresh} className="underline">
                    start a real one
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                {/* Dual-state preview at the signature point */}
                <p className="m-0 mb-3 text-sm text-[var(--ink-600,#555)]">
                  One publish, two views, rendered from the same fields publishing sends to the board, so the preview
                  cannot overpromise.
                </p>
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-raised,#f4f4f5)] p-3.5">
                    <p className="m-0 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-500)]">
                      Public board · anyone can see this
                    </p>
                    <p className="m-0 text-sm font-semibold text-[var(--ink-900,#111)]">{brief.title}</p>
                    <p className="m-0 mt-1 text-xs text-[var(--ink-600,#555)]">
                      Anonymous buyer
                      {requirement.organisation?.sector ? ` · ${requirement.organisation.sector}` : ""}
                      {band ? ` · ${band}` : ""}
                      {requirement.estate?.sites != null ? ` · ${requirement.estate.sites} sites` : ""}
                    </p>
                    {previewChips.length > 0 && (
                      <p className="m-0 mt-1.5 flex flex-wrap gap-1">
                        {previewChips.slice(0, 4).map((c) => (
                          <span key={c} className="rounded-full border border-[var(--ink-300,#ccc)] px-2 py-0.5 text-[10.5px] text-[var(--ink-700)]">
                            {c}
                          </span>
                        ))}
                      </p>
                    )}
                    <p className="m-0 mt-1.5 text-xs text-[var(--ink-600,#555)]">No company name, no contact details, no exact headcount.</p>
                  </div>
                  <div className="rounded-sm border-2 border-amber-300 bg-white p-3.5">
                    <p className="m-0 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Signed-in vendors · full details
                    </p>
                    <p className="m-0 text-sm font-semibold text-[var(--ink-900,#111)]">{brief.title}</p>
                    <p className="m-0 mt-1 text-xs text-[var(--ink-600,#555)]">
                      This full statement of requirements, question by question with evidence requests; your assumptions
                      published labelled as assumptions.
                    </p>
                    <p className="m-0 mt-1.5 text-xs text-[var(--ink-600,#555)]">
                      They answer with evidence; their pricing is private to you. Your identity stays withheld until
                      you choose to reply.
                    </p>
                  </div>
                </div>

                {/* The consents, verbatim, each recorded by its own endpoint */}
                <div className="space-y-2.5">
                  <label className="flex items-start gap-2 text-xs text-[var(--ink-700)]">
                    <input type="checkbox" checked={consentCreate} onChange={(e) => setConsentCreate(e.target.checked)} className="mt-0.5" />
                    <span>{securityScope ? CREATE_CONSENT_TEXT : WORKSPACE_AGREEMENT_TEXT}</span>
                  </label>
                  {securityScope && unansweredGaps.length > 0 && (
                    <label className="flex items-start gap-2 text-xs text-[var(--ink-700)]">
                      <input type="checkbox" checked={consentGaps} onChange={(e) => setConsentGaps(e.target.checked)} className="mt-0.5" />
                      <span>
                        {ACCEPT_GAP_PREFIX}
                        {unansweredGaps.map((g) => g.question).join(" ")} Accepted gaps publish as stated assumptions.
                      </span>
                    </label>
                  )}
                  {securityScope && (
                    <label className="flex items-start gap-2 text-xs text-[var(--ink-700)]">
                      <input type="checkbox" checked={consentPublish} onChange={(e) => setConsentPublish(e.target.checked)} className="mt-0.5" />
                      <span>{ENGINE_PUBLISH_CONSENT_TEXT}</span>
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void signAndPublish()}
                  disabled={signLocked || !consentsOk || Boolean(signStage)}
                  className="mt-4 inline-flex items-center rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signStage ?? (testMode ? "Sign and create the test project" : "Sign and publish to the marketplace")}
                </button>
                {lockReason && <p className="m-0 mt-2 text-xs text-[var(--ink-500)]">{lockReason}</p>}
                {signError && <p className="m-0 mt-2 text-sm text-red-700">{signError}</p>}

                {needAuth && (
                  <div className="mt-4 rounded-sm border border-[var(--ink-300,#ccc)] p-3.5">
                    <p className="m-0 mb-2 text-xs text-[var(--ink-700)]">
                      One step first: publishing reaches named vendors, so it needs a verified work email. Sign in
                      below, then press the publish button again; your draft and signature are untouched.
                    </p>
                    <SignIn role="buyer" prompt="Sign in with your work email to publish." />
                    <CodeEntry onVerified={() => setNeedAuth(false)} />
                  </div>
                )}
              </>
            )}
          </section>
        </article>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add-a-supplier control (datalist over the live directory)           */
/* ------------------------------------------------------------------ */

function AddSupplier({ directory, onAdd }: { directory: Array<{ slug: string; name: string }>; onAdd: (slug: string) => void }) {
  const [val, setVal] = useState("");
  const commit = () => {
    const hit = directory.find((d) => d.name.toLowerCase() === val.trim().toLowerCase());
    if (hit) {
      onAdd(hit.slug);
      setVal("");
    }
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        list="ws-supplier-directory"
        placeholder="Add a vendor by name"
        className="w-56 border-b border-dashed border-[var(--ink-300,#ccc)] bg-transparent px-1 py-0.5 text-sm focus:border-amber-500 focus:outline-none"
      />
      <datalist id="ws-supplier-directory">
        {directory.map((d) => (
          <option key={d.slug} value={d.name} />
        ))}
      </datalist>
      <button type="button" onClick={commit} className="rounded-full border border-[var(--ink-300,#ccc)] px-2.5 py-0.5 text-xs hover:border-amber-500">
        Add
      </button>
    </div>
  );
}
