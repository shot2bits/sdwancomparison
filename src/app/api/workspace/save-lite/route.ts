import { corsHeaders, preflight } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  return Response.json(
    { error: "Saving is unlocked only after the RFP is published to the Netify Opportunity Board." },
    { status: 403, headers: cors },
  );
}
