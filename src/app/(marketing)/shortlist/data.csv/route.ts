import { buildShortlist, DEFAULT_INPUT } from '@/lib/shortlist-core';
import { FEATURE_NAMES } from '@/lib/vendors';
import { getLiveShortlistDataset } from '@/lib/live-shortlist';
import { GOVERNED_SHORTLIST_CONTRACT_VERSION } from '@/lib/governed-provider-catalogue';

function csv(value: unknown): string {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const live = await getLiveShortlistDataset();
  const ranked = buildShortlist(
    live.vendors,
    { ...DEFAULT_INPUT, shortlist_size: live.vendors.length },
    FEATURE_NAMES,
  ).shortlist;
  const sourceBySlug = new Map(live.vendors.map((provider) => [provider.slug, provider]));
  const headings = [
    'contract_version', 'rank', 'slug', 'name', 'provider_type', 'score',
    'summary', 'products', 'evidence_source_count', 'reviewed_at', 'profile_url',
  ];
  const rows = ranked.map((provider) => {
    const source = sourceBySlug.get(provider.slug);
    return [
    GOVERNED_SHORTLIST_CONTRACT_VERSION,
    provider.rank,
    provider.slug,
    provider.name,
    provider.category,
    provider.score,
    provider.shortlist_summary,
    source?.product_focus ?? '',
    source?.evidence_source_count ?? 0,
    source?.last_verified ?? '',
    source?.marketplace_url ?? '',
  ];
  });
  const body = [headings, ...rows].map((row) => row.map(csv).join(',')).join('\r\n');

  return new Response(`${body}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="netify-sase-sd-wan-shortlist.csv"',
      'X-Robots-Tag': 'noindex',
    },
  });
}
