'use client';
import {useCallback,useEffect,useState} from 'react';
import type {PublicOutcome} from '@/lib/market-outcomes';
import {OUTCOME_CONSENT} from '@/lib/market-outcome-contract';
import MarketOutcomeView from './MarketOutcomeView';
type Data={staff:boolean;record:null|{revision:number;status:string;public:PublicOutcome;evidence_references?:string[]}};
export default function MarketOutcomeWorkflow({id}:{id:string}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
 const load=useCallback(async()=>{const r=await fetch(`/sase/api/sourcing/projects/${id}/outcome/`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);return d as Data;},[id]);
 useEffect(()=>{let alive=true;load().then(d=>{if(alive){setData(d);setError('');}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[load]);
 async function act(action:string,extra:object={}){if(busy)return;setBusy(true);setError('');try{const r=await fetch(`/sase/api/sourcing/projects/${id}/outcome/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:data?.record?.revision??0,...extra})});const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setConsent(false);}catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}}
 const record=data?.record;const button='rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50';
 return <section className="my-8 rounded-xl border border-slate-300 p-5"><h2 className="text-2xl font-semibold">Optional anonymous outcome</h2><p className="my-3">Your project remains private. Publication is optional and does not affect your service. Review the complete proposed public record below before deciding. You can withdraw it from Netify later; copies already taken by other sites or search engines may remain.</p>
 {error&&<p role="alert" className="my-3 text-red-700">{error} <button onClick={()=>{void load().then(d=>{setData(d);setConsent(false);setError('');}).catch(e=>setError(e.message));}}>Reload record</button></p>}
 {!data&&!error&&<p>Loading publication status…</p>}
 {data&&!record&&<p>No reviewed outcome is awaiting your approval.</p>}
 {record&&<><p className="font-semibold">Publication status: {record.status.replaceAll('_',' ')}</p><MarketOutcomeView record={record.public}/>{record.status==='published'&&<p><a className="underline" href={`/sase/shortlist/outcomes/${record.public.id}/`}>View public outcome</a></p>}</>}
 {data?.staff&&<div className="mt-4 space-y-4">
 {record?.status!=='published'&&<button disabled={busy} className={button} onClick={()=>void act('draft')}>{record?'Refresh draft from project evidence (resets approval)':'Prepare draft from project evidence'}</button>}
 {record&&record.status!=='published'&&<form key={record.revision} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void act('review',{content:{scope:f.get('scope'),summary:f.get('summary'),outcome:f.get('outcome')},redaction_reviewed:f.get('reviewed')==='on'});}}><fieldset disabled={busy} className="space-y-3"><label className="block">Public scope<textarea name="scope" defaultValue={record.public.scope} required minLength={10} maxLength={800} className="block w-full rounded border p-3"/></label><label className="block">Outcome stage<select name="outcome" defaultValue={record.public.outcome} className="block rounded border p-3">{['proposals_received','evaluation_completed','contract_awarded','incomplete','declined','no_proposals','withdrawn'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label><label className="block">What Netify accomplished<textarea name="summary" defaultValue={record.public.summary} required minLength={20} maxLength={1600} className="block w-full rounded border p-3"/></label>
 <details><summary>Private evidence references — never published</summary><ul>{record.evidence_references?.map((x,i)=><li key={i} className="break-all">{x}</li>)}</ul></details>
 <label className="block"><input type="checkbox" name="reviewed" required/> I checked every claim against the project evidence and reviewed identification risk across the whole record. No names, exact locations, dates, prices, proposal extracts or identifying details remain.</label><button className={button}>Save reviewed version for buyer approval</button><p className="text-sm">Any edit clears previous approval. The buyer reviews this in their private project; no email is sent automatically.</p></fieldset></form>}
 {record?.status==='approved'&&<button disabled={busy} className={button} onClick={()=>void act('publish')}>Publish buyer-approved version</button>}
 </div>}
 {!data?.staff&&record?.status==='awaiting_buyer'&&<div className="my-4 space-y-3"><label className="block"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{' '}{OUTCOME_CONSENT}</label><button className={button} disabled={busy||!consent} onClick={()=>void act('approve',{consent:OUTCOME_CONSENT})}>Approve this exact record</button>{' '}<button className="underline" disabled={busy} onClick={()=>void act('decline')}>Decline publication</button></div>}
 {record&&['approved','published','awaiting_buyer'].includes(record.status)&&<button className="mt-4 underline" disabled={busy} onClick={()=>void act('withdraw')}>Withdraw publication permission</button>}
 </section>;
}
