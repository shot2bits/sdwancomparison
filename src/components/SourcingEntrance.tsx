"use client";
import { parseResearchHandoff } from "@/lib/research-handoff";
import { fireNetifyEvent } from "@/components/NetifyEvents";
import { researchMetrics } from "@/lib/research-metrics";
import SourcingActions, { type SourcingAction as Action } from "./SourcingActions";
import { sourcingAcquisition } from "@/lib/sourcing-acquisition";
import type { PublicPanelMember } from "@/lib/response-panel-contract";
import React, { useEffect, useRef, useState } from "react";
import type { ProviderEditorialReview } from "@/lib/provider-editorial-review";
import type { ShortlistVendor } from "@/lib/shortlist-core";
import {
  SECTOR_KEYS,
  SECTOR_LABELS,
  REGION_KEYS,
  REGION_LABELS,
  STATUS_LABELS,
} from "@/lib/shortlist-core";
import {
  SOURCING_NEED_LABELS,
  SOURCING_ACTION_LABELS,
  SourcingBriefSchema,
  type SourcingBrief,
} from "@/lib/sourcing-contract";
const actionLabels = SOURCING_ACTION_LABELS;
export default function SourcingEntrance({
  vendors,
  initialSector,
  initialSelection,
  features,
}: {
  vendors: (ShortlistVendor & { best_for?: string; editorial?: ProviderEditorialReview | null; response_panel?: PublicPanelMember | null })[];
  initialSector?: string;
  initialSelection?: {slug:string; action:Action};
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
  const [selected, setSelected] = useState<Record<string, Action[]>>(initialSelection ? {[initialSelection.slug]:[initialSelection.action]} : {});
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
  const [articleSource, setArticleSource] = useState("");
  useEffect(() => {
    const receive = () => {
    const incoming = parseResearchHandoff(window.location.hash);
    if (!incoming) return;
    // The source is context only. It never selects recipients or grants consent.
    const contextNames = incoming.provider_context.map(slug=>vendors.find(v=>v.slug===slug)?.name).filter(Boolean);
    const requirement = [incoming.requirement, `Research article: ${incoming.source}`, contextNames.length ? `Research context, not approved recipients: ${contextNames.join(", ")}.` : ""].filter(Boolean).join("\n\n");
    setBrief(b => ({...b, requirement: b.requirement || (requirement.length <= 12000 ? requirement : incoming.requirement)}));
    setArticleSource(incoming.source);
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search + "#sourcing-brief");
    fireNetifyEvent("research_handoff", {source:"shortlist", intent:"project"});
    };
    // Read browser-only context after hydration; accept later same-page handoffs too.
    const frame = window.requestAnimationFrame(receive);
    window.addEventListener("hashchange", receive);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("hashchange", receive); };
  }, [vendors]);
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
    fireNetifyEvent("provider_action_changed", {source:"shortlist", intent:action === "proposals" ? "project" : "research", opt_in:(selected[slug] ?? []).includes(action) ? "no" : "yes"});
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
      (
        document.getElementById("sourcing-brief") as HTMLFormElement | null
      )?.reportValidity();
      setMessage(
        "Check your sites, users and requirement before preparing the plan.",
      );
      return;
    }
    const version = briefVersion.current;
    setPlan(true);
    setConsent(false);
    setMessage("");
    setMatching(true);
    setMatches(null);
    const summary = `${brief.sites} sites; ${brief.remote_users} remote users; ${REGION_LABELS[brief.region]}; ${brief.sector ? SECTOR_LABELS[brief.sector] : "sector to discuss"}. Required service: ${SOURCING_NEED_LABELS[brief.need]}. Timing: ${brief.when}.${brief.uk_provider_only ? " UK providers only: evidenced UK headquarters or contracting entity required." : ""}`;
    // Preserve buyer edits; reapproval is required after every requirements change.
    if (
      !brief.supplier_brief ||
      brief.supplier_brief === generatedBrief.current
    ) {
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
        body: JSON.stringify({ ...brief, acquisition: acquisition() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      if (version !== briefVersion.current) return;
      setMatches((d.matches ?? []).map((v: { slug: string }) => v.slug));
      setMatchMessage(
        "Evidence matching uses the selected sector, region, service and optional UK-provider filter. Site counts, timing and pasted notes still need desk and supplier assessment. No suppliers are automatically approved.",
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
    return sourcingAcquisition(window.location.search, document.referrer);
  }
  async function submit() {
    if (planStale) {
      setMessage(
        "Prepare the plan again, then review the supplier brief against your changed requirements.",
      );
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
      if (
        !r.ok &&
        typeof d.error === "string" &&
        d.error.startsWith("This request has expired")
      )
        requestAttempt.current = null;
      setMessage(
        r.ok
          ? d.delivery === "captured_not_sent"
            ? "Preview test: confirmation captured privately. No email has been sent. The tester can open the link from the private test inbox. No supplier has been contacted."
            : "Check your work email. The confirmation opens this exact request for your approval. No supplier has been contacted."
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
    <fieldset
      disabled={busy}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      {articleSource && <p className="sourcing-small">Requirements carried from <a href={articleSource}>your research article</a>. Review and edit them before preparing the plan. No supplier has been selected or contacted.</p>}
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
        <label className="sourcing-check">
          <input
            type="checkbox"
            checked={brief.uk_provider_only ?? false}
            onChange={(e) => change("uk_provider_only", e.target.checked)}
          />
          UK providers only: UK headquarters or contracting entity evidenced
        </label>
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
            id="sourcing-requirement"
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
        {planStale && (
          <p role="alert">
            Your requirements changed. Prepare the plan again before approving
            requests.
          </p>
        )}
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
          text. Check this brief against your current requirements: your edits
          are preserved when you refresh the plan. Netify checks it again before
          sending.
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
          <button
            className="sourcing-primary"
            disabled={busy || !consent || planStale || matching}
          >
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
            <article key={v.slug} id={`provider-${v.slug}`}>
              <div className="sourcing-card-top">
                <h3><a href={`/sase/vendors/${v.slug}/`}>{v.name}</a></h3>
                <span>
                  {v.response_panel ? "Response panel" : "Research only"}
                </span>
              </div>
              <p>{v.category}</p>
              {v.editorial && <div>
                <p><strong>Netify assessment:</strong> {v.editorial.buyer_fit}</p>
                <h4>Strengths for this buyer</h4><ul>{v.editorial.strengths.map(text=><li key={text}>{text}</li>)}</ul>
                <h4>Trade-offs to check</h4><ul>{v.editorial.trade_offs.map(text=><li key={text}>{text}</li>)}</ul>
                <p className="sourcing-small">Editorial review: {v.editorial.reviewer}, {v.editorial.role}, {v.editorial.approved_at.slice(0,10)}.</p>
                <details><summary>Assessment sources</summary><ul>{v.editorial.source_urls.map(url=><li key={url}><a href={url}>{url}</a></li>)}</ul></details>
              </div>}
              <p data-best-for={v.slug}><strong>Evidence profile:</strong> {v.best_for}</p>
              {matches?.includes(v.slug) && (
                <p>
                  <strong>Evidence match</strong> · supplier confirmation
                  pending
                </p>
              )}
              <p>
                <strong>
                  {researchMetrics(v).completeness_percent}% research completeness
                </strong>{" "}
                · {v.evidence_source_count ?? 0} source references
              </p>
              <p className="sourcing-small">
                Provider evidence date: {v.last_verified || "date not recorded"}
              </p>
              <details className="sourcing-small">
                <summary>What the research covers</summary>
                <p>{researchMetrics(v).supported} supported; {researchMetrics(v).partial} partial; {researchMetrics(v).partner_delivered} partner-delivered; {researchMetrics(v).managed_service_dependent} managed-service dependent; {researchMetrics(v).not_primary} not primary; {researchMetrics(v).unconfirmed} unconfirmed. Total: {researchMetrics(v).total} capability fields.</p>
                <p>An unconfirmed field is an evidence gap, not proof that the provider lacks the capability. Source references can repeat the same document. These figures are not a suitability score.</p>
              </details>
              {v.projection_provenance?.active_review?.sector_signoff && (
                <p className="sourcing-small">
                  {v.projection_provenance.active_review.sector_signoff.label}
                </p>
              )}
              {brief.sector && (
                <p className="sourcing-small">
                  {SECTOR_LABELS[brief.sector]}:{" "}
                  {["unknown", "not_confirmed"].includes(v.sectors[brief.sector]) ? "not yet reviewed" : STATUS_LABELS[v.sectors[brief.sector]]} evidence. UK sector
                  case evidence:{" "}
                  {v.projection_provenance?.active_review?.uk_sector_evidence?.[
                    brief.sector
                  ]
                    ? "yes"
                    : "not established"}
                  .
                </p>
              )}
              {v.projection_provenance?.active_review?.qualification && (
                <div className="sourcing-small">
                  <p>{v.projection_provenance.active_review.qualification.split(/(?<=[.!?])\s/)[0]}</p>
                  <details><summary>Read evidence qualifications</summary><p>{v.projection_provenance.active_review.qualification}</p></details>
                </div>
              )}
              {["review_expired", "source_newer_than_review"].includes(
                v.projection_provenance?.resolution ?? "",
              ) && (
                <p className="sourcing-small">
                  Evidence needs review:{" "}
                  {v.projection_provenance?.resolution === "review_expired"
                    ? "review overdue"
                    : "source updated since review"}
                  .
                </p>
              )}
              <a href={v.marketplace_url || `/sase/vendors/${v.slug}/`}>
                Datasheet and evidence ↗
              </a>
              {v.response_panel && (
                <p className="sourcing-small">
                  Approved actions routed by Netify to{" "}
                  {v.response_panel.contact_name},{" "}
                  {v.response_panel.contact_role} (
                  {v.response_panel.contact_email_domain}). Agreed response:{" "}
                  {v.response_panel.agreed_response_working_days} working days.
                </p>
              )}
              <SourcingActions slug={v.slug} selected={selected[v.slug] ?? []} onChoose={choose}/>
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
              <caption>
                Provider capability evidence, coverage and sources
              </caption>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Evidence profile</th>
                  <th>Research completeness</th>
                  <th>Source references</th>
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
                    <td>{v.best_for}</td>
                    <td>{researchMetrics(v).completeness_percent}%</td>
                    <td>{v.evidence_source_count ?? 0}</td>
                    <td>{v.last_verified}</td>
                    {features.map((f) => (
                      <td key={f.id}>
                        {["unknown", "not_confirmed"].includes(v.capabilities[f.id] ?? "not_confirmed") ? "not yet reviewed" : STATUS_LABELS[v.capabilities[f.id]]}
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
