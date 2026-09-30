/** Physical storage selection, not a metadata namespace. Production credentials are never reused outside production. */
export function activityKvBinding(env:Record<string,string|undefined>=process.env):{url:string|undefined;token:string|undefined} {
 const shared={url:env.KV_REST_API_URL,token:env.KV_REST_API_TOKEN};
 const environment=env.VERCEL_ENV??env.NETIFY_ACTIVITY_ENV;
 if(environment==='production')return shared;
 // Local isolated REST fixtures have no route to the hosted integration.
 if(shared.url&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(?:\/|$)/.test(shared.url))return shared;
 const url=env.NETIFY_ISOLATED_KV_REST_API_URL,token=env.NETIFY_ISOLATED_KV_REST_API_TOKEN;
 try { if(url&&token&&shared.url&&new URL(url).protocol==='https:'&&new URL(url).origin!==new URL(shared.url).origin)return {url,token}; } catch { /* Invalid binding fails closed. */ }
 return {url:undefined,token:undefined};
}
