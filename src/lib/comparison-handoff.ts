export const COMPARISON_HANDOFF_VERSION = "provider-comparison/1.0.0";

export type ComparisonHandoff = {
  providers: string[];
  question: string;
  source: string;
};

const cleanSlug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

export function parseComparisonHandoff(search: string, validSlugs: string[]): ComparisonHandoff {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const allowed = new Set(validSlugs);
  const providers = (params.get("compare") ?? "")
    .split(",")
    .map(cleanSlug)
    .filter((slug, index, all) => allowed.has(slug) && all.indexOf(slug) === index)
    .slice(0, 3);
  return {
    providers,
    question: (params.get("question") ?? "").trim().slice(0, 1000),
    source: (params.get("source") ?? "").trim().slice(0, 80),
  };
}

export function applyComparisonHandoff(params: URLSearchParams, handoff: ComparisonHandoff): URLSearchParams {
  const next = new URLSearchParams(params);
  if (handoff.providers.length >= 2) next.set("compare", handoff.providers.join(","));
  else next.delete("compare");
  if (handoff.question) next.set("question", handoff.question);
  else next.delete("question");
  if (handoff.source) next.set("source", handoff.source);
  else next.delete("source");
  if (handoff.providers.length >= 2 || handoff.question || handoff.source) {
    next.set("comparison_contract", COMPARISON_HANDOFF_VERSION);
  } else {
    next.delete("comparison_contract");
  }
  return next;
}
