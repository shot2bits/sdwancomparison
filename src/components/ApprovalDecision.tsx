"use client";

/**
 * The approver's decision bar (D5): approve or decline, optional note,
 * one decision, recorded on the project. The token in the page URL is
 * the only credential; this component never sees anything else.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalDecision({ projectId, token, role, name }: { projectId: string; token: string; role: string; name: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "approved" | "declined">(null);
  const [error, setError] = useState("");

  async function decide(decision: "approved" | "declined") {
    if (busy) return;
    setBusy(decision);
    setError("");
    try {
      const res = await fetch(`/sase/api/rfp/${projectId}/signoff/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, decision, note }),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) setError(data.error ?? `Could not record the decision (${res.status}).`);
      else router.refresh();
    } catch {
      setError("Could not reach the server; try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-white p-5">
      <p className="m-0 text-sm font-semibold text-zinc-950">Your decision as {role}</p>
      <p className="m-0 mt-1 text-sm text-zinc-700">
        {name}, approving records your approval on the project; declining records the declination. Either way the
        decision becomes part of the permanent project record. Publishing remains the buyer&apos;s call: a declination
        does not block them, but publishing against it requires their explicit recorded confirmation.
      </p>
      <label className="mt-3 block text-xs font-medium text-zinc-600">
        Optional note (recorded with your decision)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none" />
      </label>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          onClick={() => decide("approved")}
          disabled={busy !== null}
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {busy === "approved" ? "Recording…" : "Approve publication"}
        </button>
        <button
          onClick={() => decide("declined")}
          disabled={busy !== null}
          className="rounded-full border border-[var(--ink-900,#111)] px-5 py-2.5 text-sm hover:bg-[var(--ink-900,#111)] hover:text-white transition-colors disabled:opacity-50"
        >
          {busy === "declined" ? "Recording…" : "Decline"}
        </button>
      </div>
    </div>
  );
}
