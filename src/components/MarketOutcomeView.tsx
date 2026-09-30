import type {PublicOutcome} from '@/lib/market-outcomes';
export default function MarketOutcomeView({record:r}:{record:PublicOutcome}){return <article className="my-5 rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
<h3 className="text-xl font-semibold">{r.sector.replaceAll('_',' ')} · {r.site_band} sites</h3>
<p className="mt-2">{r.user_band} remote users · {r.reporting_period}</p>
<p className="mt-3 whitespace-pre-wrap">{r.scope}</p>
<dl className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Providers approached',r.approached],['Introductions acknowledged',r.acknowledged],['Responses received',r.responded],['Providers declining',r.declined]].map(([label,value])=><div key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="text-lg font-semibold">{value}</dd></div>)}</dl>
<p>First recorded proposal: {r.first_proposal_working_days===null?'Not established':`${r.first_proposal_working_days} weekdays`}</p><p className="mt-1 text-sm text-slate-600">{r.timing_basis}</p>
<p className="mt-4 font-semibold">Status: {r.outcome.replaceAll('_',' ')}</p><p className="mt-2 whitespace-pre-wrap">{r.summary}</p>
<p className="mt-4 text-sm text-slate-600">Netify outcome record. Publication requires buyer permission. Revision {r.revision}. This record describes one project and is not a promise of future results.</p>
</article>;}
