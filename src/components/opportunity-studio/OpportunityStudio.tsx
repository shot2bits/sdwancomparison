"use client";

import { fireNetifyEvent } from "@/components/NetifyEvents";
import SignIn from "@/components/SignIn";
import StudioEngagement from "./StudioEngagement";
import { useStudioProject } from "./useStudioProject";
import { MARKETPLACE_PUBLICATION_CONSENT_TEXT } from "@/lib/publication-policy";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  EMPTY_STUDIO_DRAFT,
  STUDIO_REGIONS,
  STUDIO_STEPS,
  studioDocument,
  studioPublicNotice,
  studioReadiness,
  studioSuggestions,
  type StudioDraft,
  type StudioFormat,
  type StudioQuestion,
  type StudioStep,
} from "@/lib/opportunity-studio";

function Icon({
  name,
  size = 20,
}: {
  name:
    | "arrow"
    | "lock"
    | "spark"
    | "file"
    | "plus"
    | "check"
    | "globe"
    | "link"
    | "close";
  size?: number;
}) {
  const paths: Record<typeof name, ReactNode> = {
    arrow: (
      <>
        <path d="M4 12h15m-6-6 6 6-6 6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </>
    ),
    spark: (
      <path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" />
    ),
    file: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
        <path d="M14 3v6h6M8 13h8m-8 4h5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" />
      </>
    ),
    link: (
      <>
        <path d="m9 15 6-6m-7 4-2 2a3 3 0 0 0 4 4l3-3m-2-8 3-3a3 3 0 0 1 4 4l-2 2" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ns-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Notice({
  draft,
  label = "Public board preview",
}: {
  draft: StudioDraft;
  label?: string;
}) {
  const n = studioPublicNotice(draft);
  return (
    <article className="ns-notice">
      <div className="ns-notice-top">
        <span>
          <i />
          {label}
        </span>
        <Icon name="globe" size={18} />
      </div>
      <div className="ns-notice-paper">
        <p className="ns-listing-label">Netify opportunity board</p>
        <p className="ns-caption">{n.format}</p>
        <h3>{n.title}</h3>
        <p className="ns-notice-summary">{n.summary}</p>
        <dl>
          <div>
            <dt>Estate</dt>
            <dd>{n.size}</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>{n.regions}</dd>
          </div>
          <div>
            <dt>Timing</dt>
            <dd>{n.timing}</dd>
          </div>
        </dl>
        <div className="ns-paper-rule" />
        <p className="ns-anonymous">
          <Icon name="lock" size={15} /> Anonymous organisation
        </p>
        <p className="ns-small">
          Names, contact details, documents and exact estate counts are excluded
          from this public view.
        </p>
      </div>
      <div className="ns-notice-bottom">
        <span>One requirement.</span>
        <strong>Your choice of provider.</strong>
      </div>
    </article>
  );
}
const SAMPLE =
  "We need fully managed SASE for 500 users and 10 offices across the UK and Europe. We want to replace our VPN, simplify security and get comparable proposals. Microsoft 365 is business-critical. Please explain migration, support and ongoing pricing.";

export default function OpportunityStudio({
  questions,
  testEnvironment = false,
  serviceContent,
}: {
  questions: StudioQuestion[];
  testEnvironment?: boolean;
  serviceContent?: ReactNode;
}) {
  const [draft, setDraft] = useState<StudioDraft>({ ...EMPTY_STUDIO_DRAFT });
  const [step, setStep] = useState<StudioStep>("describe");
  const [attempted, setAttempted] = useState(false);
  const [publicConsent, setPublicConsent] = useState(false);
  const [supplierConsent, setSupplierConsent] = useState(false);
  const [previewPublished, setPreviewPublished] = useState(false);
  const [connector, setConnector] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState(false);
  const [mcpEndpoint, setMcpEndpoint] = useState(
    "https://netify.co.uk/sase/api/mcp/",
  );
  const [mcpStatus, setMcpStatus] = useState("Not checked");
  const [storageMessage, setStorageMessage] = useState("");
  const [reviewTab, setReviewTab] = useState<"public" | "supplier">("public");
  const project = useStudioProject((d, published) => {
    setDraft(d);
    setPreviewPublished(published);
    setStep(
      published
        ? "engage"
        : studioReadiness(d, questions).length
          ? "requirements"
          : "review",
    );
    setPublicConsent(false);
    setSupplierConsent(false);
  });
  const started = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const connectorDialog = useRef<HTMLDialogElement>(null);
  const missing = studioReadiness(draft, questions);
  const categories = [...new Set(questions.map((q) => q.category))];
  const selected = questions.filter((q) => draft.questionIds.includes(q.id));
  const stepIndex = STUDIO_STEPS.findIndex((s) => s.id === step);
  function update<K extends keyof StudioDraft>(key: K, value: StudioDraft[K]) {
    if (previewPublished || project.busy) return;
    project.setPrepared(false);
    setDraft((old) => ({ ...old, [key]: value }));
    setPublicConsent(false);
    setSupplierConsent(false);
  }
  function go(next: StudioStep) {
    setStep(next);
    setAttempted(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function build() {
    fireNetifyEvent("rfp_brief_started", {
      mode: draft.format === "rfp" ? "detailed" : "short",
    });
    if (draft.requirement.trim().length < 20) {
      setAttempted(true);
      return;
    }
    setDraft((old) => ({
      ...old,
      ...Object.fromEntries(
        Object.entries(studioSuggestions(old.requirement)).filter(
          ([key]) =>
            !old[key as keyof StudioDraft] ||
            (Array.isArray(old[key as keyof StudioDraft]) &&
              !(old[key as keyof StudioDraft] as string[]).length),
        ),
      ),
      questionIds: old.questionIds.length
        ? old.questionIds
        : questions.map((q) => q.id),
    }));
    go("requirements");
  }
  function chooseFormat(format: StudioFormat) {
    update("format", format);
    if (format === "rfp" && !draft.questionIds.length)
      setDraft((old) => ({ ...old, questionIds: questions.map((q) => q.id) }));
  }
  function review() {
    setAttempted(true);
    if (!missing.length) go("review");
  }
  function save() {
    void project.run(async () => {
      await project.save(draft);
      setStorageMessage(
        "Your private project has been saved. Keep this browser link private.",
      );
    });
  }
  function restore() {
    void project.run(() => project.restore());
  }
  function download() {
    const blob = new Blob([studioDocument(draft, questions)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netify-${draft.format}-draft.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    if (file.size > 2_000_000) {
      setImportError("Use a text or Markdown file smaller than 2 MB.");
      return;
    }
    if (!/\.(txt|md)$/i.test(file.name)) {
      setImportError(
        "Use .txt and .md files. Paste text from Word or PDF instead.",
      );
      return;
    }
    try {
      const text = await file.text();
      if (text.length > 20000) {
        setImportError(
          "Please use up to 20,000 characters in your requirement.",
        );
        return;
      }
      update("requirement", text);
      setImporting(false);
    } catch {
      setImportError(
        "The file could not be read. You can paste the text instead.",
      );
    } finally {
      e.target.value = "";
    }
  }
  async function showConnector() {
    setConnector(true);
    connectorDialog.current?.showModal();
    const endpoint = window.location.origin + "/sase/api/mcp/";
    setMcpEndpoint(endpoint);
    setMcpStatus("Checking Netify MCP server…");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "netify-studio", version: "1" },
          },
        }),
      });
      const rpc = await res.json();
      if (!res.ok || !rpc.result?.serverInfo) throw new Error();
      setMcpStatus(
        "Netify MCP server reachable. Connect your assistant using the endpoint below.",
      );
    } catch {
      setMcpStatus(
        "The MCP server could not be reached. Your project is still available in this browser.",
      );
    }
  }
  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(mcpEndpoint);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="ns-studio">
      <div className="ns-preview-ribbon">
        <span>
          <i />{" "}
          {testEnvironment ? "ISOLATED TEST WORKSPACE" : "NETIFY PROCUREMENT"}
        </span>
        <span>
          {testEnvironment
            ? "Test records only. Email is captured; no external delivery."
            : "Private drafting. Anonymous publication. Buyer-controlled engagement."}
        </span>
      </div>
      <header className="ns-header">
        <a
          className="ns-logo"
          href="https://netify.co.uk/"
          aria-label="Netify home"
        >
          netify<span>®</span>
        </a>
        <span className="ns-product">Procurement service</span>
        <nav aria-label="Workspace utilities">
          <button onClick={restore}>Open draft</button>
          <details className="ns-tools">
            <summary>More tools</summary>
            <div>
              <button
                aria-label="Connect your assistant"
                onClick={showConnector}
              >
                Connect your assistant
              </button>
              <a href={serviceContent ? "#supplier-proposals" : "https://netify.co.uk/sase/how-it-works/"}>
                How the service works
              </a>
            </div>
          </details>
        </nav>
      </header>
      {!project.recoveryProject && (
        <nav className="ns-journey" aria-label="Project progress">
          <ol>
            {STUDIO_STEPS.filter(
              (s) => s.id !== "engage" || previewPublished,
            ).map((s) => {
              const i = STUDIO_STEPS.findIndex((item) => item.id === s.id);
              const label = {
                describe: "Project brief",
                requirements: "Requirements",
                review: "Review & publish",
                engage: "Supplier responses",
              }[s.id];
              return (
                <li
                  key={s.id}
                  data-active={s.id === step}
                  data-done={i < stepIndex}
                >
                  <button
                    disabled={
                      i > stepIndex || (previewPublished && s.id !== "engage")
                    }
                    onClick={() => go(s.id)}
                    aria-current={s.id === step ? "step" : undefined}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div
        className={
          project.recoveryProject ? "ns-layout ns-layout-recovery" : "ns-layout"
        }
      >
        <section className="ns-main" aria-label="Project workspace">
          <div className="ns-workspace-meta">
            <span>
              <Icon name="lock" size={13} />
              {project.recoveryProject
                ? "Saved project"
                : previewPublished
                  ? "Published project"
                  : "Private draft"}
            </span>
            <button
              onClick={save}
              disabled={previewPublished || Boolean(project.recoveryProject)}
            >
              Save draft
            </button>
          </div>
          {project.error && (
            <p className="ns-error" role="alert">
              {project.error}
              {project.legacyUrl && (
                <a className="ns-download" href={project.legacyUrl}>
                  Continue in the original editor →
                </a>
              )}
            </p>
          )}
          {project.busy && <p role="status">Saving your project…</p>}
          {storageMessage && (
            <p className="ns-storage" role="status">
              {storageMessage}
            </p>
          )}
          {project.recoveryProject && (
            <div className="ns-recovery">
              <h1 id="page-h1" ref={heading} tabIndex={-1}>
                Reopen your project
              </h1>
              <p className="ns-lead">
                Use the work email that owns this project. Your saved
                requirement and supplier conversations will reopen after
                verification.
              </p>
              <SignIn
                simple
                role="buyer"
                returnTo={`${project.returnPath}?project=${encodeURIComponent(project.recoveryProject)}`}
                onAuthed={() => {
                  void project.run(() => project.restore());
                }}
                prompt="Enter the work email you used for this project."
              />
              {project.recoveryCopy && (
                <details className="ns-recovery-copy">
                  <summary>Need your unverified draft?</summary>
                  <p>
                    This browser has a copy of your last saved brief. You can
                    start a new private draft from it. The original project
                    stays unchanged.
                  </p>
                  <button
                    className="ns-download"
                    onClick={project.restartFromCopy}
                  >
                    Start new private draft from saved copy
                  </button>
                </details>
              )}
            </div>
          )}
          {!project.recoveryProject && step === "describe" && (
            <div className="ns-entry">
              <p className="ns-eyebrow">SD-WAN & SASE procurement</p>
              <h1 id="page-h1" ref={heading} tabIndex={-1}>
                Get proposals for your SD-WAN or SASE project.
              </h1>
              <p id="page-subhead" className="ns-lead">
                Bring an existing RFP or build your requirement here. Publish an
                anonymous opportunity and choose which supplier requests to approve.
              </p>
              <p className="ns-existing-rfp">
                Already drafted your RFP with an AI assistant? Paste it below or import its text.
                Approved suppliers can request to bid; you choose who can continue in a private conversation.
                Supplier participation and proposals are not guaranteed.
              </p>
              <div className="ns-format-choice" aria-label="Document type">
                {(["rfi", "rfp"] as const).map((f) => (
                  <button
                    key={f}
                    aria-pressed={draft.format === f}
                    onClick={() => chooseFormat(f)}
                  >
                    <span>
                      <strong>
                        {f === "rfi"
                          ? "Simple project brief (RFI)"
                          : "Detailed tender (RFP)"}
                      </strong>
                      <small>
                        {f === "rfi"
                          ? "A simple statement of what you need"
                          : "A structured request for proposals"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="ns-composer">
                <label htmlFor="studio-brief">Describe your project</label>
                <textarea
                  id="studio-brief"
                  onFocus={() => {
                    if (!started.current) {
                      started.current = true;
                      fireNetifyEvent("form_start");
                    }
                  }}
                  rows={5}
                  maxLength={20000}
                  value={draft.requirement}
                  onChange={(e) => update("requirement", e.target.value)}
                  placeholder="We need managed SASE for our offices and remote users. We want to replace our VPN, improve security and hear from suitable providers…"
                  aria-describedby="studio-brief-help"
                />
                <div className="ns-composer-tools">
                  <button
                    onClick={() => setImporting(!importing)}
                    aria-expanded={importing}
                  >
                    <Icon name="plus" size={17} />
                    Import an existing brief
                  </button>
                  <button className="ns-primary" onClick={build}>
                    Continue <Icon name="arrow" size={17} />
                  </button>
                </div>
              </div>
              {importing && (
                <div className="ns-import">
                  <p>
                    Paste a brief from your team or AI assistant into the box
                    above, or import text.
                  </p>
                  <input
                    ref={fileInput}
                    hidden
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={importFile}
                  />
                  <button onClick={() => fileInput.current?.click()}>
                    <Icon name="file" size={16} />
                    Choose text file
                  </button>
                  <small>
                    Text and Markdown supported. No file is uploaded.
                  </small>
                </div>
              )}
              {importError && (
                <p className="ns-error" role="alert">
                  {importError}
                </p>
              )}
              {attempted && draft.requirement.trim().length < 20 && (
                <p className="ns-error" role="alert">
                  Tell us a little more about your project: at least 20
                  characters.
                </p>
              )}
              <p id="studio-brief-help" className="ns-help">
                <Icon name="lock" size={13} /> Start privately. No company name
                or email needed yet.
              </p>
              <div className="ns-entry-bottom">
                <button onClick={() => update("requirement", SAMPLE)}>
                  Try an example project <span>↗</span>
                </button>
                <span>Already have a brief or RFP? Paste it above.</span>
              </div>
            </div>
          )}
          {!project.recoveryProject && step === "requirements" && (
            <div className="ns-build">
              <p className="ns-eyebrow">Your requirements</p>
              <h1 id="page-h1" ref={heading} tabIndex={-1}>
                Check your project details
              </h1>
              <p className="ns-lead">
                Check the details we recognised. Fill the gaps.
                <br />
                Nothing is sent until you review and publish.
              </p>
              <div className="ns-understood">
                <p>
                  Details stated in your brief are filled in below. Check them
                  and add anything missing before publishing.
                </p>
              </div>
              <div className="ns-fields">
                <Field label="What are you buying?">
                  <select
                    value={draft.scope}
                    onChange={(e) =>
                      update("scope", e.target.value as StudioDraft["scope"])
                    }
                  >
                    <option value="">Choose a solution</option>
                    <option>SASE</option>
                    <option>SD-WAN</option>
                    <option>SSE</option>
                  </select>
                </Field>
                <Field label="Who will manage it?">
                  <select
                    value={draft.service}
                    onChange={(e) =>
                      update(
                        "service",
                        e.target.value as StudioDraft["service"],
                      )
                    }
                  >
                    <option value="">Choose a service model</option>
                    {[
                      "Fully managed",
                      "Co-managed",
                      "Self-managed",
                      "Open to advice",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Number of sites">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.sites}
                    onChange={(e) => update("sites", e.target.value)}
                    placeholder="e.g. 10"
                  />
                </Field>
                <Field label="Number of users">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.users}
                    onChange={(e) => update("users", e.target.value)}
                    placeholder="e.g. 500"
                  />
                </Field>
              </div>
              <fieldset className="ns-region-field">
                <legend>Where do you need coverage?</legend>
                <div>
                  {STUDIO_REGIONS.map((r) => (
                    <label key={r}>
                      <input
                        type="checkbox"
                        checked={draft.regions.includes(r)}
                        onChange={(e) =>
                          update(
                            "regions",
                            e.target.checked
                              ? [...draft.regions, r]
                              : draft.regions.filter((x) => x !== r),
                          )
                        }
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="When do you want to move?">
                <select
                  value={draft.timescale}
                  onChange={(e) => update("timescale", e.target.value)}
                >
                  <option value="">Choose a timescale</option>
                  {[
                    "Within 3 months",
                    "3–6 months",
                    "6–12 months",
                    "Not decided",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Your statement of requirements">
                <textarea
                  rows={5}
                  maxLength={20000}
                  value={draft.requirement}
                  onChange={(e) => update("requirement", e.target.value)}
                />
              </Field>
              <div className="ns-depth-switch">
                <div>
                  <strong>
                    {draft.format === "rfi"
                      ? "RFI · A clear starting point"
                      : "RFP · Go into the detail"}
                  </strong>
                  <p>
                    {draft.format === "rfi"
                      ? "Invite capability responses against your scope."
                      : "Ask each supplier the same questions and request a priced proposal."}
                  </p>
                </div>
                <button
                  onClick={() =>
                    chooseFormat(draft.format === "rfi" ? "rfp" : "rfi")
                  }
                >
                  {draft.format === "rfi"
                    ? "Make this a detailed RFP"
                    : "Use a simpler RFI"}{" "}
                  <Icon name="arrow" size={16} />
                </button>
              </div>
              {draft.format === "rfp" && (
                <section className="ns-question-bank">
                  <div>
                    <h2>Questions suppliers will answer</h2>
                    <span>{selected.length} selected</span>
                  </div>
                  <p>
                    From Netify’s governed question bank. Include what matters
                    to your project.
                  </p>
                  {categories.map((category) => (
                    <details key={category}>
                      <summary>
                        <span>{category}</span>
                        <small>
                          {
                            questions.filter(
                              (q) =>
                                q.category === category &&
                                draft.questionIds.includes(q.id),
                            ).length
                          }{" "}
                          /{" "}
                          {
                            questions.filter((q) => q.category === category)
                              .length
                          }
                        </small>
                      </summary>
                      {questions
                        .filter((q) => q.category === category)
                        .map((q) => (
                          <label key={q.id}>
                            <input
                              type="checkbox"
                              checked={draft.questionIds.includes(q.id)}
                              onChange={(e) =>
                                update(
                                  "questionIds",
                                  e.target.checked
                                    ? [...draft.questionIds, q.id]
                                    : draft.questionIds.filter(
                                        (id) => id !== q.id,
                                      ),
                                )
                              }
                            />
                            <span>
                              {q.text}
                              <small>{q.id}</small>
                            </span>
                          </label>
                        ))}
                    </details>
                  ))}
                </section>
              )}
              {attempted && missing.length > 0 && (
                <div className="ns-error" role="alert">
                  <strong>A few details to finish</strong>
                  <ul>
                    {missing.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="ns-actions">
                <button className="ns-back" onClick={() => go("describe")}>
                  ← Back
                </button>
                <button className="ns-primary" onClick={review}>
                  Review my opportunity <Icon name="arrow" size={18} />
                </button>
              </div>
            </div>
          )}
          {!project.recoveryProject && step === "review" && (
            <div className="ns-review">
              <p className="ns-eyebrow">
                <Icon name="lock" size={16} /> YOU DECIDE WHAT IS SHARED
              </p>
              <h1 id="page-h1" ref={heading} tabIndex={-1}>
                Review and publish your requirement
              </h1>
              <p className="ns-lead">
                One final check. Two different views.
                <br />
                Your identity stays separate from your requirement.
              </p>
              <div
                className="ns-review-tabs"
                role="group"
                aria-label="Review visibility"
              >
                <button
                  aria-pressed={reviewTab === "public"}
                  onClick={() => setReviewTab("public")}
                >
                  <Icon name="globe" size={16} />
                  Public board
                </button>
                <button
                  aria-pressed={reviewTab === "supplier"}
                  onClick={() => setReviewTab("supplier")}
                >
                  <Icon name="lock" size={16} />
                  Approved suppliers
                </button>
              </div>
              {reviewTab === "public" ? (
                <Notice draft={draft} />
              ) : (
                <div className="ns-supplier-document">
                  <p className="ns-caption">
                    SIGNED-IN, APPROVED SUPPLIER VIEW
                  </p>
                  <h2>
                    {draft.scope} {draft.format.toUpperCase()}
                  </h2>
                  <p className="ns-preserve">{draft.requirement}</p>
                  <dl>
                    <div>
                      <dt>Sites / users</dt>
                      <dd>
                        {draft.sites || "Not stated"} /{" "}
                        {draft.users || "Not stated"}
                      </dd>
                    </div>
                    <div>
                      <dt>Coverage</dt>
                      <dd>{draft.regions.join(", ")}</dd>
                    </div>
                    <div>
                      <dt>Service model</dt>
                      <dd>{draft.service}</dd>
                    </div>
                    <div>
                      <dt>Timing</dt>
                      <dd>{draft.timescale}</dd>
                    </div>
                  </dl>
                  {draft.format === "rfp" && (
                    <>
                      <h3>Supplier questions</h3>
                      <ol>
                        {selected.map((q) => (
                          <li key={q.id}>{q.text}</li>
                        ))}
                      </ol>
                    </>
                  )}
                  <p className="ns-small">
                    Remove company names and personal information from the
                    requirement before sharing it. Your account and contact
                    details are never included here.
                  </p>
                </div>
              )}
              <div className="ns-visibility">
                <div>
                  <Icon name="globe" />
                  <span>
                    <strong>Public</strong>
                    <small>
                      General scope, regions, estate bands and timing.
                    </small>
                  </span>
                </div>
                <div>
                  <Icon name="file" />
                  <span>
                    <strong>Approved suppliers</strong>
                    <small>
                      The requirement and RFP questions, after sign-in.
                    </small>
                  </span>
                </div>
                <div>
                  <Icon name="lock" />
                  <span>
                    <strong>Private to you & Netify</strong>
                    <small>
                      Identity, contact details and supplier pricing.
                    </small>
                  </span>
                </div>
              </div>
              <div className="ns-consents">
                <label>
                  <input
                    type="checkbox"
                    checked={publicConsent}
                    onChange={(e) => setPublicConsent(e.target.checked)}
                  />
                  <span>{MARKETPLACE_PUBLICATION_CONSENT_TEXT}</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={supplierConsent}
                    onChange={(e) => setSupplierConsent(e.target.checked)}
                  />
                  <span>
                    I have removed identifying details from my requirement and
                    approve sharing this reviewed requirement with signed-in,
                    approved suppliers.
                  </span>
                </label>
              </div>
              <Field label="Your company name (private)">
                <input
                  value={project.company}
                  maxLength={200}
                  onChange={(e) => {
                    project.setCompany(e.target.value);
                    project.setPrepared(false);
                  }}
                  autoComplete="organization"
                />
              </Field>
              <p className="ns-small">
                Your company and work email verify ownership. Neither is shown
                on the public board or automatically shared with suppliers.
              </p>
              {!project.prepared ? (
                <button
                  className="ns-primary"
                  disabled={
                    project.busy ||
                    !publicConsent ||
                    !supplierConsent ||
                    missing.length > 0 ||
                    project.company.trim().length < 2
                  }
                  onClick={() => project.run(() => project.prepare(draft))}
                >
                  Save review & verify identity <Icon name="arrow" size={18} />
                </button>
              ) : (
                <>
                  {!project.authenticated ? (
                    <SignIn
                      simple
                      role="buyer"
                      publishRfpId={project.credential?.project_reference}
                      projectSessionToken={
                        project.credential?.project_session_token
                      }
                      returnTo={`${project.returnPath}?project=${encodeURIComponent(project.credential?.project_reference ?? "")}`}
                      onAuthed={() => {
                        void project.run(() => project.session());
                      }}
                      publicationVerification
                      prompt="Verify your work email. Then return here for the final Publish click."
                    />
                  ) : (
                    <p role="status">
                      Your work email is verified. Review the notice above, then
                      publish.
                    </p>
                  )}
                  <button
                    className="ns-primary"
                    disabled={
                      project.busy ||
                      !project.authenticated ||
                      !publicConsent ||
                      !supplierConsent
                    }
                    onClick={() => project.run(() => project.publish())}
                  >
                    Publish my opportunity <Icon name="arrow" size={18} />
                  </button>
                </>
              )}
              <div className="ns-actions">
                <button
                  className="ns-back"
                  onClick={() => go("requirements")}
                  disabled={project.busy}
                >
                  ← Edit requirement
                </button>
              </div>
              <button className="ns-download" onClick={download}>
                <Icon name="file" size={16} />
                Download my draft
              </button>
            </div>
          )}
          {!project.recoveryProject &&
            step === "engage" &&
            project.credential && (
              <StudioEngagement
                projectId={project.credential.project_reference}
                noticeUrl={project.noticeUrl}
              />
            )}
          <footer className="ns-workspace-footer">
            <span>Free to publish. No commitment to buy.</span>
            <span>
              Suppliers pay Netify when an introduction leads to business.
            </span>
          </footer>
        </section>
        {!project.recoveryProject && (
          <aside className="ns-context" aria-label="Live requirement preview">
            <div className="ns-context-heading">
              <h2>
                {step === "review"
                  ? "Before you publish"
                  : "Your public listing"}
              </h2>
              {step !== "review" && (
                <span>{previewPublished ? "Published" : "Draft preview"}</span>
              )}
            </div>
            {step !== "review" && (
              <Notice
                draft={draft}
                label={
                  previewPublished
                    ? "Published opportunity"
                    : "Public board preview"
                }
              />
            )}
            <div className="ns-context-note">
              <p>
                {step === "review"
                  ? "Check both views before publishing. Your company name and work email stay private. Remove identifying details from the requirement you share with approved suppliers."
                  : draft.format === "rfi"
                    ? "Start with a clear statement of requirements. Suppliers can ask questions and put their approach forward."
                    : "A single scope and shared question set help you assess proposals on the same basis."}
              </p>
            </div>
            <div className="ns-context-process">
              <p className="ns-caption">WHAT HAPPENS NEXT</p>
              <ol>
                <li>You approve your listing.</li>
                <li>Approved suppliers review it.</li>
                <li>They request to bid.</li>
                <li>You choose who to engage.</li>
              </ol>
              <p>
                Supplier participation and response times are not guaranteed.
              </p>
            </div>
          </aside>
        )}
      </div>
      {serviceContent}
      <dialog
        ref={connectorDialog}
        className="ns-connector"
        onClose={() => setConnector(false)}
        aria-labelledby="studio-connector-title"
      >
        <div className="ns-dialog-top">
          <span className="ns-caption">NETIFY × YOUR ASSISTANT</span>
          <button
            aria-label="Close assistant connection"
            onClick={() => connectorDialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <Icon name="link" size={36} />
        <h2 id="studio-connector-title">Connect your assistant</h2>
        <p>
          Use a supported MCP client to research providers, prepare requirements
          and continue a project. Private actions require the correct project
          credentials and buyer approval.
        </p>
        <div className="ns-connection-status">
          <i />
          {mcpStatus}
        </div>
        <label className="ns-field">
          <span>Netify marketplace MCP endpoint</span>
          <input readOnly value={mcpEndpoint} />
        </label>
        <button className="ns-primary" onClick={copyEndpoint}>
          {copied ? "Endpoint copied" : "Copy endpoint"}
          <Icon name={copied ? "check" : "link"} size={17} />
        </button>
        <p className="ns-small">
          Copying this address does not connect an assistant or grant access.
          You can explicitly share the current project with an assistant below;
          keep its access details private.
        </p>
        {project.credential && (
          <button
            className="ns-download"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  JSON.stringify(
                    {
                      endpoint: window.location.origin + "/sase/api/mcp/",
                      project_id: project.credential!.project_reference,
                      project_session_token:
                        project.credential!.project_session_token,
                      revision: project.credential!.revision,
                      instructions:
                        "Use read_studio_project to read this project and save_studio_requirement to update it with my explicit consent. Publication requires my final verified approval on the Netify website. This private credential expires after eight hours.",
                    },
                    null,
                    2,
                  ),
                );
                setStorageMessage(
                  "Private assistant handoff copied. Share only with an assistant you trust.",
                );
              } catch {
                setStorageMessage(
                  "Clipboard unavailable. Keep working in the browser.",
                );
              }
            }}
          >
            Copy private project handoff
          </button>
        )}
        <details>
          <summary>Current tools and approval boundaries</summary>
          <dl>
            <dt>start_project / update_requirements</dt>
            <dd>
              Prepare or amend a private project using scoped credentials.
            </dd>
            <dt>prepare_publication</dt>
            <dd>Prepare publication intent. Does not publish.</dd>
            <dt>publish_opportunity</dt>
            <dd>
              Requires a verified buyer session, project ownership, current
              revision and consent.
            </dd>
            <dt>get_project_status</dt>
            <dd>Read the private project with the required owner access.</dd>
          </dl>
        </details>
        <a
          href="https://netify.co.uk/sase/connector/"
          target="_blank"
          rel="noreferrer"
        >
          Read the live connector guide ↗
        </a>
      </dialog>
      <span className="ns-sr-only" role="status">
        {connector ? "Assistant connection information open" : ""}
      </span>
    </div>
  );
}
