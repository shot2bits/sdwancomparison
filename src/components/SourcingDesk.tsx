'use client';
import MarketOutcomeWorkflow from './MarketOutcomeWorkflow';
import {useEffect,useState,useRef} from 'react';
import type {SourcingBrief} from '@/lib/sourcing-contract';
type Row={id:string;project_id:string;buyer_email:string;brief:SourcingBrief;recipients:{slug:string;actions:string[]}[]};
const stages=['desk_reviewed','supplier_approached','supplier_declined','introduction_acknowledged','comparable_set_ready','buyer_decision'] as const;
async function api(url:string,body?:unknown){const r=await fetch(url,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error??'Unable to load');return d;}
export default function SourcingDesk(){
 const [rows,setRows]=useState<Row[]>([]),[active,setActive]=useState<Row|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [kind,setKind]=useState<'proposal'|'activity'>('proposal');
 const [receipt,setReceipt]=useState('');
 const [scopeHash,setScopeHash]=useState('');
 const selectionVersion=useRef(0);
 const [history,setHistory]=useState<{id:string;stage:string;note:string;occurred_at:string}[]>([]);
 useEffect(()=>{let alive=true;api('/sase/api/sourcing/desk/').then(d=>{if(alive)setRows(d.requests)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false};},[]);
 async function choose(row:Row){const version=++selectionVersion.current;setActive(row);setScopeHash('');setReceipt(crypto.randomUUID());setMessage('');setError('');setHistory([]);try{const [d,p]=await Promise.all([api(`/sase/api/sourcing/projects/${row.project_id}/activity/`),api(`/sase/api/sourcing/projects/${row.project_id}/`)]);if(version!==selectionVersion.current)return;setHistory(d.entries);setScopeHash(p.scope_hash);}catch(e){if(version===selectionVersion.current)setError(e instanceof Error?e.message:'Unable to load activity');}}

 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(!active||busy)return;const form=e.currentTarget;const f=new FormData(form);setBusy(true);setError('');setMessage('');
  try{
   const slug=String(f.get('supplier')??'');const root=`/sase/api/sourcing/projects/${active.project_id}/`;
   if(kind==='proposal'){
    const amount=String(f.get('amount')??'').trim();const answers=JSON.parse(String(f.get('answers')||'{}'));
    await api(root,{id:receipt,scope_hash:scopeHash,vendor_slug:slug,vendor:slug,answers,evidence_url:String(f.get('evidence')),supplier_confirmed:f.get('confirmed')==='on',pricing:{model:String(f.get('model')),amount:amount===''?null:Number(amount),currency:String(f.get('currency')).toUpperCase(),unit_note:String(f.get('basis')),notes:String(f.get('notes'))}});
   }else{
    const stage=String(f.get('stage'));const d=await api(root+'activity/',{id:receipt,stage,supplier_slug:['supplier_approached','supplier_declined','introduction_acknowledged'].includes(stage)?slug:null,evidence_url:String(f.get('evidence')),note:String(f.get('notes')),occurred_at:new Date(String(f.get('date'))).toISOString()});setHistory(d.entries);
   }
   form.reset();setMessage('Recorded on this project. No email or supplier request was sent.');setReceipt(crypto.randomUUID());
  }catch(e){setError(e instanceof Error?e.message:'Unable to record. Keep this form and retry.');}finally{setBusy(false);}
 }
 const field='block w-full rounded border border-slate-300 bg-white p-2';
 return <><h1 className="text-3xl font-semibold">Private sourcing desk</h1><p className="my-3">Record actual proposals and evidenced outcomes. This screen does not send requests or grant supplier access.</p>
 {error&&<p role="alert" className="my-3 text-red-700">{error}</p>}{message&&<p role="status" className="my-3 text-green-800">{message}</p>}
 <div className="grid gap-6 md:grid-cols-[260px_1fr]"><aside aria-label="Confirmed requests">{rows.map(r=><button type="button" key={r.id} disabled={busy} onClick={()=>void choose(r)} className="my-2 block w-full rounded border p-3 text-left" aria-pressed={active?.id===r.id}>{r.buyer_email}<br/>{r.brief.sites} sites · {r.brief.sector??'Sector not set'}</button>)}{!rows.length&&!error&&<p>No confirmed requests to review.</p>}</aside>
 {active&&<section key={active.project_id}><h2 className="text-xl font-semibold">{active.brief.sites} sites · {active.brief.need}</h2><p className="my-3 whitespace-pre-wrap">{active.brief.supplier_brief}</p><p><a className="underline" href={`/sase/rfp-builder/${active.project_id}/`}>Open private project</a> · <a className="underline" href={`/sase/admin/circuit-pricing/?request=${active.project_id}`}>Record connectivity quotes</a></p>
 <label className="my-3 block">Record type<select className={field} value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as typeof kind);setReceipt(crypto.randomUUID());setMessage('');}}><option value="proposal">Written proposal</option><option value="activity">Sourcing outcome</option></select></label>
 <form key={kind} onSubmit={submit} className="space-y-4"><fieldset disabled={busy||!scopeHash} className="space-y-4"><label className="block">Buyer-approved supplier<select name="supplier" className={field} required={kind==='proposal'}><option value="">Select if this is a supplier event</option>{active.recipients.filter(r=>kind==='activity'||r.actions.includes('proposals')).map(r=><option key={r.slug} value={r.slug}>{r.slug}</option>)}</select></label>
 {kind==='proposal'?<><label className="block">Charging model<select name="model" className={field}><option value="total_monthly">Total monthly</option><option value="per_site_monthly">Per site monthly</option><option value="per_user_monthly">Per user monthly</option><option value="one_off">One off</option><option value="indicative">Indicative</option></select></label><label className="block">Amount (leave blank if missing)<input name="amount" type="number" min="0" step="0.01" className={field}/></label><label className="block">Currency<input name="currency" defaultValue="GBP" pattern="[A-Za-z]{3}" required className={field}/></label><label className="block">Comparable charging basis, term and scope<input name="basis" required className={field}/></label><label className="block">Answers by RFP question ID (JSON)<textarea name="answers" defaultValue="{}" className={field}/></label><label className="block"><input name="confirmed" type="checkbox" required/> I have checked that this is a supplier-confirmed written proposal.</label></>:<><label className="block">Actual outcome<select name="stage" className={field}>{stages.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label><label className="block">When it occurred (your local time)<input type="datetime-local" name="date" required className={field}/></label></>}
 <label className="block">Private written evidence link (HTTPS)<input type="url" name="evidence" required pattern="https://.*" className={field}/></label><label className="block">Scope, qualifications and missing information<textarea name="notes" required className={field}/></label><button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">{busy?'Recording…':'Record on this project'}</button></fieldset></form>
 <MarketOutcomeWorkflow key={active.project_id} id={active.project_id}/><h3 className="mt-6 text-lg font-semibold">Recorded sourcing outcomes</h3>{history.map(h=><article key={h.id} className="my-3 border-t pt-3"><strong>{h.stage.replaceAll('_',' ')}</strong><p>{new Date(h.occurred_at).toLocaleString()}</p><p>{h.note}</p></article>)}
 </section>}</div></>;
}
