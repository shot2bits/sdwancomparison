import { corsHeaders, preflight } from "@/lib/cors";
import { issueAuthChallenge } from "@/lib/auth-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) { return preflight(req); }

export async function GET(req: Request) {
  const challenge = issueAuthChallenge();
  if (!challenge) return Response.json({ error: "Sign-in verification is not configured." }, { status: 503, headers: corsHeaders(req) });
  return Response.json({ challenge }, { headers: { ...corsHeaders(req), "cache-control": "no-store" } });
}
