import Link from "next/link";
import { compareResearch, formatDate } from "@/lib/workbook-research";
import { SourceCite } from "./ResearchBits";

const clip = (s: string, n = 280) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/** Dated verdict and evidence table for a head-to-head, from the workbook research dataset. */
export default function WorkbookComparison({ a, b }: { a: string; b: string }) {
  const c = compareResearch(a, b);
  return (
    <section id="desk-research-verdict" className="my-10" aria-labelledby="desk-research-verdict-h">
      <p className="eyebrow mb-2">Desk research verdict · Updated {formatDate(c.updated)}</p>
      <h2 id="desk-research-verdict-h" className="mb-3">{c.nameA} vs {c.nameB}: what each provider publishes</h2>
      <p className="text-[var(--ink-700)] mb-6" data-verdict>{c.verdict}</p>

      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm border-collapse">
          <caption className="text-left text-[var(--ink-500)] mb-2">Evidenced desk-research questions by theme (count of findings with a provider source)</caption>
          <thead>
            <tr className="border-b border-[var(--ink-300,#ccc)]">
              <th scope="col" className="text-left py-2 pr-4">Theme</th>
              <th scope="col" className="text-right py-2 px-3">{c.nameA}</th>
              <th scope="col" className="text-right py-2 pl-3">{c.nameB}</th>
            </tr>
          </thead>
          <tbody>
            {c.byTheme.map((t) => (
              <tr key={t.theme} className="border-b border-[var(--ink-100,#eee)]">
                <th scope="row" className="text-left font-normal py-1.5 pr-4">{t.theme}</th>
                <td className="text-right py-1.5 px-3">{t.a}</td>
                <td className="text-right py-1.5 pl-3">{t.b}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <th scope="row" className="text-left py-2 pr-4">Total evidenced questions</th>
              <td className="text-right py-2 px-3">{c.counts.a}</td>
              <td className="text-right py-2 pl-3">{c.counts.b}</td>
            </tr>
            <tr>
              <th scope="row" className="text-left font-normal py-1.5 pr-4">Published customer cases found</th>
              <td className="text-right py-1.5 px-3">{c.counts.casesA}</td>
              <td className="text-right py-1.5 pl-3">{c.counts.casesB}</td>
            </tr>
            <tr>
              <th scope="row" className="text-left font-normal py-1.5 pr-4">Published list-price lines</th>
              <td className="text-right py-1.5 px-3">{c.counts.pricedA}</td>
              <td className="text-right py-1.5 pl-3">{c.counts.pricedB}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {c.shared.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="text-left text-[var(--ink-500)] mb-2">
              Same question, both providers: {c.shared.length} questions where both publish evidence. Unverified provider claims, quoted or summarised from the linked source.
            </caption>
            <thead>
              <tr className="border-b border-[var(--ink-300,#ccc)]">
                <th scope="col" className="text-left py-2 pr-3 w-1/4">Question</th>
                <th scope="col" className="text-left py-2 px-3">{c.nameA}</th>
                <th scope="col" className="text-left py-2 pl-3">{c.nameB}</th>
              </tr>
            </thead>
            <tbody>
              {c.shared.map((r) => (
                <tr key={r.field_id} className="border-b border-[var(--ink-100,#eee)] align-top">
                  <th scope="row" className="text-left font-normal py-2 pr-3"><span className="text-[var(--ink-500)] text-xs block">{r.theme}</span>{r.question}</th>
                  <td className="py-2 px-3">{clip(r.a.answer)}<br /><SourceCite id={r.a.source_id} /></td>
                  <td className="py-2 pl-3">{clip(r.b.answer)}<br /><SourceCite id={r.b.source_id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-sm">
        Full evidence: <Link href={`/research/providers/${a}/`} className="underline">{c.nameA} research</Link> ·{" "}
        <Link href={`/research/providers/${b}/`} className="underline">{c.nameB} research</Link> ·{" "}
        <Link href="/research/list-prices/" className="underline">Published list prices</Link>
      </p>
    </section>
  );
}
