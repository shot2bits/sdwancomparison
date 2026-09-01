"use client";

/**
 * Shortlist builder client island.
 * All verdict logic lives in src/lib/shortlist-core.ts (shared with the
 * MCP tool and the Claude agent). This component only collects input,
 * calls buildShortlist, and renders the result.
 *
 * URL state: reads the URL via useSearchParams() -- reactive to Next.js
 * client-side navigation, not just first mount (fixed 2026-08-10; see the
 * read-effect below) -- and pushes local edits back via history.replaceState
 * (debounced) so every scenario is shareable.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import CompareTable from "@/components/CompareTable";
import { fireNetifyEvent } from "@/components/NetifyEvents";
import Continuation from "@/components/Continuation";
import { deriveContinuationTool } from "@/lib/continuation/derive";
import { COMPARE_PAIRS } from "@/lib/compare-pages";
import {
  AI_KEYS,
  AI_LABELS,
  buildComparison,
  INTENT_KEYS,
  INTENT_LABELS,
  INTENT_PRESETS,
  ORG_SIZE_KEYS,
  ORG_SIZE_LABELS,
  SECTOR_KEYS,
  SECTOR_LABELS,
  CLOUD_KEYS,
  CLOUD_LABELS,
  DEFAULT_INPUT,
  REGION_KEYS,
  REGION_LABELS,
  buildShortlist,
  decodeScenario,
  encodeScenario,
  type ComparisonResult,
  type ShortlistInput,
  type ShortlistVendor,
  type VendorVerdict,
} from "@/lib/shortlist-core";
import { shortlistEntrance } from "@/lib/project-entrance";
import {
  applyComparisonHandoff,
  COMPARISON_HANDOFF_VERSION,
  parseComparisonHandoff,
} from "@/lib/comparison-handoff";

type FeatureMeta = { id: string; name: string; category: string; description?: string };

type Props = {
  vendors: ShortlistVendor[];
  features: FeatureMeta[];
};

const MODEL_LABELS: Record<string, string> = {
  any: "Any model",
  managed: "Fully managed",
  co_managed: "Co-managed",
  diy: "DIY / self-managed",
};

const PRESET_LABELS: Record<string, string> = {
  balanced: "Balanced",
  security_led: "Security led",
  network_led: "Network led",
  cloud_first: "Cloud first",
  managed_service_led: "Managed service led",
};

const SPEED_LABELS: Record<string, string> = {
  any: "No ceiling",
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
};

export default function ShortlistBuilder({ vendors, features }: Props) {
  const [input, setInput] = useState<ShortlistInput>(DEFAULT_INPUT);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Agent chat state (multi-turn)
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatComparison, setChatComparison] = useState<ComparisonResult | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  // Manual compare selection
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);
  const [comparisonSource, setComparisonSource] = useState("");
  const [providerCardReset, setProviderCardReset] = useState(0);

  // Lead form state
  const [lead, setLead] = useState({ name: "", email: "", company: "", company_url: "" });
  const [leadState, setLeadState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [handoffState, setHandoffState] = useState<"idle" | "busy" | "error">("idle");

  const featureNames = useMemo(
    () => Object.fromEntries(features.map((f) => [f.id, f.name])),
    [features],
  );
  const featureIds = useMemo(() => features.map((f) => f.id), [features]);
  const categories = useMemo(
    () => Array.from(new Set(features.map((f) => f.category))),
    [features],
  );

  // Read URL state on mount, and again whenever it changes via Next.js
  // client-side navigation while this component stays mounted -- e.g. the
  // "Refine this shortlist interactively" link on a best/[slug] page
  // navigating to /shortlist?<scenario> when the shortlist route was
  // already visited earlier in the same tab. A window.location.search
  // read in a mount-only effect only ever saw the first URL this instance
  // was mounted with, since Next doesn't remount the page component on a
  // same-route, query-only navigation; useSearchParams() is reactive to
  // exactly that case. (Root-caused 2026-08-10 against Harry Yelland's
  // testing: that handoff appeared to open an empty builder.)
  const searchParams = useSearchParams();
  useEffect(() => {
    // URL state is the external source of truth for shareable scenarios and
    // cross-project comparison handoffs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(decodeScenario(searchParams.toString(), featureIds));
    const handoff = parseComparisonHandoff(searchParams.toString(), vendors.map((vendor) => vendor.slug));
    setCompareSlugs(handoff.providers);
    setComparisonSource(handoff.source);
    if (handoff.question) setChatPrompt(handoff.question);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Push state changes back into the URL (debounced)
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const qs = applyComparisonHandoff(new URLSearchParams(encodeScenario(input)), {
        providers: compareSlugs,
        question: chatPrompt,
        source: comparisonSource,
      }).toString();
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    }, 250);
  }, [input, hydrated, compareSlugs, chatPrompt, comparisonSource]);

  /** True until the user changes anything from the defaults. */
  const isDefaultView = useMemo(() => encodeScenario(input) === "", [input]);

  const result = useMemo(
    () =>
      buildShortlist(
        vendors,
        isDefaultView ? { ...input, shortlist_size: vendors.length } : input,
        featureNames,
      ),
    [vendors, input, featureNames, isDefaultView],
  );

  function set<K extends keyof ShortlistInput>(key: K, value: ShortlistInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function toggleIn(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  function resetAllOptions() {
    setInput(DEFAULT_INPUT);
    setCompareSlugs([]);
    setComparisonSource("");
    setChatPrompt("");
    setChatMessages([]);
    setChatComparison(null);
    setChatError(null);
    setOpenCategory(null);
    setHandoffState("idle");
    setProviderCardReset((value) => value + 1);
    window.history.replaceState(null, "", window.location.pathname);
  }

  /** Tri-state feature toggle: off, required, preferred. */
  function cycleFeature(fid: string) {
    setInput((prev) => {
      const isReq = prev.required_features.includes(fid);
      const isPref = prev.preferred_features.includes(fid);
      if (!isReq && !isPref) {
        return { ...prev, required_features: [...prev.required_features, fid] };
      }
      if (isReq) {
        return {
          ...prev,
          required_features: prev.required_features.filter((x) => x !== fid),
          preferred_features: [...prev.preferred_features, fid],
        };
      }
      return { ...prev, preferred_features: prev.preferred_features.filter((x) => x !== fid) };
    });
  }

  async function copyLink() {
    const qs = encodeScenario(input);
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function printUrl(): string {
    const qs = encodeScenario(input);
    return `/sase/shortlist/print${qs ? `?${qs}` : ""}`;
  }

  /** The ranked state is persisted losslessly before navigation. */
  async function continueCanonicalProject() {
    if (handoffState === "busy") return;
    setHandoffState("busy");
    const words = chatMessages.filter((message) => message.role === "user").map((message) => message.content.trim()).filter(Boolean).join("; ").slice(0, 4000);
    const rankedVendorSlugs = result.shortlist.slice(0, 5).map((vendor) => vendor.slug);
    try {
      const entrance = shortlistEntrance({ shortlist: input, rankedVendorSlugs, requirementText: words, sourceUrl: window.location.href });
      const response = await fetch("/sase/api/rfp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: input.sector ? `${SECTOR_LABELS[input.sector]} SASE / SD-WAN project` : "SASE / SD-WAN shortlist project", buyer: entrance.buyer_input, entrance_context: entrance, journey_mode: "find_providers" }),
      });
      const data = await response.json();
      if (!response.ok || !data.id || !data.manage_token) throw new Error(data.error || "Could not continue the project.");
      window.location.assign(`/sase-sd-wan-rfp-builder/?id=${encodeURIComponent(data.id)}&manage=${encodeURIComponent(data.manage_token)}`);
    } catch {
      setHandoffState("error");
    }
  }

  async function askAgent(promptOverride?: string) {
    const prompt = (promptOverride ?? chatPrompt).trim();
    if (!prompt || chatBusy) return;
    const nextMessages = [...chatMessages, { role: "user" as const, content: prompt }];
    setChatMessages(nextMessages);
    setChatPrompt("");
    setChatBusy(true);
    setChatError(null);
    try {
      const res = await fetch("/sase/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, current_input: input, comparison_slugs: compareSlugs }),
      });
      if (!res.ok) throw new Error(`Agent returned ${res.status}`);
      const data = (await res.json()) as {
        input?: ShortlistInput;
        narrative?: string;
        comparison?: ComparisonResult;
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      if (data.input) setInput(data.input);
      if (data.comparison) {
        setChatComparison(data.comparison);
        setCompareSlugs(data.comparison.slugs);
      }
      if (data.narrative) {
        setChatMessages([...nextMessages, { role: "assistant", content: data.narrative }]);
      }
    } catch (err) {
      setChatError(
        err instanceof Error && err.message.includes("503")
          ? "The AI advisor is not configured yet. Use the manual filters below."
          : "The AI advisor could not process that request. Use the manual filters below, or try rephrasing.",
      );
    } finally {
      setChatBusy(false);
    }
  }

  function toggleCompare(slug: string) {
    setCompareSlugs((prev) =>
      prev.includes(slug)
        ? prev.filter((x) => x !== slug)
        : prev.length >= 3
          ? prev
          : [...prev, slug],
    );
  }

  const manualComparison = useMemo(
    () => (compareSlugs.length >= 2 ? buildComparison(vendors, compareSlugs, features) : null),
    [vendors, compareSlugs, features],
  );
  const activeComparison = manualComparison ?? chatComparison;
  const curatedPairUrl = useMemo(() => {
    if (!activeComparison || activeComparison.slugs.length !== 2) return null;
    const [x, y] = activeComparison.slugs;
    const hit = COMPARE_PAIRS.find(
      (p) => (p.a === x && p.b === y) || (p.a === y && p.b === x),
    );
    return hit ? `/sase/compare/${hit.slug}` : null;
  }, [activeComparison]);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (leadState === "busy") return;
    setLeadState("busy");
    // 11 Aug 2026: this form previously had no dedicated tracking at all —
    // NetifyEvents.tsx's delegated form_start/form_submit listeners fire for
    // every form on the site, so they couldn't tell this submission apart
    // from a sign-in or RFP-builder form, and neither distinguishes a submit
    // attempt from a confirmed send. These three events are specific to this
    // exact flow and split attempt from outcome, so "no leads" questions
    // have a real answer going forward instead of relying on the Resend log.
    fireNetifyEvent("shortlist_lead_submit");
    try {
      const qs = encodeScenario(input);
      const res = await fetch("/sase/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...lead,
          // Must include the /sase basePath — origin alone points at the main
          // site and 404s (same class of bug as Harry's supplier link).
          shortlist_url: `${window.location.origin}/sase/shortlist${qs ? `?${qs}` : ""}`,
          criteria_summary: result.criteria_summary,
          top_vendors: result.shortlist.slice(0, 10).map((v) => ({
            rank: v.rank,
            name: v.name,
            score: v.score,
            marketplace_url: v.marketplace_url,
          })),
        }),
      });
      if (!res.ok) throw new Error("lead failed");
      setLeadState("sent");
      fireNetifyEvent("shortlist_lead_sent");
    } catch {
      setLeadState("error");
      fireNetifyEvent("shortlist_lead_error");
    }
  }

  const featureState = (fid: string): "off" | "required" | "preferred" =>
    input.required_features.includes(fid)
      ? "required"
      : input.preferred_features.includes(fid)
        ? "preferred"
        : "off";

  return (
    <section id="provider-decision-workspace" className="rounded-xl border border-[var(--ink-200,#e8ebef)] p-4 sm:p-6">
      <p className="eyebrow mb-2">Netify comparison workspace</p>
      <h2 className="mb-6">Compare providers and build around your requirements</h2>
      <ComparisonWorkspace
        vendors={vendors}
        comparison={activeComparison}
        compareSlugs={compareSlugs}
        setCompareSlugs={setCompareSlugs}
        question={chatPrompt}
        setQuestion={setChatPrompt}
        ask={() => void askAgent()}
        busy={chatBusy}
        messages={chatMessages}
        error={chatError}
        source={comparisonSource}
      />
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* ---------------- Filters column ---------------- */}
      <div className="min-w-0 lg:col-span-4 space-y-8">
        {/* AI advisor */}
        <section className="border border-[var(--ink-900)] rounded-sm p-5 bg-[var(--paper-base)]">
          <p className="eyebrow mb-2">AI advisor</p>
          <h2 className="text-lg mb-3">Build around your requirements</h2>
          <p className="text-sm text-[var(--ink-700)] mb-3">
            Tell the advisor about your sites, regions, security needs and how you
            want the service run. It sets the filters below for you.
          </p>
          <textarea
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            rows={4}
            placeholder="Example: 60 sites across the UK and Germany, fully managed, ZTNA and SWG required. Or: compare Cato Networks and Zscaler."
            className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-3 text-sm bg-white"
          />
          <button
            onClick={() => void askAgent()}
            disabled={chatBusy || !chatPrompt.trim()}
            className="mt-3 w-full px-4 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full text-sm disabled:opacity-50 hover:bg-amber-400 transition-colors"
          >
            {chatBusy ? "Thinking..." : chatMessages.length > 0 ? "Ask a follow-up" : "Build my shortlist with AI"}
          </button>
          {chatMessages.length > 0 && (
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "text-[var(--ink-500)]"
                      : "text-[var(--ink-700)] border-l-2 border-[var(--accent)] pl-3"
                  }`}
                >
                  {m.role === "user" ? `You: ${m.content}` : m.content}
                </div>
              ))}
            </div>
          )}
          {chatError && <p className="mt-3 text-sm text-red-700">{chatError}</p>}
          {chatMessages.some((m) => m.role === "assistant") && (
            <button type="button"
              onClick={() => void continueCanonicalProject()}
              disabled={handoffState === "busy"}
              className="mt-3 block w-full text-center px-4 py-2.5 border border-[var(--ink-900)] rounded-full text-sm font-medium no-underline hover:bg-zinc-900 hover:text-white transition-colors"
            >
              Continue in the workspace with what you just described
            </button>
          )}
        </section>

        <details open className="rounded-lg border border-[var(--ink-200,#e8ebef)] p-4">
          <summary className="cursor-pointer font-medium">Refine requirements</summary>
          <div className="mt-5 space-y-8">
        {/* Sector */}
        <section>
          <p className="eyebrow mb-3">Your sector</p>
          <div className="flex flex-wrap gap-2">
            {SECTOR_KEYS.map((sec) => (
              <button
                key={sec}
                onClick={() => set("sector", input.sector === sec ? null : sec)}
                className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                  input.sector === sec
                    ? "bg-amber-500 text-zinc-950 border-amber-500 font-medium"
                    : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"
                }`}
              >
                {SECTOR_LABELS[sec]}
              </button>
            ))}
          </div>
        </section>

        {/* Organisation size and priority */}
        <section className="grid grid-cols-1 gap-4">
          <div>
            <p className="eyebrow mb-3">Organisation size</p>
            <div className="flex flex-wrap gap-2">
              {(["any", ...ORG_SIZE_KEYS] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => set("organisation_size", o)}
                  className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                    input.organisation_size === o
                      ? "bg-amber-500 text-zinc-950 border-amber-500 font-medium"
                      : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"
                  }`}
                >
                  {o === "any" ? "Any size" : ORG_SIZE_LABELS[o]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">Main priority</p>
            <select
              value={input.intent}
              onChange={(e) => set("intent", e.target.value as ShortlistInput["intent"])}
              className="select-field"
            >
              <option value="none">No specific priority</option>
              {INTENT_KEYS.map((i) => (
                <option key={i} value={i}>{INTENT_LABELS[i]}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Operating model */}
        <section>
          <p className="eyebrow mb-3">Operating model</p>
          <div className="flex flex-wrap gap-2">
            {(["any", "managed", "co_managed", "diy"] as const).map((m) => (
              <button
                key={m}
                onClick={() => set("service_model", m)}
                className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                  input.service_model === m
                    ? "bg-amber-500 text-zinc-950 border-amber-500 font-medium"
                    : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"
                }`}
              >
                {MODEL_LABELS[m]}
              </button>
            ))}
          </div>
        </section>

        {/* Regions */}
        <section>
          <p className="eyebrow mb-3">Regions you must cover</p>
          <div className="flex flex-wrap gap-2">
            {REGION_KEYS.map((r) => (
              <button
                key={r}
                onClick={() => set("required_regions", toggleIn(input.required_regions, r) as ShortlistInput["required_regions"])}
                className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                  input.required_regions.includes(r)
                    ? "bg-amber-500 text-zinc-950 border-amber-500 font-medium"
                    : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"
                }`}
              >
                {REGION_LABELS[r]}
              </button>
            ))}
          </div>
        </section>

        {/* UK providers only */}
        <section>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={input.uk_provider_only}
              onChange={(e) => set("uk_provider_only", e.target.checked)}
            />
            UK-based providers only
          </label>
          <p className="mt-1 text-xs text-[var(--ink-500)]">
            Off by default. The shortlist already includes global vendors such as
            Cato and Fortinet because they deliver in the UK through UK PoPs and
            partners; each result explains its UK basis. Switch this on only if you
            need a UK-registered contract holder (UK HQ or UK entity) for
            sovereignty or procurement reasons, which narrows the list to providers
            like BT, Vodafone, Colt, NTT UK, Orange UK and Telefónica Tech UK&amp;I.
          </p>
        </section>

        {/* Clouds */}
        <section>
          <p className="eyebrow mb-3">Cloud platforms</p>
          <div className="flex flex-wrap gap-2">
            {CLOUD_KEYS.map((c) => (
              <button
                key={c}
                onClick={() => set("required_clouds", toggleIn(input.required_clouds, c) as ShortlistInput["required_clouds"])}
                className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                  input.required_clouds.includes(c)
                    ? "bg-amber-500 text-zinc-950 border-amber-500 font-medium"
                    : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"
                }`}
              >
                {CLOUD_LABELS[c]}
              </button>
            ))}
          </div>
        </section>

        {/* AI, DR, speed, preset, size */}
        <section>
          <p className="eyebrow mb-3">AI capability</p>
          <div className="flex flex-wrap gap-2">
            {AI_KEYS.map((a) => (
              <button
                key={a}
                onClick={() => set("ai_requirements", toggleIn(input.ai_requirements, a) as ShortlistInput["ai_requirements"])}
                className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                  input.ai_requirements.includes(a)
                    ? "bg-amber-500 text-zinc-950 border-amber-500 font-medium"
                    : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"
                }`}
              >
                {AI_LABELS[a]}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div>
            <p className="eyebrow mb-3">Deployment ceiling</p>
            <select
              value={input.max_deployment_speed}
              onChange={(e) => set("max_deployment_speed", e.target.value as ShortlistInput["max_deployment_speed"])}
              className="select-field"
            >
              {(["any", "hours", "days", "weeks", "months"] as const).map((s) => (
                <option key={s} value={s}>{SPEED_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="eyebrow mb-3">Scoring profile</p>
            <select
              value={input.weight_preset}
              onChange={(e) => set("weight_preset", e.target.value as ShortlistInput["weight_preset"])}
              className="select-field"
            >
              {Object.entries(PRESET_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            {input.intent !== "none" && INTENT_PRESETS[input.intent]?.weight_preset && input.weight_preset === "balanced" && (
              <p className="mt-1.5 text-xs text-[var(--ink-500)]">
                Following your priority ({INTENT_LABELS[input.intent]}), this is weighted{" "}
                {PRESET_LABELS[INTENT_PRESETS[input.intent].weight_preset!].toLowerCase()}. Pick a profile to override.
              </p>
            )}
          </div>
        </section>

        <section className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={input.disaster_recovery_required}
              onChange={(e) => set("disaster_recovery_required", e.target.checked)}
            />
            Disaster recovery evidence required
          </label>
          <label className="flex items-center gap-2 text-sm">
            Size
            <select
              value={input.shortlist_size}
              onChange={(e) => set("shortlist_size", Number(e.target.value))}
              className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm bg-white"
            >
              {[3, 5, 8, 10, 12, 15].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </section>

        {/* Feature matrix picker */}
        <section>
          <p className="eyebrow mb-2">Capability requirements</p>
          <p className="text-xs text-[var(--ink-500)] mb-3">
            Click once for required (hard filter), twice for preferred (extra
            scoring weight), three times to clear.
          </p>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat} className="border border-[var(--ink-300,#ccc)] rounded-sm">
                <button
                  onClick={() => setOpenCategory(openCategory === cat ? null : cat)}
                  className="w-full text-left px-3 py-2 text-sm font-medium flex justify-between items-center"
                >
                  {cat}
                  <span aria-hidden="true">{openCategory === cat ? "−" : "+"}</span>
                </button>
                {openCategory === cat && (
                  <div className="px-3 pb-3 flex flex-wrap gap-2">
                    {features
                      .filter((f) => f.category === cat)
                      .map((f) => {
                        const st = featureState(f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => cycleFeature(f.id)}
                            title={`${f.description ? `${f.description} ` : ""}${
                              st === "off"
                                ? "Click: require this"
                                : st === "required"
                                  ? "Required. Click: prefer instead"
                                  : "Preferred. Click: clear"
                            }`}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              st === "required"
                                ? "bg-amber-500 text-zinc-950 border-amber-500 font-medium"
                                : st === "preferred"
                                  ? "bg-amber-100 text-amber-900 border-amber-400"
                                  : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"
                            }`}
                          >
                            {f.name}
                            {st === "required" && " ✓"}
                            {st === "preferred" && " +"}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={resetAllOptions}
          className="w-full rounded-full border border-[var(--ink-900)] px-4 py-2 text-sm font-medium hover:bg-zinc-900 hover:text-white transition-colors"
        >
          Reset all options
        </button>
          </div>
        </details>
      </div>

      {/* ---------------- Results column ---------------- */}
      <div className="min-w-0 lg:col-span-8">
        {activeComparison && (
          <section id="comparison-table" className="mb-10 scroll-mt-24 border border-[var(--ink-900)] rounded-sm p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <h2 className="text-xl">
                Comparing: {activeComparison.slugs.map((sl) => activeComparison.names[sl]).join(" vs ")}
              </h2>
              <div className="flex gap-2">
                {curatedPairUrl && (
                  <a
                    href={curatedPairUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full no-underline hover:bg-zinc-900 hover:text-white transition-colors"
                  >
                    Permanent comparison page ↗
                  </a>
                )}
                <button
                  onClick={() => {
                    setCompareSlugs([]);
                    setChatComparison(null);
                  }}
                  className="px-3.5 py-1.5 text-sm border border-[var(--ink-300,#ccc)] rounded-full hover:border-[var(--ink-900)]"
                >
                  Close
                </button>
              </div>
            </div>
            <p className="text-sm text-[var(--ink-700)] mb-4">{activeComparison.summary}</p>
            <CompareTable comparison={activeComparison} />
          </section>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-xl">
            {isDefaultView
              ? `All ${result.considered} providers, ranked`
              : `Your shortlist: ${result.shortlist.length} of ${result.considered} providers`}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-zinc-900 hover:text-white transition-colors"
            >
              {copied ? "Link copied ✓" : "Copy share link"}
            </button>
            <a
              href={printUrl()}
              target="_blank"
              rel="noopener"
              className="px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full no-underline hover:bg-zinc-900 hover:text-white transition-colors"
            >
              Download PDF
            </a>
            <button
              type="button"
              onClick={() => { fireNetifyEvent("shortlist_get_bids_click"); void continueCanonicalProject(); }}
              disabled={handoffState === "busy"}
              className="px-3.5 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full no-underline hover:bg-amber-400 transition-colors"
            >
              {handoffState === "busy" ? "Opening your project…" : "Get competing bids →"}
            </button>
          </div>
        </div>
        {handoffState === "error" && <p className="mb-4 text-sm text-red-700">Your shortlist is still here, but the private project could not be created. Try again.</p>}
        <p className="text-sm text-[var(--ink-500)] mb-6">
          {isDefaultView
            ? "Balanced capability score across all 40 features. Set filters, pick your sector, or describe your needs to the AI advisor to build your bespoke shortlist."
            : result.criteria_summary}
        </p>
        {/* The road onward (24 July 2026, Robert): the shortlist names the
            right providers; the workspace gets them answering. Linked
            directly to the apex, carrying the buyer's context in q. */}
        <section className="border border-[var(--ink-900)] rounded-sm p-5 mb-6 bg-[var(--paper-base)]">
          <p className="eyebrow mb-1">Next step</p>
          <p className="text-sm text-[var(--ink-700)] mb-3">
            You already have this for free: the right providers, named and ranked, no sign-in
            required. Publishing is what gets them responding — structured written bids side by
            side, indicative pricing private to you, and a single place to request demos. What you
            have built on this page travels with you, and vendors never see your email or phone
            number until you choose to share it.
          </p>
          <p className="mb-3 flex flex-wrap gap-1.5 text-xs">
            {["Structured written responses", "Indicative pricing, private to you", "Demo requests", "Message vendors in-app", "Contact details, when you choose"].map((c) => (
              <span key={c} className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[var(--ink-700)]">{c}</span>
            ))}
          </p>
          <button type="button"
            onClick={() => void continueCanonicalProject()}
            disabled={handoffState === "busy"}
            className="inline-block px-4 py-2 bg-amber-500 text-zinc-950 font-medium rounded-full text-sm no-underline hover:bg-amber-400 transition-colors"
          >
            Start a project
          </button>
        </section>

        {result.shortlist.length === 0 && (
          <div className="border border-[var(--ink-300,#ccc)] rounded-sm p-6 text-[var(--ink-700)]">
            <p className="mb-2 font-medium">No provider meets every requirement.</p>
            <p className="text-sm">
              Your hard filters exclude all {result.considered} providers. Relax a
              requirement, or move some requirements to preferred. The closest
              matches are shown below.
            </p>
          </div>
        )}

        <ol className="space-y-5 list-none p-0">
          {result.shortlist.map((v) => (
            <VendorCard
              key={`${v.slug}-${providerCardReset}`}
              v={v}
              compared={compareSlugs.includes(v.slug)}
              onCompare={() => toggleCompare(v.slug)}
            />
          ))}
        </ol>

        {/* The Continuation (DEF wave one): the tool speaks its own live
            state or says nothing. An empty shortlist derives null and
            renders nothing at all. Keyed by source so a re-ranked
            shortlist reseeds the sentence. */}
        {(() => {
          const cont = deriveContinuationTool({
            names: result.shortlist.map((v) => v.name),
            slugs: result.shortlist.slice(0, 5).map((v) => v.slug),
            considered: result.considered,
          });
          return cont ? (
            <div className="mt-10">
              <Continuation key={cont.source} c={cont} />
            </div>
          ) : null;
        })()}

        {result.near_misses.length > 0 && (
          <div className="mt-10">
            <p className="eyebrow mb-3">Near misses</p>
            <ul className="space-y-2 list-none p-0">
              {result.near_misses.map((v) => (
                <li key={v.slug} className="text-sm text-[var(--ink-700)] border-b border-[var(--ink-300,#ccc)] pb-2">
                  <span className="font-medium">{v.name}</span> ({v.score}):{" "}
                  {v.eligible
                    ? "eligible but outside your shortlist size."
                    : v.gating_failures[0]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 text-xs text-[var(--ink-500)]">{result.methodology_note}</p>

        {/* Email capture */}
        <section className="mt-12 border border-[var(--ink-900)] rounded-sm p-6">
          <p className="eyebrow mb-2">Keep this shortlist</p>
          <h3 className="text-lg mb-2">Email me this shortlist</h3>
          <p className="text-sm text-[var(--ink-700)] mb-4">
            We will email your ranked shortlist with links to each provider and a
            link that reopens these exact choices. The email also explains how to
            take the shortlist into Netify&apos;s main RFP Builder and invite providers
            to respond to the same requirements.
          </p>
          {leadState === "sent" ? (
            <p className="text-sm font-medium">Sent. Check your inbox.</p>
          ) : (
            <form onSubmit={submitLead} className="grid sm:grid-cols-3 gap-3">
              <input
                required
                placeholder="Name"
                value={lead.name}
                onChange={(e) => setLead({ ...lead, name: e.target.value })}
                className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm bg-white"
              />
              <input
                required
                type="email"
                placeholder="Work email"
                value={lead.email}
                onChange={(e) => setLead({ ...lead, email: e.target.value })}
                className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm bg-white"
              />
              <input
                placeholder="Company"
                value={lead.company}
                onChange={(e) => setLead({ ...lead, company: e.target.value })}
                className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm bg-white"
              />
              {/* Honeypot: hidden from humans */}
              <input
                tabIndex={-1}
                autoComplete="off"
                value={lead.company_url}
                onChange={(e) => setLead({ ...lead, company_url: e.target.value })}
                name="company_url"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
              />
              <button
                type="submit"
                disabled={leadState === "busy"}
                className="sm:col-span-3 px-4 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full text-sm disabled:opacity-50 hover:bg-amber-400 transition-colors"
              >
                {leadState === "busy" ? "Sending..." : "Email my shortlist"}
              </button>
              {leadState === "error" && (
                <p className="sm:col-span-3 text-sm text-red-700">
                  That did not send. Try again, or copy the share link instead.
                </p>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
    </section>
  );
}

function ComparisonWorkspace({
  vendors,
  comparison,
  compareSlugs,
  setCompareSlugs,
  question,
  setQuestion,
  ask,
  busy,
  messages,
  error,
  source,
}: {
  vendors: ShortlistVendor[];
  comparison: ComparisonResult | null;
  compareSlugs: string[];
  setCompareSlugs: React.Dispatch<React.SetStateAction<string[]>>;
  question: string;
  setQuestion: React.Dispatch<React.SetStateAction<string>>;
  ask: () => void;
  busy: boolean;
  messages: { role: "user" | "assistant"; content: string }[];
  error: string | null;
  source: string;
}) {
  const choose = (index: number, slug: string) => {
    setCompareSlugs((current) => {
      const next = [...current];
      next[index] = slug;
      return next.filter(Boolean).slice(0, 2);
    });
  };

  return (
    <section id="comparison-workspace" className="mb-12 overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 text-white shadow-[0_24px_70px_rgba(24,24,27,0.16)]">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Netify comparison workspace</p>
            <span className="rounded-full border border-zinc-700 px-2 py-1 font-mono text-[10px] text-zinc-400">{COMPARISON_HANDOFF_VERSION}</span>
          </div>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight !text-white md:text-4xl">Compare providers, then interrogate the evidence.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">Select two providers for a deterministic comparison across 40 capabilities. Ask a follow-up and the advisor uses the same comparison function exposed through Netify MCP.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            {[0, 1].map((index) => (
              <label key={index} className="block text-xs font-medium text-zinc-300">
                Provider {index === 0 ? "one" : "two"}
                <select value={compareSlugs[index] ?? ""} onChange={(event) => choose(index, event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-amber-400">
                  <option value="">Choose a provider</option>
                  {vendors.map((vendor) => <option key={vendor.slug} value={vendor.slug} disabled={compareSlugs[index === 0 ? 1 : 0] === vendor.slug}>{vendor.name}</option>)}
                </select>
              </label>
            )).reduce<React.ReactNode[]>((nodes, field, index) => index === 0 ? [field, <span key="versus" className="hidden pb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 sm:block">versus</span>] : [...nodes, field], [])}
          </div>

          <a
            href={comparison ? "#comparison-table" : undefined}
            aria-disabled={!comparison}
            className={`mt-5 flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left text-sm font-semibold no-underline transition-colors ${comparison ? "border-amber-300 bg-amber-400 text-zinc-950 shadow-[0_10px_30px_rgba(251,191,36,0.18)] hover:bg-amber-300" : "pointer-events-none border-zinc-800 bg-zinc-900 text-zinc-600"}`}
          >
            <span>Compare every feature across your selected providers</span>
            <span aria-hidden="true" className="ml-4 text-lg">↓</span>
          </a>

          <form className="mt-6 border-t border-zinc-800 pt-5" onSubmit={(event) => { event.preventDefault(); ask(); }}>
            <label htmlFor="comparison-question" className="text-xs font-medium text-zinc-300">Ask about the comparison</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input id="comparison-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Which is stronger for a managed UK healthcare deployment?" maxLength={1000} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-400" />
              <button disabled={busy || !question.trim()} className="rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">{busy ? "Reading evidence…" : "Ask Netify AI"}</button>
            </div>
          </form>
          {source && <p className="mt-3 text-xs text-zinc-500">Opened from {source.replaceAll("-", " ")}.</p>}
        </div>

        <div className="border-t border-zinc-800 bg-zinc-900/70 p-6 md:p-8 lg:border-l lg:border-t-0">
          {comparison ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Live evidence comparison</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {comparison.slugs.slice(0, 2).map((slug) => <div key={slug} className="rounded-xl border border-zinc-700 bg-zinc-950 p-4"><p className="text-sm font-semibold text-white">{comparison.names[slug]}</p><p className="mt-3 text-3xl font-semibold text-amber-400">{comparison.meta[slug].score}</p><p className="mt-1 text-xs text-zinc-400">balanced evidence score</p><p className="mt-3 text-xs text-zinc-300">{comparison.wins[slug].length} clear capability leads</p></div>)}
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-300">{comparison.summary}</p>
            </>
          ) : (
            <div className="flex min-h-64 flex-col justify-center">
              {[['01', 'Select', 'Choose any two of the 30 researched providers.'], ['02', 'Compare', 'See the same evidence matrix used by the public MCP tool.'], ['03', 'Question', 'Ask what the differences mean for your project.']].map(([number, title, copy]) => <div key={number} className="mb-5 last:mb-0"><p className="font-mono text-xs text-zinc-500">{number} {title.toUpperCase()}</p><p className="mt-1 text-base text-zinc-200">{copy}</p></div>)}
            </div>
          )}
        </div>
      </div>
      {(messages.length > 0 || error) && <div className="border-t border-zinc-800 bg-black/30 px-6 py-5 md:px-8"><div className="max-w-4xl space-y-3">{messages.map((message, index) => <div key={index} className={`text-sm leading-6 ${message.role === "user" ? "text-zinc-500" : "border-l-2 border-amber-400 pl-4 text-zinc-200"}`}>{message.role === "user" ? `You: ${message.content}` : message.content}</div>)}{error && <p role="alert" className="text-sm text-red-300">{error}</p>}</div></div>}
    </section>
  );
}

function VendorCard({
  v,
  compared,
  onCompare,
}: {
  v: VendorVerdict;
  compared: boolean;
  onCompare: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border border-[var(--ink-300,#ccc)] rounded-sm p-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0">
          <p className="eyebrow mb-1">No. {v.rank} · Score {v.score}</p>
          <h3 className="text-lg mb-1">
            <a href={v.marketplace_url!} className="no-underline hover:text-[var(--accent)]">
              {v.name}
            </a>
          </h3>
          <p className="text-sm text-[var(--ink-500)]">{v.category} · Typical deployment: {v.deployment_speed} · {v.value_tier} pricing tier</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <button
            onClick={onCompare}
            className={`text-sm border rounded-full px-3 py-1 transition-colors ${
              compared
                ? "bg-amber-100 text-amber-900 border-amber-400"
                : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"
            }`}
          >
            {compared ? "Comparing ✓" : "Compare"}
          </button>
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="text-sm border border-[var(--ink-300,#ccc)] rounded-full px-3 py-1 hover:border-[var(--ink-900)]"
          >
            {open ? "Close expanded listing" : "View expanded listing"}
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--ink-700)] mt-3">{v.shortlist_summary}</p>
      {open && (
        <div className="mt-4 border-t border-[var(--ink-300,#ccc)] pt-4 text-sm">
          <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-[var(--ink-300,#ccc)] bg-[var(--ink-300,#ccc)] sm:grid-cols-4">
            {[
              ["Evidence coverage", `${v.evidence_coverage_pct}%`],
              ["Deployment", v.deployment_speed],
              ["Pricing", v.value_tier],
              ["UK delivery", v.uk_delivery],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--paper-base)] p-3">
                <p className="text-xs text-[var(--ink-500)]">{label}</p>
                <p className="mt-1 font-medium">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="font-medium mb-1">Best fit for</p>
            <ul className="list-disc pl-5 space-y-1 text-[var(--ink-700)]">
              {v.best_fit_for.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p className="font-medium mt-3 mb-1">Meets your requirements</p>
            <ul className="list-disc pl-5 space-y-1 text-[var(--ink-700)]">
              {v.matched_requirements.length > 0 ? (
                v.matched_requirements.map((m, i) => <li key={i}>{m}</li>)
              ) : (
                <li>No hard requirements set; ranked on weighted capability score.</li>
              )}
            </ul>
            {v.gaps.length > 0 && (
              <>
                <p className="font-medium mt-3 mb-1">Evidence caveats</p>
                <ul className="list-disc pl-5 space-y-1 text-[var(--ink-700)]">
                  {v.gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </>
            )}
          </div>
          <div>
            <p className="font-medium mb-1">Key differentiators</p>
            <ul className="list-disc pl-5 space-y-1 text-[var(--ink-700)]">
              {v.key_differentiators.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p className="font-medium mt-3 mb-1">Watch-outs</p>
            <ul className="list-disc pl-5 space-y-1 text-[var(--ink-700)]">
              {v.watch_outs.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            <p className="font-medium mt-3 mb-1">Commercials</p>
            <p className="text-[var(--ink-700)]">{v.cost_model}</p>
            <p className="font-medium mt-3 mb-1">UK basis</p>
            <p className="text-[var(--ink-700)]">{v.uk_basis}</p>
            <a
              href={v.marketplace_url ?? "https://netify.co.uk/marketplace/"}
              target="_blank"
              rel="noopener"
              className="inline-block mt-3 px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full no-underline hover:bg-zinc-900 hover:text-white transition-colors"
            >
              Read the full {v.name} research page ↗
            </a>
          </div>
          </div>
        </div>
      )}
    </li>
  );
}

/* ShortlistBridge deleted 23 Jul 2026 (Robert: "delete at leisure"): the
   Continuation replaced it in DEF wave one; the bridge's events retired
   with it. */
