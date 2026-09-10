/** Best-effort instrumentation also works in standalone validation scripts. */
export async function recordMarketplaceFunnelEvent(input: Parameters<typeof import('./marketplace-funnel').recordMarketplaceFunnelEvent>[0]) {
 try {return await (await import('./marketplace-funnel')).recordMarketplaceFunnelEvent(input);}
 catch { /* Next's server-only marker may be unavailable to standalone validators. */ }
}
