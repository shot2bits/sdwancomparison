"use client";
import { SOURCING_ACTION_LABELS } from "@/lib/sourcing-contract";
import { useEffect, useState } from "react";
export default function SourcingConfirmation() {
  const [result, setResult] = useState<{
    error?: string;
    already_confirmed?: boolean;
    sign_in_url?: string;
    status?: string;
    project_url?: string;
    brief?: string;
    recipients?: { name?: string; slug: string; actions: string[] }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  async function load(confirm = false) {
    const p = new URLSearchParams(window.location.hash.slice(1));
    setBusy(true);
    try {
      const r = await fetch("/sase/api/sourcing/confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: p.get("request"),
          token: p.get("token"),
          confirm,
        }),
      });
      setResult(await r.json());
    } catch {
      setResult({ error: "Unable to open the request. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    let active = true;
    fetch("/sase/api/sourcing/confirm/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p.get("request"),
        token: p.get("token"),
        confirm: false,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (active) setResult(data);
      })
      .catch(() => {
        if (active) setResult({ error: "Unable to open the request." });
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div>
      <h1>Confirm your sourcing request</h1>
      {result?.error ? (
        <div>
          <p role="alert">{result.error}</p>
          <button disabled={busy} onClick={() => void load(false)}>
            Try again
          </button>
        </div>
      ) : result?.status === "desk_review" ? (
        <div>
          <p>
            Your request is confirmed and queued for Netify desk review. No
            supplier has been contacted automatically.
          </p>
          {result.already_confirmed && (
            <p>
              Already confirmed.{" "}
              <a href={result.sign_in_url}>Sign in with the same work email</a>{" "}
              to reopen your private project.
            </p>
          )}
          {result.project_url && !result.already_confirmed && (
            <a className="sourcing-primary" href={result.project_url}>
              Open your private project →
            </a>
          )}
          <p>
            After first confirmation, this browser can reopen your project for
            30 days. On another device, sign in with the same work email.
          </p>
        </div>
      ) : result ? (
        <>
          <p>
            Approve this exact anonymous brief and the listed recipient actions.
            No account is created.
          </p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{result.brief}</pre>
          <ul>
            {result.recipients?.map((r) => (
              <li key={r.slug}>
                {r.name ?? r.slug}:{" "}
                {r.actions
                  .map(
                    (a) =>
                      SOURCING_ACTION_LABELS[
                        a as keyof typeof SOURCING_ACTION_LABELS
                      ],
                  )
                  .join(", ")}
              </li>
            ))}
          </ul>
          <button
            className="sourcing-primary"
            disabled={busy}
            onClick={() => void load(true)}
          >
            Confirm this request
          </button>
        </>
      ) : (
        <p>Opening your private request…</p>
      )}
    </div>
  );
}
