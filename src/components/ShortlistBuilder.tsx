"use client";

import { UK_BUYING_SITUATIONS, getUKBuyingSituation, withUKBuyingContext } from '@/lib/uk-shortlist';
import ComparisonAnswer from './ComparisonAnswer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CompareTable from '@/components/CompareTable';
import { buildComparison, decodeScenario, type ShortlistVendor } from '@/lib/shortlist-core';
import { parseComparisonHandoff, applyComparisonHandoff } from '@/lib/comparison-handoff';
import { PROJECT_ENTRANCE_CONTRACT_VERSION } from '@/lib/project-entrance-contract';
import {requestBrief} from '@/lib/buying-workspace-project';
import { buyingPlatformPath, COMPARISON_PROJECT_DRAFT_KEY } from '@/lib/buying-entry';
import { fireNetifyEvent } from '@/components/NetifyEvents';
import type { ShortlistMarketView } from '@/lib/shortlist-market-views';

type Props = { vendors: ShortlistVendor[]; features: { id: string; name: string; category: string; description?: string }[]; initialView?: ShortlistMarketView; ukBuyerGuidance?: boolean };

/** Public factual comparison. Project-specific matching is provided by the published project. */
export default function ShortlistBuilder({ vendors, features, ukBuyerGuidance = false }: Props) {
  const search = useSearchParams();
  const handoff = useMemo(() => parseComparisonHandoff(search.toString(), vendors.map((v) => v.slug)), [search, vendors]);
  const [selected, setSelected] = useState<string[]>(() => [handoff.providers[0] ?? '', handoff.providers[1] ?? '', handoff.providers[2] ?? '']);
  const [question, setQuestion] = useState(handoff.question);
  const [requirement, setRequirement] = useState('');
  const situationFromUrl = ukBuyerGuidance ? getUKBuyingSituation(search.get('uk_situation'))?.id ?? '' : '';
  const [situation, setSituation] = useState<string>(situationFromUrl);
  const appliedHandoff = useRef(JSON.stringify({ handoff, situationFromUrl }));
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { queueMicrotask(() => setReady(true)); }, []);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const signature = JSON.stringify({ handoff, situationFromUrl });
    if (appliedHandoff.current === signature) return;
    appliedHandoff.current = signature;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSelected([handoff.providers[0] ?? '', handoff.providers[1] ?? '', handoff.providers[2] ?? '']);
      setQuestion(handoff.question); setSituation(situationFromUrl); setAnswer(''); setCopied(false);
    });
    return () => { active = false; };
  }, [handoff, situationFromUrl]);
  const slugs = selected.filter(Boolean);
  const comparison = useMemo(() => buildComparison(vendors, selected.filter(Boolean), features), [vendors, selected, features]);
  function choose(index: number, slug: string) {
    setSelected((current) => current.some((value, i) => i !== index && slug && value === slug) ? current : current.map((value, i) => i === index ? slug : value));
    setAnswer(''); setCopied(false);
  }
  async function copyComparison() {
    try {
      const params = applyComparisonHandoff(new URLSearchParams(), { providers: slugs, question, source: 'shared-comparison' });
      if (situation) params.set('uk_situation', situation);
      await navigator.clipboard.writeText(`${location.origin}/sase/shortlist/?${params}#comparison-workspace`);
      setCopied(true);
    } catch { setError('The link could not be copied. You can still continue with your project.'); }
  }
  function startProject(capturedAt: number) {
    try {
      const scenario = decodeScenario(search.toString(), features.map((f) => f.id));
      const requirementText = withUKBuyingContext(requirement, situation);
      // Compared providers are research context, never automatic supplier invitations.
      const entrance = {
        version: PROJECT_ENTRANCE_CONTRACT_VERSION, source: 'shortlist', source_url: location.href,
        captured_at: capturedAt, requirement_text: requirementText, sector: scenario.sector,
        marketplace_slug: null, vendor_slugs: [],
        buyer_input: { sector: scenario.sector, regions: scenario.required_regions, operating_model: scenario.service_model, pinned_vendors: [] },
        shortlist_input: scenario,
        raw_input: { compared_vendor_slugs: slugs, comparison_question: question, shortlist: scenario, requirement_text: requirementText },
      };
      sessionStorage.setItem(COMPARISON_PROJECT_DRAFT_KEY, JSON.stringify(entrance));
      fireNetifyEvent('comparison_start_project', { provider_count: String(slugs.length) });
      if(!requestBrief('find_providers'))location.assign(buyingPlatformPath('journey=find_providers&from=comparison'));
    } catch { setError('This browser could not save your comparison. Enable browser storage to carry your selections into a project.'); }
  }
  async function ask() {
    if (busy || !comparison || !question.trim()) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/sase/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: withUKBuyingContext(question, situation) }], comparison_slugs: slugs }) });
      const data = await response.json();
      if (!response.ok) throw new Error('The AI explanation is unavailable. The evidence comparison below still works.');
      setAnswer(data.narrative ?? 'See the capability evidence below.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the explanation.'); }
    finally { setBusy(false); }
  }
  return <section id="comparison-workspace" className="my-6 rounded-xl border border-zinc-300 bg-white p-5 text-zinc-900 md:p-8" aria-labelledby="comparison-title">
    <h2 id="comparison-title" className="text-2xl font-semibold">{ukBuyerGuidance ? "SD-WAN and SASE provider comparison for UK IT teams" : "Compare SD-WAN and SASE providers"}</h2>
    <p className="mt-2 text-sm text-zinc-600">Compare two or three named vendors and service providers across {features.length} capabilities. Public evidence is free to explore; personalised matching unlocks when you publish a project.</p>
    {ukBuyerGuidance && <fieldset className="mt-5 rounded-lg border border-slate-200 p-4" aria-describedby="uk-situation-help">
      <legend className="px-1 text-base font-semibold">Where will you use the service?</legend>
      <p id="uk-situation-help" className="text-sm text-slate-600">Choose a buying situation to guide your questions. All providers remain available to compare; site coverage and suitability need confirmation.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">{UK_BUYING_SITUATIONS.map((item) => <label key={item.id} className={`cursor-pointer rounded-lg border p-3 ${situation === item.id ? 'border-slate-800 bg-slate-100' : 'border-slate-200 bg-white'}`}>
        <span className="flex items-start gap-2"><input type="radio" name="uk-buying-situation" value={item.id} disabled={!ready} checked={situation === item.id} onChange={() => { setSituation(item.id); setAnswer(''); setCopied(false); fireNetifyEvent('shortlist_situation_select'); }} className="mt-1 shrink-0" /><span className="text-sm font-semibold">{item.label}</span></span>
        <span className="mt-2 block text-sm leading-6 text-slate-700">{item.guidance}</span>
      </label>)}</div>
      {situation && <button type="button" onClick={() => { setSituation(''); setAnswer(''); setCopied(false); }} className="mt-3 text-sm underline">Clear buying situation</button>}
    </fieldset>}
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((index) => <label key={index} className="text-sm font-semibold">Provider {index + 1}{index === 2 ? ' (optional)' : ''}<select disabled={!ready} aria-label={`Provider ${index + 1}`} value={selected[index]} onChange={(e) => choose(index, e.target.value)} className="mt-2 block w-full rounded border border-zinc-300 bg-white p-3 font-normal"><option value="">Choose a provider</option>{vendors.map((v) => <option key={v.slug} value={v.slug} disabled={selected.some((slug, i) => i !== index && slug === v.slug)}>{v.name}</option>)}</select></label>)}</div>
    {slugs.length > 0 && <dl className="mt-3 grid gap-3 sm:grid-cols-3" aria-label="Selected provider roles">{slugs.map((slug) => { const provider = vendors.find((v) => v.slug === slug)!; return <div key={slug} className="rounded border border-zinc-200 p-3 text-sm"><dt className="font-semibold">{provider.name}</dt><dd className="mt-1">{provider.category}</dd>{provider.product_focus && <dd className="mt-1 text-zinc-600">Technology: {provider.product_focus}</dd>}</div>; })}</dl>}
    {comparison && <>
      <div className="mt-4 flex flex-wrap gap-4"><a href="#comparison-table" className="font-semibold underline">Compare every feature across your selected providers</a><button type="button" onClick={copyComparison} className="text-sm underline">{copied ? 'Link copied' : 'Copy comparison link'}</button></div>
      <form className="mt-5" onSubmit={(e) => { e.preventDefault(); void ask(); }}><label htmlFor="comparison-question" className="text-sm font-semibold">Ask about the comparison</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="comparison-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder="How do their security capabilities differ?" className="min-w-0 flex-1 rounded border border-zinc-300 p-3"/><button disabled={busy || !question.trim()} className="rounded bg-zinc-900 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Reading evidence…' : 'Ask Netify AI'}</button></div></form>
      {answer && <ComparisonAnswer text={answer} />}
    </>}
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-lg font-semibold">Which providers fit your project?</h3>
      <p className="mt-2 text-sm">Ask Netify to source proposals against your requirements. Start with a short brief, review the public notice and verify your work email and company before publishing. Supplier participation is developing; responses and prices are not guaranteed. A full RFP is optional.</p>
      {situation && <p className="mt-3 text-sm" role="status">Buying situation carried into your draft: <strong>{getUKBuyingSituation(situation)?.label}</strong>.</p>}
      <label className="mt-3 block text-sm font-semibold">Your requirement (optional)<textarea value={requirement} onChange={(e) => setRequirement(e.target.value)} maxLength={4000} rows={2} placeholder="What does your business need?" className="mt-2 block w-full rounded border border-slate-200 bg-white p-3 font-normal"/></label>
      <p className="mt-3 text-sm text-slate-600">Your selected providers, comparison question and stated requirements travel with your draft as research context. They do not invite suppliers or publish anything.</p>
      <button type="button" onClick={() => startProject(Date.now())} className="mt-4 rounded-full bg-[#233849] text-white px-5 py-3 font-semibold">Get proposals for my project</button>
      <p className="mt-2 text-xs">Your selections travel with you. Nothing is published without your approval.</p>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {comparison && <div id="comparison-table" className="mt-8"><h3 className="mb-3 text-lg font-semibold">Public capability comparison</h3><CompareTable comparison={comparison}/><div className="mt-4 flex flex-wrap gap-4">{slugs.map((slug) => { const v = vendors.find((provider) => provider.slug === slug)!; return <a key={slug} href={v.marketplace_url || `/sase/vendors/${slug}/`} className="text-sm underline">{v.name}: evidence and sources</a>; })}</div><button type="button" onClick={() => startProject(Date.now())} className="mt-5 rounded-full bg-[#233849] text-white px-5 py-3 font-semibold">Get proposals for my project</button></div>}
  </section>;
}
