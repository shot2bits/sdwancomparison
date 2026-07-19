/** Machine-served ACTION links carry attribution so assistant-driven arrivals
 * are measurable (GA source/medium = ai_assistant / llms|twin|mcp; Vercel UTM
 * tab). Citation URLs (canonicals, notice_url, data.json, provenance) stay
 * clean so the citation asset never fragments. 19 July 2026.
 */
export function aiActionUrl(url: string, medium: 'llms' | 'twin' | 'mcp'): string {
  return url + (url.includes('?') ? '&' : '?') + 'utm_source=ai_assistant&utm_medium=' + medium;
}
