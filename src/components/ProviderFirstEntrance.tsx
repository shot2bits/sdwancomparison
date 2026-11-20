import React from 'react';
import ProviderCatalogue from './ProviderCatalogue';
import { COMMISSION_DESCRIPTION } from '@/lib/sourcing-contract';
import { SECTOR_PROFILES } from '@/lib/sector-profiles';
import type { PublishedProvider } from '@/lib/sector-comparison';

/** Local-only entrance. Public evidence, never buyer state, is rendered here. */
export default function ProviderFirstEntrance({ providers, unavailable = [] }: { providers: PublishedProvider[]; unavailable?: string[] }) {
  return <div id="provider-first-entrance" className="pf">
    <header className="pf-brand-bar"><a href="#provider-first-entrance" className="pf-brand"><b>N</b> Netify</a><span>Private local preview</span><a href="#location-studio" data-pf-stage="open">Open project ↗</a></header>
    <section className="pf-hero"><p className="pf-kicker">SD-WAN &amp; SASE · Provider comparison</p><h1>Compare SD-WAN and SASE providers by sector</h1><p className="pf-lead">Compare the products and the services around them.</p><p>Start with your sector. Explore without an account.</p><a className="pf-primary" href="#location-studio" data-pf-stage="business">Add sector and sites <span aria-hidden="true">↗</span></a><p className="pf-disclosure">{COMMISSION_DESCRIPTION}</p><p className="pf-local-note">Local preview: shortlisting and RFP drafting are connected. Publication and supplier responses are not enabled.</p></section>
    <nav className="pf-journey" aria-label="Your comparison journey"><a href="#location-studio" data-pf-stage="business"><span>01</span> Add sector and sites</a><a href="#location-studio" data-pf-stage="providers"><span>02</span> Compare providers</a><a href="#ns-living-rfp" data-pf-stage="rfp"><span>03</span> Create RFP</a><a href="#pf-catalogue" data-pf-stage="catalogue" className="pf-back">Provider catalogue ↑</a></nav>
    {unavailable.length > 0 && <p role="alert">Research could not be loaded for: {unavailable.join(', ')}. This catalogue is incomplete. Rebuild before making a decision.</p>}
    <ProviderCatalogue providers={providers} />
    <nav className="pf-sectors" aria-label="Existing sector comparisons"><h2>Sector comparisons</h2>{Object.entries(SECTOR_PROFILES).map(([id, profile]) => <a key={id} href={'https://netify.co.uk' + profile.source_url}>{id.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())} ↗</a>)}</nav>
    <p className="pf-method"><a href="https://netify.co.uk/sase/shortlist/research-methodology/">Read the research methodology ↗</a></p>
    <noscript><p>The complete public research above works without JavaScript. The local interactive map and RFP require JavaScript.</p></noscript>
  </div>;
}
