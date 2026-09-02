import { buildShortlist, DEFAULT_INPUT } from '@/lib/shortlist-core';
import { FEATURE_NAMES } from '@/lib/vendors';
import { getLiveShortlistDataset } from '@/lib/live-shortlist';
import { GOVERNED_SHORTLIST_CONTRACT_VERSION } from '@/lib/governed-provider-catalogue';
import { createHash } from 'node:crypto';
import { buildShortlistMarketView, parseShortlistMarketView, SHORTLIST_VIEW_CONTRACT_VERSION } from '@/lib/shortlist-market-views';

function csv(value: unknown): string {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const live = await getLiveShortlistDataset();
  const view = parseShortlistMarketView(new URL(request.url).searchParams.get('view'));
  const ranked = view === 'all' ? buildShortlist(
      live.vendors,
      { ...DEFAULT_INPUT, shortlist_size: live.vendors.length },
      FEATURE_NAMES,
    ).shortlist : buildShortlistMarketView(live.vendors, view);
  const sourceBySlug = new Map(live.vendors.map((provider) => [provider.slug, provider]));
  const lastModified = live.vendors.map((provider) => provider.last_verified).sort().slice(-1)[0] ?? '2026-09-02';
  const headings = [
    'contract_version', 'market_view_contract_version', 'market_view', 'generated_at', 'rank', 'slug', 'name', 'provider_type', 'score',
    'summary', 'products', 'evidence_source_count', 'reviewed_at', 'profile_url',
  ];
  const rows = ranked.map((provider) => {
    const source = sourceBySlug.get(provider.slug);
    const generatedAt = new Date(`${lastModified}T00:00:00.000Z`).toISOString();
    return [
    GOVERNED_SHORTLIST_CONTRACT_VERSION,
    SHORTLIST_VIEW_CONTRACT_VERSION,
    view,
    generatedAt,
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
  const responseBody = `${body}\r\n`;
  const etag = `"${createHash('sha256').update(responseBody).digest('hex')}"`;
  const headers = {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'inline; filename="netify-sase-sd-wan-shortlist.csv"',
    'Last-Modified': new Date(lastModified).toUTCString(),
    'ETag': etag,
  };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  return new Response(responseBody, { headers });
}
