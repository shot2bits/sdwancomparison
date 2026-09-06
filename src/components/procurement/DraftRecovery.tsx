'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {PROJECT_DRAFT_KEY, buyingPlatformPath} from '@/lib/buying-entry';
const POINTER='netify_living_rfp_active_draft_v1';
const PREFIX='netify_living_rfp_draft_v1_';
const ARCHIVE='netify_living_rfp_archives_v1';
type Saved={id:string;label:string;updatedAt:number};
function describe(id:string):Saved|null {try{const p=JSON.parse(localStorage.getItem(PREFIX+id)||'null');if(!p?.facts)return null;const active=p.facts.filter((f:{struck:boolean})=>!f.struck);const sector=active.find((f:{path:string})=>f.path==='organisation.sector')?.value;const sites=active.find((f:{path:string})=>f.path==='estate.sites')?.value;return{id,label:[sector,sites?`${sites} sites`:null].filter(Boolean).join(' · ')||'Saved buying project',updatedAt:p.updatedAt};}catch{return null}}
function archiveCurrentBuyingDraft(){
  const detail={error:''};window.dispatchEvent(new CustomEvent('netify:flush-draft',{detail}));if(detail.error)throw Error(detail.error);
  const id=localStorage.getItem(POINTER);
  if(id){const parsed=JSON.parse(localStorage.getItem(ARCHIVE)||'[]');const list=Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==='string'):[];localStorage.setItem(ARCHIVE,JSON.stringify([...new Set([id,...list])].slice(0,30)));}
}
export function startNewBuyingProject(){
  archiveCurrentBuyingDraft();
  localStorage.removeItem(POINTER);localStorage.removeItem(PROJECT_DRAFT_KEY);
  location.assign(buyingPlatformPath());
}
function resumeArchivedBuyingDraft(id:string){
  archiveCurrentBuyingDraft();
  localStorage.setItem(POINTER,id);localStorage.removeItem(PROJECT_DRAFT_KEY);
  location.assign(buyingPlatformPath());
}
export default function DraftRecovery({children}:{children:ReactNode}){
  const [loaded,setLoaded]=useState(false);const [saved,setSaved]=useState<Saved|null>(null);const [archives,setArchives]=useState<Saved[]>([]);const [error,setError]=useState('');
  useEffect(()=>{queueMicrotask(()=>{try{const params=new URLSearchParams(location.search);if(!params.has('id')&&!params.has('project')){const id=localStorage.getItem(POINTER);if(id)setSaved(describe(id));}setArchives((JSON.parse(localStorage.getItem(ARCHIVE)||'[]') as string[]).map(describe).filter((x):x is Saved=>!!x));}catch{setError('Saved drafts could not be read. Your browser storage may be unavailable.');}setLoaded(true);});},[]);
  if(!loaded)return <p role="status">Loading your buying workspace…</p>;
  if(saved)return <section className="nf-draft-recovery"><h2>Continue your saved project?</h2><p>{saved.label}</p><p>Last saved {new Date(saved.updatedAt).toLocaleString('en-GB')}. Choose whether to resume it or start a separate project.</p><button onClick={()=>setSaved(null)}>Resume saved project</button><button onClick={()=>{try{startNewBuyingProject()}catch{setError('Could not archive this draft. Nothing has been deleted.');}}}>Start a new project</button>{error&&<p role="alert">{error}</p>}</section>;
  return <>{error&&<p role="alert">{error}</p>}{children}{archives.length>0&&<details className="nf-draft-archives"><summary>Archived drafts on this device</summary>{archives.map(p=><button key={p.id} onClick={()=>{try{resumeArchivedBuyingDraft(p.id)}catch(reason){setError(reason instanceof Error?reason.message:'Could not preserve this draft. Nothing was deleted.')}}}>{p.label} · {new Date(p.updatedAt).toLocaleDateString('en-GB')}</button>)}</details>}</>;
}
