import { getLiveShortlistDataset } from '@/lib/live-shortlist';
import { draftResearch } from '@/lib/draft-research';
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const scope = p.get('scope') ?? '';
  const input = { required_regions:(p.get('regions') ?? '').split(',').filter(Boolean), sector:p.get('sector') || null, service_model:p.get('model') || 'any', required_features:(p.get('features') || '').split(',').filter(Boolean), shortlist_size:8 };
  // Only bounded research filters are accepted. No document, company or project token.
  if (p.toString().length > 2000) return Response.json({error:'Too many filters.'},{status:400});
  try {
    const live = await getLiveShortlistDataset();
    return Response.json({...draftResearch(live.vendors,scope,input),source:live.source},{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({error:'Research preview is unavailable. Check your filters or retry.'},{status:400}); }
}
