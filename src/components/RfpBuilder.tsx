"use client";

/**
 * 2026 SASE, SSE and SD-WAN RFP builder. Two modes over one RFP entity:
 *  - AI agent: full conversation; the agent reads and writes the RFP.
 *  - Build it myself: pick scope and delivery model, toggle researched
 *    questions from the methodology library, and author custom questions
 *    with the AI helper.
 * Both modes persist to the same ProjectDetails via the API, so a buyer
 * can switch freely. No submit buttons; saves happen as you go.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  NETIFY_NDA_TEMPLATE,
  type ProjectDetails,
  type RfpQuestion,
  type NdaConfig,
  type NdaAcceptance,
  type ProductScope,
} from "@/lib/rfp-types";
import { FOLLOW_UP_NOTE } from "@/lib/publish-promises";
import SignIn from "@/components/SignIn";
import { fireNetifyEvent } from "@/components/NetifyEvents";
import { humaniseSecurityCodes, securityCodeLabel } from "@/lib/security/labels";
import FlowStageStrip, { type FlowStage } from "@/components/FlowStageStrip";
import { hasPublished } from "@/lib/project-machine";

/** The instant publish reward, mirrored from lib/market-report (server). */
type MarketReportT = {
  matched: { count: number; names: string[] };
  estimate: { monthly_band_gbp: [number, number]; three_year_tco_band_gbp: [number, number]; methodology_version: string; disclaimer: string } | null;
  assumptions: string[];
  gaps: string[];
  document: { sections: number; questions: number };
  analyst_note: string;
};
const fmtBand = (b: [number, number]) => `£${b[0].toLocaleString("en-GB")} to £${b[1].toLocaleString("en-GB")}`;

const STATUS_FLOW = ["draft", "review", "published", "qa", "evaluation"];
// Scope restructured per Harry's UX feedback (2026-07-02): the old flat list
// ("Full SASE" / "Single-vendor SASE" / "Best-of-breed") overlapped and read
// as crossover. The UI now asks two things — WHAT you are buying (SD-WAN /
// SSE / SASE) and, for SASE, the VENDOR APPROACH (no preference / unified
// single-vendor / best-of-breed). The persisted `product_scope` values and
// the question engine are unchanged; this is a pure presentation mapping:
//   SD-WAN            → sdwan_only
//   SSE               → sse_only
//   SASE + no pref    → full_sase
//   SASE + unified    → single_vendor_sase
//   SASE + best-of-breed → best_of_breed
const SCOPE_PRODUCTS = [
  { key: "sdwan", label: "SD-WAN" },
  { key: "sse", label: "SSE (security service edge)" },
  { key: "sase", label: "SASE (SD-WAN + security)" },
] as const;
const SASE_APPROACHES = [
  { key: "full_sase", label: "No preference" },
  { key: "single_vendor_sase", label: "Unified (single vendor)" },
  { key: "best_of_breed", label: "Best-of-breed (mix vendors)" },
] as const;
const scopeToProduct = (scope: string) =>
  scope === "sdwan_only" ? "sdwan" : scope === "sse_only" ? "sse" : "sase";
const productToScope = (product: string, currentScope: ProductScope): ProductScope => {
  if (product === "sdwan") return "sdwan_only";
  if (product === "sse") return "sse_only";
  // switching to SASE: keep an existing SASE approach, else default
  return ["full_sase", "single_vendor_sase", "best_of_breed"].includes(currentScope) ? currentScope : "full_sase";
};
const MODELS = [
  { key: "any", label: "Any" },
  { key: "managed", label: "Fully managed" },
  { key: "co_managed", label: "Co-managed" },
  { key: "diy", label: "DIY / self-managed" },
];
// Sector select for Step 1. Sector always mattered to generation (agent
// opener, sector packs, document background) but was invisible in the UI, so
// sector-preloaded links looked like they had done nothing (Harry's retest,
// 03/07/2026). Keys match the question-bank sector packs.
const SECTORS = [
  { key: "", label: "Any / not sure" },
  { key: "healthcare", label: "Healthcare" },
  { key: "retail_ecommerce", label: "Retail & e-commerce" },
  { key: "financial_services", label: "Financial services" },
  { key: "manufacturing", label: "Manufacturing" },
];
const REGULATIONS = [
  { key: "uk_gdpr", label: "UK GDPR / DUAA" },
  { key: "pci_dss", label: "PCI DSS v4.0" },
  { key: "iec_62443", label: "IEC 62443 (OT)" },
  { key: "iso_27001", label: "ISO 27001" },
  { key: "cyber_resilience_bill", label: "UK Cyber Resilience Bill" },
  { key: "dora", label: "EU DORA" },
  { key: "nis2", label: "EU NIS2" },
];
type CoverageRow = { regulation: string; label: string; feature_id: string; covered: boolean };
type ClausePack = { regulation: string; label: string; clauses: string[] };
type Evaluation = { vendor: string; vendor_slug: string | null; answered: number; total: number; flags: number; red_flags?: number; missing_evidence?: number; weighted_coverage?: number; checks: { question: string; answer: string; grade_label: string; flag: string; note: string }[] };
type Benchmark = { available: boolean; total_rfps?: number; top_mandatory_questions?: { name: string; count: number }[]; median_response_completeness?: number | null };
type ConnMsg = { id: string; from: "buyer" | "supplier"; type: string; body: string; payload: Record<string, string>; created: number };
type Connection = { vendor_slug: string; vendor_name: string; token: string; status: string; messages: ConnMsg[]; viewed_at?: number };
type Suggestion = { rank: number; slug: string; name: string; score?: number };
type ExtendedBankQuestion = {
  question_id: string;
  category_id: string;
  question: string;
  answer_type: string;
  evidence_required: string[];
  mandatory_for: string[];
  optional_for: string[];
  weighting_hint: string;
  why_it_matters: string;
  red_flag_answers: string[];
  follow_up_questions: string[];
};

/** Buyer sector keys (question-bank packs) → extended-bank sector slugs. */
const EXT_SECTOR_MAP: Record<string, string> = {
  financial_services: "financial-services",
  retail_ecommerce: "retail",
  manufacturing: "manufacturing",
  healthcare: "healthcare",
};

export default function RfpBuilder({ initialId }: { initialId?: string }) {
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<"agent" | "manual">("agent");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // True when the server refused the workspace read: this browser holds no
  // manage token and the session (if any) does not own the RFP. Renders the
  // "private workspace" gate instead of the builder.
  const [notOwner, setNotOwner] = useState(false);
  // Board-listing outcome from the last publish (listed, or why not).
  const [boardNote, setBoardNote] = useState<{ listed: boolean; url?: string; reason?: string } | null>(null);
  // Market-unlock correction round (16 Aug 2026): the canonical,
  // server-derived boolean (market-unlock.ts) that gates every vendor-
  // identity-revealing part of this panel -- replacing the row-8 hotfix's
  // `hasPublished(project.status)` client-side recomputation, which could
  // read true while the project's board listing (and therefore its market
  // unlock) had failed. Deliberately NOT a field on `project` itself: that
  // object round-trips through PUT (see applyProject below and the save
  // handler), and ProjectDetailsSchema is `.strict()` -- an extra key
  // surviving a save's blind spread would fail every PUT with "Invalid RFP
  // shape". Kept as separate state, defaulting LOCKED (false) until a real
  // server response says otherwise.
  const [marketUnlocked, setMarketUnlocked] = useState(false);
  // Feedback for every question-add outcome (added / merged / duplicate) —
  // silent no-ops read as "the button is broken" (Harry's Testing 1).
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const addMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashAddMsg(msg: string) {
    setAddMsg(msg);
    if (addMsgTimer.current) clearTimeout(addMsgTimer.current);
    addMsgTimer.current = setTimeout(() => setAddMsg(null), 6000);
  }
  // "Write your own question" (no AI) composer state.
  const [ownText, setOwnText] = useState("");
  const [ownEvidence, setOwnEvidence] = useState("");
  const [ownCategory, setOwnCategory] = useState("Custom requirements");
  // Click-to-edit RFP title.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // agent chat
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [manageCopied, setManageCopied] = useState(false);
  // Publish requires a verified sign-in on top of the manage token: when the
  // server answers 401 sign_in_required, render the inline sign-in panel.
  const [publishAuthNeeded, setPublishAuthNeeded] = useState(false);
  // Live evaluated-market SIZE for the publish panel: the same public,
  // project-blind endpoint the Describe wizard uses. Living Procurement
  // Canvas Phase 2 hotfix (14 Aug 2026), Robert's finding: this endpoint
  // has no project id or status, so it must never carry this project's
  // actual matched vendor names or narrowed count -- only the aggregate
  // marketplace size. This project's REAL matched/invited vendors, once
  // published, come from the publish response and the owner-gated report
  // route -- never from here.
  const [matchInfo, setMatchInfo] = useState<{ total: number } | null>(null);
  // The Market Report: the instant publish reward (price band, matched
  // suppliers, gaps, downloads). Set from the publish response, or fetched
  // when a published RFP loads.
  const [marketReport, setMarketReport] = useState<MarketReportT | null>(null);
  // Slim sticky publish bar: dismissible per session so it never nags.
  const [stickyGone, setStickyGone] = useState(false);
  const publishPanelRef = useRef<HTMLElement | null>(null);
  const publishCtaSeen = useRef(false);
  // "Email me my draft link" capture state (come back later without an account).
  const [draftEmail, setDraftEmail] = useState("");
  const [emailingLink, setEmailingLink] = useState(false);
  const [draftLinkNote, setDraftLinkNote] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // AI custom question composer
  const [intent, setIntent] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<(RfpQuestion & { category: string }) | null>(null);

  // compliance, research, evaluation, benchmark
  const [coverage, setCoverage] = useState<{ rows: CoverageRow[]; gaps: CoverageRow[]; clauses: ClausePack[] } | null>(null);
  const [topic, setTopic] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchSet, setResearchSet] = useState<{ analysis: string; questions: (RfpQuestion & { category: string })[] } | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[] | null>(null);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [bank, setBank] = useState<{
    version: string;
    canonical: { id: string; category: string; text: string }[];
    sector_packs: Record<string, { label: string; sections: { title: string; questions: { id: string; text: string; buyer_lens: string; supplier_lens: string; netify_note: string }[] }[] }>;
    // Extended SASE canonical bank (recovered from the Base44 app): richer
    // procurement metadata per question. Optional so cached copies of
    // question-bank.json without it keep working.
    sase_extended?: {
      version: string;
      category_labels: Record<string, string>;
      count: number;
      questions: ExtendedBankQuestion[];
    };
  } | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [msgDraft, setMsgDraft] = useState<Record<string, string>>({});
  const [ndaAccepts, setNdaAccepts] = useState<NdaAcceptance[]>([]);

  const nda: NdaConfig = project?.nda ?? { required: false, source: "template", text: "", link: "", version: 1, updated: 0 };

  /** Persist an NDA change. Editing the wording, link or source bumps the
   *  version so any prior supplier acceptances no longer satisfy the gate and
   *  suppliers are asked to re-accept the current terms. */
  async function updateNda(patch: Partial<NdaConfig>) {
    if (!project) return;
    const next: NdaConfig = { ...nda, ...patch };
    const termsChanged = patch.text !== undefined && patch.text !== nda.text
      || patch.link !== undefined && patch.link !== nda.link
      || patch.source !== undefined && patch.source !== nda.source;
    if (termsChanged) next.version = nda.version + 1;
    if (patch.required && !nda.text && next.source === "template") next.text = NETIFY_NDA_TEMPLATE;
    next.updated = Date.now();
    await persist({ ...project, nda: next });
  }

  async function refreshNdaAccepts() {
    if (!project) return;
    try {
      const r = await fetch(`/sase/api/rfp/${project.id}/nda?acceptances=1`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setNdaAccepts(d.acceptances ?? []); }
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    if (initialId) queueMicrotask(() => void loadProject(initialId));
    // loadProject is intentionally tied to the route id, not to its changing closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  // Publish auto-resume (Harry's feedback, 06/07/2026). Two paths back from
  // the sign-in round trip: (a) the amber panel is still on screen because the
  // magic link opened in another tab, so poll the session and continue the
  // moment it exists; (b) this page reloaded, so a stored intent flag brings
  // the panel back and the same poll completes the publish.
  const resuming = useRef(false);
  useEffect(() => {
    if (!project) return;
    let flagged = false;
    try { flagged = localStorage.getItem(`rfp_pending_publish_${project.id}`) === "1"; } catch { /* ignore */ }
    if (flagged && project.status !== "published" && !publishAuthNeeded) queueMicrotask(() => setPublishAuthNeeded(true));
    /* eslint-disable-next-line */
  }, [project?.id]);
  useEffect(() => {
    if (!publishAuthNeeded || publishing) return;
    const t = window.setInterval(async () => {
      if (resuming.current) return;
      try {
        const r = await fetch("/sase/api/auth/session");
        const d = r.ok ? ((await r.json()) as { authenticated?: boolean }) : { authenticated: false };
        if (d.authenticated) {
          resuming.current = true;
          window.clearInterval(t);
          await publishToCurated("signin_resume");
          resuming.current = false;
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => window.clearInterval(t);
    /* eslint-disable-next-line */
  }, [publishAuthNeeded, publishing]);

  // Live match count for the publish panel and sticky bar. Derived from the
  // buyer context the wizard captured; cached 300s server-side.
  const matchScope = project ? (project.buyer.product_scope === "sdwan_only" ? "sdwan" : project.buyer.product_scope === "sse_only" ? "sse" : "sase") : "sase";
  const matchModel = project && (project.buyer.operating_model === "managed" || project.buyer.operating_model === "diy") ? project.buyer.operating_model : "any";
  const matchRegions = project ? project.buyer.regions.join(".") : "";
  useEffect(() => {
    if (!project) return;
    let gone = false;
    fetch(`/sase/api/rfp/match?${new URLSearchParams({ scope: matchScope, regions: matchRegions, model: matchModel })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!gone && d && typeof d.total === "number") setMatchInfo({ total: d.total }); })
      .catch(() => { /* panel copy falls back to unnumbered */ });
    return () => { gone = true; };
    /* eslint-disable-next-line */
  }, [project?.id, matchScope, matchModel, matchRegions]);

  // Sticky-bar dismissal persists for the session only.
  useEffect(() => {
    if (!project) return;
    try {
      const gone = sessionStorage.getItem(`rfp_publish_bar_${project.id}`) === "1";
      queueMicrotask(() => setStickyGone(gone));
    } catch { /* ignore */ }
    /* eslint-disable-next-line */
  }, [project?.id]);

  // The sign-in lives inside the publish panel: bring it into view the moment
  // publishing asks for a session, whichever button was pressed.
  useEffect(() => {
    if (publishAuthNeeded) publishPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [publishAuthNeeded]);

  // Funnel visibility: record that the publish step was actually seen.
  useEffect(() => {
    if (!project || publishCtaSeen.current) return;
    if (project.status === "draft" || project.status === "review") {
      publishCtaSeen.current = true;
      fireNetifyEvent("publish_cta_view", {});
    }
    /* eslint-disable-next-line */
  }, [project?.id]);

  // Generate handoff from the Describe wizard (?welcome=generated): show the
  // document-first banner, land in manual mode so the assembled document is
  // the first thing seen, report rfp_generated once, then clean the param so
  // refreshes do not re-report. Flow spec, 14 July 2026.
  const [generatedWelcome, setGeneratedWelcome] = useState(false);
  // Consent-at-generate handoff (?welcome=submitting): the buyer agreed at
  // the wizard's final step that generating submits to their matched
  // suppliers. The pending-publish flag drives the auto-resume; this state
  // only tailors the copy while the magic-link round trip completes.
  const [submitFlow, setSubmitFlow] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const w = p.get("welcome");
    if (w !== "generated" && w !== "submitting") return;
    let email = "";
    if (w === "submitting") {
      try { email = sessionStorage.getItem("netify_pending_email") ?? ""; } catch { /* ignore */ }
    }
    queueMicrotask(() => {
      if (w === "generated") setGeneratedWelcome(true);
      if (w === "submitting") {
        setSubmitFlow(true);
        setPendingEmail(email);
      }
      setMode("manual");
      fireNetifyEvent("rfp_generated", { flow: w === "submitting" ? "submit" : "review" });
      p.delete("welcome");
      const qs = p.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    });
  }, []);

  // Sign-in confirmation carried over the verify redirect (sessionStorage,
  // same tab). A persistent strip replaces the flash message Harry missed:
  // it confirms the session, the claimed drafts and what happens next.
  const [signinNote, setSigninNote] = useState<number | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("netify_signin_note");
      if (!raw) return;
      sessionStorage.removeItem("netify_signin_note");
      const d = JSON.parse(raw) as { claimed?: number };
      const claimed = typeof d.claimed === "number" ? d.claimed : 0;
      queueMicrotask(() => setSigninNote(claimed));
    } catch { /* ignore */ }
  }, []);

  // Responses appear without a manual click once the RFP is published
  // (Harry's feedback, 06/07/2026). The button remains as a refresh.
  useEffect(() => {
    if (project?.status === "published" && evaluations === null) loadEvaluations();
    if (marketReport === null && project) loadMarketReport();
    /* eslint-disable-next-line */
  }, [project?.status, project?.id]);

  /** Fetch the Market Report (owner-gated). Published RFPs get the full
   *  report; drafts get the tiered preview (20 July 2026, the draft-pool
   *  fix). Resolves the manage token itself so the first render can fetch
   *  before the restore effect has run. */
  async function loadMarketReport() {
    if (!project) return;
    try {
      let tok = manageToken.current || "";
      if (!tok && typeof window !== "undefined") {
        tok = localStorage.getItem(mtokKey(project.id)) || new URLSearchParams(window.location.search).get("manage") || "";
      }
      const qs = tok ? `?manage=${tok}` : "";
      const r = await fetch(`/sase/api/rfp/${project.id}/report${qs}`, { headers: authHeaders() });
      if (r.ok) {
        const d = (await r.json()) as { market_report?: MarketReportT };
        if (d.market_report) setMarketReport(d.market_report);
      }
    } catch { /* the panel simply stays absent */ }
  }
  // Tell the landing page an RFP is underway so the big path cards collapse
  // and stop competing with the builder (Harry's feedback, 03/07/2026).
  useEffect(() => {
    if (project?.id && typeof window !== "undefined") window.dispatchEvent(new Event("netify:rfp-active"));
    // Continue-your-draft pointer (20 July 2026): the return path for
    // anonymous drafts. Id only; the manage token stays in its own key.
    if (project?.id && typeof window !== "undefined") {
      try {
        if (project.status === "draft" || project.status === "review") {
          localStorage.setItem("netify_last_draft", JSON.stringify({ id: project.id, title: project.title, at: Date.now() }));
        } else {
          // Published projects are not "a draft in progress"; clear the
          // pointer so the start-page banner never mislabels them.
          const raw = localStorage.getItem("netify_last_draft");
          if (raw && (JSON.parse(raw) as { id?: string }).id === project.id) localStorage.removeItem("netify_last_draft");
        }
      } catch { /* private mode */ }
    }
  }, [project?.id, project?.status, project?.title]);
  const previewSeen = useRef(false);
  useEffect(() => {
    if (marketReport && project && project.status !== "published" && !previewSeen.current) {
      previewSeen.current = true;
      fireNetifyEvent("report_preview_view", {});
    }
    /* eslint-disable-next-line */
  }, [marketReport, project?.status]);
  const complianceKey = project?.buyer.compliance?.join(",") ?? "";
  useEffect(() => {
    if (project) queueMicrotask(() => void refreshCoverage());
    // The project id and compliance values are the refresh boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, complianceKey]);
  useEffect(() => { fetch("/sase/api/rfp/benchmark").then((r) => r.json()).then(setBenchmark).catch(() => {}); }, []);
  // Row-8 hotfix (16 Aug 2026): only poll for supplier connections once the
  // project has actually published. Pre-publish there is nothing legitimate
  // to fetch (the connect route below now refuses to persist a connection
  // before publish), so this also stops an unauthenticated pre-publish read
  // of this endpoint on every draft page load. The explicit post-publish
  // refreshConnections() calls elsewhere (after invite/message/publish) are
  // unaffected — they read the fresh publish result directly, not this
  // status-gated mount effect.
  useEffect(() => {
    if (project && marketUnlocked) queueMicrotask(() => void refreshConnections());
    // Connections refresh only when project identity or unlock state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, marketUnlocked]);
  useEffect(() => {
    if (project?.nda?.required) queueMicrotask(() => void refreshNdaAccepts());
    // NDA acceptances refresh only when the project or NDA version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.nda?.required, project?.nda?.version]);
  useEffect(() => { fetch("/sase/question-bank.json").then((r) => r.json()).then(setBank).catch(() => {}); }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages]);

  // The manage_token is the RFP's mutation/push credential. The server strips it
  // from open reads (GET, agent), so we hold it client-side after creation and
  // re-attach it whenever the server hands back a stripped project. This keeps
  // publish, save, goal and approvals working without the credential ever being
  // discoverable by someone who only knows the RFP id.
  const manageToken = useRef<string>("");
  const mtokKey = (id: string) => `netify_mtok_${id}`;
  function applyProject(p: ProjectDetails & { market_unlocked?: boolean; market_unlock?: unknown }) {
    let tok = p.manage_token || manageToken.current;
    if (!tok && typeof window !== "undefined") tok = localStorage.getItem(mtokKey(p.id)) || "";
    if (tok) {
      manageToken.current = tok;
      try { localStorage.setItem(mtokKey(p.id), tok); } catch { /* private mode, keep in ref */ }
    }
    setNotOwner(false);
    // Market-unlock correction round: every owner read of a project now
    // carries this canonical, server-derived field (see the GET/PUT routes
    // in api/rfp/[id]/route.ts) as a SIBLING key, never merged into the
    // stored `project` state itself -- see the marketUnlocked useState
    // comment above for why. A response from a code path that doesn't
    // attach it (there should be none left after this round; anything
    // missed defaults safely LOCKED rather than silently unlocked).
    if (typeof p.market_unlocked === "boolean") setMarketUnlocked(p.market_unlocked);
    const { market_unlocked: _marketUnlocked, market_unlock: _marketUnlock, ...projectFields } = p;
    void _marketUnlocked; void _marketUnlock;
    setProject({ ...projectFields, manage_token: tok });
  }

  /** The owner credential, attached to every workspace API call. */
  function authHeaders(): Record<string, string> {
    return manageToken.current ? { "x-manage-token": manageToken.current } : {};
  }

  // The true board state on every visit (Robert's gate ruling, 23 Jul 2026:
  // 41 published RFPs, 9 ever supplier-visible). boardNote used to exist only
  // in the moments after a publish; a returning owner of a published-but-
  // unlisted RFP saw nothing and stayed invisible to board suppliers.
  //
  // Market-unlock correction round 2 (16 Aug 2026): this used to gate on
  // `hasPublished(project.status)` -- now the WRONG signal, since
  // `project.status` no longer flips to "published" until the publish
  // saga's own step F succeeds (strictly after the market has genuinely
  // unlocked, see rfp-publish.ts's executePublish()). A project stuck on a
  // failed or never-completed publication attempt would never satisfy that
  // gate, so this effect would never fire and a returning owner would see
  // no locked-state messaging at all -- a newly-introduced bug this round's
  // own saga restructure would otherwise have caused. Now runs on every
  // visit that has a project at all; the server's own `publication_attempted`
  // flag (list-on-board/route.ts's GET) decides whether there is anything
  // to show, so a brand-new, never-submitted draft still shows nothing.
  const [listingBusy, setListingBusy] = useState(false);
  const [listAuthNeeded, setListAuthNeeded] = useState(false);
  const [publicationLockedReason, setPublicationLockedReason] = useState<string | null>(null);
  useEffect(() => {
    if (!project) return;
    fetch(`/sase/api/rfp/${project.id}/list-on-board`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; board?: { listed: boolean; url?: string }; market_unlocked?: boolean; publication_attempted?: boolean; publication_locked_reason?: string | null } | null) => {
        if (!d?.ok || !d.publication_attempted) return;
        if (d.board) {
          const next = d.board.listed
            ? { listed: true, url: d.board.url }
            : { listed: false, reason: "Verified vendors browsing the board cannot see this RFP." };
          setBoardNote((prev) => prev ?? next);
        }
        // Market-unlock correction round: this GET already queries the
        // canonical record (list-on-board/route.ts) -- pick it up here too,
        // so a returning owner whose original publish's board step failed
        // (internal status published, market still locked) sees the true
        // locked state on load, not a stale unlocked assumption from
        // `hasPublished()` alone.
        if (typeof d.market_unlocked === "boolean") setMarketUnlocked(d.market_unlocked);
        setPublicationLockedReason(d.publication_locked_reason ?? null);
      })
      .catch(() => {});
    // eslint-disable-next-line
  }, [project?.id, project?.status]);

  /** List an already published RFP on the board -- and, per the
   *  market-unlock correction round, complete the deferred unlock/invite
   *  sequence too, if this is the first time listing succeeds for this
   *  publish (see retryBoardPublication() in rfp-publish.ts). */
  async function listOnBoardNow() {
    if (!project || listingBusy) return;
    setListingBusy(true);
    setListAuthNeeded(false);
    fireNetifyEvent("board_list_click", {});
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/list-on-board`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({})) as { board?: { listed?: boolean; url?: string }; auth_required?: boolean; error?: string; market_unlocked?: boolean };
      if (res.ok && data.board?.listed) {
        setBoardNote({ listed: true, url: data.board.url });
        fireNetifyEvent("board_listed", { source: "standing_action" });
      } else if (data.auth_required) {
        setListAuthNeeded(true);
      } else {
        setBoardNote({ listed: false, reason: data.error || "Board listing failed; try again." });
      }
      if (typeof data.market_unlocked === "boolean") setMarketUnlocked(data.market_unlocked);
      if (data.market_unlocked) refreshConnections();
    } catch {
      setBoardNote({ listed: false, reason: "Network error; nothing was listed. Try again." });
    } finally {
      setListingBusy(false);
    }
  }

  async function loadProject(id: string) {
    // Adopt a manage key carried in the URL (the buyer's private cross-device
    // link is /rfp-builder/{id}?manage={token}), then hide it from the bar.
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const fromUrl = sp.get("manage");
      if (fromUrl) {
        manageToken.current = fromUrl;
        try { localStorage.setItem(mtokKey(id), fromUrl); } catch { /* private mode */ }
        sp.delete("manage");
        const rest = sp.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      } else if (!manageToken.current) {
        manageToken.current = localStorage.getItem(mtokKey(id)) || "";
      }
    }
    try {
      const res = await fetch(`/sase/api/rfp/${id}`, { headers: authHeaders() });
      if (res.ok) applyProject((await res.json()) as ProjectDetails);
      else if (res.status === 401) setNotOwner(true);
      else setError("This RFP could not be loaded.");
    } catch { setError("This RFP could not be loaded."); }
  }

  /** The agent's first message. Direct discovery questions, and sector-aware:
   *  when the sector is already known (path prefill, notice carry-through) it
   *  names the regulations that usually apply and asks the buyer to confirm,
   *  per Harry's testing feedback (03/07/2026). */
  function openingMessage(buyer?: Record<string, unknown>): string {
    const sector = typeof buyer?.sector === "string" ? buyer.sector : "";
    const SECTOR_OPENERS: Record<string, { label: string; regs: string }> = {
      retail_ecommerce: { label: "retail", regs: "PCI DSS v4.0 (card payments) and UK GDPR" },
      financial_services: { label: "financial services", regs: "FCA operational resilience rules, EU DORA (if you operate in the EU) and UK GDPR" },
      healthcare: { label: "healthcare", regs: "UK GDPR and the NHS Data Security and Protection Toolkit" },
      manufacturing: { label: "manufacturing", regs: "IEC 62443 for OT/plant networks and UK GDPR" },
    };
    const s = SECTOR_OPENERS[sector];
    if (s) {
      return `Let's build your RFP. You're in ${s.label}, so ${s.regs} will likely apply. Shall I include those, and are there any other obligations I'm missing?\n\nThen tell me about your current infrastructure: what WAN, firewalls and remote access do you run today, what do you want to keep, and what's driving the change?`;
    }
    return "Let's build your RFP. Start with your current infrastructure: what WAN, firewalls and remote access do you run today, and what do you want to keep versus replace? Then your sector, rough site count, regions and any compliance obligations (for example UK GDPR, PCI DSS, IEC 62443). Once I know the sector I'll suggest the regulations that usually apply.\n\nYou can also just pick a scope and delivery model under Build it myself.";
  }

  async function startRfp(buyer?: Record<string, unknown>) {
    setCreating(true); setError(null);
    try {
      const res = await fetch("/sase/api/rfp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(buyer ? { buyer } : {}) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not start an RFP."); }
      const p = (await res.json()) as ProjectDetails;
      applyProject(p); // create returns the full token; persist it client-side
      window.history.replaceState(null, "", `/sase/rfp-builder/${p.id}`);
      setMessages([{ role: "assistant", content: openingMessage(buyer) }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start an RFP."); }
    finally { setCreating(false); }
  }

  // Prefill from the guided start (query carry-through): create the RFP with the
  // captured buyer context and drop straight into manual mode so the sections show.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || initialId) return;
    const p = new URLSearchParams(window.location.search);

    // Start from a published RFI: seed the RFP's buyer context
    // from the RFI's PUBLIC projection (data.json), so the buyer never
    // types the same estate twice. Notice scope → product_scope; regions and
    // compliance carried over; summary/environment/outcomes become notes.
    const fromOpp = p.get("from_opportunity");
    if (fromOpp && /^[A-Za-z0-9_-]+$/.test(fromOpp)) {
      prefilled.current = true;
      (async () => {
        try {
          const res = await fetch(`/sase/opportunities/${fromOpp}/data.json`);
          const data = res.ok ? ((await res.json()) as { opportunity?: Record<string, unknown> }) : {};
          const o = (data.opportunity ?? {}) as {
            scope?: string[]; buyer_sector?: string; buyer_size_band?: string; sites?: number | null;
            regions?: string[]; compliance_requirements?: string[]; summary?: string;
            current_environment?: string; desired_outcomes?: string; title?: string;
          };
          const scopeArr = o.scope ?? [];
          // A notice with no scope tags prefills as not stated (intake-truth
          // ruling, 28 Jul 2026): the builder never invents a scope the
          // notice did not carry.
          const product_scope = scopeArr.includes("sase") ? "full_sase" : scopeArr.includes("sse") ? "sse_only" : scopeArr.includes("sd_wan") ? "sdwan_only" : "not_stated";
          const buyer: Record<string, unknown> = {
            sector: o.buyer_sector || null,
            organisation_size: o.buyer_size_band === "large_global" ? "large_global_enterprise" : o.buyer_size_band === "enterprise" || o.buyer_size_band === "mid_market" ? "mid_market" : o.buyer_size_band === "small" ? "small_business" : "any",
            site_count: typeof o.sites === "number" ? o.sites : null,
            regions: (o.regions ?? []).map((r) => (r === "asia_pacific" ? "apac" : r)),
            compliance: o.compliance_requirements ?? [],
            operating_model: scopeArr.includes("managed_service") || scopeArr.includes("managed_security") ? "managed" : "any",
            product_scope,
            notes: [o.title, o.summary, o.current_environment && `Current environment: ${o.current_environment}`, o.desired_outcomes && `Desired outcomes: ${o.desired_outcomes}`, `Source: RFI ${fromOpp}`].filter(Boolean).join("\n\n"),
          };
          setMode("manual");
          startRfp(buyer);
        } catch {
          setMode("manual");
          startRfp();
        }
      })();
      return;
    }

    const prefillParam = p.get("prefill");
    if (!prefillParam) return;

    // Cost estimator handoff: ?prefill=<base64url JSON of the estimator
    // inputs> (users, sites, regions, securityDepth, deliveryModel,
    // termYears). Only fields with a matching intake field are mapped;
    // extras (termYears) are ignored. The legacy ?prefill=1 form with
    // individual query params (shortlist and sector links) is unchanged.
    if (prefillParam !== "1") {
      try {
        const b64 = prefillParam.replace(/-/g, "+").replace(/_/g, "/");
        const est = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))) as {
          users?: number;
          sites?: number;
          regions?: string[];
          securityDepth?: string;
          deliveryModel?: string;
        };
        const REGION_MAP: Record<string, string[]> = {
          "uk-europe": ["uk_ireland", "europe"],
          "north-america": ["north_america"],
          apac: ["asia_pacific"],
          "middle-east-africa": ["middle_east_africa"],
          latam: ["latin_america"],
        };
        const regions = (est.regions ?? []).flatMap((r) => REGION_MAP[r] ?? []);
        const orgSize =
          typeof est.users === "number"
            ? est.users >= 5000
              ? "large_global_enterprise"
              : est.users >= 500
                ? "mid_market"
                : "small_business"
            : "any";
        const buyer: Record<string, unknown> = {
          sector: null,
          organisation_size: orgSize,
          regions,
          compliance: [],
          operating_model:
            est.deliveryModel === "managed"
              ? "managed"
              : est.deliveryModel === "co-managed"
                ? "co_managed"
                : est.deliveryModel === "diy"
                  ? "diy"
                  : "any",
          product_scope: est.securityDepth === "sse-only" ? "sse_only" : est.securityDepth ? "full_sase" : "not_stated",
          site_count: typeof est.sites === "number" ? est.sites : null,
          notes: "Prefilled from the SASE cost estimator (Netify SASE Methodology v2026.1).",
        };
        prefilled.current = true;
        queueMicrotask(() => {
          setMode("manual");
          void startRfp(buyer);
        });
      } catch {
        /* malformed prefill payloads are ignored; the builder starts clean */
      }
      return;
    }

    prefilled.current = true;
    const buyer: Record<string, unknown> = {
      sector: p.get("sector") || null,
      organisation_size: p.get("org") || "any",
      regions: (p.get("regions") ?? "").split(".").filter(Boolean),
      compliance: (p.get("compliance") ?? "").split(".").filter(Boolean),
      operating_model: p.get("model") || "any",
      product_scope: p.get("scope") || "not_stated",
      site_count: p.get("sites") ? Number(p.get("sites")) : null,
      notes: p.get("notes") || "",
    };
    queueMicrotask(() => {
      setMode("manual");
      void startRfp(buyer);
    });
    // This prefill is a one-time mount handoff from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(updated: ProjectDetails, regenerate = false) {
    setProject(updated);
    try {
      // updated carries the manage_token from client state, which the gated PUT
      // requires; the response keeps the token (access proven), so re-apply it.
      const res = await fetch(`/sase/api/rfp/${updated.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...updated, manage_token: manageToken.current || updated.manage_token, regenerate }) });
      if (res.ok && regenerate) applyProject((await res.json()) as ProjectDetails);
      // A refused save must be loud, not silent: without this, a viewer who is
      // not the owner sees edits "work" locally and then vanish on reload.
      if (res.status === 401) {
        setError("Changes aren't saving: only this RFP's owner can edit. Sign in with the email that created it, or reopen your private builder link.");
      } else if (!res.ok) {
        // Guard refusals (409: protected content, append-only record) and
        // shape errors arrive with a message naming exactly what to restore.
        // Local state keeps every unsaved edit, so nothing is lost: fix the
        // named item and the next save carries all of it.
        const e = await res.json().catch(() => ({} as { error?: string }));
        setError(e.error ?? `This save was refused (${res.status}). Your edits are still here; adjust and try again.`);
      } else if (res.ok) {
        setError(null);
      }
    } catch { /* optimistic */ }
  }

  async function setScope(scope: ProductScope) {
    if (!project) return;
    // ask the API to regenerate by sending updated buyer; server keeps sections in sync on agent path,
    // here we PUT buyer and re-fetch a regenerated structure via the create-style synthesis on the server.
    await persist({ ...project, buyer: { ...project.buyer, product_scope: scope } }, true);
  }

  async function setModel(model: string) {
    if (!project) return;
    await persist({ ...project, buyer: { ...project.buyer, operating_model: model } }, true);
  }

  async function setSector(sector: string) {
    if (!project) return;
    await persist({ ...project, buyer: { ...project.buyer, sector: sector || null } }, true);
  }

  async function send() {
    if (!project || !prompt.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next); setPrompt(""); setBusy(true); setError(null); setElapsed(0);
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 115000);
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/agent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next, manage_token: manageToken.current || project.manage_token }), signal: ctrl.signal });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `The advisor could not respond (${res.status}).`); }
      const data = (await res.json()) as { narrative?: string; project?: ProjectDetails };
      if (data.project) applyProject(data.project); // agent response is token-stripped; re-attach
      if (data.narrative) setMessages([...next, { role: "assistant", content: data.narrative }]);
      else setMessages([...next, { role: "assistant", content: "Done. Review the sections below, or tell me what to change." }]);
    } catch (e) {
      const msg = (e instanceof Error && e.name === "AbortError")
        ? "That took too long. Try a shorter request, or use Build it myself to pick scope and questions directly."
        : (e instanceof Error ? e.message : "The advisor could not respond.");
      setError(msg);
    }
    finally { clearInterval(tick); clearTimeout(timeout); setBusy(false); }
  }

  function toggleQuestion(category: string, qid: string) {
    if (!project) return;
    const sections = project.rfp_sections.map((s) => s.category !== category ? s : {
      ...s,
      questions: s.questions.map((q) => q.id !== qid ? q : { ...q, priority: q.priority === "optional" ? ("recommended" as const) : ("optional" as const) }),
    });
    persist({ ...project, rfp_sections: sections });
  }

  function toggleMandatory(category: string, qid: string) {
    if (!project) return;
    const sections = project.rfp_sections.map((s) => s.category !== category ? s : {
      ...s, questions: s.questions.map((q) => q.id !== qid ? q : { ...q, mandatory: !q.mandatory, priority: !q.mandatory ? ("required" as const) : q.priority }),
    });
    persist({ ...project, rfp_sections: sections });
  }

  async function draftQuestion() {
    if (!project || !intent.trim() || drafting) return;
    setDrafting(true); setError(null); setDraft(null);
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/draft-question`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent, manage_token: manageToken.current || project.manage_token }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not draft."); }
      const data = (await res.json()) as { question: RfpQuestion & { category: string } };
      setDraft(data.question);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not draft."); }
    finally { setDrafting(false); }
  }

  /**
   * Insert a question, or activate the matching hidden methodology question.
   * Fixes "clicking Add no longer adds anything" (Harry's Testing 1,
   * 03/07/2026): AI research/drafted questions reuse the id q_<feature_id>,
   * and the synthesised base sections already hold that id as an invisible
   * priority-"optional" question — so the old duplicate guard silently
   * swallowed the add. Now a hidden duplicate is upgraded in place with the
   * tailored wording, a visible duplicate says where it already sits, and
   * every outcome reports itself instead of doing nothing.
   */
  function upsertQuestion(category: string, q: RfpQuestion) {
    if (!project) return;
    // Guard against unusable section names ("", "undefined") ever becoming
    // headings — the agent-tool variant of this bug reached Harry's live RFP.
    if (!category || !category.trim() || ["undefined", "null"].includes(category.trim().toLowerCase())) {
      category = "Custom requirements";
    }
    const sections = project.rfp_sections.map((s) => ({ ...s, questions: [...s.questions] }));
    // The same id can live in a different section (its methodology category), so search all of them.
    for (const s of sections) {
      const idx = s.questions.findIndex((x) => x.id === q.id);
      if (idx >= 0) {
        const existing = s.questions[idx];
        if (existing.priority === "optional") {
          s.questions[idx] = {
            ...existing,
            text: q.text || existing.text,
            evidence_requested: q.evidence_requested || existing.evidence_requested,
            rationale: q.rationale || existing.rationale,
            priority: q.priority === "optional" ? "recommended" : q.priority,
            mandatory: existing.mandatory || q.mandatory,
            weight: Math.max(existing.weight, q.weight),
            buyer_lens: q.buyer_lens || existing.buyer_lens,
            supplier_lens: q.supplier_lens || existing.supplier_lens,
          };
          s.included = true;
          persist({ ...project, rfp_sections: sections });
          flashAddMsg(`Added to "${s.category}" with your tailored wording (it covers the same ground as a library question, so the two were merged).`);
        } else {
          flashAddMsg(`Already in your RFP under "${s.category}", so it wasn't added twice.`);
        }
        return;
      }
    }
    let sec = sections.find((s) => s.category === category);
    if (!sec) { sec = { category, included: true, questions: [] }; sections.push(sec); }
    sec.included = true;
    sec.questions.push({ ...q, priority: q.priority === "optional" ? "recommended" : q.priority });
    persist({ ...project, rfp_sections: sections });
    flashAddMsg(`Added to "${category}".`);
  }

  function addDraft() {
    if (!project || !draft) return;
    const { category, ...q } = draft;
    upsertQuestion(category, q as RfpQuestion);
    setDraft(null); setIntent("");
  }

  /** Add a question the buyer wrote themselves — no AI involved. */
  function addOwnQuestion() {
    if (!project || !ownText.trim()) return;
    upsertQuestion(ownCategory, {
      id: `q_own_${Date.now().toString(36)}`,
      feature_id: "custom",
      text: ownText.trim(),
      evidence_requested: ownEvidence.trim(),
      rationale: "Buyer-written question.",
      priority: "recommended",
      source: "custom",
      mandatory: false,
      weight: 3,
    } as RfpQuestion);
    setOwnText(""); setOwnEvidence("");
  }

  async function toggleRegulation(key: string) {
    if (!project) return;
    const has = project.buyer.compliance.includes(key);
    const compliance = has ? project.buyer.compliance.filter((c) => c !== key) : [...project.buyer.compliance, key];
    await persist({ ...project, buyer: { ...project.buyer, compliance } }, true);
  }

  async function refreshCoverage() {
    if (!project) return;
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/compliance`, { headers: authHeaders() });
      // The API returns the rows array under `coverage`; older/alternative shapes
      // may use `rows`. Normalise to { rows, gaps, clauses } with array fallbacks
      // so a missing field can never crash the render (e.g. coverage.rows.filter).
      if (res.ok) {
        const d = (await res.json()) as { coverage?: CoverageRow[]; rows?: CoverageRow[]; gaps?: CoverageRow[]; clauses?: ClausePack[] };
        setCoverage({ rows: d.coverage ?? d.rows ?? [], gaps: d.gaps ?? [], clauses: d.clauses ?? [] });
      }
    } catch { /* ignore */ }
  }

  async function research() {
    if (!project || !topic.trim() || researching) return;
    setResearching(true); setError(null); setResearchSet(null);
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/research`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, count: 4, manage_token: manageToken.current || project.manage_token }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not research."); }
      setResearchSet((await res.json()) as { analysis: string; questions: (RfpQuestion & { category: string })[] });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not research."); }
    finally { setResearching(false); }
  }

  function addResearchQuestion(q: RfpQuestion & { category: string }) {
    if (!project) return;
    const { category, ...rest } = q;
    upsertQuestion(category, rest as RfpQuestion);
  }

  function addBankQuestion(category: string, q: { id: string; text: string; buyer_lens: string; supplier_lens: string }) {
    if (!project) return;
    upsertQuestion(category, { id: q.id, feature_id: "custom", text: q.text, evidence_requested: "", rationale: q.buyer_lens ? `Buyer lens: ${q.buyer_lens}` : "Netify question bank", priority: "recommended", source: "bank", buyer_lens: q.buyer_lens, supplier_lens: q.supplier_lens, mandatory: false, weight: 3 } as RfpQuestion);
  }

  /**
   * Add an extended-bank question, carrying its procurement metadata into the
   * RFP: evidence checklist, why-it-matters rationale, weighting, and
   * mandatory flag when the buyer's sector is in the question's mandatory_for.
   */
  function addExtendedQuestion(categoryLabel: string, q: ExtendedBankQuestion) {
    if (!project) return;
    const buyerSectorSlug = project.buyer.sector ? EXT_SECTOR_MAP[project.buyer.sector] ?? "" : "";
    const mandatory = Boolean(buyerSectorSlug && q.mandatory_for.includes(buyerSectorSlug));
    const weight = q.weighting_hint === "high" ? 5 : q.weighting_hint === "low" ? 2 : 3;
    upsertQuestion(categoryLabel, {
      id: q.question_id,
      feature_id: "custom",
      text: q.question,
      evidence_requested: q.evidence_required.join("; "),
      rationale: q.why_it_matters,
      priority: mandatory ? "required" : "recommended",
      source: "bank",
      buyer_lens: q.red_flag_answers.length ? `Red flags: ${q.red_flag_answers.join("; ")}` : "",
      supplier_lens: q.follow_up_questions.length ? `Likely follow-ups: ${q.follow_up_questions.join(" ")}` : "",
      mandatory,
      weight,
    } as RfpQuestion);
  }

  async function loadEvaluations() {
    if (!project) return;
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/evaluation`, { headers: authHeaders() });
      if (res.ok) setEvaluations(((await res.json()) as { evaluations: Evaluation[] }).evaluations);
    } catch { /* ignore */ }
  }

  async function refreshConnections() {
    if (!project) return;
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/connect`, { headers: authHeaders() });
      if (res.ok) setConnections(((await res.json()) as { connections: Connection[] }).connections);
    } catch { /* ignore */ }
  }

  async function suggestSuppliers() {
    // Row-8 hotfix (16 Aug 2026), amended in the market-unlock correction
    // round (16 Aug 2026): this call reveals project-specific vendor
    // matching (names + scores) for THIS project. It must never fire before
    // this project's MARKET HAS UNLOCKED (market-unlock.ts's canonical,
    // server-derived boolean) — not merely once its status has crossed the
    // publication boundary, since a board-listing failure can leave a
    // "published" project's market still locked. The button that triggers
    // this is hidden until then (see the "Vendors and service providers"
    // section below), and this guard is the defence-in-depth backstop
    // against any stale ref/race calling it anyway.
    if (!project || !marketUnlocked) return;
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/report`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json() as { matched_vendors?: { slug: string; name: string }[] | null };
        setSuggestions((data.matched_vendors ?? []).map((vendor, index) => ({ ...vendor, rank: index + 1 })));
      }
    } catch { /* ignore */ }
  }

  async function inviteSupplier(slug: string, intro: string) {
    if (!project) return;
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/connect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vendor_slug: slug, intro, manage_token: manageToken.current || project.manage_token }) });
      if (res.ok) refreshConnections();
    } catch { /* ignore */ }
  }

  async function connectAction(slug: string, action: string, body: string) {
    if (!project) return;
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/connect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vendor_slug: slug, action, body, manage_token: manageToken.current || project.manage_token }) });
      if (res.ok) { refreshConnections(); setMsgDraft({ ...msgDraft, [slug]: "" }); }
    } catch { /* ignore */ }
  }

  async function publishToCurated(source: string = "suppliers") {
    if (!project || publishing) return;
    // The verify endpoint may have already completed the submission
    // server-side (the wizard's pending_submit rides the draft and executes
    // on the magic-link click). Check before firing a second publish from
    // the sign-in resume, which would duplicate the notification emails.
    if (source === "signin_resume") {
      try {
        const r = await fetch(`/sase/api/rfp/${project.id}`, { headers: authHeaders() });
        if (r.ok) {
          const fresh = (await r.json()) as ProjectDetails;
          if (fresh.status === "published") {
            applyProject(fresh);
            try {
              localStorage.removeItem(`rfp_pending_publish_${project.id}`);
              localStorage.removeItem(`rfp_publish_opts_${project.id}`);
              sessionStorage.removeItem("netify_pending_email");
            } catch { /* ignore */ }
            setPublishAuthNeeded(false);
            setPublishMsg("Submitted. Your RFP is with your matched vendors now; their responses will appear under \"Evaluate vendor responses\" below.");
            refreshConnections();
            loadMarketReport();
            return;
          }
        }
      } catch { /* fall through to the normal publish */ }
    }
    fireNetifyEvent("publish_click", { source });
    setPublishing(true); setPublishMsg(null); setError(null); setBoardNote(null); setPublishAuthNeeded(false);
    try {
      // Wizard-submit publishes carry options set at the agreement step
      // (invite cap 5, matched suppliers only, marketing opt-in).
      let publishOpts: Record<string, unknown> = {};
      try { publishOpts = JSON.parse(localStorage.getItem(`rfp_publish_opts_${project.id}`) ?? "{}") as Record<string, unknown>; } catch { /* ignore */ }
      let res = await fetch(`/sase/api/rfp/${project.id}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ manage_token: manageToken.current || project.manage_token, ...publishOpts }) });
      let data = await res.json().catch(() => ({}));
      // D5 (approval lite): a declined approval never vetoes, but
      // publishing against it is an intentional decision, confirmed here
      // in the approver's words and recorded verbatim on the project.
      if (res.status === 409 && (data as { requires_decline_confirmation?: boolean }).requires_decline_confirmation) {
        const confirmed = window.confirm(`${String((data as { confirmation_text?: string }).confirmation_text ?? "An approver declined.")}\n\nPress OK to publish anyway; this confirmation is recorded on the permanent project record.`);
        if (!confirmed) {
          setError(String((data as { confirmation_text?: string }).confirmation_text ?? "Publication needs your explicit confirmation after the declined approval."));
          return;
        }
        res = await fetch(`/sase/api/rfp/${project.id}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ manage_token: manageToken.current || project.manage_token, ...publishOpts, acknowledge_declined_approval: true }) });
        data = await res.json().catch(() => ({}));
      }
      // Publishing requires a verified work-email sign-in on top of the
      // manage token: render the inline sign-in panel, not a dead error.
      if (res.status === 401 && (data.error === "sign_in_required" || data.auth_required)) {
        setPublishAuthNeeded(true);
        // Remember the intent so publishing resumes automatically after the
        // sign-in round trip, even if the magic link replaced this page
        // (Harry's publish-resume feedback, 06/07/2026).
        try { localStorage.setItem(`rfp_pending_publish_${project.id}`, "1"); } catch { /* ignore */ }
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not publish.");
      setProject({ ...project, status: data.status ?? "published" });
      // Market-unlock correction round: the publish response now carries
      // the canonical boolean directly (publish/route.ts) -- a board
      // failure means this stays false even though `data.status` above is
      // already "published", which is exactly the internal-published-but-
      // locked state this round exists to represent honestly in the UI.
      setMarketUnlocked(Boolean((data as { market_unlocked?: boolean }).market_unlocked));
      if (data.market_report) setMarketReport(data.market_report as MarketReportT);
      fireNetifyEvent("rfp_published", { invited: String(data.invited?.length ?? 0) });
      try {
        localStorage.removeItem(`rfp_pending_publish_${project.id}`);
        localStorage.removeItem(`rfp_publish_opts_${project.id}`);
        sessionStorage.removeItem("netify_pending_email");
      } catch { /* ignore */ }
      setPublishMsg(`Submitted to ${data.invited?.length ?? 0} matched vendors. What happens next: they appear under "Vendors and service providers" below, each with a private link (they don't need an account, they reply via that link). When they respond, their answers appear under "Evaluate vendor responses" automatically. There's no separate account or portal: this page is your dashboard, so bookmark your private link above to come back and track replies any time.`);
      if (data.board) setBoardNote(data.board as { listed: boolean; url?: string; reason?: string });
      refreshConnections();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish."); }
    finally { setPublishing(false); }
  }

  // The buyer's own way back in. There is no account: this page (the RFP id URL,
  // with the manage token held in localStorage) is the buyer's dashboard, so we
  // surface it as a copyable, bookmarkable link.
  // NB: every absolute URL built here MUST include the /sase basePath —
  // window.location.origin alone produces netify.co.uk/rfp-builder/…, which is
  // the MAIN site and 404s (bug found by Harry, 2026-07-02).
  function copyManageLink() {
    if (!project) return;
    // The private link carries the manage key so it works from any device or
    // browser. Without the key, the workspace read is refused (owner-only).
    const key = manageToken.current || project.manage_token || "";
    navigator.clipboard.writeText(`${window.location.origin}/sase/rfp-builder/${project.id}${key ? `?manage=${key}` : ""}`);
    setManageCopied(true); setTimeout(() => setManageCopied(false), 2000);
  }

  /** Email the buyer their private draft link (the email-link capture route). */
  async function emailDraftLink() {
    if (!project || !draftEmail.trim() || emailingLink) return;
    setEmailingLink(true); setDraftLinkNote(null);
    try {
      const res = await fetch(`/sase/api/rfp/${project.id}/email-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: draftEmail.trim(), manage_token: manageToken.current || project.manage_token }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send the link.");
      setDraftLinkNote(data.emailed ? "Sent. Your report and private draft link are on their way to your inbox." : "Saved, but email sending is not configured; use Copy my link instead.");
      fireNetifyEvent("draft_claimed", {});
      setDraftEmail("");
    } catch (e) { setDraftLinkNote(e instanceof Error ? e.message : "Could not send the link."); }
    finally { setEmailingLink(false); }
  }

  function copySupplierLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/sase/rfp-builder/supplier/${token}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Export runs through the gated document flow: the preview download route
   * requires a signed-in owner, so the old client-side Blob export (which
   * bypassed that gate) is gone. Signed-in owners go straight to the .md
   * download; signed-out owners land on the preview page's sign-in panel.
   */
  async function exportDocument() {
    if (!project) return;
    const qs = manageToken.current ? `?manage=${manageToken.current}` : "";
    try {
      const r = await fetch("/sase/api/auth/session");
      const d = r.ok ? ((await r.json()) as { authenticated?: boolean }) : { authenticated: false };
      if (d.authenticated) { window.location.href = `/sase/rfp-builder/${project.id}/preview/download${qs}`; return; }
    } catch { /* fall through to the gated preview page */ }
    window.location.href = `/sase/rfp-builder/${project.id}/preview${qs}`;
  }

  async function copyShare() {
    if (!project) return;
    const url = `${window.location.origin}/sase/rfp-builder/${project.id}/respond?token=${project.share_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const activeCount = useMemo(() => project ? project.rfp_sections.reduce((n, s) => n + (s.included ? s.questions.filter((q) => q.priority !== "optional").length : 0), 0) : 0, [project]);

  // Owner links to the server-rendered preview/review pages carry the manage
  // key, so the anonymous-owner flow works across those (owner-gated) pages.
  const keyQs = manageToken.current ? `?manage=${manageToken.current}` : "";

  if (notOwner) {
    return (
      <div className="rounded-2xl border border-[var(--ink-900)] p-8 max-w-2xl">
        <p className="eyebrow mb-2">Private workspace</p>
        <h2 className="text-xl mb-2">This RFP belongs to another buyer</h2>
        <p className="text-sm text-[var(--ink-700)] mb-4">
          The builder is the buyer&apos;s private workspace: only the person who created this RFP can read or edit it here.
        </p>
        <ul className="list-disc pl-5 text-sm text-[var(--ink-700)] space-y-1.5 mb-5">
          <li><strong>Invited to respond as a vendor?</strong> Use the response link from your invitation (it ends <code>/respond?token=…</code>). That page shows you the RFP and takes your answers.</li>
          <li><strong>Is this your RFP?</strong> Sign in below with the email you used when you created it, or reopen the private builder link you bookmarked (it carries your key).</li>
        </ul>
        <div className="mb-5"><SignIn role="buyer" prompt="Sign in with the email that created this RFP." /></div>
        <p className="text-sm"><a href="https://netify.co.uk/" className="underline">Or start your own RFP</a></p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-[var(--ink-900)] p-8">
        <h2 className="text-xl mb-2">Start your RFP</h2>
        <p className="text-[var(--ink-700)] mb-5 max-w-2xl">
          An <strong>RFP</strong> (request for proposal) is the set of questions you send to vendors and service providers so you can compare them fairly. This tool helps you write one for SASE, SSE or SD-WAN, invite the right ones, and compare their replies. It takes about four steps:
        </p>
        <div className="grid sm:grid-cols-4 gap-3 mb-6 max-w-3xl">
          {[
            ["1. Describe", "Your sector, number of sites, regions and any rules you must meet."],
            ["2. Build questions", "We draft them for you. Add or remove any you like."],
            ["3. Invite vendors", "Send your RFP to the best-fit vendors in one click."],
            ["4. Compare replies", "We flag any answers that need a closer look."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3">
              <p className="text-sm font-medium">{t}</p>
              <p className="text-xs text-[var(--ink-600,#555)] mt-0.5">{d}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-[var(--ink-600,#555)] mb-5 max-w-2xl">
          Two ways to build it, and you can switch between them at any time: <strong>AI agent</strong> (chat in plain English and it writes the RFP for you) or <strong>Build it myself</strong> (pick the questions by hand, with AI help when you want it). Nothing is sent to any vendor until you choose to invite them.
        </p>
        <button onClick={() => startRfp()} disabled={creating} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
          {creating ? "Starting..." : "Start my RFP"}
        </button>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <div className="mt-6 pt-5 border-t border-[var(--ink-200,#e5e5e5)] max-w-2xl">
          <p className="text-sm font-medium mb-1">Not ready for a full RFP?</p>
          <p className="text-sm text-[var(--ink-600,#555)]">
            Do what an RFI does, the marketplace way: post a short RFI describing your need, gather vendor
            interest, information and indicative pricing, then turn the RFI into a full RFP when you&apos;re ready.{" "}
            <a href="/sase/opportunities/new/" className="underline">Publish an RFI instead</a>.
          </p>
        </div>
      </div>
    );
  }

  // Counts must match the DRAFT chip exactly (Harry, 14 July: banner said 40
  // questions while the chip said 12). Active = included sections, questions
  // above the invisible "optional" pool; sections = those with active content.
  const includedSections = project.rfp_sections.filter((s) => s.included && s.questions.some((q) => q.priority !== "optional"));
  const includedQuestionCount = activeCount;

  // Walkthrough strip: where the buyer is and what happens next, from real
  // state. Draft or review = reviewing the document with publish ahead;
  // published and beyond = responses arriving.
  // Row-8 hotfix (16 Aug 2026): this used to re-derive the same boolean
  // locally (`status !== "draft" && status !== "review"`), a parallel
  // reimplementation of the canonical predicate in project-machine.ts that
  // happened to agree with it only because RfpStatus currently has exactly
  // five values.
  //
  // Market-unlock correction round (16 Aug 2026): `hasPublished()` was
  // itself then found to be the WRONG boundary for this variable's actual
  // job — everything below keyed off `published` (the vendor panel, the
  // "your RFP is live" messaging, invite/message actions, the market
  // report reveal) describes what a buyer's MARKET has actually done, not
  // merely what this project's internal status field says. A project can
  // satisfy `hasPublished(project.status)` while its board listing failed
  // and no supplier was ever invited — the exact state the checkpoint
  // evidence (`reports/row8-repro/after-fix-vendor-panel-post-publish.png`)
  // showed: "Not on the public board yet" alongside a real named invited
  // vendor, because this variable used to read `hasPublished()` alone. It
  // now reads the canonical, server-derived `marketUnlocked` state instead
  // (market-unlock.ts, threaded through applyProject() above and every
  // publish/list-on-board response) — the single "has this project's
  // market actually unlocked" question the whole panel now asks the same
  // way, matching every server-side route governed by the same rule.
  const published = marketUnlocked;
  // Market-unlock correction round 2 (16 Aug 2026), requirement 5: the
  // third lifecycle state the panel must distinguish honestly -- a
  // publication was genuinely attempted (boardNote exists, from the
  // effect above) but the market has not unlocked. Never the same as "not
  // yet attempted" (boardNote stays null/undefined until the server
  // confirms `publication_attempted`), and never the same as `published`.
  const publicationLocked = !published && boardNote != null;
  const stripStage: FlowStage = published ? "responses" : "review";
  const stripNow = published
    ? `Your RFP is live. ${connections.length > 0 ? `${connections.length} invited vendor${connections.length === 1 ? "" : "s"} hold` : "Invited vendors hold"} private response links, and replies land on this page.`
    : `You are reviewing your draft RFP: ${includedQuestionCount} questions across ${includedSections.length} sections. Add, remove or reword anything.`;
  const stripNext = published
    ? "Responses are scored against your questions under Evaluate vendor responses below. We also email you when activity arrives."
    : publicationLocked
      ? "finish publishing this opportunity, so matched vendors can respond. Nothing is shared until publication completes."
      : "publish this opportunity, so matched vendors can respond. Nothing is shared until you press publish in the panel below.";

  return (
    <div className={!published && !stickyGone ? "pb-16" : undefined}>
      {/* Phase D1: the Project is the navigation root; the builder is one
          surface inside it. Breadcrumb back to the container. */}
      {project && (() => {
        const homeTok = manageToken.current || project.manage_token || "";
        return (
          <p className="mb-2 text-xs">
            <a
              href={`/sase/project/${project.id}${homeTok ? `?manage=${encodeURIComponent(homeTok)}` : ""}`}
              className="text-[var(--ink-600,#555)] underline hover:text-[var(--ink-900,#111)]"
            >
              ← Project home
            </a>
          </p>
        );
      })()}
      <FlowStageStrip stage={stripStage} now={stripNow} next={stripNext} numberNext={!published} />
      {/* Sign-in confirmation strip: persists after the verify redirect so
          the buyer sees what happened (session, claimed drafts, next step). */}
      {signinNote !== null && (
        <div className="mb-6 rounded-sm border border-emerald-300 bg-emerald-50 p-3 text-sm text-[var(--ink-800)]">
          <strong>You are signed in.</strong>{" "}
          {signinNote > 0
            ? (signinNote === 1 ? "Your draft RFP is saved to your account." : `${signinNote} draft RFPs are saved to your account.`)
            : "Your work here saves to your account."}{" "}
          {published
            ? "This RFP is published; vendor responses appear below as they arrive."
            : publicationLocked
              ? "Publication has not completed yet; finish it below to invite your matched vendors."
              : "When you are ready, publish below to invite your matched vendors."}
          <button onClick={() => setSigninNote(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Generate moment: the Describe wizard hands off here. Document-first
          framing so the buyer reviews and trims rather than builds. */}
      {generatedWelcome && (
        <div className="mb-6 rounded-sm border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-base font-semibold mb-1">Here is your RFP: {project.title}</p>
          <p className="text-sm text-[var(--ink-700)] mb-3">
            {includedQuestionCount} questions across {includedSections.length} sections, assembled from the Netify
            question bank (Methodology v{project.methodology_version}) around what you described. Review and trim
            anything below, then choose who sees it. Nothing reaches a vendor until you publish or invite them.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href="#publish" onClick={() => setGeneratedWelcome(false)} className="inline-flex items-center px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full no-underline hover:bg-amber-400 transition-colors">Publish opportunity</a>
            <button onClick={() => setGeneratedWelcome(false)} className="text-sm underline text-[var(--ink-600,#555)]">Review first</button>
          </div>
        </div>
      )}

      {/* Publish panel: the one conversion moment on this page. States the
          benefit plainly, quotes the live match count, carries the sign-in
          when the server asks for one, and flips to a confirmation once the
          RFP is live. */}
      <section id="publish" ref={publishPanelRef} className={`mb-6 rounded-sm border p-4 ${published ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        {published ? (
          <div>
            <p className="text-base font-semibold mb-1">Published. Your RFP is with your vendors now.</p>
            <p className="text-sm text-[var(--ink-700)]">
              {connections.length > 0 ? `${connections.filter((c) => c.viewed_at).length} of ${connections.length} vendors have viewed your RFP.` : "Invited vendors hold private response links."}{" "}
              {project.response_deadline ? `Responses close ${new Date(project.response_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} (${Math.max(0, Math.ceil((project.response_deadline - Date.now()) / 86400000))} days left). ` : ""}
              Structured responses land on this page and are scored under Evaluate vendor responses below. We email you when activity arrives, and you can invite more at any time under Vendors and service providers.
            </p>
            {/* The Market Report: the instant publish reward (18 July 2026).
                Price band from the TCO methodology with its assumptions
                stated, gaps as facts about the document, and the document
                downloads the buyer can circulate internally. */}
            {marketReport && !hasPublished(project.status) && (
              <div className="mt-3 rounded-sm border border-amber-300 bg-white p-4">
                <p className="text-sm font-semibold mb-1">Your Market Report preview</p>
                <p className="text-sm text-[var(--ink-800)] mb-1">
                  <strong>{marketReport.matched.count} matched vendor{marketReport.matched.count === 1 ? "" : "s"}</strong> on the marketplace for this project
                  {marketReport.matched.names.length > 0 ? <> including {marketReport.matched.names.join(", ")}</> : null}.
                </p>
                {marketReport.estimate && (
                  <p className="text-sm text-[var(--ink-800)] mb-1">
                    Indicative market band: <strong>{fmtBand(marketReport.estimate.monthly_band_gbp)} per month</strong>
                    {" · "}3-year TCO <strong>{fmtBand(marketReport.estimate.three_year_tco_band_gbp)}</strong>
                  </p>
                )}
                {marketReport.gaps.length > 0 && (
                  <p className="text-xs text-[var(--ink-600,#555)] mb-2">Gap check: {marketReport.gaps[0]}</p>
                )}
                <p className="text-xs text-[var(--ink-500)] mb-2">The full vendor list, complete gap detail, your document as Word and PDF, and delivery to them unlock when you publish. Publishing is free.</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} type="email" placeholder="you@company.com" className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm" />
                  <button onClick={emailDraftLink} disabled={emailingLink || !draftEmail.trim()} className="px-3 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">{emailingLink ? "Sending..." : "Email me this report and my draft link"}</button>
                  {draftLinkNote && <span className="text-xs text-[var(--ink-600,#555)] basis-full">{draftLinkNote}</span>}
                </div>
              </div>
            )}
            {marketReport && hasPublished(project.status) && (
              <div className="mt-3 rounded-sm border border-emerald-300 bg-white p-4">
                <p className="text-sm font-semibold mb-2">Your Netify Market Report</p>
                {marketReport.estimate && (
                  <p className="text-sm text-[var(--ink-800)] mb-1">
                    Indicative market price band: <strong>{fmtBand(marketReport.estimate.monthly_band_gbp)} per month</strong>
                    {" · "}3-year TCO <strong>{fmtBand(marketReport.estimate.three_year_tco_band_gbp)}</strong>
                    <span className="text-xs text-[var(--ink-500)]"> (Netify TCO Methodology {marketReport.estimate.methodology_version}; a modelled band from your estate profile, not a quote, and vendor responses give you the real numbers)</span>
                  </p>
                )}
                {marketReport.assumptions.length > 0 && (
                  <p className="text-xs text-[var(--ink-500)] mb-2">Band assumptions: {marketReport.assumptions.join(" ")}</p>
                )}
                {marketReport.gaps.length > 0 && (
                  <div className="mb-2 text-sm">
                    <p className="font-medium mb-0.5">Gaps worth closing (edit below any time; vendors always see the latest version):</p>
                    <ul className="list-disc list-inside space-y-0.5 text-[var(--ink-700)]">
                      {marketReport.gaps.map((g) => <li key={g}>{g}</li>)}
                    </ul>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a href={`/sase/rfp-builder/${project.id}/preview/download?format=doc${manageToken.current ? `&manage=${manageToken.current}` : ""}`} className="inline-flex items-center rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 no-underline hover:bg-amber-400 transition-colors">Download as Word</a>
                  <a href={`/sase/rfp-builder/${project.id}/preview/download?format=print${manageToken.current ? `&manage=${manageToken.current}` : ""}`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] bg-white px-4 py-1.5 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)] transition-colors">Print / save as PDF</a>
                  <a href={`/sase/rfp-builder/${project.id}/preview/download${manageToken.current ? `?manage=${manageToken.current}` : ""}`} className="text-xs underline text-[var(--ink-600,#555)]">Markdown</a>
                </div>
                {/* One truth for the human layer (29 Jul 2026): stored
                    reports carry whatever note they published with, some
                    of them the retired analyst-review claim, so the
                    display reads the current constant, never the payload. */}
                <p className="mt-2 text-xs text-[var(--ink-600,#555)]">{FOLLOW_UP_NOTE}</p>
              </div>
            )}
          </div>
        ) : publicationLocked ? (
          // Market-unlock correction round 2 (16 Aug 2026), requirement 5:
          // the third lifecycle state -- a publication was attempted but
          // has not completed. Distinct from BOTH `published` (above) and
          // the never-attempted default panel (below): must not say
          // "submitted" or "your RFP is with your vendors", must explain
          // plainly that nothing has unlocked, and must offer the retry
          // action, not a fresh "Publish opportunity" invitation (this
          // project already has a real, in-progress attempt to resume).
          <div>
            <p className="eyebrow mb-1.5">Publication incomplete</p>
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug mb-2">
              Your requirement has not gone out yet
            </h2>
            <p className="text-sm text-[var(--ink-700)] mb-3">
              {publicationLockedReason ?? boardNote?.reason ?? "Publishing this requirement as a public opportunity on the Opportunities Board hasn't completed yet."} No vendor has been invited, no vendor identity or matching has unlocked, and nothing has been shared. Your draft is exactly as you left it; try publication again below.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={listOnBoardNow} disabled={listingBusy} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
                {listingBusy ? "Publishing…" : "Try publication again"}
              </button>
            </div>
            {listAuthNeeded && (
              <div className="mt-3 rounded-sm border border-amber-400 bg-white p-3 text-sm text-[var(--ink-800)]">
                <p className="mb-2">Publishing reaches verified vendors, so it needs your signed-in work email first.</p>
                <SignIn role="buyer" prompt="Sign in with your work email, then try publication again." />
              </div>
            )}
          </div>
        ) : submitFlow && publishAuthNeeded ? (
          <div>
            <p className="eyebrow mb-1.5">Final step</p>
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug mb-2">
              Almost done: confirm publication
            </h2>
            <p className="text-sm text-[var(--ink-700)] mb-3">
              Click the link we emailed{pendingEmail ? ` to ${pendingEmail}` : " you"} and your RFP is published as a public
              opportunity and goes to your matched vendors automatically, exactly as you agreed. Wrong address, or no email after a minute? Use the form below.
            </p>
            <SignIn role="buyer" prompt="Sign in with your work email to complete publication." />
            <CodeEntry defaultEmail={pendingEmail} onVerified={() => publishToCurated("signin_resume")} />
            {publishMsg && <p className="mt-2 text-sm text-emerald-700">{publishMsg}</p>}
          </div>
        ) : includedQuestionCount === 0 ? (
          /* Honest empty state (Harry's QA, RFP Builder F1/F2): the panel
             used to pitch "22 matched suppliers fit what you described" and
             offer a live Submit against an RFP with zero questions. Nothing
             is matched against nothing; the submit step unlocks with content,
             and the server refuses regardless. */
          <div>
            <p className="eyebrow mb-1.5">Next step</p>
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug mb-2">Give your RFP content before it goes anywhere</h2>
            <p className="text-sm text-[var(--ink-700)] mb-2">
              This RFP has no questions yet, so there is nothing for vendors to respond to and submission stays
              locked. Set what you know in step 1 and the agent generates your question set; your matched vendors
              appear here once the RFP has content.
            </p>
            <p className="text-xs text-[var(--ink-600,#555)]">
              Prefer the guided route? <a href="/sase/rfp-builder/new/" className="underline">Start from the two-minute brief</a>.
            </p>
          </div>
        ) : (
          <div>
            <p className="eyebrow mb-1.5">Next step</p>
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug mb-2">
              Publish this opportunity
            </h2>
            <p className="text-sm text-[var(--ink-700)] mb-2">
              Publishing lists this requirement as a public opportunity on the Opportunities Board, which is what
              unlocks the market: competing bids and structured responses from {matchInfo && matchInfo.total > 0 ? `the marketplace's ${matchInfo.total} ` : ""}verified vendors and managed service providers, without speaking to a single salesperson. Nothing about your company, your matches, or any vendor identity is shared until publication completes. They never see your email or phone number, and your data is only shared with a vetted account manager from each vendor or managed service provider. Every conversation starts in this app, on your terms, only when you choose.
            </p>
            <p className="mb-3 flex flex-wrap gap-1.5 text-xs">
              {["Indicative pricing, private to you", "Demo requests", "Proof-of-concept scoping", "Message vendors and managed providers in-app", "Evidence, documents and PDF collateral", "Sales and account contact, when you choose", "Independent response scoring"].map((c) => (
                <span key={c} className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[var(--ink-700)]">{c}</span>
              ))}
            </p>
            <ol className="text-sm text-[var(--ink-700)] mb-3 space-y-1 list-decimal list-inside">
              <li><strong>Publish.</strong> Your RFP is listed as a public opportunity on the Opportunities Board and each matched vendor gets a private link to your {includedQuestionCount} questions. Until then, your RFP is invisible to the market and nothing has been shared.</li>
              <li><strong>Responses arrive here.</strong> Structured, comparable answers with pricing kept private to you.</li>
              <li><strong>Compare and choose.</strong> Replies are scored against your questions; message vendors, request demos, collateral or a proof of concept from this page.</li>
            </ol>
            {publishAuthNeeded && (
              <div className="mb-3 rounded-sm border border-amber-400 bg-white p-3 text-sm text-[var(--ink-800)]">
                <p className="mb-2"><strong>One step before your RFP goes out.</strong> Publishing sends this RFP to vendors and service providers, so it needs a verified work email. Sign in and publication continues automatically. Your draft is exactly as you left it.</p>
                <SignIn role="buyer" prompt="Sign in with your work email to publish this opportunity." />
                <CodeEntry defaultEmail={pendingEmail} onVerified={() => publishToCurated("signin_resume")} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => publishToCurated("panel")} disabled={publishing} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
                {publishing ? "Publishing..." : "Publish opportunity"}
              </button>
              <span className="text-xs text-[var(--ink-600,#555)]">Free, no obligation to award, nothing shared until you press it. <a href="https://netify.co.uk/how-netify-makes-money/" className="underline">How Netify makes money</a>. Prefer control? <a href="#suppliers" className="underline">Invite vendors one at a time</a>.</span>
            </div>
            {publishMsg && <p className="mt-2 text-sm text-emerald-700">{publishMsg}</p>}
          </div>
        )}
      </section>

      {/* The FlowStageStrip above carries orientation (where you are, what
          happens next) from live state, replacing the old static "How this
          works" box. One line of reassurance stays. */}
      <p className="mb-4 text-xs text-[var(--ink-500)]">Everything saves automatically as you go. Nothing reaches a vendor until you publish or invite them.</p>

      <p className="eyebrow mb-2">Step 1: the basics</p>
      <p className="-mt-1 mb-3 text-xs text-[var(--ink-500)]">All optional. Set what you know; the AI agent fills in the rest as you chat, and you can change any of it later.</p>
      {/* Top bar: scope, model, mode, lifecycle */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6 pb-5 border-b border-[var(--ink-300,#ccc)]">
        <div>
          <p className="eyebrow mb-1">What are you buying?</p>
          <select
            value={scopeToProduct(project.buyer.product_scope)}
            onChange={(e) => setScope(productToScope(e.target.value, project.buyer.product_scope))}
            className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm bg-white"
          >
            {SCOPE_PRODUCTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        {scopeToProduct(project.buyer.product_scope) === "sase" && (
          <div>
            <p className="eyebrow mb-1">Vendor approach</p>
            <select
              value={project.buyer.product_scope}
              onChange={(e) => setScope(e.target.value as ProductScope)}
              className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm bg-white"
            >
              {SASE_APPROACHES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <p className="eyebrow mb-1">Delivery model</p>
          <select value={project.buyer.operating_model} onChange={(e) => setModel(e.target.value)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm bg-white">
            {MODELS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <p className="eyebrow mb-1">Sector</p>
          <select value={project.buyer.sector ?? ""} onChange={(e) => setSector(e.target.value)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm bg-white">
            {SECTORS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            {/* Preserve a sector the agent captured outside the preset list */}
            {project.buyer.sector && !SECTORS.some((s) => s.key === project.buyer.sector) && (
              <option value={project.buyer.sector}>{project.buyer.sector.replace(/_/g, " ")}</option>
            )}
          </select>
        </div>
        <div className="w-full order-last basis-full">
          <p className="eyebrow mb-1">Compliance and regulation</p>
          <div className="flex flex-wrap gap-2">
            {REGULATIONS.map((r) => {
              const on = project.buyer.compliance.includes(r.key);
              return (
                <button key={r.key} onClick={() => toggleRegulation(r.key)} className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${on ? "bg-amber-500 border-amber-500 text-zinc-950 font-medium" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}>
                  {r.label}
                </button>
              );
            })}
          </div>
          {/* Regimes carried from the security assessment that sit outside
              this builder's own list (Harry's retest NF2): they used to
              vanish from the chips and make Coverage read "0/0" as if
              nothing was picked up. They are shown here explicitly; the
              generated security sections carry their obligations. */}
          {project.buyer.compliance.some((c) => !REGULATIONS.some((r) => r.key === c)) && (
            <p className="mt-2 text-xs text-[var(--ink-600,#555)]">
              Carried from your security assessment:{" "}
              <strong>{project.buyer.compliance.filter((c) => !REGULATIONS.some((r) => r.key === c)).map((c) => securityCodeLabel(c)).join(", ")}</strong>
              {" "}(addressed by your generated security sections).
            </p>
          )}
          {coverage && project.buyer.compliance.length > 0 && (
            <div className="mt-2 text-xs text-[var(--ink-600,#555)]">
              Coverage: {coverage.rows.filter((r) => r.covered).length}/{coverage.rows.length} obligations have an active question.
              {coverage.gaps.length > 0 && <span className="text-amber-700"> {coverage.gaps.length} gap{coverage.gaps.length > 1 ? "s" : ""}: ask the AI agent to close them, or add the relevant questions.</span>}
              {coverage.clauses.length > 0 && <span> {coverage.clauses.reduce((n, c) => n + c.clauses.length, 0)} contractual clauses included in export.</span>}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--ink-500)] uppercase tracking-wide">{project.status} · {activeCount} questions</span>
          <a href={`/sase/rfp-builder/${project.id}/preview${keyQs}`} className="px-3 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors no-underline">Preview &amp; download</a>
          <a href={`/sase/rfp-builder/${project.id}/review${keyQs}`} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors no-underline">Agent review</a>
          <button onClick={exportDocument} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Export</button>
          <button onClick={copyShare} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">{copied ? "Copied" : "Response link"}</button>
        </div>
      </div>

      <p className="eyebrow mb-2">Step 2: build your questions</p>
      <div className="flex gap-2 mb-1">
        <button onClick={() => setMode("agent")} className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${mode === "agent" ? "bg-amber-500 border-amber-500 text-zinc-950 font-medium" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}>AI agent</button>
        <button onClick={() => setMode("manual")} className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${mode === "manual" ? "bg-amber-500 border-amber-500 text-zinc-950 font-medium" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}>Build it myself</button>
      </div>
      <p className="text-xs text-[var(--ink-500)] mb-6">{mode === "agent" ? "Chat in plain English and the assistant writes and edits your RFP for you. You can switch to Build it myself at any time, your work is kept." : "Pick questions by hand from the researched libraries, with AI help when you want it. You can switch to AI agent at any time, your work is kept."}</p>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: agent or library depending on mode */}
        {mode === "agent" ? (
          <div className="flex flex-col">
            <p className="eyebrow mb-2">Talk to the AI agent</p>
            <p className="text-xs text-[var(--ink-500)] mb-2">Describe your needs in plain English. The agent writes and edits the questions, which appear in your RFP on the right.</p>
            <div ref={scroller} className="flex-1 max-h-[26rem] overflow-y-auto space-y-3 border border-[var(--ink-300,#ccc)] rounded-sm p-4 bg-white">
              {/* Chat bubbles: labelled and visually distinct per speaker —
                  the old thin accent border read as "a block of text" and
                  didn't separate agent from buyer (Harry's Testing 1). */}
              {messages.map((m, i) => (
                m.role === "user" ? (
                  <div key={i} className="ml-8 rounded-lg rounded-tr-none border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">You</p>
                    <p className="text-sm whitespace-pre-wrap text-[var(--ink-800)] m-0">{m.content}</p>
                  </div>
                ) : (
                  <div key={i} className="mr-8 rounded-lg rounded-tl-none border border-[var(--ink-200,#e5e5e5)] bg-white px-3 py-2">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-500)]">Netify agent</p>
                    <p className="text-sm whitespace-pre-wrap text-[var(--ink-800)] m-0">{m.content}</p>
                  </div>
                )
              ))}
              {busy && <p className="text-sm text-[var(--ink-500)]">Drafting your RFP: synthesising requirements and building sections. This usually takes 20 to 40 seconds{elapsed > 0 ? ` (${elapsed}s)` : ""}.</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder="Example: healthcare, 40 UK sites, ZTNA and DLP, fully managed. Make it more cloud-security focused." className="flex-1 border border-[var(--ink-300,#ccc)] rounded-sm p-3 text-sm" />
              <button onClick={send} disabled={busy || !prompt.trim()} className="px-4 py-2 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50 self-end">Send</button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="eyebrow">Pick your questions</p>
            <p className="text-xs text-[var(--ink-500)] -mt-3">Add questions from any of these, in any order. Each one you add appears in your RFP on the right. Hand-pick from the Netify question bank and the methodology library, write your own, or bring in the AI research tool when you want it.</p>
            {addMsg && <p className="rounded-sm border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{addMsg}</p>}
            {/* Netify question bank browser */}
            {bank && (
              <div className="border border-[var(--ink-300,#ccc)] rounded-sm p-4">
                <button onClick={() => setBankOpen(!bankOpen)} className="w-full flex items-center justify-between text-left">
                  <span className="eyebrow">Netify question bank (v{bank.version})</span>
                  <span aria-hidden="true">{bankOpen ? "−" : "+"}</span>
                </button>
                <p className="text-xs text-[var(--ink-500)] mt-1">Analyst-written questions with buyer and vendor lenses. The matching sector pack is suggested first; the SASE canonical bank below carries evidence checklists, weighting and red-flag answers for each question.</p>
                {bankOpen && (
                  <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                    {project.buyer.sector && bank.sector_packs[project.buyer.sector] && (
                      <div>
                        <p className="text-sm font-medium text-amber-700 mb-1">{bank.sector_packs[project.buyer.sector].label} pack (your sector)</p>
                        {bank.sector_packs[project.buyer.sector].sections.map((sec) => (
                          <details key={sec.title} className="border border-[var(--ink-200,#e5e5e5)] rounded-sm mb-1">
                            <summary className="px-3 py-1.5 text-sm cursor-pointer">{sec.title} ({sec.questions.length})</summary>
                            <div className="px-3 pb-2 space-y-2">
                              {sec.questions.map((q) => (
                                <div key={q.id} className="text-sm border-b border-[var(--ink-100,#f1f1f1)] pb-2">
                                  <p>{q.text}</p>
                                  {q.buyer_lens && <p className="text-xs text-[var(--ink-500)] mt-0.5">Buyer: {q.buyer_lens}</p>}
                                  {q.supplier_lens && <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-0.5">Vendor: {q.supplier_lens}</p>}
                                  <button onClick={() => addBankQuestion(sec.title, q)} className="mt-1 px-2.5 py-1 text-xs border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Add</button>
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                    {bank.sase_extended ? (
                      /* Extended SASE canonical bank: grouped by category with
                         evidence, weighting, red flags and follow-ups. */
                      Object.entries(
                        bank.sase_extended.questions.reduce<Record<string, ExtendedBankQuestion[]>>((acc, q) => {
                          (acc[q.category_id] = acc[q.category_id] ?? []).push(q);
                          return acc;
                        }, {}),
                      ).map(([catId, qs]) => {
                        const label = bank.sase_extended?.category_labels[catId] ?? catId;
                        const buyerSectorSlug = project.buyer.sector ? EXT_SECTOR_MAP[project.buyer.sector] ?? "" : "";
                        return (
                          <details key={catId} className="border border-[var(--ink-200,#e5e5e5)] rounded-sm">
                            <summary className="px-3 py-1.5 text-sm font-medium cursor-pointer">{label} ({qs.length})</summary>
                            <div className="px-3 pb-2 space-y-3">
                              {qs.map((q) => {
                                const mandatoryHere = Boolean(buyerSectorSlug && q.mandatory_for.includes(buyerSectorSlug));
                                return (
                                  <div key={q.question_id} className="text-sm border-b border-[var(--ink-100,#f1f1f1)] pb-2">
                                    <p className="flex flex-wrap items-center gap-1.5">
                                      <span className={`rounded-full px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide ${q.weighting_hint === "high" ? "bg-amber-100 text-amber-800" : "bg-[var(--ink-100,#f0f0f0)] text-[var(--ink-500)]"}`}>{q.weighting_hint}</span>
                                      {mandatoryHere && <span className="rounded-full bg-red-50 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-red-700">Mandatory for your sector</span>}
                                    </p>
                                    <p className="mt-1">{q.question}</p>
                                    <p className="text-xs text-[var(--ink-500)] mt-0.5">{q.why_it_matters}</p>
                                    {q.evidence_required.length > 0 && (
                                      <p className="text-xs text-[var(--ink-600)] mt-0.5">Evidence: {q.evidence_required.join("; ")}</p>
                                    )}
                                    {q.red_flag_answers.length > 0 && (
                                      <p className="text-xs text-red-700 mt-0.5">Red flags: {q.red_flag_answers.join("; ")}</p>
                                    )}
                                    <button onClick={() => addExtendedQuestion(label, q)} className="mt-1 px-2.5 py-1 text-xs border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Add with evidence checklist</button>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        );
                      })
                    ) : (
                      <details className="border border-[var(--ink-200,#e5e5e5)] rounded-sm">
                        <summary className="px-3 py-1.5 text-sm font-medium cursor-pointer">SASE canonical set ({bank.canonical.length})</summary>
                        <div className="px-3 pb-2 space-y-2">
                          {bank.canonical.map((q) => (
                            <div key={q.id} className="text-sm border-b border-[var(--ink-100,#f1f1f1)] pb-2">
                              <p><span className="text-xs uppercase text-[var(--ink-400,#9ca3af)] mr-1">{q.category}</span>{q.text}</p>
                              <button onClick={() => addBankQuestion(q.category, { id: q.id, text: q.text, buyer_lens: "", supplier_lens: "" })} className="mt-1 px-2.5 py-1 text-xs border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Add</button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Write your own question — no AI required, AI drafting optional */}
            <div className="border border-[var(--ink-900)] rounded-sm p-4">
              <p className="eyebrow mb-2">Write your own question</p>
              <p className="text-xs text-[var(--ink-500)] mb-2">Type it exactly as you want vendors to see it. No AI involved unless you ask for a draft below.</p>
              <textarea value={ownText} onChange={(e) => setOwnText(e.target.value)} rows={2} placeholder="Your question, e.g. Describe how you would migrate our 12 warehouse sites with no downtime during trading hours." className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={ownEvidence} onChange={(e) => setOwnEvidence(e.target.value)} placeholder="Evidence to request (optional)" className="flex-1 min-w-[12rem] border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
                <select value={ownCategory} onChange={(e) => setOwnCategory(e.target.value)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm bg-white">
                  {Array.from(new Set(["Custom requirements", ...project.rfp_sections.map((s) => s.category)]))
                    .filter((c) => c && c.trim() && !["undefined", "null"].includes(c.trim().toLowerCase()))
                    .map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={addOwnQuestion} disabled={!ownText.trim()} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">Add to RFP</button>
              </div>
              <div className="mt-3 border-t border-[var(--ink-200,#e5e5e5)] pt-3">
                <p className="text-xs text-[var(--ink-500)] mb-2">Prefer a hand? Describe the intent and the AI drafts a well-formed version with evidence and methodology mapping, for you to review before adding.</p>
                <textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={2} placeholder="e.g. how they isolate unmanaged contractor laptops on the plant network." className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
                <button onClick={draftQuestion} disabled={drafting || !intent.trim()} className="mt-2 px-4 py-2 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors disabled:opacity-50">{drafting ? "Drafting..." : "Draft with AI"}</button>
                {draft && (
                  <div className="mt-3 border-t border-[var(--ink-200,#e5e5e5)] pt-3 text-sm">
                    <p className="font-medium">{draft.text}</p>
                    <p className="text-xs text-[var(--ink-500)] mt-1">Evidence: {draft.evidence_requested}</p>
                    <p className="text-xs text-[var(--ink-400,#9ca3af)] italic mt-1">{humaniseSecurityCodes(draft.rationale)} · {draft.category} · {draft.source}</p>
                    <button onClick={addDraft} className="mt-2 px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Add to RFP</button>
                  </div>
                )}
              </div>
            </div>
            {/* AI expert research tool */}
            <div className="border border-[var(--ink-900)] rounded-sm p-4 bg-amber-50">
              <p className="eyebrow mb-2">AI expert research tool</p>
              <p className="text-xs text-[var(--ink-600,#555)] mb-2">Give a topic. The expert drafts a themed set of cited questions, grounded in the methodology, the live vendor matrix and your selected regulations, and writes questions that separate strong vendors from weak ones.</p>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. ransomware containment for OT, or DORA exit and subcontracting terms" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
              <button onClick={research} disabled={researching || !topic.trim()} className="mt-2 px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">{researching ? "Researching..." : "Research and draft a set"}</button>
              {researchSet && (
                <div className="mt-3 border-t border-[var(--ink-200,#e5e5e5)] pt-3">
                  <p className="text-sm text-[var(--ink-700)] italic mb-2">{researchSet.analysis}</p>
                  <div className="space-y-2">
                    {researchSet.questions.map((q) => (
                      <div key={q.id} className="text-sm border border-[var(--ink-200,#e5e5e5)] rounded-sm p-2 bg-white">
                        <p className="font-medium">{q.text}</p>
                        <p className="text-xs text-[var(--ink-500)] mt-0.5">Evidence: {q.evidence_requested}</p>
                        <p className="text-xs text-[var(--ink-400,#9ca3af)] italic mt-0.5">{humaniseSecurityCodes(q.rationale)} · {q.category}</p>
                        <button onClick={() => addResearchQuestion(q)} className="mt-1 px-3 py-1 text-xs border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Add</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Question library */}
            <div>
              <p className="eyebrow mb-2">Question library (methodology v{project.methodology_version})</p>
              <p className="text-xs text-[var(--ink-500)] mb-3">Toggle questions in or out, and flag mandatory requirements. The list reflects your scope and delivery model.</p>
              <div className="space-y-2">
                {project.rfp_sections.map((s) => (
                  <details key={s.category} className="border border-[var(--ink-300,#ccc)] rounded-sm">
                    <summary className="px-3 py-2 text-sm font-medium cursor-pointer">{s.category} ({s.questions.filter((q) => q.priority !== "optional").length}/{s.questions.length})</summary>
                    <div className="px-3 pb-3 space-y-2">
                      {s.questions.map((q) => {
                        const on = q.priority !== "optional";
                        return (
                          <div key={q.id} className={`text-sm rounded-sm p-2 ${on ? "bg-amber-50" : ""}`}>
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input type="checkbox" checked={on} onChange={() => toggleQuestion(s.category, q.id)} className="mt-1" />
                              <span>
                                <span className="text-[var(--ink-800)]">{q.text}</span>
                                {q.source === "custom" && <span className="ml-1 text-xs text-[var(--accent)]">custom</span>}
                              </span>
                            </label>
                            {on && (
                              <label className="flex items-center gap-1.5 mt-1 ml-6 text-xs text-[var(--ink-500)] cursor-pointer">
                                <input type="checkbox" checked={q.mandatory} onChange={() => toggleMandatory(s.category, q.id)} /> mandatory requirement
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right: live RFP preview */}
        <div>
          <p className="eyebrow mb-2">Your RFP so far (updates live)</p>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => { setEditingTitle(false); const t = titleDraft.trim(); if (t && t !== project.title) persist({ ...project, title: t }); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingTitle(false); }}
              className="mb-1 w-full border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-lg font-medium"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setTitleDraft(project.title); setEditingTitle(true); }}
              title="Click to rename this RFP"
              className="group mb-1 flex items-baseline gap-2 text-left"
            >
              <h2 className="text-lg m-0">{project.title}</h2>
              <span className="text-xs text-[var(--ink-400,#9ca3af)] underline decoration-dotted group-hover:text-[var(--ink-700)]">rename</span>
            </button>
          )}
          <p className="text-sm text-[var(--ink-500)] mb-1">Sector: {project.buyer.sector ?? "not set"}. Sites: {project.buyer.site_count ?? "not set"}. Compliance: {project.buyer.compliance.map((c) => securityCodeLabel(c)).join(", ") || "none set"}.</p>
          <p className="text-xs text-[var(--ink-400,#9ca3af)] mb-4">Stage: <span className="uppercase">{project.status}</span>. An RFP moves through {STATUS_FLOW.join(" → ")} as you publish and vendors respond.</p>
          <div className="space-y-3">
            {project.rfp_sections.filter((s) => s.included).map((s) => {
              const active = s.questions.filter((q) => q.priority !== "optional");
              if (!active.length) return null;
              return (
                <details key={s.category} className="border border-[var(--ink-300,#ccc)] rounded-sm" open>
                  <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer">{s.category} ({active.length})</summary>
                  <div className="px-4 pb-3 space-y-3">
                    {active.map((q) => (
                      <div key={q.id} className="text-sm">
                        <p className="font-medium text-[var(--ink-800)]">
                          <span className={`mr-2 text-xs uppercase ${q.mandatory ? "text-amber-700" : "text-[var(--ink-500)]"}`}>{q.mandatory ? "mandatory" : q.priority}</span>
                          {q.text}
                        </p>
                        {q.evidence_requested && <p className="text-xs text-[var(--ink-500)] mt-0.5">Evidence: {q.evidence_requested}</p>}
                        {q.buyer_lens && <p className="text-xs text-[var(--ink-500)] mt-0.5">Buyer: {q.buyer_lens}</p>}
                        {q.supplier_lens && <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-0.5">Vendor: {q.supplier_lens}</p>}
                        {!q.buyer_lens && <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-0.5 italic">{humaniseSecurityCodes(q.rationale)}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
      {/* NDA: optional gate before suppliers see the full RFP */}
      <section className="mt-10 border-t border-[var(--ink-300,#ccc)] pt-6">
        <h2 className="text-lg mb-2">Confidentiality (NDA)</h2>
        <label className="flex items-start gap-2 text-sm text-[var(--ink-700)] mb-3">
          <input type="checkbox" checked={nda.required} onChange={(e) => updateNda({ required: e.target.checked })} className="mt-1" />
          <span>Require vendors to accept an NDA before they can see the full RFP and respond. They see only a short scope summary until they accept.</span>
        </label>

        {nda.required && (
          <div className="space-y-4 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="nda_source" checked={nda.source === "template"} onChange={() => updateNda({ source: "template", text: NETIFY_NDA_TEMPLATE })} />
                Use the Netify standard mutual NDA
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="nda_source" checked={nda.source === "buyer"} onChange={() => updateNda({ source: "buyer" })} />
                Use our own NDA
              </label>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">NDA wording {nda.source === "buyer" ? "(paste your NDA text)" : "(editable copy of the Netify template)"}</label>
              <textarea value={nda.text} onChange={(e) => updateNda({ text: e.target.value })} rows={8} placeholder="Paste your NDA wording here, or link to it below." className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-xs font-mono" />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Link to your NDA document (optional)</label>
              <input value={nda.link} onChange={(e) => updateNda({ link: e.target.value })} placeholder="https://…" className="w-full max-w-lg border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
            </div>

            <p className="text-xs text-[var(--ink-500)]">Current version: v{nda.version}. Changing the wording, link or source bumps the version, so anyone who accepted earlier is asked to re-accept the new terms.</p>

            <div>
              <p className="eyebrow mb-2">Vendors who have accepted ({ndaAccepts.length})</p>
              {ndaAccepts.length === 0 ? (
                <p className="text-sm text-[var(--ink-500)]">No acceptances yet.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {ndaAccepts.map((a) => (
                    <li key={a.id} className="flex flex-wrap gap-x-3 text-[var(--ink-700)]">
                      <span className="font-medium">{a.vendor}</span>
                      <span>signed by {a.signatory_name}</span>
                      {a.email && <span className="text-[var(--ink-500)]">{a.email}</span>}
                      <span className="text-[var(--ink-500)]">v{a.nda_version} · {new Date(a.accepted).toLocaleString("en-GB")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Suppliers: two-sided marketplace */}
      <section id="suppliers" className="mt-10 border-t border-[var(--ink-300,#ccc)] pt-6">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h2 className="text-lg">Vendors and service providers</h2>
          <div className="flex gap-2">
            {/* Row-8 hotfix (16 Aug 2026): this button is the only trigger for
                suggestSuppliers(), which reveals project-specific vendor
                matches. Hiding it pre-publish (on top of the function-level
                guard) means there is no control on the page that can start
                that disclosure before publication. */}
            {published && (
              <button onClick={suggestSuppliers} className="px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Suggest best-fit vendors</button>
            )}
            <button onClick={() => publishToCurated("suppliers")} disabled={publishing} className="px-3.5 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
              {publishing ? "Publishing..." : published ? "Re-send to your matched vendors" : publicationLocked ? "Try publication again" : "Publish opportunity"}
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--ink-500)] mb-3">
          {published ? (
            <><strong>Step 3.</strong> These are the graded vendors and service providers from the Netify marketplace. <strong>Suggest best-fit vendors</strong> finds the closest matches to what you described. <strong>Re-send to your matched vendors</strong> invites that whole set in one go, the same action as the panel at the top of this page. Or invite them one at a time, then message them, request a demo, or ask for contact details. Each one gets a private link to read your RFP and reply.</>
          ) : publicationLocked ? (
            // Market-unlock correction round 2 (16 Aug 2026), requirement 5:
            // this used to say "Your submission is in" -- untrue while the
            // market has not unlocked. `published`/`hasPublished()` are the
            // wrong signal here: the market genuinely has NOT unlocked, and
            // this copy must say so plainly, name that nothing has been
            // invited, and point at the retry action (the boardNote banner
            // just below, or the button above).
            <><strong>Step 3.</strong> Publication incomplete. {publicationLockedReason ?? "Your requirement has not yet been published as a public opportunity on the Opportunities Board."} No vendor has been invited and nothing about your specific match, or any vendor&apos;s identity, has unlocked. See the notice below to complete publication.</>
          ) : (
            // Row-8 hotfix (16 Aug 2026): pre-publish this section may name the
            // marketplace as an aggregate ("Netify's graded marketplace") but
            // must not reveal which vendors match THIS project, or any
            // supplier identity, before publication.
            <><strong>Step 3.</strong> Netify&apos;s graded marketplace vendors and service providers are matched to your requirement and invited once you publish. Nothing about your specific match, or any vendor&apos;s identity, is shown here until then.</>
          )}
        </p>
        <div className="mb-3 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base)] p-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[var(--ink-700)]"><strong>Your private link to this RFP.</strong> No account needed: this page is your dashboard. Copy this link (it carries your private key) to come back from any device and track replies. Don&apos;t share it: vendors get their own links.</span>
          <button onClick={copyManageLink} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">{manageCopied ? "Copied" : "Copy my link"}</button>
          <span className="flex items-center gap-1.5">
            <input value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} type="email" placeholder="you@company.com" className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm" />
            <button onClick={emailDraftLink} disabled={emailingLink || !draftEmail.trim()} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors disabled:opacity-50">{emailingLink ? "Sending..." : "Email me this link"}</button>
          </span>
          {draftLinkNote && <span className="text-xs text-[var(--ink-600,#555)] basis-full">{draftLinkNote}</span>}
        </div>
        {publishMsg && <p className="text-sm text-emerald-700 mb-3">{publishMsg}</p>}
        {publishAuthNeeded && (
          <p className="mb-3 text-sm text-[var(--ink-700)]"><strong>Sign-in needed to publish:</strong> use the <a href="#publish" className="underline">panel at the top of this page</a>; publication continues automatically once you are signed in.</p>
        )}
        {boardNote && (
          boardNote.listed ? (
            <p className="text-sm text-emerald-700 mb-3">
              Also listed on the <a href="/sase/opportunities/board/" className="underline">public opportunity board</a>
              {boardNote.url ? <>: <a href={boardNote.url} className="underline">view the public RFI page</a></> : null}. The notice shows scope and sector only; your questions, pricing and contact details stay private.
            </p>
          ) : (
            // Market-unlock correction round 2 (16 Aug 2026), requirement 5:
            // "Publication incomplete" (not "Not on the public board yet",
            // which read as a minor visibility toggle rather than the
            // reason nothing has unlocked) and "Complete Opportunities
            // Board publication" (not "List on the board", which
            // undersold what this action actually completes: the market
            // unlock itself, not merely a board listing).
            <div className="mb-3 rounded-sm border border-amber-300 bg-amber-50 p-3 text-sm text-[var(--ink-800)]">
              <p className="mb-2"><strong>Publication incomplete.</strong> {boardNote.reason ?? publicationLockedReason ?? "Verified vendors browsing the board cannot see this RFP."} No vendor has been invited and nothing supplier-facing has unlocked: publication only completes once this requirement is successfully published as a public opportunity on the Opportunities Board. Listing is anonymous: the notice shows sector, estate and requirement only, never your company name or contact details, and pricing stays private to you.</p>
              <button
                onClick={listOnBoardNow}
                disabled={listingBusy}
                className="px-3.5 py-1.5 text-sm rounded-full border border-amber-500 bg-amber-100 hover:bg-amber-200 transition-colors disabled:opacity-60"
              >
                {listingBusy ? "Publishing…" : "Complete Opportunities Board publication"}
              </button>
              {listAuthNeeded && (
                <div className="mt-2">
                  <p className="mb-1 text-xs text-[var(--ink-700)]">Listing reaches verified vendors, so it needs your signed-in work email first.</p>
                  <SignIn role="buyer" prompt="Sign in with your work email, then complete Opportunities Board publication again." />
                </div>
              )}
            </div>
          )
        )}

        {/* Row-8 hotfix (16 Aug 2026): everything below this line names real
            vendors matched to THIS project, or real supplier connections/
            actions — exactly the "supplier identity or project-specific
            matching signal" the brief says must never leak before
            publication. All of it is now gated on `published`; pre-publish
            we show only the generic locked notice, matching the pattern
            already used below for "Evaluate vendor responses". */}
        {!published && (
          <div className="mb-3 rounded-sm border border-dashed border-[var(--ink-300,#ccc)] bg-[var(--paper-base)] p-3 text-sm text-[var(--ink-500)]">
            Vendor matches, invitations, messages and replies are locked until you publish — publishing is what invites your matched vendors and starts the conversation.{" "}
            <a href="#publish" className="underline">Publish to unlock</a>.
          </div>
        )}
        {published && suggestions && suggestions.length > 0 && (
          <div className="mb-4">
            <p className="eyebrow mb-2">Suggested (best-fit for your context)</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.filter((s) => !connections.some((c) => c.vendor_slug === s.slug)).map((s) => (
                <button key={s.slug} onClick={() => inviteSupplier(s.slug, `We are running a SASE and SD-WAN RFP and would like ${s.name} to participate.`)} className="px-3.5 py-1.5 text-sm rounded-full border border-amber-500 bg-amber-50 hover:bg-amber-100 transition-colors">
                  Invite {s.name}{s.score == null ? "" : ` (${s.score})`}
                </button>
              ))}
            </div>
          </div>
        )}

        {published && connections.length === 0 && <p className="text-sm text-[var(--ink-500)]">No vendors invited yet.</p>}
        {published && connections.length > 0 && (
          <p className="mb-2 text-sm text-[var(--ink-700)]">
            <strong>{connections.filter((c) => c.viewed_at).length} of {connections.length}</strong> vendors have viewed your RFP
            {connections.filter((c) => c.status === "declined").length > 0 ? ` · ${connections.filter((c) => c.status === "declined").length} declined` : ""}
            {project.response_deadline ? ` · responses close ${new Date(project.response_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} (${Math.max(0, Math.ceil((project.response_deadline - Date.now()) / 86400000))} days left)` : ""}.
          </p>
        )}
        {published && (() => {
          const HINTS: Record<string, string> = {
            out_of_region: "Consider widening the vendor set or checking your region selections match where you need delivery.",
            sector_not_served: "Your sector filter may be narrowing the match; sector context in the background section helps vendors self-qualify.",
            scope_unclear: "Add a sentence or two to the project background: current estate, what is changing and why.",
            commercially_unattractive: "Consider adding budget context or site counts so vendors can size the opportunity.",
            no_capacity: "Timing, not fit. Re-send to the remaining matches or extend your deadline.",
            other: "Read the vendor's note below for the detail.",
          };
          const declines = connections
            .filter((c) => c.status === "declined")
            .map((c) => {
              const m = [...c.messages].reverse().find((x) => x.type === "decline");
              return { reason: String(m?.payload?.reason ?? "other"), note: m?.body ?? "" };
            });
          if (declines.length === 0) return null;
          return (
            <div className="mb-3 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base)] p-3 text-sm">
              <p className="mb-1 font-medium text-[var(--ink-800)]">Why vendors declined, and what would improve this RFP</p>
              <ul className="space-y-1 text-[var(--ink-700)]">
                {declines.map((d, i) => (
                  <li key={i}>
                    {d.reason.replace(/_/g, " ")}: {HINTS[d.reason] ?? HINTS.other}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
        {published && (
          <div className="space-y-3">
            {connections.map((c) => (
              <details key={c.vendor_slug} className="border border-[var(--ink-300,#ccc)] rounded-sm">
                <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer flex justify-between">
                  <span>{c.vendor_name}</span>
                  <span className="text-xs uppercase tracking-wide text-[var(--ink-500)]">
                    {c.viewed_at ? "viewed · " : ""}{c.status}
                  </span>
                </summary>
                <div className="px-4 pb-3">
                  <div className="space-y-2 my-2">
                    {c.messages.map((m) => (
                      <div key={m.id} className={`text-sm rounded-sm p-2 ${m.from === "buyer" ? "bg-amber-50" : "border border-[var(--ink-200,#e5e5e5)]"}`}>
                        <span className="text-xs uppercase text-[var(--ink-400,#9ca3af)] mr-2">{m.from === "buyer" ? "You" : c.vendor_name} · {m.type}</span>
                        {m.body}
                        {Object.keys(m.payload).length > 0 && <span className="block text-[var(--ink-700)] mt-0.5">{Object.entries(m.payload).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>}
                      </div>
                    ))}
                  </div>
                  <textarea value={msgDraft[c.vendor_slug] ?? ""} onChange={(e) => setMsgDraft({ ...msgDraft, [c.vendor_slug]: e.target.value })} rows={2} placeholder="Message to the vendor" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <button onClick={() => connectAction(c.vendor_slug, "message", msgDraft[c.vendor_slug] ?? "")} disabled={!msgDraft[c.vendor_slug]} className="px-3 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">Send</button>
                    <button onClick={() => connectAction(c.vendor_slug, "demo_request", "")} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Request demo</button>
                    <button onClick={() => connectAction(c.vendor_slug, "contact_request", "")} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Request contact</button>
                    <button onClick={() => copySupplierLink(c.token)} className="px-3 py-1.5 text-sm border border-[var(--ink-300,#ccc)] rounded-full hover:border-[var(--ink-900)]">Copy response link</button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Evaluation: independent cross-check of supplier responses */}
      <section className="mt-10 border-t border-[var(--ink-300,#ccc)] pt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg">Evaluate vendor responses</h2>
          <button onClick={loadEvaluations} className="px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Refresh responses</button>
        </div>
        <p className="text-sm text-[var(--ink-500)] mb-3"><strong>Step 4.</strong> Vendor replies appear here once the RFP is published. Their answers are cross-checked against Netify&#39;s independent capability grades, and any claim that goes beyond the evidence is flagged for you to question. Refresh responses checks for new replies.</p>
        {!published && (
          <div className="mb-3">
            <p className="text-sm text-[var(--ink-700)] mb-2"><strong>This is what you are publishing for.</strong> Each response arrives structured like this, ready to compare:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-sm border border-dashed border-[var(--ink-300,#ccc)] bg-[var(--paper-base)] p-3 text-sm text-[var(--ink-400,#9ca3af)]">
                  <p className="font-medium mb-1">Vendor response · locked until you publish</p>
                  <p>Answers to your {includedQuestionCount} questions · graded coverage</p>
                  <p>Pricing, private to you · evidence documents · demo availability</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm"><a href="#publish" className="underline">Publish to unlock responses</a></p>
          </div>
        )}
        {evaluations && evaluations.length === 0 && <p className="text-sm text-[var(--ink-500)]">{project.status === "published" ? "No responses yet. Invited vendors reply through their private links, and replies appear here automatically." : "No responses yet. Publish the RFP to invite vendors, or share the response link."}</p>}
        {/* Scoring surface (deal room slice 2): executive summary and a
            side-by-side matrix generated deterministically from the
            evaluation data, decline reasons and the response window, with
            methodology provenance. No model call: every sentence traces to
            a number on this page. */}
        {evaluations && evaluations.length > 0 && (() => {
          const ranked = [...evaluations].sort((a, b) => (b.weighted_coverage ?? b.answered / Math.max(1, b.total)) - (a.weighted_coverage ?? a.answered / Math.max(1, a.total)));
          const pct = (ev: Evaluation) => Math.round((ev.weighted_coverage ?? ev.answered / Math.max(1, ev.total)) * 100);
          const leader = ranked[0];
          const declined = connections.filter((c) => c.status === "declined");
          const pendingSuppliers = connections.filter((c) => c.status !== "declined" && !evaluations.some((ev) => ev.vendor_slug === c.vendor_slug));
          const flagged = ranked.filter((ev) => (ev.red_flags ?? 0) > 0 || ev.flags > 0);
          const evidenceGaps = ranked.filter((ev) => (ev.missing_evidence ?? 0) > 0);
          const sentences: string[] = [];
          sentences.push(`${leader.vendor} leads on weighted coverage at ${pct(leader)}%, answering ${leader.answered} of ${leader.total} questions.`);
          if (ranked.length > 1) sentences.push(`${ranked.slice(1).map((ev) => `${ev.vendor} ${pct(ev)}%`).join(", ")} follow${ranked.length === 2 ? "s" : ""}.`);
          if (flagged.length > 0) sentences.push(`Claims to verify: ${flagged.map((ev) => `${ev.vendor} (${(ev.red_flags ?? 0) > 0 ? `${ev.red_flags} red flag${(ev.red_flags ?? 0) === 1 ? "" : "s"}` : `${ev.flags} item${ev.flags === 1 ? "" : "s"}`})`).join(", ")}; ask each to substantiate before shortlisting.`);
          if (evidenceGaps.length > 0) sentences.push(`Evidence gaps: ${evidenceGaps.map((ev) => `${ev.vendor} (${ev.missing_evidence})`).join(", ")}; request documents through the message thread.`);
          if (declined.length > 0) sentences.push(`${declined.length} vendor${declined.length === 1 ? "" : "s"} declined; reasons and improvement hints are listed above.`);
          if (pendingSuppliers.length > 0 && project.response_deadline && project.response_deadline > Date.now()) sentences.push(`${pendingSuppliers.length} invited vendor${pendingSuppliers.length === 1 ? " has" : "s have"} not yet responded; the window closes ${new Date(project.response_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`);
          return (
            <div className="mb-4">
              <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base)] p-3">
                <p className="eyebrow mb-1">Executive summary</p>
                <p className="text-sm text-[var(--ink-800)]">{sentences.join(" ")}</p>
                <p className="mt-1 text-xs text-[var(--ink-500)]">Generated from the response evaluations, Netify capability grades (Methodology v{project.methodology_version}) and this RFP&apos;s response window. Every figure appears in the matrix and per-vendor detail below.</p>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--ink-300,#ccc)] text-left text-[var(--ink-500)]">
                      <th className="py-2 pr-4 font-medium">Metric</th>
                      {ranked.map((ev) => <th key={ev.vendor} className="py-2 pr-4 font-medium text-[var(--ink-800)]">{ev.vendor}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--ink-100,#f0f0f0)]">
                      <td className="py-2 pr-4 text-[var(--ink-600,#555)]">Questions answered</td>
                      {ranked.map((ev) => <td key={ev.vendor} className="py-2 pr-4">{ev.answered}/{ev.total}</td>)}
                    </tr>
                    <tr className="border-b border-[var(--ink-100,#f0f0f0)]">
                      <td className="py-2 pr-4 text-[var(--ink-600,#555)]">Weighted coverage</td>
                      {ranked.map((ev) => <td key={ev.vendor} className="py-2 pr-4 font-medium">{pct(ev)}%</td>)}
                    </tr>
                    <tr className="border-b border-[var(--ink-100,#f0f0f0)]">
                      <td className="py-2 pr-4 text-[var(--ink-600,#555)]">Red flags</td>
                      {ranked.map((ev) => <td key={ev.vendor} className={`py-2 pr-4 ${(ev.red_flags ?? 0) > 0 ? "text-red-700" : ""}`}>{ev.red_flags ?? 0}</td>)}
                    </tr>
                    <tr className="border-b border-[var(--ink-100,#f0f0f0)]">
                      <td className="py-2 pr-4 text-[var(--ink-600,#555)]">Items to verify</td>
                      {ranked.map((ev) => <td key={ev.vendor} className={`py-2 pr-4 ${ev.flags > 0 ? "text-amber-700" : ""}`}>{ev.flags}</td>)}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-[var(--ink-600,#555)]">Missing evidence</td>
                      {ranked.map((ev) => <td key={ev.vendor} className="py-2 pr-4">{ev.missing_evidence ?? 0}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              {ranked.length > 0 && ranked[0].checks.length > 0 && (
                <details className="mt-3 rounded-sm border border-[var(--ink-200,#e5e5e5)]">
                  <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Question-by-question grades</summary>
                  <div className="overflow-x-auto px-4 pb-3">
                    <table className="w-full min-w-[560px] border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--ink-300,#ccc)] text-left text-[var(--ink-500)]">
                          <th className="py-1.5 pr-3 font-medium">Question</th>
                          {ranked.map((ev) => <th key={ev.vendor} className="py-1.5 pr-3 font-medium text-[var(--ink-800)]">{ev.vendor}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ranked[0].checks.map((row, qi) => (
                          <tr key={qi} className="border-b border-[var(--ink-100,#f0f0f0)] align-top">
                            <td className="py-1.5 pr-3 text-[var(--ink-700)]">{row.question}</td>
                            {ranked.map((ev) => {
                              const cell = ev.checks.find((c) => c.question === row.question);
                              return (
                                <td key={ev.vendor} className={`py-1.5 pr-3 ${cell?.flag ? "text-amber-800" : "text-[var(--ink-700)]"}`}>
                                  {cell ? `${cell.grade_label}${cell.flag ? " ⚑" : ""}` : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-[11px] text-[var(--ink-500)]">⚑ marks answers where the claim goes beyond Netify&apos;s independent evidence; the note is in the per-vendor detail below.</p>
                  </div>
                </details>
              )}
            </div>
          );
        })()}
        {evaluations && evaluations.map((ev) => (
          <details key={ev.vendor} className="border border-[var(--ink-300,#ccc)] rounded-sm mb-2">
            <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer">
              {ev.vendor} · {ev.answered}/{ev.total} answered
              {typeof ev.weighted_coverage === "number" && <span className="ml-2 text-[var(--ink-500)]">{Math.round(ev.weighted_coverage * 100)}% weighted coverage</span>}
              {(ev.red_flags ?? 0) > 0 && <span className="ml-2 text-red-700">{ev.red_flags} red flag{(ev.red_flags ?? 0) > 1 ? "s" : ""}</span>}
              {ev.flags > 0 && <span className="ml-2 text-amber-700">{ev.flags} item{ev.flags > 1 ? "s" : ""} to verify</span>}
            </summary>
            <div className="px-4 pb-3 space-y-2">
              {ev.checks.filter((c) => c.flag !== "supported").map((c, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium text-[var(--ink-800)]">{c.question}</p>
                  <p className="text-[var(--ink-600,#555)]">Answer: {c.answer || "(none)"}</p>
                  <p className={`text-xs mt-0.5 ${c.flag === "red_flag" ? "text-red-700" : c.flag === "claim_exceeds_evidence" || c.flag === "missing_evidence" ? "text-amber-700" : "text-[var(--ink-500)]"}`}>{c.note}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>

      {/* Benchmark flywheel signal */}
      {benchmark?.available && (benchmark.total_rfps ?? 0) > 0 && (
        <section className="mt-8 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base)] p-4">
          <p className="eyebrow mb-2">Benchmark signal</p>
          <p className="text-sm text-[var(--ink-600,#555)]">
            From {benchmark.total_rfps} RFPs built with this tool.
            {benchmark.median_response_completeness != null && ` Median vendor response completeness: ${Math.round(benchmark.median_response_completeness * 100)}%.`}
            {benchmark.top_mandatory_questions && benchmark.top_mandatory_questions.length > 0 && ` Most-required capabilities: ${benchmark.top_mandatory_questions.slice(0, 5).map((q) => q.name).join(", ")}.`}
          </p>
          <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-1">Anonymised aggregate, counts only.</p>
        </section>
      )}

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {/* Slim sticky publish bar: keeps the next step visible on a long page.
          Session-dismissible; gone for good once the RFP is published. */}
      {!published && !stickyGone && !submitFlow && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-300 bg-white/95 backdrop-blur px-4 py-2">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-[var(--ink-800)]"><strong>Next step:</strong> {publicationLocked ? "finish publishing this opportunity." : "publish this opportunity. Competing bids, no sales calls."}</span>
            <span className="flex items-center gap-2">
              <button onClick={() => publishToCurated("bar")} disabled={publishing} className="px-3.5 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">{publishing ? "Publishing..." : publicationLocked ? "Try again" : "Publish"}</button>
              <button onClick={() => { setStickyGone(true); try { sessionStorage.setItem(`rfp_publish_bar_${project.id}`, "1"); } catch { /* ignore */ } }} aria-label="Hide publish bar" className="text-sm text-[var(--ink-500)] underline">Hide</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Same-screen 6-digit code entry (18 July 2026): the email carries a code as
 * well as the link, so a buyer whose corporate mail scanner eats links, or
 * who reads the email on their phone, can finish on the screen they are
 * already on. Verifying the code sets the session cookie server-side; the
 * caller then resumes the publish exactly as the link path does.
 */
function CodeEntry({ defaultEmail, onVerified }: { defaultEmail: string; onVerified: () => void }) {
  const [addr, setAddr] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    const c = code.trim();
    const e = addr.trim();
    if (busy || c.length !== 6 || !e.includes("@")) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/sase/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: c, email: e }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "That code did not work.");
      onVerified();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 border-t border-[var(--ink-200,#e5e5e5)] pt-3">
      <p className="text-sm mb-1.5"><strong>Or type the 6-digit code from the email</strong> — quicker than finding the link, and it works even if your company scans links:</p>
      <div className="flex flex-wrap items-center gap-2">
        {!defaultEmail && (
          <input
            value={addr}
            onChange={(ev) => setAddr(ev.target.value)}
            type="email"
            placeholder="you@yourcompany.com"
            className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm"
            aria-label="Work email the code was sent to"
          />
        )}
        <input
          value={code}
          onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="w-28 border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm tracking-[0.3em] text-center"
          aria-label="6-digit code from the email"
          onKeyDown={(ev) => { if (ev.key === "Enter") submit(); }}
        />
        <button onClick={submit} disabled={busy || code.trim().length !== 6 || !addr.trim().includes("@")} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
          {busy ? "Checking..." : "Confirm with code"}
        </button>
      </div>
      {err && <p className="mt-1.5 text-sm text-red-700">{err}</p>}
    </div>
  );
}
