import "server-only";
import { kvRaw } from "./rfp-store";
import { FUNNEL_APPEND_ONCE } from "./marketplace-funnel";
import { activityEnvironment } from "./activity-provenance";
import { SOURCING_ACQUISITIONS } from "./sourcing-acquisition";
export const SOURCING_METRIC_STAGES = [
  "plan",
  "request",
  "confirmed",
  "desk_notified",
  "desk_reviewed",
  "supplier_approached",
  "supplier_declined",
  "introduction_acknowledged",
  "comparable_set_ready",
  "buyer_decision",
] as const;
type Metric = {
  at: number;
  stage: string;
  source: string;
  environment: string;
};
export async function recordSourcingMetric(
  stage: (typeof SOURCING_METRIC_STAGES)[number],
  source: string,
  id: string,
) {
  if (
    !SOURCING_METRIC_STAGES.includes(stage) ||
    !SOURCING_ACQUISITIONS.includes(source as never)
  )
    return;
  try {
    const environment = activityEnvironment();
    const row: Metric = { at: Date.now(), stage, source, environment };
    await kvRaw([
      "EVAL",
      FUNNEL_APPEND_ONCE,
      2,
      `sourcing:metric-once:${environment}:${stage}:${id}`,
      "sourcing:metrics",
      JSON.stringify(row),
    ]);
  } catch {
    /* Measurement never changes the buyer outcome. */
  }
}
export async function sourcingWeeklyMetrics(now = Date.now()) {
  const raw = (await kvRaw([
    "LRANGE",
    "sourcing:metrics",
    0,
    9999,
  ])) as string[];
  const counts: Record<string, Record<string, Record<string, number>>> = {};
  for (const item of raw) {
    let row: Metric;
    try {
      row = JSON.parse(item);
    } catch {
      continue;
    }
    if (
      row.environment !== activityEnvironment() ||
      row.at < now - 90 * 86400000 ||
      row.at > now
    )
      continue;
    const d = new Date(row.at);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const week = d.toISOString().slice(0, 10);
    const source = (counts[week] ??= {});
    const stages = (source[row.source] ??= {});
    stages[row.stage] = (stages[row.stage] ?? 0) + 1;
  }
  return {
    environment: activityEnvironment(),
    weeks: counts,
    retained_event_limit: 10000,
    note: "Counts are recorded actions, not unique buyers or proof of citation. Google referrals combine AI and traditional search. Attribution is self-reported or inferred; no referrer URL, email, IP or brief is stored here.",
  };
}
