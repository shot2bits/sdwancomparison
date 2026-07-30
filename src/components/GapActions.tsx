"use client";

/**
 * Gap acceptance on the Project Home (Phase D1): the missing moment from
 * step 3, in its natural place. Accepting records a consent entry with the
 * exact wording shown (Article 13) plus a history event; the publish gate
 * and this list read the same openSecurityGaps() helper, so accepting the
 * last gap here makes the existing publish flow pass with no other change.
 *
 * "Answer (re-scope)" arrives with D4; no dead buttons until then.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export const ACCEPT_GAP_PREFIX = "I accept proceeding without answering: ";

export default function GapActions({
  projectId,
  manage,
  gaps,
}: {
  projectId: string;
  manage?: string;
  gaps: Array<{ field: string; question: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(gap: { field: string; question: string }) {
    setBusy(gap.field);
    setError(null);
    try {
      const res = await fetch(`/sase/api/security-sourcing/project/${projectId}/accept-gap`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manage_token: manage ?? "", gap_field: gap.field, consent: true }),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setError(data.error ?? `Could not record the acceptance (${res.status}).`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not reach the server; try again.");
    } finally {
      setBusy(null);
    }
  }

  if (gaps.length === 0) return null;
  return (
    <div className="space-y-3">
      {gaps.map((g) => (
        <div key={g.field} className="rounded-sm border border-amber-300 bg-amber-50 p-3">
          <p className="m-0 text-sm text-[var(--ink-800)]">{g.question}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => accept(g)}
              disabled={busy !== null}
              className="rounded-full border border-[var(--ink-900,#111)] px-3 py-1 text-xs hover:bg-[var(--ink-900,#111)] hover:text-white transition-colors disabled:opacity-50"
            >
              {busy === g.field ? "Recording…" : "Accept and proceed"}
            </button>
            <span className="text-xs text-[var(--ink-500)]">
              Accepting is recorded on the project and visible in the story; vendors see accepted gaps as stated assumptions.
            </span>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
