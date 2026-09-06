import { saseDemoDocument } from "@/lib/sase-rfp-demonstration";
export function GET(request: Request) {
  const depth = new URL(request.url).searchParams.get("depth") ?? "short";
  if (depth !== "short" && depth !== "detailed") return new Response("Choose short or detailed.", { status: 400 });
  return new Response(saseDemoDocument(depth), { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="netify-${depth}-sase-rfp-example.txt"`, "Cache-Control": "public, max-age=3600" } });
}
