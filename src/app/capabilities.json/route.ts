import { ANSWER_FIRST_FIELDS } from "@/lib/shortlist-machine-contract";
import { capabilitiesDocument } from "@/lib/capabilities";

export const runtime = "nodejs";

/** Machine-readable capability catalogue for AI engines and agents. */
export function GET() {
  return Response.json({...capabilitiesDocument(),shortlist_evidence:ANSWER_FIRST_FIELDS}, {
    headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" },
  });
}
