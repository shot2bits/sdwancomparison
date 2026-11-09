export const SECTOR_COMPARISON_VERSION = 'sector-comparison/2026-11-09.1';
export const SECTOR_CHOICES = [
  {id:'financial_services',name:'Financial services',description:'Operational resilience, audit evidence and supplier accountability.',challenges:['resilience','audit','exit']},
  {id:'government_public_sector',name:'Government & councils',description:'Data location, procurement routes and accountable delivery.',challenges:['residency','audit','ownership']},
  {id:'retail_ecommerce',name:'Retail',description:'Store uptime, payment traffic and repeatable rollout.',challenges:['segmentation','cellular','rollout']},
  {id:'healthcare',name:'Healthcare',description:'Clinical access, connected devices and resilient sites.',challenges:['resilience','segmentation','remote']},
  {id:'manufacturing',name:'Manufacturing',description:'Plant continuity, IT/OT boundaries and maintenance access.',challenges:['segmentation','remote','migration']},
  {id:'energy_utilities',name:'Energy & utilities',description:'Distributed infrastructure, remote access and continuity.',challenges:['resilience','remote','cellular']},
  {id:'education',name:'Education',description:'Campus connectivity, user access and network separation.',challenges:['segmentation','remote','visibility']},
  {id:'transport_logistics',name:'Transport & logistics',description:'Distributed sites, cellular access and application performance.',challenges:['cellular','routing','visibility']},
  {id:'professional_services',name:'Professional services',description:'Hybrid working, cloud applications and manageable operations.',challenges:['remote','cloud','ownership']},
  {id:'hospitality_leisure',name:'Hospitality & leisure',description:'Guest isolation, site continuity and rollout support.',challenges:['segmentation','resilience','rollout']},
] as const;
export type ComparisonSector = typeof SECTOR_CHOICES[number]['id'];
export const CHALLENGES = [
  {id:'resilience',label:'Keep critical services available',codes:['high_availability'],question:'Describe appliance and circuit failure scenarios, recovery targets, test evidence and exclusions.'},
  {id:'audit',label:'Retain usable audit and incident evidence',codes:['raw_log_access'],question:'Specify audit exports, retention, change records, access controls and responsibilities.'},
  {id:'exit',label:'Plan an orderly contract exit',codes:[],question:'Provide exit assistance, configuration and data portability, transition charges and service continuity terms.'},
  {id:'residency',label:'Control where traffic and data are handled',codes:[],question:'Identify inspection, logging, backup and support-access locations for each required country.'},
  {id:'ownership',label:'Make service responsibilities explicit',codes:[],question:'Provide a RACI for circuits, policy changes, monitoring, incident response and escalation.'},
  {id:'segmentation',label:'Separate critical, corporate and guest traffic',codes:['segmentation_vrf_capability'],question:'Show how required trust boundaries are enforced, tested and maintained across the proposed estate.'},
  {id:'cellular',label:'Maintain service during fixed-line failure',codes:['cap_5g_lte_support'],question:'Confirm site signal surveys, carrier diversity, failover behaviour, data allowances and usable applications.'},
  {id:'rollout',label:'Repeat installation across many locations',codes:['zero_touch_provisioning'],question:'Provide a site rollout plan, installer capacity, dependencies, acceptance testing and rollback approach.'},
  {id:'remote',label:'Control remote and third-party access',codes:['ztna'],question:'Describe identity and device checks, least-privilege policies and temporary third-party access.'},
  {id:'migration',label:'Migrate an existing network safely',codes:['brownfield_migration_support'],question:'Provide coexistence, migration sequencing, change windows, rollback and named delivery responsibilities.'},
  {id:'visibility',label:'Diagnose application and user experience',codes:['digital_experience_monitoring'],question:'Demonstrate the visibility, raw data and troubleshooting available to the buyer and service desk.'},
  {id:'routing',label:'Protect important application traffic',codes:['application_aware_routing'],question:'Explain application classification, traffic policy, impaired-link handling and performance measurement.'},
  {id:'cloud',label:'Connect cloud workloads and branches',codes:['multi_cloud_networking'],question:'Confirm the required cloud integrations, routing boundaries, throughput and additional charges.'},
] as const;
export type ChallengeId = typeof CHALLENGES[number]['id'];
export const COMPARISON_REGIONS = [
  ['uk_ireland','UK / Ireland'],['europe','Europe'],['north_america','North America'],['asia_pacific','Asia Pacific'],['middle_east_africa','Middle East / Africa'],['latin_america','Latin America'],['china_mainland','Mainland China'],
] as const;
export const sectorFor = (id:string) => SECTOR_CHOICES.find(s=>s.id===id);
export const challengeFor = (id:string) => CHALLENGES.find(c=>c.id===id);

export function canonicalSector(text:string): ComparisonSector | null {
  const value=text.toLowerCase().replace(/[_/-]/g,' ');
  const patterns:[ComparisonSector,RegExp][]=[['healthcare',/health|hospital|clinical|pharma/],['financial_services',/financial|bank|insurance/],['retail_ecommerce',/retail|e.?commerce|consumer/],['manufacturing',/manufactur|industrial/],['energy_utilities',/energy|utilit|oil|gas/],['government_public_sector',/government|public sector|council|local authorit/],['education',/education|school|universit/],['transport_logistics',/transport|logistic|shipping|aviation/],['professional_services',/professional|consult|legal|accountan/],['hospitality_leisure',/hospitality|leisure|hotel/]];
  return patterns.find(([,pattern])=>pattern.test(value))?.[0]??null;
}
