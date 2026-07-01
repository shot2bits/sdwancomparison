"use client";

/** Supplier view: read a published RFP, submit responses, ask categorised questions.
 *  When the buyer requires an NDA, the full detail and the response form stay
 *  locked behind a click-to-accept step; only a scope teaser is shown until then. */

import { useEffect, useState } from "react";

type Q = { id: string; text: string; evidence_requested: string; priority: string; buyer_lens?: string; supplier_lens?: string };
type Section = { category: string; included: boolean; questions: Q[] };
type Teaser = { sector: string | null; organisation_size: string; product_scope: string; operating_model: string; region_count: number; question_count: number };
type Project = { id: string; title: string; status: string; rfp_sections: Section[]; nda_required?: boolean; teaser?: Teaser };
type Nda = { required: boolean; source: string; text: string; link: string; version: number };
type Thread = { id: string; vendor: string; category: string; question: string; status: string; buyer_answer: string };

export default function RfpResponder({ id, token }: { id: string; token: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [nda, setNda] = useState<Nda | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [vendor, setVendor] = useState("");
  const [signatory, setSignatory] = useState("");
  const [agree, setAgree] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [threads, setThreads] = useState<Thread[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Initial load: NDA config + a redacted (supplier-lens) project view.
  useEffect(() => {
    (async () => {
      try {
        const ndaRes = await fetch(`/sase/api/rfp/${id}/nda`).then((r) => r.json()).catch(() => null);
        if (ndaRes?.nda) setNda(ndaRes.nda);
        await loadProject("");
        const tr = await fetch(`/sase/api/rfp/${id}/thread`).then((r) => r.json()).catch(() => ({ threads: [] }));
        setThreads(tr.threads ?? []);
      } catch {
        setError("This RFP could not be loaded.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadProject(forVendor: string) {
    const qs = `?as=supplier${forVendor.trim() ? `&vendor=${encodeURIComponent(forVendor.trim())}` : ""}`;
    const res = await fetch(`/sase/api/rfp/${id}${qs}`);
    if (!res.ok) { setError("This RFP could not be found."); return; }
    const p = (await res.json()) as Project;
    setProject(p);
  }

  // When the supplier names their organisation, re-check whether they've already
  // accepted the NDA (e.g. on a return visit) and, if so, load the full detail.
  async function checkVendor(name: string) {
    if (!nda?.required || !name.trim()) return;
    try {
      const r = await fetch(`/sase/api/rfp/${id}/nda?vendor=${encodeURIComponent(name.trim())}`).then((x) => x.json());
      if (r?.accepted) { setAccepted(true); await loadProject(name); }
    } catch { /* non-fatal */ }
  }

  async function acceptNda() {
    setError(null); setNotice(null);
    if (!vendor.trim()) { setError("Enter your organisation name first."); return; }
    if (!signatory.trim()) { setError("Enter the full name of the person accepting."); return; }
    if (!agree) { setError("Tick the box to confirm you have read and agree to the NDA."); return; }
    try {
      const res = await fetch(`/sase/api/rfp/${id}/nda`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor, signatory_name: signatory, agree: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not record acceptance."); }
      setAccepted(true);
      await loadProject(vendor);
      setNotice("NDA accepted. The full RFP and response form are now unlocked.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record acceptance."); }
  }

  async function submit(submitFinal: boolean) {
    if (!vendor.trim()) { setError("Enter your organisation name first."); return; }
    setError(null);
    try {
      const res = await fetch(`/sase/api/rfp/${id}/respond`, {
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
      const res = await fetch(`/sase/api/rfp/${id}/thread`, {
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
  const locked = Boolean(nda?.required) && !accepted;
  const t = project.teaser;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Supplier response</p>
        <h1 className="text-2xl mb-1">{project.title}</h1>
        <p className="text-sm text-[var(--ink-500)]">Status: {project.status}. {open ? "Open for responses." : "Not yet open for responses."}</p>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Your organisation name</label>
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} onBlur={(e) => checkVendor(e.target.value)} placeholder="e.g. Aryaka" className="w-full max-w-md border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
      </div>

      {/* NDA gate */}
      {locked && nda && (
        <section className="rounded-sm border border-amber-300 bg-amber-50 p-5 space-y-4">
          <div>
            <p className="eyebrow mb-1">NDA required</p>
            <h2 className="text-lg mb-1">Accept the buyer&rsquo;s NDA to see the full RFP</h2>
            <p className="text-sm text-[var(--ink-700)]">The buyer has asked responding suppliers to accept a non-disclosure agreement before the full requirements and the response form are shown. Below is a summary of the opportunity.</p>
          </div>

          {t && (
            <ul className="text-sm text-[var(--ink-700)] grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {t.sector && <li><span className="text-[var(--ink-500)]">Sector:</span> {t.sector}</li>}
              <li><span className="text-[var(--ink-500)]">Organisation size:</span> {t.organisation_size}</li>
              <li><span className="text-[var(--ink-500)]">Scope:</span> {t.product_scope}</li>
              <li><span className="text-[var(--ink-500)]">Operating model:</span> {t.operating_model}</li>
              <li><span className="text-[var(--ink-500)]">Regions:</span> {t.region_count}</li>
              <li><span className="text-[var(--ink-500)]">Questions in full RFP:</span> {t.question_count}</li>
            </ul>
          )}

          <div>
            <p className="text-sm font-medium mb-1">Non-disclosure agreement</p>
            {nda.link && <p className="text-sm mb-2">Buyer&rsquo;s NDA document: <a href={nda.link} target="_blank" rel="noopener noreferrer" className="underline">{nda.link}</a></p>}
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-white p-3 text-xs text-[var(--ink-800)]">{nda.text || "The buyer will share the NDA document at the link above."}</pre>
          </div>

          <div className="space-y-2">
            <input value={signatory} onChange={(e) => setSignatory(e.target.value)} placeholder="Full name of person accepting" className="w-full max-w-md border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
            <label className="flex items-start gap-2 text-sm text-[var(--ink-700)]">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
              <span>I confirm I have read the NDA and have authority to accept it on behalf of {vendor.trim() || "my organisation"}.</span>
            </label>
            <button onClick={acceptNda} className="px-4 py-2 bg-amber-500 text-zinc-950 font-medium rounded-full text-sm hover:bg-amber-400 transition-colors">Accept NDA and unlock RFP</button>
            <p className="text-xs text-[var(--ink-500)]">We record your organisation, the name above, the date and time, and a request fingerprint as proof of acceptance.</p>
          </div>
        </section>
      )}

      {/* Full detail + response form — only once unlocked (or no NDA required) */}
      {!locked && open && project.rfp_sections.filter((s) => s.included).map((s) => {
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

      {!locked && open && (
        <div className="flex gap-3">
          <button onClick={() => submit(false)} className="px-4 py-2 border border-[var(--ink-900)] rounded-full text-sm hover:bg-[var(--ink-900)] hover:text-white transition-colors">Save draft</button>
          <button onClick={() => submit(true)} className="px-4 py-2 bg-amber-500 text-zinc-950 font-medium rounded-full text-sm hover:bg-amber-400 transition-colors">Submit response</button>
        </div>
      )}

      {!locked && (
        <section className="border-t border-[var(--ink-300,#ccc)] pt-6">
          <h2 className="text-lg mb-2">Ask the buyer a question</h2>
          <p className="text-sm text-[var(--ink-500)] mb-3">Questions are categorised automatically and routed to the buyer for a response.</p>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="Example: Is in-line TLS inspection in scope for all sites, or head office only?" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
          <button onClick={ask} className="mt-2 px-4 py-2 border border-[var(--ink-900)] rounded-full text-sm hover:bg-[var(--ink-900)] hover:text-white transition-colors">Send question</button>
          {threads.length > 0 && (
            <ul className="mt-4 space-y-2">
              {threads.map((tr) => (
                <li key={tr.id} className="text-sm border-b border-[var(--ink-200,#e5e5e5)] pb-2">
                  <span className="text-xs uppercase text-[var(--ink-400,#9ca3af)] mr-2">{tr.category}</span>
                  {tr.question}
                  {tr.status === "answered" && <span className="block text-[var(--ink-700)] mt-1 border-l-2 border-[var(--accent)] pl-2">Buyer: {tr.buyer_answer}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
