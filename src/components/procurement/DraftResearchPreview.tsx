'use client';
import { useEffect, useRef, useState } from 'react';
import type { BriefFields } from '@/lib/buying-workspace-project';
import { fireNetifyEvent } from '@/components/NetifyEvents';
type Result = {matches:{slug:string;name:string;gaps:string[]}[];count:number;sectorUnconfirmed:number;source?:string};
export default function DraftResearchPreview({fields}:{fields:Partial<BriefFields>}) {
  const [result,setResult]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);
  const params = new URLSearchParams({scope:fields.scope ?? '',regions:(fields.regions ?? []).join(','),sector:fields.sector ?? '',model:fields.operatingModel ?? 'any',features:(fields.requiredFeatures ?? []).join(',')}).toString();
  // Changing filters cancels the old request and removes its results immediately.
  const [resultKey,setResultKey]=useState('');
  useEffect(()=>()=>controller.current?.abort(),[params]);
  const current = resultKey === params ? result : null;
  async function research() {
    controller.current?.abort();
    const request = new AbortController();controller.current=request;
    setBusy(true);setError('');setResult(null);
    try {
      const r=await fetch('/sase/api/rfp/research-preview/?'+params,{signal:request.signal});
      const data=await r.json();
      if(!r.ok)throw new Error();
      if(request.signal.aborted)return;
      setResult(data);setResultKey(params);
      fireNetifyEvent('rfp_research_preview',{status:data.count?'ready':'empty'});
    } catch {if(!request.signal.aborted){setError('Provider research is unavailable. Your draft is still here. Try again.');fireNetifyEvent('rfp_research_preview',{status:'failed'});}}
    finally {if(controller.current===request)setBusy(false);}
  }
  return <section className="nf-draft-research" aria-label="Private provider research"><h3>Check provider evidence</h3><p>Research is free. No company name, account or publication required. This checks your solution category, selected regions, operating model, sector and required capabilities, not every detail in your document.</p><button type="button" disabled={busy||!fields.scope||!fields.regions?.length} onClick={research}>{busy?'Checking evidence…':'Preview providers for my requirements'}</button>{(!fields.scope||!fields.regions?.length)&&<p>Choose a solution and regions to check provider evidence.</p>}{error&&<p role="alert">{error}</p>}{current&&<div role="status"><p>{current.count ? `${current.count} providers meet the research filters checked.` : 'No providers meet every research filter. This may reflect missing evidence.'}{current.sectorUnconfirmed>0&&` ${current.sectorUnconfirmed} other providers meet the filters except for unconfirmed sector evidence.`}</p><ul>{current.matches.map(v=><li key={v.slug}><a href={'/sase/vendors/'+v.slug+'/'}>{v.name}</a>{v.gaps.length>0&&<span> · {v.gaps.join('; ')}</span>}</li>)}</ul>{current.source==='snapshot_fallback'&&<p>Using the last reviewed evidence snapshot. Current availability still needs confirmation.</p>}<p>These are research candidates. Confirm delivery, suitability and pricing before requesting responses. No supplier has been contacted.</p></div>}<a href="/sase/shortlist/" target="_blank" rel="noopener noreferrer">Explore the full directory and choose supplier requests</a></section>;
}
