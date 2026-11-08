"use client";
import { useEffect, useRef, useState } from "react";
import SignIn from "@/components/SignIn";
import { studioJson } from "./useStudioProject";
import type { StudioDraft } from "@/lib/opportunity-studio";
import type { StudioBidRequest } from "@/lib/studio-engagement";
import { canonicalQuestions } from "@/lib/rfp-question-bank";
type Data = {
  requirement: StudioDraft;
  request: StudioBidRequest | null;
  status: string;
};
export default function StudioSupplier({ projectId, testEnvironment=false }: { projectId: string; testEnvironment?:boolean }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [copied, setCopied] = useState(false);
  const messageAttempts = useRef(
    new Map<string, { body: string; id: string }>(),
  );
  const url = `/sase/api/marketplace/projects/${encodeURIComponent(projectId)}/engagement/`;
  async function refresh() {
    try {
      setData(await studioJson<Data>(url + "?role=supplier"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let active = true;
    studioJson<Data>(url + "?role=supplier")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [url]);
  async function act(body: {
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
        setMessage("");
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function assistant() {
    setBusy(true);
    try {
      const a = await studioJson<{ token: string; expires_at: number }>(url, {
        method: "POST",
        body: JSON.stringify({ action: "assistant" }),
      });
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            endpoint: window.location.origin + "/sase/api/mcp/",
            project_id: projectId,
            assistant_token: a.token,
            expires_at: a.expires_at,
            tools: [
              "read_supplier_project",
              "request_to_bid",
              "message_studio_buyer",
            ],
            instructions:
              "Read this published project. Obtain my explicit consent before requesting to bid or sending a message. Messages require buyer approval and a UUID idempotency_key.",
          },
          null,
          2,
        ),
      );
      setCopied(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ns-studio">
      {testEnvironment && (
        <div className="ns-preview-ribbon">
          <span>ISOLATED TEST WORKSPACE</span>
          <span>
            Test records only. Email is captured; no external delivery.
          </span>
        </div>
      )}
      <header className="ns-header">
        <a className="ns-logo" href="/sase/opportunities/board/">
          netify<span>®</span>
        </a>
        <span>Supplier workspace</span>
        <button onClick={refresh}>Refresh project</button>
      </header>
      <main className="ns-supplier-page" id="main-content">
        <p className="ns-eyebrow">OPPORTUNITY · {projectId}</p>
        <h1>
          {data
            ? `${data.requirement.scope} ${data.requirement.format.toUpperCase()}`
            : "View this opportunity"}
        </h1>
        {error && (
          <p role="alert" className="ns-error">
            {error}
          </p>
        )}
        <SignIn simple
          role="supplier"
          onAuthed={refresh}
          onSignedOut={() => {
            setData(null);
            setError("Sign in to view this requirement.");
          }}
          prompt="Use your work email to view this requirement. Your supplier profile must already be approved by Netify."
        />
        {data && (
          <>
            <p className="ns-small">
              Anonymous requirement. The buyer’s account and contact details
              stay private.
            </p>
            <section className="ns-supplier-document">
              <p className="ns-preserve">{data.requirement.requirement}</p>
              <dl>
                <div>
                  <dt>Sites / users</dt>
                  <dd>
                    {data.requirement.sites || "Not stated"} /{" "}
                    {data.requirement.users || "Not stated"}
                  </dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>{data.requirement.regions.join(", ")}</dd>
                </div>
                <div>
                  <dt>Management</dt>
                  <dd>{data.requirement.service}</dd>
                </div>
                <div>
                  <dt>Timing</dt>
                  <dd>{data.requirement.timescale}</dd>
                </div>
              </dl>
              {data.requirement.format === "rfp" && (
                <ol>
                  {canonicalQuestions()
                    .filter((q) => data.requirement.questionIds.includes(q.id))
                    .map((q) => (
                      <li key={q.id}>{q.text}</li>
                    ))}
                </ol>
              )}
            </section>
            {data.status !== "open" ? (
              <p>This opportunity is closed.</p>
            ) : !data.request ? (
              <section className="ns-supplier-document">
                <h2>Request to bid</h2>
                <label className="ns-field">
                  <span>Why is your company a fit for this requirement?</span>
                  <textarea
                    value={reason}
                    maxLength={4000}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain relevant experience, coverage and how you would approach the project."
                  />
                </label>
                <button
                  className="ns-primary"
                  disabled={busy || reason.trim().length < 20}
                  onClick={() => act({ action: "request", reason })}
                >
                  Send request to bid
                </button>
              </section>
            ) : (
              <section className="ns-supplier-document">
                <h2>Your request: {data.request.status}</h2>
                <p className="ns-preserve">{data.request.reason}</p>
                {data.request.status === "requested" && (
                  <p>
                    The buyer will decide whether to open a private
                    conversation. Refresh this page to check.
                  </p>
                )}
                {data.request.status === "approved" && (
                  <>
                    <h3>Private project conversation</h3>
                    <ol>
                      {data.request.messages.map((m) => (
                        <li key={m.id}>
                          <strong>
                            {m.from === "supplier" ? "You" : "Buyer"}
                          </strong>
                          <p className="ns-preserve">{m.body}</p>
                        </li>
                      ))}
                    </ol>
                    <label className="ns-field">
                      <span>Your message or proposal</span>
                      <textarea
                        value={message}
                        maxLength={10000}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </label>
                    <button
                      className="ns-primary"
                      disabled={busy || !message.trim()}
                      onClick={() =>
                        act({
                          action: "message",
                          vendor_slug: data.request!.vendor_slug,
                          body: message,
                          idempotency_key: crypto.randomUUID(),
                        })
                      }
                    >
                      Send private response
                    </button>
                  </>
                )}
              </section>
            )}
            <details className="ns-supplier-document">
              <summary>Use your AI assistant with this project</summary>
              <p>
                Connect your MCP client to this site’s /sase/api/mcp/ endpoint,
                then share this scoped, private handoff. Access expires after
                one hour. Your supplier approval is checked on every call.
              </p>
              <button disabled={busy} onClick={assistant}>
                {copied
                  ? "Private handoff copied"
                  : "Copy private assistant handoff"}
              </button>
              <button
                disabled={busy}
                onClick={() => act({ action: "disconnect_assistant" })}
              >
                Disconnect assistant access
              </button>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
