"use client";

/**
 * DescribeWizard: the front door of the Describe, Generate, Publish flow
 * (docs/netify-rfp-flow-spec-2026-07-14.md). Five micro-steps, one decision
 * per screen, with a live supplier-match panel so the value proposition is
 * shown as a dataset fact while the buyer types. No server draft exists
 * until the final step completes, which also stops CTA landings inflating
 * the draft count. On completion it creates the RFP (title + buyer context),
 * stores the manage token under the builder's key and hands off to
 * /rfp-builder/{id}?welcome=generated for the Generate moment.
 */

import { useEffect, useRef, useState } from "react";
import { fireNetifyEvent, firstTouch } from "@/components/NetifyEvents";
import WizardProgressRail, { WizardProgressBar } from "@/components/WizardProgressRail";
import FlowStageStrip from "@/components/FlowStageStrip";
import { REGIONS, SITES_BANDS, USERS_BANDS, SECTORS } from "@/lib/notice-options";

const SCOPES = [
  { key: "sdwan", label: "SD-WAN", sub: "Replace or refresh the wide area network" },
  { key: "sse", label: "SSE", sub: "Security service edge: SWG, ZTNA, CASB" },
  { key: "sase", label: "Full SASE", sub: "SD-WAN and cloud security together" },
  { key: "managed", label: "Managed service", sub: "A provider runs it end to end" },
  { key: "unsure", label: "Not sure yet", sub: "Netify recommends the right scope" },
] as const;

const CURRENT_STACK = [
  { key: "mpls", label: "MPLS circuits" },
  { key: "sdwan_incumbent", label: "Existing SD-WAN" },
  { key: "firewalls", label: "On-site firewalls" },
  { key: "vpn", label: "Remote-access VPN" },
  { key: "internet_only", label: "Internet-only WAN" },
  { key: "none", label: "None of these" },
] as const;

const DRIVERS = [
  { key: "contract_end", label: "Contract ending" },
  { key: "cost", label: "Cost reduction" },
  { key: "security", label: "Security improvement" },
  { key: "growth", label: "Growth or new sites" },
  { key: "performance", label: "Performance problems" },
  { key: "cloud", label: "Cloud migration" },
] as const;

const TIMELINES = [
  { key: "asap", label: "As soon as possible" },
  { key: "3m", label: "Within 3 months" },
  { key: "6m", label: "3 to 6 months" },
  { key: "12m", label: "6 to 12 months" },
  { key: "research", label: "Researching for now" },
] as const;

const MODELS = [
  { key: "any", label: "No preference" },
  { key: "managed", label: "Fully managed" },
  { key: "co_managed", label: "Co-managed" },
  { key: "diy", label: "In-house (DIY)" },
] as const;

const COMPLIANCE = [
  { key: "uk_gdpr", label: "UK GDPR" },
  { key: "pci_dss", label: "PCI DSS" },
  { key: "iso_27001", label: "ISO 27001" },
  { key: "dora", label: "EU DORA" },
  { key: "nis2", label: "EU NIS2" },
  { key: "iec_62443", label: "IEC 62443 (OT)" },
] as const;

/** Wizard scope key → persisted product_scope + delivery model default. */
function scopeToBuyer(scope: string): { product_scope: string; operating_model?: string } {
  if (scope === "sdwan") return { product_scope: "sdwan_only" };
  if (scope === "sse") return { product_scope: "sse_only" };
  if (scope === "managed") return { product_scope: "full_sase", operating_model: "managed" };
  return { product_scope: "full_sase" };
}

/** Representative site count for the question engine from the public band. */
const SITE_COUNT_FOR_BAND: Record<string, number> = {
  "1-5": 5, "6-20": 20, "21-50": 50, "51-200": 125, "200+": 250,
};

type Match = { count: number; total: number; names: string[] };

export default function DescribeWizard() {
  const [step, setStep] = useState(0);
  // Agreement step (consent-at-generate, Robert's decisions 15 July 2026):
  // generating and submitting to the marketplace are one agreed action.
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  // Optional anonymous listing on the public opportunity board: sector and
  // size band only, never the company name (buyer_visibility is anonymous by
  // construction in the publish core). Off by default; explicit consent.
  const [listBoard, setListBoard] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [sites, setSites] = useState("");
  const [users, setUsers] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [timeline, setTimeline] = useState("");
  const [model, setModel] = useState("any");
  const [sector, setSector] = useState("");
  const [compliance, setCompliance] = useState<string[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Vendors named for evaluation via ?vendors= (20 July 2026, the agentic
  // evaluation kits). Pinned into the invite list at publish, capped at 5,
  // validated server-side against the marketplace dataset.
  const [pinnedVendors, setPinnedVendors] = useState<string[]>([]);
  const started = useRef(false);

  // Pre-answer from entry links (?scope=sdwan&sector=healthcare), editable.
  // The homepage hero form carries ?title=, which answers step one: land
  // straight on scope with the title set (Back shows it, still editable).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("scope");
    if (s && SCOPES.some((x) => x.key === s)) setScope(s);
    const sec = p.get("sector");
    if (sec && SECTORS.some((x) => x.key === sec)) setSector(sec);
    const v = (p.get("vendors") ?? "").trim();
    if (v) setPinnedVendors(v.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 5));
    const t = (p.get("title") ?? "").trim();
    if (t.length >= 8) {
      setTitle(t.slice(0, 120));
      setStep(1);
      started.current = true;
      fireNetifyEvent("describe_started", { from: "hero" });
    }
  }, []);

  // Live supplier match: refreshed whenever scope, regions or model change.
  // The current model state always drives the query (Harry, 14 July: picking
  // the Managed service scope used to freeze the model, so the step-four
  // buttons changed nothing and the count looked stuck).
  useEffect(() => {
    if (!scope || scope === "unsure") { setMatch(null); return; }
    const q = new URLSearchParams({ scope: scope === "managed" ? "sase" : scope, regions: regions.join("."), model });
    const t = window.setTimeout(() => {
      fetch(`/sase/api/rfp/match?${q.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && typeof d.count === "number") setMatch(d); })
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [scope, regions, model]);

  function markStarted() {
    if (started.current) return;
    started.current = true;
    fireNetifyEvent("describe_started", pinnedVendors.length ? { vendors: pinnedVendors.join(",") } : {});
    // Hide the page's supporting explainer sections once the person is in
    // the flow (WizardSupportingContent listens; crawlers still see them).
    try { window.dispatchEvent(new Event("netify:describe-started")); } catch { /* ignore */ }
  }

  function advance(next: number, stepName: string) {
    fireNetifyEvent("describe_step", { step: stepName });
    setStep(next);
  }

  const toggle = (list: string[], set: (v: string[]) => void, key: string) => {
    markStarted();
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  // The agreement step needs to know whether a session already exists (a
  // signed-in buyer skips the email field and submission fires immediately).
  useEffect(() => {
    if (step !== 6 || authed !== null) return;
    fetch("/sase/api/auth/session")
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((d: { authenticated?: boolean }) => setAuthed(!!d.authenticated))
      .catch(() => setAuthed(false));
  }, [step, authed]);

  async function create(submit: boolean) {
    if (creating) return;
    setCreating(true); setError(null);
    const scoped = scopeToBuyer(scope);
    const noteParts: string[] = [];
    if (stack.length && !stack.includes("none")) noteParts.push(`Current estate: ${stack.map((k) => CURRENT_STACK.find((c) => c.key === k)?.label ?? k).join(", ")}.`);
    if (drivers.length) noteParts.push(`Drivers: ${drivers.map((k) => DRIVERS.find((d) => d.key === k)?.label ?? k).join(", ")}.`);
    if (timeline) noteParts.push(`Timeline: ${TIMELINES.find((t) => t.key === timeline)?.label ?? timeline}.`);
    if (users) noteParts.push(`Users: ${USERS_BANDS.find((u) => u.key === users)?.label ?? users}.`);
    if (scope === "unsure") noteParts.push("Buyer is unsure of scope; recommend the right approach in responses.");
    if (pinnedVendors.length) noteParts.push(`Vendors named for evaluation: ${pinnedVendors.join(", ")}.`);
    const buyer = {
      sector: sector || null,
      site_count: SITE_COUNT_FOR_BAND[sites] ?? null,
      regions,
      compliance,
      operating_model: scoped.operating_model ?? model,
      product_scope: scoped.product_scope,
      pinned_vendors: pinnedVendors,
      notes: noteParts.join(" "),
    };
    try {
      let id = createdId;
      if (!id) {
        // Consent wording version stamped onto submitted RFPs. Bump when the
        // agreement copy on step 6 changes materially.
        const consent = submit ? { version: "submit-agreement v3, 17 July 2026", agreed_at: Date.now(), flow: "wizard_submit" } : undefined;
        // Submit intent carried on the draft itself (server-side), so the
        // "Confirm and submit" magic link completes the submission whichever
        // device it is opened on. The localStorage copy below remains the
        // same-browser fast path.
        const pending_submit = submit ? { shortlist_size: 5, list_on_board: listBoard, marketing_opt_in: optIn } : undefined;
        // On the submit path the agreement email doubles as the contact
        // address on the draft, so the reminder cron can still reach a buyer
        // whose magic-link click never happens. No email is ever sent about
        // the draft itself; the only email is Confirm and submit.
        const contact_email = submit && email.trim().includes("@") ? email.trim() : undefined;
        const res = await fetch("/sase/api/rfp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title.trim(), buyer, consent, pending_submit, contact_email }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Could not create your project."); }
        const p = (await res.json()) as { id: string; manage_token?: string };
        if (p.manage_token) { try { localStorage.setItem(`netify_mtok_${p.id}`, p.manage_token); } catch { /* private mode */ } }
        id = p.id;
        setCreatedId(p.id);
        fireNetifyEvent("describe_completed", { scope: scope || "unset" });
      }

      if (!submit) {
        window.location.assign(`/sase/rfp-builder/${id}/?welcome=generated`);
        return;
      }

      // Submit path: record the agreed publish options, then either rely on
      // the live session or send the magic link. The builder's auto-resume
      // completes the publish the moment the session exists.
      try {
        localStorage.setItem(`rfp_pending_publish_${id}`, "1");
        localStorage.setItem(`rfp_publish_opts_${id}`, JSON.stringify({ shortlist_size: 5, list_on_board: listBoard, marketing_opt_in: optIn }));
      } catch { /* private mode: the builder panel still offers publish */ }
      fireNetifyEvent("submit_agreed", { matched: String(Math.min(5, match?.count ?? 0)), opt_in: optIn ? "1" : "0" });

      if (!authed) {
        const ar = await fetch("/sase/api/auth/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim(), role: "buyer", return_to: `/sase/rfp-builder/${id}/?welcome=submitting`, marketing_opt_in: optIn, attribution: firstTouch() }),
        });
        if (!ar.ok) {
          const e = (await ar.json().catch(() => ({}))) as { error?: string; message?: string };
          throw new Error(e.message ?? e.error ?? "That email address could not be used. Please use your work email.");
        }
        try { sessionStorage.setItem("netify_pending_email", email.trim()); } catch { /* ignore */ }
      }
      window.location.assign(`/sase/rfp-builder/${id}/?welcome=submitting`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your project.");
      setCreating(false);
    }
  }

  const card = "w-full text-left rounded-sm border p-4 transition-colors";
  const idle = "border-[var(--ink-200,#e5e5e5)] hover:border-[var(--ink-400,#999)]";
  const active = "border-amber-500 bg-amber-50";
  const chip = "px-3.5 py-1.5 text-sm rounded-full border transition-colors";
  const nextBtn = "px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50";
  const backBtn = "px-4 py-2 text-sm underline text-[var(--ink-600,#555)]";

  const STEP_COUNT = 7;
  const heading = (t: string, sub: string) => (
    <div className="mb-5">
      <p className="eyebrow mb-2">Step {step + 1} of {STEP_COUNT}</p>
      <h2 className="text-xl mb-1">{t}</h2>
      <p className="text-sm text-[var(--ink-600,#555)]">{sub}</p>
    </div>
  );

  // Walkthrough line per step: what this answer does, and what follows.
  const STRIP: { now: string; next: string }[] = [
    { now: "You are naming your project. Suppliers see this title first.", next: "Four quick questions about scope, estate and timing." },
    { now: "Choosing what is in scope, so the right supplier types match.", next: "Estate size and regions." },
    { now: "Sizing the estate. Suppliers use this to shape their response.", next: "What you run today, and why change." },
    { now: "Capturing today's setup and the drivers. This becomes the RFP background.", next: "Timescale and delivery model." },
    { now: "Setting the timescale and who runs the service day to day.", next: "Optional extras, then Netify builds your RFP." },
    { now: "Optional detail that sharpens the compliance questions.", next: "The agreement: generate your RFP and submit it to your matched suppliers." },
    { now: "The agreement: your RFP generates and goes to your matched suppliers, who make contact through this app.", next: "Netify builds the document and submits it. You can review and refine afterwards; suppliers always see the latest version." },
  ];

  return (
    <div>
      <FlowStageStrip stage="describe" now={STRIP[step].now} next={STRIP[step].next} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="max-w-xl">
        <div className="lg:hidden mb-5"><WizardProgressBar step={step} count={STEP_COUNT} /></div>
        {step === 0 && (
          <div>
            {heading("What are you buying?", "One line is enough. This becomes your project title, and suppliers see it first.")}
            <input
              value={title}
              onChange={(e) => { markStarted(); setTitle(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim().length >= 8) advance(1, "title"); }}
              placeholder="e.g. Managed SD-WAN for 40 UK retail sites"
              className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-3 text-base"
              autoFocus
            />
            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => advance(1, "title")} disabled={title.trim().length < 8} className={nextBtn}>Continue</button>
              <span className="text-xs text-[var(--ink-500)]">Free for buyers. No sign-in until you submit to suppliers.</span>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            {heading("What is in scope?", "Pick the closest fit. You can refine it later.")}
            <div className="space-y-2">
              {SCOPES.map((s) => (
                <button key={s.key} onClick={() => { markStarted(); setScope(s.key); if (s.key === "managed") setModel("managed"); advance(2, "scope"); }} className={`${card} ${scope === s.key ? active : idle}`}>
                  <span className="block text-sm font-semibold">{s.label}</span>
                  <span className="block text-sm text-[var(--ink-600,#555)]">{s.sub}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(0)} className={`${backBtn} mt-4`}>Back</button>
          </div>
        )}

        {step === 2 && (
          <div>
            {heading("How big is the estate?", "Bands are fine. Suppliers use this to size their response.")}
            <p className="text-sm font-medium mb-2">Sites</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {SITES_BANDS.map((b) => (
                <button key={b.key} onClick={() => { markStarted(); setSites(b.key); }} className={`${chip} ${sites === b.key ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{b.label}</button>
              ))}
            </div>
            <p className="text-sm font-medium mb-2">Users</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {USERS_BANDS.map((b) => (
                <button key={b.key} onClick={() => { markStarted(); setUsers(b.key); }} className={`${chip} ${users === b.key ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{b.label}</button>
              ))}
            </div>
            <p className="text-sm font-medium mb-2">Regions</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button key={r.key} onClick={() => toggle(regions, setRegions, r.key)} className={`${chip} ${regions.includes(r.key) ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{r.label}</button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => advance(3, "estate")} disabled={!sites || regions.length === 0} className={nextBtn}>Continue</button>
              <button onClick={() => setStep(1)} className={backBtn}>Back</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            {heading("What do you run today, and why change?", "Pick everything that applies.")}
            <p className="text-sm font-medium mb-2">Today</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {CURRENT_STACK.map((c) => (
                <button key={c.key} onClick={() => toggle(stack, setStack, c.key)} className={`${chip} ${stack.includes(c.key) ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{c.label}</button>
              ))}
            </div>
            <p className="text-sm font-medium mb-2">Driving the change</p>
            <div className="flex flex-wrap gap-2">
              {DRIVERS.map((d) => (
                <button key={d.key} onClick={() => toggle(drivers, setDrivers, d.key)} className={`${chip} ${drivers.includes(d.key) ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{d.label}</button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => advance(4, "context")} className={nextBtn}>Continue</button>
              <button onClick={() => setStep(2)} className={backBtn}>Back</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            {heading("When do you need it, and who runs it?", "Rough is fine. Suppliers plan their response around this.")}
            <p className="text-sm font-medium mb-2">Timescale</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {TIMELINES.map((t) => (
                <button key={t.key} onClick={() => { markStarted(); setTimeline(t.key); }} className={`${chip} ${timeline === t.key ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{t.label}</button>
              ))}
            </div>
            <p className="text-sm font-medium mb-2">Delivery model</p>
            <div className="flex flex-wrap gap-2">
              {MODELS.map((m) => (
                <button key={m.key} onClick={() => { markStarted(); setModel(m.key); }} className={`${chip} ${model === m.key ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{m.label}</button>
              ))}
            </div>
            {/* Optional early email (16 July 2026): the single biggest funnel
                leak was drafts nobody could reach. Strictly optional, no
                gating, shares the same state as the agreement step so it
                prefills there. The create API emails the draft link
                immediately, so the address gets value the moment it is
                given. */}
            {/* Mid-wizard email capture removed (Robert's final call, 16 July
                2026): any chance to email yourself the draft competes with
                the one outcome that matters, submitting to the marketplace.
                The work email is captured at the agreement step, where the
                submission IS the action. */}
            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => advance(5, "timeline")} className={nextBtn}>Continue</button>
              <button onClick={() => setStep(3)} className={backBtn}>Back</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            {heading("Anything else that shapes the RFP?", "Optional. Skip it and Netify still builds the full document.")}
            <p className="text-sm font-medium mb-2">Sector</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {SECTORS.map((s) => (
                <button key={s.key} onClick={() => { markStarted(); setSector(sector === s.key ? "" : s.key); }} className={`${chip} ${sector === s.key ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{s.label}</button>
              ))}
            </div>
            <p className="text-sm font-medium mb-2">Compliance</p>
            <div className="flex flex-wrap gap-2">
              {COMPLIANCE.map((c) => (
                <button key={c.key} onClick={() => toggle(compliance, setCompliance, c.key)} className={`${chip} ${compliance.includes(c.key) ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}>{c.label}</button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => setStep(6)} className={nextBtn}>Continue</button>
              <button onClick={() => setStep(4)} className={backBtn}>Back</button>
            </div>
            <p className="mt-3 text-xs text-[var(--ink-500)]">One step left: agree the submission and Netify assembles the complete document from its question bank (Methodology v2026.1).</p>
          </div>
        )}

        {step === 6 && (
          <div>
            {heading("Generate and submit to the marketplace", "Built for UK and North American businesses with national or global network requirements.")}
            {match && match.count > 0 && (
              <p className="mb-3 text-sm text-[var(--ink-700)]">
                Going to: <strong>{match.names.slice(0, Math.min(5, match.count)).join(", ")}</strong>.
                {match.count > 5 ? ` ${match.count - 5} more match; you can add them after submitting.` : " You can add more after submitting."}
              </p>
            )}
            {authed === true ? (
              <p className="mb-3 text-sm text-emerald-700">You are signed in, so submission fires as soon as your RFP is generated.</p>
            ) : (
              <div className="mb-3">
                <label className="text-sm font-medium block mb-1">Work email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@yourcompany.com"
                  className="w-full max-w-md border border-[var(--ink-300,#ccc)] rounded-sm p-3 text-base"
                />
                <p className="mt-1 text-xs text-[var(--ink-500)]">Business addresses only. We email a confirm link and a 6-digit code; either completes your submission (the code works on this screen, no link-hunting).</p>
              </div>
            )}
            {/* The quote-reveal moment, compare-the-market style (Robert,
                17 July 2026): what submitting buys you, in four scannable
                lines, before the legal detail. */}
            <div className="mb-4 rounded-sm border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-sm font-semibold mb-2">What you get the moment you submit</p>
              <ul className="space-y-1.5 text-sm text-[var(--ink-700)]">
                <li className="flex gap-2"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> <span>Your <strong>Netify Market Report</strong>, instantly: an indicative market price band for your estate (Netify TCO Methodology), plus a gap check on your requirement</span></li>
                <li className="flex gap-2"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> <span>Your RFP as a <strong>Word and PDF document</strong> to circulate internally</span></li>
                <li className="flex gap-2"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> Your RFP goes to your {Math.min(5, match?.count ?? 5) || 5} matched suppliers, each with a private response link; structured responses come back side by side</li>
                <li className="flex gap-2"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> Pricing stays private to you; you stay anonymous until you reply, and your contact details are never shown to suppliers</li>
              </ul>
              <p className="mt-2 text-xs text-[var(--ink-600,#555)]">A Netify analyst reviews every published RFP.</p>
            </div>
            <p className="mb-3 text-xs text-[var(--ink-600,#555)]">
              Suppliers make contact only through this app and conversations start when you reply. You can edit
              your RFP after submitting and suppliers always see the latest version. Your data goes only to a
              vetted account manager at each matched vendor or managed service provider. We only email you about
              your RFPs, opportunities and RFP Builder and Marketplace features. No third-party marketing.{" "}
              <a href="https://netify.co.uk/privacy-policy/" className="underline" target="_blank" rel="noreferrer">Privacy policy</a>.
            </p>
            <label className="mb-2 flex items-start gap-2 text-xs text-[var(--ink-600,#555)]">
              <input type="checkbox" checked={listBoard} onChange={(e) => setListBoard(e.target.checked)} className="mt-0.5" />
              <span>Also list this RFP <strong>anonymously</strong> on the public opportunity board so additional verified suppliers can register interest. The board shows your sector, estate size and requirement only — never your company name or contact details (optional).</span>
            </label>
            <label className="mb-4 flex items-start gap-2 text-xs text-[var(--ink-600,#555)]">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5" />
              <span>Email me about new Netify features and research (optional).</span>
            </label>
            {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => create(true)}
                disabled={creating || (authed !== true && !email.includes("@"))}
                className={nextBtn}
              >
                {creating ? "Submitting..." : `Generate and submit to your ${Math.min(5, match?.count ?? 5) || 5} matched suppliers`}
              </button>
              <button onClick={() => setStep(5)} className={backBtn}>Back</button>
            </div>
            <p className="mt-2 text-xs text-[var(--ink-600,#555)]">Free and no obligation to award. You choose who to speak with.</p>
            <button onClick={() => create(false)} disabled={creating} className="mt-3 block text-[11px] text-[var(--ink-500)] underline">
              Generate only, review first
            </button>
          </div>
        )}
      </div>

      {/* Live supplier match: the value proposition as a dataset fact. */}
      <aside className="lg:pt-14">
        <div className="hidden lg:block mb-4"><WizardProgressRail step={step} count={STEP_COUNT} /></div>
        <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base,#faf9f7)] p-4 sticky top-6">
          {match && match.count > 0 ? (
            <>
              <p className="text-2xl font-semibold mb-1">{match.count}</p>
              <p className="text-sm text-[var(--ink-700)] mb-1">verified suppliers on the Netify marketplace match this project so far.</p>
              <p className="mb-3 text-xs text-[var(--ink-500)]">
                Matching on: {SCOPES.find((s) => s.key === scope)?.label ?? scope}
                {" · "}{MODELS.find((m) => m.key === model)?.label ?? model}
                {regions.length > 0 ? ` · ${regions.length} region${regions.length === 1 ? "" : "s"}` : ""}
              </p>
              <p className="text-xs text-[var(--ink-500)] mb-1">Including:</p>
              <p className="text-sm text-[var(--ink-700)]">{match.names.slice(0, 6).join(", ")}{match.count > 6 ? " and more" : ""}.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold mb-1">Who sees this?</p>
              <p className="text-sm text-[var(--ink-600,#555)]">As you answer, this panel shows how many verified vendors and managed providers match your project. Publishing is always your explicit choice.</p>
            </>
          )}
          <p className="mt-3 text-xs text-[var(--ink-500)]">Responses come back structured against your questions. Pricing stays private to you.</p>
        </div>
      </aside>
      </div>
    </div>
  );
}
