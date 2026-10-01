import type { ShortlistVendor } from './shortlist-core';
export const BUYER_DECISIONS = [
  { id: 'managed', title: 'You want someone to run the service', feature: 'f01_fully_managed_service', question: 'Ask who owns monitoring, policy changes, incident response and escalation, and which tasks remain with your team.' },
  { id: 'self-managed', title: 'Your team wants to run the platform', feature: 'f02_diy_self_managed_model', question: 'Check operating skills, deployment support, licensing and whether connectivity and security services are separate purchases.' },
  { id: 'sase', title: 'You need networking and security together', feature: 'f28_full_sase_platform', question: 'Confirm the SD-WAN component, remote-user security, inspection locations and any separate partner contracts or licences.' },
] as const;
export function buyerDecisionGuide(vendors: ShortlistVendor[]) {
  return BUYER_DECISIONS.map(decision => ({...decision, providers: vendors
    .filter(v => ['yes','partial','partner_integrated','managed_service_dependent'].includes(v.capabilities[decision.feature]))
    .map(v => ({slug:v.slug, name:v.name, grade:v.capabilities[decision.feature], evidence_date:v.capability_evidence?.[decision.feature]?.reviewed_at || v.last_verified, source_url:v.capability_evidence?.[decision.feature]?.source_url || null}))
    .sort((a,b)=>a.name.localeCompare(b.name,'en-GB')) }));
}
