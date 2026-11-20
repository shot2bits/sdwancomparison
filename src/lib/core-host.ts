/** One canonical buyer core, pinned separately for development and production. */
export const CORE_DEV_BRANCH='br-aged-union-zar77mut';
export const CORE_LIVE_BRANCH='br-old-fire-za44gtx1';
export const CORE_LIVE_HOST='ep-ancient-sky-zasmqmzt-pooler.c-2.eu-west-2.aws.neon.tech';
export const coreEnvironment=()=>process.env.VERCEL_ENV==='production'?'production':'development';
export const coreLiveEnabled=()=>process.env.VERCEL_ENV==='production'&&process.env.NETIFY_CORE_LIVE==='1';
export function coreOriginAllowed(origin:string){
 const u=new URL(origin);
 if(!process.env.VERCEL_ENV&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))return true;
 if(u.protocol!=='https:')return false;
 if(process.env.VERCEL_ENV==='preview')return [process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL].filter(Boolean).includes(u.host);
 return coreLiveEnabled()&&['netify.co.uk',process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL,'sasecomparison-netifymarketplace.vercel.app','sase.netify.co.uk','app.netify.co.uk','project-8q2xb.vercel.app'].filter(Boolean).includes(u.host);
}
export const coreCanonicalOrigin=(origin:string)=>coreLiveEnabled()&&coreOriginAllowed(origin)?'https://netify.co.uk':origin;
export const coreLocationPath=()=>'/marketplace/';
/** Retain the legacy live registry until the separate 26-tool live smoke passes. */
export const coreBuyerRegistryEnabled=()=>process.env.NETIFY_CORE_PHASE23==='1'&&(process.env.VERCEL_ENV!=='production'||process.env.NETIFY_CORE_LEGACY_MCP==='0');

/** Separate ordered release switch: machine discovery follows the public registry only when approved. */
export const coreDiscoveryEnabled=()=>process.env.NETIFY_CORE_DISCOVERY_ENABLED==='1'&&coreBuyerRegistryEnabled();
