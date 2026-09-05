'use client';

import { useEffect, useRef, useState } from 'react';
import SignIn from '@/components/SignIn';
import type { BuyerMemory, MemoryFact } from '@/lib/buyer-memory';
import type { AssistantAction, SkillResult } from '@/lib/buyer-assistant';
import './buyer-assistant.css';

type Mode = 'memories' | 'skills';
const emptyFact = { text: '', source: 'Entered by me', confirmed: false, expiry: '' };
const skills = [
  ['review_requirements', 'Review requirements', 'Find gaps and questions using the existing Netify requirement engine.'],
  ['compare_options', 'Compare buying options', 'Review managed, co-managed and DIY delivery alongside your requirements.'],
  ['prepare_project', 'Prepare my project', 'Prepare requirements for your anonymous brief. You approve publication separately.'],
] as const;

export default function BuyerAssistant({ mode, onCompare, onProject }: { mode: Mode; onCompare: () => void; onProject: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [memory, setMemory] = useState<BuyerMemory | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [fact, setFact] = useState(emptyFact);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<SkillResult | null>(null);
  const [applied, setApplied] = useState(false);

  async function load() {
    try {
      const response = await fetch('/sase/api/buyer/assistant', { cache: 'no-store' });
      const data = await response.json();
      setError(''); setNow(Date.now());
      setAuthRequired(response.status === 401);
      if (!response.ok) { setMemory(null); throw new Error(data.error); }
      setMemory(data.memory); setResult(null); setSelected([]); setStatus('Memories loaded.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load memories.'); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/sase/api/buyer/assistant', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (controller.signal.aborted) return;
      setAuthRequired(response.status === 401);
      if (!response.ok) throw new Error(data.error);
      setMemory(data.memory); setStatus('Memories loaded.');
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load memories.'); });
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  async function act(action: AssistantAction) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch('/sase/api/buyer/assistant', { method: 'POST', headers: { 'content-type': 'application/json', 'x-netify-account': memory?.email ?? '' }, body: JSON.stringify(action) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) { setMemory(null); setAuthRequired(true); }
        if (response.status === 409) setResult(null);
        throw new Error(data.error);
      }
      if (data.memory) {
        setMemory(data.memory); setFact(emptyFact); setEditing(null); setResult(null); setSelected([]);
        setStatus(action.action === 'forget_fact' ? 'Memory forgotten.' : 'Memory saved to your buyer account.');
      }
      if (data.result) { setResult(data.result); setApplied(false); setStatus('Review complete. Your project has not been changed.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete the action.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function edit(f: MemoryFact) {
    setEditing(f.id); setFact({ text: f.text, source: f.source, confirmed: Boolean(f.confirmed_at), expiry: f.expires_at ? new Date(f.expires_at).toISOString().slice(0, 10) : '' });
    setStatus('Editing saved memory.');
  }
  async function apply() {
    if (!result || applied || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/sase/api/buyer/assistant', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.memory.email.toLowerCase() !== memory?.email.toLowerCase()) { setMemory(null); setResult(null); throw new Error('Your signed-in account changed. Reload your memories before continuing.'); }
      if (data.memory.revision !== result.memory_revision) { setResult(null); throw new Error('Your memories changed. Reload and run the skill again.'); }
      if (result.fact_ids.some(id => !data.memory.facts.some((f: MemoryFact) => f.id === id && f.confirmed_at && (!f.expires_at || f.expires_at > Date.now())))) { setResult(null); throw new Error('A selected memory expired or is no longer confirmed. Review your memories and run the skill again.'); }
      const detail = { text: result.input, accepted: false, error: '' };
      window.dispatchEvent(new CustomEvent('netify:assistant-brief', { detail }));
      if (!detail.accepted) throw new Error(detail.error || 'The project is still loading. Try again in a moment.');
      setApplied(true); onProject();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open your brief.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="nf-assistant" aria-label="Buying assistant">
    <p className="nf-buying-eyebrow">YOUR BUYING ASSISTANT</p>
    <h1>{mode === 'memories' ? 'Memories you control' : 'Move your project forward'}</h1>
    <p>{mode === 'memories' ? 'Save facts for future buying projects. These belong to your account; colleagues and suppliers cannot see them.' : 'Choose the facts to use, review the result, then prepare your project for supplier responses.'}</p>
    {error && <p role="alert" className="nf-assistant-error">{error}</p>}
    <p role="status" className="nf-assistant-status">{busy ? 'Working…' : status}</p>
    {authRequired ? <SignIn role="buyer" prompt="Sign in with your business email to use your private buying assistant." onAuthed={() => void load()} /> : !memory ? <button onClick={() => void load()}>Load my memories</button> : <>
      <div className="nf-assistant-toolbar"><span>Private to {memory.email}</span><button disabled={busy} onClick={() => void load()}>Reload memories</button></div>
      {mode === 'memories' ? <div className="nf-assistant-columns">
        <div>
          {memory.facts.length === 0 && <div className="nf-assistant-card"><h2>Start with a useful fact</h2><p>Your site footprint, renewal date or operating preference. Add the facts you want these skills to reuse. You choose when to save.</p></div>}
          {memory.facts.map(f => <article className="nf-assistant-card" key={f.id}>
            <p className="nf-assistant-fact">{f.text}</p><p className="nf-assistant-meta">Source: {f.source}</p>
            <p className="nf-assistant-meta">{!f.confirmed_at ? 'Needs your confirmation' : f.expires_at && f.expires_at <= now ? 'Expired — review before using' : `Confirmed ${new Date(f.confirmed_at).toLocaleDateString('en-GB')}`}{f.expires_at ? ` · Expires ${new Date(f.expires_at).toLocaleDateString('en-GB')}` : ''}</p>
            <div className="nf-assistant-actions"><button disabled={busy} onClick={() => edit(f)}>Edit</button><button disabled={busy} onClick={() => void act({ action: 'forget_fact', revision: memory.revision, id: f.id })}>Forget</button></div>
          </article>)}
          {(memory.notes.length > 0 || memory.organisation || memory.regions.length > 0) && <details className="nf-assistant-card"><summary>Earlier account preferences</summary><p>These remain in your account. Add and confirm any fact you want these skills to use.</p><p>{memory.organisation}</p><p>{memory.regions.join(', ')}</p>{memory.notes.map((n, i) => <p key={i}>{n}</p>)}</details>}
        </div>
        <form className="nf-assistant-card" onSubmit={e => { e.preventDefault(); void act({ action: 'save_fact', revision: memory.revision, ...(editing ? { id: editing } : {}), text: fact.text, source: fact.source, confirmed: fact.confirmed, expires_at: fact.expiry ? new Date(`${fact.expiry}T23:59:59.999Z`).getTime() : null }); }}>
          <h2>{editing ? 'Edit memory' : 'Add a memory'}</h2>
          <label>Fact<textarea aria-label="Fact" required minLength={3} maxLength={1000} value={fact.text} onChange={e => setFact({ ...fact, text: e.target.value, confirmed: false })} placeholder="For example: our network covers 20 UK sites." /></label>
          <label>Source<input required maxLength={200} value={fact.source} onChange={e => setFact({ ...fact, source: e.target.value, confirmed: false })} /></label>
          <label>Expiry date (optional)<input type="date" value={fact.expiry} onChange={e => setFact({ ...fact, expiry: e.target.value, confirmed: false })} /></label>
          <label className="nf-assistant-check"><input type="checkbox" checked={fact.confirmed} onChange={e => setFact({ ...fact, confirmed: e.target.checked })} />I confirm this fact is accurate.</label>
          <p className="nf-assistant-meta">Only confirmed, unexpired facts can be selected for skills.</p>
          <div className="nf-assistant-actions"><button className="nf-buying-primary" disabled={busy}>Save memory</button>{editing && <button type="button" onClick={() => { setFact(emptyFact); setEditing(null); }}>Cancel edit</button>}</div>
        </form>
      </div> : <>
        <div className="nf-assistant-card">
          <label>Your requirements<textarea aria-label="Your requirements" maxLength={3000} rows={5} value={text} disabled={busy} onChange={e => { setText(e.target.value); setResult(null); }} placeholder="Paste your requirements or describe what you need. You can use the full RFP engine for document imports and bespoke questions." /></label>
          <fieldset disabled={busy}><legend>Include saved facts (optional)</legend>{memory.facts.length === 0 && <p>No saved facts yet. You can work directly from your requirements.</p>}{memory.facts.map(f => <label className="nf-assistant-check" key={f.id}><input type="checkbox" disabled={!f.confirmed_at || Boolean(f.expires_at && f.expires_at <= now)} checked={selected.includes(f.id)} onChange={e => { setSelected(e.target.checked ? [...selected, f.id] : selected.filter(id => id !== f.id)); setResult(null); }} />{f.text}{!f.confirmed_at ? ' (unconfirmed)' : f.expires_at && f.expires_at <= now ? ' (expired)' : ''}</label>)}</fieldset>
          <p className="nf-assistant-meta">Selected facts are submitted with these requirements for processing by the Netify requirement engine. Review any differences before adding them to your project.</p>
        </div>
        <div className="nf-assistant-skill-grid">{skills.map(([skill, title, description]) => <button key={skill} disabled={busy || (!text.trim() && !selected.length)} onClick={() => void act({ action: 'run_skill', revision: memory.revision, skill, text, fact_ids: selected })}><strong>{title}</strong><span>{description}</span></button>)}</div>
        {result && <section className="nf-assistant-card" aria-label="Skill result"><h2>Review your result</h2><p className="nf-assistant-meta">{result.engine === 'model' ? 'AI-assisted extraction — check inferred details.' : 'Rules-based extraction — review anything the engine could not place.'}</p><pre>{result.brief}</pre>
          <details><summary>Exact requirements to carry into your brief</summary><pre>{result.input}</pre></details>
          {result.questions.length > 0 && <><h3>Questions to resolve</h3><ul>{result.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></>}
          {result.notes.length > 0 && <details><summary>Extraction notes</summary><ul>{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></details>}
          {result.comparison && <><h3>Delivery model comparison</h3><p>General buying guidance from Netify’s <a href="/sase/cost-estimator/">cost methodology</a>. Suitability depends on your team and supplier contract.</p><div className="nf-assistant-table"><table><thead><tr>{result.comparison.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{result.comparison.rows.map((row, i) => <tr key={i}>{result.comparison!.columns.map(c => <td key={c}>{row[c]}</td>)}</tr>)}</tbody></table></div></>}
          <p>Check the requirements above before continuing. The short brief keeps company identity separate and requires your approval before publication.</p>
          <div className="nf-assistant-actions"><button className="nf-buying-primary" disabled={busy || applied} onClick={() => void apply()}>{applied ? 'Added to your brief' : 'Add reviewed requirements to my brief'}</button><button onClick={onCompare}>Compare providers</button></div>
          <p className="nf-assistant-meta">Your current RFP remains available. A full RFP is optional; publishing your project unlocks personalised matches and supplier responses.</p>
        </section>}
      </>}
    </>}
  </section>;
}
