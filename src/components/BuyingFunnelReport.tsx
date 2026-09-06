'use client';
import {useEffect,useState} from 'react';
import SignIn from '@/components/SignIn';
import {FUNNEL_EVENTS,FUNNEL_LABELS,type FunnelReport} from '@/lib/marketplace-funnel-report';
export default function BuyingFunnelReport(){
 const [data,setData]=useState<FunnelReport|null>(null);const [error,setError]=useState('');const [auth,setAuth]=useState(false);const [loading,setLoading]=useState(true);
 async function load(signal?:AbortSignal){try{const r=await fetch('/sase/api/admin/buying-funnel/',{cache:'no-store',signal});const body=await r.json();if(signal?.aborted)return;if(!r.ok){setData(null);setAuth(r.status===401);throw new Error(body.error||'Report unavailable.');}setData(body);}catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Report unavailable.');}finally{if(!signal?.aborted)setLoading(false);}}
 useEffect(()=>{const controller=new AbortController();queueMicrotask(()=>{if(!controller.signal.aborted)void load(controller.signal);});return()=>controller.abort();},[]);
 return <div className="mt-8">
  <button type="button" disabled={loading} onClick={()=>{setLoading(true);setError('');setAuth(false);void load();}} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">{loading?'Loading report…':'Refresh report'}</button>
  {error&&<p role="alert" className="mt-4">{error}</p>}
  {auth&&<SignIn role="buyer" prompt="Sign in with your Netify admin account to view buying outcomes."/>}
  {data&&<>
   <p className="mt-6 leading-7 text-slate-600">{data.interpretation}</p>
   <p className="mt-3 text-sm text-slate-600">Period: {new Date(data.period_start).toLocaleDateString('en-GB')}–{new Date(data.generated_at).toLocaleDateString('en-GB')}. Oldest retained event: {data.oldest_available?new Date(data.oldest_available).toLocaleDateString('en-GB'):'No events recorded'}. Up to {data.retained_event_limit.toLocaleString('en-GB')} recent events retained.</p>
   {data.retention_limit_reached&&<p role="status" className="mt-3">The retention limit has been reached. This may not cover the whole 28-day period.</p>}
   <dl className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FUNNEL_EVENTS.map(event=><div key={event} className="rounded-lg border border-slate-200 p-5"><dt className="text-sm text-slate-600">{FUNNEL_LABELS[event]}</dt><dd className="mt-2 text-3xl font-semibold">{data.counts[event]}</dd></div>)}</dl>
   <h2 className="mt-10 text-xl font-semibold">By recorded starting route</h2>
   <p className="mt-3 text-sm leading-6 text-slate-600">The first retained source is kept when a supplier responds through another channel. “Unknown” means no reliable source was recorded. API is the recorded transport for legacy flows, not proof of an AI referral. Standalone notices have no saved-draft stage and are counted only once publication succeeds.</p>
   <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><caption className="sr-only">Unique projects by source, format and recorded channel</caption><thead><tr>{['Source','Format','Channel','Saved','Prepared','Verified','Published','Responses'].map(h=><th key={h} scope="col" className="border-b p-3">{h}</th>)}</tr></thead><tbody>{data.rows.map(row=><tr key={[row.source,row.mode,row.channel].join(':')}><th scope="row" className="border-b p-3 font-medium">{row.source}</th><td className="border-b p-3">{row.mode}</td><td className="border-b p-3">{row.channel}</td>{(['project_started','publication_prepared','identity_verified','publication_completed','supplier_response'] as const).map(e=><td key={e} className="border-b p-3">{row.counts[e]}</td>)}</tr>)}</tbody></table></div>
   {!data.rows.length&&<p className="mt-4">No recorded buying outcomes in this period.</p>}
  </>}
 </div>;
}
