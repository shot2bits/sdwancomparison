export const SOURCING_ACQUISITIONS = [
  "web",
  "chatgpt",
  "gemini",
  "perplexity",
  "copilot",
  "google",
  "bing",
  "mcp",
  "other",
] as const;
export type SourcingAcquisition = (typeof SOURCING_ACQUISITIONS)[number];
export function sourcingAcquisition(
  search = "",
  referrer = "",
): SourcingAcquisition {
  const p = new URLSearchParams(search);
  const source = (
    p.get("utm_source") ??
    p.get("acquisition") ??
    ""
  ).toLowerCase();
  function identify(host: string): SourcingAcquisition | null {
    if (
      host === "chatgpt" ||
      host === "chatgpt.com" ||
      host.endsWith(".chatgpt.com")
    )
      return "chatgpt";
    if (
      host === "perplexity" ||
      host === "perplexity.ai" ||
      host.endsWith(".perplexity.ai")
    )
      return "perplexity";
    if (host === "gemini" || host === "gemini.google.com") return "gemini";
    if (host === "copilot" || host === "copilot.microsoft.com")
      return "copilot";
    if (/^(www\.)?google\.(com|co\.uk)$/.test(host)) return "google";
    if (host === "bing.com" || host === "www.bing.com") return "bing";
    return null;
  }
  const explicit = identify(source);
  if (explicit) return explicit;
  try {
    const mapped = identify(new URL(referrer).hostname);
    if (mapped) return mapped;
  } catch {}
  return "web";
}
