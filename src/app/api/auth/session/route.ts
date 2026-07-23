import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";
import { linkedinConfigured } from "@/lib/linkedin";

export const runtime = "nodejs";

/** Current session (or null). Used by the UI to show signed-in state.
 *  `linkedin` says whether the LinkedIn sign-in lane is configured, so
 *  the button renders only where the route can actually complete. */
export async function GET(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ authenticated: false, linkedin: linkedinConfigured() });
  return Response.json({
    authenticated: true,
    role: s.role,
    email: s.email,
    vendor_slug: s.vendor_slug,
    admin: isAdminEmail(s.email),
    linkedin: linkedinConfigured(),
  });
}
