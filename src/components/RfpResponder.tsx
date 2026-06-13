"use client";

/** Supplier view: read a published RFP, submit responses, ask categorised questions. */

import { useEffect, useState } from "react";

type Q = { id: string; text: string; evidence_requested: string; priority: string; buyer_lens?: string; supplier_lens?: string };
type Section = { category: string; included: boolean; questions: Q[] };
type Project = { id: string; title: string; status: string; rfp_sections: Section[] };
type Thread = { id: string; vendor: string; category: string; question: string; status: string; buyer_answer: string };

export default function RfpResponder({ id, token }: { id: string; token: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [vendor, setVendor] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [threads, setThreads] = useState<Thread[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/rfp/${id}`);
        if (!res.ok) { setError("This RFP could not be found."); return; }
        const p = (await res.json()) as Project;
        setProject(p);
        const tr = await fetch(`/api/rfp/${id}/thread`).then((r) => r.json()).catch(() => ({ threads: [] }));
        setThreads(tr.threads ?? []);
      } catch {
        setError("This RFP could not be loaded.");
      }
    })();
  }, [id]);

  async function submit(submitFinal: boolean) {
    if (!vendor.trim()) { setError("Enter your organisation name first."); return; }
    setError(null);
    try {
      const res = await fetch(`/api/rfp/${id}/respond`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor, answers, submit: submitFinal }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not save."); }
      setNotice(submitFinal ? "Response submitted. Thank you." : "Draft saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }

  async function ask() {
    if (!vendor.trim() || !question.trim()) { setError("Enter your organisation name and a question."); return; }
    setError(null);
    try {
      const res = await fetch(`/api/rfp/${id}/thread`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor, question }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not send."); }
      const t = (await res.json()) as Thread;
      setThreads([...threads, t]);
      setQuestion("");
      setNotice("Question sent to the buyer.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    }
  }

  if (error && !project) return <p className="text-red-700">{error}</p>;
  if (!project) return <p className="text-[var(--ink-500)]">Loading RFP...</p>;

  const open = project.status === "published" || project.status === "qa";

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Supplier response</p>
        <h1 className="text-2xl mb-1">{project.title}</h1>
        <p className="text-sm text-[var(--ink-500)]">Status: {project.status}. {open ? "Open for responses." : "Not yet open for responses."}</p>
      </div>

      <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Your organisation name" className="w-full max-w-md border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />

      {open && project.rfp_sections.filter((s) => s.included).map((s) => {
        const active = s.questions.filter((q) => q.priority !== "optional");
        if (!active.length) return null;
        return (
          <section key={s.category}>
            <h2 className="text-lg mb-3">{s.category}</h2>
            <div className="space-y-4">
              {active.map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-medium">{q.text}</p>
                  {q.evidence_requested && <p className="text-xs text-[var(--ink-500)]">Evidence requested: {q.evidence_requested}</p>}
                  {q.supplier_lens && <p className="text-xs text-[var(--ink-500)] mb-1">What a strong answer shows: {q.supplier_lens}</p>}
                  <textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} rows={2} className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {open && (
        <div className="flex gap-3">
          <button onClick={() => submit(false)} className="px-4 py-2 border border-[var(--ink-900)] rounded-full text-sm hover:bg-[var(--ink-900)] hover:text-white transition-colors">Save draft</button>
          <button onClick={() => submit(true)} className="px-4 py-2 bg-amber-500 text-zinc-950 font-medium rounded-full text-sm hover:bg-amber-400 transition-colors">Submit response</button>
        </div>
      )}

      <section className="border-t border-[var(--ink-300,#ccc)] pt-6">
        <h2 className="text-lg mb-2">Ask the buyer a question</h2>
        <p className="text-sm text-[var(--ink-500)] mb-3">Questions are categorised automatically and routed to the buyer for a response.</p>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="Example: Is in-line TLS inspection in scope for all sites, or head office only?" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
        <button onClick={ask} className="mt-2 px-4 py-2 border border-[var(--ink-900)] rounded-full text-sm hover:bg-[var(--ink-900)] hover:text-white transition-colors">Send question</button>
        {threads.length > 0 && (
          <ul className="mt-4 space-y-2">
            {threads.map((t) => (
              <li key={t.id} className="text-sm border-b border-[var(--ink-200,#e5e5e5)] pb-2">
                <span className="text-xs uppercase text-[var(--ink-400,#9ca3af)] mr-2">{t.category}</span>
                {t.question}
                {t.status === "answered" && <span className="block text-[var(--ink-700)] mt-1 border-l-2 border-[var(--accent)] pl-2">Buyer: {t.buyer_answer}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
