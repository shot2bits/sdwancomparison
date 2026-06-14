import { sessionFromRequest } from "@/lib/auth";

/** Resolve the signed-in partner email. Partners sign in via the existing
 *  magic-link business-email flow (buyer/netify role). Suppliers are not
 *  partners. Returns the lowercased email or null. */
export async function partnerEmail(req: Request): Promise<string | null> {
  const session = await sessionFromRequest(req);
  if (!session?.email || session.role === "supplier") return null;
  return session.email.toLowerCase();
}
