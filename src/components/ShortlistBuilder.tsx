"use client";

/**
 * Shortlist builder client island.
 * All verdict logic lives in src/lib/shortlist-core.ts (shared with the
 * MCP tool and the Claude agent). This component only collects input,
 * calls buildShortlist, and renders the result.
 *
 * URL state: reads window.location.search on mount, pushes changes back
 * via history.replaceState (debounced) so every scenario is shareable.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import CompareTable from "@/components/CompareTable";
import { fireNetifyEvent } from "@/components/NetifyEvents";
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

type FeatureMeta = { id: string; name: string; category: string };

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

  // Lead form state
  const [lead, setLead] = useState({ name: "", email: "", company: "", company_url: "" });
  const [leadState, setLeadState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  const featureNames = useMemo(
    () => Object.fromEntries(features.map((f) => [f.id, f.name])),
    [features],
  );
  const featureIds = useMemo(() => features.map((f) => f.id), [features]);
  const categories = useMemo(
    () => Array.from(new Set(features.map((f) => f.category))),
    [features],
  );

  // Read URL state on mount
  useEffect(() => {
    setInput(decodeScenario(window.location.search, featureIds));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push state changes back into the URL (debounced)
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const qs = encodeScenario(input);
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    }, 250);
  }, [input, hydrated]);

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

  /**
   * Shortlist → RFP handoff. Carries the current scenario into the RFP
   * Builder through its EXISTING prefill contract (prefill=1 + sector/org/
   * model/regions/notes, the same params the /best pages and sector nav
   * links use), so no new schema is needed. The ranked candidates and the
   * criteria summary travel in `notes`, which the builder stores as buyer
   * context and feeds to generation. Region keys map asia_pacific → apac,
   * mirroring the project-notice carry-through in RfpBuilder.
   */
  function rfpUrl(): string {
    const p = new URLSearchParams();
    p.set("prefill", "1");
    if (input.sector) p.set("sector", input.sector);
    if (input.organisation_size !== "any") p.set("org", input.organisation_size);
    if (input.service_model !== "any") p.set("model", input.service_model);
    if (input.required_regions.length) {
      p.set(
        "regions",
        input.required_regions.map((r) => (r === "asia_pacific" ? "apac" : r)).join("."),
      );
    }
    const top = result.shortlist.slice(0, 10).map((v) => `${v.rank}. ${v.name} (${v.score})`);
    const scenario = encodeScenario(input);
    const notes = [
      "Candidate shortlist built with the Netify shortlist builder:",
      top.length ? `${top.join("; ")}.` : "",
      isDefaultView ? "" : `Criteria: ${result.criteria_summary}`,
      scenario ? `Scenario: /sase/shortlist?${scenario}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (top.length) p.set("notes", notes);
    return `/sase/rfp-builder/?${p.toString()}`;
  }

  async function askAgent() {
    if (!chatPrompt.trim() || chatBusy) return;
    const nextMessages = [...chatMessages, { role: "user" as const, content: chatPrompt }];
    setChatMessages(nextMessages);
    setChatPrompt("");
    setChatBusy(true);
    setChatError(null);
    try {
      const res = await fetch("/sase/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, current_input: input }),
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
          top_vendors: result.shortlist.slice(0, 10).map((v) => `${v.rank}. ${v.name} (${v.score})`),
        }),
      });
      if (!res.ok) throw new Error("lead failed");
      setLeadState("sent");
    } catch {
      setLeadState("error");
    }
  }

  const featureState = (fid: string): "off" | "required" | "preferred" =>
    input.required_features.includes(fid)
      ? "required"
      : input.preferred_features.includes(fid)
        ? "preferred"
        : "off";

  return (
    <div className="grid lg:grid-cols-12 gap-10">
      {/* ---------------- Filters column ---------------- */}
      <div className="lg:col-span-4 space-y-8">
        {/* AI advisor */}
        <section className="border border-[var(--ink-900)] rounded-sm p-5 bg-[var(--paper-base)]">
          <p className="eyebrow mb-2">AI advisor</p>
          <h2 className="text-lg mb-3">Describe what you need</h2>
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
            onClick={askAgent}
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
        </section>

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
                            title={
                              st === "off"
                                ? "Click: require this"
                                : st === "required"
                                  ? "Required. Click: prefer instead"
                                  : "Preferred. Click: clear"
                            }
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
          onClick={() => setInput(DEFAULT_INPUT)}
          className="text-sm text-[var(--ink-500)] underline hover:text-[var(--accent)]"
        >
          Reset all filters
        </button>
      </div>

      {/* ---------------- Results column ---------------- */}
      <div className="lg:col-span-8">
        {activeComparison && (
          <section className="mb-10 border border-[var(--ink-900)] rounded-sm p-5">
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
            <a
              href={rfpUrl()}
              className="px-3.5 py-1.5 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full no-underline hover:bg-amber-400 transition-colors"
            >
              Publish an RFP →
            </a>
          </div>
        </div>
        <p className="text-sm text-[var(--ink-500)] mb-6">
          {isDefaultView
            ? "Balanced capability score across all 40 features. Set filters, pick your sector, or describe your needs to the AI advisor to build your bespoke shortlist."
            : result.criteria_summary}
        </p>

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
              key={v.slug}
              v={v}
              compared={compareSlugs.includes(v.slug)}
              onCompare={() => toggleCompare(v.slug)}
            />
          ))}
        </ol>

        <ShortlistBridge
          names={result.shortlist.slice(0, 3).map((v) => v.name)}
          personalised={!isDefaultView}
          href={rfpUrl()}
        />

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
            We send the shareable link and the ranked list to your inbox. Netify
            can also issue this shortlist as a structured RFP to the vendors.
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">No. {v.rank} · Score {v.score}</p>
          <h3 className="text-lg mb-1">
            <a href={`/sase/vendors/${v.slug}`} className="no-underline hover:text-[var(--accent)]">
              {v.name}
            </a>
          </h3>
          <p className="text-sm text-[var(--ink-500)]">{v.category} · Typical deployment: {v.deployment_speed} · {v.value_tier} pricing tier</p>
        </div>
        <div className="flex gap-2 shrink-0">
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
            className="text-sm border border-[var(--ink-300,#ccc)] rounded-full px-3 py-1 hover:border-[var(--ink-900)]"
          >
            {open ? "Less" : "Why this rank?"}
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--ink-700)] mt-3">{v.shortlist_summary}</p>
      {open && (
        <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium mb-1">Meets your requirements</p>
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
            <p className="font-medium mb-1">Watch-outs</p>
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
              Contact {v.name} via Netify ↗
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * The bridge (Robert, 17 July 2026): the shortlist page is the busiest page
 * on the site while the brief flow sees one or two humans a day, so the
 * invitation moves to where the crowd is. Personalised with the user's top
 * three vendors; falls back to matched-supplier copy on the default view.
 * The href carries the whole scenario through rfpUrl()'s prefill contract.
 */
function ShortlistBridge({ names, personalised, href }: { names: string[]; personalised: boolean; href: string }) {
  useEffect(() => {
    fireNetifyEvent("shortlist_bridge_view", { personalised: personalised ? "1" : "0" });
    // Once per mount is the useful grain; filter changes re-rank in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recipients =
    names.length >= 2
      ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
      : names.length === 1
        ? names[0]
        : "";

  return (
    <section className="mt-8 rounded-md border border-amber-300 bg-amber-50 p-6">
      <p className="eyebrow mb-2 text-amber-800">Your shortlist, priced</p>
      <h3 className="mb-2 text-xl text-[#13294b]">Create and publish an RFP in minutes</h3>
      <p className="mb-4 max-w-2xl text-sm text-[var(--ink-700)]">
        Compare SASE &amp; SD-WAN across 30+ vendors and service providers.
        {recipients
          ? ` Your brief goes to ${personalised ? "the vendors you just shortlisted" : "your top-ranked vendors"}, including ${recipients}, who`
          : " Your brief goes to your best-matched suppliers, who"}{" "}
        respond in the app with structured answers and <strong>private pricing</strong>, side by
        side against your questions.
      </p>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-[var(--ink-700)]">
        <span><span aria-hidden="true" className="font-bold text-emerald-600">✓</span> Free for buyers</span>
        <span><span aria-hidden="true" className="font-bold text-emerald-600">✓</span> No sales calls until you reply</span>
        <span><span aria-hidden="true" className="font-bold text-emerald-600">✓</span> No obligation to award</span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <a
          href={href}
          onClick={() => fireNetifyEvent("shortlist_bridge_click", { n: String(names.length) })}
          className="inline-flex items-center rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-zinc-950 no-underline transition-colors hover:bg-amber-400"
        >
          Get competing bids from your shortlist →
        </a>
        <a href="/sase/how-it-works/" className="text-[13px] text-[#1e3a5f] underline">How supplier responses work</a>
      </div>
      <p className="mt-3 text-[11.5px] text-[var(--ink-500)]">
        Your shortlist carries over; add or remove suppliers before anything is sent. Nothing is
        shared with any supplier until you agree the submission.
      </p>
    </section>
  );
}
