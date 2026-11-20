import { RESEARCH } from "@/lib/workbook-research";

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify({ license: "https://creativecommons.org/licenses/by/4.0/", publisher: "Netify", url: "https://netify.co.uk/sase/research/", ...RESEARCH }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
