"use client";

/**
 * NoticeBuilder: the staged project-notice wizard. Everything up to and
 * including the preview is completely open; sign-in is required only at
 * "Publish opportunity", and the draft (kept in localStorage) is carried
 * through the sign-in round trip so nothing is lost at the gate.
 */

import { useEffect, useMemo, useState } from "react";
import NoticeView from "@/components/NoticeView";
import { firstTouch } from "@/components/NetifyEvents";
import { track } from "@/lib/analytics";
import {
  OPP_SCOPES,
  OPP_SCOPE_LABELS,
  RESPONSE_MODES,
  RESPONSE_MODE_LABELS,
  type OppScope,
  type PublicOpportunity,
  type ResponseMode,
} from "@/lib/opportunity-types";
import {
  SECTORS,
  SIZE_BANDS,
  USERS_BANDS,
  REGIONS,
  CLOUD_PLATFORMS,
  COMPLIANCE_OPTIONS,
  EVIDENCE_OPTIONS,
  EVALUATION_PRIORITIES,
  siteFigureIsIdentifying,
  siteBandLabelFor,
} from "@/lib/notice-options";
import { scrubNoticeText, type ScrubFlag } from "@/lib/notice-scrub";

const DRAFT_KEY = "netify_notice_draft_v1";

type Draft = {
  title: string;
  buyer_org: string;
  buyer_visibility: "named" | "anonymous";
  buyer_sector: string;
  buyer_size_band: string;
  scope: string[];
  sites: string;
  users_band: string;
  remote_users_band: string;
  regions: string[];
  cloud_platforms: string[];
  summary: string;
  current_environment: string;
  desired_outcomes: string;
  budget_note: string;
  timeline_note: string;
  response_mode: ResponseMode;
  eligibility: "open" | "invited";
  visibility: "public" | "unlisted";
  response_deadline: string; // yyyy-mm-dd
  decision_target: string;
  go_live_target: string;
  compliance_requirements: string[];
  evidence_requested: string[];
  evaluation_priorities: string[];
  ai_summary: string;
  ai_assumptions: string[];
  ai_gap_flags: string[];
};

const EMPTY: Draft = {
  title: "", buyer_org: "", buyer_visibility: "named", buyer_sector: "", buyer_size_band: "",
  scope: [], sites: "", users_band: "", remote_users_band: "", regions: ["uk_ireland"], cloud_platforms: [],
  summary: "", current_environment: "", desired_outcomes: "", budget_note: "", timeline_note: "",
  response_mode: "indicative_pricing", eligibility: "open", visibility: "public",
  response_deadline: "", decision_target: "", go_live_target: "",
  compliance_requirements: [], evidence_requested: [], evaluation_priorities: [],
  ai_summary: "", ai_assumptions: [], ai_gap_flags: [],
};

const STEPS = ["Scope", "Basics", "Describe", "Responses", "Timeline", "Evidence", "Improve", "Preview"] as const;

type Improve = {
  title: string; summary: string; ai_summary: string; suggested_evidence: string[];
  assumptions: string[]; gaps: string[]; recommend_full_rfp: boolean; recommend_reason: string;
};

function toEpoch(d: string): number | null {
  if (!d) return null;
  const t = Date.parse(`${d}T17:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${active ? "bg-amber-500 border-amber-500 text-zinc-950 font-medium" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <p className="text-sm font-medium mb-1">{label}</p>
      {hint && <p className="text-xs text-[var(--ink-500)] mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls = "w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm";
const selectCls = "w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm bg-white";

export default function NoticeBuilder() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  // Stable timestamp for the preview object (react-hooks/purity: no Date.now in render).
  const [previewTs] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improve, setImprove] = useState<Improve | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState<string | null>(null);

  // Restore draft, then apply any prefill query params (quick-pricing links).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) });
    } catch { /* fresh draft */ }
    const p = new URLSearchParams(window.location.search);
    if (p.get("prefill") === "1") {
      const scope = (p.get("scope") ?? "").split(".").filter((s) => (OPP_SCOPES as readonly string[]).includes(s));
      const summary = p.get("summary") ?? "";
      setDraft((d) => ({
        ...d,
        scope: scope.length ? scope : d.scope,
        summary: summary || d.summary,
        title: d.title || (summary ? summary.slice(0, 80) : ""),
        response_mode: p.get("engagement") === "auction" ? "reverse_auction" : d.response_mode,
      }));
    }
    // Clone an existing public RFI page (or sample) as a starting template.
    // Only public projection fields are used; anything private never reaches
    // this endpoint. Buyer identity is intentionally NOT cloned.
    const cloneId = p.get("clone");
    if (cloneId && /^[A-Za-z0-9_-]+$/.test(cloneId)) {
      (async () => {
        try {
          const res = await fetch(`/sase/opportunities/${cloneId}/data.json`);
          if (!res.ok) return;
          const data = (await res.json()) as { opportunity?: Partial<PublicOpportunity> };
          const o = data.opportunity;
          if (!o) return;
          const toDate = (ms?: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");
          setDraft((d) => ({
            ...d,
            title: o.title ? `${o.title}` : d.title,
            scope: Array.isArray(o.scope) ? o.scope : d.scope,
            buyer_sector: o.buyer_sector ?? d.buyer_sector,
            buyer_size_band: o.buyer_size_band ?? d.buyer_size_band,
            sites: o.sites != null ? String(o.sites) : d.sites,
            users_band: o.users_band ?? d.users_band,
            remote_users_band: o.remote_users_band ?? d.remote_users_band,
            regions: Array.isArray(o.regions) && o.regions.length ? o.regions : d.regions,
            cloud_platforms: Array.isArray(o.cloud_platforms) ? o.cloud_platforms : d.cloud_platforms,
            summary: o.summary ?? d.summary,
            current_environment: o.current_environment ?? d.current_environment,
            desired_outcomes: o.desired_outcomes ?? d.desired_outcomes,
            compliance_requirements: Array.isArray(o.compliance_requirements) ? o.compliance_requirements : d.compliance_requirements,
            evidence_requested: Array.isArray(o.evidence_requested) ? o.evidence_requested : d.evidence_requested,
            evaluation_priorities: Array.isArray(o.evaluation_priorities) ? o.evaluation_priorities : d.evaluation_priorities,
            response_mode: (o.response_mode as ResponseMode) ?? d.response_mode,
            timeline_note: o.timeline_note ?? d.timeline_note,
            go_live_target: toDate(o.go_live_target) || d.go_live_target,
            // Deliberately not cloned: buyer_org, visibility choices, deadlines
            // (dates rarely transfer), AI summary/assumptions (regenerate).
          }));
          track("post_project_started", { conversionSource: "clone", sourceOpportunityId: cloneId });
        } catch { /* start blank */ }
      })();
      setLoaded(true);
      return; // clone path fires its own started event above
    }
    setLoaded(true);
    track("post_project_started");
  }, []);

  // Persist the draft on every change so the sign-in round trip loses nothing.
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
  }, [draft, loaded]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleIn = (k: keyof Draft, v: string) => {
    const list = draft[k] as string[];
    set(k, (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]) as never);
  };

  const preview: PublicOpportunity = useMemo(() => {
    const now = previewTs;
    // R4, the preview IS the public face (Robert's ruling): the preview
    // applies the same exact-unless-identifying rule as the server
    // projection, so the buyer sees byte-what the public sees. Exact
    // count when not identifying; the band when the combination holds.
    const rawSites = draft.sites ? Number(draft.sites) || null : null;
    const identifying = siteFigureIsIdentifying({ buyer_visibility: draft.buyer_visibility, buyer_sector: draft.buyer_sector, regions: draft.regions });
    return {
      id: "preview", created: now, updated: now, last_activity: now,
      buyer_org: draft.buyer_visibility === "anonymous" ? "" : draft.buyer_org,
      title: draft.title || "Untitled RFI",
      scope: draft.scope.filter((s): s is OppScope => (OPP_SCOPES as readonly string[]).includes(s)),
      sites: identifying ? null : rawSites,
      site_band: identifying ? siteBandLabelFor(rawSites) : null,
      regions: draft.regions,
      summary: draft.summary,
      budget_note: draft.budget_note,
      timeline_note: draft.timeline_note,
      status: "open",
      engagement_type: draft.response_mode === "reverse_auction" ? "auction" : "quote_room",
      auction_format: "open",
      deadline: null,
      eligibility: draft.eligibility,
      invited_count: 0, bid_count: 0, comment_count: 0,
      buyer_visibility: draft.buyer_visibility,
      buyer_sector: draft.buyer_sector,
      buyer_size_band: draft.buyer_size_band,
      users_band: draft.users_band,
      remote_users_band: draft.remote_users_band,
      cloud_platforms: draft.cloud_platforms,
      current_environment: draft.current_environment,
      desired_outcomes: draft.desired_outcomes,
      compliance_requirements: draft.compliance_requirements,
      evidence_requested: draft.evidence_requested,
      evaluation_priorities: draft.evaluation_priorities,
      response_mode: draft.response_mode,
      response_deadline: toEpoch(draft.response_deadline),
      decision_target: toEpoch(draft.decision_target),
      go_live_target: toEpoch(draft.go_live_target),
      ai_summary: draft.ai_summary,
      ai_assumptions: draft.ai_assumptions,
      ai_gap_flags: draft.ai_gap_flags,
      methodology_version: "sase-marketplace-2026.1",
    };
  }, [draft, previewTs]);

  const canContinue =
    step === 0 ? draft.scope.length > 0
      : step === 2 ? draft.summary.trim().length > 20
        : true;

  function next() {
    if (step === 0) track("project_scope_selected", { scopeCategories: draft.scope });
    if (step === 2) track("project_description_added");
    if (step === 3) { track("response_mode_selected", { responseMode: draft.response_mode }); track("visibility_mode_selected", { visibilityMode: draft.visibility, buyerVisibility: draft.buyer_visibility }); }
    if (step + 1 === 7) track("opportunity_preview_viewed");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  async function runImprove() {
    setImproving(true);
    setImproveError(null);
    track("ai_notice_improve_clicked");
    try {
      const res = await fetch("/sase/api/opportunity/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title, summary: draft.summary,
          current_environment: draft.current_environment, desired_outcomes: draft.desired_outcomes,
          scope: draft.scope, buyer_sector: draft.buyer_sector, buyer_size_band: draft.buyer_size_band,
          sites: draft.sites ? Number(draft.sites) || null : null, users_band: draft.users_band,
          regions: draft.regions, response_mode: draft.response_mode, timeline_note: draft.timeline_note,
          compliance_requirements: draft.compliance_requirements,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI improvement unavailable.");
      setImprove(data as Improve);
      track("notice_gap_check_completed", { gapCount: (data as Improve).gaps.length, aiUsed: true });
    } catch (e) {
      setImproveError(e instanceof Error ? e.message : "AI improvement unavailable.");
    } finally {
      setImproving(false);
    }
  }

  function applyImprove() {
    if (!improve) return;
    setDraft((d) => ({
      ...d,
      title: improve.title || d.title,
      summary: improve.summary || d.summary,
      ai_summary: improve.ai_summary,
      ai_assumptions: improve.assumptions,
      ai_gap_flags: improve.gaps,
      evidence_requested: Array.from(new Set([...d.evidence_requested, ...improve.suggested_evidence])),
    }));
    next();
  }

  async function publish() {
    setPublishError(null);
    setPublishing(true);
    track("publish_clicked");
    try {
      const res = await fetch("/sase/api/opportunity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title || draft.summary.slice(0, 80),
          buyer_org: draft.buyer_org,
          scope: draft.scope,
          sites: draft.sites ? Number(draft.sites) || null : null,
          regions: draft.regions,
          summary: draft.summary,
          budget_note: draft.budget_note,
          timeline_note: draft.timeline_note,
          engagement_type: draft.response_mode === "reverse_auction" ? "auction" : "quote_room",
          eligibility: draft.eligibility,
          visibility: draft.visibility,
          buyer_visibility: draft.buyer_visibility,
          buyer_sector: draft.buyer_sector,
          buyer_size_band: draft.buyer_size_band,
          users_band: draft.users_band,
          remote_users_band: draft.remote_users_band,
          cloud_platforms: draft.cloud_platforms,
          current_environment: draft.current_environment,
          desired_outcomes: draft.desired_outcomes,
          compliance_requirements: draft.compliance_requirements,
          evidence_requested: draft.evidence_requested,
          evaluation_priorities: draft.evaluation_priorities,
          response_mode: draft.response_mode,
          response_deadline: toEpoch(draft.response_deadline),
          decision_target: toEpoch(draft.decision_target),
          go_live_target: toEpoch(draft.go_live_target),
          ai_summary: draft.ai_summary,
          ai_assumptions: draft.ai_assumptions,
          ai_gap_flags: draft.ai_gap_flags,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setNeedsAuth(true);
        track("login_gate_viewed");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not publish.");
      const opp = data as { id: string; buyer_token: string };
      try { localStorage.setItem(`opp_btok_${opp.id}`, opp.buyer_token); localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      track("opportunity_published", { scopeCategories: draft.scope, responseMode: draft.response_mode });
      window.location.href = `/sase/opportunities/${opp.id}/?published=1`;
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setPublishing(false);
    }
  }

  async function requestMagicLink() {
    setMagicSent(null);
    try {
      const res = await fetch("/sase/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role: "buyer", attribution: firstTouch() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the sign-in link.");
      setMagicSent(data.message ?? "Check your email for the sign-in link, confirm it, then come back and publish. Your draft is saved.");
    } catch (e) {
      setMagicSent(e instanceof Error ? e.message : "Could not send the sign-in link.");
    }
  }

  if (!loaded) return null;

  return (
    <div>
      {/* Step indicator */}
      <ol className="mb-8 flex flex-wrap gap-1.5 text-xs">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`rounded-full px-3 py-1 border transition-colors ${i === step ? "bg-[var(--ink-900,#18181b)] text-white border-[var(--ink-900,#18181b)]" : i < step ? "border-emerald-500 text-emerald-700" : "border-[var(--ink-200,#e5e5e5)] text-[var(--ink-400,#9ca3af)]"}`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="max-w-2xl space-y-5">
          <Field label="What is this project about?" hint="Pick everything in scope. 'Not sure yet' is fine, and vendors and Netify can help refine it.">
            <div className="flex flex-wrap gap-2">
              {OPP_SCOPES.map((s) => (
                <ChipToggle key={s} active={draft.scope.includes(s)} onClick={() => toggleIn("scope", s)}>{OPP_SCOPE_LABELS[s]}</ChipToggle>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-2xl space-y-5">
          <Field label="Project title" hint="A clear one-liner, e.g. 'SD-WAN with managed underlay for 38 UK sites'.">
            <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={inputCls} maxLength={120} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organisation (optional)">
              <input value={draft.buyer_org} onChange={(e) => set("buyer_org", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Show organisation name publicly?">
              <select value={draft.buyer_visibility} onChange={(e) => set("buyer_visibility", e.target.value as Draft["buyer_visibility"])} className={selectCls}>
                <option value="named">Yes — show our name</option>
                <option value="anonymous">No — anonymous (sector and size only)</option>
              </select>
            </Field>
            <Field label="Sector">
              <select value={draft.buyer_sector} onChange={(e) => set("buyer_sector", e.target.value)} className={selectCls}>
                <option value="">Select…</option>
                {SECTORS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Organisation size">
              <select value={draft.buyer_size_band} onChange={(e) => set("buyer_size_band", e.target.value)} className={selectCls}>
                <option value="">Select…</option>
                {SIZE_BANDS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Number of sites">
              <input value={draft.sites} onChange={(e) => set("sites", e.target.value.replace(/[^0-9]/g, ""))} className={inputCls} inputMode="numeric" />
            </Field>
            <Field label="Users">
              <select value={draft.users_band} onChange={(e) => set("users_band", e.target.value)} className={selectCls}>
                <option value="">Select…</option>
                {USERS_BANDS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Remote / hybrid users">
              <select value={draft.remote_users_band} onChange={(e) => set("remote_users_band", e.target.value)} className={selectCls}>
                <option value="">Select…</option>
                {USERS_BANDS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Regions">
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <ChipToggle key={r.key} active={draft.regions.includes(r.key)} onClick={() => toggleIn("regions", r.key)}>{r.label}</ChipToggle>
              ))}
            </div>
          </Field>
          <Field label="Cloud platforms in use">
            <div className="flex flex-wrap gap-2">
              {CLOUD_PLATFORMS.map((c) => (
                <ChipToggle key={c.key} active={draft.cloud_platforms.includes(c.key)} onClick={() => toggleIn("cloud_platforms", c.key)}>{c.label}</ChipToggle>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-2xl space-y-5">
          <Field label="Describe what you need in plain English" hint="You do not need to write a full RFP. E.g. 'We have 38 UK sites and need SD-WAN with managed underlay and firewall.'">
            <textarea value={draft.summary} onChange={(e) => set("summary", e.target.value)} rows={5} className={inputCls} />
          </Field>
          <Field label="Current environment (optional)" hint="What you run today: WAN, firewalls, contracts ending, known pain.">
            <textarea value={draft.current_environment} onChange={(e) => set("current_environment", e.target.value)} rows={3} className={inputCls} />
          </Field>
          <Field label="Desired outcome (optional)" hint="What good looks like in twelve months.">
            <textarea value={draft.desired_outcomes} onChange={(e) => set("desired_outcomes", e.target.value)} rows={3} className={inputCls} />
          </Field>
          <Field label="Budget note (optional)" hint="A public range or context, e.g. 'replacing £18k/month MPLS spend'. Never share anything you want kept private.">
            <input value={draft.budget_note} onChange={(e) => set("budget_note", e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-2xl space-y-5">
          <Field label="What do you want from vendors and service providers?">
            <div className="grid gap-2 sm:grid-cols-2">
              {RESPONSE_MODES.filter((m) => m !== "quote_room").map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set("response_mode", m)}
                  className={`text-left p-3 rounded-sm border transition-colors ${draft.response_mode === m ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}
                >
                  <span className="block text-sm font-medium">{RESPONSE_MODE_LABELS[m]}</span>
                  <span className="block text-xs text-[var(--ink-600)]">
                    {m === "indicative_pricing" && "Fast budget signals. Vendors reply with indicative pricing, private to you."}
                    {m === "discovery_calls" && "Short calls with matching vendors to explore the requirement."}
                    {m === "written_responses" && "Structured written replies against your RFI."}
                    {m === "reverse_auction" && "Vendors compete on price; bids are ranked."}
                    {m === "shortlist" && "Netify builds you a graded shortlist from the marketplace."}
                    {m === "full_rfp" && "You plan to issue a full RFP; vendors register interest now."}
                  </span>
                </button>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Who can respond?">
              <select value={draft.eligibility} onChange={(e) => set("eligibility", e.target.value as Draft["eligibility"])} className={selectCls}>
                <option value="open">Any matching verified vendor</option>
                <option value="invited">Invite-only: I pick the vendors</option>
              </select>
            </Field>
            <Field label="Board visibility">
              <select value={draft.visibility} onChange={(e) => set("visibility", e.target.value as Draft["visibility"])} className={selectCls}>
                <option value="public">List on the public board</option>
                <option value="unlisted">Unlisted — link only</option>
              </select>
            </Field>
          </div>
          <p className="text-xs text-[var(--ink-500)]">Whatever you choose, vendor pricing stays private to you and your contact details are never shown publicly.</p>
        </div>
      )}

      {step === 4 && (
        <div className="max-w-2xl space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Response deadline">
              <input type="date" value={draft.response_deadline} onChange={(e) => set("response_deadline", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Decision target">
              <input type="date" value={draft.decision_target} onChange={(e) => set("decision_target", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Target go-live">
              <input type="date" value={draft.go_live_target} onChange={(e) => set("go_live_target", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Timeline note (optional)" hint="Context vendors should know, e.g. 'MPLS contract expires in nine months'.">
            <input value={draft.timeline_note} onChange={(e) => set("timeline_note", e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}

      {step === 5 && (
        <div className="max-w-2xl space-y-5">
          <Field label="Compliance requirements (optional)">
            <div className="flex flex-wrap gap-2">
              {COMPLIANCE_OPTIONS.map((c) => (
                <ChipToggle key={c.key} active={draft.compliance_requirements.includes(c.key)} onClick={() => toggleIn("compliance_requirements", c.key)}>{c.label}</ChipToggle>
              ))}
            </div>
          </Field>
          <Field label="Evidence vendors should provide" hint="Asking for evidence up front makes replies comparable.">
            <div className="flex flex-wrap gap-2">
              {EVIDENCE_OPTIONS.map((c) => (
                <ChipToggle key={c.key} active={draft.evidence_requested.includes(c.key)} onClick={() => toggleIn("evidence_requested", c.key)}>{c.label}</ChipToggle>
              ))}
            </div>
          </Field>
          <Field label="What matters most in evaluation?">
            <div className="flex flex-wrap gap-2">
              {EVALUATION_PRIORITIES.map((c) => (
                <ChipToggle key={c.key} active={draft.evaluation_priorities.includes(c.key)} onClick={() => toggleIn("evaluation_priorities", c.key)}>{c.label}</ChipToggle>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === 6 && (
        <div className="max-w-2xl space-y-5">
          <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
            <p className="text-sm font-medium mb-1">Improve this brief before publishing</p>
            <p className="text-sm text-[var(--ink-600)] mb-4">
              The AI tidies your RFI, writes a vendor-facing summary, flags missing information and suggests evidence to request.
              It never invents facts: anything inferred is listed as an assumption you can review.
            </p>
            {!improve && (
              <button type="button" onClick={runImprove} disabled={improving} className="px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
                {improving ? "Improving…" : "Improve this brief"}
              </button>
            )}
            {improveError && <p className="mt-3 text-sm text-[var(--ink-600)]">{improveError} <button type="button" className="underline" onClick={next}>Skip to preview</button></p>}
            {improve && (
              <div className="space-y-4">
                <div>
                  <p className="eyebrow mb-1">Suggested title</p>
                  <p className="text-sm">{improve.title}</p>
                </div>
                <div>
                  <p className="eyebrow mb-1">Suggested public summary</p>
                  <p className="text-sm whitespace-pre-line">{improve.summary}</p>
                </div>
                <div>
                  <p className="eyebrow mb-1">AI-readable summary (shown on the RFI)</p>
                  <p className="text-sm">{improve.ai_summary}</p>
                </div>
                {improve.gaps.length > 0 && (
                  <div>
                    <p className="eyebrow mb-1">Vendors will probably ask about</p>
                    <ul className="list-disc pl-5 text-sm space-y-0.5">{improve.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                  </div>
                )}
                {improve.assumptions.length > 0 && (
                  <div>
                    <p className="eyebrow mb-1">Assumptions made</p>
                    <ul className="list-disc pl-5 text-sm space-y-0.5">{improve.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
                {improve.recommend_full_rfp && (
                  <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <strong>Consider a full RFP.</strong> {improve.recommend_reason}{" "}
                    {/* Fix, 10 Aug 2026: this linked to the bare production
                        domain with no data -- "paste this RFI straight in"
                        was a promise the link itself didn't keep, and an
                        absolute https://netify.co.uk/ URL also yanked a
                        buyer on a preview deployment off the preview
                        entirely. Relative, matching the site logo's own
                        home link (MegaNav.tsx), plus "q" -- the desk
                        already reads it on load and runs it through the
                        same intake as if typed there (ProjectDesk.tsx
                        :846,858-862) -- so the RFI text now actually
                        carries across instead of requiring a manual paste. */}
                    <a href={`/?q=${encodeURIComponent(draft.summary || draft.title)}`} className="underline">Continue on the desk</a>, where priorities and a commercial position raise it to a full RFP.
                  </p>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={applyImprove} className="px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors">Apply and preview</button>
                  <button type="button" onClick={next} className="px-5 py-2.5 border border-[var(--ink-300,#ccc)] rounded-full text-sm hover:border-[var(--ink-900)] transition-colors">Keep my wording</button>
                </div>
              </div>
            )}
          </div>
          {!improve && (
            <button type="button" onClick={next} className="text-sm underline text-[var(--ink-600)]">Skip AI improvement and preview the RFI</button>
          )}
        </div>
      )}

      {step === 7 && (
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* R3, the combination sentence (Robert's ruling): when sector,
                a single region and anonymity band the site count, say so
                plainly before the preview, with the buyer left to decide.
                WORDING PROVISIONAL pending Harry. */}
            {preview.site_band && (
              <p className="mb-3 rounded-sm border border-[var(--ink-300,#ccc)] bg-[var(--ink-50,#fafafa)] px-4 py-2.5 text-sm text-[var(--ink-700)]">
                Together, your sector, single region and exact site count could identify you, so the public notice shows{" "}
                <strong>{preview.site_band}</strong> instead of the exact figure. Participating vendors see the exact
                count after the gate. Widen the regions or remove the sector and the exact figure shows instead.
              </p>
            )}
            {/* R2, the free-text scrub (Robert's ruling): flags warn, the
                buyer decides, nothing is rewritten. Runs over the fields
                that render publicly, on the preview where the decision is
                made. WORDING PROVISIONAL pending Harry. */}
            {(() => {
              const flags: ScrubFlag[] = scrubNoticeText({
                "project title": draft.title,
                "project overview": draft.summary,
                "current environment": draft.current_environment,
                "desired outcome": draft.desired_outcomes,
                "budget note": draft.budget_note,
                "timeline note": draft.timeline_note,
              });
              if (flags.length === 0) return null;
              return (
                <div className="mb-3 rounded-sm border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                  <p className="m-0 mb-1 font-semibold">Worth checking before you publish: your own words may identify you.</p>
                  <ul className="m-0 list-none space-y-1 p-0">
                    {flags.slice(0, 6).map((f) => (
                      <li key={`${f.field}-${f.kind}-${f.match}`} className="text-[13px] leading-relaxed">
                        In your {f.field}: {f.why}
                      </li>
                    ))}
                  </ul>
                  <p className="m-0 mt-1.5 text-[12.5px]">Nothing is changed for you. Edit the wording in the earlier steps if you want it out, or publish as written.</p>
                </div>
              );
            })()}
            <NoticeView notice={preview} isPreview />
          </div>
          <div>
            <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 sticky top-6">
              {!needsAuth ? (
                <>
                  <p className="text-sm font-medium mb-1">Ready to publish?</p>
                  <p className="text-sm text-[var(--ink-600)] mb-4">
                    Publishing creates a public RFI page, lists it on the opportunity board and opens your private response room.
                    Vendor pricing stays private to you.
                  </p>
                  <button type="button" onClick={publish} disabled={publishing} className="w-full px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
                    {publishing ? "Publishing…" : "Publish opportunity"}
                  </button>
                  {publishError && <p className="mt-3 text-sm text-red-700">{publishError}</p>}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium mb-1">Sign in to publish</p>
                  <p className="text-sm text-[var(--ink-600)] mb-4">
                    Create an account to publish this opportunity, manage vendor responses and keep pricing private. Your draft is saved and will be carried through.
                  </p>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Work email" className={`${inputCls} mb-2`} />
                  <button type="button" onClick={requestMagicLink} disabled={!email.includes("@")} className="w-full px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
                    Send sign-in link
                  </button>
                  {magicSent && <p className="mt-3 text-sm text-[var(--ink-600)]">{magicSent}</p>}
                  <button type="button" onClick={publish} className="mt-3 w-full px-5 py-2.5 border border-[var(--ink-300,#ccc)] rounded-full text-sm hover:border-[var(--ink-900)] transition-colors">
                    I have signed in — publish now
                  </button>
                </>
              )}
              <p className="mt-4 text-xs text-[var(--ink-500)]">
                {/* Fix, 10 Aug 2026: same root cause and same fix as the
                    step-6 callout above -- see that comment. */}
                Need a formal process instead?{" "}
                <a href={`/?q=${encodeURIComponent(draft.summary || draft.title)}`} className="underline">Turn this into a full RFP</a>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav buttons (hidden on preview step, which has its own publish panel) */}
      {step < 7 && step !== 6 && (
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="px-5 py-2.5 border border-[var(--ink-300,#ccc)] rounded-full text-sm hover:border-[var(--ink-900)] transition-colors">Back</button>
          )}
          <button type="button" onClick={next} disabled={!canContinue} className="px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
            {step === 5 ? "Continue to AI check" : "Continue"}
          </button>
          {step === 2 && !canContinue && <p className="self-center text-xs text-[var(--ink-500)]">A couple of sentences is enough to continue.</p>}
        </div>
      )}
      {step === 6 && (
        <div className="mt-8">
          <button type="button" onClick={() => setStep(5)} className="px-5 py-2.5 border border-[var(--ink-300,#ccc)] rounded-full text-sm hover:border-[var(--ink-900)] transition-colors">Back</button>
        </div>
      )}
      {step === 7 && (
        <div className="mt-8">
          <button type="button" onClick={() => setStep(6)} className="px-5 py-2.5 border border-[var(--ink-300,#ccc)] rounded-full text-sm hover:border-[var(--ink-900)] transition-colors">Back to edit</button>
        </div>
      )}
    </div>
  );
}
