import type {ShortlistVendor} from './shortlist-core';
export const ADVICE_DEPENDENCIES = [
 {slug:'aryaka',prefix:'DIY/self-managed',features:['f02_diy_self_managed_model'],question:'Confirm which operating tasks your team retains and what Aryaka operates.'},
 {slug:'aryaka',prefix:'CASB and DLP',features:['f32_casb_capability','f33_data_loss_prevention'],question:'Confirm inspection modes, licences and policy depth in the proposal.'},
 {slug:'check-point',prefix:'Native SD-WAN capabilities',features:['f10_dynamic_path_selection','f13_qos_and_traffic_shaping','f14_packet_loss_remediation'],question:'Confirm the exact SD-WAN product and required branch behaviour.'},
 {slug:'cloudflare-one',prefix:'SD-WAN capabilities',features:['f10_dynamic_path_selection','f13_qos_and_traffic_shaping','f14_packet_loss_remediation'],question:'Confirm branch requirements and any delivery partner dependency.'},
 {slug:'colt-technology-services',prefix:'CASB and DLP',features:['f32_casb_capability','f33_data_loss_prevention'],question:'Ask Colt to identify the SSE platform, licences and operational responsibilities.'},
 {slug:'cradlepoint-ericsson',prefix:'Cloud on-ramp',features:['f18_cloud_on_ramp','f23_multi_cloud_transit_fabric'],question:'Confirm the cloud locations, connectivity pattern and transit design.'},
 {slug:'forcepoint',prefix:'Full SASE platform completeness',features:['f28_full_sase_platform'],question:'Confirm the included networking and security products, licences and service scope.'},
 {slug:'juniper-networks',prefix:'SASE story is less mature',features:['f28_full_sase_platform','f32_casb_capability','f33_data_loss_prevention'],question:'Confirm the networking and SSE products and whether separate contracts or operators are required.'},
 {slug:'netskope',prefix:'Managed delivery is partner-led',features:['f01_fully_managed_service'],question:'Confirm who will operate the service and whether management is supplied directly or through a partner.'},
 {slug:'sonicwall',prefix:'SASE and SSE capabilities',features:['f28_full_sase_platform','f32_casb_capability','f33_data_loss_prevention'],question:'Confirm the exact networking and security modules included in the proposal.'},
] as const;
export function applyAdviceConsistency(v:ShortlistVendor,original:ShortlistVendor,names:Record<string,string>) {
 for(const rule of ADVICE_DEPENDENCIES.filter(r=>r.slug===v.slug)){
  const index=original.watch_outs.findIndex(s=>s.startsWith(rule.prefix));if(index<0)continue;
  const facts=rule.features.map(id=>`${names[id]??id}: ${{yes:'supported',partial:'partial evidence',partner_integrated:'partner-delivered',managed_service_dependent:'service-dependent',not_primary:'not primary',unknown:'not confirmed',not_confirmed:'not confirmed'}[v.capabilities[id]??'unknown']}`).join('; ');
  v.watch_outs[index]=`${facts}. ${rule.question}`;
 }
}
export function joinedEvidenceText(finding?:string|null,qualification?:string|null) {
 const clean=(s:string)=>s.replace(/\[\d+\]/g,'').replace(/\s+/g,' ').trim().replace(/[.!]$/,'').toLowerCase();
 const first=finding?.trim()??'',second=qualification?.trim()??'';
 if(!second||clean(second)==='none identified'||clean(first)===clean(second))return first||second;
 return [first,second].filter(Boolean).join(' ');
}
