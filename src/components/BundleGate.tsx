'use client';
import {useEffect,useRef,useState} from 'react';

export const TOKEN_KEY='netify_buyer_token';
export type Published={opportunity_id:string;notice_url:string;company_shown_publicly:boolean}|null;
type Props={requirement:Record<string,unknown>;onVerified:(token:string,published:Published)=>void;onClose?:()=>void;intro?:string};

/** Work email, publish consent and a separate company opt-in, then a one-time code. Used before any RFP or provider-pack download. */
export default function BundleGate({requirement,onVerified,onClose,intro}:Props){
 const [step,setStep]=useState<'details'|'code'>('details'),[email,setEmail]=useState(''),[consent,setConsent]=useState(false),[show,setShow]=useState(false),[company,setCompany]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 const started=useRef(0),honeypot=useRef<HTMLInputElement>(null);
 useEffect(()=>{started.current=Date.now();},[]);
 async function post(path:string,body:unknown){const r=await fetch('/sase/api/access/'+path+'/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.message??data.error??'Something went wrong. Please try again.');return data;}
 async function send(e:React.FormEvent){e.preventDefault();setError('');if(!consent){setError('To download, tick the agreement to list your requirement with curated vendors and providers, and on the public board.');return;}setBusy(true);
  try{const d=await post('request',{email,requirement,consent_publish:true,show_company:show,company_name:show?company:undefined,honeypot:honeypot.current?.value??'',elapsed_ms:Date.now()-started.current});setNote(d.preview_code?'Preview only: your code is '+d.preview_code+'.':'We have emailed you a six digit code. It expires in 15 minutes.');setStep('code');}
  catch(err){setError(err instanceof Error?err.message:'Please try again.');}finally{setBusy(false);}}
 async function verify(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);
  try{const d=await post('verify',{email,code});try{sessionStorage.setItem(TOKEN_KEY,d.access_token);}catch{/* storage unavailable */}onVerified(d.access_token,d.published??null);}
  catch(err){setError(err instanceof Error?err.message:'That code did not work.');}finally{setBusy(false);}}
 const field='mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';
 return (
  <div role="dialog" aria-modal="true" aria-labelledby="bundle-gate-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
   <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 text-slate-900 shadow-xl">
    <h2 id="bundle-gate-title" className="text-lg font-semibold">Download your RFP and recommended providers</h2>
    <p className="mt-2 text-sm text-slate-700">{intro??'Everything else on the marketplace stays open. Downloading needs a work email, your agreement to publish, and an actual publish of the requirement. Netify then lists it privately with curated vendors and providers. The public board shows it without your company name unless you choose otherwise.'}</p>
    {step==='details'?(
     <form onSubmit={send} className="mt-4 space-y-3">
      <label className="block text-sm font-medium">Work email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={field} placeholder="name@yourcompany.com"/></label>
      <p className="text-xs text-slate-600">Free email such as Gmail, Outlook, Hotmail, Yahoo or iCloud cannot be used.</p>
      <div aria-hidden="true" style={{position:'absolute',left:'-9999px'}}><label>Leave this empty<input ref={honeypot} tabIndex={-1} autoComplete="off"/></label></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1"/><span>I agree that Netify may list this requirement privately with the marketplace&apos;s curated vendors and providers, and show it on the public opportunity board without my company name. A work email and this agreement are required before I can download the RFP and recommended-providers pack.</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} className="mt-1"/><span>Also show my company name on the public board (optional). Naming your company reaches a wider audience of providers and vendors you may not have considered.</span></label>
      {show&&<label className="block text-sm font-medium">Company name to show<input value={company} maxLength={120} required onChange={e=>setCompany(e.target.value)} className={field}/></label>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2"><button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy?'Sending…':'Email me a code'}</button>{onClose&&<button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm">Cancel</button>}</div>
     </form>
    ):(
     <form onSubmit={verify} className="mt-4 space-y-3">
      <p className="text-sm" role="status">{note}</p>
      <label className="block text-sm font-medium">Six digit code<input inputMode="numeric" autoComplete="one-time-code" required pattern="\d{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className={field}/></label>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2"><button disabled={busy||code.length!==6} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy?'Checking…':'Verify and download'}</button><button type="button" onClick={()=>{setStep('details');setCode('');setError('');}} className="rounded border border-slate-300 px-4 py-2 text-sm">Back</button></div>
     </form>
    )}
   </div>
  </div>
 );
}
