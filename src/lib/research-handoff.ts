/** Buyer wording travels in a fragment, never a server query or analytics property. */
export function parseResearchHandoff(hash: string): { requirement: string; source: string; provider_context: string[] } | null {
  if (!hash.startsWith('#sourcing-context=') || hash.length > 80000) return null;
  try {
    const value = JSON.parse(decodeURIComponent(hash.slice('#sourcing-context='.length)));
    if (value.version !== 1 || typeof value.requirement !== 'string' || !value.requirement.trim() || value.requirement.length > 12000) return null;
    const source = new URL(value.source);
    if (source.origin !== 'https://netify.co.uk' || !/^\/insights\/[a-z0-9-]+\/$/.test(source.pathname) || source.search || source.hash) return null;
    const pins = value.provider_context ?? [];
    if (!Array.isArray(pins) || pins.length > 30 || !pins.every(p=>typeof p === "string" && /^[a-z0-9-]{1,120}$/.test(p))) return null;
    return {requirement:value.requirement, source:source.href, provider_context:pins};
  } catch { return null; }
}
