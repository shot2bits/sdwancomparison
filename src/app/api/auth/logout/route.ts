import { sessionFromRequest, clearCookieHeader } from "@/lib/auth";
import { deleteSession } from "@/lib/rfp-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await sessionFromRequest(req);
  if (s) await deleteSession(s.token);
  return Response.json({ ok: true }, { headers: { "set-cookie": clearCookieHeader() } });
}
