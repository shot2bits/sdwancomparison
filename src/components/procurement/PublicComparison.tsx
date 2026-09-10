import { Suspense } from 'react';
import ShortlistBuilder from '@/components/ShortlistBuilder';
import { FEATURES } from '@/lib/vendors';
import { getLiveShortlistDataset } from '@/lib/live-shortlist';

export default async function PublicComparison({ expanded = false }: { expanded?: boolean } = {}) {
  const { vendors } = await getLiveShortlistDataset();
  const features = FEATURES.map(({ id, name, category, description }) => ({ id, name, category, description }));
  if (expanded) return <div className="nf-public-comparison"><Suspense fallback={<p>Loading comparison…</p>}><ShortlistBuilder vendors={vendors} features={features}/></Suspense></div>;
  return <details open={expanded} className="mx-auto max-w-[1180px] rounded-lg border border-zinc-300 bg-white px-5 py-4">
    <summary className="cursor-pointer text-lg font-semibold">Compare SD-WAN and SASE vendors and providers</summary>
    <p className="mt-2 text-sm">Explore public capability differences, then find the right providers for your project.</p>
    <Suspense fallback={<p>Loading comparison…</p>}><ShortlistBuilder vendors={vendors} features={features}/></Suspense>
  </details>;
}
