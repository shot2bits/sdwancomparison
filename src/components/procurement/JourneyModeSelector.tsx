"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PROJECT_JOURNEY_MODES, type ProjectJourneyMode } from '@/lib/rfp-types';
import { PROJECT_ENTRANCE_CONTRACT_VERSION, type ProjectEntranceContext } from '@/lib/project-entrance-contract';
import { MARKETPLACE_PUBLICATION_CONSENT_TEXT, MARKETPLACE_PUBLICATION_CONSENT_VERSION, quickListingReadiness } from '@/lib/publication-policy';
import { REGION_KEYS, REGION_LABELS, SECTOR_KEYS, SECTOR_LABELS } from '@/lib/shortlist-core';
import { buyingPlatformPath, COMPARISON_PROJECT_DRAFT_KEY, PROJECT_DRAFT_KEY, projectTokenKey } from '@/lib/buying-entry';
import SignIn from '@/components/SignIn';
import styles from './JourneyModeSelector.module.css';

type Fields = { scope: string; sector: string; sites: string; regions: string[]; operatingModel: string; outcome: string; timescale: string; company: string; requiredFeatures: string[] };
const EMPTY: Fields = { scope: 'sase', sector: '', sites: '', regions: ['uk_ireland'], operatingModel: 'any', outcome: '', timescale: '', company: '', requiredFeatures: [] };
type Project = { project_reference: string; revision: number };
const inputClass = 'mt-1 block w-full rounded border border-[#cfc8bf] bg-white p-2 text-sm font-normal';

export default function JourneyModeSelector({ children }: { children?: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<ProjectJourneyMode>('quick_list');
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [project, setProject] = useState<Project | null>(null);
  const [entrance, setEntrance] = useState<ProjectEntranceContext | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [published, setPublished] = useState(false);
  const [coverage, setCoverage] = useState<number | null>(null);
  const inFlight = useRef(false);
  const mode = useRef<ProjectJourneyMode>('quick_list');
  function setField<K extends keyof Fields>(key: K, value: Fields[K]) { setFields((old) => ({ ...old, [key]: value })); }

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const params = new URLSearchParams(location.search);
        const requested = params.get('journey') as ProjectJourneyMode;
        const chosen = params.has('id') || params.has('q') ? 'build_rfp' : PROJECT_JOURNEY_MODES.includes(requested) ? requested : 'quick_list';
        mode.current = chosen; setSelected(chosen); setResuming(params.has('id'));
        const id = params.get('project');
        if (id || params.get('from') === 'comparison') setPanelOpen(true);
        const fragment = new URLSearchParams(location.hash.slice(1));
        const incoming = fragment.get('project_session');
        if (id && incoming) {
          localStorage.setItem(projectTokenKey(id), incoming);
          history.replaceState(history.state, '', location.pathname + location.search);
        }
        if (id) {
          const token = localStorage.getItem(projectTokenKey(id));
          if (!token) throw new Error('Open this project on the browser where you started it, or use your assistant’s private resume link.');
          const response = await fetch(`/sase/api/marketplace/projects/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
          const data = await response.json();
          if (!response.ok) throw new Error('This private project session has expired or is unavailable. Your saved project has not been deleted.');
          if (!active) return;
          const raw = data.entrance_context?.raw_input ?? {}, buyer = data.buyer;
          setFields({ scope: raw.solution_scope ?? (buyer.product_scope === 'sdwan_only' ? 'sdwan' : buyer.product_scope === 'sse_only' ? 'sse' : 'sase'), sector: buyer.sector ?? '', sites: buyer.site_count == null ? '' : String(buyer.site_count), regions: buyer.regions, operatingModel: buyer.operating_model, outcome: buyer.notes, timescale: raw.timescale ?? '', company: buyer.organisation, requiredFeatures: raw.shortlist?.required_features ?? data.entrance_context?.shortlist_input?.required_features ?? [] });
          setEntrance(data.entrance_context ?? null); setProject({ project_reference: id, revision: data.revision });
          setPrepared(data.prepared); setReview(true);
          setPublished(data.marketplace_state?.publication_status === 'published' && data.marketplace_state?.market_unlock_status === 'unlocked');
          mode.current = data.mode === 'find_providers' ? 'find_providers' : 'quick_list'; setSelected(mode.current);
        } else if (!params.has('id') && !params.has('q')) {
          const handoff = params.get('from') === 'comparison' ? sessionStorage.getItem(COMPARISON_PROJECT_DRAFT_KEY) : null;
          if (handoff) {
            const context = JSON.parse(handoff) as ProjectEntranceContext;
            setEntrance(context);
            const buyer = context.buyer_input;
            setFields({ ...EMPTY, outcome: context.requirement_text, sector: context.sector ?? '', regions: Array.isArray(buyer.regions) && buyer.regions.length ? buyer.regions as string[] : EMPTY.regions, operatingModel: String(buyer.operating_model ?? 'any'), requiredFeatures: (context.shortlist_input?.required_features as string[]) ?? [] });
          } else {
            const cached = localStorage.getItem(PROJECT_DRAFT_KEY);
            if (cached) setFields({ ...EMPTY, ...JSON.parse(cached) });
          }
        }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Could not restore the project.'); }
      finally { if (active) setReady(true); }
    }
    void restore();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready || project) return;
    try { localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(fields)); } catch { /* Saving on the server reports storage errors separately. */ }
  }, [fields, ready, project]);
  useEffect(() => {
    const refresh = () => { void fetch('/sase/api/auth/session', { cache: 'no-store' }).then((r) => r.json()).then((s) => setSignedIn(Boolean(s.authenticated && ['buyer', 'netify'].includes(s.role)))).catch(() => {}); };
    refresh(); window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !ready) return;
    if (panelOpen && !dialog.open) dialog.showModal();
    if (!panelOpen && dialog.open) dialog.close();
    if (!panelOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [panelOpen, ready]);

  function choose(next: ProjectJourneyMode) {
    mode.current = next; setSelected(next);
    const url = new URL(location.href); url.searchParams.set('journey', next);
    history.replaceState(history.state, '', url);
    setPanelOpen(true);
  }
  async function request(path: string, body: unknown, method = 'POST', current = project) {
    const token = current ? localStorage.getItem(projectTokenKey(current.project_reference)) : null;
    if (current && !token) throw new Error('Your private session is unavailable. Reload to recover your project.');
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'The request did not complete. Your project is still saved.');
    return data;
  }
  async function action(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'The request did not complete.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function saveForReview() {
    await action(async () => {
      const readiness = quickListingReadiness({ solutionScope: fields.scope, sector: fields.sector, siteCount: Number(fields.sites), regions: fields.regions, operatingModel: fields.operatingModel, outcome: fields.outcome, timescale: fields.timescale });
      if (!readiness.allowed || !Number.isSafeInteger(Number(fields.sites))) throw new Error(`Please complete: ${readiness.reasons.join(', ') || 'a whole-number site count'}.`);
      if (fields.company.trim().length < 2) throw new Error('Enter your company name. It stays private.');
      // Fail before creating if this browser cannot retain its private recovery credential.
      localStorage.setItem('netify_storage_check', '1'); localStorage.removeItem('netify_storage_check');
      const buyer = { ...(entrance?.buyer_input ?? {}), organisation: fields.company.trim(), sector: fields.sector, site_count: Number(fields.sites), regions: fields.regions, operating_model: fields.operatingModel, product_scope: fields.scope === 'sdwan' ? 'sdwan_only' : fields.scope === 'sse' ? 'sse_only' : 'full_sase', notes: fields.outcome.trim(), pinned_vendors: [] };
      const shortlist = { ...(entrance?.shortlist_input ?? {}), required_features: fields.requiredFeatures };
      const raw = { ...(entrance?.raw_input ?? {}), shortlist, solution_scope: fields.scope, outcome: fields.outcome.trim(), timescale: fields.timescale.trim() };
      let saved: Project;
      if (project) saved = await request(`/sase/api/marketplace/projects/${encodeURIComponent(project.project_reference)}`, { base_revision: project.revision, idempotency_key: crypto.randomUUID(), buyer_patch: buyer, raw_input: raw }, 'PATCH');
      else {
        const context = { version: PROJECT_ENTRANCE_CONTRACT_VERSION, source: entrance?.source ?? 'rfp_builder', source_url: entrance?.source_url ?? location.href, captured_at: entrance?.captured_at ?? Date.now(), requirement_text: fields.outcome.trim(), sector: fields.sector, marketplace_slug: null, vendor_slugs: [], buyer_input: buyer, shortlist_input: shortlist, raw_input: raw };
        const data = await request('/sase/api/marketplace/projects', { mode: selected, entrance_context: context });
        localStorage.setItem(projectTokenKey(data.project_reference), data.project_session_token);
        saved = { project_reference: data.project_reference, revision: data.revision };
      }
      setProject(saved); setReview(true); setPrepared(false); setConsent(false); setCoverage(null);
      const url = new URL(location.href); url.searchParams.set('project', saved.project_reference); url.searchParams.delete('from');
      history.replaceState(history.state, '', url);
      localStorage.removeItem(PROJECT_DRAFT_KEY);
    });
  }
  async function publish() {
    if (!project || !consent) return;
    await action(async () => {
      let current = project;
      if (!prepared) {
        const data = await request(`/sase/api/marketplace/projects/${encodeURIComponent(current.project_reference)}/prepare-publication`, { base_revision: current.revision, consent_version: MARKETPLACE_PUBLICATION_CONSENT_VERSION, consent_text: MARKETPLACE_PUBLICATION_CONSENT_TEXT });
        current = { ...current, revision: data.revision }; setProject(current); setPrepared(true);
      }
      if (!signedIn) return;
      const data = await request(`/sase/api/marketplace/projects/${encodeURIComponent(current.project_reference)}/publish`, { base_revision: current.revision, consent_version: MARKETPLACE_PUBLICATION_CONSENT_VERSION, consent_text: MARKETPLACE_PUBLICATION_CONSENT_TEXT }, 'POST', current);
      if (!data.ok || !data.market_unlocked || !data.opportunity_id) throw new Error('The board listing is not complete. Please retry.');
      setPublished(true);
    });
  }
  async function previewCoverage() {
    if (!project) return;
    await action(async () => {
      const data = await request(`/sase/api/marketplace/projects/${encodeURIComponent(project.project_reference)}/match-preview`, { base_revision: project.revision, input: { mandatory_capabilities: fields.requiredFeatures, preferred_capabilities: [], required_regions: fields.regions, service_model: fields.operatingModel === 'managed' ? 'fully_managed' : fields.operatingModel === 'any' ? null : fields.operatingModel === 'diy' ? 'self_managed' : fields.operatingModel, sector: fields.sector, provider_scope: 'both' } });
      setProject({ ...project, revision: data.revision }); setCoverage(data.preview.meets_all_mandatory_count);
    });
  }
  return <>
    {!resuming && <div className={styles.toolbar}>
      <div><strong>Your buying workspace</strong><span>Build your requirements here, or publish a short brief.</span></div>
      <button type="button" disabled={!ready} onClick={() => choose(selected === 'find_providers' ? 'find_providers' : 'quick_list')}>
        {project ? 'Return to my project brief' : 'Publish a short brief'} <span aria-hidden="true">↗</span>
      </button>
    </div>}
    {ready && children}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="brief-panel-title" onCancel={() => setPanelOpen(false)} onClose={() => setPanelOpen(false)}>
      <header className={styles.panelHeader}><span>NETIFY · PROJECT BRIEF</span><button type="button" onClick={() => setPanelOpen(false)} aria-label="Close project brief">Close <span aria-hidden="true">×</span></button></header>
      <div className={styles.panelBody}>
          <h2 id="brief-panel-title" className="text-xl font-semibold">{published ? 'Your project is published' : review ? 'Review your anonymous project notice' : 'Publish a short project brief'}</h2>
          <p className="mt-2 text-sm text-[#66635e]">Describe what you need, review the anonymous notice, then verify your work email to publish. A full RFP is optional.</p>
          {error && <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {!ready ? <p className="mt-4" role="status">Loading your project…</p> : published && project ? <div className="mt-5"><p>Your board listing is live. Supplier responses and pricing will appear as providers reply.</p><a className="mt-4 inline-block rounded bg-[#b64b16] px-5 py-3 font-semibold text-white" href={buyingPlatformPath(`id=${encodeURIComponent(project.project_reference)}`)}>Open my matches and responses</a></div> : review ? <>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2"><div><dt className="font-semibold">Scope</dt><dd>{fields.scope.toUpperCase()} · {fields.sites} sites</dd></div><div><dt className="font-semibold">Sector</dt><dd>{SECTOR_LABELS[fields.sector as keyof typeof SECTOR_LABELS] ?? fields.sector}</dd></div><div><dt className="font-semibold">Regions</dt><dd>{fields.regions.map((r) => REGION_LABELS[r as keyof typeof REGION_LABELS] ?? r).join(', ')}</dd></div><div><dt className="font-semibold">Timescale</dt><dd>{fields.timescale}</dd></div><div className="sm:col-span-2"><dt className="font-semibold">Requirement</dt><dd className="whitespace-pre-wrap">{fields.outcome}</dd></div></dl>
            <p className="mt-4 text-sm">Your company name and contact details are private. Remove identifying information from the requirement before publishing.</p>
            <button type="button" disabled={busy} onClick={() => { setReview(false); setConsent(false); }} className="mt-3 text-sm underline">Edit project details</button>
            {selected === 'find_providers' && coverage === null && <button type="button" disabled={busy} onClick={previewCoverage} className="ml-4 text-sm underline">Check market coverage</button>}
            {coverage !== null && <p className="mt-3 text-sm">{coverage} providers meet the filters checked so far. This is market coverage, not confirmation of every requirement. Personalised matches unlock after publication.</p>}
            <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} className="mt-1"/><span>{MARKETPLACE_PUBLICATION_CONSENT_TEXT}</span></label>
            {prepared && !signedIn && <div className="mt-4"><SignIn role="buyer" prompt="Verify your work email, then return here to publish. Your company stays private." onAuthed={() => setSignedIn(true)} /></div>}
            <button type="button" disabled={busy || !consent} onClick={publish} className="mt-5 rounded-full bg-[#b64b16] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : signedIn ? 'Publish my project and unlock providers' : 'Verify work email to publish'}</button>
          </> : <form className="mt-5" onSubmit={(e) => { e.preventDefault(); void saveForReview(); }}>
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Solution<select className={inputClass} value={fields.scope} onChange={(e) => setField('scope', e.target.value)}><option value="sase">SASE (networking and security)</option><option value="sdwan">SD-WAN</option><option value="sse">SSE</option></select></label>
              <label className="text-sm font-semibold">Sector<select required className={inputClass} value={fields.sector} onChange={(e) => setField('sector', e.target.value)}><option value="">Choose sector</option>{SECTOR_KEYS.map((s) => <option key={s} value={s}>{SECTOR_LABELS[s]}</option>)}</select></label>
              <label className="text-sm font-semibold">Number of sites<input required type="number" min="1" step="1" className={inputClass} value={fields.sites} onChange={(e) => setField('sites', e.target.value)}/></label>
              <label className="text-sm font-semibold">Operating model<select className={inputClass} value={fields.operatingModel} onChange={(e) => setField('operatingModel', e.target.value)}><option value="any">Not decided</option><option value="managed">Fully managed</option><option value="co_managed">Co-managed</option><option value="diy">Self-managed</option></select></label>
              <label className="text-sm font-semibold">Buying timescale<input required maxLength={200} placeholder="e.g. within six months" className={inputClass} value={fields.timescale} onChange={(e) => setField('timescale', e.target.value)}/></label>
              <label className="text-sm font-semibold">Company name (private)<input required minLength={2} maxLength={200} autoComplete="organization" className={inputClass} value={fields.company} onChange={(e) => setField('company', e.target.value)}/></label>
              <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-semibold">Regions to cover</legend><div className="flex flex-wrap gap-3">{REGION_KEYS.map((r) => <label key={r} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.regions.includes(r)} onChange={(e) => setField('regions', e.target.checked ? [...fields.regions, r] : fields.regions.filter((v) => v !== r))}/>{REGION_LABELS[r]}</label>)}</div></fieldset>
              <details className="sm:col-span-2"><summary className="cursor-pointer text-sm font-semibold">Required capabilities (optional)</summary><p className="my-2 text-xs">Select only essentials. These filters determine your personalised matches; other details in your brief are for suppliers to confirm.</p><div className="grid gap-2 sm:grid-cols-2">{[
                ['f30_zero_trust_network_access', 'Zero Trust Network Access'], ['f31_secure_web_gateway', 'Secure web gateway'], ['f32_casb_capability', 'CASB'], ['f33_data_loss_prevention', 'Data loss prevention'], ['f16_mpls_coexistence_and_migration', 'MPLS migration'], ['f17_cellular_and_5g_support', 'Cellular and 5G'], ['f25_high_availability_design', 'High availability'], ['f28_full_sase_platform', 'Full SASE platform'],
              ].map(([id, label]) => <label key={id} className="flex gap-2 text-sm"><input type="checkbox" checked={fields.requiredFeatures.includes(id)} onChange={(e) => setField('requiredFeatures', e.target.checked ? [...fields.requiredFeatures, id] : fields.requiredFeatures.filter((v) => v !== id))}/>{label}</label>)}</div></details>
              <label className="text-sm font-semibold sm:col-span-2">What do you need to achieve?<textarea required minLength={20} maxLength={4000} rows={4} placeholder="Describe your sites, users, security needs and what should improve. Leave out your company name and contact details." className={inputClass} value={fields.outcome} onChange={(e) => setField('outcome', e.target.value)}/></label>
            </fieldset>
            <button disabled={busy} className="mt-5 rounded-full bg-[#b64b16] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Review my project'}</button>
            <p className="mt-3 text-xs text-[#66635e]">Nothing is published until you verify your work email and approve the notice.</p>
          </form>}
      </div>
    </dialog>
  </>;
}
