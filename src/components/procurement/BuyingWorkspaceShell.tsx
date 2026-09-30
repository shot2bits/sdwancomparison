"use client";
import { SOURCING_DESCRIPTION } from "@/lib/sourcing-contract";
import ReleaseVersion from "@/components/ReleaseVersion";
import { fireNetifyEvent } from "@/components/NetifyEvents";

import {startNewBuyingProject} from './DraftRecovery';
import { useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
const BuyerAssistant = dynamic(() => import('./BuyerAssistant'), { loading: () => <p role="status">Loading workspace tools…</p> });
import { MEGA_GROUPS } from '@/lib/nav';
import { PublicationBenefits } from './PublicationBenefits';

const CircuitPricing = dynamic(() => import('./CircuitPricing'), { loading: () => <p role="status">Loading circuit pricing…</p> });
type View = 'circuits' | 'project' | 'compare' | 'responses' | 'tools' | 'memories' | 'skills';
const resources = [
  ['Provider directory', '/marketplace/', 'Explore vendor and managed service provider profiles.'],
  ['Cost & TCO', '/sase/cost-estimator/', 'Cost assumptions are being checked before estimates are offered here.'],
  ['Security assessment', '/sase/security-sourcing/', 'A dedicated security assessment is being prepared. You can include security needs in your project brief now.'],
  ['Market insights', '/sase/demand/', 'Read market research and demand signals.'],
  ['Question bank', '/sase/rfp-builder/questions/', 'Explore the governed supplier question bank.'],
  ['Connections', '/sase/connector/', 'Read the setup guide for connecting an approved AI assistant.'],
  ['My projects & account', '/sase/account/', 'Reopen saved projects and manage your identity.'],
  ['Supplier workspace', '/sase/supplier/', 'For suppliers: sign in to manage opportunities and responses.'],
  ['Help & methodology', '/sase/how-it-works/', 'Understand the buying process and publication.'],
] as const;

const comingSoon = (href: string) => ['/sase/cost-estimator/', '/sase/security-sourcing/'].includes(href);
function ResourceCard({name, href, description}: {name: string; href: string; description?: string}) {
  if (comingSoon(href)) return <div className="nf-buying-coming-soon" aria-label={`${name}: Coming soon`}><strong>{name}</strong><span className="nf-buying-status">Coming soon</span><p>{description}</p></div>;
  return <a href={href}><strong>{name}</strong><span>{description}</span></a>;
}

/** Presentation only: keep the engine mounted across research navigation. */
export default function BuyingWorkspaceShell({ children, comparison, information, assistantEnabled = false, initialView = 'project' }: { children: ReactNode; comparison: ReactNode; information: ReactNode; assistantEnabled?: boolean; initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [circuitVisited,setCircuitVisited]=useState(initialView==='circuits');
  useEffect(()=>{const frame=requestAnimationFrame(()=>{if(new URLSearchParams(window.location.search).has('request')){setView('circuits');setCircuitVisited(true)}});return()=>cancelAnimationFrame(frame)},[]);
  const [assistantVisited, setAssistantVisited] = useState(false);
  const [assistantMode, setAssistantMode] = useState<'memories' | 'skills'>('memories');
  const [format, setFormat] = useState('brief');
  useEffect(() => { fireNetifyEvent('marketplace_builder_viewed', { intent: 'project' }); }, []);
  useEffect(() => {
    const update = (event: Event) => setFormat((event as CustomEvent<{format: string}>).detail.format);
    window.addEventListener('netify:workspace-presentation', update);
    return () => window.removeEventListener('netify:workspace-presentation', update);
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(()=>{const open=()=>setView('project');window.addEventListener('netify:open-brief',open);return()=>window.removeEventListener('netify:open-brief',open);},[]);
  function navigate(next: View) { if(next==='circuits')setCircuitVisited(true); if (next === 'memories' || next === 'skills') { setAssistantVisited(true); setAssistantMode(next); } setView(next); setMenuOpen(false); }
  async function projectTool(action: string) {
    const detail: { action: string; pending?: Promise<void> } = { action };
    window.dispatchEvent(new CustomEvent('netify:prepare-workspace-action', { detail }));
    try { await detail.pending; } catch { return; }
    navigate('project');
    window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('netify:workspace-action', { detail: action })));
  }
  return <div className="nf-buying-shell" data-view={view} data-collapsed={collapsed}>
    <aside className="nf-buying-sidebar" data-open={menuOpen}>
      <a href="/sase/home/" className="nf-buying-wordmark" aria-label="Netify home">netify<sup>®</sup></a>
      <button className="nf-buying-new" onClick={()=>{try{startNewBuyingProject()}catch{window.alert("Your draft could not be archived. Nothing was deleted.");}}}>＋ New project</button><div className="nf-buying-project-label"><span>Workspace</span><strong>SASE &amp; SD-WAN procurement</strong></div>
      <nav aria-label="Buying workspace">
        <button onClick={() => navigate('project')} aria-current={view === 'project' ? 'page' : undefined}><span aria-hidden="true">▤</span>My project</button>
        <button onClick={() => projectTool('review')}><span aria-hidden="true">◷</span>Review &amp; publish</button>
        <button onClick={() => navigate('responses')} aria-current={view === 'responses' ? 'page' : undefined}><span aria-hidden="true">▱</span>Responses</button>
      </nav>
      <details className="nf-buying-more-navigation">
        <summary>Research &amp; other tools</summary>
        <nav aria-label="Research and workspace tools" className="nf-buying-secondary">
          <button onClick={() => navigate('circuits')} aria-current={view === 'circuits' ? 'page' : undefined}><span aria-hidden="true">⇆</span>Circuit pricing</button>
          <button onClick={() => navigate('compare')} aria-current={view === 'compare' ? 'page' : undefined}><span aria-hidden="true">⇄</span>Compare known providers</button>
          <a href="/sase/opportunities/board/"><span aria-hidden="true">▦</span>Opportunity board</a>
          {assistantEnabled && <><button onClick={() => navigate('memories')} aria-current={view === 'memories' ? 'page' : undefined}><span aria-hidden="true">◇</span>Memories</button><button onClick={() => navigate('skills')} aria-current={view === 'skills' ? 'page' : undefined}><span aria-hidden="true">✦</span>Skills</button></>}
          <button onClick={() => navigate('tools')} aria-current={view === 'tools' ? 'page' : undefined}><span aria-hidden="true">⊞</span>All tools</button>
          <a href="/sase/connector/"><span aria-hidden="true">⌘</span>Connections</a>
          <button onClick={() => projectTool('settings')}><span aria-hidden="true">⚙</span>Settings</button>
        </nav>
      </details>
      <button className="nf-buying-collapse" aria-label={collapsed ? "Expand workspace menu" : "Collapse workspace menu"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "→" : "← Collapse menu"}</button><div className="nf-buying-privacy"><strong>Your identity stays private</strong><p>You review and approve what suppliers receive.</p><a href="/sase/account/">My projects &amp; account →</a></div>
    </aside>
    <div className="nf-buying-body">
      <header className="nf-buying-topbar"><button className="nf-buying-menu" aria-label="Toggle workspace navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button><a className="nf-buying-mobile-logo" href="/sase/home/" aria-label="Netify home">netify<sup>®</sup></a><span className="nf-buying-breadcrumb">Workspace <b>/</b> {view === 'circuits' ? 'Circuit pricing' : view === 'project' ? 'My project' : view === 'compare' ? 'Compare providers' : view === 'responses' ? 'Supplier responses' : view === 'memories' ? 'Memories' : view === 'skills' ? 'Skills' : 'All tools'}</span><ReleaseVersion /><a href="/sase/account/">My account</a></header>
      <div className="nf-buying-page">
        {assistantEnabled && assistantVisited && <div hidden={view !== 'memories' && view !== 'skills'}><BuyerAssistant mode={assistantMode} onCompare={() => navigate('compare')} onProject={() => navigate('project')} /></div>}
        <div hidden={view !== 'circuits'}>{circuitVisited && <CircuitPricing />}</div>
        <div hidden={view !== 'project'} className="nf-buying-engine"><section className="nf-buying-start" aria-label="Ways to start your project"><h1>Build your SASE or SD-WAN requirements and find suitable providers.</h1><p>{SOURCING_DESCRIPTION}</p><PublicationBenefits compact /><nav aria-label="Start your buying journey"><button type="button" aria-pressed={format === 'brief'} onClick={() => { fireNetifyEvent('marketplace_journey_started', { intent: 'project' }); projectTool('brief'); }}>Describe my project</button><button type="button" aria-pressed={format === 'import'} onClick={() => { fireNetifyEvent('marketplace_journey_started', { intent: 'project' }); projectTool('import'); }}>Upload my existing RFP</button><button type="button" aria-pressed={format === 'detailed-rfp'} onClick={() => { fireNetifyEvent('marketplace_journey_started', { intent: 'project' }); projectTool('detailed-rfp'); }}>Build a detailed RFP</button></nav><p className="nf-buying-subtle">A brief is enough to publish. A full RFP is optional. Publishing is free and does not commit you to buy.</p></section>{children}</div>
        <section hidden={view !== 'compare'} aria-label="Public provider comparison" className="nf-buying-research"><p className="nf-buying-eyebrow">Public research</p><h1>Compare SASE &amp; SD-WAN providers</h1><p>Explore capability differences. Turn your research into an anonymous project when you are ready.</p>{comparison}</section>
        <section hidden={view !== 'responses'} className="nf-buying-responses"><p className="nf-buying-eyebrow">Supplier responses</p><h1>Bring every response together</h1><p>Open your published project to review supplier submissions, evidence, pricing and clarifications.</p><a className="nf-buying-primary" href="/sase/account/">Open my saved projects →</a><button onClick={() => projectTool('responses')}>View this project’s responses</button><p className="nf-buying-subtle">{SOURCING_DESCRIPTION}</p></section>
        <section hidden={view !== 'tools'} className="nf-buying-tools"><p className="nf-buying-eyebrow">Buying tools</p><h1>All tools</h1><p>Project controls, research and account tools. Options marked Coming soon are not available yet.</p><div className="nf-buying-tool-grid">
          <button onClick={() => projectTool('requirements')}><strong>Edit requirements</strong><span>Open your requirement editor. Choose Short or Detailed RFP there if you need supplier questions.</span></button>
          <button onClick={() => projectTool('review')}><strong>Review my project</strong><span>Review your basic brief or RFP using the format you have chosen. Nothing is published automatically.</span></button>
          <button onClick={() => projectTool('tools')}><strong>Project tools</strong><span>{SOURCING_DESCRIPTION}</span></button>
          {resources.map(([name, href, description]) => <ResourceCard key={href} name={name} href={href} description={description} />)}
        </div><details className="nf-buying-more-tools"><summary>More research, sector guides &amp; services</summary>{MEGA_GROUPS.map(group => <section key={group.label}><h2>{group.label}</h2><div className="nf-buying-tool-grid">{group.items.map(item => <ResourceCard key={item.href} name={item.label} href={item.href} description={item.desc} />)}{group.footerLink && <a href={group.footerLink.href}><strong>{group.footerLink.label}</strong></a>}</div></section>)}</details></section>
      </div>
      <details className="nf-buying-information"><summary>SASE &amp; SD-WAN buying guide</summary><div className="nf-buying-guide-content">{information}</div></details>
    </div>
  </div>;
}
