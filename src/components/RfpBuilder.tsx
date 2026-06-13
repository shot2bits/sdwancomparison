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

type RfpQuestion = { id: string; feature_id: string; text: string; evidence_requested: string; rationale: string; priority: "required" | "recommended" | "optional"; source: "methodology" | "custom"; mandatory: boolean; weight: number };
type RfpSection = { category: string; included: boolean; questions: RfpQuestion[] };
type Buyer = { organisation: string; sector: string | null; site_count: number | null; regions: string[]; compliance: string[]; operating_model: string; product_scope: string };
type Project = { id: string; status: string; title: string; buyer: Buyer; rfp_sections: RfpSection[]; share_token: string; methodology_version: string };

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
  const scroller = useRef<HTMLDivElement>(null);

  // AI custom question composer
  const [intent, setIntent] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<(RfpQuestion & { category: string }) | null>(null);

  useEffect(() => { if (initialId) loadProject(initialId); /* eslint-disable-next-line */ }, [initialId]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages]);

  async function loadProject(id: string) {
    try {
      const res = await fetch(`/api/rfp/${id}`);
      if (res.ok) setProject((await res.json()) as Project);
      else setError("This RFP could not be loaded.");
    } catch { setError("This RFP could not be loaded."); }
  }

  async function startRfp() {
    setCreating(true); setError(null);
    try {
      const res = await fetch("/api/rfp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not start an RFP."); }
      const p = (await res.json()) as Project;
      setProject(p);
      window.history.replaceState(null, "", `/rfp-builder/${p.id}`);
      setMessages([{ role: "assistant", content: "Let's build your RFP. What sector are you in, roughly how many sites, which regions, and any compliance obligations (for example UK GDPR, PCI DSS, IEC 62443)? You can also just pick a scope and delivery model under Build it myself." }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start an RFP."); }
    finally { setCreating(false); }
  }

  async function persist(updated: Project, regenerate = false) {
    setProject(updated);
    try {
      const res = await fetch(`/api/rfp/${updated.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...updated, regenerate }) });
      if (res.ok && regenerate) setProject((await res.json()) as Project);
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
    setMessages(next); setPrompt(""); setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/rfp/${project.id}/agent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "The advisor could not respond."); }
      const data = (await res.json()) as { narrative?: string; project?: Project };
      if (data.project) setProject(data.project);
      if (data.narrative) setMessages([...next, { role: "assistant", content: data.narrative }]);
    } catch (e) { setError(e instanceof Error ? e.message : "The advisor could not respond."); }
    finally { setBusy(false); }
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
      <div className="rounded-2xl border border-[var(--ink-900)] p-8 text-center">
        <h2 className="text-xl mb-2">Start a SASE, SSE and SD-WAN RFP</h2>
        <p className="text-[var(--ink-700)] mb-5 max-w-xl mx-auto">
          Build it conversationally with the AI agent, or pick your scope and
          delivery model and select from researched questions. Either way, every
          question maps to the Netify methodology and you can add your own with
          AI help.
        </p>
        <button onClick={startRfp} disabled={creating} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
          {creating ? "Starting..." : "Start my RFP"}
        </button>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div>
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
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--ink-500)] uppercase tracking-wide">{project.status} · {activeCount} questions</span>
          <button onClick={exportMarkdown} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Export</button>
          <button onClick={copyShare} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">{copied ? "Copied" : "Supplier link"}</button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setMode("agent")} className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${mode === "agent" ? "bg-amber-500 border-amber-500 text-zinc-950 font-medium" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}>AI agent</button>
        <button onClick={() => setMode("manual")} className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${mode === "manual" ? "bg-amber-500 border-amber-500 text-zinc-950 font-medium" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}>Build it myself</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: agent or library depending on mode */}
        {mode === "agent" ? (
          <div className="flex flex-col">
            <div ref={scroller} className="flex-1 max-h-[26rem] overflow-y-auto space-y-3 border border-[var(--ink-300,#ccc)] rounded-sm p-4 bg-white">
              {messages.map((m, i) => (
                <div key={i} className={`text-sm whitespace-pre-wrap ${m.role === "user" ? "text-[var(--ink-500)]" : "text-[var(--ink-800)] border-l-2 border-[var(--accent)] pl-3"}`}>
                  {m.role === "user" ? `You: ${m.content}` : m.content}
                </div>
              ))}
              {busy && <p className="text-sm text-[var(--ink-500)]">Thinking...</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder="Example: healthcare, 40 UK sites, ZTNA and DLP, fully managed. Make it more cloud-security focused." className="flex-1 border border-[var(--ink-300,#ccc)] rounded-sm p-3 text-sm" />
              <button onClick={send} disabled={busy || !prompt.trim()} className="px-4 py-2 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50 self-end">Send</button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
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
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg">{project.title}</h2>
            <span className="text-xs text-[var(--ink-500)]">{STATUS_FLOW.join(" → ")}</span>
          </div>
          <p className="text-sm text-[var(--ink-500)] mb-4">Sector: {project.buyer.sector ?? "not set"}. Sites: {project.buyer.site_count ?? "not set"}. Compliance: {project.buyer.compliance.join(", ") || "none set"}.</p>
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
                        <p className="text-xs text-[var(--ink-500)] mt-0.5">Evidence: {q.evidence_requested}</p>
                        <p className="text-xs text-[var(--ink-400,#9ca3af)] mt-0.5 italic">{q.rationale}</p>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  );
}
