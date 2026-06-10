import { SITE_URL } from "@/lib/structured-data";

const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
];

export async function GET() {
  const blocks = AI_CRAWLERS.map((ua) => `User-Agent: ${ua}\nAllow: /`).join("\n\n");
  const body = `User-Agent: *\nAllow: /\n\n${blocks}\n\nHost: ${SITE_URL}\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
