'use client';
import {useCallback,useEffect,useState} from 'react';

type Msg={from:string;name:string;body:string;at:number;state?:string};
type View={role:'provider'|'team';thread:{id:string;title:string;provider?:string|null;kind?:string;buyer_email?:string;status:string};messages:Msg[]};

export default function ThreadRoom({id}:{id:string}){
 const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[text,setText]=useState(''),[busy,setBusy]=useState(false),[relinked,setRelinked]=useState(false);
 const load=useCallback(async()=>{
  const r=await fetch(`/sase/api/thread/${id}/`,{cache:'no-store'});const j=await r.json();
  if(!r.ok){setError(j.error==='thread_access_required'?'Your session has ended. Open the link in your email again, or ask for a new link below.':'This conversation is not available.');return;}
  setError('');setView(j);
 },[id]);
 useEffect(()=>{let live=true;fetch(`/sase/api/thread/${id}/`,{cache:'no-store'}).then(async r=>({ok:r.ok,j:await r.json()})).then(({ok,j})=>{if(!live)return;if(!ok){setError(j.error==='thread_access_required'?'Your session has ended. Open the link in your email again, or ask for a new link below.':'This conversation is not available.');return;}setView(j);}).catch(()=>{if(live)setError('This conversation is not available.');});return()=>{live=false;};},[id]);
 async function send(){
  setBusy(true);setError('');
  const r=await fetch(`/sase/api/thread/${id}/`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:text})});const j=await r.json();
  setBusy(false);if(!r.ok){setError(j.message??'Your message could not be sent.');return;}
  setText('');await load();
 }
 async function relink(){await fetch('/sase/api/thread/relink/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({thread_id:id})});setRelinked(true);}
 if(!view)return (
  <div className="rounded border border-slate-300 bg-white p-5">
   <p role="alert" className="text-slate-700">{error||'Loading'}</p>
   {error&&<div className="mt-3">{relinked?<p className="text-sm text-slate-700">If the provider contact on record can receive email, a new link is on its way.</p>:<button onClick={relink} className="rounded border border-slate-400 px-3 py-1.5 text-sm">Email me a new link</button>}</div>}
  </div>
 );
 const open=view.thread.status==='open';
 return (
  <div className="rounded border border-slate-300 bg-white p-5">
   <h2 className="text-xl font-semibold">{view.thread.title}</h2>
   <p className="mt-1 text-sm text-slate-600">{view.role==='team'?`Netify team view. Buyer ${view.thread.buyer_email??''}${view.thread.provider?`, provider ${view.thread.provider}`:''}.`:'Conversation with the buyer. They see your replies. Netify may join this conversation.'}</p>
   <ol className="mt-4 space-y-3" aria-label="Messages">
    {view.messages.map((m,i)=>(
     <li key={i} className={`rounded p-3 text-sm ${m.from==='system'?'bg-slate-50 text-slate-500':m.from==='buyer'?'bg-slate-100':'bg-blue-50'}`}>
      <p className="font-medium">{m.name} <span className="font-normal text-slate-500">{new Date(m.at).toLocaleString('en-GB',{timeZone:'Europe/London'})}{m.state&&m.state!=='sent'?` (${m.state==='held'?'held, not sent to the provider':m.state})`:''}</span></p>
      <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
     </li>))}
   </ol>
   {open?<div className="mt-4">
    <label className="block text-sm font-medium" htmlFor="reply">{view.role==='team'?'Reply as the Netify team':'Your reply'}</label>
    <textarea id="reply" value={text} maxLength={4000} rows={4} onChange={e=>setText(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2"/>
    <button onClick={send} disabled={busy||!text.trim()} className="mt-2 rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{busy?'Sending':'Send reply'}</button>
   </div>:<p className="mt-4 text-sm text-slate-600">This conversation is closed.</p>}
   {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>
 );
}
