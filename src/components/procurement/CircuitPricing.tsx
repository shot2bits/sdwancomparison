"use client";
import { useEffect, useRef, useState, useCallback, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import SignIn from "@/components/SignIn";
import {
  CIRCUIT_CONSENT,
  CircuitInputSchema,
  CircuitLineSchema,
  newCircuitLine,
  type CircuitLine,
  type CircuitInput,
  type CircuitRecord,
  CircuitQuoteSchema,
} from "@/lib/circuit-schema";
const endpoint = "/sase/api/circuits/";
const DRAFT = "netify-circuit-draft-v1";
const empty: CircuitInput = {
  company: "",
  sector: "",
  timescale: "",
  scope: "Underlay only",
  lines: [],
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="cp-field">
      <span>{label}</span>
      {isValidElement(children) ? cloneElement(children as ReactElement<{"aria-label"?:string}>, {"aria-label":label}) : children}
    </label>
  );
}
export default function CircuitPricing({ admin = false }: { admin?: boolean }) {
  const [input, setInput] = useState<CircuitInput>(empty),
    [record, setRecord] = useState<CircuitRecord | null>(null),
    [id, setId] = useState(""),
    [list, setList] = useState<CircuitRecord[]>([]),
    [signed, setSigned] = useState(false),
    [recoveringRequest,setRecoveringRequest]=useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [view, setView] = useState(admin ? "requests" : "requirements"),
    [modal, setModal] = useState(""),
    [edit, setEdit] = useState<CircuitLine | null>(null),
    [consent, setConsent] = useState(false),
    [isAdmin, setIsAdmin] = useState(false),
    [proposal, setProposal] = useState(false),
    [agentToken, setAgentToken] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    file = useRef<HTMLInputElement>(null);
  const [quote, setQuote] = useState({
    id: "",
    line_id: "",
    supplier: "",
    reference: "",
    currency: "GBP",
    monthly: "",
    installation: "",
    term: "36 months",
    lead_time: "",
    valid_until: "",
    sla: "",
    resilience_confirmation: "",
    exclusions: "",
    evidence_url: "",
    protection_details: "",
    notes: "",
  });
  const frozen = !!record && record.status !== "draft";
  const adopt = useCallback((r: CircuitRecord) => {
    setRecord(r);
    setInput({
      company: r.company,
      sector: r.sector,
      timescale: r.timescale,
      scope: r.scope,
      lines: r.lines,
    });
    setId(r.id);
    setAgentToken("");
  }, []);
  const refresh = useCallback(async () => {
    try {
      const sessionResponse = await fetch('/sase/api/auth/session', { cache: "no-store" });
      if (!sessionResponse.ok) throw Error("Could not check your sign-in status. Please retry.");
      const session = await sessionResponse.json();
      if (!session.authenticated) { setSigned(false); setIsAdmin(false); setList([]); return; }
      const res = await fetch(endpoint + (admin ? "?admin=1" : ""), { cache: "no-store" });
      if (res.status === 401) {
        setSigned(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setSigned(true);
      setIsAdmin(!!data.admin);
      setList(data.requests ?? []);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, [admin]);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(DRAFT); }
    catch { setError("This browser cannot save your draft on this device. Enable site storage before leaving this page."); }
    const query = new URLSearchParams(location.search);
    if (["quotes","requests"].includes(query.get("view")??"")) setView(query.get("view")!);
    if (!query.get("request") && !admin && saved) {
      try {
        const d = JSON.parse(saved);
        setInput(d.input);
        setId(d.id || crypto.randomUUID());
        setRecord(d.record ?? null);
      } catch {
        setId(crypto.randomUUID());
      }
    } else setId(crypto.randomUUID());
    setLoaded(true);
    void refresh();
    const request = query.get("request");
    setRecoveringRequest(Boolean(request));
    if (request)
      fetch(endpoint + "?id=" + encodeURIComponent(request), { cache: "no-store" })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          adopt(d.request);
        })
        .catch((e) => setError(e.message));
  }, [admin,refresh,adopt]); // initial URL/draft hydration only
  useEffect(() => {
    if (loaded && !frozen && !admin) {
      try { localStorage.setItem(DRAFT, JSON.stringify({ id, input, record })); }
      catch { setError("Your latest changes could not be saved on this device. Keep this page open and enable site storage."); }
    }
  }, [input, id, loaded, frozen, admin, record]);
  useEffect(() => {
    if (modal || edit) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [modal, edit]);
  useEffect(() => {
    if (!record || record.status === "draft") return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible")
        fetch(endpoint + "?id=" + record.id, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.request) setRecord(d.request);
          })
          .catch(() => {});
    }, 30000);
    return () => clearInterval(poll);
  }, [record]);
  async function recoverRequest() {
    await refresh();
    const request=new URLSearchParams(location.search).get('request');
    if(!request)return;
    try {const res=await fetch(endpoint+'?id='+encodeURIComponent(request),{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error);adopt(data.request);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not reopen the request.');}
  }
  async function action(action: string, extra: object = {}) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw Error(d.error);
      adopt(d.request);
      void refresh();
      return d.request as CircuitRecord;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const parsed = CircuitInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues.map((x) => x.message).join(" "));
      return null;
    }
    return action("save", { revision: record?.revision ?? 0, input: parsed.data });
  }
  function updateLine(l: CircuitLine) {
    const parsed = CircuitLineSchema.safeParse(l);
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    setError("");
    l = parsed.data;
    setInput((i) => ({
      ...i,
      lines: i.lines.some((x) => x.id === l.id)
        ? i.lines.map((x) => (x.id === l.id ? l : x))
        : [...i.lines, l],
    }));
    setEdit(null);
  }
  async function openRequest(r: CircuitRecord) {
    setError("");
    try {
      const res = await fetch(endpoint + "?id=" + r.id, { cache: "no-store" }),
        d = await res.json();
      if (!res.ok) throw Error(d.error);
      adopt(d.request);
      history.replaceState(null, "", "?request=" + r.id);
      setView("requirements");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load request.");
    }
  }
  function startNew() {
    setRecord(null);
    setInput(empty);
    setId(crypto.randomUUID());
    setView("requirements");
    history.replaceState(null, "", location.pathname);
    setMessage("New request started. Your saved requests remain below.");
    setAgentToken("");
  }
  async function importFile(f: File) {
    setError("");
    try {
      if (f.size > 2e6) throw Error("Use a CSV or Excel file smaller than 2 MB.");
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/sase/api/circuits/import/", { method: "POST", body: form }),
        data = await res.json();
      if (!res.ok) throw Error(data.error);
      setInput((i) => ({ ...i, lines: [...i.lines, ...data.lines] }));
      setMessage(
        `${data.lines.length} rows imported. Review every address and contact before requesting pricing.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    }
  }
  const locations = input.lines.filter((l) => !l.remote).length,
    remote = input.lines.filter((l) => l.remote).reduce((n, l) => n + l.quantity, 0);
  return (
    <section className="cp-app">
      <header className="cp-heading">
        <div>
          <p>{admin ? "Netify sourcing desk" : "Connectivity for every location"}</p>
          <h1>{admin ? "Circuit pricing requests" : "Go to market. Get real pricing."}</h1>
          <p>
            {admin
              ? "Review private specifications, add sourced offers and check notification delivery."
              : "Build your request once. Netify sources the market; quotes arrive in Market responses."}
          </p>
        </div>
        {recoveringRequest && !signed && <div className="cp-info"><h2>Sign in to view your private pricing</h2><SignIn role="buyer" prompt="Use the work email attached to this request." onAuthed={()=>void recoverRequest()}/></div>}
      {!admin && (
          <button
            className="cp-primary"
            disabled={busy || frozen}
            onClick={() => {
              setConsent(false);
              setModal("review");
            }}
          >
            {frozen ? "Request published" : "Review & request pricing →"}
          </button>
        )}
      </header>
      {!admin && (
        <div className="cp-progress">
          <span className={!frozen ? "active" : ""}>1. Your requirements</span>
          <span className={record?.status === "sourcing" ? "active" : ""}>2. Netify sourcing</span>
          <span className={record?.status === "quotes_available" ? "active" : ""}>
            3. Market responses
          </span>
        </div>
      )}
      <div className="cp-tabs" role="tablist" aria-label="Circuit pricing views">
        {["requirements", "quotes", "requests"].map((v) => (
          <button
            role="tab"
            aria-selected={view === v}
            key={v}
            onClick={() => {
              setView(v);
              if (v === "requests") void refresh();
            }}
          >
            {v === "requirements"
              ? "Requirements"
              : v === "quotes"
                ? `Market responses${record?.quotes.length ? " · " + record.quotes.length : ""}`
                : admin
                  ? "Sourcing queue"
                  : "My pricing requests"}
          </button>
        ))}
        {!admin && isAdmin && <a href="/sase/admin/circuit-pricing/">Netify sourcing desk ↗</a>}
      </div>
      {error && (
        <p className="cp-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="cp-info" role="status">
          {message}
        </p>
      )}
      {view === "requests" && (
        <>
          <h2>{admin ? "Sourcing queue" : "Your saved pricing requests"}</h2>
          {!signed ? (
            <SignIn
              role="buyer"
              onAuthed={() => {
                void refresh();
              }}
            />
          ) : (
            <>
              {!admin && <button onClick={startNew}>＋ New pricing request</button>}
              {list.length === 0 ? (
                <p>No pricing requests yet.</p>
              ) : (
                list.map((r) => (
                  <button className="cp-row" key={r.id} onClick={() => void openRequest(r)}>
                    <strong>
                      {r.company} · {r.lines.length} groups
                    </strong>
                    <span>
                      {r.status.replaceAll("_", " ")} · {r.quotes.length} quotes
                    </span>
                    <span>{new Date(r.updated).toLocaleDateString("en-GB")} →</span>
                  </button>
                ))
              )}
            </>
          )}
        </>
      )}
      {view === "requirements" && (
        <div className="cp-columns">
          <div>
            <div className="cp-section-title">
              <div>
                <h2>Sites & remote users</h2>
                <p>Mix countries, access types and resilience in one request.</p>
              </div>
              {!frozen && !admin && (
                <button
                  onClick={() => {
                    setError("");
                    setEdit(newCircuitLine());
                  }}
                >
                  ＋ Add
                </button>
              )}
            </div>
            {input.lines.length === 0 ? (
              <div className="cp-empty">
                <h2>Add your first site or SIM group</h2>
                <p>Use a full address for fixed connectivity, or quantity for SIM-only orders.</p>
                {!admin && (
                  <button className="cp-primary" onClick={() => setEdit(newCircuitLine())}>
                    Add connection requirements
                  </button>
                )}
              </div>
            ) : (
              input.lines.map((l) => (
                <button className="cp-row" key={l.id} onClick={() => setEdit({ ...l })}>
                  <div>
                    <strong>{l.name}</strong>
                    <p>
                      {l.country} · {l.kind} ·{" "}
                      {l.kind === "4G / 5G SIM only" ? l.quantity + " SIMs" : l.bandwidth}
                    </p>
                    <span>
                      {l.resilience} · {l.operation}
                    </span>
                    {l.router !== "No router" && <p>{l.router}</p>}
                    {l.protect && (
                      <p>CrowdStrike requested · {l.devices} devices · £4.99 + VAT per device</p>
                    )}
                  </div>
                  <span>{frozen ? "View" : "Edit"} →</span>
                </button>
              ))
            )}
            {!frozen && !admin && (
              <>
                <div className="cp-inline">
                  <button onClick={() => file.current?.click()}>
                    Import CSV / Excel site list
                  </button>
                  <a href="/sase/api/circuits/import/">Download CSV template</a>
                  <input
                    ref={file}
                    type="file"
                    accept=".csv,.xlsx"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.[0]) void importFile(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="cp-assistant">
                  <h3>Apply shared requirements</h3>
                  <p>
                    Prepare cellular backup and active/passive failover for all UK Ethernet sites.
                    Review before applying.
                  </p>
                  <button
                    disabled={
                      !input.lines.some(
                        (l) => l.country === "United Kingdom" && l.kind === "Ethernet",
                      )
                    }
                    onClick={() => setProposal(true)}
                  >
                    Prepare changes
                  </button>
                  {proposal && (
                    <div className="cp-info">
                      <p>
                        {
                          input.lines.filter(
                            (l) => l.country === "United Kingdom" && l.kind === "Ethernet",
                          ).length
                        }{" "}
                        UK Ethernet site{input.lines.filter((l) => l.country === "United Kingdom" && l.kind === "Ethernet").length === 1 ? "" : "s"} will change. This replaces their current resilience
                        requirement.
                      </p>
                      <button
                        onClick={() => {
                          setInput((i) => ({
                            ...i,
                            lines: i.lines.map((l) =>
                              l.country === "United Kingdom" && l.kind === "Ethernet"
                                ? {
                                    ...l,
                                    resilience: "Cellular backup",
                                    operation: "Active / passive",
                                  }
                                : l,
                            ),
                          }));
                          setProposal(false);
                        }}
                      >
                        Approve changes
                      </button>
                      <button onClick={() => setProposal(false)}>Discard</button>
                    </div>
                  )}
                </div>
              </>
            )}
            {record && (
              <p>
                <a href="/sase/connector/">Connected assistant tools ↗</a> · Agents can validate
                requirements and read quotes using a private access token.
              </p>
            )}
            {record && !admin && (
              <button
                onClick={async () => {
                  setError("");
                  const r = await fetch("/sase/api/circuits/access/", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ id }),
                  });
                  const d = await r.json();
                  if (r.ok) setAgentToken(d.token);
                  else setError(d.error);
                }}
              >
                Create 1-hour read-only agent token
              </button>
            )}
            {agentToken && (
              <div className="cp-info">
                <p>
                  Private access token: grants read access to this request, including contacts and
                  quotes. Share only with your chosen assistant. Creating another token revokes this
                  one.
                </p>
                <input aria-label="Private agent token" readOnly value={agentToken} />
              </div>
            )}
          </div>
          <aside className="cp-summary">
            <p>Your private pricing request</p>
            <h2>
              {`${locations} location${locations === 1 ? "" : "s"}. ${remote} remote connection${remote === 1 ? "" : "s"}. One market request.`}
            </h2>
            <Field label="Company name (private)">
              <input
                disabled={frozen || admin}
                value={input.company}
                onChange={(e) => setInput({ ...input, company: e.target.value })}
              />
            </Field>
            <Field label="Business sector">
              <input
                disabled={frozen || admin}
                value={input.sector}
                onChange={(e) => setInput({ ...input, sector: e.target.value })}
              />
            </Field>
            <Field label="Required installation date / timescale">
              <input
                disabled={frozen || admin}
                value={input.timescale}
                onChange={(e) => setInput({ ...input, timescale: e.target.value })}
              />
            </Field>
            <Field label="Project scope">
              <select
                disabled={frozen || admin}
                value={input.scope}
                onChange={(e) =>
                  setInput({ ...input, scope: e.target.value as CircuitInput["scope"] })
                }
              >
                <option>Underlay only</option>
                <option>With SD-WAN / SASE</option>
              </select>
            </Field>
            <div className="cp-info">
              <strong>We’ll notify you when pricing arrives</strong>
              <p>
                Quotes appear in Market responses. We’ll email your verified work address when
                Netify adds a response.
              </p>
            </div>
            {!frozen && !admin && (
              <button
                className="cp-primary"
                onClick={() => {
                  setConsent(false);
                  setModal("review");
                }}
              >
                Review & request pricing →
              </button>
            )}
            {frozen && (
              <>
                <p>
                  Published specifications are retained with your quotes. Create a new request for
                  changes.
                </p>
                <a href={"/sase/opportunities/" + record?.opportunity_id + "/room/"}>
                  Open opportunity room ↗
                </a>
              </>
            )}
            <p className="cp-small">
              Company name, addresses and local contacts stay private. A public anonymous notice
              describes the buying requirement.
            </p>
          </aside>
        </div>
      )}
      {view === "quotes" && (
        <>
          <h2>Market responses</h2>
          <p>
            Real sourced offers appear here as Netify adds them. We’ll notify your verified work
            email.
          </p>
          {record?.quotes.length ? (
            record.quotes.map((q) => (
              <article className="cp-quote" key={q.id}>
                <h2>
                  {input.lines.find((l) => l.id === q.line_id)?.name} · {q.supplier}
                </h2>
                <p>
                  Reference {q.reference} · added {new Date(q.created).toLocaleDateString("en-GB")}
                </p>
                <div className="cp-price">
                  {q.currency} {q.monthly.toLocaleString("en-GB")}{" "}
                  <small>/ month, excluding tax</small>
                </div>
                <dl>
                  {[
                    ["Installation", `${q.currency} ${q.installation}, excluding tax`],
                    ["Term", q.term],
                    ["Lead time", q.lead_time],
                    [
                      "Valid until",
                      q.valid_until +
                        (Date.parse(q.valid_until + "T23:59:59Z") < Date.now() ? " · expired" : ""),
                    ],
                    ["SLA", q.sla],
                    ["Resilience confirmation", q.resilience_confirmation],
                    ["Exclusions", q.exclusions],
                    ["Device protection", q.protection_details || "Not included"],
                    ["Notes", q.notes || "None"],
                  ].map(([a, b]) => (
                    <div key={a}>
                      <dt>{a}</dt>
                      <dd>{b}</dd>
                    </div>
                  ))}
                </dl>
                <a href={q.evidence_url} target="_blank" rel="noopener noreferrer">
                  Supplier quote / evidence ↗
                </a>
                {admin && (
                  <p>
                    Buyer email:{" "}
                    {q.notification === "accepted" ? "accepted for delivery" : q.notification}
                    {q.notification !== "accepted" && (
                      <button
                        disabled={busy}
                        onClick={() => void action("notify", { quote_id: q.id })}
                      >
                        Retry notification
                      </button>
                    )}
                  </p>
                )}
                <p>
                  No order has been placed. Check quote validity, survey conditions and supplier
                  evidence.
                </p>
              </article>
            ))
          ) : (
            <div className="cp-empty">
              <h2>{frozen ? "Netify is sourcing your request" : "No market responses yet"}</h2>
              <p>
                {frozen
                  ? "Your quotes will appear here. You can leave the page; we’ll email when pricing is added."
                  : "Publish your request to begin market sourcing."}
              </p>
            </div>
          )}
          {admin && frozen && (
            <button
              className="cp-primary"
              onClick={() => {
                setQuote({ ...quote, id: crypto.randomUUID(), line_id: input.lines[0]?.id ?? "" });
                setModal("quote");
              }}
            >
              Add sourced quote
            </button>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className="cp-dialog"
        onCancel={() => {
          setModal("");
          setEdit(null);
        }}
      >
        <button
          className="cp-close"
          aria-label="Close panel"
          onClick={() => {
            setModal("");
            setEdit(null);
          }}
        >
          ×
        </button>
        {error && (
          <p role="alert" className="cp-error">
            {error}
          </p>
        )}
        {edit && (
          <>
            <h2>Connection requirements</h2>
            <fieldset disabled={frozen || admin}>
              <Field label="Location / group name">
                <input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </Field>
              <Field label="Country">
                <input
                  list="cp-countries"
                  value={edit.country}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      country: e.target.value,
                      protect: false,
                      router: "No router",
                    })
                  }
                />
              </Field>
              <datalist id="cp-countries">
                {[
                  "United Kingdom",
                  "Netherlands",
                  "Germany",
                  "France",
                  "United States",
                  "Singapore",
                  "Australia",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
              <Field label="Connection type">
                <select
                  value={edit.kind}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      kind: e.target.value as CircuitLine["kind"],
                      protect: false,
                      resilience: "Single connection",
                      operation: "Not applicable",
                    })
                  }
                >
                  {["Ethernet", "Broadband", "4G / 5G SIM only", "4G / 5G with router"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </Field>
              <label className="cp-check">
                <input
                  type="checkbox"
                  checked={edit.remote}
                  onChange={(e) => setEdit({ ...edit, remote: e.target.checked, protect: false })}
                />
                For remote users
              </label>
              {edit.kind !== "4G / 5G SIM only" && (
                <Field label="Full service address">
                  <textarea
                    value={edit.address}
                    onChange={(e) => setEdit({ ...edit, address: e.target.value })}
                    placeholder="Building, street, city, region, postal code"
                  />
                </Field>
              )}
              <div className="cp-grid">
                <Field
                  label={edit.kind === "4G / 5G SIM only" ? "SIM quantity" : "Connection quantity"}
                >
                  <input
                    type="number"
                    min="1"
                    value={edit.quantity}
                    onChange={(e) => setEdit({ ...edit, quantity: +e.target.value })}
                  />
                </Field>
                <Field label="Bandwidth required">
                  <input
                    value={edit.bandwidth}
                    onChange={(e) => setEdit({ ...edit, bandwidth: e.target.value })}
                    placeholder="e.g. 1 Gbps or best available mobile speed"
                  />
                </Field>
              </div>
              {(edit.kind.includes("4G") || edit.resilience === "Cellular backup") && (
                <Field label="Data allowance & coverage requirements">
                  <input
                    value={edit.data}
                    onChange={(e) => setEdit({ ...edit, data: e.target.value })}
                  />
                </Field>
              )}
              <Field label="Resilience">
                <select
                  value={edit.resilience}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      resilience: e.target.value as CircuitLine["resilience"],
                      operation:
                        e.target.value === "Single connection"
                          ? "Not applicable"
                          : "Active / passive",
                    })
                  }
                >
                  {[
                    "Single connection",
                    ...(edit.kind === "Ethernet" ? ["Dual RA02 Ethernet"] : []),
                    "Broadband backup",
                    "Cellular backup",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              {edit.resilience !== "Single connection" && (
                <Field label="Operation">
                  <select
                    value={edit.operation}
                    onChange={(e) =>
                      setEdit({ ...edit, operation: e.target.value as CircuitLine["operation"] })
                    }
                  >
                    <option>Active / passive</option>
                    <option>Load balancing</option>
                  </select>
                </Field>
              )}
              <p>RA02, diversity and failover remain subject to supplier confirmation.</p>
              <Field label="Router / SD-WAN edge (optional)">
                <select
                  value={edit.router}
                  onChange={(e) =>
                    setEdit({ ...edit, router: e.target.value as CircuitLine["router"] })
                  }
                >
                  {[
                    "No router",
                    "Managed router",
                    ...(edit.country === "United Kingdom"
                      ? ["Fortinet SD-WAN edge", "Meraki SD-WAN edge"]
                      : []),
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <p>Fortinet and Meraki are optional, UK-only edge choices.</p>
              <Field label="Contract term">
                <input
                  value={edit.term}
                  onChange={(e) => setEdit({ ...edit, term: e.target.value })}
                />
              </Field>
              {edit.country !== "United Kingdom" && (
                <>
                  <h3>Local contact · required outside the UK</h3>
                  {(["contact_name", "contact_email", "contact_phone"] as const).map((key, i) => (
                    <Field
                      key={key}
                      label={
                        ["Local contact name", "Local contact email", "Local telephone number"][i]
                      }
                    >
                      <input
                        type={i === 1 ? "email" : "text"}
                        value={edit[key]}
                        onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                      />
                    </Field>
                  ))}
                </>
              )}
              {edit.remote && edit.country === "United Kingdom" && edit.kind !== "Ethernet" && (
                <div className="cp-info">
                  <label className="cp-check">
                    <input
                      type="checkbox"
                      checked={edit.protect}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          protect: e.target.checked,
                          devices: edit.devices || edit.quantity,
                        })
                      }
                    />
                    Add optional CrowdStrike device threat protection
                  </label>
                  <p>
                    £4.99 + VAT per device · UK only. Billing period and product package confirmed
                    in your quote.
                  </p>
                  {edit.protect && (
                    <Field label="Devices to protect">
                      <input
                        type="number"
                        min="1"
                        value={edit.devices}
                        onChange={(e) => setEdit({ ...edit, devices: +e.target.value })}
                      />
                    </Field>
                  )}
                </div>
              )}
            </fieldset>
            {!frozen && !admin && (
              <div className="cp-inline">
                <button className="cp-primary" onClick={() => updateLine(edit)}>
                  Save requirements
                </button>
                <button
                  onClick={() => {
                    setInput((i) => ({ ...i, lines: i.lines.filter((l) => l.id !== edit.id) }));
                    setEdit(null);
                  }}
                >
                  Remove group
                </button>
              </div>
            )}
          </>
        )}
        {modal === "review" && (
          <>
            <h2>Review your pricing request</h2>
            <p>
              {`${locations} location${locations === 1 ? "" : "s"}. ${remote} remote connection${remote === 1 ? "" : "s"}.`}
            </p>
            <p>
              Netify will source your requirements. Your company, service addresses and local
              contacts are private. An anonymous buying notice is published on the Opportunity
              Board.
            </p>
            <p>We’ll email your verified work address when pricing appears in Market responses.</p>
            {!signed ? (
              <><label className="cp-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{CIRCUIT_CONSENT}</label>
              {consent && <SignIn role="buyer" circuitIntent={{id,input,consent:CIRCUIT_CONSENT}} prompt="Verify your work email to save this private request. You will approve publication after signing in." onAuthed={async () => {await refresh(); await recoverRequest();}} />}</>
            ) : (
              <>
                <label className="cp-check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {CIRCUIT_CONSENT}
                </label>
                <div className="cp-inline">
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (await save()) {
                        setMessage("Private draft saved.");
                        setModal("");
                      }
                    }}
                  >
                    Save private draft
                  </button>
                  <button
                    className="cp-primary"
                    disabled={busy || !consent}
                    onClick={async () => {
                      const saved = await save();
                      if (saved) {
                        const result = await action("publish", {
                          revision: saved.revision,
                          consent: CIRCUIT_CONSENT,
                        });
                        if (result) {
                          try { localStorage.removeItem(DRAFT); } catch { setError("Your request is published, but this browser could not clear its old local draft. Reopen the saved request from My pricing requests."); }
                          history.replaceState(null, "", "?request=" + id);
                          setView("quotes");
                          setModal("");
                        }
                      }
                    }}
                  >
                    Publish project & request pricing
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {modal === "quote" && admin && (
          <>
            <h2>Add sourced quote</h2>
            <p>
              The buyer will see this offer immediately and receive a notification email. Verify the
              supplier evidence before adding it.
            </p>
            <Field label="Location">
              <select
                value={quote.line_id}
                onChange={(e) => setQuote({ ...quote, line_id: e.target.value })}
              >
                {input.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            {Object.entries({
              supplier: "Supplier",
              reference: "Quote reference",
              currency: "Currency (ISO code)",
              monthly: "Monthly rental, excluding tax",
              installation: "Installation, excluding tax",
              term: "Contract term",
              lead_time: "Delivery lead time",
              valid_until: "Valid until",
              sla: "SLA",
              resilience_confirmation: "Confirmed resilience / RA02",
              exclusions: "Exclusions and survey conditions",
              evidence_url: "Private supplier quote evidence URL (HTTPS)",
              protection_details: "Separate device protection details / billing period",
              notes: "Notes",
            }).map(([k, label]) => (
              <Field key={k} label={label}>
                <input
                  type={
                    k === "valid_until"
                      ? "date"
                      : ["monthly", "installation"].includes(k)
                        ? "number"
                        : "text"
                  }
                  min="0"
                  value={quote[k as keyof typeof quote]}
                  onChange={(e) => setQuote({ ...quote, [k]: e.target.value })}
                />
              </Field>
            ))}
            <button
              className="cp-primary"
              disabled={busy}
              onClick={async () => {
                if (quote.monthly === "" || quote.installation === "") {
                  setError(
                    "Enter both rental and installation charges, including zero where applicable.",
                  );
                  return;
                }
                const parsed = CircuitQuoteSchema.safeParse({
                  ...quote,
                  monthly: Number(quote.monthly),
                  installation: Number(quote.installation),
                });
                if (!parsed.success) {
                  setError(parsed.error.issues.map((i) => i.message).join(" "));
                  return;
                }
                if (await action("quote", { input: parsed.data })) {
                  setModal("");
                  setView("quotes");
                }
              }}
            >
              Add quote & notify buyer
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
