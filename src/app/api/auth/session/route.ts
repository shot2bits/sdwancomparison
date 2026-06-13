import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";

export const runtime = "nodejs";

/** Current session (or null). Used by the UI to show signed-in state. */
export async function GET(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ authenticated: false });
  return Response.json({
    authenticated: true,
    role: s.role,
    email: s.email,
    vendor_slug: s.vendor_slug,
    admin: isAdminEmail(s.email),
  });
}
