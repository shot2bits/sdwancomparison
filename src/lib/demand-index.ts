/**
 * The Netify Demand Index (19 July 2026): live, anonymised marketplace demand,
 * computed from the RFP store and the public opportunity board. First-party
 * data nobody else holds: what companies are actually buying, by sector and
 * technology, refreshed continuously and snapshotted weekly for trend.
 *
 * Privacy rules, absolute:
 *  - Counts and shares only. No titles, no company names, no free text, no
 *    contact details, no per-project rows.
 *  - Percentage shares appear only when the sample passes SUPPRESSION_MIN;
 *    below that the index reports raw counts and says the sample is small.
 *  - "What buyers mandate" reuses the existing suppression-thresholded
 *    90-day demand aggregate (netify_get_sase_demand_stats discipline).
 *
 * Freshness: computed on demand, cached in KV for CACHE_SECONDS. A weekly
 * snapshot is written lazily the first time the index is read in a new ISO
 * week, building the trend series with no cron required.
 */

import {
  kvConfigured,
  kvGetJson,
  kvSetJson,
  listAllRfpIds,
  getProject,
  getBenchmark,
  getDemandAggregate,
  listPublicOpportunities,
  listArchivedPublicOpportunities,
} from "@/lib/rfp-store";
import { FEATURE_NAMES } from "@/lib/vendors";

const CACHE_KEY = "demand:index:cache:v1";
const SNAP_PREFIX = "demand:index:snap:";
const SNAP_WEEKS_KEY = "demand:index:snapweeks";
const CACHE_SECONDS = 1800;
const TREND_WEEKS_KEPT = 26;

/** Shares are published only at or above this sample size; counts always are. */
export const SUPPRESSION_MIN = 20;

const DAY = 24 * 60 * 60 * 1000;

const SECTOR_LABELS: Record<string, string> = {
  healthcare: "Healthcare & Pharma",
  retail_ecommerce: "Retail & E-commerce",
  financial_services: "Financial Services",
  manufacturing: "Manufacturing",
  public_sector: "Public Sector",
  legal: "Legal",
  logistics: "Logistics & Transport",
  technology: "Technology & SaaS",
  unspecified: "Not stated",
};

const SCOPE_LABELS: Record<string, string> = {
  full_sase: "Full SASE",
  sse_only: "SSE",
  sdwan_only: "SD-WAN",
  single_vendor_sase: "Single-vendor SASE",
  best_of_breed: "Best-of-breed (SD-WAN + SSE)",
};

function labelFor(map: Record<string, string>, key: string): string {
  if (map[key]) return map[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isoWeek(d: Date): string {
  // ISO-8601 week number, UTC.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface MixRow {
  key: string;
  label: string;
  projects: number;
  share_pct: number | null;
}

interface WindowCounts {
  projects_created: number;
  projects_published: number;
}

interface WeeklySnapshot {
  week: string;
  taken_at: number;
  projects_created_7d: number;
  projects_published_7d: number;
  open_opportunities: number;
  projects_all_time: number;
}

export interface DemandIndex {
  meta: {
    name: string;
    week: string;
    computed_at: string;
    methodology_version: string;
    launch_note: string;
  };
  totals: {
    projects_all_time: number;
    published_all_time: number;
    open_opportunities: number;
    recently_closed_opportunities: number;
  };
  windows: {
    last_7_days: WindowCounts;
    last_30_days: WindowCounts;
    last_90_days: WindowCounts;
  };
  sector_mix_90d: MixRow[];
  technology_mix_90d: MixRow[];
  funnel_all_time: {
    created: number;
    progressed_beyond_draft: number;
    published: number;
    publish_rate_pct: number | null;
  };
  what_buyers_mandate_90d: {
    sample: number;
    published: boolean;
    delivery_model_share?: { managed: number; co_managed: number; diy: number };
    top_security_components?: string[];
    note: string;
  };
  cumulative_sector_benchmark: Array<{ sector: string; label: string; rfps: number }>;
  weekly_trend: WeeklySnapshot[];
  suppression: { shares_minimum_sample: number; note: string };
}

function mixRows(counts: Map<string, number>, labels: Record<string, string>): MixRow[] {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, projects]) => ({
      key,
      label: labelFor(labels, key),
      projects,
      share_pct: total >= SUPPRESSION_MIN ? Math.round((projects / total) * 100) : null,
    }));
}

const PUBLISHED_STATUSES = new Set(["published", "qa", "evaluation"]);

async function compute(): Promise<DemandIndex> {
  const now = Date.now();
  const nowDate = new Date(now);

  // Full project scan (tens of records; the admin console uses the same path).
  const ids = await listAllRfpIds();
  const projects: Array<{ created: number; updated: number; status: string; sector: string; scope: string }> = [];
  for (let i = 0; i < ids.length; i += 25) {
    const batch = await Promise.all(ids.slice(i, i + 25).map((id) => getProject(id)));
    for (const p of batch) {
      if (!p) continue;
      projects.push({
        created: p.created ?? 0,
        updated: p.updated ?? 0,
        status: p.status ?? "draft",
        sector: p.sector ?? "unspecified",
        scope: p.product_scope ?? "full_sase",
      });
    }
  }

  const inWindow = (ms: number) => (t: number) => t > 0 && now - t <= ms;
  const windowCounts = (days: number): WindowCounts => {
    const within = inWindow(days * DAY);
    return {
      projects_created: projects.filter((p) => within(p.created)).length,
      // No stored publish timestamp; a published-status project whose last
      // update falls in the window is the stated approximation.
      projects_published: projects.filter((p) => PUBLISHED_STATUSES.has(p.status) && within(p.updated)).length,
    };
  };

  const within90 = inWindow(90 * DAY);
  const recent = projects.filter((p) => within90(p.created));
  const sectorCounts = new Map<string, number>();
  const scopeCounts = new Map<string, number>();
  for (const p of recent) {
    sectorCounts.set(p.sector, (sectorCounts.get(p.sector) ?? 0) + 1);
    scopeCounts.set(p.scope, (scopeCounts.get(p.scope) ?? 0) + 1);
  }

  const published = projects.filter((p) => PUBLISHED_STATUSES.has(p.status)).length;
  const progressed = projects.filter((p) => p.status !== "draft").length;

  const [openOpps, archivedOpps, benchmark, aggregate] = await Promise.all([
    listPublicOpportunities().catch(() => []),
    listArchivedPublicOpportunities(12).catch(() => []),
    getBenchmark(),
    getDemandAggregate(),
  ]);

  const mandate: DemandIndex["what_buyers_mandate_90d"] = {
    sample: aggregate.samples ?? 0,
    published: (aggregate.samples ?? 0) >= SUPPRESSION_MIN,
    note:
      (aggregate.samples ?? 0) >= SUPPRESSION_MIN
        ? "Shares computed over RFPs generated in the three most recent calendar months."
        : `Sample below the suppression minimum of ${SUPPRESSION_MIN}; shares withheld until the sample is large enough to be meaningful.`,
  };
  if (mandate.published) {
    const dm = aggregate.operating_model ?? {};
    const managed = dm["managed"] ?? 0;
    const co = dm["co_managed"] ?? 0;
    const diy = dm["diy"] ?? 0;
    const dmTotal = managed + co + diy;
    if (dmTotal >= SUPPRESSION_MIN) {
      mandate.delivery_model_share = {
        managed: Math.round((managed / dmTotal) * 100),
        co_managed: Math.round((co / dmTotal) * 100),
        diy: Math.round((diy / dmTotal) * 100),
      };
    }
    const secEntries = Object.entries(aggregate.mandatory_security_features ?? {});
    if (secEntries.reduce((a, [, n]) => a + n, 0) >= SUPPRESSION_MIN) {
      mandate.top_security_components = secEntries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([fid]) => (FEATURE_NAMES as Record<string, string>)[fid])
        .filter(Boolean) as string[];
    }
  }

  const benchRows = Object.entries(benchmark.rfps_by_sector ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sector, rfps]) => ({ sector, label: labelFor(SECTOR_LABELS, sector), rfps }));

  const week = isoWeek(nowDate);
  const index: DemandIndex = {
    meta: {
      name: "Netify SASE & SD-WAN Demand Index",
      week,
      computed_at: new Date(now).toISOString(),
      methodology_version: "v2026.1",
      launch_note:
        "The index reports live counts from launch. Percentage shares appear once a sample passes the suppression minimum; small numbers are shown as counts and described as such. The trend series compounds weekly.",
    },
    totals: {
      projects_all_time: projects.length,
      published_all_time: published,
      open_opportunities: Array.isArray(openOpps) ? openOpps.length : 0,
      recently_closed_opportunities: Array.isArray(archivedOpps) ? archivedOpps.length : 0,
    },
    windows: {
      last_7_days: windowCounts(7),
      last_30_days: windowCounts(30),
      last_90_days: windowCounts(90),
    },
    sector_mix_90d: mixRows(sectorCounts, SECTOR_LABELS),
    technology_mix_90d: mixRows(scopeCounts, SCOPE_LABELS),
    funnel_all_time: {
      created: projects.length,
      progressed_beyond_draft: progressed,
      published,
      publish_rate_pct: projects.length >= SUPPRESSION_MIN ? Math.round((published / projects.length) * 100) : null,
    },
    what_buyers_mandate_90d: mandate,
    cumulative_sector_benchmark: benchRows,
    weekly_trend: [],
    suppression: {
      shares_minimum_sample: SUPPRESSION_MIN,
      note: "Counts are always published; percentage shares only at or above the minimum sample. No project titles, buyer identities or free text ever appear in the index.",
    },
  };

  return index;
}

async function ensureSnapshot(index: DemandIndex): Promise<WeeklySnapshot[]> {
  const week = index.meta.week;
  const weeks = (await kvGetJson<string[]>(SNAP_WEEKS_KEY)) ?? [];
  if (!weeks.includes(week)) {
    const snap: WeeklySnapshot = {
      week,
      taken_at: Date.now(),
      projects_created_7d: index.windows.last_7_days.projects_created,
      projects_published_7d: index.windows.last_7_days.projects_published,
      open_opportunities: index.totals.open_opportunities,
      projects_all_time: index.totals.projects_all_time,
    };
    await kvSetJson(SNAP_PREFIX + week, snap);
    weeks.push(week);
    while (weeks.length > TREND_WEEKS_KEPT) {
      weeks.shift();
    }
    await kvSetJson(SNAP_WEEKS_KEY, weeks);
  }
  const snaps = await Promise.all(weeks.map((w) => kvGetJson<WeeklySnapshot>(SNAP_PREFIX + w)));
  return snaps.filter((s): s is WeeklySnapshot => !!s).sort((a, b) => a.week.localeCompare(b.week));
}

/** Cached entry point. Returns null when KV is not configured (local dev). */
export async function getDemandIndex(): Promise<DemandIndex | null> {
  if (!kvConfigured()) return null;
  const cached = await kvGetJson<{ at: number; index: DemandIndex }>(CACHE_KEY);
  if (cached && Date.now() - cached.at < CACHE_SECONDS * 1000) return cached.index;
  const index = await compute();
  index.weekly_trend = await ensureSnapshot(index);
  await kvSetJson(CACHE_KEY, { at: Date.now(), index });
  return index;
}
