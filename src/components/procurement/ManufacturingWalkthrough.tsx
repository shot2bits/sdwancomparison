import { MANUFACTURING_WALKTHROUGH } from '@/lib/marketplace-examples';

/** Public illustrative output, shared with the example's JSON representation. */
export default function ManufacturingWalkthrough() {
  const example = MANUFACTURING_WALKTHROUGH;
  return <section className="mt-10 border-t border-slate-200 pt-8" aria-labelledby="manufacturing-walkthrough">
    <h2 id="manufacturing-walkthrough" className="text-2xl font-semibold">From a manufacturing requirement to supplier responses</h2>
    <p className="mt-3 leading-7 text-slate-600">{example.disclosure}</p>
    <ol className="mt-6 space-y-6">{example.steps.map((step, i) => <li key={step.title} className="border-l-2 border-slate-200 pl-5">
      <h3 className="text-lg font-semibold">{i + 1}. {step.title}</h3><p className="mt-2 leading-7">{step.text}</p>
    </li>)}</ol>
    <details className="mt-8 rounded-lg border border-slate-200 p-5">
      <summary className="cursor-pointer font-semibold">See the illustrative supplier response comparison</summary>
      <p className="mt-3 text-sm leading-6">Fictional supplier answers for this example only. No offers, prices, supplier scores or response-time promises are implied.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><caption className="pb-3 text-left font-medium">Evidence to clarify before making a buying decision</caption><thead><tr>{['Requirement', 'Illustrative supplier A', 'Illustrative supplier B', 'Buyer follow-up'].map(h => <th scope="col" key={h} className="border-b border-slate-300 p-3">{h}</th>)}</tr></thead><tbody>{example.responses.map(row => <tr key={row.requirement}><th scope="row" className="border-b border-slate-200 p-3 align-top">{row.requirement}</th><td className="border-b border-slate-200 p-3 align-top">{row.a}</td><td className="border-b border-slate-200 p-3 align-top">{row.b}</td><td className="border-b border-slate-200 p-3 align-top">{row.followup}</td></tr>)}</tbody></table></div>
    </details>
    <p className="mt-5 text-sm leading-6 text-slate-600">Example reviewed {example.reviewed}. <a href="/sase/rfp-builder/questions/" className="underline">Question bank</a> · <a href="/sase/shortlist/research-methodology/" className="underline">Provider research method</a> · <a href="/sase/connector/" className="underline">AI connection and permissions</a>.</p>
    <p className="mt-3 leading-7">A short project brief can invite responses without a full RFP. Short and Detailed RFPs retain your answers and bespoke questions; you can also bring an RFP or RFI. Netify provides the shared buying workspace and supplier response process, with publication controlled by you.</p>
  </section>;
}
