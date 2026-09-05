import { sessionFromRequest } from '@/lib/auth';
import { kvConfigured } from '@/lib/rfp-store';
import { getOrInitBuyerMemory, MemoryRevisionError } from '@/lib/buyer-memory';
import { AssistantActionSchema, buyerAssistantEnabled, runBuyerAssistant } from '@/lib/buyer-assistant';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
async function buyer(req: Request) {
  if (!buyerAssistantEnabled()) return reply({ error: 'The buying assistant is currently unavailable.' }, 404);
  if (!kvConfigured()) return reply({ error: 'Saved memories are temporarily unavailable.' }, 503);
  const session = await sessionFromRequest(req);
  if (!session?.email || !['buyer', 'netify'].includes(session.role)) return reply({ error: 'Sign in with your buyer account to use saved memories.', auth_required: true }, 401);
  return session.email;
}
export async function GET(req: Request) {
  try {
    const owner = await buyer(req);
    if (typeof owner !== 'string') return owner;
    return reply({ memory: await getOrInitBuyerMemory(owner) });
  } catch { return reply({ error: 'Could not load your memories. Please try again.' }, 503); }
}
export async function POST(req: Request) {
  try {
    const owner = await buyer(req);
    if (typeof owner !== 'string') return owner;
    if (req.headers.get('x-netify-account')?.toLowerCase() !== owner.toLowerCase()) return reply({ error: 'Your signed-in account changed. Reload your memories before continuing.' }, 409);
    const origin = req.headers.get('origin');
    if (origin && ![new URL(req.url).origin, 'https://netify.co.uk', 'https://www.netify.co.uk'].includes(origin)) return reply({ error: 'Request origin not allowed.' }, 403);
    if (!req.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'JSON required.' }, 415);
    const raw = await req.text();
    if (raw.length > 16000) return reply({ error: 'Request too large.' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid JSON.' }, 400); }
    const parsed = AssistantActionSchema.safeParse(body);
    if (!parsed.success) return reply({ error: 'Check the memory or requirements fields and try again.' }, 400);
    return reply(await runBuyerAssistant(owner, parsed.data));
  } catch (error) {
    if (error instanceof MemoryRevisionError) return reply({ error: error.message }, 409);
    // Only expose bounded domain errors, never provider/storage exception details.
    const message = error instanceof Error ? error.message : '';
    if (/^(A selected memory|Memory not found|Enter requirements)/.test(message)) return reply({ error: message }, 400);
    return reply({ error: 'Could not complete this action. Your project has not been changed. Please try again.' }, 503);
  }
}
