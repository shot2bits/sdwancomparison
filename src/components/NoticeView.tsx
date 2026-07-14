/**
 * NoticeView: the public project notice, laid out like a clear procurement
 * notice. Pure presentational and server-safe: used by the server-rendered
 * public opportunity page, the sample notice pages and the client-side wizard
 * preview, so what the buyer previews is exactly what gets published.
 */

import Link from "next/link";
import { RESPONSE_MODE_LABELS, type PublicOpportunity } from "@/lib/opportunity-types";
import {
  SECTORS,
  SIZE_BANDS,
  USERS_BANDS,
  CLOUD_PLATFORMS,
  COMPLIANCE_OPTIONS,
  EVIDENCE_OPTIONS,
  EVALUATION_PRIORITIES,
  labelFor,
  labelsFor,
} from "@/lib/notice-options";
import { buyerLabel, formatDate, regionLabels, scopeLabels } from "@/lib/notice-schema";

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "amber" | "green" }) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-[var(--ink-100,#f0f0f0)] text-[var(--ink-600)]";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--ink-100,#f0f0f0)] py-1.5 text-sm">
      <span className="text-[var(--ink-500)]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export default function NoticeView({
  notice,
  isSample = false,
  isPreview = false,
}: {
  notice: PublicOpportunity;
  isSample?: boolean;
  isPreview?: boolean;
}) {
  const o = notice;
  const statusLabel = o.status === "open" ? "Open for responses" : o.status === "awarded" ? "Awarded" : "Closed";
  const sector = o.buyer_sector ? labelFor(SECTORS, o.buyer_sector) : "";
  const responseDeadline = formatDate(o.response_deadline ?? o.deadline);

  return (
    <article className="max-w-3xl">
      {isSample && (
        <p className="mb-4 rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <strong>Sample RFI.</strong> A worked example showing what a published RFI looks like — not a live opportunity.{" "}
          <Link href="/opportunities/new" className="underline">Post your own project</Link>.
        </p>
      )}
      {isPreview && (
        <p className="mb-4 rounded-sm border border-[var(--ink-300,#ccc)] bg-[var(--ink-50,#fafafa)] px-4 py-2 text-sm text-[var(--ink-700)]">
          <strong>Preview.</strong> This is exactly how your notice will appear on the public board. Nothing is published yet.
        </p>
      )}

      {/* 1. Header */}
      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip tone={o.status === "open" ? "green" : "neutral"}>{statusLabel}</Chip>
          <Chip tone="amber">{RESPONSE_MODE_LABELS[o.response_mode] ?? o.response_mode}</Chip>
          {o.eligibility === "open" ? <Chip>Open to verified suppliers</Chip> : <Chip>Invite-only</Chip>}
          {o.buyer_visibility === "anonymous" && <Chip>Anonymous buyer</Chip>}
        </div>
        <h1 id="page-h1" className="mb-3 text-2xl leading-snug">{o.title}</h1>
        <div className="flex flex-wrap gap-1.5">
          {scopeLabels(o).map((s) => (
            <span key={s} className="rounded-full border border-[var(--ink-200,#e5e5e5)] px-2.5 py-0.5 text-xs text-[var(--ink-700)]">{s}</span>
          ))}
        </div>
      </header>

      {/* 2. AI-readable summary */}
      {o.ai_summary && (
        <section id="ai-summary" className="mb-8 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--ink-50,#fafafa)] p-4">
          <p className="eyebrow mb-1">Summary</p>
          <p className="text-sm text-[var(--ink-800)]">{o.ai_summary}</p>
        </section>
      )}

      {/* 3. Project overview */}
      <Section title="Project overview">
        <p className="text-sm text-[var(--ink-800)] whitespace-pre-line">{o.summary}</p>
        {o.current_environment && (
          <div className="mt-3">
            <p className="text-sm font-medium mb-1">Current environment</p>
            <p className="text-sm text-[var(--ink-700)] whitespace-pre-line">{o.current_environment}</p>
          </div>
        )}
        {o.desired_outcomes && (
          <div className="mt-3">
            <p className="text-sm font-medium mb-1">Desired outcome</p>
            <p className="text-sm text-[var(--ink-700)] whitespace-pre-line">{o.desired_outcomes}</p>
          </div>
        )}
      </Section>

      {/* 4-5. Scope and buyer context facts */}
      <Section title="Scope and buyer context">
        <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
          <Fact label="Buyer" value={buyerLabel(o)} />
          <Fact label="Sector" value={sector} />
          <Fact label="Organisation size" value={o.buyer_size_band ? labelFor(SIZE_BANDS, o.buyer_size_band) : ""} />
          <Fact label="Regions" value={regionLabels(o).join(", ")} />
          <Fact label="Sites" value={o.sites != null ? String(o.sites) : ""} />
          <Fact label="Users" value={o.users_band ? labelFor(USERS_BANDS, o.users_band) : ""} />
          <Fact label="Remote users" value={o.remote_users_band ? labelFor(USERS_BANDS, o.remote_users_band) : ""} />
          <Fact label="Cloud platforms" value={labelsFor(CLOUD_PLATFORMS, o.cloud_platforms).join(", ")} />
          <Fact label="Compliance" value={labelsFor(COMPLIANCE_OPTIONS, o.compliance_requirements).join(", ")} />
          <Fact label="Budget note" value={o.budget_note} />
        </div>
      </Section>

      {/* 6. Timeline */}
      <Section title="Timeline">
        <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
          <Fact label="Published" value={formatDate(o.created)} />
          <Fact label="Response deadline" value={responseDeadline ?? "None set — responses accepted while open"} />
          <Fact label="Decision target" value={formatDate(o.decision_target)} />
          <Fact label="Target go-live" value={formatDate(o.go_live_target)} />
          {o.timeline_note && <p className="pt-2 text-sm text-[var(--ink-700)]">{o.timeline_note}</p>}
        </div>
      </Section>

      {/* 7. Supplier response instructions */}
      <Section title="How suppliers respond">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--ink-700)]">
          <li>
            Response mode: <strong>{RESPONSE_MODE_LABELS[o.response_mode] ?? o.response_mode}</strong>.
          </li>
          <li>Browsing this opportunity is open to everyone. Responding requires supplier sign-in with a verified work email.</li>
          <li>Pricing submitted by suppliers is private to the buyer and never shown publicly.</li>
          {o.eligibility === "invited" && <li>This opportunity is invite-only: the buyer selects which suppliers may respond.</li>}
          {o.evidence_requested.length > 0 && (
            <li>
              Evidence requested: {labelsFor(EVIDENCE_OPTIONS, o.evidence_requested).join("; ")}.
            </li>
          )}
        </ul>
      </Section>

      {/* 8. Evaluation priorities */}
      {o.evaluation_priorities.length > 0 && (
        <Section title="Evaluation priorities">
          <div className="flex flex-wrap gap-1.5">
            {labelsFor(EVALUATION_PRIORITIES, o.evaluation_priorities).map((p) => (
              <span key={p} className="rounded-full border border-[var(--ink-200,#e5e5e5)] px-2.5 py-0.5 text-xs text-[var(--ink-700)]">{p}</span>
            ))}
          </div>
        </Section>
      )}

      {/* AI assumptions and gaps: published transparency */}
      {(o.ai_assumptions.length > 0 || o.ai_gap_flags.length > 0) && (
        <Section title="Assumptions and open questions">
          {o.ai_assumptions.length > 0 && (
            <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink-600)]">
              {o.ai_assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
          {o.ai_gap_flags.length > 0 && (
            <p className="text-sm text-[var(--ink-600)]">Suppliers may ask for clarification on: {o.ai_gap_flags.join("; ")}.</p>
          )}
        </Section>
      )}

      {/* 10. Related resources */}
      <Section title="Related Netify resources">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><Link href="/rfp-builder/questions" className="underline">Netify RFP question bank</Link></li>
          <li><Link href="/rfp-builder/sample-rfp" className="underline">Sample RFP</Link></li>
          <li><Link href="/shortlist" className="underline">Shortlist builder</Link></li>
          <li><Link href="/vendors" className="underline">Vendor profiles</Link></li>
          <li><a href="https://netify.co.uk/methodology/" className="underline">Netify research methodology</a></li>
        </ul>
      </Section>
    </article>
  );
}
