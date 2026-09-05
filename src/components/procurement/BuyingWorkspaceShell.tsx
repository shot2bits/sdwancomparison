"use client";

import { useState, type ReactNode } from 'react';

type View = 'project' | 'compare' | 'responses' | 'tools';
const resources = [
  ['Provider directory', '/sase/vendors/', 'Explore vendor and managed service provider profiles.'],
  ['Cost & TCO', '/sase/cost-estimator/', 'Model indicative costs and contract assumptions.'],
  ['Security assessment', '/sase/security-sourcing/', 'Review security and compliance requirements.'],
  ['Market insights', '/sase/demand/', 'Read market research and demand signals.'],
  ['Question bank', '/sase/rfp-builder/questions/', 'Explore the governed supplier question bank.'],
  ['Connections', '/sase/connector/', 'Connect an approved AI agent through MCP.'],
  ['My projects & account', '/sase/account/', 'Reopen saved projects and manage your identity.'],
  ['Supplier workspace', '/sase/supplier/', 'Manage supplier opportunities and responses.'],
  ['Help & methodology', '/sase/how-it-works/', 'Understand the buying process and publication.'],
] as const;

/** Presentation only: keep the engine mounted across research navigation. */
export default function BuyingWorkspaceShell({ children, comparison, information }: { children: ReactNode; comparison: ReactNode; information: ReactNode }) {
  const [view, setView] = useState<View>('project');
  const [menuOpen, setMenuOpen] = useState(false);
  function navigate(next: View) { setView(next); setMenuOpen(false); }
  function projectTool(action: string) {
    navigate('project');
    window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('netify:workspace-action', { detail: action })));
  }
  return <div className="nf-buying-shell" data-view={view}>
    <aside className="nf-buying-sidebar" data-open={menuOpen}>
      <a href="/sase/home/" className="nf-buying-wordmark" aria-label="Netify home">netify<sup>®</sup></a>
      <div className="nf-buying-project-label"><span>YOUR WORKSPACE</span><strong>SASE &amp; SD-WAN procurement</strong></div>
      <nav aria-label="Buying workspace">
        <button onClick={() => navigate('project')} aria-current={view === 'project' ? 'page' : undefined}><span aria-hidden="true">▤</span>Project</button>
        <button onClick={() => navigate('compare')} aria-current={view === 'compare' ? 'page' : undefined}><span aria-hidden="true">⇄</span>Compare</button>
        <button onClick={() => navigate('responses')} aria-current={view === 'responses' ? 'page' : undefined}><span aria-hidden="true">▱</span>Responses</button>
        <a href="/sase/opportunities/board/"><span aria-hidden="true">▦</span>Opportunity board</a>
      </nav>
      <nav aria-label="Workspace tools" className="nf-buying-secondary">
        <span>WORKSPACE</span>
        <button onClick={() => navigate('tools')} aria-current={view === 'tools' ? 'page' : undefined}><span aria-hidden="true">⊞</span>All tools</button>
        <a href="/sase/connector/"><span aria-hidden="true">⌘</span>Connections</a>
        <button onClick={() => projectTool('review')}><span aria-hidden="true">◷</span>Activity &amp; review</button>
        <button onClick={() => projectTool('settings')}><span aria-hidden="true">⚙</span>Settings</button>
      </nav>
      <div className="nf-buying-privacy"><strong>Your identity stays private</strong><p>You review and approve what suppliers receive.</p><a href="/sase/account/">My projects &amp; account →</a></div>
    </aside>
    <div className="nf-buying-body">
      <header className="nf-buying-topbar"><button className="nf-buying-menu" aria-label="Toggle workspace navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button><a className="nf-buying-mobile-logo" href="/sase/home/" aria-label="Netify home">netify<sup>®</sup></a><span className="nf-buying-breadcrumb">Workspace <b>/</b> {view === 'project' ? 'My project' : view === 'compare' ? 'Compare providers' : view === 'responses' ? 'Supplier responses' : 'All tools'}</span><a href="/sase/account/">My account</a></header>
      <div className="nf-buying-page">
        <div hidden={view !== 'project'} className="nf-buying-engine">{children}</div>
        <section hidden={view !== 'compare'} aria-label="Public provider comparison" className="nf-buying-research"><p className="nf-buying-eyebrow">PUBLIC RESEARCH</p><h1>Compare SASE &amp; SD-WAN providers</h1><p>Explore capability differences. Turn your research into an anonymous project when you are ready.</p>{comparison}</section>
        <section hidden={view !== 'responses'} className="nf-buying-responses"><p className="nf-buying-eyebrow">SUPPLIER RESPONSES</p><h1>Bring every response together</h1><p>Open your published project to review supplier submissions, evidence, pricing and clarifications.</p><a className="nf-buying-primary" href="/sase/account/">Open my saved projects →</a><button onClick={() => projectTool('responses')}>View this project’s responses</button><p className="nf-buying-subtle">Still preparing your project? Publish your anonymous brief to invite responses. A full RFP is optional.</p></section>
        <section hidden={view !== 'tools'} className="nf-buying-tools"><p className="nf-buying-eyebrow">YOUR CONNECTED BUYING PLATFORM</p><h1>All tools</h1><p>Every stage of your buying journey, available when you need it.</p><div className="nf-buying-tool-grid">
          <button onClick={() => projectTool('requirements')}><strong>Requirements &amp; full RFP</strong><span>Eight sections, imports, voice, validation, recommended and bespoke questions.</span></button>
          <button onClick={() => projectTool('review')}><strong>Supplier pack &amp; project review</strong><span>Review requirements, decisions, architecture and provenance.</span></button>
          <button onClick={() => projectTool('tools')}><strong>Project tools</strong><span>Suppliers, evidence, reports and exports, with publication access controls.</span></button>
          {resources.map(([name, href, description]) => <a key={href} href={href}><strong>{name}</strong><span>{description}</span></a>)}
        </div></section>
      </div>
      <details className="nf-buying-information"><summary>About Netify · SASE and SD-WAN buying guidance</summary>{information}</details>
    </div>
  </div>;
}
