/**
 * IndexNow key file (protocol ownership proof). Submissions to
 * api.indexnow.org name this URL as keyLocation; the engine fetches it and
 * matches the body against the submitted key. Served from the environment so
 * the key never lives in the repo; 404 until INDEXNOW_KEY is configured.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response("Not found.", { status: 404 });
  return new Response(key, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
