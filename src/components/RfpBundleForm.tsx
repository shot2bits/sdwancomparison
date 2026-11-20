'use client';
import {useState} from 'react';
import BundleGate,{type Published} from './BundleGate';
import {SECTOR_CHOICES,COMPARISON_REGIONS} from '@/lib/sector-comparison-config';
import {CONTEXT_PRODUCTS} from '@/lib/context-product-catalogue';

const MODELS:[string,string][]=[['undecided','Not yet decided'],['fully_managed','Fully managed'],['co_managed','Co-managed'],['self_managed','We operate it']];
export default function RfpBundleForm(){
 const [sector,setSector]=useState('retail_ecommerce'),[products,setProducts]=useState<string[]>(['sdwan','sse']),[sites,setSites]=useState(10),[users,setUsers]=useState(250),[remote,setRemote]=useState(0),[regions,setRegions]=useState<string[]>(['uk_ireland']),[model,setModel]=useState('undecided'),[outcomes,setOutcomes]=useState('');
 const [gate,setGate]=useState(false),[done,setDone]=useState<{token:string;published:Published}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const toggle=(list:string[],set:(v:string[])=>void,v:string)=>set(list.includes(v)?list.filter(x=>x!==v):[...list,v]);
 const requirement={organisation:{sector},products,sites:{count:Math.max(1,sites),regions:regions.map(r=>COMPARISON_REGIONS.find(x=>x[0]===r)?.[1]??r)},users:{count:Math.max(1,users),remote:Math.max(0,remote)},desired_outcomes:outcomes.slice(0,2000),operating_model:model};
 function start(e:React.FormEvent){e.preventDefault();setError('');if(!products.length){setError('Choose at least one service.');return;}setGate(true);}
 async function get(format:'markdown'|'docx'){if(!done?.published)return;setBusy(format);setError('');
  try{const r=await fetch('/sase/api/bundle/',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+done.token},body:JSON.stringify({opportunity_id:done.published.opportunity_id,format})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.message??d.error??'Download failed.');}
   const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='netify-rfp-and-recommended-providers.'+(format==='docx'?'docx':'md');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(err){setError(err instanceof Error?err.message:'Download failed.');}finally{setBusy('');}}
 const input='mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';
 return (
  <div>
   {done?(
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5" role="status">
     <h2 className="text-lg font-semibold">Your bundle is ready</h2>
     {done.published&&<p className="mt-2 text-sm">Your requirement is listed privately with Netify&apos;s curated vendors and providers{done.published.company_shown_publicly?' and your company name is shown on the public board':', and the public board shows it without your company name'}. <a className="underline" href={done.published.notice_url.replace('https://netify.co.uk','')}>View the public notice</a>.</p>}
     <div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void get('markdown')} disabled={!!busy} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">{busy==='markdown'?'Preparing…':'Download Markdown'}</button><button onClick={()=>void get('docx')} disabled={!!busy} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">{busy==='docx'?'Preparing…':'Download Word document'}</button></div>
     {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
   ):(
    <form onSubmit={start} className="space-y-5">
     <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">Sector<select value={sector} onChange={e=>setSector(e.target.value)} className={input}>{SECTOR_CHOICES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}<option value="other">Other</option></select></label>
      <label className="block text-sm font-medium">Who operates the service?<select value={model} onChange={e=>setModel(e.target.value)} className={input}>{MODELS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="block text-sm font-medium">Sites<input type="number" min={1} max={100000} value={sites} onChange={e=>setSites(Number(e.target.value))} className={input}/></label>
      <label className="block text-sm font-medium">Users<input type="number" min={1} max={1000000} value={users} onChange={e=>setUsers(Number(e.target.value))} className={input}/></label>
      <label className="block text-sm font-medium">Of which remote<input type="number" min={0} max={1000000} value={remote} onChange={e=>setRemote(Number(e.target.value))} className={input}/></label>
     </div>
     <fieldset><legend className="text-sm font-medium">Services you need</legend><div className="mt-2 grid gap-1 sm:grid-cols-2">{CONTEXT_PRODUCTS.map(p=><label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={products.includes(p.id)} onChange={()=>toggle(products,setProducts,p.id)}/>{p.label}</label>)}</div></fieldset>
     <fieldset><legend className="text-sm font-medium">Where you need service</legend><div className="mt-2 flex flex-wrap gap-3">{COMPARISON_REGIONS.map(([id,label])=><label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={regions.includes(id)} onChange={()=>toggle(regions,setRegions,id)}/>{label}</label>)}</div></fieldset>
     <label className="block text-sm font-medium">What do you want to achieve? (optional)<textarea value={outcomes} maxLength={2000} rows={4} onChange={e=>setOutcomes(e.target.value)} className={input} placeholder="This stays private unless you choose to show your company. The public board shows only the sector, products, sites, users and region."/></label>
     {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
     <button className="rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">Get my RFP and recommended providers</button>
    </form>
   )}
   {gate&&!done&&<BundleGate requirement={requirement} onClose={()=>setGate(false)} onVerified={(token,published)=>{setGate(false);setDone({token,published});}}/>}
  </div>
 );
}
