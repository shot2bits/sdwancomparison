"use client";

import { useCallback, useEffect, useState } from "react";

type Goal = {
  rfp_id: string; outcome: string; must_have: string[];
  targets: { deadline_ts: number | null; response_deadline_ts: number | null; budget_direction: string; min_bids: number };
  autonomy: string; status: string;
};
type EvidenceCheck = { key: string; label: string; pass: boolean; detail: string };
type ClaimVsGrade = { feature_id: string; feature_name: string; supplier_claim: string; netify_grade: string; overreach: boolean; note: string };
type Gap = { question_id: string; feature_id: string; category: string; kind: string; detail: string; drafted_clarification: string };
type Review = {
  id: string; vendor: string; vendor_slug: string | null; coverage_ratio: number;
  evidence_checks: EvidenceCheck[]; claim_vs_grade: ClaimVsGrade[];
  llm_quality_summary: string; llm_score: number | null; gaps: Gap[]; goal_fit_note: string; created: number;
};
type Approval = {
  id: string; kind: string; vendor_slug: string; vendor_name: string; summary: string;
  payload: Record<string, string>; rationale: string; status: string; created: number; expires: number;
};
type Audit = { id: string; action: string; actor: string; summary: string; rationale: string; ts: number };
type Risk = { id: string; summary: string; rationale: string; ts: number };
type DigestItem = { kind: string; severity: string; message: string; recommendation: string };
type Digest = { id: string; created: number; summary: string; llm_used: boolean; items: DigestItem[]; proposal_ids: string[] };

const card = "rounded-md border border-[var(--ink-200,#e5e5e5)] p-4";
const pct = (n: number) => `${Math.round(n * 100)}%`;
// The RFP mutation credential is held client-side (the server strips it from
// open reads). A signed-in buyer is authorised by session; an anonymous buyer
// who created the RFP in this browser carries the token here.
const readManageToken = (rfpId: string) => (typeof window !== "undefined" ? localStorage.getItem(`netify_mtok_${rfpId}`) || "" : "");

export default function AgentReviewPanel({ rfpId }: { rfpId: string }) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [loading, setLoading] = useState(true);
  const [notOwner, setNotOwner] = useState(false);
  const [busy, setBusy] = useState<string>("");

  // Goal form state
  const [outcome, setOutcome] = useState("");
  const [mustHave, setMustHave] = useState("");
  const [minBids, setMinBids] = useState(3);

  const load = useCallback(async () => {
    setLoading(true);
    // Adopt a manage key carried from the builder (?manage=…) so the owner
    // gate holds across pages and devices, then keep it out of the URL bar.
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const fromUrl = sp.get("manage");
      if (fromUrl) {
        try { localStorage.setItem(`netify_mtok_${rfpId}`, fromUrl); } catch { /* private mode */ }
        sp.delete("manage");
        const rest = sp.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      }
    }
    const headers: Record<string, string> = {};
    const tok = readManageToken(rfpId);
    if (tok) headers["x-manage-token"] = tok;
    try {
      const [gRes, aRes] = await Promise.all([
        fetch(`/sase/api/rfp/${rfpId}/goal`, { headers }),
        fetch(`/sase/api/rfp/${rfpId}/approvals`, { headers }),
      ]);
      if (gRes.status === 401 || aRes.status === 401) { setNotOwner(true); return; }
      const [g, a] = await Promise.all([gRes.json(), aRes.json()]);
      if (g.goal) {
        setGoal(g.goal);
        setOutcome(g.goal.outcome ?? "");
        setMustHave((g.goal.must_have ?? []).join(", "));
        setMinBids(g.goal.targets?.min_bids ?? 3);
      }
      setApprovals(a.approvals ?? []);
      setReviews(a.reviews ?? []);
      setAudit(a.audit ?? []);
      setRisks(a.risks ?? []);
      setDigests(a.digests ?? []);
    } finally {
      setLoading(false);
    }
  }, [rfpId]);

  useEffect(() => { load(); }, [load]);

  async function saveGoal() {
    setBusy("goal");
    try {
      const res = await fetch(`/sase/api/rfp/${rfpId}/goal`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome, must_have: mustHave.split(",").map((s) => s.trim()).filter(Boolean), targets: { min_bids: Number(minBids) }, manage_token: readManageToken(rfpId) }),
      });
      const data = await res.json();
      if (data.goal) setGoal(data.goal);
      else if (data.auth_required) alert("Sign in as a buyer to set the procurement goal.");
    } finally { setBusy(""); }
  }

  async function decide(item: Approval, action: "approve" | "reject", editedQuestion?: string) {
    setBusy(item.id);
    try {
      const res = await fetch(`/sase/api/rfp/${rfpId}/approvals`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, approval_id: item.id, edited_question: editedQuestion, manage_token: readManageToken(rfpId) }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      await load();
    } finally { setBusy(""); }
  }

  const pending = approvals.filter((a) => a.status === "pending");

  if (loading) return <p className="text-sm text-[var(--ink-500)]">Loading agent review…</p>;

  if (notOwner) {
    return (
      <div className={card}>
        <h3 className="font-semibold mb-1">This review area is private to the buyer</h3>
        <p className="text-sm text-[var(--ink-600)]">
          Bid reviews, goals and approvals belong to the buyer who created this RFP. If that is you, open this page
          from your builder (the Agent review button carries your private key), or sign in with the email you used
          when creating the RFP. Suppliers respond via their response link instead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Goal */}
      <section className={card}>
        <h3 className="font-semibold mb-1">Procurement goal</h3>
        <p className="text-sm text-[var(--ink-600)] mb-3">What the agent is working toward. It reviews every incoming bid against this, without you prompting it.</p>
        <label className="block text-sm font-medium mb-1">Outcome</label>
        <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} placeholder="e.g. Managed SASE for 40 UK and EU sites, PCI and DORA, live by Q4, beat current spend." className="w-full rounded border border-[var(--ink-300,#ccc)] p-2 text-sm mb-3" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Must-haves (comma-separated)</label>
            <input value={mustHave} onChange={(e) => setMustHave(e.target.value)} placeholder="e.g. PCI DSS, zero trust network access, 24/7 UK support" className="w-full rounded border border-[var(--ink-300,#ccc)] p-2 text-sm" />
            <p className="mt-1 text-xs text-[var(--ink-500)]">Plain English is fine — each one is matched against your compliance obligations, the methodology features and the supplier&apos;s answers.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Minimum bids wanted</label>
            <input type="number" min={0} max={20} value={minBids} onChange={(e) => setMinBids(Number(e.target.value))} className="w-28 rounded border border-[var(--ink-300,#ccc)] p-2 text-sm" />
          </div>
        </div>
        <button onClick={saveGoal} disabled={busy === "goal"} className="mt-3 inline-flex items-center rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60">{busy === "goal" ? "Saving…" : goal ? "Update goal" : "Set goal"}</button>
      </section>

      {/* Agent digest (run-loop output) */}
      {digests.length > 0 && (
        <section className={card}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold">Agent digest</h3>
            <span className="text-xs text-[var(--ink-500)]">{new Date(digests[0].created).toLocaleString("en-GB")}</span>
          </div>
          <p className="text-sm text-[var(--ink-700)] mb-3">{digests[0].summary}</p>
          <ul className="space-y-2">
            {digests[0].items.map((it, i) => (
              <li key={i} className={`text-sm border-l-2 pl-3 ${it.severity === "high" ? "border-red-500" : it.severity === "warn" ? "border-amber-500" : "border-[var(--ink-300,#ccc)]"}`}>
                <p className="font-medium">{it.message}</p>
                {it.recommendation && <p className="text-[var(--ink-600)]">{it.recommendation}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--ink-500)] mt-3">The agent monitors this RFP between your visits. It recommends and drafts, but never contacts a supplier without your approval.</p>
        </section>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <section className={card}>
          <h3 className="font-semibold mb-2">Risk flags</h3>
          <ul className="space-y-2">
            {risks.map((r) => (
              <li key={r.id} className="text-sm border-l-2 border-amber-500 pl-3">
                <p className="font-medium">{r.summary}</p>
                {r.rationale && <p className="text-[var(--ink-600)]">Recommended: {r.rationale}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Approval queue */}
      <section className={card}>
        <h3 className="font-semibold mb-1">Pending approvals {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500 text-zinc-950 text-xs px-2 py-0.5">{pending.length}</span>}</h3>
        <p className="text-sm text-[var(--ink-600)] mb-3">Supplier-facing actions the agent has drafted. Nothing is sent until you approve it.</p>
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No actions waiting. When a supplier bids, the agent drafts clarifications here.</p>
        ) : (
          <ul className="space-y-4">
            {pending.map((item) => (
              <ApprovalRow key={item.id} item={item} busy={busy === item.id} onDecide={decide} />
            ))}
          </ul>
        )}
      </section>

      {/* Bid reviews */}
      <section className={card}>
        <h3 className="font-semibold mb-1">Bid reviews</h3>
        <p className="text-sm text-[var(--ink-600)] mb-3">Each review separates deterministic, evidence-based checks from the AI's qualitative second opinion. Netify&apos;s independent grade is shown distinctly from the supplier&apos;s own claim.</p>
        {reviews.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No bids reviewed yet.</p>
        ) : (
          <ul className="space-y-6">
            {reviews.map((rv) => <ReviewCard key={rv.id} rv={rv} />)}
          </ul>
        )}
      </section>

      {/* Audit */}
      <details className={card}>
        <summary className="font-semibold cursor-pointer">Audit trail ({audit.length})</summary>
        <ul className="mt-3 space-y-2">
          {audit.map((a) => (
            <li key={a.id} className="text-xs text-[var(--ink-700)] border-b border-[var(--ink-100,#f0f0f0)] pb-2">
              <span className="font-mono text-[var(--ink-500)]">{new Date(a.ts).toLocaleString("en-GB")}</span>{" "}
              <span className="font-medium">[{a.actor}] {a.action}</span> — {a.summary}
              {a.rationale && <div className="text-[var(--ink-500)]">Why: {a.rationale}</div>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ApprovalRow({ item, busy, onDecide }: { item: Approval; busy: boolean; onDecide: (i: Approval, a: "approve" | "reject", q?: string) => void }) {
  const [q, setQ] = useState(item.payload.question ?? "");
  return (
    <li className="border border-[var(--ink-200,#e5e5e5)] rounded p-3">
      <p className="text-sm font-medium">{item.summary}</p>
      <p className="text-xs text-[var(--ink-600)] mb-2">Why the agent proposes this: {item.rationale}</p>
      <label className="block text-xs font-medium mb-1">Drafted clarification (editable before sending)</label>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} className="w-full rounded border border-[var(--ink-300,#ccc)] p-2 text-sm mb-2" />
      <div className="flex gap-2">
        <button onClick={() => onDecide(item, "approve", q)} disabled={busy} className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60">{busy ? "Working…" : "Approve and send"}</button>
        <button onClick={() => onDecide(item, "reject")} disabled={busy} className="rounded-full border border-[var(--ink-300,#ccc)] px-4 py-1.5 text-sm hover:bg-[var(--ink-100,#f5f5f5)] disabled:opacity-60">Reject</button>
      </div>
    </li>
  );
}

function ReviewCard({ rv }: { rv: Review }) {
  return (
    <li className="border border-[var(--ink-200,#e5e5e5)] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium">{rv.vendor}</p>
        <span className="text-sm text-[var(--ink-600)]">Required coverage: <strong>{pct(rv.coverage_ratio)}</strong></span>
      </div>

      {/* Evidence layer */}
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)] mb-1">Evidence checks (deterministic)</p>
      <ul className="mb-3 space-y-1">
        {rv.evidence_checks.map((c) => (
          <li key={c.key} className="text-sm flex gap-2">
            <span className={c.pass ? "text-emerald-600" : "text-red-600"}>{c.pass ? "✓" : "✗"}</span>
            <span><strong>{c.label}:</strong> {c.detail}</span>
          </li>
        ))}
      </ul>

      {/* Claim vs grade */}
      {rv.claim_vs_grade.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)] mb-1">Supplier claim vs Netify independent grade</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-[var(--ink-500)]">
                  <th className="py-1 pr-3">Feature</th><th className="py-1 pr-3">Supplier claim</th><th className="py-1 pr-3">Netify grade</th><th className="py-1">Flag</th>
                </tr>
              </thead>
              <tbody>
                {rv.claim_vs_grade.map((c, i) => (
                  <tr key={i} className="border-t border-[var(--ink-100,#f0f0f0)] align-top">
                    <td className="py-1 pr-3">{c.feature_name || c.feature_id}</td>
                    <td className="py-1 pr-3 text-[var(--ink-700)]">{c.supplier_claim}</td>
                    <td className="py-1 pr-3"><span className="rounded bg-[var(--ink-100,#f0f0f0)] px-1.5 py-0.5">{c.netify_grade}</span></td>
                    <td className="py-1">{c.overreach ? <span className="text-red-600 font-medium">Overreach</span> : <span className="text-[var(--ink-500)]">Unverified</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LLM layer, clearly labelled */}
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)] mb-1">AI judgement (model opinion{rv.llm_score != null ? `, ${rv.llm_score}/100` : ", unavailable"})</p>
      <p className="text-sm text-[var(--ink-700)] mb-3">{rv.llm_quality_summary}</p>

      {/* Gaps */}
      {rv.gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)] mb-1">Gaps the agent flagged ({rv.gaps.length})</p>
          <ul className="space-y-1">
            {rv.gaps.map((g, i) => (
              <li key={i} className="text-sm"><span className="rounded bg-[var(--ink-100,#f0f0f0)] px-1.5 py-0.5 text-xs mr-1">{g.kind.replace("_", " ")}</span>{g.detail}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
