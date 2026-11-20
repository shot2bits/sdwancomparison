'use client';
import {useState,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';

const subscribe=(cb:()=>void)=>{window.addEventListener('hashchange',cb);return()=>window.removeEventListener('hashchange',cb);};

/** The one-time token travels in the URL fragment, so mail scanners and server logs never see it. */
export default function ThreadOpen(){
 const token=useSyncExternalStore(subscribe,()=>window.location.hash.replace(/^#/,''),()=>''),router=useRouter();
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function open(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/sase/api/thread/exchange/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});
   const j=await r.json();
   if(!r.ok){setError(j.message??'This link cannot be used. It may have been used already or have expired.');setBusy(false);return;}
   window.history.replaceState(null,'',window.location.pathname);
   router.push('/thread/'+j.thread_id+'/');
  }catch{setError('Something went wrong. Please try again.');setBusy(false);}
 }
 return (
  <div className="rounded border border-slate-300 bg-white p-5">
   {token?<>
    <p className="text-slate-700">A buyer has sent you a message on Netify. Open the conversation to read it and reply. You do not need an account.</p>
    <button onClick={open} disabled={busy} className="mt-4 rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{busy?'Opening':'Open the conversation'}</button>
   </>:<p className="text-slate-700">This page needs the link from your email. Open the link in the email again.</p>}
   {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>
 );
}
