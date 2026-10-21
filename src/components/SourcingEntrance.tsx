"use client";
import ShortlistProviderDirectory from "./ShortlistProviderDirectory";
import { parseResearchHandoff } from "@/lib/research-handoff";
import { fireNetifyEvent } from "@/components/NetifyEvents";
import { researchMetrics } from "@/lib/research-metrics";
import SourcingActions, { type SourcingAction as Action } from "./SourcingActions";
import { sourcingAcquisition } from "@/lib/sourcing-acquisition";
import type { PublicPanelMember } from "@/lib/response-panel-contract";
import React, { useEffect, useRef, useState } from "react";
import type { InvestigationProvider } from "@/lib/sourcing-evidence";
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
  showProductFocus = false,
  buyerProfiles = false,
}: {
  vendors: (ShortlistVendor & { best_for?: string; editorial?: ProviderEditorialReview | null; response_panel?: PublicPanelMember | null })[];
  initialSector?: string;
  initialSelection?: {slug:string; action:Action};
  features: { id: string; name: string }[];
  showProductFocus?: boolean;
  buyerProfiles?: boolean;
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
  const [editing, setEditing] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [investigation, setInvestigation] = useState<InvestigationProvider[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [directoryView, setDirectoryView] = useState("all");
  const selectedRequests = Object.entries(selected).filter(([, actions]) => actions.length);
  function scrollTo(id: string) {
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      target?.focus({ preventScroll: true });
    });
  }
  function editRequirements() { setEditing(true); scrollTo("sourcing-requirement"); }
  useEffect(() => {
    const open = (hash = window.location.hash) => {
      if (["#sourcing-brief", "#sourcing-requirement"].includes(hash)) {
        setEditing(true);
        scrollTo("sourcing-requirement");
      } else if (hash.startsWith("#provider-")) {
        setDirectoryView("all");
        scrollTo(hash.slice(1));
      }
    };
    const onHash = () => open();
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      const hash = anchor?.getAttribute("href");
      if (hash && (["#sourcing-brief", "#sourcing-requirement"].includes(hash) || hash.startsWith("#provider-"))) {
        event.preventDefault();
        window.history.replaceState(window.history.state, "", hash);
        open(hash);
      }
    };
    const frame = requestAnimationFrame(onHash);
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("click", onClick); window.removeEventListener("hashchange", onHash); };
  }, []);
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
      setInvestigation([]);
      setChecks([]);
      setDirectoryView("all");
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
    setReviewMessage("");
  }
  async function prepare() {
    if (!SourcingBriefSchema.safeParse(brief).success) {
      (
        document.getElementById("sourcing-brief") as HTMLFormElement | null
      )?.reportValidity();
      setMessage(
        "Check your sites, users and requirement before preparing the plan.",
      );
      setEditing(true);
      scrollTo("sourcing-requirement");
      return false;
    }
    const version = briefVersion.current;
    setPlan(true);
    setEditing(false);
    setInvestigation([]);
    setChecks([]);
    setReviewMessage("");
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
    scrollTo("sourcing-plan-title");
    try {
      const r = await fetch("/sase/api/sourcing/plan/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...brief, acquisition: acquisition() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      if (version !== briefVersion.current) return;
      const matched = (d.matches ?? []).map((v: { slug: string }) => v.slug);
      setMatches(matched);
      setInvestigation(d.investigation ?? []);
      setChecks(d.outstanding_checks ?? []);
      setDirectoryView(matched.length ? "matches" : "all");
      setMatchMessage(
        "These results reflect the research available for your sector, region and service needs. The Netify team will confirm delivery and suitability for your project, including your sites, timing and notes.",
      );
    } catch {
      if (version !== briefVersion.current) return;
      setMatchMessage(
        "Evidence matching is temporarily unavailable. Your brief remains available for Netify to review.",
      );
    } finally {
      setMatching(false);
    }
    return true;
  }
  async function reviewRequests() {
    if (matching) { scrollTo("sourcing-plan-title"); return; }
    if (!selectedRequests.length) {
      setReviewMessage("Select a provider and at least one request, such as a demo or proposal, before reviewing.");
      scrollTo("request-review-message");
      return;
    }
    if (!plan || planStale) { if (!(await prepare())) return; }
    setEditing(false);
    scrollTo("selected-requests-title");
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
      className={buyerProfiles ? "buyer-journey" : undefined}
      disabled={busy}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      {articleSource && <p className="sourcing-small">Requirements carried from <a href={articleSource}>your research article</a>. Review and edit them before preparing the plan. No supplier has been selected or contacted.</p>}
      <form
        id="sourcing-brief"
        className="sourcing-form"
        hidden={plan && !editing}
        onSubmit={(e) => {
          e.preventDefault();
          void prepare();
        }}
      >
        <h2>{buyerProfiles ? "Your shortlist and requirements" : "What do you need?"}</h2>
        <p>Enter what you know about your sites, users and service needs.</p>
        <label className="sourcing-check">
          <input
            type="checkbox"
            checked={brief.uk_provider_only ?? false}
            onChange={(e) => change("uk_provider_only", e.target.checked)}
          />
          UK-based providers only
        </label>
        <p className="sourcing-small">Checks an evidenced UK headquarters or contracting entity. This is separate from availability at UK sites.</p>
        {brief.uk_provider_only && <p>This filter excludes providers whose UK entity we have not yet evidenced. It does not mean they cannot serve UK sites. Leave it off if UK service availability is your requirement.</p>}
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
          {matching ? "Checking evidence…" : "Prepare my sourcing plan"}
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
          <a href="#provider-research">Browse all providers</a>
        </div>
        <p role="status">{!plan || editing ? message : ""}</p>
      </form>
      {plan && !editing && <div id="sourcing-summary" className="sourcing-summary">
        <strong>Your requirements</strong>
        <p>{brief.sites} sites · {brief.remote_users} remote users · {REGION_LABELS[brief.region]} · {brief.sector ? SECTOR_LABELS[brief.sector] : "Sector not specified"} · {SOURCING_NEED_LABELS[brief.need]} · {brief.when}{brief.uk_provider_only ? " · UK-based providers only" : ""}</p>
        <button type="button" className="sourcing-text-button" onClick={editRequirements}>Edit requirements</button>
      </div>}
      <section id="sourcing-plan" className="sourcing-plan" hidden={!plan}>
        <p className="sourcing-eyebrow">Your draft sourcing plan</p>
        <h2 id="sourcing-plan-title" tabIndex={-1}>Review your plan and choose requests</h2>
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
        {matches !== null && (matches.length ? <p><strong>{matches.length} providers match the research filters.</strong> Review their evidence and choose requests below.</p> : <div className="sourcing-notice">
          <h3>We need to check some options for you</h3>
          <p>No provider has reviewed evidence for all of your selected criteria together. This does not mean providers cannot deliver.</p>
          {checks.length > 0 && <p>The Netify team needs to check: {checks.join(", ")}.</p>}
          <p><a href="#provider-research" onClick={() => setDirectoryView("all")}>Browse all providers</a> or <button type="button" className="sourcing-text-button" onClick={editRequirements}>Edit requirements</button>.</p>
          <p>You can leave recipients unselected and confirm your brief below to ask the Netify team to review the options.</p>
        </div>)}
        {!!investigation.length && <details><summary>Providers to investigate ({investigation.length})</summary>
          <p>These providers have relevant research, but do not meet every evidence filter. Confirm the outstanding points before deciding.</p>
          <ul>{investigation.map(v => <li key={v.slug}><a href={`#provider-${v.slug}`} onClick={() => setDirectoryView("all")}>{v.name}</a><ul>{v.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></li>)}</ul>
        </details>}
        <p>The Netify team will check your brief before approaching suppliers. Your original notes stay with Netify. Only the anonymous brief below is approved for sharing.</p>
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
        <h3 id="selected-requests-title" tabIndex={-1}>Selected providers and requests ({selectedRequests.length})</h3>
        {Object.entries(selected).filter(([, a]) => a.length).length ? (
          <ul className="sourcing-request-list">
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
          <p>No providers selected. Choose a provider and a request below, or confirm your brief to ask Netify to review the options first.</p>
        )}
        <a href="#provider-research">Choose providers and requests</a>
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
            {busy ? "Preparing confirmation…" : "Email my confirmation link"}
          </button>
          <p className="sourcing-small">
            No account or public listing. Confirmation is specific to this
            request; Netify reviews it before any supplier contact.
          </p>
        </form>
        <p role="status">{message}</p>
      </section>
      {buyerProfiles ? <ShortlistProviderDirectory vendors={vendors} selected={selected} onChoose={choose} onReview={() => void reviewRequests()} reviewMessage={reviewMessage} /> : (
      <section id="provider-research" className="sourcing-directory">
        <p className="sourcing-eyebrow">Open research</p>
        <h2>All {vendors.length} researched providers</h2>
        <p>
          Ordered by evidence coverage, highest first, then name. Coverage
          measures completeness of capability evidence, not fit or quality.
          Commission never affects the order.
        </p>
        <p>
          Research-only suppliers are approached by the Netify team. A
          response-panel badge requires a named contact, an agreed response time
          and acknowledged introduction terms.
        </p>
        {matches !== null && <label>Show providers
          <select value={directoryView} onChange={e => setDirectoryView(e.target.value)}>
            <option value="all">All {vendors.length} providers</option>
            <option value="matches">Research matches ({matches.length})</option>
            <option value="selected">Selected providers ({selectedRequests.length})</option>
          </select>
        </label>}
        {directoryView === "matches" && matches?.length === 0 && <p>No providers match every research filter. Choose All providers to explore the directory.</p>}
        {directoryView === "selected" && !selectedRequests.length && <p>No providers selected. Choose All providers to select requests.</p>}
        <div className="sourcing-cards">
          {vendors.filter(v => directoryView === "all" || (directoryView === "matches" ? matches?.includes(v.slug) : selected[v.slug]?.length)).map((v) => (
            <article key={v.slug} id={`provider-${v.slug}`} tabIndex={-1}>
              <div className="sourcing-card-top">
                <h3><a href={`/sase/vendors/${v.slug}/`}>{v.name}</a></h3>
                <span>
                  {v.response_panel ? "Response panel" : "Research only"}
                </span>
              </div>
              <p>{v.category.charAt(0).toUpperCase() + v.category.slice(1)}</p>
              {showProductFocus && v.product_focus?.trim() && (
                <p data-product-focus={v.slug}><strong>Product focus:</strong> {v.product_focus}</p>
              )}
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
              {investigation.some(option => option.slug === v.slug) && <div className="sourcing-notice"><strong>Provider to investigate</strong><ul>{investigation.find(option => option.slug === v.slug)?.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
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
              <a href={`/sase/vendors/${v.slug}/`}>
                Provider profile and evidence
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
          onClick={() => void reviewRequests()}
        >
          Review selected providers and requests ({selectedRequests.length})
        </button>
        <p id="request-review-message" tabIndex={-1} role="status">{reviewMessage}</p>
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
                      <a href={`/sase/vendors/${v.slug}/`}>
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
      </section>)}
    </fieldset>
  );
}
