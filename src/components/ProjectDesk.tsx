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
  REGION_LABELS,
  type BriefGap,
  type WorkspaceFact,
} from "@/lib/workspace/draft";
import { ORGANISATION_EXAMPLES, TAXONOMY, sectionForGapKey, sectionForPath, type TaxonomyItem } from "@/lib/workspace/taxonomy";
import { diagramModel } from "@/lib/workspace/diagram";
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
  "Publish this requirement: Netify lists an anonymous notice on the open board and invites the best-fit evaluated suppliers, who respond through the app. My identity and contact details stay private until I choose to reply, and pricing stays private to me.";

const SEEDS: Array<{ label: string; text: string }> = [
  { label: "Managed SIEM, UK", text: "We need a managed SIEM service in the UK. " },
  { label: "Managed SOC and MDR", text: "We are an SME looking for a managed SOC and MDR. " },
  { label: "MSSP for mid-market", text: "We are a mid-market business looking for an MSSP. " },
  { label: "SD-WAN with zero trust", text: "We need SD-WAN with zero trust integration. " },
];

type MarketVendor = { slug: string; name: string; category: string; last_verified: string; yes_count: number; scopes: string[] };
type MarketNotice = { id: string; title: string; scope: string[]; sites: number | null; created: number };
type Market = { rulebook_version: string; vendors: MarketVendor[]; latest_evaluation: string; notices: MarketNotice[]; counts: { vendors: number; notices: number } };

type FitSupplier = {
  slug: string; name: string; category: string; last_verified: string;
  evidence_coverage_pct: number; yes_count: number; coverage: Record<string, string>;
};
type FitState = { mode: "graded" | "compiled"; count?: number; total?: number; note?: string; suppliers: FitSupplier[]; directory: Array<{ slug: string; name: string }> };

type NotedItem = { id: string; label: string; section: string };
type Receipt = { id: number; text: string };

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
            noted?: NotedItem[]; receipts?: Receipt[]; ts?: number;
          };
          if (saved.ts && Date.now() - saved.ts < DRAFT_MAX_AGE_MS && ((saved.facts?.length ?? 0) > 0 || (saved.noted?.length ?? 0) > 0)) {
            base = saved.facts ?? [];
            setAdded(saved.added ?? []);
            setRemoved(saved.removed ?? []);
            setNoted(saved.noted ?? []);
            setReceipts(saved.receipts ?? []);
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
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ facts, added, removed, noted, receipts, ts: Date.now() }));
    } catch { /* best effort */ }
  }, [facts, added, removed, noted, receipts, started, published]);

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
        for (const n of (data.notes ?? []).slice(0, 2)) crewLog(`Listener: ${n}`);

        // The receipt rule (13.6): no clause vanishes silently. A clause no
        // update evidently touched is kept verbatim under Notes, unplaced.
        // Commas split too (P3.1.1): Robert's own rich sentence is one long
        // comma list, and "5 global sites" must not hide inside a sentence
        // its neighbours got credit for. Matching is normalised to letters
        // and digits so quote-form drift (24x7 vs 24/7) never fakes a miss.
        const norm = (s: unknown) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
        const clauses = trimmed.split(/(?<=[.;!?])\s+|,\s+/).map((c) => c.trim()).filter((c) => c.length > 10);
        const touched = (clause: string) => {
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
    return `buying=${fitBuying}&regions=${regions}&model=${opModel ?? "any"}&include=${added.join(",")}`;
  }, [fitBuying, requirement, opModel, added]);
  useEffect(() => {
    if (!fitParams) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/sase/api/workspace/fit?${fitParams}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.ok) {
            setFit(d as FitState);
            if (d.mode === "graded") crewLog(`Scout: ${d.count} of ${d.total} evaluated suppliers fit this scope · order is fit`);
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
            "Drafted in the Live Sourcing Workspace.",
          ].filter(Boolean).join(" ");
          const res = await fetch("/sase/api/rfp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: brief.title,
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

  const notedBySection = useMemo(() => {
    const map = new Map<string, NotedItem[]>();
    for (const n of noted) map.set(n.section, [...(map.get(n.section) ?? []), n]);
    return map;
  }, [noted]);

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
  }, [market, fitSlugs, added]);

  const invitedSet = new Set(published?.invited ?? []);
  const title = started && facts.length > 0 ? brief.title : "Your project";

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
              <span className="text-zinc-400">Try:</span>
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

      {/* ---- The desk: the document and the responding organs ---- */}
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_336px]">

        {/* ============ THE PROJECT: the living Statement of Requirements ============ */}
        <div>
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-zinc-900 pb-2">
            <h2
              className="m-0 tracking-tight"
              style={{ fontSize: "19px", lineHeight: 1.3, fontWeight: 600, color: facts.length ? "#09090b" : "#a1a1aa" }}
            >{title}</h2>
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
                <section key={sec.key} className="pd-sec mb-5">
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
                    const state: "example" | "option" | "stated" | "inferred" | "struck" | "noted" =
                      f ? (f.struck ? "struck" : f.provenance === "stated" ? "stated" : "inferred")
                        : isNoted ? "noted"
                        : item.exampleTick && !isLive ? "example"
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
                      One publish, two views: an anonymous notice on the open board
                      {requirement.organisation?.sector ? ` (${requirement.organisation.sector}` : ""}
                      {usersBandLabel(requirement.estate?.users) ? `${requirement.organisation?.sector ? ", " : "("}${usersBandLabel(requirement.estate?.users)}` : ""}
                      {requirement.organisation?.sector || usersBandLabel(requirement.estate?.users) ? ", no name, no contacts)" : ""}
                      , and the full position to matched signed-in suppliers. Assumptions publish labelled as assumptions; example content never publishes at all.
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
              <span className="text-zinc-300">grey</span> example, never publishes · <span className="border-b border-zinc-900 text-zinc-900">solid ink</span> stated, your words or your touch ·{" "}
              <span className="border-b border-dotted border-zinc-500 text-zinc-600">dotted</span> inferred, reason attached, one tap strikes ·{" "}
              <span className="text-emerald-700">✓ dated</span> verified, evidence stands behind it. Strike anything; a strike is never overridden by re-inference, only by your own words.
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
              The market, live <span className="font-normal normal-case tracking-normal">order is fit</span>
            </p>
            <p className="m-0 mb-2 text-[10.5px] text-zinc-500">
              {market ? (
                <>
                  {market.counts.notices > 0 && <span className="pd-breath mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-amber-400 align-[0px]" />}
                  {market.counts.vendors} suppliers evaluated · {market.counts.notices} notice{market.counts.notices === 1 ? "" : "s"} genuinely open ·{" "}
                  <a href="/sase/opportunities/board/" className="underline hover:text-zinc-900">the board</a>
                </>
              ) : "Reaching the market…"}
            </p>
            <div>
              {marketRows.shown.map((v) => {
                const isFit = shownFit.has(v.slug);
                const bright = v.last_verified === marketRows.latest && marketRows.latest !== "";
                const recent = !bright && marketRows.latest && daysBetween(v.last_verified, marketRows.latest) < 60;
                const dim = started && fitBuying && !isFit;
                return (
                  <button
                    key={v.slug}
                    type="button"
                    onClick={() => setVendorCard(v)}
                    className={`flex w-full items-baseline gap-2 py-[3px] text-left text-[12px] leading-snug transition-opacity ${dim ? "opacity-40" : ""}`}
                  >
                    <span
                      className="inline-block flex-none rounded-full"
                      style={{
                        width: bright ? 9 : 8, height: bright ? 9 : 8,
                        background: invitedSet.has(v.slug) ? "#f59e0b" : bright ? "#18181b" : recent ? "#52525b" : "#a8a29e",
                      }}
                    />
                    <span className={bright || isFit ? "text-zinc-900" : "text-zinc-500"}>{v.name}</span>
                    {added.includes(v.slug) && <span className="rounded-full bg-zinc-100 px-1.5 text-[8.5px] text-zinc-600">pinned</span>}
                    {invitedSet.has(v.slug) && <span className="rounded-full bg-amber-100 px-1.5 text-[8.5px] text-amber-800">invited</span>}
                    <span className="ml-auto whitespace-nowrap text-[9px] text-zinc-400">
                      <span className="text-emerald-600">✓</span> {fmtDate(v.last_verified)}
                    </span>
                  </button>
                );
              })}
              {marketRows.more > 0 && (
                <p className="m-0 mt-1 text-[9.5px] text-zinc-400">and {marketRows.more} more evaluated suppliers, all in the running.</p>
              )}
            </div>
            <p className="m-0 mt-1.5 text-[9px] leading-snug text-zinc-400">
              Ink is evaluation recency; every date is a real evaluation (verified). Order sharpens as your position grows.
            </p>
            {vendorCard && (
              <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
                <button type="button" onClick={() => setVendorCard(null)} className="float-right text-zinc-400 hover:text-zinc-900">✕</button>
                <p className="m-0 text-[12px] font-semibold text-zinc-900">{vendorCard.name}</p>
                <p className="m-0 mt-0.5 text-[10px] text-zinc-500">{vendorCard.category}</p>
                <p className="m-0 mt-1 text-[10px] leading-relaxed text-zinc-600">
                  Evaluated {fmtDate(vendorCard.last_verified)} · {vendorCard.yes_count} of 40 capabilities fully met.
                </p>
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces (top-level, so focus survives re-renders)                    */
/* ------------------------------------------------------------------ */

/** One line of the framework: the four truth classes as ink. */
function ItemLine(props: {
  item: TaxonomyItem;
  state: "example" | "option" | "stated" | "inferred" | "struck" | "noted";
  fact?: WorkspaceFact;
  flashing: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { item, state, fact } = props;
  const mark = state === "stated" || state === "inferred" || state === "noted" ? "✓" : state === "struck" ? "×" : state === "example" ? "✓" : "·";
  const markCls =
    state === "stated" || state === "noted" ? "text-zinc-900"
    : state === "inferred" ? "text-zinc-700"
    : state === "struck" ? "text-zinc-300"
    : state === "example" ? "text-zinc-300"
    : "text-zinc-300 group-hover:text-zinc-500";
  const labelCls =
    state === "stated" || state === "noted" ? "border-b border-zinc-900 text-zinc-900"
    : state === "inferred" ? "border-b border-dotted border-zinc-500 text-zinc-800"
    : state === "struck" ? "text-zinc-300 line-through"
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
  const rows: Array<{ k: string; fact?: WorkspaceFact; facts?: WorkspaceFact[]; ex: string }> = [
    { k: "Industry", fact: one("organisation.sector"), ex: ORGANISATION_EXAMPLES[0].v },
    { k: "Users", fact: one("estate.users"), ex: ORGANISATION_EXAMPLES[1].v },
    { k: "Sites", fact: one("estate.sites"), ex: ORGANISATION_EXAMPLES[2].v },
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
              <span className={isLive ? "text-[11px] text-zinc-300" : "text-zinc-300"}>{isLive ? "—" : r.ex}</span>
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
