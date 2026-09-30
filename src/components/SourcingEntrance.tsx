"use client";
import { useRef, useState } from "react";
import type { ShortlistVendor } from "@/lib/shortlist-core";
import {
  SECTOR_KEYS,
  SECTOR_LABELS,
  REGION_KEYS,
  REGION_LABELS,
  STATUS_LABELS,
} from "@/lib/shortlist-core";
import { SourcingBriefSchema, type SourcingBrief } from "@/lib/sourcing-contract";
type Action = "contacts" | "demo" | "proposals";
const actions: Action[] = ["contacts", "demo", "proposals"];
const actionLabels = {
  contacts: "Pre-sales contacts",
  demo: "Demo",
  proposals: "Include in proposals",
};
export default function SourcingEntrance({
  vendors,
  initialSector,
  features,
}: {
  vendors: ShortlistVendor[];
  initialSector?: string;
  features: { id: string; name: string }[];
}) {
  const [brief, setBrief] = useState<SourcingBrief>({
    sites: 10,
    remote_users: 50,
    region: "uk_ireland",
    sector: SECTOR_KEYS.includes(initialSector as never)
      ? (initialSector as SourcingBrief["sector"])
      : null,
    need: "sase",
    when: "Exploring options",
    requirement: "",
    supplier_brief: "",
  });
  const [selected, setSelected] = useState<Record<string, Action[]>>({});
  const [plan, setPlan] = useState(false),
    [email, setEmail] = useState(""),
    [consent, setConsent] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const briefVersion = useRef(0);
  const generatedBrief = useRef("");
  const [planStale, setPlanStale] = useState(false);
  const requestAttempt = useRef<{ payload: string; key: string } | null>(null);
  const [matches, setMatches] = useState<string[] | null>(null),
    [matching, setMatching] = useState(false),
    [matchMessage, setMatchMessage] = useState("");
  const [entry, setEntry] = useState("Describe your requirements");
  function change<K extends keyof SourcingBrief>(
    key: K,
    value: SourcingBrief[K],
  ) {
    setBrief((b) => ({ ...b, [key]: value }));
    setConsent(false);
    setMessage("");
    if (key !== "supplier_brief") {
      briefVersion.current++;
      setPlanStale(true);
      setMatches(null);
      setMatchMessage(
        "Your requirements changed. Prepare the plan again to refresh evidence matching.",
      );
    }
  }
  function choose(slug: string, action: Action) {
    setSelected((old) => {
      const a = old[slug] ?? [];
      return {
        ...old,
        [slug]: a.includes(action)
          ? a.filter((x) => x !== action)
          : [...a, action],
      };
    });
    setConsent(false);
    setMessage("");
  }
  async function prepare() {
    if (!SourcingBriefSchema.safeParse(brief).success) {
      (document.getElementById("sourcing-brief") as HTMLFormElement | null)?.reportValidity();
      setMessage("Check your sites, users and requirement before preparing the plan.");
      return;
    }
    const version = briefVersion.current;
    setPlan(true);
    setConsent(false);
    setMessage("");
    setMatching(true);
    setMatches(null);
    const summary = `${brief.sites} sites; ${brief.remote_users} remote users; ${REGION_LABELS[brief.region]}; ${brief.sector ? SECTOR_LABELS[brief.sector] : "sector to discuss"}. Required service: ${brief.need}. Timing: ${brief.when}.`;
    // Preserve buyer edits; reapproval is required after every requirements change.
    if (!brief.supplier_brief || brief.supplier_brief === generatedBrief.current) {
      change("supplier_brief", summary);
      generatedBrief.current = summary;
    }
    setPlanStale(false);
    requestAnimationFrame(() =>
      document
        .getElementById("sourcing-plan")
        ?.scrollIntoView({ behavior: "smooth" }),
    );
    try {
      const r = await fetch("/sase/api/sourcing/plan/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      if (version !== briefVersion.current) return;
      setMatches((d.matches ?? []).map((v: { slug: string }) => v.slug));
      setMatchMessage(
        "Evidence matching uses the selected sector, region and service. Site counts, timing and pasted notes still need desk and supplier assessment. No suppliers are automatically approved.",
      );
    } catch {
      if (version !== briefVersion.current) return;
      setMatchMessage(
        "Evidence matching is temporarily unavailable. Your brief remains available for Netify to review.",
      );
    } finally {
      setMatching(false);
    }
  }

  function acquisition() {
    const v = new URLSearchParams(window.location.search).get("acquisition");
    return ["chatgpt", "gemini", "perplexity", "copilot", "other"].includes(
      v ?? "",
    )
      ? v
      : "web";
  }
  async function submit() {
    if (planStale) {
      setMessage("Prepare the plan again, then review the supplier brief against your changed requirements.");
      return;
    }
    if (!consent) {
      setMessage("Approve the brief and selected requests before continuing.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const payload = JSON.stringify({ brief, email, consent, selected });
      if (requestAttempt.current?.payload !== payload)
        requestAttempt.current = { payload, key: crypto.randomUUID() };
      const r = await fetch("/sase/api/sourcing/request/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          email,
          consent,
          anonymous: true,
          acquisition: acquisition(),
          idempotency_key: requestAttempt.current.key,
          recipients: Object.entries(selected)
            .filter(([, a]) => a.length)
            .map(([slug, a]) => ({ slug, actions: a })),
        }),
      });
      const d = await r.json();
      if (!r.ok && typeof d.error === "string" && d.error.startsWith("This request has expired")) requestAttempt.current = null;
      setMessage(
        r.ok
          ? "Check your work email. The confirmation opens this exact request for your approval. No supplier has been contacted."
          : d.error ||
              "We could not prepare the request. Your brief is still here.",
      );
    } catch {
      setMessage(
        "The request could not be sent. Your brief is still here; please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <form
        id="sourcing-brief"
        className="sourcing-form"
        onSubmit={(e) => {
          e.preventDefault();
          void prepare();
        }}
      >
        <h2>What do you need?</h2>
        <p>Start with the essentials. We resolve the detail with you.</p>
        <div className="sourcing-fields">
          <label>
            Business sites
            <input
              type="number"
              required
              min="1"
              max="100000"
              value={brief.sites}
              onChange={(e) => change("sites", Number(e.target.value))}
            />
          </label>
          <label>
            Remote users
            <input
              type="number"
              required
              min="0"
              max="1000000"
              value={brief.remote_users}
              onChange={(e) => change("remote_users", Number(e.target.value))}
            />
          </label>
          <label>
            Region
            <select
              value={brief.region}
              onChange={(e) =>
                change("region", e.target.value as SourcingBrief["region"])
              }
            >
              {REGION_KEYS.map((k) => (
                <option key={k} value={k}>
                  {REGION_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sector
            <select
              value={brief.sector ?? ""}
              onChange={(e) =>
                change(
                  "sector",
                  (e.target.value || null) as SourcingBrief["sector"],
                )
              }
            >
              <option value="">Select your sector</option>
              {SECTOR_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SECTOR_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            What you need
            <select
              value={brief.need}
              onChange={(e) =>
                change("need", e.target.value as SourcingBrief["need"])
              }
            >
              <option value="sase">Network and security (SASE)</option>
              <option value="sdwan">Connectivity and SD-WAN</option>
              <option value="secure_access">Secure remote access</option>
              <option value="help_deciding">Help deciding</option>
            </select>
          </label>
          <label>
            When
            <select
              value={brief.when}
              onChange={(e) => change("when", e.target.value)}
            >
              {[
                "Exploring options",
                "Within 3 months",
                "3–6 months",
                "6–12 months",
                "Contract renewal",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {entry}
          <textarea
            rows={3}
            maxLength={12000}
            value={brief.requirement}
            onChange={(e) => change("requirement", e.target.value)}
            placeholder="Your requirement, existing shortlist or proposal summary. You can leave this brief."
          />
        </label>
        <button className="sourcing-primary" type="submit" disabled={matching}>
          {matching ? "Checking evidence…" : "Prepare my sourcing plan →"}
        </button>
        <div className="sourcing-secondary">
          <button
            type="button"
            onClick={() => setEntry("Paste your AI shortlist")}
          >
            Paste an AI shortlist
          </button>
          <button
            type="button"
            onClick={() => setEntry("Paste an existing proposal summary")}
          >
            Bring a proposal
          </button>
          <a href="#provider-research">Just show me the research</a>
        </div>
      </form>
      <section id="sourcing-plan" className="sourcing-plan" hidden={!plan}>
        <p className="sourcing-eyebrow">Your draft sourcing plan</p>
        <h2>Review the brief. Choose the requests.</h2>
        <p>
          {brief.sites} sites · {brief.remote_users} remote users ·{" "}
          {REGION_LABELS[brief.region]} · {brief.when}
        </p>
        {planStale && <p role="alert">Your requirements changed. Prepare the plan again before approving requests.</p>}
        <p role="status">
          {matching ? "Checking the evidence dataset…" : matchMessage}
        </p>
        {matches !== null && (
          <p>
            <strong>{matches.length} evidence matches</strong> for the supported
            filters.{" "}
            {matches.length === 0
              ? "This does not establish that no providers can deliver; the desk must resolve missing or conflicting evidence."
              : "See labelled cards in the full directory below."}
          </p>
        )}
        <p>
          The desk will check delivery, technical requirements and supplier
          availability before outreach. Your original notes stay with Netify.
          Only the anonymous brief below is approved for suppliers.
        </p>
        <label>
          Anonymous supplier brief
          <textarea
            rows={5}
            maxLength={12000}
            value={brief.supplier_brief}
            onChange={(e) => change("supplier_brief", e.target.value)}
          />
        </label>
        <p className="sourcing-small">
          Remove company names, addresses, personal information and identifying
          text. Check this brief against your current requirements: your edits are preserved when you refresh the plan. Netify checks it again before sending.
        </p>
        <h3>Approved recipients and actions</h3>
        {Object.entries(selected).filter(([, a]) => a.length).length ? (
          <ul>
            {Object.entries(selected)
              .filter(([, a]) => a.length)
              .map(([slug, a]) => (
                <li key={slug}>
                  {vendors.find((v) => v.slug === slug)?.name}:{" "}
                  {a.map((x) => actionLabels[x]).join(", ")}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setSelected((s) => ({ ...s, [slug]: [] }));
                      setConsent(false);
                      setMessage("");
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p>
            No recipients selected. You can ask Netify to prepare a named plan
            first, or choose from the full research directory below.
          </p>
        )}
        <a href="#provider-research">Choose providers and actions ↓</a>
        <p>
          <strong>Response target:</strong> agreed by Netify with the
          participating suppliers before outreach. If a supplier declines or
          does not respond, we tell you and agree the next step. No substitute
          receives the brief without your approval.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label>
            Work email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setConsent(false);
                setMessage("");
              }}
            />
          </label>
          <label className="sourcing-check">
            <input
              type="checkbox"
              checked={consent}
              disabled={planStale || matching}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I ask Netify to review this requirement and approve only the
            supplier requests listed above, using the anonymous brief shown.
          </label>
          <button className="sourcing-primary" disabled={busy || !consent || planStale || matching}>
            {busy ? "Preparing confirmation…" : "Email my confirmation link →"}
          </button>
          <p className="sourcing-small">
            No account or public listing. Confirmation is specific to this
            request; Netify reviews it before any supplier contact.
          </p>
        </form>
        <p role="status">{message}</p>
      </section>
      <section id="provider-research" className="sourcing-directory">
        <p className="sourcing-eyebrow">Open research</p>
        <h2>All {vendors.length} researched providers</h2>
        <p>
          Ordered by evidence coverage, highest first, then name. Coverage
          measures completeness of capability evidence, not fit or quality.
          Commission never affects the order.
        </p>
        <p>
          Research-only suppliers are approached manually by the Netify desk. A
          response-panel badge requires a named contact, an agreed response time
          and acknowledged introduction terms.
        </p>
        <div className="sourcing-cards">
          {vendors.map((v) => (
            <article key={v.slug}>
              <div className="sourcing-card-top">
                <h3>{v.name}</h3>
                <span>Research only</span>
              </div>
              <p>{v.category}</p>
              {matches?.includes(v.slug) && (
                <p>
                  <strong>Evidence match</strong> · supplier confirmation
                  pending
                </p>
              )}
              <p>
                <strong>
                  {Math.round(v.evidence_coverage_pct * 100)}% evidence coverage
                </strong>{" "}
                · {v.evidence_source_count ?? 0} sources
              </p>
              <p className="sourcing-small">
                Reviewed {v.last_verified || "date not recorded"}
              </p>
              <a href={v.marketplace_url || `/sase/vendors/${v.slug}/`}>
                Datasheet and evidence ↗
              </a>
              <div className="sourcing-actions">
                {actions.map((action) => (
                  <label key={action} className="sourcing-check">
                    <input
                      type="checkbox"
                      checked={selected[v.slug]?.includes(action) ?? false}
                      onChange={() => choose(v.slug, action)}
                    />
                    {actionLabels[action]}
                  </label>
                ))}
              </div>
            </article>
          ))}
        </div>
        <button
          className="sourcing-primary"
          type="button"
          onClick={() =>
            plan
              ? document
                  .getElementById("sourcing-plan")
                  ?.scrollIntoView({ behavior: "smooth" })
              : prepare()
          }
        >
          Review my bundled requests →
        </button>
        <details>
          <summary>Complete capability evidence table</summary>
          <div className="sourcing-table">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Coverage</th>
                  <th>Sources</th>
                  <th>Review date</th>
                  {features.map((f) => (
                    <th key={f.id}>{f.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.slug}>
                    <th>
                      <a href={v.marketplace_url || `/sase/vendors/${v.slug}/`}>
                        {v.name}
                      </a>
                    </th>
                    <td>{Math.round(v.evidence_coverage_pct * 100)}%</td>
                    <td>{v.evidence_source_count ?? 0}</td>
                    <td>{v.last_verified}</td>
                    {features.map((f) => (
                      <td key={f.id}>
                        {STATUS_LABELS[v.capabilities[f.id] ?? "not_confirmed"]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </fieldset>
  );
}
