"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignIn from "@/components/SignIn";

type Memory = {
  email: string; company_name: string; orca_status: string; orca_code_on_file: boolean;
  target_customer_type: string[]; preferred_sectors: string[]; broadband_focus: string[]; preferred_addons: string[];
  monthly_opportunity_target: number; sales_capacity: string; margin_or_commission_goal: string; blockers: string[]; notes: string[];
};
type Goal = { outcome: string; kind: string; targets: { opportunity_count: number; segment: string }; status: string } | null;
type Artefact = { id: string; kind: string; title: string; content: string; external: boolean; created: number };
type Task = { id: string; title: string; detail: string; due_ts: number | null; status: string };
type Approval = { id: string; kind: string; summary: string; payload: Record<string, string>; rationale: string; status: string; created: number };
type DigestItem = { kind: string; severity: string; message: string; recommendation: string };
type Digest = { id: string; created: number; summary: string; items: DigestItem[]; pending_external: number; sends: number };
type Audit = { id: string; action: string; actor: string; summary: string; rationale: string; ts: number };
type Workspace = { email: string; memory: Memory; goal: Goal; artefacts: Artefact[]; tasks: Task[]; approvals: Approval[]; digests: Digest[]; audit: Audit[] };

const card = "rounded-md border border-[var(--ink-200,#e5e5e5)] p-4";
const field = "w-full rounded border border-[var(--ink-300,#ccc)] p-2 text-sm";
const ORCA = ["not_applied", "applied", "in_onboarding", "live"];
const GOAL_KINDS = ["generate_opportunities", "run_campaign", "prioritise_fttp_reviews", "complete_onboarding", "target_sector"];

export default function PartnerWorkspace() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/sase/api/partner");
    if (res.status === 401) { setNeedsAuth(true); setLoading(false); return; }
    const d = await res.json();
    setWs(d as Workspace);
    setLoading(false);
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load().catch(() => setLoading(false)));
  }, [load]);

  if (loading) return <p className="text-sm text-[var(--ink-500)]">Loading your workspace…</p>;
  if (needsAuth) return (
    <div className="max-w-md">
      <SignIn role="buyer" prompt="Sign in with your work email to open your BT Business reseller workspace. The agent remembers your profile, holds your goal, and drafts plans and outreach for your approval." />
    </div>
  );
  if (!ws) return <p className="text-sm text-[var(--ink-500)]">Workspace unavailable.</p>;

  const pending = ws.approvals.filter((a) => a.status === "pending");

  return (
    <div className="space-y-8">
      <MemoryPanel memory={ws.memory} onSaved={load} busy={busy} setBusy={setBusy} />
      <GoalPanel goal={ws.goal} onSaved={load} busy={busy} setBusy={setBusy} />
      <Assistant onDone={load} />

      {/* Latest digest + generate */}
      <section className={card}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Partner digest</h3>
          <button onClick={async () => { setBusy("digest"); await fetch("/sase/api/partner/digest", { method: "POST" }); await load(); setBusy(""); }} disabled={busy === "digest"} className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60">{busy === "digest" ? "Generating…" : "Generate partner digest"}</button>
        </div>
        {ws.digests[0] ? (
          <div>
            <p className="text-xs text-[var(--ink-500)] mb-1">{new Date(ws.digests[0].created).toLocaleString("en-GB")} · sends={ws.digests[0].sends}</p>
            <ul className="space-y-2">
              {ws.digests[0].items.map((it, i) => (
                <li key={i} className={`text-sm border-l-2 pl-3 ${it.severity === "high" ? "border-red-500" : it.severity === "warn" ? "border-amber-500" : "border-[var(--ink-300,#ccc)]"}`}>
                  <p className="font-medium">{it.message}</p>{it.recommendation && <p className="text-[var(--ink-600)]">{it.recommendation}</p>}
                </li>
              ))}
            </ul>
          </div>
        ) : <p className="text-sm text-[var(--ink-500)]">No digest yet. Generate one to see recommended next actions toward your goal.</p>}
      </section>

      {/* Approval queue */}
      <section className={card}>
        <h3 className="font-semibold mb-1">Drafts awaiting your approval {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500 text-zinc-950 text-xs px-2 py-0.5">{pending.length}</span>}</h3>
        <p className="text-sm text-[var(--ink-600)] mb-3">Customer, account-manager and BT-facing drafts. Nothing is sent. (Sending arrives in a later release.)</p>
        {pending.length === 0 ? <p className="text-sm text-[var(--ink-500)]">No drafts waiting.</p> : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <li key={a.id} className="border border-[var(--ink-200,#e5e5e5)] rounded p-3">
                <p className="text-sm font-medium">{a.summary}</p>
                <p className="text-xs text-[var(--ink-600)] mb-1">Why: {a.rationale}</p>
                {a.payload.body && <p className="text-sm whitespace-pre-wrap bg-[var(--ink-50,#fafafa)] rounded p-2 my-2">{a.payload.body}</p>}
                <div className="flex gap-2">
                  <button onClick={async () => { setBusy(a.id); await fetch("/sase/api/partner/approvals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", approval_id: a.id }) }); await load(); setBusy(""); }} disabled={busy === a.id} className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60">Approve</button>
                  <button onClick={async () => { setBusy(a.id); await fetch("/sase/api/partner/approvals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reject", approval_id: a.id }) }); await load(); setBusy(""); }} disabled={busy === a.id} className="rounded-full border border-[var(--ink-300,#ccc)] px-4 py-1.5 text-sm hover:bg-[var(--ink-100,#f5f5f5)] disabled:opacity-60">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Artefacts */}
      <section className={card}>
        <h3 className="font-semibold mb-2">Artefacts the assistant produced</h3>
        {ws.artefacts.length === 0 ? <p className="text-sm text-[var(--ink-500)]">None yet. Ask the assistant for a sales plan, call script, objection handling or a commission scenario.</p> : (
          <ul className="space-y-2">
            {ws.artefacts.slice(0, 20).map((a) => (
              <details key={a.id} className="border border-[var(--ink-200,#e5e5e5)] rounded p-2">
                <summary className="text-sm cursor-pointer"><span className="rounded bg-[var(--ink-100,#f0f0f0)] px-1.5 py-0.5 text-xs mr-2">{a.kind.replace(/_/g, " ")}</span>{a.title}</summary>
                <pre className="text-sm whitespace-pre-wrap mt-2 text-[var(--ink-700)]">{a.content}</pre>
              </details>
            ))}
          </ul>
        )}
      </section>

      {/* Tasks */}
      {ws.tasks.length > 0 && (
        <section className={card}>
          <h3 className="font-semibold mb-2">Follow-up tasks</h3>
          <ul className="space-y-1 text-sm">
            {ws.tasks.filter((t) => t.status === "open").map((t) => (
              <li key={t.id}>• {t.title}{t.due_ts ? ` (due ${new Date(t.due_ts).toLocaleDateString("en-GB")})` : ""}{t.detail ? ` — ${t.detail}` : ""}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Audit */}
      <details className={card}>
        <summary className="font-semibold cursor-pointer">Audit trail ({ws.audit.length})</summary>
        <ul className="mt-3 space-y-2">
          {ws.audit.map((a) => (
            <li key={a.id} className="text-xs text-[var(--ink-700)] border-b border-[var(--ink-100,#f0f0f0)] pb-2">
              <span className="font-mono text-[var(--ink-500)]">{new Date(a.ts).toLocaleString("en-GB")}</span> <span className="font-medium">[{a.actor}] {a.action}</span> — {a.summary}
              {a.rationale && <div className="text-[var(--ink-500)]">Why: {a.rationale}</div>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function MemoryPanel({ memory, onSaved, busy, setBusy }: { memory: Memory; onSaved: () => void; busy: string; setBusy: (s: string) => void }) {
  const [m, setM] = useState(memory);
  const arr = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
  async function save() {
    setBusy("memory");
    await fetch("/sase/api/partner/memory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      company_name: m.company_name, orca_status: m.orca_status, orca_code_on_file: m.orca_code_on_file,
      monthly_opportunity_target: Number(m.monthly_opportunity_target), sales_capacity: m.sales_capacity, margin_or_commission_goal: m.margin_or_commission_goal,
      target_customer_type: m.target_customer_type, preferred_sectors: m.preferred_sectors, broadband_focus: m.broadband_focus, preferred_addons: m.preferred_addons, blockers: m.blockers, notes: m.notes,
    }) });
    await onSaved(); setBusy("");
  }
  return (
    <section className={card}>
      <h3 className="font-semibold mb-1">Partner profile (memory)</h3>
      <p className="text-sm text-[var(--ink-600)] mb-3">What the assistant remembers about you across sessions. Editable; your changes overwrite what it learned.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Company<input className={field} value={m.company_name} onChange={(e) => setM({ ...m, company_name: e.target.value })} /></label>
        <label className="text-sm">ORCA status<select className={field} value={m.orca_status} onChange={(e) => setM({ ...m, orca_status: e.target.value })}>{ORCA.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="text-sm">Monthly opportunity target<input type="number" min={0} className={field} value={m.monthly_opportunity_target} onChange={(e) => setM({ ...m, monthly_opportunity_target: Number(e.target.value) })} /></label>
        <label className="text-sm">Sales capacity<input className={field} value={m.sales_capacity} onChange={(e) => setM({ ...m, sales_capacity: e.target.value })} placeholder="e.g. 2 reps, 5 hrs/week" /></label>
      </div>
      <label className="block text-sm mt-3">Target customer type<input className={field} value={m.target_customer_type.join(", ")} onChange={(e) => setM({ ...m, target_customer_type: arr(e.target.value) })} placeholder="SME, micro" /></label>
      <label className="block text-sm mt-2">Preferred sectors<input className={field} value={m.preferred_sectors.join(", ")} onChange={(e) => setM({ ...m, preferred_sectors: arr(e.target.value) })} placeholder="retail, healthcare" /></label>
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        <label className="text-sm">Broadband focus<input className={field} value={m.broadband_focus.join(", ")} onChange={(e) => setM({ ...m, broadband_focus: arr(e.target.value) })} placeholder="fttp, sogea" /></label>
        <label className="text-sm">Add-ons<input className={field} value={m.preferred_addons.join(", ")} onChange={(e) => setM({ ...m, preferred_addons: arr(e.target.value) })} placeholder="cloud_voice_express, threat_protection" /></label>
      </div>
      <label className="block text-sm mt-2">Blockers<input className={field} value={m.blockers.join(", ")} onChange={(e) => setM({ ...m, blockers: arr(e.target.value) })} placeholder="no call list, awaiting ORCA" /></label>
      <button onClick={save} disabled={busy === "memory"} className="mt-3 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60">{busy === "memory" ? "Saving…" : "Save profile"}</button>
    </section>
  );
}

function GoalPanel({ goal, onSaved, busy, setBusy }: { goal: Goal; onSaved: () => void; busy: string; setBusy: (s: string) => void }) {
  const [outcome, setOutcome] = useState(goal?.outcome ?? "");
  const [kind, setKind] = useState(goal?.kind ?? "generate_opportunities");
  const [count, setCount] = useState(goal?.targets.opportunity_count ?? 0);
  async function save() {
    setBusy("goal");
    await fetch("/sase/api/partner/goal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome, kind, opportunity_count: Number(count) }) });
    await onSaved(); setBusy("");
  }
  return (
    <section className={card}>
      <h3 className="font-semibold mb-1">Your goal</h3>
      <p className="text-sm text-[var(--ink-600)] mb-3">What you are trying to achieve. The assistant plans toward it and the digest tracks it.</p>
      <label className="block text-sm mb-2">Outcome<input className={field} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Generate 10 BT broadband opportunities this month" /></label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Kind<select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>{GOAL_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}</select></label>
        <label className="text-sm">Opportunity target<input type="number" min={0} className={field} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
      </div>
      <button onClick={save} disabled={busy === "goal"} className="mt-3 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60">{busy === "goal" ? "Saving…" : goal ? "Update goal" : "Set goal"}</button>
    </section>
  );
}

function Assistant({ onDone }: { onDone: () => void }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([{ role: "assistant", content: "Hi. Tell me your target customers and goal, and I will draft a sales plan, scripts, objection handling and a commission model. I can also draft outreach for your approval. I never contact anyone without you approving it." }]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages]);

  async function send() {
    if (!prompt.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next); setPrompt(""); setBusy(true);
    try {
      const res = await fetch("/sase/api/partner/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const d = await res.json();
      setMessages([...next, { role: "assistant", content: d.narrative || d.error || "Done." }]);
      await onDone(); // refresh artefacts/tasks/approvals
    } catch { setMessages([...next, { role: "assistant", content: "Something went wrong. Try again." }]); }
    finally { setBusy(false); }
  }

  return (
    <section className={card}>
      <h3 className="font-semibold mb-2">Partner assistant</h3>
      <div ref={scroller} className="max-h-80 overflow-y-auto space-y-3 mb-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <span className={`inline-block rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-amber-500 text-zinc-950" : "bg-[var(--ink-100,#f0f0f0)] text-[var(--ink-900)]"} whitespace-pre-wrap text-left`}>{m.content}</span>
          </div>
        ))}
        {busy && <p className="text-sm text-[var(--ink-500)]">Working…</p>}
      </div>
      <div className="flex gap-2">
        <input className={field} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="e.g. Build me a campaign for SME retail customers" />
        <button onClick={send} disabled={busy} className="rounded-full bg-zinc-900 text-white px-4 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-60">Send</button>
      </div>
    </section>
  );
}
