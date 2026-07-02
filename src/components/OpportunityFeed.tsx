"use client";

/** Shared live feed renderer for the opportunity room. */

type Pricing = { model: string; amount: number | null; currency: string; unit_note: string; notes: string };
export type FeedItem = { id: string; actor_type: "buyer" | "supplier"; actor_slug: string | null; actor_name: string; type: string; body: string; pricing: Pricing | null; links?: string[]; answers?: Record<string, string>; created: number };

const TYPE_LABEL: Record<string, string> = {
  post: "Opportunity", comment: "Comment", pricing: "Pricing", interest: "Registered interest", decline: "Declined", award: "Awarded", closed: "Closed",
  response: "Structured response", question: "Clarification question",
};

// Human labels for structured-response answer keys (evidence catalogue).
const ANSWER_LABELS: Record<string, string> = {
  sector_references: "Sector references",
  coverage_evidence: "Coverage / PoP evidence",
  security_certifications: "Security certifications",
  sla_schedule: "SLA schedule",
  migration_plan: "Migration approach",
  support_model: "Support model",
  pricing_structure: "Pricing structure",
  case_studies: "Case studies",
};
const PRICE_MODEL: Record<string, string> = {
  per_site_monthly: "per site / month", per_user_monthly: "per user / month", total_monthly: "total / month", one_off: "one-off", indicative: "indicative",
};

export function FeedView({ items }: { items: FeedItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((f) => (
        <div key={f.id} className={`rounded-sm p-3 border ${f.type === "question" ? "bg-sky-50 border-sky-200" : f.actor_type === "buyer" ? "bg-amber-50 border-amber-200" : "border-[var(--ink-300,#ccc)]"}`}>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-500)] mb-1">
            {f.actor_name} · {TYPE_LABEL[f.type] ?? f.type} · {new Date(f.created).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
          </p>
          {f.body && <p className="text-sm text-[var(--ink-800)]">{f.body}</p>}
          {f.type === "question" && <p className="text-xs text-sky-700 mt-1">Buyer: reply with a comment to answer this clarification question.</p>}
          {f.answers && Object.keys(f.answers).length > 0 && (
            <dl className="mt-2 space-y-1.5">
              {Object.entries(f.answers).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium text-[var(--ink-600)]">{ANSWER_LABELS[k] ?? k.replace(/_/g, " ")}</dt>
                  <dd className="text-sm text-[var(--ink-800)]">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {f.pricing && (
            <p className="text-sm mt-1 text-[var(--ink-800)]">
              <span className="font-medium">{f.pricing.amount != null ? `${f.pricing.currency} ${f.pricing.amount.toLocaleString()}` : "Indicative"}</span>
              {" "}{PRICE_MODEL[f.pricing.model] ?? f.pricing.model}
              {f.pricing.unit_note ? ` · ${f.pricing.unit_note}` : ""}
              {f.pricing.notes ? ` · ${f.pricing.notes}` : ""}
            </p>
          )}
          {(f.links?.length ?? 0) > 0 && (
            <p className="text-xs mt-1.5 text-[var(--ink-600)]">
              Evidence:{" "}
              {(f.links ?? []).map((l, i) => (
                <span key={l}>
                  {i > 0 && " · "}
                  <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="underline break-all">{l.replace(/^https?:\/\//, "").slice(0, 60)}</a>
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-[var(--ink-500)]">No activity yet.</p>}
    </div>
  );
}
