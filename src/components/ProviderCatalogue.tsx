import React from 'react';
import approvedProfiles from '@data/shortlist-buyer-profiles.json';
import type { PublishedProvider } from '@/lib/sector-comparison';
import { originalBuyerChecklist } from '@/lib/original-buyer-checklist';
import { comparisonSlugForGovernedProvider } from '@/lib/governed-provider-catalogue';
import { primaryResearchFor } from '@/lib/shortlist-primary-research';

const sections = [
  ['products', 'Products and delivery'], ['service_models', 'Management and operations'],
  ['sector_evidence', 'Sector experience'], ['case_studies', 'Customer deployments'],
  ['capabilities', 'Network and security features'], ['geographies', 'Geographic coverage'],
  ['compliance', 'Compliance and assurance'], ['integrations', 'Integrations'],
  ['evaluations', 'Buyer fit and implementation'], ['evidence_sources', 'Sources and review dates'],
] as const;
const label = (s: string) => s.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const text = (v: unknown) => typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v ?? '');
const safeLink = (v: string) => { try { return ['https:', 'http:'].includes(new URL(v).protocol); } catch { return false; } };
const profileFor = (record: PublishedProvider) => approvedProfiles.profiles.find(p => p.slug === comparisonSlugForGovernedProvider(record.provider.slug));

/** Pure server component: every source row is real HTML, with no fetch on expand. */
export default function ProviderCatalogue({ providers }: { providers: PublishedProvider[] }) {
  const sorted = [...providers].sort((a, b) => (profileFor(a)?.name ?? a.provider.display_name).localeCompare(profileFor(b)?.name ?? b.provider.display_name, 'en-GB'));
  return <section id="pf-catalogue" aria-labelledby="pf-catalogue-title">
    <div className="pf-section-head"><div><p className="pf-kicker">Provider research</p><h2 id="pf-catalogue-title">{sorted.length} researched providers</h2></div><p>Technology vendors, carriers &amp; managed services</p></div>
    <div className="pf-filters" data-pf-enhanced hidden><label>Find a provider<input type="search" id="pf-provider-search" placeholder="Provider name, product or sector" /></label><label>Provider type<select id="pf-provider-type"><option value="">All provider types</option>{[...new Set(sorted.flatMap(p => p.provider.provider_types ?? []))].sort().map(t => <option key={t} value={t}>{label(t)}</option>)}</select></label><button type="button" data-pf-clear>Clear filters</button></div>
    <p id="pf-results-status" role="status">Showing all {sorted.length} providers. Alphabetical order. Add sector and sites for a comparison against your requirements.</p>
    <div className="pf-table-wrap"><table className="pf-table"><caption className="pf-sr">Provider products, management and evidence. This catalogue is not a personalised ranking.</caption><thead><tr><th scope="col">Provider</th><th scope="col">Products and platform</th><th scope="col">Delivery and management</th><th scope="col">Evidence</th></tr></thead><tbody>{sorted.map(record => {
      const profile = profileFor(record);
      return <tr key={record.provider.slug} data-pf-row={record.provider.slug} data-pf-types={(record.provider.provider_types ?? []).join('|')} data-pf-sectors={record.sector_evidence.map(row => text(row.sector ?? row.sector_code ?? row.sector_name)).join(' ')}>
        <th scope="row"><a href={`#pf-provider-${record.provider.slug}`} data-pf-profile={record.provider.slug}>{profile?.name ?? record.provider.display_name}</a><small>{profile?.role ?? (record.provider.provider_types ?? []).map(label).join(' / ')}</small></th>
        <td>{profile ? profile.products.join(' · ') : <a href={`#pf-provider-${record.provider.slug}`}>Products and delivery</a>}</td>
        <td>{profile?.management ?? <a href={`#pf-provider-${record.provider.slug}`}>Management and operations</a>}</td>
        <td><a href={`#pf-provider-${record.provider.slug}`} data-pf-profile={record.provider.slug}>View research ↗</a><small>Reviewed {record.revision.reviewed_at?.slice(0, 10) || 'Requires confirmation'}</small></td>
      </tr>;
    })}</tbody></table></div>
    <p className="pf-empty" id="pf-no-matches" hidden>No providers match these filters. Clear filters to see the complete catalogue.</p>
    <div className="pf-section-head"><h2>Provider profiles and evidence</h2><div data-pf-enhanced hidden><button type="button" data-pf-expand>Expand profiles</button><button type="button" data-pf-collapse>Collapse profiles</button></div></div>
    {sorted.map(record => {
      const slug = record.provider.slug, profile = profileFor(record);
      const checklist = originalBuyerChecklist(slug, record.revision.dataset_version);
      const primary = primaryResearchFor(slug);
      const covered = new Set<string>(['provider', 'revision', ...sections.map(([key]) => key)]);
      return <details key={slug} id={`pf-provider-${slug}`} className="pf-provider" data-pf-profile-record={slug} tabIndex={-1}>
        <summary><span>{profile?.name ?? record.provider.display_name}</span><small>Products · sector experience · source evidence</small><b aria-hidden="true">+</b></summary>
        <div className="pf-provider-body"><p className="pf-review-date">Reviewed {record.revision.reviewed_at || 'Requires confirmation'} · Record {record.revision.id} · Dataset {record.revision.dataset_version}</p>
          {profile && <><p>{profile.management}</p><div className="pf-approved-facts">{profile.facts.map((f, i) => <section key={i}><h4>{f.label}</h4><p>{f.value}</p>{f.qualification && <p>{f.qualification}</p>}<a href={f.url} target="_blank" rel="noopener noreferrer">{f.locator || 'Service details'} ↗</a></section>)}</div><h4>Customer deployments</h4>{profile.cases.map((c, i) => <section key={i}><h5>{c.name}</h5><p>{c.outcome}</p><p>{c.qualification}</p>{c.source && <a href={c.source} target="_blank" rel="noopener noreferrer">Customer story ↗</a>}</section>)}</>}
          {primary && <details className="pf-record-section"><summary>Current operating-model and lifecycle checks</summary><p>{primary.summary}</p><p>{primary.models.map(label).join(' · ')}</p>{primary.source_urls.map(url => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></p>)}<p>Source qualifications and original review dates remain below.</p></details>}
          {sections.map(([key, title]) => <details className="pf-record-section" key={key}><summary>{title} ({record[key]?.length ?? 0})</summary>{key === 'sector_evidence' || key === 'case_studies' || key === 'evidence_sources' ? (record[key] ?? []).map((row, i) => <dl key={i}>{Object.entries(row).map(([field, value]) => <div key={field}><dt>{label(field)}</dt><dd>{typeof value === 'string' && safeLink(value) ? <a href={value} target="_blank" rel="noopener noreferrer">{value}</a> : text(value)}</dd></div>)}</dl>) : <pre>{(record[key] ?? []).map(row => Object.entries(row).map(([field, value]) => label(field) + ': ' + text(value)).join('\n\n')).join('\n\n────────\n\n')}</pre>}</details>)}
          <details className="pf-record-section"><summary>Source identity and complete additional fields</summary><pre>{JSON.stringify({ provider: record.provider, revision: record.revision, ...Object.fromEntries(Object.entries(record).filter(([key]) => !covered.has(key))) }, null, 2)}</pre></details>
          {checklist && <details className="pf-record-section"><summary>Harry’s original buyer checklist and current fact checks</summary><p>Checked {checklist.fact_check.checked_at}. {checklist.fact_check.notice}</p>{checklist.fact_check.notes.map((note, i) => <section key={i}><h4>{note.claim}</h4><p>{label(note.status)}</p><p>{note.finding}</p><ul>{note.source_urls.map(url => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul></section>)}<h4>Original wording · historical research</h4>{checklist.paragraphs.map((p, i) => <p key={i}>{p}</p>)}<p>{checklist.source_document} · {checklist.version} · {checklist.source_dataset}</p><p>{checklist.fact_check.scope}</p><p>Source SHA-256: {checklist.source_document_sha256}</p></details>}
          <a href={`https://netify.co.uk/marketplace/${slug}/`} target="_blank" rel="noopener noreferrer">Full provider profile ↗</a>
        </div>
      </details>;
    })}
  </section>;
}
