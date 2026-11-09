'use client';
import {useEffect,useState} from 'react';
import SignIn from '@/components/SignIn';
import ProcurementHeader from './ProcurementHeader';
import {studioJson} from './useStudioProject';
type Row={id:string;title:string;published:boolean;studio:boolean;updated:number};
export default function StudioProjects(){
 const [rows,setRows]=useState<Row[]|null>(null),[error,setError]=useState('');
 async function load(){try{setRows((await studioJson<{rfps:Row[]}>('/sase/api/rfp/mine/')).rfps);setError('')}catch(e){setRows(null);setError((e as Error).message)}}
 useEffect(()=>{let active=true;studioJson<{rfps:Row[]}>("/sase/api/rfp/mine/").then(d=>{if(active){setRows(d.rfps);setError("")}}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[]);
 return <div className="ns-studio"><ProcurementHeader/><main className="ns-project-list" id="main-content"><h1>My projects</h1><p>All projects saved to your verified account, including earlier detailed workspaces. An unverified draft saved only in a browser is separate until linked to your account.</p><SignIn simple role="buyer" prompt="Use the email that owns your projects." returnTo="/sase/studio/projects/" onAuthed={load} onSignedOut={()=>setRows(null)}/>{error&&<p role="status">{error}</p>}{rows&&<><p>{rows.filter(r=>!r.published).length} drafts · {rows.filter(r=>r.published).length} published projects</p>{rows.length===0?<p>No projects linked to this account yet.</p>:<ul>{rows.map(r=><li key={r.id}><a href={r.studio?`/sase/studio-preview/?project=${encodeURIComponent(r.id)}`:`/sase/rfp-builder/${encodeURIComponent(r.id)}/`}>{r.title}</a><p>{r.published?'Published':'Private draft'} · {r.studio?'Procurement workspace':'Original detailed workspace'} · Updated {new Date(r.updated).toLocaleDateString('en-GB')}</p></li>)}</ul>}</>}</main></div>;
}
