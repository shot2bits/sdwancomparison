"use client";
import SignIn from "@/components/SignIn";
import { useEffect, useRef, useState } from "react";
import { studioJson } from "./useStudioProject";
import type { StudioBidRequest } from "@/lib/studio-engagement";
type Data = { requests: StudioBidRequest[] };
export default function StudioEngagement({
  projectId,
  noticeUrl,
}: {
  projectId: string;
  noticeUrl: string;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState<Record<string, string>>({});
  const messageAttempts = useRef(
    new Map<string, { body: string; id: string }>(),
  );
  const url = `/sase/api/marketplace/projects/${encodeURIComponent(projectId)}/engagement/`;
  async function refresh() {
    setError("");
    try {
      setData(await studioJson<Data>(url));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let current = true;
    studioJson<Data>(url)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [url]);
  async function action(body: {
    action: string;
    vendor_slug?: string;
    body?: string;
    [key: string]: unknown;
  }) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let outgoing = body;
      if (body.action === "message") {
        const key = body.vendor_slug!,
          prior = messageAttempts.current.get(key);
        const id =
          prior && prior.body === body.body ? prior.id : crypto.randomUUID();
        messageAttempts.current.set(key, { body: body.body!, id });
        outgoing = { ...body, idempotency_key: id };
      }
      await studioJson(url, { method: "POST", body: JSON.stringify(outgoing) });
      if (body.action === "message") {
        messageAttempts.current.delete(body.vendor_slug!);
        setMessages((old) => ({ ...old, [body.vendor_slug!]: "" }));
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const rows = data?.requests ?? [];
  return (
    <div className="ns-engage">
      <p className="ns-eyebrow">YOUR PUBLISHED PROJECT</p>
      <h1>Supplier requests and proposals</h1>
      <SignIn
        simple
        role="buyer"
        onAuthed={refresh}
        onSignedOut={() => {
          setData(null);
          setError("Sign in to reopen your project.");
        }}
        returnTo={`/sase/studio-preview/?project=${projectId}`}
        prompt="Use the work email that owns this project."
      />
      <p className="ns-lead">
        Your anonymous opportunity is listed.
        <br />
        You choose which suppliers can engage.
      </p>
      <a
        className="ns-download"
        href={noticeUrl || "/sase/opportunities/board/"}
        target="_blank"
        rel="noreferrer"
      >
        View public notice ↗
      </a>
      <p className="ns-small">
        Reference: {projectId}. Refresh to check for new supplier requests and
        proposals.
      </p>
      <button onClick={refresh} disabled={busy}>
        Refresh requests
      </button>
      {error && (
        <p role="alert" className="ns-error">
          {error}
        </p>
      )}

      {!data && !error && <p role="status">Loading supplier activity…</p>}
      {data && (
        <>
          <div className="ns-stats">
            <div>
              <strong>{rows.length}</strong>
              <span>Requests to bid</span>
            </div>
            <div>
              <strong>
                {rows.filter((r) => r.status === "approved").length}
              </strong>
              <span>Engagements approved</span>
            </div>
          </div>
          {!rows.length && (
            <div className="ns-waiting">
              <h2>No supplier requests yet</h2>
              <p>
                Approved suppliers can review the requirement and request to
                bid. A listing does not guarantee responses.
              </p>
            </div>
          )}
          {rows.map((r) => (
            <article className="ns-supplier-document" key={r.vendor_slug}>
              <h2>{r.vendor_name}</h2>
              <p className="ns-preserve">{r.reason}</p>
              <p>Status: {r.status}</p>
              {r.status === "requested" && (
                <div className="ns-actions">
                  <button
                    className="ns-primary"
                    disabled={busy}
                    onClick={() =>
                      action({
                        action: "decide",
                        vendor_slug: r.vendor_slug,
                        decision: "approved",
                      })
                    }
                  >
                    Approve engagement
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      action({
                        action: "decide",
                        vendor_slug: r.vendor_slug,
                        decision: "declined",
                      })
                    }
                  >
                    Decline request
                  </button>
                </div>
              )}
              {r.status === "approved" && (
                <>
                  <p className="ns-small">
                    This private conversation is open. Your account email and
                    company are not automatically shared.
                  </p>
                  <ol>
                    {r.messages.map((m) => (
                      <li key={m.id}>
                        <strong>
                          {m.from === "buyer" ? "You" : r.vendor_name}
                        </strong>
                        <p className="ns-preserve">{m.body}</p>
                      </li>
                    ))}
                  </ol>
                  <label className="ns-field">
                    <span>Message {r.vendor_name}</span>
                    <textarea
                      maxLength={10000}
                      value={messages[r.vendor_slug] ?? ""}
                      onChange={(e) =>
                        setMessages({
                          ...messages,
                          [r.vendor_slug]: e.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    disabled={busy || !messages[r.vendor_slug]?.trim()}
                    className="ns-primary"
                    onClick={() =>
                      action({
                        action: "message",
                        vendor_slug: r.vendor_slug,
                        body: messages[r.vendor_slug],
                        idempotency_key: crypto.randomUUID(),
                      })
                    }
                  >
                    Send private message
                  </button>
                </>
              )}
            </article>
          ))}
        </>
      )}
    </div>
  );
}
