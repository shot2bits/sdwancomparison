import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listThreads, saveThread, newId, kvConfigured } from "@/lib/rfp-store";
import { RfpThreadSchema } from "@/lib/rfp-types";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Does the request carry the RFP's supplier share token (query or body)? */
function shareTokenOk(req: Request, shareToken: string, body?: { token?: string }): boolean {
  if (!shareToken) return false;
  if (body?.token && body.token === shareToken) return true;
  try {
    return new URL(req.url).searchParams.get("token") === shareToken;
  } catch {
    return false;
  }
}

/** List clarification threads for an RFP: owner, or supplier with the share
 *  token from their response link. Not open to anyone with only the id. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  if (!shareTokenOk(req, project.share_token)) {
    const access = await requireRfpOwner(req, project);
    if (!access.ok) return ownerRequired("Reading clarification threads", cors);
  }
  return Response.json({ threads: await listThreads(id) }, { headers: cors });
}

/**
 * POST creates a supplier question (share token required), or a buyer answer
 * when { answer, thread_id } is sent (owner-only).
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { vendor?: string; question?: string; category?: string; thread_id?: string; answer?: string; token?: string; manage_token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }

  // Buyer answering an existing thread
  if (body.thread_id && typeof body.answer === "string") {
    const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
    if (!access.ok) return ownerRequired("Answering a clarification", cors);
    const threads = await listThreads(id);
    const t = threads.find((x) => x.id === body.thread_id);
    if (!t) return Response.json({ error: "Thread not found." }, { status: 404, headers: cors });
    const saved = await saveThread({ ...t, buyer_answer: body.answer, status: "answered", answered: Date.now() });
    return Response.json(saved, { headers: cors });
  }

  // Supplier asking a question: needs the share token from the response link.
  if (!shareTokenOk(req, project.share_token, body)) {
    return Response.json({ error: "Asking a question needs the response link token. Open this RFP via your supplier link and try again." }, { status: 401, headers: cors });
  }
  if (!body.vendor || !body.question) {
    return Response.json({ error: "vendor and question are required." }, { status: 422, headers: cors });
  }
  const cat = (body.category as string) || autoCategory(body.question);
  const thread = RfpThreadSchema.parse({
    id: newId("thr"),
    rfp_id: id,
    vendor: body.vendor,
    category: cat,
    question: body.question,
    status: "open",
    buyer_answer: "",
    created: Date.now(),
    answered: null,
  });
  const saved = await saveThread(thread);
  return Response.json(saved, { headers: cors });
}

function autoCategory(q: string): "technical" | "commercial" | "timeline" | "scope" | "other" {
  const s = q.toLowerCase();
  if (/(price|cost|licen|commercial|discount|term|payment|contract)/.test(s)) return "commercial";
  if (/(when|deadline|timeline|date|submit by|how long|lead time)/.test(s)) return "timeline";
  if (/(scope|include|out of scope|in scope|cover|number of sites|how many)/.test(s)) return "scope";
  if (/(ztna|swg|casb|dlp|firewall|bandwidth|latency|protocol|integration|api|architecture|throughput|tls|segmentation)/.test(s)) return "technical";
  return "other";
}
