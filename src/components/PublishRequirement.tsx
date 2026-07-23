"use client";

/**
 * The publish rail for the requirement page (Robert's approved mockup,
 * 21 July 2026): consent shown verbatim (recorded server-side by the
 * engine publish bridge), one primary action, gaps handled above it via
 * GapActions. Handles the three server answers: sign-in required (401),
 * declined approval needing explicit confirmation (409), and success,
 * which reloads into the published state.
 */

import { useState } from "react";
import SignIn from "@/components/SignIn";
import CodeEntry from "@/components/CodeEntry";
import { ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";

export default function PublishRequirement({ projectId, manage, gapCount }: { projectId: string; manage?: string; gapCount: number }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needAuth, setNeedAuth] = useState(false);
  const [error, setError] = useState("");

  async function publish(acknowledgeDeclined = false) {
    if (busy || !consent) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/sase/api/rfp/${projectId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(manage ? { manage_token: manage } : {}),
          list_on_board: true,
          ...(acknowledgeDeclined ? { acknowledge_declined_approval: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.reload();
        return;
      }
      if (data.auth_required) {
        setNeedAuth(true);
      } else if (data.requires_decline_confirmation) {
        if (window.confirm(data.confirmation_text || "An approver declined. Publish anyway? This decision becomes part of the permanent project record.")) {
          setBusy(false);
          await publish(true);
          return;
        }
      } else {
        setError(data.error || "Could not publish; try again.");
      }
    } catch {
      setError("Network error; try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {gapCount > 0 ? (
        <p className="m-0 text-xs text-[var(--ink-600,#555)]">
          Resolve the {gapCount} scoping gap{gapCount === 1 ? "" : "s"} above and the publish button unlocks.
        </p>
      ) : (
        <>
          <label className="flex items-start gap-2 text-xs text-[var(--ink-700)]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>{ENGINE_PUBLISH_CONSENT_TEXT}</span>
          </label>
          <button
            type="button"
            onClick={() => publish(false)}
            disabled={!consent || busy}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Publish to the marketplace"}
          </button>
          {needAuth && (
            <div className="mt-3">
              <p className="m-0 mb-2 text-xs text-[var(--ink-700)]">One step first: publishing reaches named suppliers, so it needs a verified sign-in. Sign in and press publish again.</p>
              <SignIn role="buyer" prompt="Sign in with your work email to publish." />
              <CodeEntry onVerified={() => { setNeedAuth(false); }} />
            </div>
          )}
          {error && <p className="m-0 mt-2 text-sm text-rose-600">{error}</p>}
        </>
      )}
    </div>
  );
}
