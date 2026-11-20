import Link from "next/link";
import { CLAIM_LABEL, RESEARCH, formatDate, researchSource, pricingSource } from "@/lib/workbook-research";

export function JsonLd({ data }: { data: unknown[] }) {
  return (
    <>
      {data.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, "\\u003c") }} />
      ))}
    </>
  );
}

export function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Inline citation for a research source: publisher, link, access date, claim type. */
export function SourceCite({ id }: { id: string | null | undefined }) {
  const s = researchSource(id);
  if (!s) return null;
  return (
    <span className="text-xs text-[var(--ink-500)]">
      <a href={s.url} rel="nofollow noopener" target="_blank" className="underline">
        {s.publisher || host(s.url)}
      </a>
      {s.accessed_date ? ` · accessed ${formatDate(s.accessed_date)}` : ""} · {CLAIM_LABEL[s.claim]}
    </span>
  );
}

export function PricingCite({ id }: { id: string | null | undefined }) {
  const s = pricingSource(id);
  if (!s) return null;
  return (
    <span className="text-xs text-[var(--ink-500)]">
      <a href={s.url} rel="nofollow noopener" target="_blank" className="underline">
        {s.publisher || host(s.url)}
      </a>
      {s.source_type ? ` · ${s.source_type}` : ""}
      {s.published_date ? ` · published ${formatDate(s.published_date)}` : ""}
      {s.observed_date ? ` · seen ${formatDate(s.observed_date)}` : ""}
    </span>
  );
}

export function ResearchNotice() {
  return (
    <p className="text-sm border-l-4 border-[var(--ink-300,#ccc)] pl-3 text-[var(--ink-700)] my-6" data-research-notice>
      Unverified desk research. Each row is a provider-published (or third-party) claim recorded with its source and the date
      Netify accessed it ({formatDate(RESEARCH.evidence_window.sources_accessed_from)} to {formatDate(RESEARCH.evidence_window.sources_accessed_to)}).
      Netify has not independently verified these claims. Dataset {RESEARCH.dataset_version}.{" "}
      <Link href="/research/" className="underline">About this research</Link>
    </p>
  );
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm mb-6 text-[var(--ink-500)]">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-2 text-[var(--ink-300)]">/</span>}
          {it.href ? (
            <Link href={it.href} className="no-underline text-[var(--ink-500)] hover:text-[var(--accent)]">{it.label}</Link>
          ) : (
            <span className="text-[var(--ink-700)]">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  const SITE = "https://netify.co.uk/sase";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE}${it.path}` })),
  };
}
