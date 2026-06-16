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
import { NETIFY_NDA_TEMPLATE } from "@/lib/rfp-types";

type RfpQuestion = { id: string; feature_id: string; text: string; evidence_requested: string; rationale: string; priority: "required" | "recommended" | "optional"; source: "methodology" | "custom" | "bank"; mandatory: boolean; weight: number; buyer_lens?: string; supplier_lens?: string };
type RfpSection = { category: string; included: boolean; questions: RfpQuestion[] };
type Buyer = { organisation: string; sector: string | null; organisation_size: string; site_count: number | null; regions: string[]; compliance: string[]; operating_model: string; product_scope: string };
type Nda = { required: boolean; source: "template" | "buyer"; text: string; link: string; version: number; updated: number };
type NdaAcceptance = { id: string; vendor: string; signatory_name: string; email: string; nda_version: number; accepted: number };
type Project = { id: string; status: string; title: string; buyer: Buyer; rfp_sections: RfpSection[]; share_token: string; manage_token?: string; methodology_version: string; nda?: Nda };

const STATUS_FLOW = ["draft", "review", "published", "qa", "evaluation"];
const SCOPES = [
  { key: "full_sase", label: "Full SASE (SD-WAN + security)" },
  { key: "sse_only", label: "SSE only (security service edge)" },
  { key: "sdwan_only", label: "SD-WAN only" },
  { key: "single_vendor_sase", label: "Single-vendor SASE" },
  { key: "best_of_breed", label: "Best-of-breed (SSE + SD-WAN)" },
];
const MODELS = [
  { key: "any", label: "Any" },
  { key: "managed", label: "Fully managed" },
  { key: "co_managed", label: "Co-managed" },
  { key: "diy", label: "DIY / self-managed" },
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
type Evaluation = { vendor: string; vendor_slug: string | null; answered: number; total: number; flags: number; checks: { question: string; answer: string; grade_label: string; flag: string; note: string }[] };
type Benchmark = { available: boolean; total_rfps?: number; top_mandatory_questions?: { name: string; count: number }[]; median_response_completeness?: number | null };
type ConnMsg = { id: string; from: "buyer" | "supplier"; type: string; body: string; payload: Record<string, string>; created: number };
type Connection = { vendor_slug: string; vendor_name: string; token: string; status: string; messages: ConnMsg[] };
type Suggestion = { rank: number; slug: string; name: string; score: number };

export default function RfpBuilder({ initialId }: { initialId?: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<"agent" | "manual">("agent");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // agent chat
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [manageCopied, setManageCopied] = useState(false);
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
  const [bank, setBank] = useState<{ version: string; canonical: { id: string; category: string; text: string }[]; sector_packs: Record<string, { label: string; sections: { title: string; questions: { id: string; text: string; buyer_lens: string; supplier_lens: string; netify_note: string }[] }[] }> } | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [msgDraft, setMsgDraft] = useState<Record<string, string>>({});
  const [ndaAccepts, setNdaAccepts] = useState<NdaAcceptance[]>([]);

  const nda: Nda = project?.nda ?? { required: false, source: "template", text: "", link: "", version: 1, updated: 0 };

  /** Persist an NDA change. Editing the wording, link or source bumps the
   *  version so any prior supplier acceptances no longer satisfy the gate and
   *  suppliers are asked to re-accept the current terms. */
  async function updateNda(patch: Partial<Nda>) {
    if (!project) return;
    const next: Nda = { ...nda, ...patch };
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
      const r = await fetch(`/api/rfp/${project.id}/nda?acceptances=1`);
      if (r.ok) { const d = await r.json(); setNdaAccepts(d.acceptances ?? []); }
    } catch { /* non-fatal */ }
  }

  useEffect(() => { if (initialId) loadProject(initialId); /* eslint-disable-next-line */ }, [initialId]);
  useEffect(() => { if (project) { refreshCoverage(); } /* eslint-disable-next-line */ }, [project?.id, project?.buyer.compliance?.join(",")]);
  useEffect(() => { fetch("/api/rfp/benchmark").then((r) => r.json()).then(setBenchmark).catch(() => {}); }, []);
  useEffect(() => { if (project) refreshConnections(); /* eslint-disable-next-line */ }, [project?.id]);
  useEffect(() => { if (project?.nda?.required) refreshNdaAccepts(); /* eslint-disable-next-line */ }, [project?.id, project?.nda?.required, project?.nda?.version]);
  useEffect(() => { fetch("/question-bank.json").then((r) => r.json()).then(setBank).catch(() => {}); }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages]);

  // The manage_token is the RFP's mutation/push credential. The server strips it
  // from open reads (GET, agent), so we hold it client-side after creation and
  // re-attach it whenever the server hands back a stripped project. This keeps
  // publish, save, goal and approvals working without the credential ever being
  // discoverable by someone who only knows the RFP id.
  const manageToken = useRef<string>("");
  const mtokKey = (id: string) => `netify_mtok_${id}`;
  function applyProject(p: Project) {
    let tok = p.manage_token || manageToken.current;
    if (!tok && typeof window !== "undefined") tok = localStorage.getItem(mtokKey(p.id)) || "";
    if (tok) {
      manageToken.current = tok;
      try { localStorage.setItem(mtokKey(p.id), tok); } catch { /* private mode, keep in ref */ }
    }
    setProject({ ...p, manage_token: tok });
  }

  async function loadProject(id: string) {
    try {
      const res = await fetch(`/api/rfp/${id}`);
      if (res.ok) applyProject((await res.json()) as Project);
      else setError("This RFP could not be loaded.");
    } catch { setError("This RFP could not be loaded."); }
  }

  async function startRfp(buyer?: Record<string, unknown>) {
    setCreating(true); setError(null);
    try {
      const res = await fetch("/api/rfp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(buyer ? { buyer } : {}) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not start an RFP."); }
      const p = (await res.json()) as Project;
      applyProject(p); // create returns the full token; persist it client-side
      window.history.replaceState(null, "", `/rfp-builder/${p.id}`);
      setMessages([{ role: "assistant", content: "Let's build your RFP. What sector are you in, roughly how many sites, which regions, and any compliance obligations (for example UK GDPR, PCI DSS, IEC 62443)? You can also just pick a scope and delivery model under Build it myself." }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start an RFP."); }
    finally { setCreating(false); }
  }

  // Prefill from the guided start (query carry-through): create the RFP with the
  // captured buyer context and drop straight into manual mode so the sections show.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || initialId) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("prefill") !== "1") return;
    prefilled.current = true;
    const buyer: Record<string, unknown> = {
      sector: p.get("sector") || null,
      organisation_size: p.get("org") || "any",
      regions: (p.get("regions") ?? "").split(".").filter(Boolean),
      compliance: (p.get("compliance") ?? "").split(".").filter(Boolean),
      operating_model: p.get("model") || "any",
      product_scope: p.get("scope") || "full_sase",
      site_count: p.get("sites") ? Number(p.get("sites")) : null,
      notes: p.get("notes") || "",
    };
    setMode("manual");
    startRfp(buyer);
    /* eslint-disable-next-line */
  }, []);

  async function persist(updated: Project, regenerate = false) {
    setProject(updated);
    try {
      // updated carries the manage_token from client state, which the gated PUT
      // requires; the response keeps the token (access proven), so re-apply it.
      const res = await fetch(`/api/rfp/${updated.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...updated, manage_token: manageToken.current || updated.manage_token, regenerate }) });
      if (res.ok && regenerate) applyProject((await res.json()) as Project);
    } catch { /* optimistic */ }
  }

  async function setScope(scope: string) {
    if (!project) return;
    // ask the API to regenerate by sending updated buyer; server keeps sections in sync on agent path,
    // here we PUT buyer and re-fetch a regenerated structure via the create-style synthesis on the server.
    await persist({ ...project, buyer: { ...project.buyer, product_scope: scope } }, true);
  }

  async function setModel(model: string) {
    if (!project) return;
    await persist({ ...project, buyer: { ...project.buyer, operating_model: model } }, true);
  }

  async function send() {
    if (!project || !prompt.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next); setPrompt(""); setBusy(true); setError(null); setElapsed(0);
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 115000);
    try {
      const res = await fetch(`/api/rfp/${project.id}/agent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }), signal: ctrl.signal });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `The advisor could not respond (${res.status}).`); }
      const data = (await res.json()) as { narrative?: string; project?: Project };
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
      const res = await fetch(`/api/rfp/${project.id}/draft-question`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not draft."); }
      const data = (await res.json()) as { question: RfpQuestion & { category: string } };
      setDraft(data.question);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not draft."); }
    finally { setDrafting(false); }
  }

  function addDraft() {
    if (!project || !draft) return;
    const { category, ...q } = draft;
    const sections = [...project.rfp_sections];
    let sec = sections.find((s) => s.category === category);
    if (!sec) { sec = { category, included: true, questions: [] }; sections.push(sec); }
    sec.included = true;
    if (!sec.questions.some((x) => x.id === q.id)) sec.questions.push({ ...q, priority: q.priority === "optional" ? "recommended" : q.priority });
    persist({ ...project, rfp_sections: sections });
    setDraft(null); setIntent("");
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
      const res = await fetch(`/api/rfp/${project.id}/compliance`);
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
      const res = await fetch(`/api/rfp/${project.id}/research`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, count: 4 }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not research."); }
      setResearchSet((await res.json()) as { analysis: string; questions: (RfpQuestion & { category: string })[] });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not research."); }
    finally { setResearching(false); }
  }

  function addResearchQuestion(q: RfpQuestion & { category: string }) {
    if (!project) return;
    const { category, ...rest } = q;
    const sections = [...project.rfp_sections];
    let sec = sections.find((s) => s.category === category);
    if (!sec) { sec = { category, included: true, questions: [] }; sections.push(sec); }
    sec.included = true;
    if (!sec.questions.some((x) => x.id === rest.id)) sec.questions.push({ ...rest, priority: "recommended" });
    persist({ ...project, rfp_sections: sections });
  }

  function addBankQuestion(category: string, q: { id: string; text: string; buyer_lens: string; supplier_lens: string }) {
    if (!project) return;
    const sections = [...project.rfp_sections];
    let sec = sections.find((s) => s.category === category);
    if (!sec) { sec = { category, included: true, questions: [] }; sections.push(sec); }
    sec.included = true;
    if (!sec.questions.some((x) => x.id === q.id)) {
      sec.questions.push({ id: q.id, feature_id: "custom", text: q.text, evidence_requested: "", rationale: q.buyer_lens ? `Buyer lens: ${q.buyer_lens}` : "Netify question bank", priority: "recommended", source: "bank", buyer_lens: q.buyer_lens, supplier_lens: q.supplier_lens, mandatory: false, weight: 3 } as RfpQuestion);
    }
    persist({ ...project, rfp_sections: sections });
  }

  async function loadEvaluations() {
    if (!project) return;
    try {
      const res = await fetch(`/api/rfp/${project.id}/evaluation`);
      if (res.ok) setEvaluations(((await res.json()) as { evaluations: Evaluation[] }).evaluations);
    } catch { /* ignore */ }
  }

  async function refreshConnections() {
    if (!project) return;
    try {
      const res = await fetch(`/api/rfp/${project.id}/connect`);
      if (res.ok) setConnections(((await res.json()) as { connections: Connection[] }).connections);
    } catch { /* ignore */ }
  }

  async function suggestSuppliers() {
    if (!project) return;
    try {
      const res = await fetch("/api/openapi/build_sase_shortlist", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sector: project.buyer.sector ?? null,
          organisation_size: project.buyer.organisation_size ?? "any",
          service_model: project.buyer.operating_model ?? "any",
          required_regions: project.buyer.regions ?? [],
          shortlist_size: 6,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { shortlist: Suggestion[] };
        setSuggestions(data.shortlist);
      }
    } catch { /* ignore */ }
  }

  async function inviteSupplier(slug: string, intro: string) {
    if (!project) return;
    try {
      const res = await fetch(`/api/rfp/${project.id}/connect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vendor_slug: slug, intro }) });
      if (res.ok) refreshConnections();
    } catch { /* ignore */ }
  }

  async function connectAction(slug: string, action: string, body: string) {
    if (!project) return;
    try {
      const res = await fetch(`/api/rfp/${project.id}/connect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vendor_slug: slug, action, body }) });
      if (res.ok) { refreshConnections(); setMsgDraft({ ...msgDraft, [slug]: "" }); }
    } catch { /* ignore */ }
  }

  async function publishToCurated() {
    if (!project || publishing) return;
    setPublishing(true); setPublishMsg(null); setError(null);
    try {
      const res = await fetch(`/api/rfp/${project.id}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ manage_token: project.manage_token }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not publish.");
      setProject({ ...project, status: data.status ?? "published" });
      setPublishMsg(`Published, and invited ${data.invited?.length ?? 0} best-fit suppliers. What happens next: the suppliers appear under "Suppliers" below, each with a private link (they don't need an account, they reply via that link). When they respond, click "Load responses" under "Evaluate supplier responses" to read and compare them. There's no separate account or portal — this page is your dashboard, so bookmark your private link above to come back and track replies any time.`);
      refreshConnections();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish."); }
    finally { setPublishing(false); }
  }

  // The buyer's own way back in. There is no account: this page (the RFP id URL,
  // with the manage token held in localStorage) is the buyer's dashboard, so we
  // surface it as a copyable, bookmarkable link.
  function copyManageLink() {
    if (!project) return;
    navigator.clipboard.writeText(`${window.location.origin}/rfp-builder/${project.id}`);
    setManageCopied(true); setTimeout(() => setManageCopied(false), 2000);
  }

  function copySupplierLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/rfp-builder/supplier/${token}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function exportMarkdown() {
    if (!project) return;
    const lines = [`# ${project.title}`, "", `Methodology v${project.methodology_version}. Scope: ${project.buyer.product_scope}. Delivery: ${project.buyer.operating_model}.`, ""];
    for (const s of project.rfp_sections.filter((x) => x.included)) {
      const active = s.questions.filter((q) => q.priority !== "optional");
      if (!active.length) continue;
      lines.push(`## ${s.category}`, "");
      active.forEach((q, i) => {
        lines.push(`${i + 1}. ${q.mandatory ? "[MANDATORY] " : ""}${q.text}`);
        lines.push(`   Evidence: ${q.evidence_requested}`);
        lines.push("");
      });
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rfp-${project.id}.md`;
    a.click();
  }

  async function copyShare() {
    if (!project) return;
    const url = `${window.location.origin}/rfp-builder/${project.id}/respond?token=${project.share_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const activeCount = useMemo(() => project ? project.rfp_sections.reduce((n, s) => n + (s.included ? s.questions.filter((q) => q.priority !== "optional").length : 0), 0) : 0, [project]);

  if (!project) {
    return (
      <div className="rounded-2xl border border-[var(--ink-900)] p-8">
        <h2 className="text-xl mb-2">Start your RFP</h2>
        <p className="text-[var(--ink-700)] mb-5 max-w-2xl">
          An <strong>RFP</strong> (request for proposal) is the set of questions you send to suppliers so you can compare them fairly. This tool helps you write one for SASE, SSE or SD-WAN, invite the right suppliers, and compare their replies. It takes about four steps:
        </p>
        <div className="grid sm:grid-cols-4 gap-3 mb-6 max-w-3xl">
          {[
            ["1. Describe", "Your sector, number of sites, regions and any rules you must meet."],
            ["2. Build questions", "We draft them for you. Add or remove any you like."],
            ["3. Invite suppliers", "Send your RFP to the best-fit vendors in one click."],
            ["4. Compare replies", "We flag any answers that need a closer look."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3">
              <p className="text-sm font-medium">{t}</p>
              <p className="text-xs text-[var(--ink-600,#555)] mt-0.5">{d}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-[var(--ink-600,#555)] mb-5 max-w-2xl">
          Two ways to build it, and you can switch between them at any time: <strong>AI agent</strong> (chat in plain English and it writes the RFP for you) or <strong>Build it myself</strong> (pick the questions by hand, with AI help when you want it). Nothing is sent to any supplier until you choose to invite them.
        </p>
        <button onClick={() => startRfp()} disabled={creating} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
          {creating ? "Starting..." : "Start my RFP"}
        </button>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {/* Plain-language guide to the whole flow */}
      <div className="mb-6 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base,#faf9f7)] p-3 text-xs leading-relaxed text-[var(--ink-600,#555)]">
        <span className="font-medium text-[var(--ink-800)]">How this works.</span> An RFP is the list of questions you send to suppliers. <strong>1.</strong> Set the basics below. <strong>2.</strong> Build your questions, by chatting to the AI agent or picking them yourself. <strong>3.</strong> Invite suppliers further down the page. <strong>4.</strong> Load and compare their replies. Everything saves automatically as you go, and nothing reaches a supplier until you invite them.
      </div>

      <p className="eyebrow mb-2">Step 1 — the basics</p>
      {/* Top bar: scope, model, mode, lifecycle */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6 pb-5 border-b border-[var(--ink-300,#ccc)]">
        <div>
          <p className="eyebrow mb-1">Scope</p>
          <select value={project.buyer.product_scope} onChange={(e) => setScope(e.target.value)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm bg-white">
            {SCOPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <p className="eyebrow mb-1">Delivery model</p>
          <select value={project.buyer.operating_model} onChange={(e) => setModel(e.target.value)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm bg-white">
            {MODELS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
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
          <button onClick={exportMarkdown} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Export</button>
          <button onClick={copyShare} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">{copied ? "Copied" : "Supplier link"}</button>
        </div>
      </div>

      <p className="eyebrow mb-2">Step 2 — build your questions</p>
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
              {messages.map((m, i) => (
                <div key={i} className={`text-sm whitespace-pre-wrap ${m.role === "user" ? "text-[var(--ink-500)]" : "text-[var(--ink-800)] border-l-2 border-[var(--accent)] pl-3"}`}>
                  {m.role === "user" ? `You: ${m.content}` : m.content}
                </div>
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
            <p className="text-xs text-[var(--ink-500)] -mt-3">Add questions from any of these, in any order. Each one you add appears in your RFP on the right. Tools: the AI research tool, the Netify question bank, your own AI-drafted question, or the full methodology library.</p>
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
                        <p className="text-xs text-[var(--ink-400,#9ca3af)] italic mt-0.5">{q.rationale} · {q.category}</p>
                        <button onClick={() => addResearchQuestion(q)} className="mt-1 px-3 py-1 text-xs border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Add</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Netify question bank browser */}
            {bank && (
              <div className="border border-[var(--ink-300,#ccc)] rounded-sm p-4">
                <button onClick={() => setBankOpen(!bankOpen)} className="w-full flex items-center justify-between text-left">
                  <span className="eyebrow">Netify question bank (v{bank.version})</span>
                  <span aria-hidden="true">{bankOpen ? "−" : "+"}</span>
                </button>
                <p className="text-xs text-[var(--ink-500)] mt-1">Analyst-written questions with buyer and supplier lenses. The matching sector pack is suggested first.</p>
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
                                  {q.supplier_lens && <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-0.5">Supplier: {q.supplier_lens}</p>}
                                  <button onClick={() => addBankQuestion(sec.title, q)} className="mt-1 px-2.5 py-1 text-xs border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Add</button>
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
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
                  </div>
                )}
              </div>
            )}
            {/* AI custom question composer */}
            <div className="border border-[var(--ink-900)] rounded-sm p-4">
              <p className="eyebrow mb-2">Add your own question with AI</p>
              <textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={2} placeholder="Describe what you want to ask, e.g. how they isolate unmanaged contractor laptops on the plant network." className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
              <button onClick={draftQuestion} disabled={drafting || !intent.trim()} className="mt-2 px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">{drafting ? "Drafting..." : "Draft with AI"}</button>
              {draft && (
                <div className="mt-3 border-t border-[var(--ink-200,#e5e5e5)] pt-3 text-sm">
                  <p className="font-medium">{draft.text}</p>
                  <p className="text-xs text-[var(--ink-500)] mt-1">Evidence: {draft.evidence_requested}</p>
                  <p className="text-xs text-[var(--ink-400,#9ca3af)] italic mt-1">{draft.rationale} · {draft.category} · {draft.source}</p>
                  <button onClick={addDraft} className="mt-2 px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Add to RFP</button>
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
          <h2 className="text-lg mb-1">{project.title}</h2>
          <p className="text-sm text-[var(--ink-500)] mb-1">Sector: {project.buyer.sector ?? "not set"}. Sites: {project.buyer.site_count ?? "not set"}. Compliance: {project.buyer.compliance.join(", ") || "none set"}.</p>
          <p className="text-xs text-[var(--ink-400,#9ca3af)] mb-4">Stage: <span className="uppercase">{project.status}</span> — an RFP moves through {STATUS_FLOW.join(" → ")} as you publish and suppliers respond.</p>
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
                        {q.supplier_lens && <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-0.5">Supplier: {q.supplier_lens}</p>}
                        {!q.buyer_lens && <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-0.5 italic">{q.rationale}</p>}
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
          <span>Require suppliers to accept an NDA before they can see the full RFP and respond. Suppliers see only a short scope summary until they accept.</span>
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

            <p className="text-xs text-[var(--ink-500)]">Current version: v{nda.version}. Changing the wording, link or source bumps the version, so suppliers who accepted earlier are asked to re-accept the new terms.</p>

            <div>
              <p className="eyebrow mb-2">Suppliers who have accepted ({ndaAccepts.length})</p>
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
      <section className="mt-10 border-t border-[var(--ink-300,#ccc)] pt-6">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h2 className="text-lg">Suppliers</h2>
          <div className="flex gap-2">
            <button onClick={suggestSuppliers} className="px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Suggest best-fit suppliers</button>
            <button onClick={publishToCurated} disabled={publishing} className="px-3.5 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">{publishing ? "Publishing..." : project.status === "published" ? "Re-publish to curated list" : "Publish to curated suppliers"}</button>
          </div>
        </div>
        <p className="text-sm text-[var(--ink-500)] mb-3"><strong>Step 3.</strong> Suppliers are the graded vendors from the Netify marketplace. <strong>Suggest best-fit suppliers</strong> finds the closest matches to what you described. <strong>Publish to curated suppliers</strong> invites that whole set in one go. Or invite them one at a time, then message them, request a demo, or ask for contact details. Each supplier gets a private link to read your RFP and reply.</p>
        <div className="mb-3 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base)] p-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[var(--ink-700)]"><strong>Your private link to this RFP.</strong> No account needed — this page is your dashboard. Bookmark or copy this link to come back any time and track supplier replies.</span>
          <code className="text-xs text-[var(--ink-600,#555)] break-all">{`${typeof window !== "undefined" ? window.location.origin : ""}/rfp-builder/${project.id}`}</code>
          <button onClick={copyManageLink} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">{manageCopied ? "Copied" : "Copy my link"}</button>
        </div>
        {publishMsg && <p className="text-sm text-emerald-700 mb-3">{publishMsg}</p>}

        {suggestions && suggestions.length > 0 && (
          <div className="mb-4">
            <p className="eyebrow mb-2">Suggested (best-fit for your context)</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.filter((s) => !connections.some((c) => c.vendor_slug === s.slug)).map((s) => (
                <button key={s.slug} onClick={() => inviteSupplier(s.slug, `We are running a SASE and SD-WAN RFP and would like ${s.name} to participate.`)} className="px-3.5 py-1.5 text-sm rounded-full border border-amber-500 bg-amber-50 hover:bg-amber-100 transition-colors">
                  Invite {s.name} ({s.score})
                </button>
              ))}
            </div>
          </div>
        )}

        {connections.length === 0 && <p className="text-sm text-[var(--ink-500)]">No suppliers invited yet.</p>}
        <div className="space-y-3">
          {connections.map((c) => (
            <details key={c.vendor_slug} className="border border-[var(--ink-300,#ccc)] rounded-sm">
              <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer flex justify-between">
                <span>{c.vendor_name}</span>
                <span className="text-xs uppercase tracking-wide text-[var(--ink-500)]">{c.status}</span>
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
                <textarea value={msgDraft[c.vendor_slug] ?? ""} onChange={(e) => setMsgDraft({ ...msgDraft, [c.vendor_slug]: e.target.value })} rows={2} placeholder="Message to the supplier" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
                <div className="mt-2 flex gap-2 flex-wrap">
                  <button onClick={() => connectAction(c.vendor_slug, "message", msgDraft[c.vendor_slug] ?? "")} disabled={!msgDraft[c.vendor_slug]} className="px-3 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">Send</button>
                  <button onClick={() => connectAction(c.vendor_slug, "demo_request", "")} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Request demo</button>
                  <button onClick={() => connectAction(c.vendor_slug, "contact_request", "")} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Request contact</button>
                  <button onClick={() => copySupplierLink(c.token)} className="px-3 py-1.5 text-sm border border-[var(--ink-300,#ccc)] rounded-full hover:border-[var(--ink-900)]">Copy supplier link</button>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Evaluation: independent cross-check of supplier responses */}
      <section className="mt-10 border-t border-[var(--ink-300,#ccc)] pt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg">Evaluate supplier responses</h2>
          <button onClick={loadEvaluations} className="px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Load responses</button>
        </div>
        <p className="text-sm text-[var(--ink-500)] mb-3"><strong>Step 4.</strong> Once suppliers reply, click <strong>Load responses</strong>. Their answers are cross-checked against Netify&#39;s independent capability grades, and any claim that goes beyond the evidence is flagged for you to question.</p>
        {evaluations && evaluations.length === 0 && <p className="text-sm text-[var(--ink-500)]">No responses yet. Share the supplier link and publish the RFP.</p>}
        {evaluations && evaluations.map((ev) => (
          <details key={ev.vendor} className="border border-[var(--ink-300,#ccc)] rounded-sm mb-2">
            <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer">
              {ev.vendor} · {ev.answered}/{ev.total} answered
              {ev.flags > 0 && <span className="ml-2 text-amber-700">{ev.flags} claim{ev.flags > 1 ? "s" : ""} to verify</span>}
            </summary>
            <div className="px-4 pb-3 space-y-2">
              {ev.checks.filter((c) => c.flag !== "supported").map((c, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium text-[var(--ink-800)]">{c.question}</p>
                  <p className="text-[var(--ink-600,#555)]">Answer: {c.answer || "(none)"}</p>
                  <p className={`text-xs mt-0.5 ${c.flag === "claim_exceeds_evidence" ? "text-amber-700" : "text-[var(--ink-500)]"}`}>{c.note}</p>
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
            {benchmark.median_response_completeness != null && ` Median supplier response completeness: ${Math.round(benchmark.median_response_completeness * 100)}%.`}
            {benchmark.top_mandatory_questions && benchmark.top_mandatory_questions.length > 0 && ` Most-required capabilities: ${benchmark.top_mandatory_questions.slice(0, 5).map((q) => q.name).join(", ")}.`}
          </p>
          <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-1">Anonymised aggregate, counts only.</p>
        </section>
      )}

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  );
}
