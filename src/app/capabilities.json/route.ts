import { capabilitiesDocument } from "@/lib/capabilities";

export const runtime = "nodejs";

/** Machine-readable capability catalogue for AI engines and agents. */
export function GET() {
  return Response.json(capabilitiesDocument(), {
    headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" },
  });
}
