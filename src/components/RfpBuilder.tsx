"use client";

/**
 * Buyer-side agentic RFP builder. Conversation-first: the Claude agent at
 * /api/rfp/[id]/agent reads and writes the RFP entity directly, so the
 * panel on the right reflects whatever the agent changed. No submit buttons;
 * the flow is the conversation.
 */

import { useEffect, useRef, useState } from "react";

type RfpQuestion = { id: string; feature_id: string; text: string; evidence_requested: string; rationale: string; priority: "required" | "recommended" | "optional" };
type RfpSection = { category: string; included: boolean; questions: RfpQuestion[] };
type Project = {
  id: string;
  status: string;
  title: string;
  buyer: { organisation: string; sector: string | null; site_count: number | null; regions: string[]; compliance: string[]; operating_model: string };
  rfp_sections: RfpSection[];
  share_token: string;
  methodology_version: string;
};

const STATUS_FLOW = ["draft", "review", "published", "qa", "evaluation"];

export default function RfpBuilder({ initialId }: { initialId?: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialId) loadProject(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  async function loadProject(id: string) {
    try {
      const res = await fetch(`/api/rfp/${id}`);
      if (res.ok) setProject((await res.json()) as Project);
      else setError("This RFP could not be loaded.");
    } catch {
      setError("This RFP could not be loaded.");
    }
  }

  async function startRfp() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rfp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) {
        const e = (await res.json()) as { error?: string };
        throw new Error(e.error ?? "Could not start an RFP.");
      }
      const p = (await res.json()) as Project;
      setProject(p);
      window.history.replaceState(null, "", `/rfp-builder/${p.id}`);
      setMessages([{ role: "assistant", content: "Let's build your RFP. Tell me about your organisation: what sector are you in, roughly how many sites, which regions, and any compliance obligations (for example UK GDPR, PCI DSS, IEC 62443)?" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start an RFP.");
    } finally {
      setCreating(false);
    }
  }

  async function send() {
    if (!project || !prompt.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next);
    setPrompt("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rfp/${project.id}/agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) {
        const e = (await res.json()) as { error?: string };
        throw new Error(e.error ?? "The advisor could not respond.");
      }
      const data = (await res.json()) as { narrative?: string; project?: Project };
      if (data.project) setProject(data.project);
      if (data.narrative) setMessages([...next, { role: "assistant", content: data.narrative }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The advisor could not respond.");
    } finally {
      setBusy(false);
    }
  }

  async function copyShare() {
    if (!project) return;
    const url = `${window.location.origin}/rfp-builder/${project.id}/respond?token=${project.share_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-[var(--ink-900)] p-8 text-center">
        <h2 className="text-xl mb-2">Start a SASE and SD-WAN RFP</h2>
        <p className="text-[var(--ink-700)] mb-5 max-w-xl mx-auto">
          Describe your business need in plain language. The advisor builds a
          methodology-backed RFP with you, suggests best-fit vendors, and manages
          supplier questions through to evaluation.
        </p>
        <button onClick={startRfp} disabled={creating} className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
          {creating ? "Starting..." : "Start my RFP"}
        </button>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  const activeCount = project.rfp_sections.reduce((n, s) => n + (s.included ? s.questions.filter((q) => q.priority !== "optional").length : 0), 0);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Conversation */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <p className="eyebrow">RFP advisor</p>
          <span className="text-xs text-[var(--ink-500)] uppercase tracking-wide">Status: {project.status}</span>
        </div>
        <div ref={scroller} className="flex-1 max-h-[28rem] overflow-y-auto space-y-3 border border-[var(--ink-300,#ccc)] rounded-sm p-4 bg-white">
          {messages.map((m, i) => (
            <div key={i} className={`text-sm whitespace-pre-wrap ${m.role === "user" ? "text-[var(--ink-500)]" : "text-[var(--ink-800)] border-l-2 border-[var(--accent)] pl-3"}`}>
              {m.role === "user" ? `You: ${m.content}` : m.content}
            </div>
          ))}
          {busy && <p className="text-sm text-[var(--ink-500)]">Thinking...</p>}
        </div>
        <div className="mt-3 flex gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder="Example: We are a healthcare provider, 40 sites across the UK, need ZTNA and strong DLP, fully managed."
            className="flex-1 border border-[var(--ink-300,#ccc)] rounded-sm p-3 text-sm"
          />
          <button onClick={send} disabled={busy || !prompt.trim()} className="px-4 py-2 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50 self-end">
            Send
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex items-center gap-3 flex-wrap text-sm">
          <button onClick={copyShare} className="px-3.5 py-1.5 border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">
            {copied ? "Supplier link copied" : "Copy supplier response link"}
          </button>
          <span className="text-[var(--ink-500)]">Lifecycle: {STATUS_FLOW.join(" → ")}</span>
        </div>
      </div>

      {/* Live RFP state */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg">{project.title}</h2>
          <span className="text-xs text-[var(--ink-500)]">{activeCount} active questions</span>
        </div>
        <p className="text-sm text-[var(--ink-500)] mb-4">
          Methodology v{project.methodology_version}. Sector: {project.buyer.sector ?? "not set"}. Sites: {project.buyer.site_count ?? "not set"}. Compliance: {project.buyer.compliance.join(", ") || "none set"}.
        </p>
        <div className="space-y-3">
          {project.rfp_sections.filter((s) => s.included).map((s) => {
            const active = s.questions.filter((q) => q.priority !== "optional");
            if (active.length === 0) return null;
            return (
              <details key={s.category} className="border border-[var(--ink-300,#ccc)] rounded-sm">
                <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer">{s.category} ({active.length})</summary>
                <div className="px-4 pb-3 space-y-3">
                  {active.map((q) => (
                    <div key={q.id} className="text-sm">
                      <p className="font-medium text-[var(--ink-800)]">
                        <span className={`mr-2 text-xs uppercase ${q.priority === "required" ? "text-amber-700" : "text-[var(--ink-500)]"}`}>{q.priority}</span>
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
  );
}
