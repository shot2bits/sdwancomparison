"use client";

/**
 * The Position surface (P2, 21 July 2026): the live rendering of the
 * Position behavioural spec under the beauty-from-truth design language
 * (docs/netify-position-behavioural-spec-2026-07-21.md and
 * docs/netify-design-language-2026-07-21.md, Robert's "make this live").
 *
 * The scene is the live market served by /api/workspace/market: every body
 * is an evaluated supplier (light = evaluation recency), every breathing
 * amber point is a genuinely open board notice, and nothing else moves.
 * The buyer's sentence runs the SAME organs W0 ran: the extraction cycle,
 * the client-side rulebook, the evidence-dated fit, the create, gap
 * acceptance and publish bridge, magic-link sign-in, test mode. This
 * component is a rendering; the machinery is untouched.
 *
 * Design law enforced here: seven semantic channels, three motions
 * (emergence, reconfiguration, the strike with its cascade), serif for
 * human voices, emerald only for advice that costs Netify, stillness as
 * an honest claim. No figure on this surface is illustrative.
 *
 * P2 (Robert's correction on seeing P1): not a dark panel embedded in a
 * webpage. The page takes over the viewport (page.tsx owns that), the
 * surface is paper and ink like the rest of Netify, and the way in is
 * unmissable: his headline, his paragraph, the one input, then the living
 * market. On paper, evidence recency renders as ink weight: recently
 * evaluated bodies are darker and named; stale ones fade. Same channels,
 * same three motions, same machinery.
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
  type WorkspaceFact,
} from "@/lib/workspace/draft";
import { diagramModel } from "@/lib/workspace/diagram";
import WorkspaceDiagram from "@/components/WorkspaceDiagram";
import SignIn from "@/components/SignIn";
import CodeEntry from "@/components/CodeEntry";
import { fireNetifyEvent, firstTouch } from "@/components/NetifyEvents";

/* ------------------------------------------------------------------ */
/* Constants and pure scene helpers                                    */
/* ------------------------------------------------------------------ */

const DRAFT_KEY = "netify_workspace_draft_v1";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const WORKSPACE_AGREEMENT_TEXT =
  "Publish this requirement: Netify lists an anonymous notice on the open board and invites the best-fit evaluated vendors and service providers, who respond through the app. My identity and contact details stay private until I choose to reply, and pricing stays private to me.";

// The four intent seeds: the actual top grounding queries (spec section 3).
const SEEDS: Array<{ label: string; text: string }> = [
  { label: "Managed SIEM, UK", text: "We need a managed SIEM service in the UK. " },
  { label: "Managed SOC and MDR", text: "We are an SME looking for a managed SOC and MDR. " },
  { label: "MSSP for mid-market", text: "We are a mid-market business looking for an MSSP. " },
  { label: "SD-WAN with zero trust", text: "We need SD-WAN with zero trust integration. " },
];

const VB_W = 1200;
const VB_H = 720;
const CX = 520;
const CY = 320;

/** Deterministic placement: the same market always draws the same sky. */
export function angleForSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 100000;
  return h % 360;
}
export function radiusForSlug(slug: string): number {
  let h = 7;
  for (let i = 0; i < slug.length; i++) h = (h * 17 + slug.charCodeAt(i)) % 100000;
  return 215 + (h % 120);
}
const pt = (angle: number, r: number) => ({
  x: CX + r * Math.cos((angle * Math.PI) / 180),
  y: CY + r * Math.sin((angle * Math.PI) / 180),
});

type MarketVendor = { slug: string; name: string; category: string; last_verified: string; yes_count: number; scopes: string[] };
type MarketNotice = { id: string; title: string; scope: string[]; sites: number | null; created: number };
type Market = { rulebook_version: string; vendors: MarketVendor[]; latest_evaluation: string; notices: MarketNotice[]; counts: { vendors: number; notices: number } };

type FitSupplier = {
  slug: string; name: string; category: string; last_verified: string;
  evidence_coverage_pct: number; yes_count: number; coverage: Record<string, string>;
};
type FitState = { mode: "graded" | "compiled"; count?: number; total?: number; note?: string; suppliers: FitSupplier[]; directory: Array<{ slug: string; name: string }> };

type Selection =
  | { kind: "vendor"; vendor: MarketVendor; isFit: boolean }
  | { kind: "notice"; notice: MarketNotice }
  | { kind: "position" }
  | { kind: "gap"; gap: BriefGap }
  | { kind: "artefact" }
  | null;

const ev = (name: string, data: Record<string, string | number> = {}) => {
  const flat: Record<string, string> = { surface: "position" };
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

type CrewLine = { t: string; text: string; cls?: "you" | "em" };

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

export default function PositionWorkspace() {
  const [market, setMarket] = useState<Market | null>(null);
  const [facts, setFacts] = useState<WorkspaceFact[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SecurityScopeVerdict | null>(null);
  const [fit, setFit] = useState<FitState | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [crew, setCrew] = useState<CrewLine[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [restored, setRestored] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [motes, setMotes] = useState<Array<{ id: number; prov: string }>>([]);
  const [cascade, setCascade] = useState(false);

  const [saveLite, setSaveLite] = useState<"hidden" | "shown" | "sent" | "dismissed">("dismissed");
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
  const moteId = useRef(0);
  const factsRef = useRef<WorkspaceFact[]>([]);

  const crewLog = useCallback((text: string, cls?: "you" | "em") => {
    setCrew((c) => [...c.slice(-9), { t: stamp(), text, cls }]);
  }, []);

  const applyMerge = useCallback((updates: FieldUpdate[], source: "extract" | "answer" | "link") => {
    cycleRef.current += 1;
    const m = mergeUpdates(factsRef.current, updates, cycleRef.current, source);
    factsRef.current = m.facts;
    setFacts(m.facts);
    return m;
  }, []);

  const requirement = useMemo(() => requirementFrom(facts), [facts]);
  const buying = buyingOf(facts);
  const opModel = operatingModelOf(facts);
  const securityScope = buying === "managed_security" || buying === null;
  const live = standing(facts);
  const started = facts.length > 0;
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
          { t: "today", text: `Scout: ${d.counts.vendors} vendors evaluated · latest ${fmtDate(d.latest_evaluation)}` },
          { t: "now", text: `Registrar: ${d.counts.notices} notice${d.counts.notices === 1 ? "" : "s"} genuinely open on the board` },
          { t: "now", text: "holding, honestly. nothing here pulses that is not open." },
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
          const saved = JSON.parse(raw) as { facts?: WorkspaceFact[]; added?: string[]; removed?: string[]; ts?: number };
          if (saved.ts && Date.now() - saved.ts < DRAFT_MAX_AGE_MS && Array.isArray(saved.facts) && saved.facts.length) {
            base = saved.facts;
            setAdded(saved.added ?? []);
            setRemoved(saved.removed ?? []);
            setRestored(true);
          }
        }
      } catch { /* a broken draft never blocks the scene */ }
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
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ facts, added, removed, ts: Date.now() }));
    } catch { /* best effort */ }
  }, [facts, added, removed, started, published]);

  /* ---- The extraction cycle (the same organ) ---- */
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
        // Emergence: one mote per captured fact, exact count, no more.
        const fresh = m.changed.length;
        for (let i = 0; i < fresh; i++) {
          const id = ++moteId.current;
          const prov = (data.updates[i]?.provenance as string) ?? "stated";
          setTimeout(() => setMotes((ms) => [...ms, { id, prov }]), i * 150);
          setTimeout(() => setMotes((ms) => ms.filter((x) => x.id !== id)), i * 150 + 900);
        }
        for (const u of (data.updates ?? []).slice(0, 4)) {
          crewLog(
            u.provenance === "stated"
              ? `Listener: your words: "${(u.quote ?? String(u.value)).slice(0, 60)}"`
              : `Listener: inference, named: ${(u.reason ?? String(u.value)).slice(0, 60)}`,
            u.provenance === "stated" ? "you" : undefined,
          );
        }
        for (const n of (data.notes ?? []).slice(0, 2)) crewLog(`Listener: ${n}`);
        setEngineUsed(data.engine);
        ev("workspace_cycle", {
          cycle: cycleRef.current,
          fields: standing(m.facts).length,
          engine: data.engine,
          scope: buyingOf(m.facts) ?? "undetected",
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
            if (d.mode === "graded") crewLog(`Scout: ${d.count} of ${d.total} evaluated vendors fit this scope · dates on approach`);
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

  /* ---- Corrections ---- */
  const toggleFact = useCallback(
    (id: string) => {
      const f = factsRef.current.find((x) => x.id === id);
      factsRef.current = factsRef.current.map((x) => (x.id === id ? { ...x, struck: !x.struck } : x));
      setFacts(factsRef.current);
      if (f && !f.struck) {
        // The strike: dependent light dims in cascade, truthfully.
        setCascade(true);
        setTimeout(() => setCascade(false), 900);
        crewLog(`Registrar: struck out: ${String(f.value).slice(0, 40)} · dependents recompute`, "you");
      }
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
      setSelection(null);
    },
    [applyMerge, crewLog],
  );

  /* ---- Fit sets, pins, readiness ---- */
  const fitSlugs = (fit?.mode === "graded" ? fit.suppliers.map((s) => s.slug) : []).filter((s) => !removed.includes(s));
  const shownFit = new Set([...fitSlugs, ...added].slice(0, 8));
  const pins = [...new Set([...added, ...fitSlugs])].slice(0, 5);
  const unansweredGaps = brief.openGaps;

  const signLocked =
    !started || Boolean(published) || (securityScope && (!verdict || verdict.confidence === "low")) || (!securityScope && !buying);
  const lockReason = !started ? null : securityScope && verdict?.confidence === "low" ? "Answer the open questions on the position first: nothing is recorded on guesswork." : null;
  const consentsOk = securityScope ? consentCreate && consentPublish && (unansweredGaps.length === 0 || consentGaps) : consentCreate;
  const ready = !signLocked && started && (securityScope ? Boolean(verdict) : true);

  /* ---- The signature chain (identical organs to W0) ---- */
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
        crewLog(`Scout: ${invited.length} vendor${invited.length === 1 ? "" : "s"} invited · responses arrive against your position`);
        ev("workspace_published", { scope: buying ?? "security", invited: invited.length });
        try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* done */ }
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
  /* Scene derivations                                                   */
  /* ------------------------------------------------------------------ */

  const vendors = market?.vendors ?? [];
  const latestEval = market?.latest_evaluation ?? "";
  const scopeForFit = fitBuying === "sse" || fitBuying === "sase" || fitBuying === "sdwan" ? fitBuying : null;

  const bodyLayout = useMemo(() => {
    return vendors.map((v) => {
      const a = angleForSlug(v.slug);
      const isFit = shownFit.has(v.slug);
      const r = isFit ? 150 : radiusForSlug(v.slug);
      const p = pt(a, r);
      return { v, a, p, isFit, bright: v.last_verified === latestEval && latestEval !== "" };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors, latestEval, Array.from(shownFit).join(","), scopeForFit]);

  const noticeLayout = useMemo(
    () =>
      (market?.notices ?? []).map((n) => {
        const a = angleForSlug(n.id);
        const p = pt(a, 300 + (angleForSlug(n.id + "r") % 80));
        return { n, p };
      }),
    [market],
  );

  const moons = useMemo(() => {
    const out: Array<{ id: string; label: string; pending: boolean }> = [];
    if (securityScope && verdict && live.length > 0) {
      for (const c of verdict.summary.recommended) out.push({ id: c, label: `${capLabel(c)} · required`, pending: false });
      for (const c of verdict.summary.conditional) out.push({ id: c, label: `${capLabel(c)} · conditional`, pending: true });
    } else if (buying && buying !== "managed_security") {
      out.push({ id: "scope", label: `${BUYING_SHORT[buying]} · in scope · methodology v2026.1`, pending: false });
    }
    return out.slice(0, 6);
  }, [securityScope, verdict, buying, live.length]);

  const shellR = 14 + Math.min(facts.length, 14) * 2.4;
  const coreR = Math.max(4, shellR * 0.72 * (meter.percent / 100));
  const solidityPct = meter.percent;
  const nodeTitle = started ? brief.title : "";

  const invitedSet = new Set(published?.invited ?? []);

  /* ------------------------------------------------------------------ */
  /* Render (P2: paper and ink, input first)                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="pw-root relative mt-8">
      <style>{`
        .pw-serif{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
        .pw-mono{font-family:'SF Mono',ui-monospace,Menlo,monospace}
        @keyframes pwbreath{0%,100%{opacity:.4}50%{opacity:1}}
        .pw-breath{animation:pwbreath 3.4s ease-in-out infinite}
        .pw-body{transition:transform 1.1s cubic-bezier(.4,.1,.2,1),opacity .8s}
        .pw-edge{stroke-dasharray:600;stroke-dashoffset:600;transition:stroke-dashoffset 1.1s ease,stroke .6s,stroke-opacity .6s;animation:pwdraw 1.1s ease forwards}
        @keyframes pwdraw{to{stroke-dashoffset:0}}
        .pw-casc{stroke-opacity:.1 !important}
        @keyframes pwmote{0%{transform:translate(0,0);opacity:1}100%{transform:translate(0,240px);opacity:.1}}
        .pw-mote{animation:pwmote .8s cubic-bezier(.3,.05,.3,1) forwards}
      `}</style>

      {/* ---- The one obvious way in ---- */}
      <div className="relative z-10 mx-auto w-[min(680px,100%)] text-center">
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
            placeholder={started ? "Add or correct anything: 'actually 45 sites', 'we already run Defender'…" : "Describe your requirement in a single sentence, then press Enter"}
            disabled={Boolean(published)}
            className="pw-serif w-full bg-transparent text-center text-[17px] italic text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-[18px]"
            aria-label="Describe your requirement"
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
            <span className="pw-serif text-[15px]">Live. The market answers here.</span>{" "}
            {published.boardId && (
              <a href={`/sase/opportunities/${published.boardId}`} className="underline">your notice on the board</a>
            )}
            {" · "}
            <a href={`/sase/project/${created?.id}${created?.manage ? `?manage=${encodeURIComponent(created.manage)}` : ""}`} className="underline">your position&rsquo;s record</a>
          </p>
        )}
      </div>

      {/* ---- The living market ---- */}
      <div className="relative mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 pb-2 text-[11px] text-zinc-400">
          <span className="tracking-[.14em] text-zinc-500">THE MARKET, LIVE</span>
          <span className="text-right">
            {market
              ? published
                ? "Published. Breath marks your open notice. Everything from here renders real events only."
                : started
                  ? "Working on your words. Every motion is a computation."
                  : `Idle, honestly: ${market.counts.vendors} vendors evaluated, ${market.counts.notices} notice${market.counts.notices === 1 ? "" : "s"} open. Nothing pulses that is not open.`
              : "Reaching the market…"}{" "}
            <button type="button" onClick={() => setLegendOpen((o) => !o)} className="underline hover:text-zinc-700">
              What am I looking at?
            </button>
          </span>
        </div>
        {legendOpen && (
          <div className="absolute right-0 top-8 z-30 w-72 rounded-lg border border-zinc-200 bg-white p-3 text-[10.5px] leading-relaxed text-zinc-600 shadow-sm">
            <b className="text-zinc-900">Ink</b> is evidence recency: recently evaluated vendors are darker and named; stale ones fade.{" "}
            <b className="text-zinc-900">Distance</b> is computed fit. <b className="text-zinc-900">Thickness</b> is capabilities met.{" "}
            <b className="text-zinc-900">Solidity</b> is your own words; the small circles with a question mark are your open questions.{" "}
            <b className="text-zinc-900">Breath</b> marks a genuinely open notice; nothing else moves. Serif type is always a human voice.{" "}
            <span className="text-emerald-700">Emerald</span> is advice that costs Netify.
          </div>
        )}

        <div className="relative border-b border-zinc-200">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full" role="img" aria-label="The live procurement market">
            {/* Supplier bodies: ink weight = evaluation recency, distance = fit */}
            <g>
              {bodyLayout.map(({ v, p, isFit, bright }) => (
                <g
                  key={v.slug}
                  className={"pw-body cursor-pointer"}
                  style={{ transform: `translate(${p.x}px,${p.y}px)`, opacity: scopeForFit || fitBuying === "managed_security" ? (isFit ? 1 : 0.3) : 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelection({ kind: "vendor", vendor: v, isFit });
                  }}
                >
                  <circle r={bright ? 4.2 : 3} fill={invitedSet.has(v.slug) ? "#f59e0b" : bright ? "#18181b" : "#a8a29e"} />
                  {(isFit || bright) && (
                    <text x={9} y={3.5} fontSize={10} fill="#71717a">
                      {v.name}
                    </text>
                  )}
                </g>
              ))}
            </g>

            {/* Open notices: breath marks a real open door */}
            <g>
              {noticeLayout.map(({ n, p }) => (
                <circle
                  key={n.id}
                  className="pw-breath cursor-pointer"
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill="#f59e0b"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelection({ kind: "notice", notice: n });
                  }}
                />
              ))}
            </g>

            {/* Edges: thickness = capabilities met, drawn only to genuine fits */}
            <g>
              {started &&
                bodyLayout
                  .filter((b) => b.isFit)
                  .map((b) => (
                    <line
                      key={"e" + b.v.slug}
                      className={"pw-edge" + (cascade ? " pw-casc" : "")}
                      x1={CX}
                      y1={CY}
                      x2={b.p.x}
                      y2={b.p.y}
                      stroke={invitedSet.has(b.v.slug) ? "#f59e0b" : published ? "#d4d4d8" : "#d97706"}
                      strokeOpacity={published && !invitedSet.has(b.v.slug) ? 0.3 : 0.55}
                      strokeWidth={Math.max(1, (b.v.yes_count - 16) / 9)}
                    />
                  ))}
            </g>

            {/* The Position */}
            {started && (
              <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelection({ kind: "position" }); }}>
                {ready && !published && <circle cx={CX} cy={CY} r={shellR + 12} fill="none" stroke="#f59e0b" strokeOpacity={0.9} strokeWidth={1.4} />}
                <circle cx={CX} cy={CY} r={shellR} fill="#fbfaf8" stroke="#a1a1aa" strokeWidth={1.2} strokeDasharray="3 4" />
                <circle className={published ? "pw-breath" : undefined} cx={CX} cy={CY} r={coreR} fill={published ? "#f59e0b" : "#18181b"} />
                {/* Holes: the open questions, on the shell */}
                {unansweredGaps.slice(0, 3).map((g, i) => {
                  const hp = pt(150 + i * 40, shellR);
                  return (
                    <g key={g.key} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelection({ kind: "gap", gap: g }); }}>
                      <circle cx={hp.x} cy={hp.y} r={7} fill="#ffffff" stroke="#d4d4d8" />
                      <text x={hp.x} y={hp.y + 3} textAnchor="middle" fontSize={9} fill="#71717a">?</text>
                    </g>
                  );
                })}
                {/* Moons: requirements, because rules fired */}
                {moons.length > 0 && <circle cx={CX} cy={CY} r={86} fill="none" stroke="rgba(0,0,0,.08)" />}
                {moons.map((m, i) => {
                  const mp = pt(-90 + i * 52, 86);
                  return (
                    <g key={m.id}>
                      <circle cx={mp.x} cy={mp.y} r={3.4} fill={m.pending ? "#d4d4d8" : "#3f3f46"} />
                      <text x={mp.x + (mp.x > CX ? 8 : -8)} y={mp.y + 3.5} textAnchor={mp.x > CX ? "start" : "end"} fontSize={10} fill="#71717a">
                        {m.label}
                      </text>
                    </g>
                  );
                })}
                <text x={CX} y={CY + 128} textAnchor="middle" className="pw-serif" fontSize={16} fill="#18181b">
                  {nodeTitle}
                </text>
                <text x={CX} y={CY + 146} textAnchor="middle" fontSize={10.5} fill="#71717a">
                  {solidityPct}% in your own words · {meter.inferred} inference{meter.inferred === 1 ? "" : "s"} standing
                  {meter.engineAssumptions > 0 ? ` · ${meter.engineAssumptions} assumption${meter.engineAssumptions === 1 ? "" : "s"}` : ""}
                  {unansweredGaps.length > 0 ? ` · ${unansweredGaps.length} open question${unansweredGaps.length === 1 ? "" : "s"}` : ""}
                </text>
              </g>
            )}
          </svg>

          {/* Motes: emergence, one per captured fact, falling from the sentence into the market */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {motes.map((m) => (
              <span
                key={m.id}
                className="pw-mote absolute h-[6px] w-[6px] rounded-full"
                style={{
                  left: "50%",
                  top: "-4px",
                  background: m.prov === "inferred" ? "transparent" : "#18181b",
                  border: m.prov === "inferred" ? "1.5px solid #71717a" : "none",
                }}
              />
            ))}
          </div>

          {/* The figure and the honesty card share the left column */}
          <div className="absolute left-1 top-3 z-10 hidden w-52 space-y-2 md:block">
            {!diagram.empty && started && (
              <div className="rounded-lg border border-zinc-200 bg-white/95 p-2 shadow-sm">
                <WorkspaceDiagram model={diagram} />
                <p className="m-0 mt-1 text-[9.5px] leading-snug text-zinc-500">Drawn from your words only; redraws on every correction; never invents topology.</p>
              </div>
            )}
            {verdict && verdict.againstInterest.length > 0 && started && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[.14em] text-emerald-700">We noticed · against Netify&rsquo;s own interest</p>
                <p className="m-0 text-[12px] leading-relaxed text-emerald-900">{verdict.againstInterest[0].statement}</p>
                {verdict.againstInterest.length > 1 && (
                  <p className="m-0 mt-1 text-[10px] text-emerald-700/80">{verdict.againstInterest.length - 1} more ruling{verdict.againstInterest.length === 2 ? "" : "s"} on your record.</p>
                )}
              </div>
            )}
          </div>

          {/* The crew ledger */}
          <div className="pointer-events-none absolute bottom-2 left-1 z-10 hidden w-[min(400px,40%)] md:block">
            <p className="m-0 mb-1 text-[9px] uppercase tracking-[.14em] text-zinc-400">The crew · completed work only</p>
            <div className="pw-mono space-y-0.5 text-[10.3px] leading-relaxed text-zinc-500">
              {crew.slice(-4).map((l, i) => (
                <div key={i}>
                  <span className="mr-2 text-zinc-300">{l.t}</span>
                  <span className={l.cls === "em" ? "text-emerald-700" : l.cls === "you" ? "text-zinc-900" : undefined}>{l.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ---- Save-lite, quiet ---- */}
          {saveLite === "shown" && (
            <div className="z-20 mx-auto my-3 w-[min(300px,92%)] rounded-lg border border-zinc-200 bg-white p-3 shadow-sm md:absolute md:right-1 md:top-3 md:mx-0 md:my-0">
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
            <p className="z-20 m-0 mx-auto my-2 w-[min(300px,92%)] text-[10.5px] text-emerald-700 md:absolute md:right-1 md:top-3 md:mx-0 md:my-0">
              Sign-in link sent to {saveLiteSentTo}. The position stays right here; the link signs you in on any device.
            </p>
          )}

          {/* ---- The dossier ---- */}
          {selection && !signStage && (
            <div className="relative z-20 mx-auto my-3 w-[min(300px,92%)] rounded-lg border border-zinc-200 bg-white p-3.5 shadow-md md:absolute md:bottom-2 md:right-1 md:mx-0 md:my-0" onClick={(e) => e.stopPropagation()}>
              <Dossier
                selection={selection}
                facts={facts}
                meter={meter}
                fit={fit}
                added={added}
                removed={removed}
                onClose={() => setSelection(null)}
                onToggleFact={toggleFact}
                onAnswer={answerGap}
                onAdd={(slug) => {
                  setAdded((x) => (x.includes(slug) ? x : [...x, slug]));
                  setRemoved((x) => x.filter((r) => r !== slug));
                  ev("workspace_supplier_added", { slug });
                }}
                onRemove={(slug) => setRemoved((x) => (x.includes(slug) ? x : [...x, slug]))}
                briefTextValue={() => briefText(brief)}
              />
            </div>
          )}

          {/* ---- The signature ---- */}
          {ready && !published && !created?.test && (
            <div className="relative z-30 mx-auto my-3 w-[min(330px,92%)] rounded-lg border-2 border-amber-300 bg-white p-4 shadow-md md:absolute md:bottom-2 md:right-1 md:mx-0 md:my-0" style={{ display: selection && !signStage ? "none" : undefined }}>
              <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[.14em] text-amber-700">The signature</p>
              <p className="pw-serif m-0 mb-2 text-[14px] leading-relaxed text-zinc-900">This position is ready to meet the market.</p>
              <p className="m-0 mb-2 text-[10.5px] leading-relaxed text-zinc-500">
                One publish, two views: an anonymous breathing notice on the open board
                {requirement.organisation?.sector ? ` (${requirement.organisation.sector}` : ""}
                {usersBandLabel(requirement.estate?.users) ? `${requirement.organisation?.sector ? ", " : "("}${usersBandLabel(requirement.estate?.users)}` : ""}
                {requirement.organisation?.sector || usersBandLabel(requirement.estate?.users) ? ", no name, no contacts)" : ""}
                , and the full position to matched signed-in vendors and service providers. Assumptions publish labelled as assumptions.{" "}
                <button type="button" className="underline" onClick={() => setSelection({ kind: "artefact" })}>View the artefact</button> it produces.
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
                className="mt-1 w-full rounded-full bg-amber-500 px-5 py-2.5 text-[13px] font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {signStage ?? (testMode ? "Sign · create the test position" : "Sign · publish · let the market compete")}
              </button>
              {lockReason && <p className="m-0 mt-1.5 text-[10px] text-zinc-500">{lockReason}</p>}
              {signError && <p className="m-0 mt-1.5 text-[11px] text-red-600">{signError}</p>}
              {needAuth && (
                <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                  <p className="m-0 mb-1 text-[10.5px] text-zinc-600">
                    One step first: publishing reaches named vendors, so it needs a verified work email. Sign in, then press publish again; your position is untouched.
                  </p>
                  <SignIn role="buyer" prompt="Sign in with your work email to publish." />
                  <CodeEntry onVerified={() => setNeedAuth(false)} />
                </div>
              )}
            </div>
          )}
          {created?.test && !published && (
            <div className="relative z-30 mx-auto my-3 w-[min(330px,92%)] rounded-lg border border-amber-400 bg-amber-50 p-4 md:absolute md:bottom-2 md:right-1 md:mx-0 md:my-0">
              <p className="m-0 text-[12px] font-semibold text-amber-900">Test position created; publishing stayed off</p>
              <p className="m-0 mt-1 text-[10.5px] leading-relaxed text-amber-900">
                It self-expires in two hours, touched no live board and contacted no vendor.{" "}
                <a href={`/sase/project/${created.id}?manage=${encodeURIComponent(created.manage)}`} className="underline">Inspect it</a> or{" "}
                <button type="button" onClick={startAfresh} className="underline">start a real one</button>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The dossier: everything answers "why"                               */
/* ------------------------------------------------------------------ */

function Dossier(props: {
  selection: NonNullable<Selection>;
  facts: WorkspaceFact[];
  meter: ReturnType<typeof meterOf>;
  fit: FitState | null;
  added: string[];
  removed: string[];
  onClose: () => void;
  onToggleFact: (id: string) => void;
  onAnswer: (gap: BriefGap, value: string, label?: string) => void;
  onAdd: (slug: string) => void;
  onRemove: (slug: string) => void;
  briefTextValue: () => string;
}) {
  const { selection } = props;
  const [gapVal, setGapVal] = useState("");
  const K = ({ children }: { children: React.ReactNode }) => (
    <p className="m-0 mb-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-zinc-400">{children}</p>
  );
  const close = (
    <button type="button" onClick={props.onClose} className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-900">✕</button>
  );

  if (selection.kind === "vendor") {
    const v = selection.vendor;
    const inWorking = selection.isFit && !props.removed.includes(v.slug);
    return (
      <div className="relative">
        {close}
        <K>Evaluated vendor · live: dataset</K>
        <p className="m-0 text-[13.5px] font-semibold text-zinc-900">{v.name}</p>
        <p className="m-0 mt-0.5 text-[10.5px] text-zinc-500">{v.category}</p>
        <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-zinc-600">
          Evaluated {fmtDate(v.last_verified)} · {v.yes_count} of 40 capabilities fully met. Ink is the date; distance moves only when the matcher moves it.
        </p>
        <div className="mt-2 flex gap-2">
          {inWorking ? (
            <button type="button" onClick={() => { props.onRemove(v.slug); props.onClose(); }} className="rounded-full border border-zinc-300 px-2.5 py-1 text-[10.5px] text-zinc-600 hover:border-zinc-500">
              Remove from working list
            </button>
          ) : (
            <button type="button" onClick={() => { props.onAdd(v.slug); props.onClose(); }} className="rounded-full border border-amber-400 px-2.5 py-1 text-[10.5px] text-amber-700 hover:border-amber-600">
              Pin into invitations (up to five)
            </button>
          )}
        </div>
      </div>
    );
  }
  if (selection.kind === "notice") {
    const n = selection.notice;
    return (
      <div className="relative">
        {close}
        <K>Open on the board · live</K>
        <p className="m-0 text-[13px] font-semibold text-zinc-900">{n.title}</p>
        <p className="m-0 mt-1 text-[10.5px] text-zinc-500">
          {n.scope.join(", ")}
          {n.sites != null ? ` · ${n.sites} sites` : ""} · anonymous buyer · responses private
        </p>
        <a href={`/sase/opportunities/${n.id}`} className="mt-2 inline-block text-[11px] text-zinc-700 underline">Open the notice</a>
      </div>
    );
  }
  if (selection.kind === "gap") {
    const g = selection.gap;
    return (
      <div className="relative">
        {close}
        <K>Only you can answer this</K>
        <p className="pw-serif m-0 mb-2 text-[13px] italic leading-relaxed text-zinc-900">{g.question}</p>
        {g.path && g.control === "chips" && g.options ? (
          <div className="flex flex-wrap gap-1.5">
            {g.options.map((o) => (
              <button key={o.value} type="button" onClick={() => props.onAnswer(g, o.value, o.label)} className="rounded-full border border-zinc-300 px-2.5 py-1 text-[10.5px] text-zinc-600 hover:border-amber-500 hover:text-zinc-900">
                {o.label}
              </button>
            ))}
          </div>
        ) : g.path ? (
          <div className="flex items-center gap-2">
            <input
              value={gapVal}
              onChange={(e) => setGapVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && gapVal.trim() && props.onAnswer(g, gapVal.trim())}
              inputMode={g.control === "number" ? "numeric" : undefined}
              placeholder={g.control === "number" ? "0" : "type it"}
              className="w-28 border-b border-dashed border-zinc-400 bg-transparent px-1 py-0.5 text-[12px] text-zinc-900 outline-none focus:border-amber-500"
              aria-label={g.question}
            />
            <button type="button" onClick={() => gapVal.trim() && props.onAnswer(g, gapVal.trim())} className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10.5px] text-zinc-600 hover:border-amber-500">
              Set
            </button>
          </div>
        ) : (
          <p className="m-0 text-[10.5px] text-zinc-500">This one is accepted at the signature, and publishes as a stated assumption.</p>
        )}
      </div>
    );
  }
  if (selection.kind === "artefact") {
    return (
      <div className="relative">
        {close}
        <K>The artefact · a printout of your position</K>
        <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-zinc-700">{props.briefTextValue()}</pre>
        <p className="m-0 mt-1.5 text-[9.5px] text-zinc-400">The published document is generated by the engine at your signature; this is the position as it stands now.</p>
      </div>
    );
  }
  // position: the facts with provenance and the strike
  return (
    <div className="relative">
      {close}
      <K>Your position · {props.meter.percent}% in your own words</K>
      <div className="max-h-56 space-y-1 overflow-auto">
        {props.facts.map((f) => (
          <div key={f.id} className="flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-1 text-[11px]">
            <span className={f.struck ? "text-zinc-300 line-through" : "text-zinc-700"}>
              {f.provenance === "stated" ? (
                <span className="pw-serif italic text-zinc-900">&ldquo;{f.quote ?? String(f.value)}&rdquo;</span>
              ) : (
                <>
                  {String(f.value)} <span className="text-zinc-400">(inference: {f.reason ?? "named"})</span>
                </>
              )}
            </span>
            <button type="button" onClick={() => props.onToggleFact(f.id)} className="text-zinc-400 hover:text-zinc-900" title={f.struck ? "Restore" : "Strike out"}>
              {f.struck ? "↺" : "✕"}
            </button>
          </div>
        ))}
      </div>
      <p className="m-0 mt-1.5 text-[9.5px] leading-snug text-zinc-400">
        Strike anything: dependent light dims and everything recomputes. A strike is never overridden by re-inference, only by your own words.
      </p>
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
