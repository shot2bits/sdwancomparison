export const SECTOR_COMPARISON_VERSION = 'sector-comparison/2026-11-10.5';
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
  {id:'resilience',label:'Test appliance and circuit recovery',codes:['high_availability'],question:'Describe appliance and circuit failure scenarios, recovery targets, test evidence and exclusions.'},
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

export const EXTRA_REQUIREMENTS = [
 {id:'path_selection',kind:'capability',label:'Dynamic path selection',codes:['dynamic_path_selection']},
 {id:'qos',kind:'capability',label:'QoS and traffic shaping',codes:['qos_and_traffic_engineering']},
 {id:'loss_recovery',kind:'capability',label:'Packet-loss remediation',codes:['forward_error_correction_packet_duplication']},
 {id:'internet_breakout',kind:'capability',label:'Local internet breakout',codes:['local_internet_breakout']},
 {id:'private_backbone',kind:'capability',label:'Private global backbone',codes:['f21_private_global_backbone']},
 {id:'satellite',kind:'capability',label:'LEO satellite support',codes:['leo_satellite_support']},
 {id:'branch_lan',kind:'capability',label:'Branch LAN and Wi-Fi integration',codes:['branch_lan_wlan_integration']},
 {id:'byod',kind:'capability',label:'Unmanaged and BYOD devices',codes:['unmanaged_byod_devices']},
 {id:'clientless',kind:'capability',label:'Clientless access',codes:['clientless_access']},
 {id:'privileged',kind:'capability',label:'Privileged access',codes:['privileged_access']},
 {id:'dns',kind:'capability',label:'DNS security',codes:['dns_security']},
 {id:'browser',kind:'capability',label:'Remote browser isolation',codes:['remote_browser_isolation']},
 {id:'ai_controls',kind:'capability',label:'Controls for generative AI applications',codes:['generative_ai_application_controls','ai_data_protection_controls']},
 {id:'api',kind:'capability',label:'APIs and automation',codes:['apis_and_automation']},
 {id:'portal',kind:'capability',label:'Customer portal and access controls',codes:['customer_portal_and_rbac']},
 {id:'sla_reporting',kind:'capability',label:'SLA reporting',codes:['sla_reporting']},
 {id:'iso27001',kind:'assurance',label:'ISO 27001 assurance evidence',codes:['iso','27001']},
 {id:'soc2',kind:'assurance',label:'SOC 2 assurance evidence',codes:['soc','2']},
 {id:'pci',kind:'assurance',label:'PCI DSS support and scope',codes:['pci']},
 {id:'gdpr',kind:'assurance',label:'GDPR-related controls and scope',codes:['gdpr']},
 {id:'dora',kind:'assurance',label:'DORA-related support',codes:['dora']},
 {id:'nis2',kind:'assurance',label:'NIS2-related support',codes:['nis','2']},
 {id:'nhs',kind:'assurance',label:'NHS assurance and DSPT evidence',codes:['nhs']},
 {id:'entra',kind:'integration',label:'Microsoft Entra ID integration',codes:['entra']},
 {id:'okta',kind:'integration',label:'Okta integration',codes:['okta']},
 {id:'aws',kind:'integration',label:'AWS integration',codes:['aws']},
 {id:'azure',kind:'integration',label:'Azure integration',codes:['azure']},
 {id:'gcp',kind:'integration',label:'Google Cloud integration',codes:['google']},
 {id:'splunk',kind:'integration',label:'Splunk integration',codes:['splunk']},
 {id:'servicenow',kind:'integration',label:'ServiceNow integration',codes:['servicenow']},
] as const;
export type ExtraRequirementId=typeof EXTRA_REQUIREMENTS[number]['id'];

/** Visible sector guidance is shared with the public research feed. */
export const SECTOR_COMPARISON_INTRO = {
 heading: 'Choose an SD-WAN or SASE provider for your sector.',
 paragraphs: [
  'Netify helps organisations compare SD-WAN and SASE technology vendors and managed service providers against the work their network needs to support. A retailer may need payments to keep working during a circuit failure. A manufacturer may need to give a maintenance supplier access to one system without opening the rest of the plant.',
  'Our provider research covers network and security features, deployment and management options, geographic coverage, integrations, assurance documents and customer case studies. Compare application-aware routing, cellular backup, traffic segmentation, zero trust access, web filtering and data loss prevention. Source links, review dates and qualifications show what the evidence supports and what still needs checking. AI helps structure your project notes; evidence checks use the published provider records. A listed feature does not prove that your application or proposed design will work.',
  'Choose your sector and a buying problem, such as payment failover, clinical migration or access for a machine supplier. Compare providers against the same requirements. See who operates the service, which capabilities have supporting evidence and what each supplier still needs to confirm. Download a Word decision pack with your shortlist, research and supplier questions. Use the RFP Builder when you are ready to ask suppliers for network designs and bids.',
 ],
} as const;

export const SECTOR_COMPARISON_EXAMPLE = 'For example, a retailer can compare evidence for cellular backup and payment-network separation, then take a payment failover test into the decision pack. The supplier still has to prove transaction behaviour, site coverage, licences and responsibilities for the proposed service.';
