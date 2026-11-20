'use client';
import {useEffect, useState} from 'react';
import type {accessReport} from '@/lib/auth-access-report';
type Report = Awaited<ReturnType<typeof accessReport>>;
export default function AccessReport() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/sase/api/admin/access-report/', {cache:'no-store', signal:controller.signal})
      .then(async r => {const body = await r.json(); if (!r.ok) throw new Error(body.error ?? 'Report unavailable.'); if (!controller.signal.aborted) setData(body);})
      .catch(e => {if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Report unavailable.');});
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading access report…</p>;
  return <>
    <p className="mt-5 leading-7">{data.interpretation}</p>
    {!data.available_days ? <p className="mt-5 rounded-xl bg-zinc-100 p-5">No counters have been recorded yet. This is not a historical zero.</p> : <div className="mt-7 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><caption className="mb-4 text-left">Daily access attempts and outcomes. Dates are UTC; only days with retained counters appear.</caption><thead><tr>{['Date','Audience','Entry','Outcome','Count'].map(h => <th key={h} scope="col" className="border-b p-3">{h}</th>)}</tr></thead><tbody>{data.days.flatMap(day => day.rows.map(row => <tr key={[day.day,row.role,row.entry,row.stage].join(':')}><td className="border-b p-3">{day.day}</td><td className="border-b p-3">{row.role}</td><td className="border-b p-3">{row.entry}</td><td className="border-b p-3">{row.stage.replaceAll('_',' ')}</td><td className="border-b p-3">{row.count}</td></tr>))}</tbody></table></div>}
    <p className="mt-6"><a className="underline" href="/sase/admin/buying-funnel/">Review project and buying outcomes →</a></p>
  </>;
}
