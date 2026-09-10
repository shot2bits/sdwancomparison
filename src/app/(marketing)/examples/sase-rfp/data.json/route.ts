import { saseDemoData } from "@/lib/sase-rfp-demonstration";
export function GET() { return Response.json(saseDemoData(), { headers: { "Cache-Control": "public, max-age=3600" } }); }
