"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CompareTable from '@/components/CompareTable';
import { buildComparison, decodeScenario, type ShortlistVendor } from '@/lib/shortlist-core';
import { parseComparisonHandoff, applyComparisonHandoff } from '@/lib/comparison-handoff';
import { PROJECT_ENTRANCE_CONTRACT_VERSION } from '@/lib/project-entrance-contract';
import { buyingPlatformPath, COMPARISON_PROJECT_DRAFT_KEY } from '@/lib/buying-entry';
import { fireNetifyEvent } from '@/components/NetifyEvents';
import type { ShortlistMarketView } from '@/lib/shortlist-market-views';

type Props = { vendors: ShortlistVendor[]; features: { id: string; name: string; category: string; description?: string }[]; initialView?: ShortlistMarketView };

/** Public factual comparison. Project-specific matching is provided by the published project. */
export default function ShortlistBuilder({ vendors, features }: Props) {
  const search = useSearchParams();
  const handoff = useMemo(() => parseComparisonHandoff(search.toString(), vendors.map((v) => v.slug)), [search, vendors]);
  const [selected, setSelected] = useState<string[]>(['', '', '']);
  const [question, setQuestion] = useState('');
  const [requirement, setRequirement] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSelected([handoff.providers[0] ?? '', handoff.providers[1] ?? '', handoff.providers[2] ?? '']);
      setQuestion(handoff.question); setAnswer('');
    });
    return () => { active = false; };
  }, [handoff]);
  const slugs = selected.filter(Boolean);
  const comparison = useMemo(() => buildComparison(vendors, selected.filter(Boolean), features), [vendors, selected, features]);
  function choose(index: number, slug: string) {
    setSelected((current) => current.map((value, i) => i === index ? slug : value));
    setAnswer(''); setCopied(false);
  }
  async function copyComparison() {
    try {
      const params = applyComparisonHandoff(new URLSearchParams(), { providers: slugs, question, source: 'shared-comparison' });
      await navigator.clipboard.writeText(`${location.origin}/sase/shortlist/?${params}#comparison-workspace`);
      setCopied(true);
    } catch { setError('The link could not be copied. You can still continue with your project.'); }
  }
  function startProject() {
    try {
      const scenario = decodeScenario(search.toString(), features.map((f) => f.id));
      // Compared providers are research context, never automatic supplier invitations.
      const entrance = {
        version: PROJECT_ENTRANCE_CONTRACT_VERSION, source: 'shortlist', source_url: location.href,
        captured_at: Date.now(), requirement_text: requirement.trim(), sector: scenario.sector,
        marketplace_slug: null, vendor_slugs: [],
        buyer_input: { sector: scenario.sector, regions: scenario.required_regions, operating_model: scenario.service_model, pinned_vendors: [] },
        shortlist_input: scenario,
        raw_input: { compared_vendor_slugs: slugs, comparison_question: question, shortlist: scenario, requirement_text: requirement.trim() },
      };
      sessionStorage.setItem(COMPARISON_PROJECT_DRAFT_KEY, JSON.stringify(entrance));
      fireNetifyEvent('comparison_start_project', { provider_count: String(slugs.length) });
      location.assign(buyingPlatformPath('journey=find_providers&from=comparison'));
    } catch { setError('This browser could not save your comparison. Enable browser storage to carry your selections into a project.'); }
  }
  async function ask() {
    if (busy || !comparison || !question.trim()) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/sase/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: question }], comparison_slugs: slugs }) });
      const data = await response.json();
      if (!response.ok) throw new Error('The AI explanation is unavailable. The evidence comparison below still works.');
      setAnswer(data.narrative ?? 'See the capability evidence below.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the explanation.'); }
    finally { setBusy(false); }
  }
  return <section id="comparison-workspace" className="my-6 rounded-xl border border-zinc-300 bg-white p-5 text-zinc-900 md:p-8" aria-labelledby="comparison-title">
    <h2 id="comparison-title" className="text-2xl font-semibold">Compare SD-WAN and SASE providers</h2>
    <p className="mt-2 text-sm text-zinc-600">Compare two or three named vendors and service providers across {features.length} capabilities. Public evidence is free to explore; personalised matching unlocks when you publish a project.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((index) => <label key={index} className="text-sm font-semibold">Provider {index + 1}{index === 2 ? ' (optional)' : ''}<select aria-label={`Provider ${index + 1}`} value={selected[index]} onChange={(e) => choose(index, e.target.value)} className="mt-2 block w-full rounded border border-zinc-300 bg-white p-3 font-normal"><option value="">Choose a provider</option>{vendors.map((v) => <option key={v.slug} value={v.slug} disabled={selected.some((slug, i) => i !== index && slug === v.slug)}>{v.name}</option>)}</select></label>)}</div>
    {comparison && <>
      <div className="mt-4 flex flex-wrap gap-4"><a href="#comparison-table" className="font-semibold underline">Compare every feature across your selected providers</a><button type="button" onClick={copyComparison} className="text-sm underline">{copied ? 'Link copied' : 'Copy comparison link'}</button></div>
      <form className="mt-5" onSubmit={(e) => { e.preventDefault(); void ask(); }}><label htmlFor="comparison-question" className="text-sm font-semibold">Ask about the comparison</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="comparison-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder="How do their security capabilities differ?" className="min-w-0 flex-1 rounded border border-zinc-300 p-3"/><button disabled={busy || !question.trim()} className="rounded bg-zinc-900 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Reading evidence…' : 'Ask Netify AI'}</button></div></form>
      {answer && <p className="mt-4 whitespace-pre-wrap text-sm" role="status">{answer}</p>}
    </>}
    <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5">
      <h3 className="text-lg font-semibold">Which providers fit your project?</h3>
      <p className="mt-2 text-sm">Describe your requirement, review a short anonymous notice and verify your work email and company. Publishing unlocks your personalised shortlist, project-specific comparisons and supplier responses. A full RFP is optional.</p>
      <label className="mt-3 block text-sm font-semibold">Your requirement (optional)<textarea value={requirement} onChange={(e) => setRequirement(e.target.value)} maxLength={4000} rows={2} placeholder="What does your business need?" className="mt-2 block w-full rounded border border-amber-300 bg-white p-3 font-normal"/></label>
      <button type="button" onClick={startProject} className="mt-4 rounded-full bg-amber-400 px-5 py-3 font-semibold text-zinc-950">Find providers for my project</button>
      <p className="mt-2 text-xs">Your selections travel with you. Nothing is published without your approval.</p>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {comparison && <div id="comparison-table" className="mt-8"><h3 className="mb-3 text-lg font-semibold">Public capability comparison</h3><CompareTable comparison={comparison}/><div className="mt-4 flex flex-wrap gap-4">{slugs.map((slug) => { const v = vendors.find((provider) => provider.slug === slug)!; return <a key={slug} href={v.marketplace_url || `/sase/vendors/${slug}/`} className="text-sm underline">{v.name}: evidence and sources</a>; })}</div><button type="button" onClick={startProject} className="mt-5 rounded-full bg-amber-400 px-5 py-3 font-semibold">Find providers for my project</button></div>}
  </section>;
}
