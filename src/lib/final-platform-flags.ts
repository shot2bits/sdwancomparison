/** Group 1 is enabled only in the approved release configuration. Groups 2/3 default off. */
export const FINAL_FLAGS={owner:'NETIFY_PLATFORM_OWNER_VISIBILITY',funnel:'NETIFY_PLATFORM_FUNNEL',status:'NETIFY_PLATFORM_STATUS',dispatch:'NETIFY_PLATFORM_SUPPLIER_DISPATCH',intake:'NETIFY_PLATFORM_SUPPLIER_INTAKE',comparison:'NETIFY_PLATFORM_QUOTE_COMPARISON',reseller:'NETIFY_PLATFORM_RESELLER',agents:'NETIFY_PLATFORM_AGENT_AUTH',evidence:'NETIFY_PLATFORM_PUBLIC_EVIDENCE'} as const;
export type FinalFlag=keyof typeof FINAL_FLAGS;
export const finalEnabled=(flag:FinalFlag)=>process.env[FINAL_FLAGS[flag]]==='1';
export function requireFinalFlag(flag:FinalFlag){if(!finalEnabled(flag))throw Object.assign(new Error('feature_not_enabled'),{status:404,code:'feature_not_enabled'});}
export const platformOwner=()=>process.env.NETIFY_PLATFORM_OWNER_EMAIL?.trim().toLowerCase()||'rsturt@netify.co.uk';
